/**
 * 文本统计 Hook
 * 提供字符统计、中文字符统计、阅读时长计算等功能
 */

export interface TextStatistics {
  /** 字符总数（含标点） */
  charCount: number;
  /** 中文字符数 */
  chineseCharCount: number;
  /** 预计阅读时长（分钟） */
  readingTime: number;
}

/**
 * 计算文本统计信息
 * @param text 纯文本内容（已去除 HTML 标签）
 * @returns 文本统计结果
 */
export function calculateStatistics(text: string): TextStatistics {
  // 字符总数
  const charCount = text.length;
  
  // 中文字符数（匹配 Unicode 中文字符范围）
  const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  
  // 预计阅读时长：按中文阅读速度 400 字/分钟计算
  // 如果是纯英文，按 200 词/分钟计算
  // 混合文本取加权平均
  const englishWordCount = (text.match(/[a-zA-Z]+/g) || []).length;
  const chineseReadingTime = chineseCharCount / 400;
  const englishReadingTime = englishWordCount / 200;
  const readingTime = Math.max(1, Math.round(chineseReadingTime + englishReadingTime));
  
  return {
    charCount,
    chineseCharCount,
    readingTime,
  };
}

/**
 * 计算项目全文的统计信息
 * @param tree 目录树数据
 * @param currentNoteId 当前编辑的章节 ID
 * @param currentContent 当前编辑的章节内容（纯文本）
 * @returns 全文统计结果
 */
export function calculateProjectStatistics(
  tree: any[],
  currentNoteId: string | undefined,
  currentContent: string
): TextStatistics {
  let totalCharCount = 0;
  let totalChineseCharCount = 0;
  
  const currentStats = calculateStatistics(currentContent);
  
  for (const volume of tree) {
    for (const act of volume.children || []) {
      for (const note of act.children || []) {
        if (currentNoteId && note.id === currentNoteId) {
          // 当前编辑的章节使用实时内容
          totalCharCount += currentStats.charCount;
          totalChineseCharCount += currentStats.chineseCharCount;
        } else {
          // 其他章节使用已保存的统计（如果有）或估算
          // 这里使用 word_count 作为估算基础
          const noteCharCount = note.word_count || 0;
          totalCharCount += noteCharCount;
          // 估算中文字符数约为总字符数的 70%（中文写作场景）
          totalChineseCharCount += Math.floor(noteCharCount * 0.7);
        }
      }
    }
  }
  
  // 全文阅读时长
  const readingTime = Math.max(1, Math.round(totalChineseCharCount / 400));
  
  return {
    charCount: totalCharCount,
    chineseCharCount: totalChineseCharCount,
    readingTime,
  };
}

/**
 * 格式化阅读时长显示
 * @param minutes 分钟数
 * @returns 格式化后的字符串
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) {
    return '< 1 分钟';
  } else if (minutes < 60) {
    return `${minutes} 分钟`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} 小时`;
    }
    return `${hours} 小时 ${remainingMinutes} 分钟`;
  }
}

/**
 * 格式化数字显示（带千分位）
 * @param num 数字
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}
