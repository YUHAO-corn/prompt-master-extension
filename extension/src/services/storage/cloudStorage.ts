import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseAuth, mapFirebaseUser } from '../auth/firebase';
import { onAuthStateChanged as fbOnAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Prompt } from '../prompt/types';
import { StorageService } from './types';
import { STORAGE_KEYS, STORAGE_LIMITS } from './constants';
import { chromeStorageService } from './chromeStorage';
import { User } from '../auth/types';
import { isServiceWorkerEnvironment, safeLogger } from '../../utils/safeEnvironment';
import { getCentralStateManager } from '@/background/index';
import { MembershipState } from '@/types/centralState';
import { sendMessage } from '../../services/messaging';
import { promptLockingService } from './promptLockingService';
import { firestoreListenerService } from './firestoreListenerService';

// 同步状态类型
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

// 同步状态消息
export interface SyncStatusMessage {
  status: SyncStatus;
  message?: string;
  timestamp: number;
}

// 同步统计
export interface SyncStats {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  resolved: number;
}

// 待处理操作
export interface PendingOperation {
  type: 'upload' | 'delete';
  id: string;
  data?: any;
  timestamp: number;
}

/**
 * Firebase云存储服务
 * 提供提示词数据的云存储和同步功能
 */
export class CloudStorageService implements StorageService {
  // 存储状态
  private isOnlineStatus: boolean = !isServiceWorkerEnvironment ? navigator.onLine : true; // 在SW中默认假设在线
  private currentUser: User | null = null;
  private userId: string | null = null;
  private syncStatusListeners: ((status: SyncStatusMessage) => void)[] = [];
  private currentSyncStatus: SyncStatusMessage = { status: 'idle', timestamp: Date.now() };
  private pendingOperationsList: PendingOperation[] = [];
  private unsubscribeAuth: (() => void) | null = null;
  private lastSyncTime: number = 0;
  private wasPreviouslyLoggedIn: boolean = false;

  constructor() {
    safeLogger.log('[CloudStorageService] Constructor called. Initializing...');
    if (!isServiceWorkerEnvironment) {
      this.setupNetworkMonitoring();
    } else {
      safeLogger.log('CloudStorageService 在 Service Worker 环境中运行，网络监听已禁用');
    }
    this.initializeAuthListener();
    this.loadPendingOperations();
    this.loadLastSyncTime();
  }

  private initializeAuthListener() {
    const auth = getFirebaseAuth();
    this.wasPreviouslyLoggedIn = !!auth.currentUser; 
    safeLogger.log(`[CloudStorageService] initializeAuthListener: Initial logged in state: ${this.wasPreviouslyLoggedIn}`);

    // Initialize promptLockingService if already logged in
    if (this.wasPreviouslyLoggedIn && auth.currentUser) {
        promptLockingService.initialize(auth.currentUser.uid);
    } else {
        promptLockingService.cleanup(); // Ensure it's cleaned up if starting logged out
    }

    // Setup Firestore listener if already logged in
    if (this.wasPreviouslyLoggedIn && auth.currentUser) {
        firestoreListenerService.initialize(auth.currentUser.uid);
    } else {
        firestoreListenerService.cleanup(); // Ensure it's cleaned up if starting logged out
    }

    this.unsubscribeAuth = fbOnAuthStateChanged(auth, (user: FirebaseUser | null) => {
      const isCurrentlyLoggedIn = !!user;
      safeLogger.log(`[CloudStorageService] onAuthStateChanged triggered. User: ${user?.uid ?? 'null'}. Was previously logged in: ${this.wasPreviouslyLoggedIn}`);

      if (isCurrentlyLoggedIn && user) {
        if (!this.wasPreviouslyLoggedIn) {
           safeLogger.log(`[CloudStorageService] User logged IN: ${user.uid}`);
           this.currentUser = mapFirebaseUser(user);
           this.userId = user.uid;
           // Initialize the locking service for the new user
           promptLockingService.initialize(this.userId);
           // Initialize the Firestore listener service
           firestoreListenerService.initialize(this.userId);
           this.onLoginSuccess();
        } else {
           safeLogger.log(`[CloudStorageService] User already logged in, auth state updated for: ${user.uid}`);
           this.currentUser = mapFirebaseUser(user);
           this.userId = user.uid;
           // Ensure locking service is initialized if auth state updated while logged in
           promptLockingService.initialize(this.userId);
            // Ensure Firestore listener is initialized if auth state updated while logged in
           firestoreListenerService.initialize(this.userId);
        }
      } else {
        if (this.wasPreviouslyLoggedIn) {
          safeLogger.log(`[CloudStorageService] User logged OUT. Cleaning up listeners for previous user: ${this.userId}`);
          this.currentUser = null;
          this.userId = null;
          // Cleanup the locking service
          promptLockingService.cleanup();
          // Cleanup the Firestore listener service
          firestoreListenerService.cleanup();
          this.onLogout();
        } else {
          safeLogger.log('[CloudStorageService] Auth state is null, but was not previously logged in. Skipping cleanup.');
          // Ensure services are cleaned up if starting logged out
           promptLockingService.cleanup();
           firestoreListenerService.cleanup();
        }
      }
      this.wasPreviouslyLoggedIn = isCurrentlyLoggedIn;
    });
  }

