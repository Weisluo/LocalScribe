/** 导出文件下载相关的通用工具 */

/** 文件名长度上限：Windows 是 255，留足日期与扩展名的余量 */
const MAX_FILE_NAME_LENGTH = 80;

/* eslint-disable no-control-regex -- 控制字符正是这里要清掉的东西 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
/* eslint-enable no-control-regex */

/** 去掉文件名里不能用于 Windows/Unix 的字符与控制字符，避免下载失败 */
export const sanitizeFileName = (name: string): string => {
  const cleaned = name
    .replace(CONTROL_CHARS, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH) || '导出';
};

/** 统一的导出文件名：书名_日期.扩展名 */
export const buildExportFileName = (title: string, date: string, extension: string): string =>
  `${sanitizeFileName(title)}_${sanitizeFileName(date)}.${extension}`;

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 立即 revoke 会让 Firefox/Safari 取消尚未开始的下载，延后释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
