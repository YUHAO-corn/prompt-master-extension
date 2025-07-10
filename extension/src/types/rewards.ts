// 任务类型枚举
export enum TaskType {
  COMPLETE_AUTH = 'complete_auth',
  FIRST_PROMPT = 'first_prompt',
  WEB_SAVE = 'web_save',
  WEB_OPTIMIZE = 'web_optimize',
  USE_SHORTCUT = 'use_shortcut',
  ACTIVE_USER = 'active_user',
  INVITE_FRIEND = 'inviteFriend'
}

// 任务状态
export interface TaskState {
  id: TaskType;
  title: string;
  description: string;
  rewardDays: number;
  completed: boolean;
  claimed: boolean;
  progress: number;
  maxProgress: number;
  completedAt?: number; // timestamp
  claimedAt?: number; // timestamp
}

// 奖励队列项
export interface RewardQueueItem {
  taskType: TaskType;
  completedAt: number;
  claimed: boolean;
  rewardDays: number;
  status: 'pending' | 'processed' | 'expired';
  metadata?: Record<string, any>;
}

// 奖励中心状态
export interface RewardsState {
  tasks: TaskState[];
  loading: boolean;
  error: string | null;
} 