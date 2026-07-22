// 图片扩展名（可预览）
export const PREVIEWABLE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];

// 文本扩展名（可预览）
export const PREVIEWABLE_TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'java', 'kt', 'js', 'ts', 'html', 'css', 'properties', 'sql'];

// 从文件名获取扩展名（小写，不含点）
export function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

// 判断文件是否可预览（图片或文本）
export function isPreviewableFile(filename: string): boolean {
  const ext = getExtension(filename);
  return PREVIEWABLE_IMAGE_EXTENSIONS.includes(ext) || PREVIEWABLE_TEXT_EXTENSIONS.includes(ext);
}

// 判断是否为图片文件
export function isImageFile(filename: string): boolean {
  return PREVIEWABLE_IMAGE_EXTENSIONS.includes(getExtension(filename));
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
