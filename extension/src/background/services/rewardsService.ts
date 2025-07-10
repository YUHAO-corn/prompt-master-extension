import { collection, doc, Firestore, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { TaskType } from '@/types/rewards';
import { CentralStateManager } from './centralStateManager';

// --- Message Types ---
export const REWARDS_TASKS_UPDATED = 'REWARDS_TASKS_UPDATED';

// --- Task State Type ---
export interface TaskStateData {
  taskId: string;
  completed: boolean;
  claimed: boolean;
  progress: number;
  completedAt?: number;
  claimedAt?: number;
  updatedAt?: number;
}

export interface RewardsState {
  tasks: TaskStateData[];
  isLoading: boolean;
  error: Error | null;
}

// --- Helper function for deep comparison ---
function simpleDeepEquals(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!obj2.hasOwnProperty(key) || !simpleDeepEquals(obj1[key], obj2[key])) {
      return false;
    }
  }
  return true;
}

// --- RewardsService Class ---
export class RewardsService {
    private db: Firestore;
    private centralStateManager: CentralStateManager;
    
    private rewardsState: RewardsState = {
        tasks: [],
        isLoading: false,
        error: null,
    };

    private firestoreUnsubscribe: Unsubscribe | null = null;
    private centralStateUnsubscribe: (() => void) | null = null;
    private currentUserId: string | null = null;

    constructor(centralStateManager: CentralStateManager) {
        console.log('[RewardsService] Instantiating...');
        this.centralStateManager = centralStateManager;
        
        try {
            const app = getApps().length === 0 ? null : getApp();
            if (!app) {
                throw new Error('Firebase app not initialized');
            }
            this.db = getFirestore(app);
            console.log('[RewardsService] Firebase initialized.');
        } catch (error) {
            console.error('[RewardsService] Firebase initialization error:', error);
            this.db = {} as Firestore; // Dummy
            throw new Error("RewardsService failed to initialize Firebase.");
        }
    }

    async initialize(): Promise<void> {
        console.log('[RewardsService] Initializing...');
        this.setupCentralStateListener();
        console.log('[RewardsService] Initialization complete.');
    }

    // --- Message Sending ---
    private sendMessageToUI(type: string, payload: any): void {
        chrome.runtime.sendMessage({ type, payload }).catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Could not establish connection') || errorMessage.includes('Receiving end does not exist')) {
                // UI likely closed, ignore
            } else {
                console.error(`[RewardsService] Error sending message type ${type}. Error: ${errorMessage}`, error);
            }
        });
    }

    // --- Central State Listener ---
    private setupCentralStateListener(): void {
        if (this.centralStateUnsubscribe) {
            console.warn('[RewardsService] Central state listener already exists. Skipping setup.');
            return;
        }

        console.log('[RewardsService] Setting up CentralStateManager listener...');
        
        // 监听认证状态变化
        this.centralStateUnsubscribe = this.centralStateManager.subscribeToMembershipState((membershipState) => {
            const authState = this.centralStateManager.getAuthState();
            const newUserId = authState.userId;
            
            if (newUserId !== this.currentUserId) {
                console.log(`[RewardsService] User changed from ${this.currentUserId} to ${newUserId}`);
                this.currentUserId = newUserId;
                
                if (newUserId) {
                    this.cleanupFirestoreListener();
                    this.setupFirestoreListener(newUserId);
                } else {
                    this.cleanupFirestoreListener();
                    this.resetRewardsState();
                }
            }
        });
    }

    // --- Firestore Listener ---
    private setupFirestoreListener(userId: string): void {
        if (this.firestoreUnsubscribe) {
            console.warn(`[RewardsService] Firestore listener already active for user ${userId}. Skipping setup.`);
            return;
        }
        if (!userId) {
            console.warn('[RewardsService] Cannot setup Firestore listener without userId.');
            return;
        }

        const tasksCollectionRef = collection(this.db, 'users', userId, 'rewards_tasks');
        console.log(`[RewardsService] Attaching Firestore listener for user ${userId}.`);

        this.rewardsState.isLoading = true;
        this.firestoreUnsubscribe = onSnapshot(tasksCollectionRef, (snapshot) => {
            console.log(`[RewardsService] Firestore tasks snapshot received for user ${userId}. Size: ${snapshot.size}`);
            
            const tasks: TaskStateData[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log(`[RewardsService] Processing task doc ${doc.id}:`, data);
                
                tasks.push({
                    taskId: doc.id,
                    completed: data.completed || false,
                    claimed: data.claimed || false,
                    progress: data.progress || 0,
                    completedAt: data.completedAt?.toMillis?.() || data.completedAt,
                    claimedAt: data.claimedAt?.toMillis?.() || data.claimedAt,
                    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
                });
            });

            this.handleTasksStateChange(tasks);
        }, (error) => {
            console.error(`[RewardsService] Firestore listener error for user ${userId}:`, error);
            this.rewardsState = {
                ...this.rewardsState,
                isLoading: false,
                error: error,
            };
            this.sendMessageToUI(REWARDS_TASKS_UPDATED, { ...this.rewardsState });
        });
    }

    private handleTasksStateChange(tasks: TaskStateData[]): void {
        const previousState = { ...this.rewardsState };
        this.updateRewardsState(tasks);

        // 比较状态变化
        const relevantPreviousState = { ...previousState, isLoading: undefined, error: undefined };
        const relevantCurrentState = { ...this.rewardsState, isLoading: undefined, error: undefined };

        if (!simpleDeepEquals(relevantPreviousState, relevantCurrentState)) {
            console.log('[RewardsService] Tasks state changed, notifying UI.');
            this.sendMessageToUI(REWARDS_TASKS_UPDATED, { ...this.rewardsState });
        } else {
            console.log('[RewardsService] Tasks snapshot received, but data unchanged. Skipping notification.');
        }
    }

    private updateRewardsState(tasks: TaskStateData[]): void {
        this.rewardsState = {
            tasks: tasks,
            isLoading: false,
            error: null,
        };
    }

    private cleanupFirestoreListener(): void {
        if (this.firestoreUnsubscribe) {
            console.log('[RewardsService] Cleaning up Firestore listener...');
            this.firestoreUnsubscribe();
            this.firestoreUnsubscribe = null;
        }
    }

    private resetRewardsState(): void {
        console.log('[RewardsService] Resetting rewards state.');
        this.rewardsState = {
            tasks: [],
            isLoading: false,
            error: null,
        };
        this.sendMessageToUI(REWARDS_TASKS_UPDATED, { ...this.rewardsState });
    }

    // --- Public Methods ---
    public getRewardsState(): RewardsState {
        return { ...this.rewardsState };
    }

    // --- Cleanup ---
    destroy(): void {
        console.log('[RewardsService] Destroying...');
        this.cleanupFirestoreListener();
        this.cleanupCentralStateListener();
    }

    private cleanupCentralStateListener(): void {
        if (this.centralStateUnsubscribe) {
            console.log('[RewardsService] Cleaning up Central state listener...');
            this.centralStateUnsubscribe();
            this.centralStateUnsubscribe = null;
        }
    }
} 