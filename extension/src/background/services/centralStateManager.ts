import { Auth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, DocumentData, Firestore, onSnapshot, Timestamp, Unsubscribe } from 'firebase/firestore';
// Assuming firebase instances are exported from the services/auth directory
// Adjust the path if your firebase setup is elsewhere
// import { auth, db } from '../services/auth/firebase'; // No longer needed
import { getApps, initializeApp, getApp } from 'firebase/app';
import { indexedDBLocalPersistence, initializeAuth } from 'firebase/auth/web-extension'; // Use web-extension auth
import { getFirestore } from 'firebase/firestore';
// Corrected relative path from background/services to services/auth
// REMOVE: import { firebaseConfig } from '@/services/auth/firebaseConfig'; // Import config using alias
// Import types and constants from shared location using alias
import { AuthState, MembershipState, CENTRAL_AUTH_STATE_UPDATED, CENTRAL_MEMBERSHIP_STATE_UPDATED } from '@/types/centralState';
// Import mapFirebaseUser
import { mapFirebaseUser } from '@/services/auth/firebase';
// Import AppUser type alias directly
import { User as AppUser } from '@/services/auth/types';
// Import Analytics
import { trackUserLogin, setAnalyticsUserId } from '@/services/analytics';

// --- Message Types --- (Now imported)
// export const CENTRAL_AUTH_STATE_UPDATED = 'CENTRAL_AUTH_STATE_UPDATED';
// export const CENTRAL_MEMBERSHIP_STATE_UPDATED = 'CENTRAL_MEMBERSHIP_STATE_UPDATED';

// --- Basic Type Definitions --- (Now imported)
// interface AuthState { ... }
// interface MembershipState { ... }

// ADD: Helper function to get Firebase config from environment variables
const getFirebaseConfigFromEnv = () => {
  const configString = process.env.FIREBASE_CONFIG;
  if (!configString) {
    console.error('[CentralStateManager] Firebase config not found in environment variables!');
    throw new Error('Missing FIREBASE_CONFIG environment variable for CentralStateManager.');
  }
  try {
    return JSON.parse(configString);
  } catch (error) {
    console.error('[CentralStateManager] Failed to parse FIREBASE_CONFIG:', error);
    throw new Error('Invalid FIREBASE_CONFIG environment variable format for CentralStateManager.');
  }
};

// Type for the subscriber callback
type MembershipStateCallback = (state: MembershipState) => void;

// Import a simple deep comparison function (or use a library like lodash.isEqual if available)
// Assuming a simple helper function for now:
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

// --- CentralStateManager Class ---

export class CentralStateManager {
    private auth: Auth;
    private db: Firestore;

    private authState: AuthState = {
        userId: null,
        isAuthenticated: false,
        user: null,
    };

    private membershipState: MembershipState = {
        status: null,
        plan: null,
        expiresAt: null,
        startedAt: null,
        updatedAt: null,
        subscriptionId: null,
        subscriptionStatus: null,
        cancelAtPeriodEnd: null,
        customerId: null,
        lastVerifiedAt: null,
        rawDoc: null,
        isLoading: false,
        error: null,
    };

    private authUnsubscribe: Unsubscribe | null = null;
    private firestoreUnsubscribe: Unsubscribe | null = null;
    // NEW: Store membership state subscribers
    private membershipSubscribers: MembershipStateCallback[] = [];

    constructor() {
        console.log('[CentralStateManager] Instantiating...');
        // Initialize Firebase internally
        try {
            // MODIFIED: Use the helper function to get config
            const configToUse = getFirebaseConfigFromEnv();
            console.log('[CentralStateManager] Using Firebase config from ENV:', configToUse); // Optional: log the config being used
            const app = getApps().length === 0 ? initializeApp(configToUse) : getApp();
            // Use initializeAuth for web extension context with persistence
            this.auth = initializeAuth(app, {
                persistence: indexedDBLocalPersistence,
            });
            this.db = getFirestore(app);
            console.log('[CentralStateManager] Firebase initialized internally.');
        } catch (error) {
            console.error('[CentralStateManager] Internal Firebase initialization error:', error);
            // If initialization fails, the manager likely cannot function.
            // Throw or handle appropriately.
            // For now, set dummy instances to prevent further errors if possible,
            // but log the critical failure.
            this.auth = {} as Auth; // Dummy
            this.db = {} as Firestore; // Dummy
            throw new Error("CentralStateManager failed to initialize Firebase.");
        }
    }

    async initialize(): Promise<void> {
        console.log('[CentralStateManager] Initializing...');
        this.setupAuthListener();
        // Note: Firestore listener setup is triggered by auth state changes
        console.log('[CentralStateManager] Initialization complete.');
    }

