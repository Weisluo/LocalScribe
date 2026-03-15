# backend/app/services/analysis_service.py
import jieba
import jieba.posseg as pseg
import jieba.analyse
import re
from collections import Counter
from typing import List, Dict, Tuple, Optional

from app.core.exceptions import (
    SegmentationError,
    StatisticsError,
    KeywordExtractionError,
    SimilarityCalculationError,
    InvalidModeError
)


class AnalysisService:
    """文本分析服务类，基于 jieba 分词"""

    # 停用词列表（可根据需要扩展）
    STOP_WORDS = {
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也',
        '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那',
        '这些', '那些', '这个', '那个', '之', '与', '及', '等', '或', '但', '而', '如果', '因为',
        '所以', '虽然', '但是', '然而', '可以', '需要', '进行', '通过', '对于', '关于', '作为',
        '其中', '已经', '开始', '现在', '今天', '明天', '昨天', '时间', '地方', '事情', '问题',
        '工作', '生活', '我们', '你们', '他们', '它们', '她们', '大家', '这里', '那里', '哪里',
        '什么', '怎么', '为什么', '如何', '谁', '哪', '个', '种', '类', '些', '者', '家', '员',
        '性', '化', '学', '中', '大', '小', '多', '少', '高', '低', '长', '短', '来', '过',
        '下', '前', '后', '内', '外', '里', '间', '边', '面', '头', '部', '身', '心', '手',
        '眼', '口', '声', '地', '得', '着', '过', '但', '对', '将', '还', '把', '被', '让',
        '向', '从', '为', '以', '于', '则', '即', '便', '仍', '乃', '又', '且', '并', '而',
        '若', '如', '即', '使', '便', '虽', '因', '此', '故', '乃', '既', '即', '便', '即'
    }

    # 有效的分词模式
    VALID_MODES = ['default', 'full', 'search']

    @staticmethod
    def segment_text(text: str, mode: str = "default", with_pos: bool = False) -> List[Tuple[str, Optional[str]]]:
        """
        对文本进行分词

        Args:
            text: 待分词的文本
            mode: 分词模式 - default(精确模式), full(全模式), search(搜索引擎模式)
            with_pos: 是否返回词性标注

        Returns:
            分词结果列表，每项为 (词语, 词性) 的元组

        Raises:
            ValueError: 当传入无效的 mode 参数时
        """
        if not text or not text.strip():
            return []

        # 验证 mode 参数
        if mode not in AnalysisService.VALID_MODES:
            raise InvalidModeError(f"Invalid mode '{mode}'. Valid modes are: {', '.join(AnalysisService.VALID_MODES)}")

        if with_pos:
            # 使用 pseg.cut 进行词性标注
            words = list(pseg.cut(text))
            return [(word.word, word.flag) for word in words]
        else:
            # 根据模式选择分词方法
            if mode == "full":
                words = jieba.lcut(text, cut_all=True)
            elif mode == "search":
                words = jieba.lcut_for_search(text)
            else:  # default
                words = jieba.lcut(text, cut_all=False)
            return [(word, None) for word in words if word.strip()]

    @staticmethod
    def get_word_frequency(text: str, mode: str = "default", top_k: int = 50,
                          with_pos: bool = False, filter_stopwords: bool = True) -> Dict:
        """
        获取文本的词频统计

        Args:
            text: 待分析的文本
            mode: 分词模式
            top_k: 返回高频词数量
            with_pos: 是否返回词性
            filter_stopwords: 是否过滤停用词

        Returns:
            包含词频统计结果的字典
        """
        segmented = AnalysisService.segment_text(text, mode, with_pos)

        # 过滤空白字符和停用词
        if filter_stopwords:
            filtered = [(word, pos) for word, pos in segmented
                       if word.strip() and word not in AnalysisService.STOP_WORDS and len(word) > 1]
        else:
            filtered = [(word, pos) for word, pos in segmented if word.strip()]

        # 统计词频
        word_counts = Counter([item[0] for item in filtered])

        # 构建词性映射
        pos_map = {}
        if with_pos:
            for word, pos in filtered:
                if word not in pos_map:
                    pos_map[word] = pos

        # 构建结果
        total_tokens = sum(word_counts.values())
        words_list = []
        for word, count in word_counts.most_common(top_k):
            item = {"word": word, "count": count}
            if with_pos and word in pos_map:
                item["pos"] = pos_map[word]
            words_list.append(item)

        return {
            "total_words": len(word_counts),
            "total_tokens": total_tokens,
            "words": words_list,
            "segmented_text": [item[0] for item in filtered]
        }

    @staticmethod
    def get_text_statistics(text: str) -> Dict:
        """
        获取文本的详细统计信息

        Args:
            text: 待统计的文本

        Returns:
            包含各项统计指标的字典
        """
        if not text:
            return {
                "char_count": 0,
                "char_count_no_spaces": 0,
                "chinese_char_count": 0,
                "word_count": 0,
                "sentence_count": 0,
                "paragraph_count": 0,
                "avg_sentence_length": 0.0,
                "avg_word_length": 0.0
            }

        # 字符统计
        char_count = len(text)
        char_count_no_spaces = len(text.replace(' ', '').replace('\t', ''))

        # 中文字符统计
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
        chinese_char_count = len(chinese_chars)

        # 分词统计
        words = jieba.lcut(text)
        words = [w for w in words if w.strip()]
        word_count = len(words)

        # 计算平均词长
        total_word_length = sum(len(w) for w in words)
        avg_word_length = total_word_length / word_count if word_count > 0 else 0.0

        # 句子统计（按标点符号分割）
        sentence_pattern = r'[^。！？.!?]+[。！？.!?]*'
        sentences = re.findall(sentence_pattern, text)
        sentence_count = len(sentences) if sentences else 1

        # 段落统计
        paragraphs = [p for p in text.split('\n\n') if p.strip()]
        paragraph_count = len(paragraphs) if paragraphs else 1

        # 平均句长
        avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0.0

        return {
            "char_count": char_count,
            "char_count_no_spaces": char_count_no_spaces,
            "chinese_char_count": chinese_char_count,
            "word_count": word_count,
            "sentence_count": sentence_count,
            "paragraph_count": paragraph_count,
            "avg_sentence_length": round(avg_sentence_length, 2),
            "avg_word_length": round(avg_word_length, 2)
        }

    @staticmethod
    def extract_keywords(text: str, top_k: int = 20, with_weight: bool = True) -> List[Dict]:
        """
        使用 TF-IDF 算法提取关键词

        Args:
            text: 待提取的文本
            top_k: 提取关键词数量
            with_weight: 是否返回权重

        Returns:
            关键词列表
        """
        if not text or not text.strip():
            return []

        if with_weight:
            keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)
            return [{"word": word, "weight": round(weight, 4)} for word, weight in keywords]
        else:
            keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=False)
            return [{"word": word} for word in keywords]

    @staticmethod
    def calculate_similarity(text1: str, text2: str) -> Dict:
        """
        计算两段文本的相似度（基于共同词汇）

        Args:
            text1: 文本1
            text2: 文本2

        Returns:
            包含相似度和共同词汇的字典
        """
        if not text1 or not text2:
            return {"similarity": 0.0, "common_words": []}

        # 对两段文本进行分词
        words1 = set(jieba.lcut(text1))
        words2 = set(jieba.lcut(text2))

        # 过滤停用词和单字
        words1 = {w for w in words1 if w not in AnalysisService.STOP_WORDS and len(w) > 1}
        words2 = {w for w in words2 if w not in AnalysisService.STOP_WORDS and len(w) > 1}

        # 计算交集和并集
        common_words = words1 & words2
        all_words = words1 | words2

        # 计算 Jaccard 相似度
        similarity = len(common_words) / len(all_words) if all_words else 0.0

        return {
            "similarity": round(similarity, 4),
            "common_words": sorted(list(common_words))
        }

    @staticmethod
    def add_custom_words(words: List[str]):
        """
        添加自定义词汇到 jieba 词典

        Args:
            words: 自定义词汇列表
        """
        for word in words:
            jieba.add_word(word)

    @staticmethod
    def load_user_dict(dict_path: str):
        """
        加载用户自定义词典

        Args:
            dict_path: 词典文件路径
        """
        jieba.load_userdict(dict_path)
