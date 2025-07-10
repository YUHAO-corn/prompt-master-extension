import { Prompt, CreatePromptInput, UpdatePromptInput } from './types';

// 模拟的提示词存储
export let mockPrompts: Prompt[] = [
  {
    id: '1',
    title: '高质量代码审查',
    content: '请帮我审查以下代码，指出潜在的问题、性能瓶颈和安全漏洞。提供具体的改进建议，包括代码示例。',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    isFavorite: true,
    favorite: true,
    useCount: 12,
    lastUsed: Date.now() - 2 * 24 * 60 * 60 * 1000,
    isActive: true
  },
  {
    id: '2',
    title: '简化复杂概念',
    content: '请以一个10岁孩子能理解的方式解释以下概念，避免使用技术术语，多用类比和例子。',
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    isFavorite: true,
    favorite: true,
    useCount: 5,
    lastUsed: Date.now() - 6 * 24 * 60 * 60 * 1000,
    isActive: true
  }
];

/**
 * 模拟获取所有提示词
 */
export async function getPrompts(): Promise<Prompt[]> {
  return mockPrompts.filter(p => p.isActive);
}

/**
 * 模拟搜索提示词
 */
export async function searchPrompts(keyword: string): Promise<Prompt[]> {
  if (!keyword) return mockPrompts.filter(p => p.isActive);
  
  const lowerKeyword = keyword.toLowerCase();
  return mockPrompts.filter(p => 
    (p.isActive) && 
    (p.title.toLowerCase().includes(lowerKeyword) || 
     p.content.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * 模拟根据ID获取提示词
 */
export async function getPromptById(id: string): Promise<Prompt | null> {
  const prompt = mockPrompts.find(p => p.id === id && p.isActive);
  return prompt || null;
}

/**
 * 模拟创建提示词
 */
export async function createPrompt(input: CreatePromptInput): Promise<Prompt> {
  const newPrompt: Prompt = {
    id: `mock-${Date.now()}`,
    title: input.title || `提示词 ${Date.now()}`,
    content: input.content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isFavorite: true,
    favorite: true,
    useCount: 0,
    lastUsed: 0,
    isActive: true,
    source: input.source,
    tags: input.tags,
    category: input.category
  };
  
  mockPrompts.push(newPrompt);
  return newPrompt;
}

/**
 * 模拟更新提示词
 */
export async function updatePrompt(id: string, input: UpdatePromptInput): Promise<Prompt | null> {
  console.log('模拟更新提示词:', id, input);
  
  const promptIndex = mockPrompts.findIndex(p => p.id === id);
  if (promptIndex === -1) return null;
  
  // 更新提示词
  const updatedPrompt = {
    ...mockPrompts[promptIndex],
    ...input,
    updatedAt: Date.now()
  };
  
  // 保存更新
  mockPrompts[promptIndex] = updatedPrompt;
  
  console.log('提示词更新成功:', updatedPrompt);
  return updatedPrompt;
}

/**
 * 模拟删除提示词(软删除)
 */
export async function deletePrompt(id: string): Promise<boolean> {
  const promptIndex = mockPrompts.findIndex(p => p.id === id);
  if (promptIndex === -1) return false;
  
  mockPrompts[promptIndex].isActive = false;
  mockPrompts[promptIndex].updatedAt = Date.now();
  return true;
}

/**
 * 模拟切换收藏状态
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  const promptIndex = mockPrompts.findIndex(p => p.id === id);
  if (promptIndex === -1) return false;
  
  mockPrompts[promptIndex].isFavorite = !mockPrompts[promptIndex].isFavorite;
  mockPrompts[promptIndex].updatedAt = Date.now();
  return true;
}

/**
 * 模拟增加使用次数
 */
export async function incrementPromptUse(id: string): Promise<void> {
  const prompt = mockPrompts.find(p => p.id === id);
  if (prompt) {
    prompt.useCount = (prompt.useCount || 0) + 1;
    prompt.lastUsed = Date.now();
  }
} 