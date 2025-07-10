// 导出所有类型
export * from './types';

// 保留必要的 Firebase 辅助功能
export { 
  // initializeFirebase 不再导出，因为前端不再需要初始化 Firebase
  // getFirebaseAuth 仍然保留，因为前端可能仍需要用于非状态变更的操作如发送重置密码邮件
  getFirebaseAuth,
  mapFirebaseUser
} from './firebase';

// 导出认证服务和辅助函数
export { 
  authService,
} from './actions'; 