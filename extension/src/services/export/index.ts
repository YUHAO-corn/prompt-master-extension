import { Prompt } from '../prompt/types';
import { exportPrompts } from '../prompt';

/**
 * 将提示词导出为CSV格式并触发下载
 */
export async function exportPromptsToCSV(): Promise<boolean> {
  try {
    // 获取所有提示词
    const prompts = await exportPrompts();
    console.log(`[Export] 获取到 ${prompts.length} 条提示词准备导出:`, prompts);
    
    // 将提示词转换为CSV格式
    const headers = ['Title', 'Content', 'Created', 'Updated', 'Usage Count', 'Last Used', 'Favorite'];
    const csvRows = [
      headers.join(',')
    ];
    
    // 遍历提示词添加数据行
    prompts.forEach(prompt => {
      // 确保所有字段都有定义，避免undefined导致的CSV格式问题
      const safeTitle = prompt.title || 'Untitled Prompt';
      const safeContent = prompt.content || ''; 
      const safeCreatedAt = prompt.createdAt || Date.now();
      const safeUpdatedAt = prompt.updatedAt || Date.now();
      const safeUseCount = prompt.useCount || 0;
      const safeFavorite = prompt.isFavorite || prompt.favorite || false;
      
      const row = [
        // 使用双引号包裹字段以处理内容中的逗号
        `"${safeTitle.replace(/"/g, '""')}"`,
        `"${safeContent.replace(/"/g, '""')}"`,
        `"${new Date(safeCreatedAt).toLocaleString()}"`,
        `"${new Date(safeUpdatedAt).toLocaleString()}"`,
        `"${safeUseCount}"`,
        `"${prompt.lastUsed ? new Date(prompt.lastUsed).toLocaleString() : 'Never used'}"`,
        `"${safeFavorite ? 'Yes' : 'No'}"`
      ];
      csvRows.push(row.join(','));
    });
    
    // 创建CSV内容
    const csvContent = csvRows.join('\n');
    console.log(`[Export] CSV内容已准备好，共 ${csvRows.length-1} 条记录`);
    
    // 创建Blob并下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `AetherFlow_Prompts_${new Date().toLocaleDateString()}.csv`;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`[Export] CSV文件 "${fileName}" 已触发下载`);
    return true;
  } catch (error) {
    console.error('[Export] 导出提示词失败:', error);
    return false;
  }
} 