  private setupNetworkMonitoring() {
    if (isServiceWorkerEnvironment) return;

    try {
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        if (this.isAuthenticated()) {
          this.setSyncStatus('syncing', 'Network restored, syncing...');
          this.processPendingOperations();
        }
      });
      
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        this.setSyncStatus('offline', 'Currently offline');
      });
    } catch (error) {
      safeLogger.error('设置网络监控失败:', error);
    }
  }

  private async onLoginSuccess() {
    safeLogger.log('[CloudStorage] onLoginSuccess triggered.');
    try {
      // Load last sync time again just in case it wasn't loaded or was reset
      await this.loadLastSyncTime(); 

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Condition for full sync: Never synced before OR last sync was more than 24 hours ago
      const needsFullSync = this.lastSyncTime === 0 || (now - this.lastSyncTime > twentyFourHours);

      if (needsFullSync) {
        safeLogger.log(`[CloudStorage] Conditions met for full sync (lastSync: ${this.lastSyncTime === 0 ? 'Never' : new Date(this.lastSyncTime).toISOString()}). Starting syncAllPrompts...`);
        this.setSyncStatus('syncing', 'First sync or data outdated, performing full sync...');
        const stats = await this.syncAllPrompts(); // Perform full sync
        // syncAllPrompts internally sets status to synced/error and updates lastSyncTime
        safeLogger.log(`[CloudStorage] Full sync completed. Stats: Uploaded=${stats.uploaded}, Downloaded=${stats.downloaded}`);
      } else {
        safeLogger.log(`[CloudStorage] Performing incremental sync checks on login (lastSync: ${new Date(this.lastSyncTime).toISOString()}).`);
        this.setSyncStatus('syncing', 'Checking for updates...');
        
        // Trigger both incremental checks concurrently
        const uploadPromise = this.processPendingOperations().catch(error => {
            safeLogger.error('[CloudStorage] Error processing pending operations on login:', error);
            // Don't let this error block the sync status update entirely
        });
        const downloadPromise = this.syncIncrementalDownloads().catch(error => {
            safeLogger.error('[CloudStorage] Error performing incremental download sync on login:', error);
             // Don't let this error block the sync status update entirely
             // If download fails, status might remain 'syncing' until next successful sync
             this.setSyncStatus('error', 'Failed to check cloud updates'); 
        });

        await Promise.all([uploadPromise, downloadPromise]);
        
        // Update status *after* checks complete, only if no error occurred during download check
        // (processPendingOperations doesn't set status, syncIncrementalDownloads does)
        if (this.currentSyncStatus.status !== 'error') {
            // Check status again as syncIncrementalDownloads might have set it
             if (this.currentSyncStatus.status === 'syncing') { // If download didn't find anything and didn't update status
                 this.setSyncStatus('synced', 'Up to date.');
             } else {
                 safeLogger.log('[CloudStorage] Sync status already updated by incremental checks.');
             }
        }
        safeLogger.log('[CloudStorage] Incremental sync checks on login completed.');
      }

    } catch (error) {
      // Catch errors from syncAllPrompts or initial checks
      safeLogger.error('[CloudStorage] Error during onLoginSuccess sync process:', error);
      this.setSyncStatus('error', 'Sync failed, please try again later');
    }
  }

  private async onLogout() {
    this.setSyncStatus('idle', 'Logged out');
  }

  private setSyncStatus(status: SyncStatus, message?: string) {
    this.currentSyncStatus = {
      status,
      message,
      timestamp: Date.now()
    };
    
    this.syncStatusListeners.forEach(listener => {
      listener(this.currentSyncStatus);
    });
    
    this.saveSyncStatusLocally();
  }

  private async saveSyncStatusLocally() {
    try {
      await chromeStorageService.set(STORAGE_KEYS.SYNC_STATUS, this.currentSyncStatus);
    } catch (error) {
      console.error('保存同步状态失败:', error);
    }
  }

  private async loadPendingOperations() {
    try {
      const pendingOps = await chromeStorageService.get<PendingOperation[]>(STORAGE_KEYS.PENDING_OPERATIONS);
      if (pendingOps) {
        this.pendingOperationsList = pendingOps;
      }
    } catch (error) {
      console.error('加载待处理操作失败:', error);
    }
  }

  private async savePendingOperations() {
    try {
      await chromeStorageService.set(STORAGE_KEYS.PENDING_OPERATIONS, this.pendingOperationsList);
    } catch (error) {
      console.error('保存待处理操作失败:', error);
    }
  }

  private addPendingOperation(operation: PendingOperation) {
    const existingIndex = this.pendingOperationsList.findIndex(op => op.id === operation.id);
    
    if (existingIndex >= 0) {
      this.pendingOperationsList[existingIndex] = operation;
    } else {
      this.pendingOperationsList.push(operation);
    }
    
    this.savePendingOperations();
  }

  private removePendingOperation(id: string) {
    this.pendingOperationsList = this.pendingOperationsList.filter(op => op.id !== id);
    this.savePendingOperations();
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public get pendingOperations(): PendingOperation[] {
    return [...this.pendingOperationsList];
  }

  public async processPendingOperations(): Promise<void> {
    // Check conditions first
    if (!this.isOnlineStatus || !this.userId || this.pendingOperationsList.length === 0) {
      return;
    }

    console.log(`[CloudStorage] 开始处理 ${this.pendingOperationsList.length} 个待处理操作...`);
    
    // Copy the list to avoid mutation issues during async operations
    const operationsToProcess = [...this.pendingOperationsList];
    const processedIds: string[] = [];
    const db = getFirestore();
    let batch = writeBatch(db);
    let batchOps = 0;
    const BATCH_LIMIT = 400; // Firestore batch limit is 500, leave some margin

    for (const op of operationsToProcess) {
      try {
        const promptRef = doc(db, 'users', this.userId, 'prompts', op.id);

        if (op.type === 'upload') {
          let dataToUpload: Prompt | null = null;
          // Use op.data if available (passed from save/update), otherwise fetch latest local
          if (op.data) {
             dataToUpload = op.data as Prompt;
          } else {
             dataToUpload = await chromeStorageService.getPrompt(op.id);
          }

          // Only upload if it's still considered active locally
          if (dataToUpload && dataToUpload.isActive !== false) {
             const finalData = {
               ...dataToUpload,
               isActive: true, // Ensure isActive and active are true for uploads
               active: true,
               userId: this.userId,
               updatedAt: op.timestamp // Use timestamp from pending op for consistency
             };
             // Clean undefined fields
             Object.keys(finalData).forEach(key => {
                 if (finalData[key as keyof typeof finalData] === undefined) {
                   delete finalData[key as keyof typeof finalData];
                 }
             });
             batch.set(promptRef, finalData, { merge: true });
             batchOps++;
          } else {
             // If local data is gone or marked inactive, treat as delete on cloud
             batch.update(promptRef, { isActive: false, active: false, updatedAt: op.timestamp });
             batchOps++;
          }
        } else if (op.type === 'delete') {
          // Always perform soft delete using the timestamp from the operation
          batch.update(promptRef, { isActive: false, active: false, updatedAt: op.timestamp });
          batchOps++;
        }
        
        processedIds.push(op.id); // Mark for removal upon successful commit

        // Commit batch if limit reached
        if (batchOps >= BATCH_LIMIT) {
          console.log(`[CloudStorage] Committing batch of ${batchOps} operations...`);
          await batch.commit();
          console.log(`[CloudStorage] Batch committed.`);
          // Remove processed IDs from the main list *only after successful commit*
          this.pendingOperationsList = this.pendingOperationsList.filter(p => !processedIds.includes(p.id));
          await this.savePendingOperations(); // Persist removal
          
          // Reset for next batch
          processedIds.length = 0; 
          batch = writeBatch(db);
          batchOps = 0;
        }

      } catch (error) {
        // Log error but continue processing other operations in the list for now
        // The failed operation remains in pendingOperationsList for retry next time
        console.error(`[CloudStorage] 处理待处理操作时出错 (${op.type} ${op.id}):`, error);
        // If a batch commit fails, subsequent operations in this run won't be processed
        // because the error will likely be thrown by batch.commit()
        if (error && (error as any).message?.includes('commit')) {
            console.error('[CloudStorage] Batch commit failed. Remaining operations will be retried later.');
            break; // Exit the loop for this run
        }
      }
    }

    // Commit any remaining operations in the last batch
    if (batchOps > 0) {
      try {
        console.log(`[CloudStorage] Committing final batch of ${batchOps} operations...`);
        await batch.commit();
        console.log(`[CloudStorage] Final batch committed.`);
        // Remove processed IDs from the main list *only after successful commit*
        this.pendingOperationsList = this.pendingOperationsList.filter(p => !processedIds.includes(p.id));
        await this.savePendingOperations(); // Persist removal
      } catch (error) {
         console.error(`[CloudStorage] Final batch commit failed:`, error);
         // Failed operations remain in the queue
      }
    }
    
    console.log('[CloudStorage] 待处理操作处理完成。');
  }

  private async uploadPromptToFirestore(prompt: Prompt): Promise<void> {
    if (!this.userId) return;
    if (prompt.isActive === false) {
        console.warn(`[CloudStorage] 尝试上传已标记为删除的提示词 ${prompt.id}，已阻止。将尝试软删除云端版本。`);
        await this.softDeletePromptInFirestore(prompt.id);
        return;
    }
    const db = getFirestore();
    const dataToUpload = {
      ...prompt,
      isActive: true,
      active: true,
      userId: this.userId
    };
    Object.keys(dataToUpload).forEach(key => {
        if (dataToUpload[key as keyof typeof dataToUpload] === undefined) {
          delete dataToUpload[key as keyof typeof dataToUpload];
        }
    });

    const promptRef = doc(db, 'users', this.userId, 'prompts', prompt.id);
    await setDoc(promptRef, dataToUpload, { merge: true });
     console.log(`[CloudStorage] 成功上传/更新提示词到Firestore: ${prompt.id}`);
  }

  private async softDeletePromptInFirestore(promptId: string): Promise<void> {
    if (!this.userId) {
      console.warn('[CloudStorage] 用户未登录，无法在 Firestore 中软删除');
      return;
    }
    const db = getFirestore();
    const promptRef = doc(db, 'users', this.userId, 'prompts', promptId);
    try {
      await updateDoc(promptRef, {
        isActive: false,
        active: false,
        updatedAt: Date.now()
      });
      console.log(`[CloudStorage] 成功在Firestore中软删除提示词: ${promptId}`);
    } catch (error: any) {
      if (error.code === 'not-found') {
        console.log(`[CloudStorage] Firestore文档 ${promptId} 不存在，无需软删除。`);
        return;
      }
      console.error(`[CloudStorage] 在Firestore中软删除提示词失败: ${promptId}`, error);
      throw error;
    }
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    return chromeStorageService.getPrompt(id);
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return chromeStorageService.getAllPrompts();
  }

  private async _syncPromptUpload(prompt: Prompt): Promise<void> {
    if (!this.userId) {
      console.log('[CloudStorage] 用户未登录，跳过上传同步。');
      return;
    }

    if (prompt.isActive === false) {
      console.warn(`[CloudStorage] 尝试同步上传已软删除的提示词 ${prompt.id}，已阻止。将尝试软删除云端版本。`);
      try {
         if (this.isOnlineStatus) {
           await this.softDeletePromptInFirestore(prompt.id);
           this.removePendingOperation(prompt.id);
         } else {
           this.addPendingOperation({ type: 'delete', id: prompt.id, timestamp: Date.now() });
         }
      } catch (error) {
         console.error(`[CloudStorage] 在阻止上传软删除提示词时，尝试软删除云端版本失败: ${prompt.id}`, error);
         this.addPendingOperation({ type: 'delete', id: prompt.id, timestamp: Date.now() });
      }
      return;
    }

    try {
      if (this.isOnlineStatus) {
        console.log(`[CloudStorage] 在线状态，尝试立即上传/更新 Firestore: ${prompt.id}`);
        await this.uploadPromptToFirestore(prompt);
        this.removePendingOperation(prompt.id);
      } else {
        console.log(`[CloudStorage] 离线状态，将上传操作加入待处理队列: ${prompt.id}`);
        this.addPendingOperation({
          type: 'upload',
          id: prompt.id,
          data: prompt,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`[CloudStorage] 同步上传到 Firestore 失败: ${prompt.id}`, error);
      console.log(`[CloudStorage] 将失败的上传操作加入待处理队列: ${prompt.id}`);
      this.addPendingOperation({ type: 'upload', id: prompt.id, data: prompt, timestamp: Date.now() });
    }
  }

  async savePrompt(prompt: Prompt): Promise<void> {
    if (!prompt.id) throw new Error("Prompt must have an id");
    const now = Date.now();
    const promptToSave = { ...prompt, updatedAt: now };
    
    // 1. Add to pending queue first (with current data)
    this.addPendingOperation({
      type: 'upload',
      id: promptToSave.id,
      data: { ...promptToSave }, // Pass data to avoid race condition if local changes before processing
      timestamp: now
    });
    
    try {
      // 2. Save locally immediately for responsiveness
      await chromeStorageService.savePrompt(promptToSave);
      safeLogger.log(`[CloudStorage] Prompt ${prompt.id} saved locally.`);

      // 3. Attempt direct upload if online (fire and forget, queue handles reliability)
      if (this.isOnlineStatus && this.userId) {
        this.uploadPromptToFirestore(promptToSave).catch(error => {
           // Log error, but queue will handle retry
           safeLogger.warn(`[CloudStorage] Direct upload attempt for ${prompt.id} failed (will retry via queue):`, error);
        });
      }
    } catch (error) {
       safeLogger.error(`[CloudStorage] Error during savePrompt for ${prompt.id}:`, error);
       // Error saving locally is more critical, maybe re-throw?
       // For now, just log. Queue still has the operation.
       throw error; // Re-throw local save errors? Decide on handling.
    }
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
    const now = Date.now();
    const updatedFields = { ...updates, updatedAt: now };
    
    // 1. Add to pending queue first
    // Need to get the full prompt data to put in the queue
    const currentPrompt = await chromeStorageService.getPrompt(id);
    if (!currentPrompt) {
        throw new Error(`Prompt with id ${id} not found locally for update.`);
    }
    const updatedPromptData = { ...currentPrompt, ...updatedFields };

    this.addPendingOperation({
      type: 'upload',
      id: id,
      data: { ...updatedPromptData }, // Pass merged data
      timestamp: now
    });

    try {
      // 2. Update locally immediately
      await chromeStorageService.updatePrompt(id, updatedFields);
      safeLogger.log(`[CloudStorage] Prompt ${id} updated locally.`);

      // 3. Attempt direct upload if online
      if (this.isOnlineStatus && this.userId) {
        // Need the full prompt data for upload function
        this.uploadPromptToFirestore(updatedPromptData).catch(error => {
          safeLogger.warn(`[CloudStorage] Direct update attempt for ${id} failed (will retry via queue):`, error);
        });
      }
    } catch (error) {
      safeLogger.error(`[CloudStorage] Error during updatePrompt for ${id}:`, error);
      throw error; // Re-throw local update errors?
    }
  }

  async deletePrompt(id: string): Promise<void> {
    const now = Date.now();

    // 1. Add 'delete' operation to pending queue first
    this.addPendingOperation({
      type: 'delete',
      id: id,
      timestamp: now
    });

    try {
      // 2. Soft delete locally immediately
      await chromeStorageService.deletePrompt(id); // Assuming this performs a soft delete locally
      safeLogger.log(`[CloudStorage] Prompt ${id} marked for deletion locally.`);

      // 3. Attempt direct soft delete on Firestore if online
      if (this.isOnlineStatus && this.userId) {
        this.softDeletePromptInFirestore(id).catch(error => {
           safeLogger.warn(`[CloudStorage] Direct delete attempt for ${id} failed (will retry via queue):`, error);
        });
      }
    } catch (error) {
      safeLogger.error(`[CloudStorage] Error during deletePrompt for ${id}:`, error);
      throw error; // Re-throw local delete errors?
    }
  }

  async incrementUseCount(id: string): Promise<void> {
    await chromeStorageService.incrementUseCount(id);
    
    const updatedPrompt = await chromeStorageService.getPrompt(id);
    if (updatedPrompt) {
      await this._syncPromptUpload(updatedPrompt);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return chromeStorageService.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return chromeStorageService.set<T>(key, value);
  }

  async remove(key: string): Promise<void> {
    return chromeStorageService.remove(key);
  }

  async clear(): Promise<void> {
    return chromeStorageService.clear();
  }

  public onSyncStatusChange(callback: (status: SyncStatusMessage) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    callback(this.currentSyncStatus);
    
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(listener => listener !== callback);
    };
  }

  public getSyncStatus(): SyncStatusMessage {
    return this.currentSyncStatus;
  }

  public async syncAllPrompts(): Promise<SyncStats> {
    if (!this.userId) {
      throw new Error('用户未登录，无法同步');
    }
    this.setSyncStatus('syncing', 'Starting full sync...');
    console.log('[CloudStorage] 开始执行 syncAllPrompts');

    const stats: SyncStats = { uploaded: 0, downloaded: 0, conflicts: 0, resolved: 0 };
    const batch = writeBatch(getFirestore());
    let batchOps = 0;

    try {
      const localPromptsRaw = await chromeStorageService.getAllPrompts();
      const localPromptsMap = new Map(localPromptsRaw.map(p => [p.id, p]));
      console.log(`[CloudStorage] 获取到 ${localPromptsRaw.length} 个本地提示词`);

      const cloudPromptsActive = await this.getCloudPrompts(true);
      const cloudPromptsActiveMap = new Map(cloudPromptsActive.map(p => [p.id, p]));
      console.log(`[CloudStorage] 获取到 ${cloudPromptsActive.length} 个云端活动提示词`);

      // Object to collect prompts for batch local save
      const promptsToDownloadLocally: { [key: string]: Prompt } = {};

      for (const [localId, localPrompt] of localPromptsMap.entries()) {
        const cloudPrompt = cloudPromptsActiveMap.get(localId);

        if (localPrompt.isActive !== false) {
          if (!cloudPrompt) {
            console.log(`[CloudStorage] 准备上传本地独有提示词: ${localId}`);
            const promptRef = doc(getFirestore(), 'users', this.userId, 'prompts', localId);
            const dataToUpload = { ...localPrompt, userId: this.userId, isActive: true, active: true };
            Object.keys(dataToUpload).forEach(key => {
                if (dataToUpload[key as keyof typeof dataToUpload] === undefined) {
                  delete dataToUpload[key as keyof typeof dataToUpload];
                }
            });
            batch.set(promptRef, dataToUpload, { merge: true });
            stats.uploaded++;
            batchOps++;
          } else {
            if ((localPrompt.updatedAt || 0) > (cloudPrompt.updatedAt || 0)) {
              console.log(`[CloudStorage] 准备上传本地较新版本: ${localId}`);
              const promptRef = doc(getFirestore(), 'users', this.userId, 'prompts', localId);
              const dataToUpload = { ...localPrompt, userId: this.userId, isActive: true, active: true };
              Object.keys(dataToUpload).forEach(key => {
                  if (dataToUpload[key as keyof typeof dataToUpload] === undefined) {
                    delete dataToUpload[key as keyof typeof dataToUpload];
                  }
              });
              batch.set(promptRef, dataToUpload, { merge: true });
              stats.uploaded++;
              batchOps++;
            } else if ((localPrompt.updatedAt || 0) < (cloudPrompt.updatedAt || 0)) {
              console.log(`[CloudStorage] Preparing download for cloud newer version: ${cloudPrompt.id}`);
              // Add to download batch instead of saving immediately
              const storageKey = `${STORAGE_KEYS.PROMPT_PREFIX}${cloudPrompt.id}`;
              promptsToDownloadLocally[storageKey] = cloudPrompt;
              stats.downloaded++;
            }
            // Remove processed cloud prompt
            cloudPromptsActiveMap.delete(localId);
          }
        } else {
          if (cloudPrompt) {
            console.log(`[CloudStorage] 准备在云端软删除本地已删除的提示词: ${localId}`);
            const promptRef = doc(getFirestore(), 'users', this.userId, 'prompts', localId);
            batch.update(promptRef, { isActive: false, active: false, updatedAt: Date.now() });
            batchOps++;
            stats.uploaded++;
            cloudPromptsActiveMap.delete(localId);
          }
        }
      }

      // Process remaining cloud prompts (cloud unique)
      for (const cloudPrompt of cloudPromptsActiveMap.values()) {
          console.log(`[CloudStorage] Preparing download for cloud unique prompt: ${cloudPrompt.id}`);
          // Add to download batch
          const storageKey = `${STORAGE_KEYS.PROMPT_PREFIX}${cloudPrompt.id}`;
          promptsToDownloadLocally[storageKey] = cloudPrompt;
          stats.downloaded++;
      }

      // --- Perform Actions --- 

      // 1. Commit Firestore batch writes (Uploads/Updates/Soft Deletes)
      if (batchOps > 0) {
        console.log(`[CloudStorage] Committing ${batchOps} Firestore batch write operations...`);
        await batch.commit();
      }

      // 2. Commit Local batch writes (Downloads)
      if (Object.keys(promptsToDownloadLocally).length > 0) {
          console.log(`[CloudStorage] Committing ${Object.keys(promptsToDownloadLocally).length} local batch write operations...`);
          await chromeStorageService.setMultiple(promptsToDownloadLocally);
          // TODO: After local batch write, consider sending update notifications if needed
          // This might require iterating through promptsToDownloadLocally and sending individual PROMPT_UPDATED messages.
      }

      // --- Finalize --- 
      this.lastSyncTime = Date.now();
      await chromeStorageService.set(STORAGE_KEYS.LAST_SYNC_TIME, this.lastSyncTime);
      this.setSyncStatus('synced', 'Sync completed successfully.');
      safeLogger.log(`[CloudStorage] syncAllPrompts 完成`);

      // --- 通知前端关于同步完成 --- 
      try {
        // 发送同步完成消息
        await sendMessage({ type: 'CLOUD_SYNC_COMPLETED' });
        safeLogger.log(`[CloudStorage] Sent CLOUD_SYNC_COMPLETED message.`);
      } catch (msgError) {
        safeLogger.error('[CloudStorage] 发送云同步完成通知失败:', msgError);
        // 通常不应因为消息发送失败而使整个操作失败
      }
      // --- 通知结束 ---

      return stats;

    } catch (error: any) {
      safeLogger.error('[CloudStorage] 同步提示词失败:', error);
      this.setSyncStatus('error', 'Sync failed, please try again later');
      throw error;
    }
  }

  private async getCloudPrompts(onlyActive: boolean = false): Promise<Prompt[]> {
    if (!this.userId) return [];
    const db = getFirestore();
    const promptsRef = collection(db, 'users', this.userId, 'prompts');

    const q = onlyActive
      ? query(promptsRef, where('isActive', '!=', false))
      : promptsRef;

    const snapshot = await getDocs(q);
    const prompts: Prompt[] = [];
    snapshot.forEach(doc => {
       const data = doc.data();
       const isActive = data.isActive === undefined ? true : data.isActive;
       if (!onlyActive || isActive !== false) {
           prompts.push({ id: doc.id, ...data, isActive } as Prompt);
       }
    });
    return prompts;
  }

  private async getCloudPromptById(promptId: string): Promise<Prompt | null> {
    if (!this.userId) return null;
    const db = getFirestore();
    const promptRef = doc(db, 'users', this.userId, 'prompts', promptId);
    const docSnap = await getDoc(promptRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
       const isActive = data.isActive === undefined ? true : data.isActive;
      return { id: docSnap.id, ...data, isActive } as Prompt;
    } else {
      return null;
    }
  }

  async reset(): Promise<void> {
    console.log('[CloudStorageService] 重置云存储服务状态');
    await this.onLogout();
    // Also reset the locking service
    promptLockingService.cleanup();
    // Also reset the listener service
    firestoreListenerService.cleanup();
  }

  public destroy(): void {
    safeLogger.log('[CloudStorageService] Destroying...');
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    // this.cleanupFirestoreListeners(); // REMOVED
    // Destroy the locking service as well
    promptLockingService.cleanup();
    // Destroy the listener service as well
    firestoreListenerService.cleanup();
  }

  private async loadLastSyncTime() {
      try {
          const time = await chromeStorageService.get<number>(STORAGE_KEYS.LAST_SYNC_TIME);
          this.lastSyncTime = time || 0;
          safeLogger.log(`[CloudStorage] Loaded lastSyncTime: ${this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : 'Never'}`);
      } catch (error) {
          safeLogger.error('[CloudStorage] Error loading lastSyncTime:', error);
          this.lastSyncTime = 0; // Default to 0 on error
      }
  }

  /**
   * Fetches changes from Firestore since the last sync time and updates local storage.
   */
  public async syncIncrementalDownloads(): Promise<void> {
      if (!this.userId || !this.isOnlineStatus) {
          safeLogger.log('[CloudStorage] Skipping incremental download: User not logged in or offline.');
          return;
      }
      if (this.lastSyncTime === 0) {
          safeLogger.log('[CloudStorage] Skipping incremental download: No previous sync time found. Full sync needed.');
          // Maybe trigger full sync here? Or rely on login/manual trigger.
          return; 
      }

      safeLogger.log(`[CloudStorage] Starting incremental download sync from timestamp: ${this.lastSyncTime}`);
      this.setSyncStatus('syncing', 'Checking cloud updates...');

      let downloadedCount = 0;
      // Object to collect updates for batch local save
      const updatesToSaveLocally: { [key: string]: Prompt } = {}; 

      try {
          const db = getFirestore();
          const promptsRef = collection(db, 'users', this.userId, 'prompts');
          const lastSyncTimestamp = Timestamp.fromMillis(this.lastSyncTime);

          // Query for documents modified *after* the last sync time
          // Note: Firestore timestamp precision might require a slight overlap or careful handling
          const q = query(promptsRef, where('updatedAt', '>', lastSyncTimestamp));
          
          const snapshot = await getDocs(q);
          safeLogger.log(`[CloudStorage] Incremental download query found ${snapshot.docs.length} potential updates.`);

          if (snapshot.empty) {
              safeLogger.log('[CloudStorage] No new cloud updates found since last sync.');
              this.setSyncStatus('synced', 'Up to date.'); // Update status even if no changes
              // Update lastSyncTime slightly to avoid re-querying the exact same boundary?
              // this.lastSyncTime = Date.now(); 
              // await chromeStorageService.set(STORAGE_KEYS.LAST_SYNC_TIME, this.lastSyncTime);
              return;
          }

          let maxUpdateTime = this.lastSyncTime;

          for (const docSnap of snapshot.docs) {
              const cloudPrompt = { id: docSnap.id, ...docSnap.data() } as Prompt;
              
              // --- Safely determine cloud update time ---
              let cloudUpdateTime = 0;
              const updatedAt = cloudPrompt.updatedAt;
              if (typeof updatedAt === 'object' && updatedAt !== null && typeof (updatedAt as any).toDate === 'function') {
                 // Looks like a Firestore Timestamp
                 try {
                     cloudUpdateTime = (updatedAt as Timestamp).toMillis();
                 } catch (e) {
                     safeLogger.warn(`[CloudStorage] Error converting Firestore Timestamp for ${cloudPrompt.id}:`, e);
                     cloudUpdateTime = 0; // Fallback
                 }
              } else if (typeof updatedAt === 'number') {
                  cloudUpdateTime = updatedAt;
              }
              // --- End safe determination ---
              
              if (cloudUpdateTime > maxUpdateTime) {
                  maxUpdateTime = cloudUpdateTime;
              }

              // Get local version to compare (or check if it exists)
              const localPrompt = await chromeStorageService.getPrompt(cloudPrompt.id);
              const localUpdateTime = localPrompt?.updatedAt || 0;
              
              // If cloud is newer than local (or local doesn't exist)
              if (cloudUpdateTime > localUpdateTime) {
                  if (cloudPrompt.isActive !== false) {
                     safeLogger.log(`[CloudStorage] Downloading update for ${cloudPrompt.id} (Cloud: ${cloudUpdateTime}, Local: ${localUpdateTime})`);
                     // Construct the key for batch update
                     const storageKey = `${STORAGE_KEYS.PROMPT_PREFIX}${cloudPrompt.id}`;
                     updatesToSaveLocally[storageKey] = cloudPrompt; 
                     downloadedCount++;
                  } else {
                      // If cloud version is marked inactive (soft deleted) and newer than local
                      safeLogger.log(`[CloudStorage] Processing cloud soft delete for ${cloudPrompt.id}`);
                      await chromeStorageService.deletePrompt(cloudPrompt.id); // Perform local soft delete
                      // No need to add to batch save, delete is separate
                  }
              } else {
                   safeLogger.log(`[CloudStorage] Skipping download for ${cloudPrompt.id}, local version is same or newer.`);
              }
          }

          // Batch save updates to local storage if any
          if (Object.keys(updatesToSaveLocally).length > 0) {
              safeLogger.log(`[CloudStorage] Saving ${Object.keys(updatesToSaveLocally).length} updates locally using setMultiple...`);
              await chromeStorageService.setMultiple(updatesToSaveLocally);
               // TODO: Consider sending notifications after batch update
          }

          // Update last sync time to the timestamp of the most recent document processed in this batch
          // Using maxUpdateTime ensures we don't miss docs with the exact same timestamp in the next run
          this.lastSyncTime = maxUpdateTime;
          await chromeStorageService.set(STORAGE_KEYS.LAST_SYNC_TIME, this.lastSyncTime);
          safeLogger.log(`[CloudStorage] Incremental download sync completed. Downloaded: ${downloadedCount}. New lastSyncTime: ${this.lastSyncTime}`);
          this.setSyncStatus('synced', `Cloud sync completed (${downloadedCount} updates)`);

      } catch (error) {
          safeLogger.error('[CloudStorage] Incremental download sync failed:', error);
          this.setSyncStatus('error', 'Failed to check cloud updates');
          // Don't update lastSyncTime on error
      }
  }
}

export const cloudStorageService = new CloudStorageService(); 