# backend/app/schemas/analysis.py
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from enum import Enum


class SegmentationMode(str, Enum):
    """分词模式"""
    default = "default"      # 精确模式，试图将句子最精确地切开
    full = "full"            # 全模式，把句子中所有的可以成词的词语都扫描出来
    search = "search"        # 搜索引擎模式，在精确模式基础上，对长词再次切分


class SegmentationRequest(BaseModel):
    """分词分析请求"""
    text: str = Field(..., min_length=1, description="待分析的文本内容")
    mode: SegmentationMode = Field(default=SegmentationMode.default, description="分词模式")
    top_k: Optional[int] = Field(default=50, ge=1, le=200, description="返回高频词数量")
    with_pos: bool = Field(default=False, description="是否返回词性标注")


class WordItem(BaseModel):
    """单个词语项"""
    word: str = Field(..., description="词语")
    count: int = Field(..., description="出现次数")
    pos: Optional[str] = Field(default=None, description="词性标注")


class SegmentedWordItem(BaseModel):
    """原始分词结果中的单个词语项"""
    word: str = Field(..., description="词语")
    pos: Optional[str] = Field(default=None, description="词性标注（如果有）")


class SegmentationResponse(BaseModel):
    """分词分析响应"""
    total_words: int = Field(..., description="总词数（去重后）")
    total_tokens: int = Field(..., description="总词频（含重复）")
    words: List[WordItem] = Field(..., description="词语列表")
    segmented_text: List[str] = Field(..., description="分词后的文本序列")


class RawSegmentationResponse(BaseModel):
    """原始分词结果响应"""
    segmented: List[SegmentedWordItem] = Field(..., description="分词结果列表，每项包含词语和可选的词性标注")


class TextStatisticsRequest(BaseModel):
    """文本统计请求"""
    text: str = Field(..., min_length=1, description="待统计的文本内容")


class TextStatisticsResponse(BaseModel):
    """文本统计响应"""
    char_count: int = Field(..., description="字符总数（含标点）")
    char_count_no_spaces: int = Field(..., description="字符数（不含空格）")
    chinese_char_count: int = Field(..., description="中文字符数")
    word_count: int = Field(..., description="词数（按分词结果）")
    sentence_count: int = Field(..., description="句子数")
    paragraph_count: int = Field(..., description="段落数")
    avg_sentence_length: float = Field(..., description="平均句长（词数）")
    avg_word_length: float = Field(..., description="平均词长（字符数）")


class KeywordExtractRequest(BaseModel):
    """关键词提取请求"""
    text: str = Field(..., min_length=1, description="待提取的文本内容")
    top_k: int = Field(default=20, ge=1, le=100, description="提取关键词数量")
    with_weight: bool = Field(default=True, description="是否返回权重")


class KeywordItem(BaseModel):
    """关键词项"""
    word: str = Field(..., description="关键词")
    weight: Optional[float] = Field(default=None, description="权重")


class KeywordExtractResponse(BaseModel):
    """关键词提取响应"""
    keywords: List[KeywordItem] = Field(..., description="关键词列表")


class TextSimilarityRequest(BaseModel):
    """文本相似度比较请求"""
    text1: str = Field(..., min_length=1, description="文本1")
    text2: str = Field(..., min_length=1, description="文本2")


class TextSimilarityResponse(BaseModel):
    """文本相似度比较响应"""
    similarity: float = Field(..., ge=0, le=1, description="相似度（0-1之间）")
    common_words: List[str] = Field(..., description="共同词汇")
