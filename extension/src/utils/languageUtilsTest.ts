/**
 * 语言工具函数测试脚本
 * 用于测试语言检测和翻译功能是否正常工作
 */
import { detectMainLanguage, translateText } from './languageUtils';

/**
 * 测试语言检测功能
 */
async function testLanguageDetection() {
  const testCases = [
    { text: '这是一段中文文本，用于测试语言检测功能。', expected: 'zh', name: '纯中文' },
    { text: 'This is an English text for testing language detection.', expected: 'en', name: '纯英文' },
    { text: '这是一段混合了English的中文文本。', expected: 'zh', name: '中文为主的混合文本' },
    { text: 'This text contains some 中文 words.', expected: 'en', name: '英文为主的混合文本' },
    { text: '123456789', expected: 'other', name: '纯数字' },
    // 新增其他语言测试
    { text: 'こんにちは、これは日本語のテストです。', expected: 'ja', name: '日语测试' },
    { text: '안녕하세요, 이것은 한국어 테스트입니다.', expected: 'ko', name: '韩语测试' },
    { text: 'Привет, это тест на русском языке.', expected: 'ru', name: '俄语测试' },
    { text: 'Bonjour, ceci est un test en français.', expected: 'fr', name: '法语测试' },
    { text: 'Hallo, dies ist ein Test auf Deutsch.', expected: 'de', name: '德语测试' },
    { text: '¡Hola! Esta es una prueba en español.', expected: 'es', name: '西班牙语测试' },
    // 混合语言测试
    { text: 'This is mixed: 这是中文 and こんにちは with Привет', expected: 'en', name: '多语言混合测试' }
  ];

  console.log('===== 语言检测测试 =====');
  
  for (const testCase of testCases) {
    const detected = detectMainLanguage(testCase.text);
    const result = detected === testCase.expected ? '✅ 通过' : '❌ 失败';
    console.log(`${testCase.name}: ${result}`);
    console.log(`  输入: "${testCase.text.substring(0, 30)}${testCase.text.length > 30 ? '...' : ''}"`);
    console.log(`  检测结果: ${detected}`);
    console.log(`  期望结果: ${testCase.expected}`);
    console.log('-------------------');
  }
}

/**
 * 测试翻译功能
 */
async function testTranslation() {
  const testCases = [
    { 
      text: 'Hello, this is a test for the translation functionality.', 
      targetLang: 'zh' as const,
      name: '英文翻译为中文'
    },
    { 
      text: '你好，这是一个用于测试翻译功能的文本。', 
      targetLang: 'en' as const,
      name: '中文翻译为英文'
    },
    // 简单短语翻译测试 - 更容易通过字典翻译机制
    { 
      text: 'Hello world', 
      targetLang: 'zh' as const,
      name: '简单英文短语翻译为中文'
    },
    { 
      text: '你好世界', 
      targetLang: 'en' as const,
      name: '简单中文短语翻译为英文'
    }
  ];

  console.log('\n===== 翻译功能测试 =====');
  
  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`  原文: "${testCase.text}"`);
    
    try {
      console.log('  开始翻译...');
      const translated = await translateText(testCase.text, testCase.targetLang);
      console.log(`  翻译结果: "${translated}"`);
      
      // 简单验证翻译结果语言
      const resultLang = detectMainLanguage(translated);
      const langMatch = resultLang === testCase.targetLang;
      console.log(`  结果语言检测: ${resultLang} (${langMatch ? '✅ 匹配目标语言' : '❌ 与目标语言不匹配'})`);
      console.log('-------------------');
    } catch (error: any) {
      console.error(`  翻译出错: ${error.message}`);
      console.log('-------------------');
    }
  }
}

/**
 * 测试语言一致性处理
 */
async function testLanguageConsistency() {
  const testCases = [
    {
      original: '这是原始的中文输入',
      result: 'This is the optimized English result',
      name: '中文输入 -> 英文结果 -> 需翻译回中文'
    },
    {
      original: 'This is the original English input',
      result: '这是优化后的中文结果',
      name: '英文输入 -> 中文结果 -> 需翻译回英文'
    },
    // 添加更多语言的一致性测试
    {
      original: 'Bonjour, ceci est un test en français',
      result: 'This is the result in English',
      name: '法语输入 -> 英文结果 -> 需翻译回法语/英文'
    },
    {
      original: 'こんにちは、これは日本語のテストです',
      result: 'This is a test result in English',
      name: '日语输入 -> 英文结果 -> 需翻译回日语/英文'
    }
  ];

  console.log('\n===== 语言一致性处理测试 =====');
  
  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`  原始内容: "${testCase.original}"`);
    console.log(`  结果内容: "${testCase.result}"`);
    
    // 检测语言
    const originalLang = detectMainLanguage(testCase.original);
    const resultLang = detectMainLanguage(testCase.result);
    
    console.log(`  原始语言: ${originalLang}`);
    console.log(`  结果语言: ${resultLang}`);
    
    if (originalLang !== resultLang) {
      console.log('  检测到语言不一致，进行翻译...');
      try {
        const translatedResult = await translateText(testCase.result, originalLang);
        console.log(`  翻译后结果: "${translatedResult}"`);
        
        // 检测翻译后的语言
        const translatedLang = detectMainLanguage(translatedResult);
        console.log(`  翻译后语言: ${translatedLang} (${translatedLang === originalLang ? '✅ 匹配原始语言' : '❌ 与原始语言不匹配'})`);
      } catch (error: any) {
        console.error(`  翻译出错: ${error.message}`);
      }
    } else {
      console.log('  语言一致，无需翻译');
    }
    console.log('-------------------');
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  try {
    console.log('开始测试语言工具函数...\n');
    
    // 测试语言检测
    await testLanguageDetection();
    
    // 测试翻译功能
    await testTranslation();
    
    // 测试语言一致性处理
    await testLanguageConsistency();
    
    console.log('\n所有测试已完成！');
  } catch (error: any) {
    console.error('测试过程中发生错误:', error);
  }
}

// 执行测试
runAllTests();

/**
 * 使用方法:
 * 1. 在终端中运行 `npx ts-node extension/src/utils/languageUtilsTest.ts`
 * 2. 或在扩展开发环境中通过控制台手动调用 runAllTests() 函数
 */ 