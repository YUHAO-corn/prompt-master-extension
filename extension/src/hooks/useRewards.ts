import { useState, useEffect, useCallback } from 'react';
import { TaskType, TaskState, RewardsState } from '../types/rewards';
import { useAuth } from './useAuth';
import { safeLogger } from '../utils/safeEnvironment';
import { REWARDS_TASKS_UPDATED } from '@/types/centralState';
import { authService } from '../services/auth/actions';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp
} from 'firebase/firestore';

/**
 * 奖励系统Hook，管理任务状态和奖励领取
 */
export function useRewards(): RewardsState & {
  claimReward: (taskId: TaskType) => Promise<void>;
  refreshTasks: () => void;
  totalRewards: number;
  claimedRewards: number;
  availableRewards: number;
} {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  // 默认任务配置
  const getDefaultTasks = useCallback((): TaskState[] => [
    {
      id: TaskType.COMPLETE_AUTH,
      title: 'Complete Authentication',
      description: 'Sign in to your account to get started',
      rewardDays: 1,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 1
    },
    {
      id: TaskType.FIRST_PROMPT,
      title: 'Create Your First Prompt',
      description: 'Click the "+" button in the Library tab to create and save your first prompt',
      rewardDays: 2,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 1
    },
    {
      id: TaskType.WEB_SAVE,
      title: 'Save Prompt from a Page',
      description: 'Select text on any website and click the save button in the floating toolbar',
      rewardDays: 2,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 1
    },
    {
      id: TaskType.WEB_OPTIMIZE,
      title: 'Optimize Your Prompt',
      description: 'Select text on any website and click the optimize button in the floating toolbar and complete optimize',
      rewardDays: 2,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 1
    },
    {
      id: TaskType.USE_SHORTCUT,
      title: 'Use Shortcut Input',
      description: 'Type "/" in any text field to quickly insert your saved prompts',
      rewardDays: 2,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 1
    },
    {
      id: TaskType.ACTIVE_USER,
      title: 'Become an Active User',
      description: 'Create 5 prompts to become an active user',
      rewardDays: 2,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 5
    },
    {
      id: TaskType.INVITE_FRIEND,
      title: 'Invite Friends',
      description: 'Share AetherFlow with friends and earn 5 days per successful signup (max 5 times)',
      rewardDays: 5,
      completed: false,
      claimed: false,
      progress: 0,
      maxProgress: 5
    }
  ], []);

  // 写入任务完成状态到Firestore
  const writeTaskCompletion = useCallback(async (taskId: TaskType, progress: number = 1) => {
    if (!user) {
      console.log(`[REWARDS_FLOW] Step 7: No user for writeTaskCompletion`);
      return;
    }

    console.log(`[REWARDS_FLOW] Step 7: Writing task completion to Firestore`, {
      userId: user.uid,
      taskId,
      progress
    });

    try {
      const db = getFirestore();
      const taskRef = doc(db, 'users', user.uid, 'rewards_tasks', taskId);
      
      const taskData = {
        taskId,
        completed: progress >= (getDefaultTasks().find(t => t.id === taskId)?.maxProgress || 1),
        progress,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(taskRef, taskData, { merge: true });
      console.log(`[REWARDS_FLOW] Step 7: Task completion written successfully to Firestore`, {
        userId: user.uid,
        taskId,
        completed: taskData.completed,
        progress: taskData.progress
      });
      
      safeLogger.log('[useRewards] Task completion written to Firestore:', taskId, taskData);
    } catch (error) {
      console.error(`[REWARDS_FLOW] Step 7: Failed to write task completion to Firestore`, {
        userId: user.uid,
        taskId,
        error
      });
      safeLogger.error('[useRewards] Failed to write task completion:', error);
    }
  }, [user, getDefaultTasks]);

  // 检查并完成认证任务
  const checkAuthTask = useCallback(async () => {
    console.log(`[REWARDS_FLOW] Step 8: Checking auth task`, { isAuthenticated, hasUser: !!user, loading });
    
    if (isAuthenticated && user) {
      // 检查认证任务是否已完成
      const authTask = tasks.find(t => t.id === TaskType.COMPLETE_AUTH);
      console.log(`[REWARDS_FLOW] Step 8: Auth task found:`, { 
        found: !!authTask, 
        completed: authTask?.completed, 
        claimed: authTask?.claimed 
      });
      
      if (authTask && !authTask.completed) {
        console.log(`[REWARDS_FLOW] Step 8: Writing auth task completion for user: ${user.uid}`);
        await writeTaskCompletion(TaskType.COMPLETE_AUTH, 1);
      } else if (authTask?.completed) {
        console.log(`[REWARDS_FLOW] Step 8: Auth task already completed for user: ${user.uid}`);
      } else {
        console.log(`[REWARDS_FLOW] Step 8: Auth task not found in tasks array`);
      }
    } else {
      console.log(`[REWARDS_FLOW] Step 8: User not authenticated or missing`, { isAuthenticated, hasUser: !!user });
    }
  }, [isAuthenticated, user, tasks, writeTaskCompletion]);

  // 设置后台消息监听器（新的架构）
  const setupMessageListener = useCallback(() => {
    console.log(`[REWARDS_FLOW] Step 5: Setting up RewardsService message listener`);

    const handleMessage = (message: any) => {
      if (message.type === REWARDS_TASKS_UPDATED) {
        const rewardsState = message.payload;
        console.log(`[REWARDS_FLOW] Step 6: Received rewards tasks update:`, rewardsState);
        
        if (rewardsState.error) {
          console.error(`[REWARDS_FLOW] Step 6: Rewards service error:`, rewardsState.error);
          setError('Failed to sync task data');
          setLoading(false);
          return;
        }

        const defaultTasks = getDefaultTasks();
        const firestoreTasks = new Map();

        // 处理RewardsService中的任务数据
        rewardsState.tasks.forEach((taskData: any) => {
          console.log(`[REWARDS_FLOW] Step 6: Processing task data ${taskData.taskId}:`, taskData);
          firestoreTasks.set(taskData.taskId, {
            taskId: taskData.taskId,
            completed: taskData.completed || false,
            claimed: taskData.claimed || false,
            progress: taskData.progress || 0,
            completedAt: taskData.completedAt,
            claimedAt: taskData.claimedAt
          });
        });

        // 合并默认任务配置和Firestore数据（保持原有逻辑）
        const mergedTasks = defaultTasks.map(defaultTask => {
          const firestoreData = firestoreTasks.get(defaultTask.id);
          if (firestoreData) {
            return {
              ...defaultTask,
              completed: firestoreData.completed,
              claimed: firestoreData.claimed,
              progress: firestoreData.progress,
              completedAt: firestoreData.completedAt,
              claimedAt: firestoreData.claimedAt
            };
          }
          return defaultTask;
        });

        console.log(`[REWARDS_FLOW] Step 6: Merged tasks completed, setting ${mergedTasks.length} tasks`);
        setTasks(mergedTasks);
        setLoading(rewardsState.isLoading);
        setError(null);
        
        console.log(`[REWARDS_FLOW] Step 6: UI tasks updated - completed: ${mergedTasks.filter(t => t.completed).length}, claimed: ${mergedTasks.filter(t => t.claimed).length}`);
        
        safeLogger.log('[useRewards] Tasks updated from RewardsService:', mergedTasks);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    console.log(`[REWARDS_FLOW] Step 5: RewardsService message listener attached successfully`);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      console.log(`[REWARDS_FLOW] Step 5: RewardsService message listener removed`);
    };
  }, [getDefaultTasks]);

  // 计算奖励汇总
  const calculateRewards = useCallback(() => {
    let total = 0;
    let claimed = 0;
    let available = 0;

    tasks.forEach(task => {
      if (task.id === TaskType.INVITE_FRIEND) {
        // 邀请任务特殊处理：每完成一次可以获得奖励
        const timesCompleted = task.progress; // 邀请成功的次数
        const maxTimes = task.maxProgress; // 最大可领取次数
        
        // 总可能奖励 = 最大次数 * 每次奖励天数
        total += task.rewardDays * maxTimes;
        
        // 已领取奖励：这里需要更复杂的逻辑来跟踪实际领取次数
        // 暂时使用进度作为已领取次数的近似值
        const timesClaimed = task.claimed ? Math.min(timesCompleted, maxTimes) : Math.max(0, timesCompleted - 1);
        claimed += task.rewardDays * timesClaimed;
        
        // 可领取奖励：如果有未领取的完成次数
        if (task.completed && !task.claimed && timesCompleted > 0 && timesCompleted <= maxTimes) {
          available += task.rewardDays;
        }
      } else {
        // 其他任务的正常处理
        total += task.rewardDays;
        if (task.claimed) {
          claimed += task.rewardDays;
        } else if (task.completed) {
          available += task.rewardDays;
        }
      }
    });

    return { total, claimed, available };
  }, [tasks]);

  const { total: totalRewards, claimed: claimedRewards, available: availableRewards } = calculateRewards();

  // 调用任务奖励处理API
  const callTaskRewardAPI = useCallback(async (userId: string, queueItemId: string, rewardDays: number, taskType: string) => {
    try {
      // 获取Firebase ID Token
      const idToken = await authService.getIdToken(true); // 强制刷新Token
      
      if (!idToken) {
        throw new Error('Failed to get ID token');
      }

      // Cloud Run服务URL
      const cloudRunBaseUrl = 'https://process-task-rewards-423266303314.us-west2.run.app';

      console.log(`[Task Reward API] Calling ${cloudRunBaseUrl}/processTaskReward`);

      // 调用Cloud Run API
      const response = await fetch(`${cloudRunBaseUrl}/processTaskReward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: userId,
          queueItemId: queueItemId,
          rewardDays: rewardDays,
          taskType: taskType
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Task reward API call failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log(`[Task Reward API] Success:`, result);
      
      return result;
    } catch (error) {
      console.error(`[Task Reward API] Error:`, error);
      throw error;
    }
  }, []);

  // 领取奖励
  const claimReward = useCallback(async (taskId: TaskType) => {
    if (!user) {
      setError('Please sign in to claim rewards');
      return;
    }

    try {
      setError(null);
      
      // 找到对应任务
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (!task.completed) {
        throw new Error('Task not completed yet');
      }

      // 邀请任务的特殊处理
      if (taskId === TaskType.INVITE_FRIEND) {
        if (task.claimed) {
          throw new Error('Current invite reward already claimed');
        }
        
        if (task.progress >= task.maxProgress) {
          throw new Error('Maximum invite rewards already claimed');
        }

        // 为邀请任务生成唯一的队列ID
        const queueId = `${taskId}_${Date.now()}`;
        
        // 写入奖励队列
        const db = getFirestore();
        const rewardQueueRef = doc(db, 'users', user.uid, 'rewards_queue', queueId);
        
        await setDoc(rewardQueueRef, {
          taskType: taskId,
          completedAt: serverTimestamp(),
          claimed: false,
          rewardDays: task.rewardDays,
          status: 'pending',
          metadata: {
            source: 'rewards_center',
            inviteCount: task.progress
          }
        });

        // 更新任务状态：标记为已领取，但如果还没达到最大次数则保持completed状态
        const taskRef = doc(db, 'users', user.uid, 'rewards_tasks', taskId);
        await updateDoc(taskRef, {
          claimed: true,
          claimedAt: serverTimestamp(),
          // 如果还没达到最大次数，保持completed为true以便下次邀请后可再次领取
          completed: task.progress < task.maxProgress
        });

        // 🚀 新增：邀请任务也调用后端处理奖励
        try {
          await callTaskRewardAPI(user.uid, queueId, task.rewardDays, taskId);
          console.log(`[useRewards] Invite task reward processed successfully for ${taskId}`);
        } catch (apiError) {
          console.error(`[useRewards] Invite task reward API call failed for ${taskId}:`, apiError);
          // API调用失败时仍然显示成功，因为队列已写入
          safeLogger.error('[useRewards] Invite task reward API call failed, but queue written:', apiError);
        }
      } else {
        // 其他任务的逻辑
        if (task.claimed) {
          throw new Error('Reward already claimed');
        }

        // 写入奖励队列
        const db = getFirestore();
        const rewardQueueRef = doc(db, 'users', user.uid, 'rewards_queue', taskId);
        
        await setDoc(rewardQueueRef, {
          taskType: taskId,
          completedAt: serverTimestamp(),
          claimed: false,
          rewardDays: task.rewardDays,
          status: 'pending',
          metadata: {
            source: 'rewards_center'
          }
        });

        // 更新任务状态为已领取
        const taskRef = doc(db, 'users', user.uid, 'rewards_tasks', taskId);
        await updateDoc(taskRef, {
          claimed: true,
          claimedAt: serverTimestamp()
        });

        // 🚀 新增：立即调用后端处理奖励
        try {
          await callTaskRewardAPI(user.uid, taskId, task.rewardDays, taskId);
          console.log(`[useRewards] Task reward processed successfully for ${taskId}`);
        } catch (apiError) {
          console.error(`[useRewards] Task reward API call failed for ${taskId}:`, apiError);
          // API调用失败时仍然显示成功，因为队列已写入
          // 用户可以稍后重试或通过其他方式处理
          safeLogger.error('[useRewards] Task reward API call failed, but queue written:', apiError);
        }
      }

      safeLogger.log('[useRewards] Reward claimed and queued successfully:', taskId);
      
    } catch (err: any) {
      safeLogger.error('[useRewards] Failed to claim reward:', err);
      setError(err.message || 'Failed to claim reward');
      throw err;
    }
  }, [user, tasks, callTaskRewardAPI]);

  // 刷新任务状态
  const refreshTasks = useCallback(() => {
    safeLogger.log('[useRewards] Refreshing tasks...');
    // 在新架构中，刷新由RewardsService自动处理
    console.log('[useRewards] Task refresh requested - handled by RewardsService');
  }, []);

  // 监听用户状态变化
  useEffect(() => {
    if (!user) {
      setTasks(getDefaultTasks());
      setLoading(false);
      return;
    }

    // 设置消息监听器
    const unsubscribe = setupMessageListener();

    // 清理函数
    return unsubscribe;
  }, [user, setupMessageListener]);

  // 检查认证任务（延迟执行，确保任务数据已加载）
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      // 延迟检查，确保任务数据已加载
      const timer = setTimeout(() => {
        checkAuthTask();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, loading, checkAuthTask]);

  return {
    tasks,
    loading,
    error,
    claimReward,
    refreshTasks,
    totalRewards,
    claimedRewards,
    availableRewards
  };
} 