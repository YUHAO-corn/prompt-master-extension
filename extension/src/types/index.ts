export interface Prompt {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  useCount: number;
}

export interface CloudStorageService {
  uploadPrompt: (prompt: Prompt) => Promise<void>;
  getPrompt: (id: string) => Promise<Prompt>;
  deletePrompt: (id: string) => Promise<void>;
  subscribeToPrompts: (callback: (prompts: Prompt[]) => void) => () => void;
  resolveConflict: (localPrompt: Prompt, cloudPrompt: Prompt) => Promise<Prompt>;
  syncAllPrompts: () => Promise<SyncStats>;
  isOnline: () => boolean;
  pendingOperations: PendingOperation[];
  processPendingOperations: () => Promise<void>;
}

export interface SyncStats {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  resolved: number;
}

export interface PendingOperation {
  type: 'upload' | 'delete';
  data: any;
}

export interface SubscriptionData {
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  plan: 'free' | 'premium';
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

export interface QuotaInfo {
  isLimitReached: boolean;
  currentCount: number;
  limit: number;
  isPremium: boolean;
  resetsAt?: number;
}

export interface PaymentService {
  checkPromptsQuota: () => Promise<QuotaInfo>;
  checkOptimizeQuota: () => Promise<QuotaInfo>;
  getUserSubscription: () => Promise<SubscriptionData>;
  createCheckoutSession: (planId: string, interval: 'monthly' | 'yearly') => Promise<{
    sessionId: string;
    url: string;
  }>;
  cancelSubscription: () => Promise<{ success: boolean }>;
  resumeSubscription: () => Promise<{ success: boolean }>;
} 