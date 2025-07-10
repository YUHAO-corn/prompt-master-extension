/**
 * 配置服务
 * 用于管理应用的各种配置选项
 */

interface MembershipLimits {
  promptLimit: number;
  dailyOptimizationAttempts: number;
  allowDataExport: boolean;
  allowMultiDeviceSync: boolean;
  allowAdvancedFeatures: boolean;
}

class ConfigService {
  private environment: 'development' | 'production';
  
  // 后端API配置
  private backendApiUrl: string;
  
  // Paddle相关配置
  private paddleVendorId: string;
  private paddleApiKey: string;
  private paddleProductIdMonthly: string;
  private paddleProductIdAnnual: string;
  private webhookUrl: string;
  
  // 会员限制
  private freeLimits: MembershipLimits;
  private proLimits: MembershipLimits;
  
  constructor() {
    // 确定环境
    this.environment = this.determineEnvironment();
    
    // 从环境变量读取配置
    this.backendApiUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    this.paddleVendorId = process.env.PADDLE_VENDOR_ID || 'your-paddle-vendor-id';
    this.paddleApiKey = process.env.PADDLE_API_KEY || 'your-paddle-api-key';
    this.paddleProductIdMonthly = process.env.PADDLE_PRODUCT_ID_MONTHLY || 'your-monthly-product-id';
    this.paddleProductIdAnnual = process.env.PADDLE_PRODUCT_ID_ANNUAL || 'your-annual-product-id';
    this.webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook';
    
    // 设置会员限制
    this.freeLimits = {
      promptLimit: parseInt(process.env.FREE_PROMPT_LIMIT || '50'),
      dailyOptimizationAttempts: parseInt(process.env.FREE_OPTIMIZATION_LIMIT || '5'),
      allowDataExport: false,
      allowMultiDeviceSync: true,
      allowAdvancedFeatures: false
    };
    
    this.proLimits = {
      promptLimit: parseInt(process.env.PRO_PROMPT_LIMIT || '10000'),
      dailyOptimizationAttempts: parseInt(process.env.PRO_OPTIMIZATION_LIMIT || '100'),
      allowDataExport: true,
      allowMultiDeviceSync: true,
      allowAdvancedFeatures: true
    };
  }
  
  /**
   * 确定当前环境
   */
  private determineEnvironment(): 'development' | 'production' {
    // 优先检查环境变量
    if (process.env.NODE_ENV === 'production') {
      return 'production';
    }
    
    // 在Chrome扩展中，我们也可以通过URL来确定环境
    if (typeof window !== 'undefined') {
      // 检查本地存储中是否有环境标志
      try {
        const storedEnv = localStorage.getItem('prompt_master_environment');
        if (storedEnv === 'production') {
          return 'production';
        }
      } catch (e) {
        // 忽略存储访问错误
      }
    }
    
    // 默认为开发环境
    return 'development';
  }
  
  /**
   * 获取当前环境
   */
  public getEnvironment(): 'development' | 'production' {
    return this.environment;
  }
  
  /**
   * 获取后端API URL
   */
  public getBackendApiUrl(): string {
    return this.backendApiUrl;
  }
  
  /**
   * 获取Paddle商家ID
   */
  public getPaddleVendorId(): string {
    return this.paddleVendorId;
  }
  
  /**
   * 获取Paddle API密钥
   */
  public getPaddleApiKey(): string {
    return this.paddleApiKey;
  }
  
  /**
   * 获取月付产品ID
   */
  public getPaddleProductIdMonthly(): string {
    return this.paddleProductIdMonthly;
  }
  
  /**
   * 获取年付产品ID
   */
  public getPaddleProductIdAnnual(): string {
    return this.paddleProductIdAnnual;
  }
  
  /**
   * 获取Webhook URL
   */
  public getWebhookUrl(): string {
    return this.webhookUrl;
  }
  
  /**
   * 获取会员限制
   */
  public getMembershipLimits(isPro: boolean): MembershipLimits {
    return isPro ? this.proLimits : this.freeLimits;
  }
  
  /**
   * 检查是否为生产环境
   */
  public isProduction(): boolean {
    return this.environment === 'production';
  }
  
  /**
   * 获取配置摘要（用于调试，不包含敏感信息）
   */
  public getConfigSummary() {
    return {
      environment: this.environment,
      backendApiUrl: this.backendApiUrl,
      paddleVendorId: this.paddleVendorId ? '***' + this.paddleVendorId.slice(-4) : 'not set',
      hasApiKey: !!this.paddleApiKey,
      freeLimits: this.freeLimits,
      proLimits: this.proLimits
    };
  }
}

// 创建单例实例
export const configService = new ConfigService(); 