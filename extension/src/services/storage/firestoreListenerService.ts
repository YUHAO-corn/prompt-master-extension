import { 
    getFirestore, 
    collection, 
    doc, 
    onSnapshot, 
    QuerySnapshot, 
    DocumentData, 
    Unsubscribe, 
    FirestoreError 
} from 'firebase/firestore';
import { Prompt } from '../prompt/types'; // Adjusted path
import { chromeStorageService } from './chromeStorage';
import { safeLogger } from '../../utils/safeEnvironment';
import { STORAGE_KEYS } from './constants';

/**
 * Listens to Firestore prompt changes for a user and updates local Chrome storage.
 */
export class FirestoreListenerService {
    private userId: string | null = null;
    private unsubscribeFirestore: Unsubscribe | null = null;
    private isInitialized: boolean = false;

    constructor() {
        safeLogger.log('[FirestoreListenerService] Constructor called.');
    }

    /**
     * Initializes the service and starts listening to Firestore changes for the given user.
     * @param userId The ID of the current user.
     */
    public initialize(userId: string | null): void {
        if (this.isInitialized && this.userId === userId) {
            safeLogger.log('[FirestoreListenerService] Already initialized for this user.');
            return;
        }

        this.cleanup(); // Clean up any previous listener

        if (!userId) {
            safeLogger.log('[FirestoreListenerService] Cannot initialize without userId.');
            this.isInitialized = false;
            return;
        }

        this.userId = userId;
        safeLogger.log(`[FirestoreListenerService] Initializing listener for user: ${userId}`);
        this.setupFirestoreListenerInternal();
        this.isInitialized = true;
    }

    /**
     * Sets up the Firestore listener.
     */
    private setupFirestoreListenerInternal(): void {
        if (!this.userId) {
            safeLogger.error('[FirestoreListenerService] Cannot setup listener without userId.');
            return;
        }
        if (this.unsubscribeFirestore) {
            safeLogger.warn('[FirestoreListenerService] Listener already exists. Cleaning up before creating new one.');
            this.cleanup();
        }

        try {
            const db = getFirestore();
            const promptsRef = collection(db, 'users', this.userId, 'prompts');
            safeLogger.log(`[FirestoreListenerService] Setting up onSnapshot listener for user ${this.userId}.`);

            this.unsubscribeFirestore = onSnapshot(promptsRef,
                (snapshot: QuerySnapshot<DocumentData>) => {
                    safeLogger.log(`[FirestoreListenerService] Received snapshot with ${snapshot.docChanges().length} changes.`);
                    snapshot.docChanges().forEach(async (change) => {
                        const promptData = change.doc.data() as Omit<Prompt, 'id'>;
                        const prompt: Prompt = { id: change.doc.id, ...promptData }; // Ensure ID is included
                        
                        safeLogger.log(`[FirestoreListenerService] Change type: ${change.type}, Doc ID: ${prompt.id}`);

                        if (change.type === 'added' || change.type === 'modified') {
                            // Directly handle the update/add without checking pending ops
                            await this.handleCloudPromptUpdateInternal(prompt);
                        } else if (change.type === 'removed') {
                            // Directly handle removal without checking pending ops
                            await this.handleCloudPromptRemovalInternal(prompt.id);
                        }
                    });
                },
                (error: FirestoreError) => {
                    safeLogger.error('[FirestoreListenerService] Firestore listener error:', error);
                    // Consider adding some retry logic or status update here if needed
                }
            );
        } catch (error) {
            safeLogger.error('[FirestoreListenerService] Failed to set up Firestore listener:', error);
        }
    }

    /**
     * Cleans up the Firestore listener.
     */
    private cleanupFirestoreListenerInternal(): void {
        if (this.unsubscribeFirestore) {
            try {
                this.unsubscribeFirestore();
                safeLogger.log('[FirestoreListenerService] Firestore listener unsubscribed.');
            } catch (error) {
                 safeLogger.error('[FirestoreListenerService] Error unsubscribing Firestore listener:', error);
            }
            this.unsubscribeFirestore = null;
        }
    }

    /**
     * Handles updates or additions from the cloud.
     * Simplified: Always updates local storage based on cloud data.
     */
    private async handleCloudPromptUpdateInternal(cloudPrompt: Prompt): Promise<void> {
        try {
            // Check if the cloud version is marked as inactive (soft deleted)
            if (cloudPrompt.isActive === false || cloudPrompt.active === false) {
                safeLogger.log(`[FirestoreListenerService] Cloud prompt ${cloudPrompt.id} is inactive. Handling as removal.`);
                await this.handleCloudPromptRemovalInternal(cloudPrompt.id);
                return;
            }

            // Directly get the local prompt to compare timestamps (optional but good for complex resolution)
            const localPrompt = await chromeStorageService.getPrompt(cloudPrompt.id);

            if (!localPrompt) {
                // Local doesn't exist, save the cloud version
                safeLogger.log(`[FirestoreListenerService] Local prompt ${cloudPrompt.id} not found. Saving cloud version.`);
                await chromeStorageService.savePrompt(cloudPrompt);
            } else {
                // Both exist, resolve conflict (simple timestamp check)
                const resolvedPrompt = this.resolveSimpleConflictInternal(localPrompt, cloudPrompt);
                // Ensure we save the resolved version, ONLY if it's different from local to avoid unnecessary writes?
                // For simplicity now, we always write the resolved version if cloud was involved.
                safeLogger.log(`[FirestoreListenerService] Conflict resolution for ${cloudPrompt.id}. Resolved to ${resolvedPrompt.updatedAt === cloudPrompt.updatedAt ? 'cloud' : 'local'} version. Saving locally.`);
                await chromeStorageService.savePrompt(resolvedPrompt); 
            }
        } catch (error) {
            safeLogger.error(`[FirestoreListenerService] Error handling cloud prompt update for ${cloudPrompt?.id}:`, error);
        }
    }

    /**
     * Handles removals from the cloud.
     * Simplified: Always performs a soft delete locally.
     */
    private async handleCloudPromptRemovalInternal(promptId: string): Promise<void> {
        try {
            safeLogger.log(`[FirestoreListenerService] Handling cloud removal for prompt: ${promptId}. Performing local soft delete.`);
            await chromeStorageService.deletePrompt(promptId); // Assumes deletePrompt performs a soft delete
        } catch (error) {
            safeLogger.error(`[FirestoreListenerService] Error handling cloud prompt removal for ${promptId}:`, error);
        }
    }

    /**
     * Simple conflict resolution based on timestamp.
     */
    private resolveSimpleConflictInternal(localPrompt: Prompt, cloudPrompt: Prompt): Prompt {
        // Prioritize the prompt with the later update timestamp
        if ((localPrompt.updatedAt || 0) >= (cloudPrompt.updatedAt || 0)) {
            // safeLogger.log(`[FirestoreListenerService] Conflict resolved favoring local for ${localPrompt.id}`);
            return localPrompt;
        } else {
            // safeLogger.log(`[FirestoreListenerService] Conflict resolved favoring cloud for ${cloudPrompt.id}`);
            return cloudPrompt;
        }
    }

    /**
     * Cleans up resources, like unsubscribing from the listener.
     * Should be called when the user logs out or the service is destroyed.
     */
    public cleanup(): void {
        safeLogger.log('[FirestoreListenerService] Cleaning up...');
        this.cleanupFirestoreListenerInternal();
        this.userId = null;
        this.isInitialized = false;
    }
}

// Create a singleton instance
export const firestoreListenerService = new FirestoreListenerService(); 