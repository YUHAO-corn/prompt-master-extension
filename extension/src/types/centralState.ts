import { DocumentData } from 'firebase/firestore';
import { User as AppUser } from '@/services/auth/types';

// --- Message Type Constants ---
export const CENTRAL_AUTH_STATE_UPDATED = 'CENTRAL_AUTH_STATE_UPDATED';
export const CENTRAL_MEMBERSHIP_STATE_UPDATED = 'CENTRAL_MEMBERSHIP_STATE_UPDATED';
export const QUOTA_STATE_UPDATED = 'QUOTA_STATE_UPDATED';
export const REWARDS_TASKS_UPDATED = 'REWARDS_TASKS_UPDATED';
export const CHECK_QUOTA = 'CHECK_QUOTA';
export const INCREMENT_USAGE = 'INCREMENT_USAGE';
export const SAVE_PROMPT_CAPTURE = 'SAVE_PROMPT_CAPTURE';

// --- State Interfaces ---

export interface AuthState {
    userId: string | null;
    isAuthenticated: boolean;
    user: AppUser | null;
}

export interface MembershipState {
    status: string | null;           // "pro", "free", "cancelled", etc. (App internal status)
    plan: string | null;             // "pro", "free", or specific Paddle Plan ID
    expiresAt: number | null;        // Subscription expiration timestamp (ms)
    startedAt: number | null;        // Subscription start timestamp (ms)
    updatedAt: number | null;        // Document last update timestamp (ms)
    subscriptionId: string | null;   // Paddle Subscription ID
    subscriptionStatus: string | null; // Paddle status ("active", "past_due", etc.)
    cancelAtPeriodEnd: boolean | null; // From Paddle
    customerId: string | null;       // Paddle Customer ID
    lastVerifiedAt: number | null;   // Last check with Paddle timestamp (ms)

    rawDoc: DocumentData | null;     // Store the raw document data for potential future use
    isLoading: boolean;
    error: Error | null;
}

// New interface for Quota Usage data
export interface QuotaUsage {
    dailyOptimizationCount: number;
    lastOptimizationReset: number | null; // Store as timestamp (ms)
    storedPromptsCount?: number; // 已存储提示词数量 (设为可选，因为初始加载或读取失败时可能不存在)
} 