    // --- Message Sending --- (New Method)
    private sendMessageToUI(type: string, payload: any): void {
        // console.log(`[CentralStateManager] Sending message to UI - Type: ${type}`, payload); // REMOVED: Redundant log, state change logged before this.
        chrome.runtime.sendMessage({ type, payload }).catch((error: unknown) => {
            // Handle potential errors, e.g., if no UI script is listening (popup closed)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Could not establish connection') || errorMessage.includes('Receiving end does not exist')) {
                 // console.debug(`[CentralStateManager] SendMessage error (UI likely closed): ${errorMessage}`);
            } else {
                // Log other errors more explicitly
                console.error(`[CentralStateManager] Error sending message type ${type}. Error: ${errorMessage}`, error);
            }
        });
    }

    // --- Auth State Handling ---
    private setupAuthListener(): void {
        if (this.authUnsubscribe) {
            console.warn('[CentralStateManager] Auth listener already exists. Skipping setup.');
            return;
        }
        // console.log('[CentralStateManager] Setting up Firebase Auth listener...'); // Simplified below
        console.log('[CentralStateManager] Attaching Firebase Auth listener.');
        this.authUnsubscribe = onAuthStateChanged(this.auth, (firebaseUser) => {
            this.handleAuthStateChange(firebaseUser);
        }, (error) => {
             console.error('[CentralStateManager] Auth listener error:', error);
             this.updateAuthState(null); // Reset auth state on listener error
        });
    }

    private handleAuthStateChange(firebaseUser: FirebaseUser | null): void {
        // console.log('[CentralStateManager] Auth state changed. Firebase User:', firebaseUser?.uid || 'null', 'isAnonymous:', firebaseUser?.isAnonymous);
        console.log(`[CENTRAL_STATE] 🔄 Auth state change detected: User ${firebaseUser ? firebaseUser.uid + (firebaseUser.isAnonymous ? ' (Anonymous)' : '') : 'null'}`);
        const previousUserId = this.authState.userId;
        // Map the FirebaseUser to AppUser *before* updating state
        const appUser: AppUser | null = firebaseUser ? mapFirebaseUser(firebaseUser) : null;
        
        // --- Auth Flow Debugging ---
        console.log('[AUTH_FLOW_DEBUG] CentralStateManager received user data (via onAuthStateChanged):', JSON.stringify(appUser, null, 2));
        
        this.updateAuthState(appUser); // Update internal state with AppUser

        // 🚀 Analytics埋点：追踪用户登录事件
        if (appUser && appUser.uid !== previousUserId) {
            // 新用户登录
            setAnalyticsUserId(appUser.uid);
            trackUserLogin(appUser.uid, 'email_password'); // 记录登录方法
            console.log('[Analytics] User login tracked:', appUser.uid);
        }

        // Send message *after* updating internal state
        // Payload now includes the mapped user object directly
        console.log('[CENTRAL_STATE] 📤 Broadcasting auth state update to UI...');
        this.sendMessageToUI(CENTRAL_AUTH_STATE_UPDATED, { ...this.authState });

        if (appUser && appUser.uid !== previousUserId) { // Use appUser here
            this.cleanupFirestoreListener();
            this.setupFirestoreListener(appUser.uid);
        }
        else if (!appUser && previousUserId) { // Use appUser here
            this.cleanupFirestoreListener();
            this.resetMembershipState(); // This will notify subscribers
        }
    }

    private updateAuthState(appUser: AppUser | null): void { // Accept AppUser
        this.authState = {
            userId: appUser?.uid || null,
            isAuthenticated: !!appUser, // Determine based on AppUser existence
            user: appUser, // Store the mapped AppUser
        };
        // REMOVE: console.log referencing isAnonymous
        // console.log(`[CentralStateManager] Updated internal AuthState: User=${appUser?.uid}, IsAuthenticated=${!!appUser}`); 
        // console.log('[CentralStateManager] Updated internal AuthState:', this.authState); // REMOVED: Redundant log
    }

    // --- Membership State Handling ---
    private setupFirestoreListener(userId: string): void {
        if (this.firestoreUnsubscribe) {
            console.warn(`[CentralStateManager] Firestore listener already active for user ${userId}. Skipping setup.`);
            return;
        }
        if (!userId) {
            console.warn('[CentralStateManager] Cannot setup Firestore listener without userId.');
            return;
        }

        const membershipDocRef = doc(this.db, 'users', userId, 'membership', 'status');
        // console.log(`[CentralStateManager] Setting up Firestore listener for user ${userId} at path: ${membershipDocRef.path}`); // Simplified below
        console.log(`[CentralStateManager] Attaching Firestore listener for user ${userId}.`);

        this.membershipState.isLoading = true;
        this.firestoreUnsubscribe = onSnapshot(membershipDocRef, (docSnapshot) => {
            console.log(`[CentralStateManager] Firestore membership snapshot received for user ${userId}. Exists:`, docSnapshot.exists());
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                this.handleMembershipStateChange(data); // Updates state and notifies
            } else {
                 console.warn(`[CentralStateManager] Membership document does not exist for user ${userId}. Resetting state.`);
                this.resetMembershipState(false); // Resets state and notifies
            }
        }, (error) => {
            console.error(`[CentralStateManager] Firestore listener error for user ${userId}:`, error);
            this.membershipState = {
                ...this.membershipState,
                isLoading: false,
                error: error,
            };
            // Notify subscribers about the error state change
            this.notifyMembershipSubscribers();
        });
    }

    private handleMembershipStateChange(data: DocumentData | null): void {
        const previousState = { ...this.membershipState }; // Capture state before update
        this.updateMembershipState(data); // Update internal state

        // --- Optimization: Compare states before notifying --- 
        // We compare excluding isLoading and error fields, as those might change
        // even if the core membership data hasn't.
        // Also exclude rawDoc for comparison if it's large or complex.
        const relevantPreviousState = { ...previousState, isLoading: undefined, error: undefined, rawDoc: undefined };
        const relevantCurrentState = { ...this.membershipState, isLoading: undefined, error: undefined, rawDoc: undefined };

        if (!simpleDeepEquals(relevantPreviousState, relevantCurrentState)) {
            console.log('[CentralStateManager] Membership state changed, notifying UI and subscribers.');
            this.sendMessageToUI(CENTRAL_MEMBERSHIP_STATE_UPDATED, { ...this.membershipState });
            this.notifyMembershipSubscribers();
        } else {
            console.log('[CentralStateManager] Membership state snapshot received, but data unchanged. Skipping notification.');
            // Optional: Still notify subscribers if only isLoading/error changed, if they need it.
            if (previousState.isLoading !== this.membershipState.isLoading || 
                previousState.error !== this.membershipState.error) {
                 console.log('[CentralStateManager] isLoading or error changed, notifying subscribers only.');
                 this.notifyMembershipSubscribers(); // Notify subscribers about loading/error changes
            }
        }
    }

    private updateMembershipState(data: DocumentData | null): void {
        const expiresAtMs = data?.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : (typeof data?.expiresAt === 'number' ? data.expiresAt : null);
        const startedAtMs = data?.startedAt instanceof Timestamp ? data.startedAt.toMillis() : (typeof data?.startedAt === 'number' ? data.startedAt : null);
        const updatedAtMs = data?.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (typeof data?.updatedAt === 'number' ? data.updatedAt : null);
        const lastVerifiedAtMs = data?.lastVerifiedAt instanceof Timestamp ? data.lastVerifiedAt.toMillis() : (typeof data?.lastVerifiedAt === 'number' ? data.lastVerifiedAt : null);

        this.membershipState = {
            status: data?.status ?? null,
            plan: data?.plan ?? null,
            expiresAt: expiresAtMs,
            startedAt: startedAtMs,
            updatedAt: updatedAtMs,
            subscriptionId: data?.subscriptionId ?? null,
            subscriptionStatus: data?.subscriptionStatus ?? null,
            cancelAtPeriodEnd: data?.cancelAtPeriodEnd ?? null,
            customerId: data?.customerId ?? null,
            lastVerifiedAt: lastVerifiedAtMs,
            rawDoc: data || null,
            isLoading: false,
            error: null,
        };
    }

    private cleanupFirestoreListener(): void {
        if (this.firestoreUnsubscribe) {
            console.log('[CentralStateManager] Cleaning up Firestore listener...');
            this.firestoreUnsubscribe();
            this.firestoreUnsubscribe = null;
        }
    }

    private resetMembershipState(isLoading: boolean = false): void {
        console.log('[CentralStateManager] Resetting membership state.');
        const previousState = { ...this.membershipState };
        this.membershipState = {
            status: null,
            plan: null,
            expiresAt: null,
            startedAt: null,
            updatedAt: null,
            subscriptionId: null,
            subscriptionStatus: null,
            cancelAtPeriodEnd: null,
            customerId: null,
            lastVerifiedAt: null,
            rawDoc: null,
            isLoading: isLoading,
            error: null,
        };
        this.sendMessageToUI(CENTRAL_MEMBERSHIP_STATE_UPDATED, { ...this.membershipState });
        // Notify internal subscribers AFTER resetting state
        this.notifyMembershipSubscribers();
    }

    // --- NEW: Public Methods for Subscribers and State Access ---

    /**
     * Gets the current authentication state.
     * Note: This returns the current in-memory state.
     */
    public getAuthState(): AuthState {
        // console.log('[CentralStateManager] Getting AuthState:', this.authState);
        return this.authState;
    }

    /**
     * Manually updates the authentication state.
     * This is used when authentication is handled by a backend proxy,
     * bypassing the client-side onAuthStateChanged event.
     * @param appUser The user object from the backend, or null for logout.
     */
    public manuallyUpdateAuthState(appUser: AppUser | null): void {
        console.log(`[CENTRAL_STATE] 🔧 Manual auth state update invoked. User: ${appUser ? appUser.uid : 'null'}`);
        const previousUserId = this.authState.userId;

        // --- Auth Flow Debugging ---
        console.log('[AUTH_FLOW_DEBUG] CentralStateManager received user data (via manual update):', JSON.stringify(appUser, null, 2));

        // The logic here mirrors handleAuthStateChange, starting from an AppUser object.
        this.updateAuthState(appUser);

        // Track analytics events
        if (appUser && appUser.uid !== previousUserId) {
            setAnalyticsUserId(appUser.uid);
            trackUserLogin(appUser.uid, 'backend_proxy'); // Track login source
            console.log('[Analytics] User login tracked via manual update:', appUser.uid);
        } else if (!appUser && previousUserId) {
            console.log(`[CENTRAL_STATE] 🚪 Manual logout for user: ${previousUserId}`);
        }

        // Broadcast the state change to all UI listeners (hooks).
        console.log('[CENTRAL_STATE] 📤 Broadcasting manual auth state update to UI...');
        this.sendMessageToUI(CENTRAL_AUTH_STATE_UPDATED, { ...this.authState });

        // Update Firestore listeners based on the new auth state.
        if (appUser && appUser.uid !== previousUserId) {
            // A new user has logged in.
            this.cleanupFirestoreListener();
            this.setupFirestoreListener(appUser.uid);
        } else if (!appUser && previousUserId) {
            // The user has logged out.
            this.cleanupFirestoreListener();
            this.resetMembershipState();
        }
    }

    /**
     * Gets the current membership state.
     * Note: This returns the current in-memory state, which might be loading or contain errors.
     */
    public getMembershipState(): MembershipState {
        // console.log('[CentralStateManager] Getting MembershipState:', this.membershipState);
        return { ...this.membershipState }; // Return a copy
    }

    /**
     * Allows other background services to subscribe to membership state changes.
     * @param callback The function to call when the state changes.
     * @returns A function to unsubscribe.
     */
    public subscribeToMembershipState(callback: MembershipStateCallback): () => void {
        console.log('[CentralStateManager] New membership subscriber added.');
        this.membershipSubscribers.push(callback);
        
        // Immediately call with current state
        // Use setTimeout to avoid potential issues if called during initialization
        setTimeout(() => callback({ ...this.membershipState }), 0);
        
        // Return an unsubscribe function
        return () => {
            console.log('[CentralStateManager] Removing membership subscriber.');
            this.membershipSubscribers = this.membershipSubscribers.filter(sub => sub !== callback);
        };
    }

    // NEW: Method to notify subscribers
    private notifyMembershipSubscribers(): void {
        console.log(`[CentralStateManager] Notifying ${this.membershipSubscribers.length} membership subscribers.`);
        const currentState = { ...this.membershipState }; // Get current state copy
        this.membershipSubscribers.forEach(callback => {
            try {
                callback(currentState);
            } catch (error) {
                console.error('[CentralStateManager] Error executing membership subscriber callback:', error);
            }
        });
    }

    // --- Cleanup ---
    destroy(): void {
         console.log('[CentralStateManager] Destroying...');
        this.cleanupAuthListener();
        this.cleanupFirestoreListener();
        this.cleanupMembershipSubscribers(); // Clean up subscribers on destroy
    }

    private cleanupAuthListener(): void {
        if (this.authUnsubscribe) {
             console.log('[CentralStateManager] Cleaning up Auth listener...');
            this.authUnsubscribe();
            this.authUnsubscribe = null;
        }
    }
    
    // NEW: Cleanup subscribers
    private cleanupMembershipSubscribers(): void {
        console.log('[CentralStateManager] Cleaning up membership subscribers.');
        this.membershipSubscribers = [];
    }
} 