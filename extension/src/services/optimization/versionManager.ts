/**
 * 版本管理服务
 * 处理优化版本的创建、更新和状态管理
 */
import { OptimizationVersion } from './types';

/**
 * 创建初始加载版本对象
 * @returns 初始版本对象
 */
export function createInitialLoadingVersion(): OptimizationVersion {
  return { 
    id: 1, 
    content: '', 
    isLoading: true,
    createdAt: Date.now()
  };
}

/**
 * 创建成功的优化结果版本
 * @param content 优化后的内容
 * @param id 版本ID
 * @returns 优化结果版本对象
 */
export function createSuccessVersion(content: string, id: number = 1): OptimizationVersion {
  return {
    id,
    content,
    isLoading: false,
    isNew: true,
    createdAt: Date.now()
  };
}

/**
 * 将新版本插入到版本列表中
 * @param versions 当前版本列表
 * @param newVersion 要插入的新版本
 * @param afterVersionId 在哪个版本后插入，如不指定则添加到末尾
 * @returns 更新后的版本列表
 */
export function insertVersionIntoList(
  versions: OptimizationVersion[],
  newVersion: OptimizationVersion,
  afterVersionId?: number
): OptimizationVersion[] {
  if (afterVersionId === undefined) {
    return [...versions, newVersion];
  }
  
  const sourceIndex = versions.findIndex(v => v.id === afterVersionId);
  if (sourceIndex === -1) {
    // 如果找不到指定版本，添加到末尾
    return [...versions, newVersion];
  }
  
  return [
    ...versions.slice(0, sourceIndex + 1),
    newVersion,
    ...versions.slice(sourceIndex + 1)
  ];
}

/**
 * 获取版本显示内容，优先使用编辑后的内容
 * @param version 版本对象
 * @returns 显示内容
 */
export function getVersionDisplayContent(version: OptimizationVersion): string {
  return version.editedContent || version.content;
}

/**
 * 格式化内容预览，精简显示
 * @param content 原始内容
 * @param maxLength 最大长度
 * @returns 格式化后的预览内容
 */
export function formatContentPreview(content: string, maxLength = 400): string {
  // 仅去除多余的空行，保留正常换行
  let formatted = content.replace(/\n{3,}/g, '\n\n');
  
  // 保留文本的前maxLength个字符，并在末尾添加省略号表示被截断
  if (formatted.length > maxLength) {
    return formatted.substring(0, maxLength) + '...';
  }
  return formatted;
}

/**
 * 格式化版本标题
 * @param id 版本ID
 * @param isEdited 是否已编辑
 * @returns 格式化后的标题
 */
export function formatVersionTitle(id: number, isEdited: boolean = false): string {
  const title = `Version ${id}${isEdited ? ' (Edited)' : ''}`;
  return title.length > 30 ? title.substring(0, 27) + '...' : title;
}

/**
 * 判断版本是否包含错误信息
 * @param content 版本内容
 * @returns 是否为错误版本
 */
export function isErrorVersion(content: string): boolean {
  return content.startsWith('Optimization failed:');
}

/**
 * 生成优化版本的新ID
 * @param versions 现有版本列表
 * @returns 新版本ID
 */
export function generateNewVersionId(versions: OptimizationVersion[]): number {
  return versions.length > 0 
    ? Math.max(...versions.map(v => v.id), 0) + 1 
    : 1;
}

/**
 * 创建继续优化的结果版本
 * @param content 优化内容
 * @param parentId 父版本ID
 * @param versionId 版本ID
 * @returns 优化版本对象
 */
export function createContinuedVersion(
  content: string, 
  parentId: number, 
  versionId: number
): OptimizationVersion {
  return {
    id: versionId,
    content,
    isLoading: false,
    isNew: true,
    createdAt: Date.now(),
    parentId
  };
}

/**
 * 更新版本的特定属性
 * @param versions 版本列表
 * @param versionId 要更新的版本ID
 * @param updates 更新内容
 * @returns 更新后的版本列表
 */
export function updateVersionInList(
  versions: OptimizationVersion[], 
  versionId: number, 
  updates: Partial<OptimizationVersion>
): OptimizationVersion[] {
  return versions.map(version => 
    version.id === versionId 
      ? { ...version, ...updates } 
      : version
  );
}

/**
 * 切换版本收藏状态
 * @param version 要处理的版本
 * @param currentFavorites 当前收藏版本ID数组
 * @param onSaveToLibrary 可选的保存到收藏夹回调
 * @returns 更新后的收藏版本ID数组
 */
export async function toggleFavoriteVersion(
  version: OptimizationVersion,
  currentFavorites: number[],
  onSaveToLibrary?: (content: string) => void
): Promise<number[]> {
  const versionId = version.id;
  const content = getVersionDisplayContent(version);
  
  if (currentFavorites.includes(versionId)) {
    // 如果已收藏，则取消收藏
    return currentFavorites.filter(id => id !== versionId);
  } else {
    // 如果未收藏，则添加到收藏
    // 如果有保存函数，则调用它
    if (onSaveToLibrary) {
      try {
        onSaveToLibrary(content);
      } catch (error) {
        console.error('保存到收藏夹失败:', error);
      }
    }
    return [...currentFavorites, versionId];
  }
}

/**
 * 获取版本的收藏状态
 * @param versionId 版本ID
 * @param favorites 当前收藏的版本ID数组
 * @returns 是否已收藏
 */
export function getFavoriteStatus(versionId: number, favorites: number[]): boolean {
  return favorites.includes(versionId);
}

/**
 * 开始编辑版本内容
 * @param version 要编辑的版本
 * @returns 初始编辑内容
 */
export function startEditVersion(version: OptimizationVersion): string {
  // 返回当前显示内容作为初始编辑内容
  return getVersionDisplayContent(version);
}

/**
 * 保存编辑的版本内容
 * @param version 要更新的版本
 * @param editContent 编辑后的内容
 * @returns 包含更新内容的部分版本对象
 */
export function saveEditedVersion(
  version: OptimizationVersion,
  editContent: string
): Partial<OptimizationVersion> {
  return {
    editedContent: editContent,
    isEdited: true
  };
}

/**
 * 取消编辑操作
 * @param version 当前版本
 * @returns 原始显示内容
 */
export function cancelEditVersion(version: OptimizationVersion): string {
  return getVersionDisplayContent(version);
} 