import { getFirestore, doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { getCentralStateManager } from '@/background/index'; // Adjusted path assuming this file is in services/storage
import { MembershipState } from '@/types/centralState';
import { Prompt } from '../prompt/types'; // Adjusted path
import { chromeStorageService } from './chromeStorage';
import { safeLogger } from '../../utils/safeEnvironment';

const FREE_TIER_PROMPT_LIMIT = 5;

/**
 * Handles locking/unlocking prompts based on user membership state.
 */
export class PromptLockingService {
    private userId: string | null = null;
    private unsubscribeCentralMembership: (() => void) | null = null;
    private currentMembershipState: MembershipState | null = null;
    private isInitialized: boolean = false;

    constructor() {
        safeLogger.log('[PromptLockingService] Constructor called.');
        // Initialization logic (like subscribing) moved to an explicit initialize method
    }

    /**
     * Initializes the service and starts listening to membership changes for the given user.
     * Should be called after user logs in.
     * @param userId The ID of the current user.
     */
    public initialize(userId: string | null): void {
        if (this.isInitialized && this.userId === userId) {
            safeLogger.log('[PromptLockingService] Already initialized for this user.');
            return;
        }

        this.cleanup(); // Clean up any previous subscriptions

        if (!userId) {
            safeLogger.log('[PromptLockingService] Cannot initialize without userId.');
            this.isInitialized = false;
            return;
        }

        this.userId = userId;
        safeLogger.log(`[PromptLockingService] Initializing for user: ${userId}`);
        this.subscribeToCentralStateManager();
        this.isInitialized = true;
    }

    private subscribeToCentralStateManager(): void {
        this.cleanupCentralSubscription(); // Ensure no duplicate subscriptions
        if (!this.userId) {
            safeLogger.error('[PromptLockingService] Cannot subscribe to CentralStateManager without userId.');
            return;
        }
        try {
            const centralStateManager = getCentralStateManager();
            safeLogger.log('[PromptLockingService] Attaching CentralStateManager membership listener.');
            this.unsubscribeCentralMembership = centralStateManager.subscribeToMembershipState(
                (newState: MembershipState) => {
                    const previousState = this.currentMembershipState;
                    this.currentMembershipState = newState;
                    // Pass userId explicitly to handleMembershipChange
                    this.handleMembershipChange(this.userId!, newState, previousState);
                }
            );
            // Fetch initial state immediately after subscribing
            const initialState = centralStateManager.getMembershipState();
            if (initialState) {
                this.currentMembershipState = initialState;
                this.handleMembershipChange(this.userId, initialState, null); // Pass null as previousState for initial check
            } else {
                safeLogger.warn('[PromptLockingService] Could not get initial membership state from CentralStateManager.');
            }

        } catch (error) {
            safeLogger.error('[PromptLockingService] Error subscribing to CentralStateManager:', error);
        }
    }

    private cleanupCentralSubscription(): void {
        if (this.unsubscribeCentralMembership) {
            try {
                this.unsubscribeCentralMembership();
                safeLogger.log('[PromptLockingService] Cleaned up CentralStateManager subscription.');
            } catch (error) {
                safeLogger.error('[PromptLockingService] Error during cleanup of CentralStateManager subscription:', error);
            }
            this.unsubscribeCentralMembership = null;
            this.currentMembershipState = null; // Reset state on cleanup
        }
    }

    /**
     * Fetches all prompts directly from Chrome Storage.
     * Note: This reads potentially stale data if cloud sync hasn't completed.
     * Consider if relying solely on local data is appropriate for locking logic.
     * Alternatively, this service could accept `getAllPrompts` as a dependency.
     */
    private async getAllLocalPrompts(): Promise<Prompt[]> {
        try {
            // Using chromeStorageService directly as cloudStorageService might not be fully initialized
            return await chromeStorageService.getAllPrompts();
        } catch (error) {
            safeLogger.error('[PromptLockingService] Error fetching local prompts:', error);
            return [];
        }
    }


    // Copied and adapted from CloudStorageService
    private async handleMembershipChange(userId: string, newState: MembershipState, previousState: MembershipState | null): Promise<void> {
        // Get statuses safely, defaulting null previous state's status to null
        const oldStatus = previousState?.status ?? null;
        const newStatus = newState.status;

        // Log statuses immediately after extraction
        safeLogger.log(`[PromptLockingService] User: ${userId}. Comparing statuses: old='${oldStatus}', new='${newStatus}'`);

        // Use getAllLocalPrompts to get data for locking calculation
        const allPrompts = await this.getAllLocalPrompts();
        if (!allPrompts) {
             safeLogger.error('[PromptLockingService] getAllLocalPrompts returned null or undefined during handleMembershipChange.');
             return; // Exit if we can't get prompts
        }

        // Case 1: Downgrade (Pro -> Free)
        if (oldStatus === 'pro' && newStatus === 'free') {
            safeLogger.log('[PromptLockingService] --- Downgrade Logic Start (Pro -> Free) ---');
            safeLogger.log('[PromptLockingService] Downgrade user confirmed:', userId);
            try {
                if (allPrompts.length > FREE_TIER_PROMPT_LIMIT) {
                    const sortedPrompts = [...allPrompts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    const idsToLock = sortedPrompts.slice(FREE_TIER_PROMPT_LIMIT).map(p => p.id);

                    // Find prompts that are *not* already locked among those needing lock
                   const promptsToActuallyLock = [];
                   for (const id of idsToLock) {
                       const prompt = allPrompts.find(p => p.id === id);
                       if (prompt && prompt.locked !== true) { // Check if NOT already locked
                           promptsToActuallyLock.push(id);
                       }
                   }

                   if (promptsToActuallyLock.length > 0) {
                       safeLogger.log(`[PromptLockingService] Downgrade: Preparing batch update (locked=true) for ${promptsToActuallyLock.length} prompts...`);
                       await this.batchUpdatePromptLockedStatus(userId, promptsToActuallyLock, true);
                       safeLogger.log(`[PromptLockingService] Downgrade: Batch update call finished.`);
                   } else {
                       safeLogger.log('[PromptLockingService] Downgrade: No prompts needed locking or already locked.');
                   }
                } else {
                   safeLogger.log('[PromptLockingService] Downgrade: Prompt count within free limit. No locking needed.');
                }
            } catch (error) {
                safeLogger.error('[PromptLockingService] Error during downgrade logic:', error);
            }
            safeLogger.log('[PromptLockingService] --- Downgrade Logic End (Pro -> Free) ---');

        // Case 2: Upgrade (Free -> Pro)
        } else if (oldStatus === 'free' && newStatus === 'pro') {
            safeLogger.log('[PromptLockingService] --- Upgrade Logic Start (Free -> Pro) ---');
            safeLogger.log('[PromptLockingService] Upgrade user confirmed:', userId);
            try {
                // Unlock ALL prompts that are currently locked
                const idsToUnlock = allPrompts.filter(p => p.locked === true).map(p => p.id);

                if (idsToUnlock.length > 0) {
                    safeLogger.log(`[PromptLockingService] Upgrade: Preparing batch update (locked=false) for ${idsToUnlock.length} prompts...`);
                    await this.batchUpdatePromptLockedStatus(userId, idsToUnlock, false);
                    safeLogger.log(`[PromptLockingService] Upgrade: Batch update call finished.`);
                } else {
                    safeLogger.log('[PromptLockingService] Upgrade: No prompts found with locked=true, no unlocking needed.');
                }
            } catch (error) {
                safeLogger.error('[PromptLockingService] Error during upgrade logic:', error);
            }
            safeLogger.log('[PromptLockingService] --- Upgrade Logic End (Free -> Pro) ---');

        // Case 3: Initial Login as Free or State Refresh as Free (No change from Pro)
        } else if (newStatus === 'free' && oldStatus !== 'pro') {
            safeLogger.log('[PromptLockingService] --- Initial/Current Free State Check Logic Start ---');
            safeLogger.log('[PromptLockingService] Initial Free Check user confirmed:', userId);
            try {
                 if (allPrompts.length > FREE_TIER_PROMPT_LIMIT) {
                    const sortedPrompts = [...allPrompts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    const idsToLock = sortedPrompts.slice(FREE_TIER_PROMPT_LIMIT).map(p => p.id);

                    // Find prompts that are *not* already locked among those needing lock
                    const promptsToActuallyLock = [];
                    for (const id of idsToLock) {
                        const prompt = allPrompts.find(p => p.id === id);
                        if (prompt && prompt.locked !== true) { // Check if NOT already locked
                            promptsToActuallyLock.push(id);
                        }
                    }

                    if (promptsToActuallyLock.length > 0) {
                        safeLogger.log(`[PromptLockingService] Initial Free Check: Preparing batch update (locked=true) for ${promptsToActuallyLock.length} prompts that are not already locked...`);
                        await this.batchUpdatePromptLockedStatus(userId, promptsToActuallyLock, true);
                        safeLogger.log(`[PromptLockingService] Initial Free Check: Batch update call finished.`);
                    } else {
                        safeLogger.log('[PromptLockingService] Initial Free Check: All prompts beyond limit are either already locked or calculation yielded no IDs.');
                    }
                } else {
                   safeLogger.log('[PromptLockingService] Initial Free Check: Prompt count within free limit. No locking needed.');
                }
            } catch (error) {
                safeLogger.error('[PromptLockingService] Error during initial free state check logic:', error);
            }
            safeLogger.log('[PromptLockingService] --- Initial/Current Free State Check Logic End ---');

        // Case 4: Initial Login as Pro or State Refresh as Pro (No change from Free)
        } else if (newStatus === 'pro' && oldStatus !== 'free') {
             safeLogger.log('[PromptLockingService] --- Initial/Current Pro State Check Logic Start ---');
            safeLogger.log('[PromptLockingService] Initial Pro Check user confirmed:', userId);
             try {
                // Ensure ALL prompts that might be locked are unlocked
                const idsToUnlock = allPrompts.filter(p => p.locked === true).map(p => p.id);

                if (idsToUnlock.length > 0) {
                    safeLogger.log(`[PromptLockingService] Initial Pro Check: Preparing batch update (locked=false) for ${idsToUnlock.length} prompts...`);
                    await this.batchUpdatePromptLockedStatus(userId, idsToUnlock, false);
                    safeLogger.log(`[PromptLockingService] Initial Pro Check: Batch update call finished.`);
                } else {
                    safeLogger.log('[PromptLockingService] Initial Pro Check: No prompts found with locked=true, no unlocking needed.');
                }
            } catch (error) {
                safeLogger.error('[PromptLockingService] Error during initial pro state check logic:', error);
            }
             safeLogger.log('[PromptLockingService] --- Initial/Current Pro State Check Logic End ---');
        // Case 5: No relevant status change for lock/unlock
        } else {
            safeLogger.log(`[PromptLockingService] No relevant status change (Old: ${oldStatus}, New: ${newStatus}) detected for lock/unlock logic. Skipping.`);
        }
    }

    // Copied and adapted from CloudStorageService
    private async batchUpdatePromptLockedStatus(userId: string, promptIds: string[], locked: boolean): Promise<void> {
        if (!userId || promptIds.length === 0) {
            safeLogger.warn('[PromptLockingService] batchUpdatePromptLockedStatus: Invalid input, skipping.');
            return;
        }
        // This operation MUST happen on Firestore, as 'locked' status is the source of truth read by usePromptsData
        const db = getFirestore();
        const batch = writeBatch(db);
        const now = Date.now(); // Use a consistent timestamp for the batch

        safeLogger.log(`[PromptLockingService] Preparing Firestore batch update for ${promptIds.length} prompts, setting locked=${locked}. User: ${userId}`);

        promptIds.forEach(promptId => {
            const promptRef = doc(db, 'users', userId, 'prompts', promptId);
            // IMPORTANT: Only update 'locked' and 'updatedAt' in Firestore.
            // Do NOT update other fields here, as this service's scope is only locking.
            batch.update(promptRef, { locked: locked, updatedAt: now });
        });

        try {
            safeLogger.log(`[PromptLockingService] Committing Firestore batch update for locked=${locked}...`);
            await batch.commit();
            safeLogger.log(`[PromptLockingService] Firestore batch update for locked=${locked} committed successfully.`);
            // Optional: Consider sending a message to trigger UI refresh if needed,
            // though Firestore listeners in usePromptsData should ideally handle this.
        } catch (error) {
            safeLogger.error(`[PromptLockingService] Firestore batch update for locked=${locked} failed:`, error);
            // Consider retry logic or error reporting if critical
            throw error; // Re-throw for the caller (handleMembershipChange) to log
        }
    }

    /**
     * Cleans up resources, like unsubscribing from listeners.
     * Should be called when the user logs out or the service is destroyed.
     */
    public cleanup(): void {
        safeLogger.log('[PromptLockingService] Cleaning up...');
        this.cleanupCentralSubscription();
        this.userId = null;
        this.isInitialized = false;
        this.currentMembershipState = null;
    }
}

// Create a singleton instance
export const promptLockingService = new PromptLockingService(); 