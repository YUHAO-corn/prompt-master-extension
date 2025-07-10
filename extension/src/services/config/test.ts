/**
 * 配置服务测试文件
 * 用于验证配置服务功能是否正常工作
 */

import { configService } from './index';

/**
 * 打印配置信息
 */
export function testConfigService() {
  console.log('========== Config Service Test ==========');
  console.log('Environment:', configService.getEnvironment());
  
  // Paddle配置
  console.log('Paddle Vendor ID:', configService.getPaddleVendorId());
  console.log('Paddle API Key:', maskSensitiveInfo(configService.getPaddleApiKey()));
  console.log('Monthly Product ID:', configService.getPaddleProductIdMonthly());
  console.log('Annual Product ID:', configService.getPaddleProductIdAnnual());
  console.log('Webhook URL:', configService.getWebhookUrl());
  
  // 会员限制
  console.log('Free Limits:', JSON.stringify(configService.getMembershipLimits(false), null, 2));
  console.log('Pro Limits:', JSON.stringify(configService.getMembershipLimits(true), null, 2));
  
  console.log('========================================');
  return true;
}

/**
 * 掩盖敏感信息，只显示前4位和后4位
 */
function maskSensitiveInfo(info: string): string {
  if (!info || info.length <= 8) {
    return '********';
  }
  
  const prefix = info.substring(0, 4);
  const suffix = info.substring(info.length - 4);
  return `${prefix}${'*'.repeat(info.length - 8)}${suffix}`;
}

// 如果直接运行此文件，则执行测试
if (typeof window !== 'undefined' && window.location.href.includes('test=config')) {
  testConfigService();
} 