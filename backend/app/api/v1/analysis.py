# backend/app/api/v1/analysis.py
from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas.analysis import (
    SegmentationRequest, SegmentationResponse, WordItem,
    SegmentedWordItem, RawSegmentationResponse,
    TextStatisticsRequest, TextStatisticsResponse,
    KeywordExtractRequest, KeywordExtractResponse, KeywordItem,
    TextSimilarityRequest, TextSimilarityResponse
)
from app.services.analysis_service import AnalysisService
from app.core.exceptions import (
    SegmentationError,
    StatisticsError,
    KeywordExtractionError,
    SimilarityCalculationError,
    InvalidModeError
)

router = APIRouter()


@router.post("/segment", response_model=SegmentationResponse, summary="文本分词分析")
def segment_text(request: SegmentationRequest):
    """
    对文本进行分词分析，返回词频统计结果

    - **text**: 待分析的文本内容
    - **mode**: 分词模式 (default/full/search)
    - **top_k**: 返回高频词数量
    - **with_pos**: 是否返回词性标注
    """
    try:
        result = AnalysisService.get_word_frequency(
            text=request.text,
            mode=request.mode.value,
            top_k=request.top_k,
            with_pos=request.with_pos,
            filter_stopwords=True
        )

        # 转换为响应模型
        words = [WordItem(**item) for item in result["words"]]

        return SegmentationResponse(
            total_words=result["total_words"],
            total_tokens=result["total_tokens"],
            words=words,
            segmented_text=result["segmented_text"]
        )
    except InvalidModeError as e:
        raise HTTPException(status_code=400, detail=f"无效的参数: {str(e)}")
    except SegmentationError as e:
        raise HTTPException(status_code=422, detail=f"分词处理失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@router.post("/statistics", response_model=TextStatisticsResponse, summary="文本统计信息")
def text_statistics(request: TextStatisticsRequest):
    """
    获取文本的详细统计信息

    - **text**: 待统计的文本内容

    返回：字符数、词数、句子数、段落数、平均句长等指标
    """
    try:
        result = AnalysisService.get_text_statistics(request.text)
        return TextStatisticsResponse(**result)
    except StatisticsError as e:
        raise HTTPException(status_code=422, detail=f"统计处理失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@router.post("/keywords", response_model=KeywordExtractResponse, summary="关键词提取")
def extract_keywords(request: KeywordExtractRequest):
    """
    使用 TF-IDF 算法从文本中提取关键词

    - **text**: 待提取的文本内容
    - **top_k**: 提取关键词数量 (1-100)
    - **with_weight**: 是否返回权重
    """
    try:
        result = AnalysisService.extract_keywords(
            text=request.text,
            top_k=request.top_k,
            with_weight=request.with_weight
        )

        keywords = [KeywordItem(**item) for item in result]
        return KeywordExtractResponse(keywords=keywords)
    except KeywordExtractionError as e:
        raise HTTPException(status_code=422, detail=f"关键词提取失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@router.post("/similarity", response_model=TextSimilarityResponse, summary="文本相似度比较")
def calculate_similarity(request: TextSimilarityRequest):
    """
    比较两段文本的相似度

    - **text1**: 文本1
    - **text2**: 文本2

    返回：相似度分数 (0-1) 和共同词汇列表
    """
    try:
        result = AnalysisService.calculate_similarity(
            text1=request.text1,
            text2=request.text2
        )
        return TextSimilarityResponse(**result)
    except SimilarityCalculationError as e:
        raise HTTPException(status_code=422, detail=f"相似度计算失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@router.post("/segment/raw", response_model=RawSegmentationResponse, summary="原始分词结果")
def segment_text_raw(request: SegmentationRequest):
    """
    获取原始分词结果（不进行词频统计）

    - **text**: 待分析的文本内容
    - **mode**: 分词模式
    - **with_pos**: 是否返回词性标注
    """
    try:
        result = AnalysisService.segment_text(
            text=request.text,
            mode=request.mode.value,
            with_pos=request.with_pos
        )

        segmented_items = [
            SegmentedWordItem(word=word, pos=pos)
            for word, pos in result
        ]

        return RawSegmentationResponse(segmented=segmented_items)
    except InvalidModeError as e:
        raise HTTPException(status_code=400, detail=f"无效的参数: {str(e)}")
    except SegmentationError as e:
        raise HTTPException(status_code=422, detail=f"分词处理失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")
