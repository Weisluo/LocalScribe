/**
 * 文本分析 API 服务
 * 提供分词、统计、关键词提取、相似度比较等功能
 */
import request from '@/utils/request';

// 类型定义从生成的 api.ts 中提取
export type SegmentationMode = 'default' | 'full' | 'search';

export interface SegmentationRequest {
  /** 待分析的文本内容 */
  text: string;
  /** 分词模式 */
  mode?: SegmentationMode;
  /** 返回高频词数量 */
  top_k?: number;
  /** 是否返回词性标注 */
  with_pos?: boolean;
}

export interface WordItem {
  /** 词语 */
  word: string;
  /** 出现次数 */
  count: number;
  /** 词性标注 */
  pos?: string;
}

export interface SegmentationResponse {
  /** 总词数（去重后） */
  total_words: number;
  /** 总词频（含重复） */
  total_tokens: number;
  /** 词语列表 */
  words: WordItem[];
  /** 分词后的文本序列 */
  segmented_text: string[];
}

export interface SegmentedWordItem {
  /** 词语 */
  word: string;
  /** 词性标注（如果有） */
  pos?: string;
}

export interface RawSegmentationResponse {
  /** 分词结果列表 */
  segmented: SegmentedWordItem[];
}

export interface TextStatisticsRequest {
  /** 待统计的文本内容 */
  text: string;
}

export interface TextStatisticsResponse {
  /** 字符总数（含标点） */
  char_count: number;
  /** 字符数（不含空格） */
  char_count_no_spaces: number;
  /** 中文字符数 */
  chinese_char_count: number;
  /** 词数（按分词结果） */
  word_count: number;
  /** 句子数 */
  sentence_count: number;
  /** 段落数 */
  paragraph_count: number;
  /** 平均句长（词数） */
  avg_sentence_length: number;
  /** 平均词长（字符数） */
  avg_word_length: number;
}

export interface KeywordExtractRequest {
  /** 待提取的文本内容 */
  text: string;
  /** 提取关键词数量 */
  top_k?: number;
  /** 是否返回权重 */
  with_weight?: boolean;
}

export interface KeywordItem {
  /** 关键词 */
  word: string;
  /** 权重 */
  weight?: number;
}

export interface KeywordExtractResponse {
  /** 关键词列表 */
  keywords: KeywordItem[];
}

export interface TextSimilarityRequest {
  /** 文本1 */
  text1: string;
  /** 文本2 */
  text2: string;
}

export interface TextSimilarityResponse {
  /** 相似度（0-1之间） */
  similarity: number;
  /** 共同词汇 */
  common_words: string[];
}

/**
 * 文本分词分析
 * @param data 分词请求参数
 * @returns 分词分析结果
 */
export function segmentText(data: SegmentationRequest): Promise<SegmentationResponse> {
  return request.post('/analysis/segment', data);
}

/**
 * 获取原始分词结果
 * @param data 分词请求参数
 * @returns 原始分词结果列表
 */
export function segmentTextRaw(data: SegmentationRequest): Promise<RawSegmentationResponse> {
  return request.post('/analysis/segment/raw', data);
}

/**
 * 获取文本统计信息
 * @param data 文本统计请求参数
 * @returns 文本统计结果
 */
export function getTextStatistics(data: TextStatisticsRequest): Promise<TextStatisticsResponse> {
  return request.post('/analysis/statistics', data);
}

/**
 * 提取关键词
 * @param data 关键词提取请求参数
 * @returns 关键词列表
 */
export function extractKeywords(data: KeywordExtractRequest): Promise<KeywordExtractResponse> {
  return request.post('/analysis/keywords', data);
}

/**
 * 计算文本相似度
 * @param data 相似度比较请求参数
 * @returns 相似度结果
 */
export function calculateSimilarity(data: TextSimilarityRequest): Promise<TextSimilarityResponse> {
  return request.post('/analysis/similarity', data);
}

/**
 * 分析工具类 - 提供便捷的分析方法
 */
export class TextAnalyzer {
  /**
   * 快速分词（使用默认配置）
   * @param text 待分析的文本
   * @returns 分词后的词语列表
   */
  static async quickSegment(text: string): Promise<string[]> {
    const result = await segmentText({
      text,
      mode: 'default',
      top_k: 50,
      with_pos: false,
    });
    return result.segmented_text;
  }

  /**
   * 获取词频统计
   * @param text 待分析的文本
   * @param topK 返回高频词数量
   * @returns 词频统计结果
   */
  static async getWordFrequency(text: string, topK: number = 20): Promise<SegmentationResponse> {
    return segmentText({
      text,
      mode: 'default',
      top_k: topK,
      with_pos: false,
    });
  }

  /**
   * 获取带词性的分词结果
   * @param text 待分析的文本
   * @returns 带词性的分词结果
   */
  static async getSegmentationWithPos(text: string): Promise<RawSegmentationResponse> {
    return segmentTextRaw({
      text,
      mode: 'default',
      with_pos: true,
    });
  }

  /**
   * 快速获取文本统计
   * @param text 待统计的文本
   * @returns 文本统计信息
   */
  static async quickStatistics(text: string): Promise<TextStatisticsResponse> {
    return getTextStatistics({ text });
  }

  /**
   * 快速提取关键词
   * @param text 待提取的文本
   * @param topK 提取数量
   * @returns 关键词列表
   */
  static async quickKeywords(text: string, topK: number = 10): Promise<string[]> {
    const result = await extractKeywords({
      text,
      top_k: topK,
      with_weight: false,
    });
    return result.keywords.map((k: KeywordItem) => k.word);
  }

  /**
   * 比较两段文本的相似度
   * @param text1 文本1
   * @param text2 文本2
   * @returns 相似度分数 (0-1)
   */
  static async compareSimilarity(text1: string, text2: string): Promise<number> {
    const result = await calculateSimilarity({ text1, text2 });
    return result.similarity;
  }
}

export default {
  segmentText,
  segmentTextRaw,
  getTextStatistics,
  extractKeywords,
  calculateSimilarity,
  TextAnalyzer,
};
