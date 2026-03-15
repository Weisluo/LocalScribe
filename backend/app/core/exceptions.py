# backend/app/core/exceptions.py
"""
自定义异常类定义
"""


class AnalysisError(Exception):
    """分析服务基础异常"""
    pass


class SegmentationError(AnalysisError):
    """分词分析异常"""
    pass


class StatisticsError(AnalysisError):
    """文本统计异常"""
    pass


class KeywordExtractionError(AnalysisError):
    """关键词提取异常"""
    pass


class SimilarityCalculationError(AnalysisError):
    """相似度计算异常"""
    pass


class InvalidModeError(AnalysisError):
    """无效模式异常"""
    pass


class TextProcessingError(AnalysisError):
    """文本处理异常"""
    pass
