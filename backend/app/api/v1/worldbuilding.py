# backend/app/api/v1/worldbuilding.py
import io
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_db
from app.core.logging import get_logger
from app.models import (
    CustomWorldviewConfig,
    Project,
    WorldInstance,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
    WorldTemplate,
)
from app.schemas.worldbuilding import (
    BatchDeleteRequest,
    BatchUpdateOrderRequest,
    ComplexityLevel,
    EconomicSystemType,
    MagicLevel,
    ModuleConfigs,
    TechLevel,
    TimeScale,
    WorldInstanceCreate,
    WorldInstanceResponse,
    WorldInstanceUpdate,
    WorldModuleCreate,
    WorldModuleItemCreate,
    WorldModuleItemResponse,
    WorldModuleItemUpdate,
    WorldModuleResponse,
    WorldModuleUpdate,
    WorldModuleWithItems,
    WorldSubmoduleCreate,
    WorldSubmoduleResponse,
    WorldSubmoduleUpdate,
    WorldSubmoduleWithItems,
    WorldTemplateCreate,
    WorldTemplateExport,
    WorldTemplateFilter,
    WorldTemplateImport,
    WorldTemplateResponse,
    WorldTemplateUpdate,
    WorldTemplateWithModules,
    WorldviewAdaptationsResponse,
    WorldviewAdaptationRule,
    WorldviewConfigCreate,
    WorldviewConfigResponse,
    WorldviewConfigUpdate,
    WorldviewPreset,
    WorldviewTheme,
    WorldviewType,
)

logger = get_logger(__name__)
router = APIRouter()

SYSTEM_WORLDVIEW_CONFIGS = {
    "xianxia": {
        "id": "xianxia-default",
        "type": WorldviewType.XIANXIA,
        "name": "标准仙侠世界",
        "description": "修真修仙的东方玄幻世界，包含门派斗争、法宝丹药等元素",
        "timeScale": TimeScale.ANCIENT,
        "techLevel": TechLevel.MEDIEVAL,
        "magicLevel": MagicLevel.HIGH,
        "politicalComplexity": ComplexityLevel.COMPLEX,
        "economicSystem": EconomicSystemType.FEUDAL,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "era",
                "eventTypes": [
                    {
                        "type": "cultivation_breakthrough",
                        "label": "修为突破",
                        "icon": "🧘",
                        "color": "#8b5cf6",
                    },
                    {
                        "type": "sect_foundation",
                        "label": "门派创立",
                        "icon": "🏯",
                        "color": "#059669",
                    },
                    {
                        "type": "treasure_discovery",
                        "label": "法宝现世",
                        "icon": "💎",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "tribulation",
                        "label": "天劫降临",
                        "icon": "⚡",
                        "color": "#dc2626",
                    },
                ],
                "eraThemes": [
                    {"theme": "primordial", "label": "洪荒时代", "color": "#7c3aed"},
                    {"theme": "immortal", "label": "仙道盛世", "color": "#10b981"},
                    {"theme": "demonic", "label": "魔道乱世", "color": "#ef4444"},
                ],
                "timelineStyle": "cyclical",
                "recordingMethod": "magical",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "sect",
                        "label": "修仙门派",
                        "icon": "🏯",
                        "color": "#059669",
                    },
                    {
                        "type": "clan",
                        "label": "修仙世家",
                        "icon": "👨‍👩‍👧‍👦",
                        "color": "#7c3aed",
                    },
                    {
                        "type": "immortal_emperor",
                        "label": "仙帝",
                        "icon": "👑",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "demon_king",
                        "label": "魔尊",
                        "icon": "😈",
                        "color": "#dc2626",
                    },
                ],
                "governmentTypes": [
                    {"type": "sect_hierarchy", "label": "门派等级制"},
                    {"type": "immortal_monarchy", "label": "仙帝专制"},
                    {"type": "alliance_council", "label": "联盟议会制"},
                ],
                "alignmentSystem": "confucian",
                "powerStructure": "decentralized",
            },
            economy={
                "entityTypes": [
                    {
                        "type": "spirit_stone",
                        "label": "灵石",
                        "icon": "💎",
                        "color": "#8b5cf6",
                    },
                    {
                        "type": "elixir",
                        "label": "丹药",
                        "icon": "💊",
                        "color": "#10b981",
                    },
                    {
                        "type": "magical_artifact",
                        "label": "法宝",
                        "icon": "⚔️",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "cultivation_resource",
                        "label": "修炼资源",
                        "icon": "🌿",
                        "color": "#059669",
                    },
                ],
                "currencyTypes": [
                    {"type": "spirit_stone", "label": "灵石货币"},
                    {"type": "contribution_point", "label": "贡献点"},
                    {"type": "favor", "label": "人情债"},
                ],
                "resourceTypes": [
                    {"type": "spiritual", "label": "灵气资源"},
                    {"type": "alchemical", "label": "炼丹材料"},
                    {"type": "artifact", "label": "炼器材料"},
                ],
                "tradeMethods": [
                    {"type": "auction", "label": "拍卖会"},
                    {"type": "barter", "label": "以物易物"},
                    {"type": "mission_reward", "label": "任务奖励"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#7c3aed",
            secondaryColor="#10b981",
            accentColor="#f59e0b",
            backgroundGradient="linear-gradient(135deg, #7c3aed 0%, #10b981 50%, #f59e0b 100%)",
            fontFamily="Noto Serif SC, serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "causal",
                "description": "门派创立事件与政治实体关联",
                "confidence": 0.9,
            },
            {
                "sourceModule": "history",
                "targetModule": "economy",
                "relationType": "influential",
                "description": "修为突破影响经济资源分配",
                "confidence": 0.7,
            },
        ],
        "presets": [
            {
                "id": "xianxia-default",
                "name": "标准仙侠",
                "description": "包含标准仙侠元素的预设",
                "icon": "🧘",
            }
        ],
        "is_system": True,
    },
    "historical": {
        "id": "historical-default",
        "type": WorldviewType.HISTORICAL,
        "name": "标准历史世界",
        "description": "真实历史背景的世界观，包含王朝更迭、历史事件等元素",
        "timeScale": TimeScale.MEDIEVAL,
        "techLevel": TechLevel.MEDIEVAL,
        "magicLevel": MagicLevel.NONE,
        "politicalComplexity": ComplexityLevel.COMPLEX,
        "economicSystem": EconomicSystemType.FEUDAL,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "year",
                "eventTypes": [
                    {
                        "type": "dynasty_change",
                        "label": "王朝更迭",
                        "icon": "👑",
                        "color": "#c9a227",
                    },
                    {"type": "war", "label": "战争", "icon": "⚔️", "color": "#dc2626"},
                    {
                        "type": "treaty",
                        "label": "条约签订",
                        "icon": "📜",
                        "color": "#059669",
                    },
                    {
                        "type": "reform",
                        "label": "改革变法",
                        "icon": "📜",
                        "color": "#0ea5e9",
                    },
                ],
                "eraThemes": [
                    {"theme": "spring_autumn", "label": "春秋战国", "color": "#c9a227"},
                    {"theme": "imperial", "label": "帝国时代", "color": "#dc2626"},
                    {"theme": "republic", "label": "共和时代", "color": "#059669"},
                ],
                "timelineStyle": "linear",
                "recordingMethod": "chronicle",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "kingdom",
                        "label": "王国",
                        "icon": "👑",
                        "color": "#c9a227",
                    },
                    {
                        "type": "empire",
                        "label": "帝国",
                        "icon": "🏛️",
                        "color": "#dc2626",
                    },
                    {
                        "type": "republic",
                        "label": "共和国",
                        "icon": "⚖️",
                        "color": "#059669",
                    },
                    {
                        "type": "tribe",
                        "label": "部落",
                        "icon": "🏕️",
                        "color": "#f59e0b",
                    },
                ],
                "governmentTypes": [
                    {"type": "monarchy", "label": "君主制"},
                    {"type": "aristocracy", "label": "贵族制"},
                    {"type": "republic", "label": "共和制"},
                    {"type": "theocracy", "label": "神权制"},
                ],
                "alignmentSystem": "modern",
                "powerStructure": "centralized",
            },
            economy={
                "entityTypes": [
                    {"type": "gold", "label": "黄金", "icon": "🪙", "color": "#c9a227"},
                    {
                        "type": "grain",
                        "label": "粮食",
                        "icon": "🌾",
                        "color": "#f59e0b",
                    },
                    {"type": "silk", "label": "丝绸", "icon": "🏺", "color": "#dc2626"},
                    {"type": "land", "label": "土地", "icon": "🏞️", "color": "#059669"},
                ],
                "currencyTypes": [
                    {"type": "coin", "label": "金属货币"},
                    {"type": "note", "label": "纸币"},
                    {"type": "barter", "label": "以物易物"},
                ],
                "resourceTypes": [
                    {"type": "agricultural", "label": "农业资源"},
                    {"type": "mineral", "label": "矿产资源"},
                    {"type": "military", "label": "军事资源"},
                ],
                "tradeMethods": [
                    {"type": "market", "label": "集市贸易"},
                    {"type": "trade_route", "label": "商路贸易"},
                    {"type": "tribute", "label": "朝贡体系"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#c9a227",
            secondaryColor="#059669",
            accentColor="#dc2626",
            backgroundGradient="linear-gradient(135deg, #c9a227 0%, #059669 50%, #dc2626 100%)",
            fontFamily="Noto Serif SC, serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "causal",
                "description": "王朝更迭与政治实体变化关联",
                "confidence": 0.95,
            }
        ],
        "presets": [
            {
                "id": "historical-default",
                "name": "标准历史",
                "description": "包含标准历史元素的预设",
                "icon": "📜",
            }
        ],
        "is_system": True,
    },
    "western": {
        "id": "western-default",
        "type": WorldviewType.WESTERN,
        "name": "标准西方奇幻世界",
        "description": "魔法、骑士、龙与地下城的西方奇幻世界",
        "timeScale": TimeScale.MEDIEVAL,
        "techLevel": TechLevel.MEDIEVAL,
        "magicLevel": MagicLevel.MEDIUM,
        "politicalComplexity": ComplexityLevel.COMPLEX,
        "economicSystem": EconomicSystemType.FEUDAL,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "year",
                "eventTypes": [
                    {
                        "type": "magic_discovery",
                        "label": "魔法发现",
                        "icon": "✨",
                        "color": "#8b5cf6",
                    },
                    {
                        "type": "dragon_attack",
                        "label": "龙袭",
                        "icon": "🐉",
                        "color": "#dc2626",
                    },
                    {
                        "type": "kingdom_founding",
                        "label": "王国建立",
                        "icon": "🏰",
                        "color": "#c9a227",
                    },
                    {
                        "type": "crusade",
                        "label": "圣战",
                        "icon": "⚔️",
                        "color": "#f59e0b",
                    },
                ],
                "eraThemes": [
                    {"theme": "first_age", "label": "第一纪元", "color": "#8b5cf6"},
                    {"theme": "middle_ages", "label": "中世纪", "color": "#64748b"},
                    {"theme": "modern_ages", "label": "近代", "color": "#c9a227"},
                ],
                "timelineStyle": "linear",
                "recordingMethod": "chronicle",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "kingdom",
                        "label": "人类王国",
                        "icon": "👑",
                        "color": "#c9a227",
                    },
                    {
                        "type": "elven_realm",
                        "label": "精灵王国",
                        "icon": "🧝",
                        "color": "#10b981",
                    },
                    {
                        "type": "dwarven_hold",
                        "label": "矮人堡垒",
                        "icon": "⛏️",
                        "color": "#dc2626",
                    },
                    {
                        "type": "dragon_lair",
                        "label": "龙巢",
                        "icon": "🐉",
                        "color": "#8b5cf6",
                    },
                ],
                "governmentTypes": [
                    {"type": "feudal", "label": "封建制"},
                    {"type": "monarchy", "label": "君主制"},
                    {"type": "council", "label": "议会制"},
                    {"type": "theocracy", "label": "神权制"},
                ],
                "alignmentSystem": "dnd",
                "powerStructure": "decentralized",
            },
            economy={
                "entityTypes": [
                    {
                        "type": "gold_coin",
                        "label": "金币",
                        "icon": "🪙",
                        "color": "#c9a227",
                    },
                    {
                        "type": "magic_scroll",
                        "label": "魔法卷轴",
                        "icon": "📜",
                        "color": "#8b5cf6",
                    },
                    {
                        "type": "weapon",
                        "label": "武器装备",
                        "icon": "⚔️",
                        "color": "#64748b",
                    },
                    {
                        "type": "potion",
                        "label": "药水",
                        "icon": "🧪",
                        "color": "#10b981",
                    },
                ],
                "currencyTypes": [
                    {"type": "gold_coin", "label": "金币"},
                    {"type": "silver_coin", "label": "银币"},
                    {"type": "barter", "label": "以物易物"},
                ],
                "resourceTypes": [
                    {"type": "metal", "label": "金属矿"},
                    {"type": "magical", "label": "魔法材料"},
                    {"type": "herbal", "label": "草药"},
                ],
                "tradeMethods": [
                    {"type": "market", "label": "市场交易"},
                    {"type": "auction", "label": "拍卖"},
                    {"type": "guild", "label": "公会交易"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#8b5cf6",
            secondaryColor="#c9a227",
            accentColor="#dc2626",
            backgroundGradient="linear-gradient(135deg, #8b5cf6 0%, #c9a227 50%, #dc2626 100%)",
            fontFamily=" serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "causal",
                "description": "王国建立与政治实体关联",
                "confidence": 0.9,
            }
        ],
        "presets": [
            {
                "id": "western-default",
                "name": "标准西幻",
                "description": "包含标准西幻元素的预设",
                "icon": "⚔️",
            }
        ],
        "is_system": True,
    },
    "modern": {
        "id": "modern-default",
        "type": WorldviewType.MODERN,
        "name": "标准现代世界",
        "description": "当代社会、科技文明的现代世界",
        "timeScale": TimeScale.MODERN,
        "techLevel": TechLevel.INFORMATION,
        "magicLevel": MagicLevel.NONE,
        "politicalComplexity": ComplexityLevel.HIGHLY_COMPLEX,
        "economicSystem": EconomicSystemType.CAPITALIST,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "year",
                "eventTypes": [
                    {
                        "type": "technological_breakthrough",
                        "label": "科技突破",
                        "icon": "🔬",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "economic_crisis",
                        "label": "经济危机",
                        "icon": "📉",
                        "color": "#dc2626",
                    },
                    {
                        "type": "election",
                        "label": "选举",
                        "icon": "🗳️",
                        "color": "#059669",
                    },
                    {
                        "type": "treaty",
                        "label": "国际条约",
                        "icon": "📜",
                        "color": "#64748b",
                    },
                ],
                "eraThemes": [
                    {"theme": "industrial", "label": "工业时代", "color": "#64748b"},
                    {"theme": "information", "label": "信息时代", "color": "#0ea5e9"},
                    {"theme": "digital", "label": "数字时代", "color": "#7c3aed"},
                ],
                "timelineStyle": "linear",
                "recordingMethod": "digital",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "nation",
                        "label": "民族国家",
                        "icon": "🏳️",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "corporation",
                        "label": "跨国公司",
                        "icon": "🏢",
                        "color": "#64748b",
                    },
                    {
                        "type": "ngo",
                        "label": "非政府组织",
                        "icon": "🏛️",
                        "color": "#059669",
                    },
                    {
                        "type": "bloc",
                        "label": "国际集团",
                        "icon": "🌐",
                        "color": "#7c3aed",
                    },
                ],
                "governmentTypes": [
                    {"type": "democracy", "label": "民主制"},
                    {"type": "autocracy", "label": "独裁制"},
                    {"type": "monarchy", "label": "君主立宪制"},
                    {"type": "communist", "label": "共产主义制"},
                ],
                "alignmentSystem": "modern",
                "powerStructure": "federal",
            },
            economy={
                "entityTypes": [
                    {
                        "type": "currency",
                        "label": "法定货币",
                        "icon": "💵",
                        "color": "#059669",
                    },
                    {
                        "type": "stock",
                        "label": "股票",
                        "icon": "📈",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "crypto",
                        "label": "加密货币",
                        "icon": "₿",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "commodity",
                        "label": "大宗商品",
                        "icon": "🛢️",
                        "color": "#64748b",
                    },
                ],
                "currencyTypes": [
                    {"type": "fiat", "label": "法定货币"},
                    {"type": "digital", "label": "数字货币"},
                    {"type": "crypto", "label": "加密货币"},
                ],
                "resourceTypes": [
                    {"type": "energy", "label": "能源"},
                    {"type": "data", "label": "数据"},
                    {"type": "labor", "label": "劳动力"},
                ],
                "tradeMethods": [
                    {"type": "stock_exchange", "label": "证券交易"},
                    {"type": "forex", "label": "外汇交易"},
                    {"type": "e_commerce", "label": "电子商务"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#0ea5e9",
            secondaryColor="#64748b",
            accentColor="#7c3aed",
            backgroundGradient="linear-gradient(135deg, #0ea5e9 0%, #64748b 50%, #7c3aed 100%)",
            fontFamily="Inter, system-ui, sans-serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "correlated",
                "description": "选举与政治变化关联",
                "confidence": 0.85,
            }
        ],
        "presets": [
            {
                "id": "modern-default",
                "name": "标准现代",
                "description": "包含标准现代元素的预设",
                "icon": "🏙️",
            }
        ],
        "is_system": True,
    },
    "scifi": {
        "id": "scifi-default",
        "type": WorldviewType.SCIFI,
        "name": "标准科幻世界",
        "description": "高科技的星际文明世界，包含人工智能、星际旅行等元素",
        "timeScale": TimeScale.FUTURE,
        "techLevel": TechLevel.ADVANCED,
        "magicLevel": MagicLevel.NONE,
        "politicalComplexity": ComplexityLevel.HIGHLY_COMPLEX,
        "economicSystem": EconomicSystemType.POST_SCARCITY,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "epoch",
                "eventTypes": [
                    {
                        "type": "technological_breakthrough",
                        "label": "科技突破",
                        "icon": "🔬",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "first_contact",
                        "label": "首次接触",
                        "icon": "👽",
                        "color": "#10b981",
                    },
                    {
                        "type": "ai_awakening",
                        "label": "AI觉醒",
                        "icon": "🤖",
                        "color": "#64748b",
                    },
                    {
                        "type": "interstellar_war",
                        "label": "星际战争",
                        "icon": "🚀",
                        "color": "#dc2626",
                    },
                ],
                "eraThemes": [
                    {"theme": "space_age", "label": "太空时代", "color": "#0ea5e9"},
                    {"theme": "ai_dominance", "label": "AI主导", "color": "#64748b"},
                    {
                        "theme": "galactic_empire",
                        "label": "银河帝国",
                        "color": "#7c3aed",
                    },
                ],
                "timelineStyle": "linear",
                "recordingMethod": "digital",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "stellar_empire",
                        "label": "星际帝国",
                        "icon": "👑",
                        "color": "#7c3aed",
                    },
                    {
                        "type": "corporate_alliance",
                        "label": "企业联盟",
                        "icon": "🏢",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "ai_governance",
                        "label": "AI治理",
                        "icon": "🤖",
                        "color": "#64748b",
                    },
                    {
                        "type": "rebel_faction",
                        "label": "反抗组织",
                        "icon": "⚔️",
                        "color": "#dc2626",
                    },
                ],
                "governmentTypes": [
                    {"type": "technocracy", "label": "技术官僚制"},
                    {"type": "corporate_oligarchy", "label": "企业寡头制"},
                    {"type": "ai_demarchy", "label": "AI抽签制"},
                ],
                "alignmentSystem": "modern",
                "powerStructure": "federal",
            },
            economy={
                "entityTypes": [
                    {
                        "type": "energy_credit",
                        "label": "能量信用",
                        "icon": "⚡",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "nanomaterial",
                        "label": "纳米材料",
                        "icon": "🔬",
                        "color": "#64748b",
                    },
                    {
                        "type": "data_asset",
                        "label": "数据资产",
                        "icon": "💾",
                        "color": "#0ea5e9",
                    },
                    {
                        "type": "intellectual_property",
                        "label": "知识产权",
                        "icon": "📜",
                        "color": "#7c3aed",
                    },
                ],
                "currencyTypes": [
                    {"type": "digital_credit", "label": "数字信用"},
                    {"type": "energy_unit", "label": "能量单位"},
                    {"type": "reputation", "label": "声誉积分"},
                ],
                "resourceTypes": [
                    {"type": "energy", "label": "能源"},
                    {"type": "computational", "label": "计算资源"},
                    {"type": "biological", "label": "生物资源"},
                ],
                "tradeMethods": [
                    {"type": "quantum_exchange", "label": "量子交易"},
                    {"type": "ai_negotiation", "label": "AI协商"},
                    {"type": "reputation_based", "label": "声誉交易"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#0ea5e9",
            secondaryColor="#64748b",
            accentColor="#7c3aed",
            backgroundGradient="linear-gradient(135deg, #0ea5e9 0%, #64748b 50%, #7c3aed 100%)",
            fontFamily="Inter, system-ui, sans-serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "causal",
                "description": "科技突破与政治格局变化关联",
                "confidence": 0.9,
            }
        ],
        "presets": [
            {
                "id": "scifi-default",
                "name": "标准科幻",
                "description": "包含标准科幻元素的预设",
                "icon": "🚀",
            }
        ],
        "is_system": True,
    },
    "apocalypse": {
        "id": "apocalypse-default",
        "type": WorldviewType.APOCALYPSE,
        "name": "标准末世世界",
        "description": "灾难后世界、生存斗争的末世设定",
        "timeScale": TimeScale.MODERN,
        "techLevel": TechLevel.INDUSTRIAL,
        "magicLevel": MagicLevel.NONE,
        "politicalComplexity": ComplexityLevel.SIMPLE,
        "economicSystem": EconomicSystemType.BARTER,
        "moduleConfigs": ModuleConfigs(
            history={
                "timeUnit": "year",
                "eventTypes": [
                    {
                        "type": "catastrophe",
                        "label": "灾难爆发",
                        "icon": "💥",
                        "color": "#dc2626",
                    },
                    {
                        "type": "collapse",
                        "label": "文明崩溃",
                        "icon": "🏚️",
                        "color": "#64748b",
                    },
                    {
                        "type": "faction_formation",
                        "label": "势力形成",
                        "icon": "⚔️",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "recovery_attempt",
                        "label": "重建尝试",
                        "icon": "🔧",
                        "color": "#10b981",
                    },
                ],
                "eraThemes": [
                    {"theme": "outbreak", "label": "爆发期", "color": "#dc2626"},
                    {"theme": "dark_ages", "label": "黑暗时代", "color": "#64748b"},
                    {"theme": "rebuilding", "label": "重建期", "color": "#10b981"},
                ],
                "timelineStyle": "linear",
                "recordingMethod": "oral",
            },
            politics={
                "entityTypes": [
                    {
                        "type": "survivor_group",
                        "label": "幸存者团体",
                        "icon": "👥",
                        "color": "#10b981",
                    },
                    {
                        "type": "raider_band",
                        "label": "掠夺者",
                        "icon": "💀",
                        "color": "#dc2626",
                    },
                    {
                        "type": "settlement",
                        "label": "定居点",
                        "icon": "🏕️",
                        "color": "#f59e0b",
                    },
                    {
                        "type": "trade_caravan",
                        "label": "商队",
                        "icon": "🐪",
                        "color": "#059669",
                    },
                ],
                "governmentTypes": [
                    {"type": "tribal", "label": "部落制"},
                    {"type": "warlord", "label": "军阀制"},
                    {"type": "council", "label": "议会制"},
                    {"type": "anarchy", "label": "无政府"},
                ],
                "alignmentSystem": "faction",
                "powerStructure": "decentralized",
            },
            economy={
                "entityTypes": [
                    {"type": "food", "label": "食物", "icon": "🍖", "color": "#f59e0b"},
                    {
                        "type": "water",
                        "label": "水源",
                        "icon": "💧",
                        "color": "#0ea5e9",
                    },
                    {"type": "ammo", "label": "弹药", "icon": "🔫", "color": "#64748b"},
                    {
                        "type": "medicine",
                        "label": "药品",
                        "icon": "💊",
                        "color": "#10b981",
                    },
                ],
                "currencyTypes": [
                    {"type": "barter", "label": "以物易物"},
                    {"type": "scrip", "label": "代币"},
                    {"type": "bullets", "label": "子弹货币"},
                ],
                "resourceTypes": [
                    {"type": "food", "label": "食物"},
                    {"type": "water", "label": "水源"},
                    {"type": "medical", "label": "医疗"},
                    {"type": "ammo", "label": "弹药"},
                ],
                "tradeMethods": [
                    {"type": "barter", "label": "以物易物"},
                    {"type": "auction", "label": "拍卖"},
                    {"type": "black_market", "label": "黑市交易"},
                ],
            },
        ),
        "theme": WorldviewTheme(
            primaryColor="#dc2626",
            secondaryColor="#64748b",
            accentColor="#f59e0b",
            backgroundGradient="linear-gradient(135deg, #dc2626 0%, #64748b 50%, #f59e0b 100%)",
            fontFamily="Inter, system-ui, sans-serif",
        ),
        "adaptationRules": [
            {
                "sourceModule": "history",
                "targetModule": "politics",
                "relationType": "causal",
                "description": "势力形成与政治实体关联",
                "confidence": 0.85,
            }
        ],
        "presets": [
            {
                "id": "apocalypse-default",
                "name": "标准末世",
                "description": "包含标准末世元素的预设",
                "icon": "☢️",
            }
        ],
        "is_system": True,
    },
}


def _check_template_name_exists(
    db: Session,
    name: str,
    project_id: Optional[str] = None,
    exclude_id: Optional[str] = None,
) -> None:
    """
    检查世界模板名称是否已存在

    Args:
        db: 数据库会话
        name: 模板名称
        project_id: 项目ID（可选，用于区分不同项目下的模板）
        exclude_id: 排除的模板ID（用于更新时排除自身）

    Raises:
        HTTPException: 如果名称已存在则抛出 400 错误
    """
    query = db.query(WorldTemplate).filter(WorldTemplate.name == name)

    if exclude_id:
        query = query.filter(WorldTemplate.id != exclude_id)

    if project_id:
        query = query.filter(WorldTemplate.project_id == project_id)
    else:
        query = query.filter(WorldTemplate.project_id.is_(None))

    existing = query.first()
    if existing:
        raise HTTPException(status_code=400, detail="世界模板名称已存在")


def load_template_modules_with_selectinload(template_id: str, db: Session):
    """使用selectinload优化加载模板的模块、子模块和项"""
    try:
        # 第一步：加载所有模块及其子模块
        modules = (
            db.query(WorldModule)
            .filter(WorldModule.template_id == template_id)
            .options(selectinload(WorldModule.submodules))
            .order_by(WorldModule.order_index)
            .all()
        )

        if not modules:
            return []

        # 第二步：批量加载所有模块的项（不属于子模块的）
        module_ids = [module.id for module in modules]
        module_items = (
            db.query(WorldModuleItem)
            .filter(
                WorldModuleItem.module_id.in_(module_ids),
                WorldModuleItem.submodule_id.is_(None),
            )
            .all()
        )

        # 将模块项分配到对应的模块
        module_items_map = {}
        for item in module_items:
            if item.module_id not in module_items_map:
                module_items_map[item.module_id] = []
            module_items_map[item.module_id].append(item)

        # 第三步：批量加载所有子模块的项
        all_submodule_ids = []
        for module in modules:
            if module.submodules:
                all_submodule_ids.extend(
                    [submodule.id for submodule in module.submodules]
                )

        if all_submodule_ids:
            submodule_items = (
                db.query(WorldModuleItem)
                .filter(WorldModuleItem.submodule_id.in_(all_submodule_ids))
                .all()
            )

            # 将子模块项分配到对应的子模块
            submodule_items_map = {}
            for item in submodule_items:
                if item.submodule_id not in submodule_items_map:
                    submodule_items_map[item.submodule_id] = []
                submodule_items_map[item.submodule_id].append(item)

            # 为每个子模块设置items
            for module in modules:
                if module.submodules:
                    for submodule in module.submodules:
                        submodule.items = submodule_items_map.get(submodule.id, [])

        # 为每个模块设置items（不属于子模块的）
        for module in modules:
            module.items = module_items_map.get(module.id, [])

        return modules

    except SQLAlchemyError as e:
        logger.error(f"Database error loading template modules: {str(e)}")
        raise

    except Exception as e:
        logger.error(f"Unexpected error loading template modules: {str(e)}")
        raise


# --- 世界模板 API ---


@router.post("/templates", response_model=WorldTemplateResponse)
def create_world_template(
    template_data: WorldTemplateCreate, db: Session = Depends(get_db)
):
    """创建新的世界模板"""
    logger.info(f"Creating world template: {template_data.name}")

    try:
        _check_template_name_exists(db, template_data.name, template_data.project_id)

        template = WorldTemplate(id=str(uuid.uuid4()), **template_data.model_dump())

        db.add(template)
        db.commit()
        db.refresh(template)

        logger.info(f"World template created: {template.id}")
        return template

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating world template: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界模板时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating world template: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界模板时发生未知错误")


@router.get("/templates", response_model=List[WorldTemplateResponse])
def get_world_templates(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    is_public: Optional[bool] = None,
    is_system_template: Optional[bool] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取世界模板列表"""
    logger.info(f"Getting world templates - skip={skip}, limit={limit}")

    query = db.query(WorldTemplate)

    if name:
        query = query.filter(WorldTemplate.name.ilike(f"%{name}%"))
    if is_public is not None:
        query = query.filter(WorldTemplate.is_public == is_public)
    if is_system_template is not None:
        query = query.filter(WorldTemplate.is_system_template == is_system_template)
    if project_id is not None:
        query = query.filter(WorldTemplate.project_id == project_id)

    templates = query.offset(skip).limit(limit).all()

    # 计算模块和实例数量
    for template in templates:
        template.module_count = (
            db.query(WorldModule).filter(WorldModule.template_id == template.id).count()
        )
        template.instance_count = (
            db.query(WorldInstance)
            .filter(WorldInstance.template_id == template.id)
            .count()
        )

    logger.debug(f"Found {len(templates)} templates")
    return templates


@router.post("/templates/search", response_model=List[WorldTemplateResponse])
def search_world_templates(
    filter_data: WorldTemplateFilter,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """高级搜索世界模板"""
    logger.info(f"Searching world templates with filter: {filter_data.model_dump()}")

    query = db.query(WorldTemplate)

    # 应用筛选条件
    if filter_data.name:
        query = query.filter(WorldTemplate.name.ilike(f"%{filter_data.name}%"))

    if filter_data.tags:
        # 支持多标签筛选，使用JSON数组包含查询
        for tag in filter_data.tags:
            query = query.filter(WorldTemplate.tags.contains([tag]))

    if filter_data.is_public is not None:
        query = query.filter(WorldTemplate.is_public == filter_data.is_public)

    if filter_data.is_system_template is not None:
        query = query.filter(
            WorldTemplate.is_system_template == filter_data.is_system_template
        )

    if filter_data.created_by:
        query = query.filter(WorldTemplate.created_by == filter_data.created_by)
    if filter_data.project_id:
        query = query.filter(WorldTemplate.project_id == filter_data.project_id)

    templates = query.offset(skip).limit(limit).all()

    # 计算模块和实例数量
    for template in templates:
        template.module_count = (
            db.query(WorldModule).filter(WorldModule.template_id == template.id).count()
        )
        template.instance_count = (
            db.query(WorldInstance)
            .filter(WorldInstance.template_id == template.id)
            .count()
        )

    logger.debug(f"Found {len(templates)} templates matching filter")
    return templates


@router.get("/templates/{template_id}", response_model=WorldTemplateWithModules)
def get_world_template(
    template_id: str, include_modules: bool = True, db: Session = Depends(get_db)
):
    """获取特定世界模板的详细信息"""
    logger.info(f"Getting world template: {template_id}")

    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    if include_modules:
        try:
            # 使用优化的selectinload加载策略，避免笛卡尔积
            modules = load_template_modules_with_selectinload(template_id, db)

            template_modules = []
            for module in modules:
                # 子模块已经通过selectinload加载
                submodules = module.submodules

                # 模块项（不属于任何子模块的）
                items = [item for item in module.items if item.submodule_id is None]

                # 为子模块添加项
                submodule_with_items = []
                for submodule in submodules:
                    # 子模块的项已经通过批量加载
                    submodule_items = submodule.items

                    submodule_with_items.append(
                        WorldSubmoduleWithItems(
                            id=submodule.id,
                            module_id=submodule.module_id,
                            name=submodule.name,
                            description=submodule.description,
                            order_index=submodule.order_index,
                            color=submodule.color,
                            icon=submodule.icon,
                            created_at=submodule.created_at,
                            updated_at=submodule.updated_at,
                            item_count=len(submodule_items),
                            items=submodule_items,
                        )
                    )

                template_modules.append(
                    WorldModuleWithItems(
                        id=module.id,
                        template_id=module.template_id,
                        module_type=module.module_type,
                        name=module.name,
                        description=module.description,
                        icon=module.icon,
                        order_index=module.order_index,
                        is_collapsible=module.is_collapsible,
                        is_required=module.is_required,
                        created_at=module.created_at,
                        updated_at=module.updated_at,
                        submodule_count=len(submodules),
                        item_count=len(items),
                        submodules=submodule_with_items,
                        items=items,
                    )
                )

            return WorldTemplateWithModules(
                id=template.id,
                name=template.name,
                description=template.description,
                cover_image=template.cover_image,
                tags=template.tags,
                is_public=template.is_public,
                is_system_template=template.is_system_template,
                created_at=template.created_at,
                updated_at=template.updated_at,
                created_by=template.created_by,
                module_count=len(modules),
                instance_count=(
                    template.instance_count
                    if hasattr(template, "instance_count")
                    else 0
                ),
                modules=template_modules,
            )

        except Exception as e:
            logger.error(f"Error loading template modules: {str(e)}")
            # 如果模块加载失败，返回基础模板信息
            return template

    return template


@router.put("/templates/{template_id}", response_model=WorldTemplateResponse)
def update_world_template(
    template_id: str, template_data: WorldTemplateUpdate, db: Session = Depends(get_db)
):
    """更新世界模板"""
    logger.info(f"Updating world template: {template_id}")

    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    new_name = template_data.name if template_data.name is not None else template.name
    new_project_id = (
        template_data.project_id
        if template_data.project_id is not None
        else template.project_id
    )

    if new_name != template.name or template_data.project_id is not None:
        _check_template_name_exists(
            db, new_name, new_project_id, exclude_id=template_id
        )

    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    logger.info(f"World template updated: {template_id}")
    return template


@router.delete("/templates/{template_id}")
def delete_world_template(template_id: str, db: Session = Depends(get_db)):
    """删除世界模板"""
    logger.info(f"Deleting world template: {template_id}")

    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    # 检查是否有实例在使用此模板
    instance_count = (
        db.query(WorldInstance).filter(WorldInstance.template_id == template_id).count()
    )
    if instance_count > 0:
        raise HTTPException(status_code=400, detail="无法删除正在使用的世界模板")

    db.delete(template)
    db.commit()

    logger.info(f"World template deleted: {template_id}")
    return {"message": "世界模板删除成功"}


# --- 世界模块 API ---


@router.post("/templates/{template_id}/modules", response_model=WorldModuleResponse)
def create_world_module(
    template_id: str, module_data: WorldModuleCreate, db: Session = Depends(get_db)
):
    """为世界模板创建模块"""
    logger.info(f"Creating world module for template: {template_id}")

    # 检查模板是否存在
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    # 检查模块类型是否重复
    existing = (
        db.query(WorldModule)
        .filter(
            WorldModule.template_id == template_id,
            WorldModule.module_type == module_data.module_type,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="该模块类型已存在")

    module = WorldModule(
        id=str(uuid.uuid4()), template_id=template_id, **module_data.model_dump()
    )

    db.add(module)
    db.commit()
    db.refresh(module)

    logger.info(f"World module created: {module.id}")
    return module


@router.get(
    "/templates/{template_id}/modules", response_model=List[WorldModuleResponse]
)
def get_world_modules(template_id: str, db: Session = Depends(get_db)):
    """获取世界模板的所有模块"""
    logger.info(f"Getting world modules for template: {template_id}")

    modules = (
        db.query(WorldModule)
        .filter(WorldModule.template_id == template_id)
        .order_by(WorldModule.order_index)
        .all()
    )

    # 计算子模块和项的数量
    for module in modules:
        module.submodule_count = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.module_id == module.id)
            .count()
        )
        module.item_count = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.module_id == module.id)
            .count()
        )

    logger.debug(f"Found {len(modules)} modules")
    return modules


@router.put("/modules/{module_id}", response_model=WorldModuleResponse)
def update_world_module(
    module_id: str, module_data: WorldModuleUpdate, db: Session = Depends(get_db)
):
    """更新世界模块"""
    logger.info(f"Updating world module: {module_id}")

    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    # 检查模块类型是否重复（如果修改了类型）
    if module_data.module_type and module_data.module_type != module.module_type:
        existing = (
            db.query(WorldModule)
            .filter(
                WorldModule.template_id == module.template_id,
                WorldModule.module_type == module_data.module_type,
                WorldModule.id != module_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="该模块类型已存在")

    update_data = module_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(module, field, value)

    db.commit()
    db.refresh(module)

    logger.info(f"World module updated: {module_id}")
    return module


# --- 子模块 API ---


@router.post("/modules/{module_id}/submodules", response_model=WorldSubmoduleResponse)
def create_world_submodule(
    module_id: str, submodule_data: WorldSubmoduleCreate, db: Session = Depends(get_db)
):
    """为世界模块创建子模块"""
    logger.info(f"Creating world submodule for module: {module_id}")

    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    submodule = WorldSubmodule(
        id=str(uuid.uuid4()), module_id=module_id, **submodule_data.model_dump()
    )

    db.add(submodule)
    db.commit()
    db.refresh(submodule)

    logger.info(f"World submodule created: {submodule.id}")
    return submodule


@router.get(
    "/modules/{module_id}/submodules", response_model=List[WorldSubmoduleResponse]
)
def get_world_submodules(
    module_id: str,
    parent_id: Optional[str] = Query(
        None, description="父级子模块ID，用于过滤特定父级的子模块"
    ),
    db: Session = Depends(get_db),
):
    """获取世界模块的所有子模块"""
    logger.info(
        f"Getting world submodules for module: {module_id}, parent_id: {parent_id}"
    )

    query = db.query(WorldSubmodule).filter(WorldSubmodule.module_id == module_id)

    if parent_id is not None:
        query = query.filter(WorldSubmodule.parent_id == parent_id)

    submodules = query.order_by(WorldSubmodule.order_index).all()

    for submodule in submodules:
        submodule.item_count = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.submodule_id == submodule.id)
            .count()
        )

    logger.debug(f"Found {len(submodules)} submodules")
    return submodules


# --- 模块项 API ---


@router.post("/modules/{module_id}/items", response_model=WorldModuleItemResponse)
def create_world_module_item(
    module_id: str, item_data: WorldModuleItemCreate, db: Session = Depends(get_db)
):
    """为世界模块创建项"""
    logger.info(f"Creating world module item for module: {module_id}")

    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id:
        submodule = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.id == item_data.submodule_id)
            .first()
        )
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")

    item = WorldModuleItem(
        id=str(uuid.uuid4()), module_id=module_id, **item_data.model_dump()
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(f"World module item created: {item.id}")
    return item


@router.get("/modules/{module_id}/items", response_model=List[WorldModuleItemResponse])
def get_world_module_items(
    module_id: str,
    submodule_id: Optional[str] = None,
    include_all: bool = False,
    db: Session = Depends(get_db),
):
    """获取世界模块的项"""
    logger.info(f"Getting world module items for module: {module_id}")

    query = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module_id)

    if not include_all:
        if submodule_id:
            query = query.filter(WorldModuleItem.submodule_id == submodule_id)
        else:
            query = query.filter(WorldModuleItem.submodule_id.is_(None))

    items = query.order_by(WorldModuleItem.order_index).all()
    logger.debug(f"Found {len(items)} items")
    return items


@router.put("/items/{item_id}", response_model=WorldModuleItemResponse)
def update_world_module_item(
    item_id: str, item_data: WorldModuleItemUpdate, db: Session = Depends(get_db)
):
    """更新模块项"""
    logger.info(f"Updating world module item: {item_id}")

    item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="模块项不存在")

    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id and item_data.submodule_id != item.submodule_id:
        submodule = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.id == item_data.submodule_id)
            .first()
        )
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    logger.info(f"World module item updated: {item_id}")
    return item


@router.delete("/items/{item_id}")
def delete_world_module_item(item_id: str, db: Session = Depends(get_db)):
    """删除模块项"""
    logger.info(f"Deleting world module item: {item_id}")

    item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="模块项不存在")

    db.delete(item)
    db.commit()

    logger.info(f"World module item deleted: {item_id}")
    return {"message": "模块项删除成功"}


@router.put("/submodules/{submodule_id}", response_model=WorldSubmoduleResponse)
def update_world_submodule(
    submodule_id: str,
    submodule_data: WorldSubmoduleUpdate,
    db: Session = Depends(get_db),
):
    """更新子模块"""
    logger.info(f"Updating world submodule: {submodule_id}")

    submodule = (
        db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
    )
    if not submodule:
        raise HTTPException(status_code=404, detail="子模块不存在")

    update_data = submodule_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(submodule, field, value)

    db.commit()
    db.refresh(submodule)

    logger.info(f"World submodule updated: {submodule_id}")
    return submodule


@router.delete("/submodules/{submodule_id}")
def delete_world_submodule(submodule_id: str, db: Session = Depends(get_db)):
    """删除子模块（级联删除关联的项）"""
    logger.info(f"Deleting world submodule: {submodule_id}")

    submodule = (
        db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
    )
    if not submodule:
        raise HTTPException(status_code=404, detail="子模块不存在")

    db.delete(submodule)
    db.commit()

    logger.info(f"World submodule deleted: {submodule_id}")
    return {"message": "子模块删除成功"}


@router.delete("/modules/{module_id}")
def delete_world_module(module_id: str, db: Session = Depends(get_db)):
    """删除世界模块"""
    logger.info(f"Deleting world module: {module_id}")

    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    # 检查是否有子模块或项关联到此模块
    submodule_count = (
        db.query(WorldSubmodule).filter(WorldSubmodule.module_id == module_id).count()
    )
    item_count = (
        db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module_id).count()
    )

    if submodule_count > 0 or item_count > 0:
        raise HTTPException(status_code=400, detail="无法删除包含子模块或项的模块")

    db.delete(module)
    db.commit()

    logger.info(f"World module deleted: {module_id}")
    return {"message": "世界模块删除成功"}


# --- 世界实例 API ---


@router.post("/instances", response_model=WorldInstanceResponse)
def create_world_instance(
    instance_data: WorldInstanceCreate, db: Session = Depends(get_db)
):
    """基于模板创建世界实例"""
    logger.info(f"Creating world instance from template: {instance_data.template_id}")

    try:
        # 检查模板是否存在
        template = (
            db.query(WorldTemplate)
            .filter(WorldTemplate.id == instance_data.template_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="世界模板不存在")

        # 检查项目是否存在
        project = (
            db.query(Project).filter(Project.id == instance_data.project_id).first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        instance = WorldInstance(id=str(uuid.uuid4()), **instance_data.model_dump())

        db.add(instance)
        db.commit()
        db.refresh(instance)

        logger.info(f"World instance created: {instance.id}")
        return instance

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating world instance: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界实例时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating world instance: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界实例时发生未知错误")


@router.get(
    "/projects/{project_id}/instances", response_model=List[WorldInstanceResponse]
)
def get_project_world_instances(project_id: str, db: Session = Depends(get_db)):
    """获取项目的所有世界实例"""
    logger.info(f"Getting world instances for project: {project_id}")

    instances = (
        db.query(WorldInstance)
        .filter(WorldInstance.project_id == project_id)
        .order_by(WorldInstance.created_at.desc())
        .all()
    )

    logger.debug(f"Found {len(instances)} instances")
    return instances


@router.put("/instances/{instance_id}", response_model=WorldInstanceResponse)
def update_world_instance(
    instance_id: str, instance_data: WorldInstanceUpdate, db: Session = Depends(get_db)
):
    """更新世界实例"""
    logger.info(f"Updating world instance: {instance_id}")

    instance = db.query(WorldInstance).filter(WorldInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="世界实例不存在")

    update_data = instance_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(instance, field, value)

    db.commit()
    db.refresh(instance)

    logger.info(f"World instance updated: {instance_id}")
    return instance


@router.delete("/instances/{instance_id}")
def delete_world_instance(instance_id: str, db: Session = Depends(get_db)):
    """删除世界实例"""
    logger.info(f"Deleting world instance: {instance_id}")

    instance = db.query(WorldInstance).filter(WorldInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="世界实例不存在")

    db.delete(instance)
    db.commit()

    logger.info(f"World instance deleted: {instance_id}")
    return {"message": "世界实例删除成功"}


# --- 导入/导出 API ---


@router.get("/templates/{template_id}/export", response_model=WorldTemplateExport)
def export_world_template(template_id: str, db: Session = Depends(get_db)):
    """导出世界模板"""
    logger.info(f"Exporting world template: {template_id}")

    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    try:
        # 使用优化的selectinload加载策略，避免笛卡尔积
        modules = load_template_modules_with_selectinload(template_id, db)

        template_modules = []
        for module in modules:
            # 子模块已经通过selectinload加载
            submodules = module.submodules

            # 模块项（不属于任何子模块的）
            items = [item for item in module.items if item.submodule_id is None]

            # 为子模块添加项
            submodule_with_items = []
            for submodule in submodules:
                # 子模块的项已经通过批量加载
                submodule_items = submodule.items

                submodule_with_items.append(
                    WorldSubmoduleWithItems(
                        id=submodule.id,
                        module_id=submodule.module_id,
                        name=submodule.name,
                        description=submodule.description,
                        order_index=submodule.order_index,
                        color=submodule.color,
                        icon=submodule.icon,
                        created_at=submodule.created_at,
                        updated_at=submodule.updated_at,
                        item_count=len(submodule_items),
                        items=submodule_items,
                    )
                )

            template_modules.append(
                WorldModuleWithItems(
                    id=module.id,
                    template_id=module.template_id,
                    module_type=module.module_type,
                    name=module.name,
                    description=module.description,
                    icon=module.icon,
                    order_index=module.order_index,
                    is_collapsible=module.is_collapsible,
                    is_required=module.is_required,
                    created_at=module.created_at,
                    updated_at=module.updated_at,
                    submodule_count=len(submodules),
                    item_count=len(items),
                    submodules=submodule_with_items,
                    items=items,
                )
            )

        return WorldTemplateExport(template=template, modules=template_modules)

    except Exception as e:
        logger.error(f"Error loading template modules for export: {str(e)}")
        raise HTTPException(status_code=500, detail="加载模板数据时发生错误")


@router.post("/templates/import", response_model=WorldTemplateResponse)
def import_world_template(
    import_data: WorldTemplateImport, db: Session = Depends(get_db)
):
    """导入世界模板"""
    logger.info(f"Importing world template: {import_data.name}")

    try:
        _check_template_name_exists(db, import_data.name, import_data.project_id)

        template = WorldTemplate(
            id=str(uuid.uuid4()),
            name=import_data.name,
            description=import_data.description,
            is_public=False,
            is_system_template=False,
            project_id=import_data.project_id,
        )

        db.add(template)
        db.flush()  # 获取模板ID

        # 导入模块
        for module_data in import_data.modules:
            module = WorldModule(
                id=str(uuid.uuid4()),
                template_id=template.id,
                **module_data.model_dump(exclude={"submodules", "items"}),
            )
            db.add(module)
            db.flush()

            # 导入子模块
            for submodule_data in module_data.submodules:
                submodule = WorldSubmodule(
                    id=str(uuid.uuid4()),
                    module_id=module.id,
                    **submodule_data.model_dump(exclude={"items"}),
                )
                db.add(submodule)
                db.flush()

                # 导入子模块项
                for item_data in submodule_data.items:
                    item = WorldModuleItem(
                        id=str(uuid.uuid4()),
                        module_id=module.id,
                        submodule_id=submodule.id,
                        **item_data.model_dump(),
                    )
                    db.add(item)

            # 导入模块项
            for item_data in module_data.items:
                item = WorldModuleItem(
                    id=str(uuid.uuid4()), module_id=module.id, **item_data.model_dump()
                )
                db.add(item)

        db.commit()
        db.refresh(template)

        logger.info(f"World template imported: {template.id}")
        return template

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error importing world template: {str(e)}")
        raise HTTPException(status_code=500, detail="导入世界模板时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error importing world template: {str(e)}")
        raise HTTPException(status_code=500, detail="导入世界模板时发生未知错误")


@router.get("/templates/{template_id}/export/file")
def export_world_template_file(template_id: str, db: Session = Depends(get_db)):
    """导出世界模板为可下载的 JSON 文件"""
    logger.info(f"Exporting world template to file: {template_id}")

    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")

    try:
        # 使用现有的加载函数获取完整数据
        modules = load_template_modules_with_selectinload(template_id, db)

        template_modules = []
        for module in modules:
            submodules = module.submodules
            items = [item for item in module.items if item.submodule_id is None]

            submodule_with_items = []
            for submodule in submodules:
                submodule_items = submodule.items

                submodule_with_items.append(
                    {
                        "id": submodule.id,
                        "module_id": submodule.module_id,
                        "name": submodule.name,
                        "description": submodule.description,
                        "order_index": submodule.order_index,
                        "color": submodule.color,
                        "icon": submodule.icon,
                        "created_at": (
                            submodule.created_at.isoformat()
                            if submodule.created_at
                            else None
                        ),
                        "updated_at": (
                            submodule.updated_at.isoformat()
                            if submodule.updated_at
                            else None
                        ),
                        "items": [
                            {
                                "id": item.id,
                                "module_id": item.module_id,
                                "submodule_id": item.submodule_id,
                                "name": item.name,
                                "content": item.content,
                                "order_index": item.order_index,
                                "is_published": item.is_published,
                                "created_at": (
                                    item.created_at.isoformat()
                                    if item.created_at
                                    else None
                                ),
                                "updated_at": (
                                    item.updated_at.isoformat()
                                    if item.updated_at
                                    else None
                                ),
                            }
                            for item in submodule_items
                        ],
                    }
                )

            template_modules.append(
                {
                    "id": module.id,
                    "template_id": module.template_id,
                    "module_type": module.module_type,
                    "name": module.name,
                    "description": module.description,
                    "icon": module.icon,
                    "order_index": module.order_index,
                    "is_collapsible": module.is_collapsible,
                    "is_required": module.is_required,
                    "created_at": (
                        module.created_at.isoformat() if module.created_at else None
                    ),
                    "updated_at": (
                        module.updated_at.isoformat() if module.updated_at else None
                    ),
                    "submodules": submodule_with_items,
                    "items": [
                        {
                            "id": item.id,
                            "module_id": item.module_id,
                            "submodule_id": item.submodule_id,
                            "name": item.name,
                            "content": item.content,
                            "order_index": item.order_index,
                            "is_published": item.is_published,
                            "created_at": (
                                item.created_at.isoformat() if item.created_at else None
                            ),
                            "updated_at": (
                                item.updated_at.isoformat() if item.updated_at else None
                            ),
                        }
                        for item in items
                    ],
                }
            )

        # 构建导出数据
        export_data = {
            "name": template.name,
            "description": template.description,
            "cover_image": template.cover_image,
            "tags": template.tags,
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "modules": template_modules,
        }

        # 转换为 JSON 字符串
        json_content = json.dumps(export_data, ensure_ascii=False, indent=2)

        # 生成文件名
        safe_name = "".join(
            c for c in template.name if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        filename = f"world_{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        logger.info(f"World template exported to file: {filename}")

        return StreamingResponse(
            io.BytesIO(json_content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.error(f"Error exporting world template to file: {str(e)}")
        raise HTTPException(status_code=500, detail="导出世界模板文件时发生错误")


@router.post("/templates/import/file", response_model=WorldTemplateResponse)
async def import_world_template_file(
    file: UploadFile = File(..., description="要导入的 JSON 文件"),
    db: Session = Depends(get_db),
):
    """从 JSON 文件导入世界模板"""
    logger.info(f"Importing world template from file: {file.filename}")

    # 验证文件类型
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="只支持 JSON 文件导入")

    try:
        # 读取文件内容
        content = await file.read()

        # 解析 JSON
        try:
            import_data = json.loads(content.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"JSON 格式错误: {str(e)}")

        # 验证必要字段
        if "name" not in import_data:
            raise HTTPException(status_code=400, detail="导入文件缺少 'name' 字段")
        if "modules" not in import_data or not isinstance(import_data["modules"], list):
            raise HTTPException(
                status_code=400, detail="导入文件缺少 'modules' 字段或格式错误"
            )

        template_name = import_data["name"]
        project_id = import_data.get("project_id")

        _check_template_name_exists(db, template_name, project_id)

        template = WorldTemplate(
            id=str(uuid.uuid4()),
            name=template_name,
            description=import_data.get("description"),
            cover_image=import_data.get("cover_image"),
            tags=import_data.get("tags", []),
            is_public=False,
            is_system_template=False,
            project_id=project_id,
        )

        db.add(template)
        db.flush()

        # 导入模块
        for module_data in import_data["modules"]:
            module = WorldModule(
                id=str(uuid.uuid4()),
                template_id=template.id,
                module_type=module_data.get("module_type", "special"),
                name=module_data.get("name", "未命名模块"),
                description=module_data.get("description"),
                icon=module_data.get("icon"),
                order_index=module_data.get("order_index", 0),
                is_collapsible=module_data.get("is_collapsible", True),
                is_required=module_data.get("is_required", False),
            )
            db.add(module)
            db.flush()

            # 导入子模块
            for submodule_data in module_data.get("submodules", []):
                submodule = WorldSubmodule(
                    id=str(uuid.uuid4()),
                    module_id=module.id,
                    name=submodule_data.get("name", "未命名子模块"),
                    description=submodule_data.get("description"),
                    order_index=submodule_data.get("order_index", 0),
                    color=submodule_data.get("color"),
                    icon=submodule_data.get("icon"),
                )
                db.add(submodule)
                db.flush()

                # 导入子模块项
                for item_data in submodule_data.get("items", []):
                    item = WorldModuleItem(
                        id=str(uuid.uuid4()),
                        module_id=module.id,
                        submodule_id=submodule.id,
                        name=item_data.get("name", "未命名项"),
                        content=item_data.get("content", {}),
                        order_index=item_data.get("order_index", 0),
                        is_published=item_data.get("is_published", True),
                    )
                    db.add(item)

            # 导入模块项（不属于子模块的）
            for item_data in module_data.get("items", []):
                item = WorldModuleItem(
                    id=str(uuid.uuid4()),
                    module_id=module.id,
                    submodule_id=None,
                    name=item_data.get("name", "未命名项"),
                    content=item_data.get("content", {}),
                    order_index=item_data.get("order_index", 0),
                    is_published=item_data.get("is_published", True),
                )
                db.add(item)

        db.commit()
        db.refresh(template)

        logger.info(f"World template imported from file: {template.id}")
        return template

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error importing world template from file: {str(e)}")
        raise HTTPException(
            status_code=500, detail="从文件导入世界模板时发生数据库错误"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error importing world template from file: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"从文件导入世界模板时发生错误: {str(e)}"
        )
    finally:
        await file.close()


# --- 批量操作 API ---


@router.post("/batch/delete")
def batch_delete_world_items(
    delete_request: BatchDeleteRequest, db: Session = Depends(get_db)
):
    """批量删除世界项"""
    logger.info(f"Batch deleting {len(delete_request.ids)} items")

    try:
        deleted_count = 0

        for item_id in delete_request.ids:
            # 尝试删除模板
            template = (
                db.query(WorldTemplate).filter(WorldTemplate.id == item_id).first()
            )
            if template:
                # 检查是否有实例在使用此模板
                instance_count = (
                    db.query(WorldInstance)
                    .filter(WorldInstance.template_id == item_id)
                    .count()
                )
                if instance_count > 0:
                    logger.warning(
                        f"Cannot delete template {item_id}: has {instance_count} instances"
                    )
                    continue

                db.delete(template)
                deleted_count += 1
                continue

            # 尝试删除模块
            module = db.query(WorldModule).filter(WorldModule.id == item_id).first()
            if module:
                # 检查是否有子模块或项关联到此模块
                submodule_count = (
                    db.query(WorldSubmodule)
                    .filter(WorldSubmodule.module_id == item_id)
                    .count()
                )
                item_count = (
                    db.query(WorldModuleItem)
                    .filter(WorldModuleItem.module_id == item_id)
                    .count()
                )

                if submodule_count > 0 or item_count > 0:
                    logger.warning(
                        f"Cannot delete module {item_id}: has {submodule_count} "
                        f"submodules and {item_count} items"
                    )
                    continue

                db.delete(module)
                deleted_count += 1
                continue

            # 尝试删除子模块
            submodule = (
                db.query(WorldSubmodule).filter(WorldSubmodule.id == item_id).first()
            )
            if submodule:
                # 检查是否有项关联到此子模块
                item_count = (
                    db.query(WorldModuleItem)
                    .filter(WorldModuleItem.submodule_id == item_id)
                    .count()
                )

                if item_count > 0:
                    logger.warning(
                        f"Cannot delete submodule {item_id}: has {item_count} items"
                    )
                    continue

                db.delete(submodule)
                deleted_count += 1
                continue

            # 尝试删除模块项
            item = (
                db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
            )
            if item:
                db.delete(item)
                deleted_count += 1
                continue

            logger.warning(f"Item not found: {item_id}")

        db.commit()

        logger.info(
            f"Batch delete completed: {deleted_count}/{len(delete_request.ids)} items deleted"
        )
        return {
            "message": f"成功删除 {deleted_count} 个项",
            "deleted_count": deleted_count,
        }

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during batch delete: {str(e)}")
        raise HTTPException(status_code=500, detail="批量删除时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during batch delete: {str(e)}")
        raise HTTPException(status_code=500, detail="批量删除时发生未知错误")


@router.post("/batch/order")
def batch_update_order(
    order_request: BatchUpdateOrderRequest, db: Session = Depends(get_db)
):
    """批量更新排序"""
    logger.info(f"Batch updating order for {len(order_request.items)} items")

    try:
        updated_count = 0

        for item_data in order_request.items:
            item_id = item_data.get("id")
            order_index = item_data.get("order_index")

            if not item_id or order_index is None:
                logger.warning(f"Invalid item data: {item_data}")
                continue

            # 尝试更新模板排序
            template = (
                db.query(WorldTemplate).filter(WorldTemplate.id == item_id).first()
            )
            if template:
                template.order_index = order_index
                updated_count += 1
                continue

            # 尝试更新模块排序
            module = db.query(WorldModule).filter(WorldModule.id == item_id).first()
            if module:
                module.order_index = order_index
                updated_count += 1
                continue

            # 尝试更新子模块排序
            submodule = (
                db.query(WorldSubmodule).filter(WorldSubmodule.id == item_id).first()
            )
            if submodule:
                submodule.order_index = order_index
                updated_count += 1
                continue

            # 尝试更新模块项排序
            item = (
                db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
            )
            if item:
                item.order_index = order_index
                updated_count += 1
                continue

            logger.warning(f"Item not found for ordering: {item_id}")

        db.commit()

        logger.info(
            f"Batch order update completed: "
            f"{updated_count}/{len(order_request.items)} items updated"
        )
        return {
            "message": f"排序更新成功，更新了 {updated_count} 个项",
            "updated_count": updated_count,
        }

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during batch order update: {str(e)}")
        raise HTTPException(status_code=500, detail="批量排序更新时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during batch order update: {str(e)}")
        raise HTTPException(status_code=500, detail="批量排序更新时发生未知错误")


# --- 世界观配置 API ---


def _check_worldview_name_exists(
    db: Session, name: str, exclude_id: Optional[str] = None
) -> None:
    """检查世界观名称是否已存在"""
    query = db.query(CustomWorldviewConfig).filter(CustomWorldviewConfig.name == name)
    if exclude_id:
        query = query.filter(CustomWorldviewConfig.id != exclude_id)
    existing = query.first()
    if existing:
        raise HTTPException(status_code=400, detail="世界观名称已存在")


def _convert_custom_worldview_to_response(
    custom_wv: CustomWorldviewConfig,
) -> WorldviewConfigResponse:
    """将数据库模型转换为响应 schema"""
    try:
        module_configs = (
            ModuleConfigs(**custom_wv.module_configs)
            if custom_wv.module_configs
            else ModuleConfigs()
        )
    except Exception as e:
        logger.warning(
            f"Invalid module_configs format for worldview {custom_wv.id}: {e}"
        )
        module_configs = ModuleConfigs()

    try:
        theme = (
            WorldviewTheme(**custom_wv.theme) if custom_wv.theme else WorldviewTheme()
        )
    except Exception as e:
        logger.warning(f"Invalid theme format for worldview {custom_wv.id}: {e}")
        theme = WorldviewTheme()

    try:
        adaptation_rules = (
            [WorldviewAdaptationRule(**rule) for rule in custom_wv.relation_rules]
            if custom_wv.relation_rules
            else []
        )
    except Exception as e:
        logger.warning(
            f"Invalid adaptation_rules format for worldview {custom_wv.id}: {e}"
        )
        adaptation_rules = []

    try:
        presets = (
            [WorldviewPreset(**preset) for preset in custom_wv.presets]
            if custom_wv.presets
            else []
        )
    except Exception as e:
        logger.warning(f"Invalid presets format for worldview {custom_wv.id}: {e}")
        presets = []

    return WorldviewConfigResponse(
        id=custom_wv.id,
        type=WorldviewType(custom_wv.type),
        name=custom_wv.name,
        description=custom_wv.description,
        timeScale=TimeScale(custom_wv.time_scale),
        techLevel=TechLevel(custom_wv.tech_level),
        magicLevel=MagicLevel(custom_wv.magic_level),
        politicalComplexity=ComplexityLevel(custom_wv.political_complexity),
        economicSystem=EconomicSystemType(custom_wv.economic_system),
        moduleConfigs=module_configs,
        theme=theme,
        adaptationRules=adaptation_rules,
        presets=presets,
        is_system=custom_wv.is_system,
        created_at=custom_wv.created_at,
        updated_at=custom_wv.updated_at,
    )


@router.get("/worldviews", response_model=List[WorldviewConfigResponse])
def get_all_worldviews(
    include_system: bool = True,
    include_custom: bool = True,
    db: Session = Depends(get_db),
):
    """获取所有世界观配置"""
    logger.info(
        f"Getting all worldviews - include_system={include_system}, include_custom={include_custom}"
    )

    result = []

    if include_system:
        for wv_type, config in SYSTEM_WORLDVIEW_CONFIGS.items():
            result.append(
                WorldviewConfigResponse(
                    id=config["id"],
                    type=config["type"],
                    name=config["name"],
                    description=config["description"],
                    timeScale=config["timeScale"],
                    techLevel=config["techLevel"],
                    magicLevel=config["magicLevel"],
                    politicalComplexity=config["politicalComplexity"],
                    economicSystem=config["economicSystem"],
                    moduleConfigs=config["moduleConfigs"],
                    theme=config["theme"],
                    adaptationRules=config["adaptationRules"],
                    presets=config["presets"],
                    is_system=config["is_system"],
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )

    if include_custom:
        custom_worldviews = (
            db.query(CustomWorldviewConfig)
            .filter(CustomWorldviewConfig.is_active.is_(True))
            .order_by(CustomWorldviewConfig.created_at.desc())
            .all()
        )
        for custom_wv in custom_worldviews:
            result.append(_convert_custom_worldview_to_response(custom_wv))

    logger.debug(f"Found {len(result)} worldview configurations")
    return result


@router.get("/worldviews/{worldview_type}", response_model=WorldviewConfigResponse)
def get_worldview_by_type(worldview_type: WorldviewType, db: Session = Depends(get_db)):
    """获取特定世界观配置"""
    logger.info(f"Getting worldview by type: {worldview_type}")

    if worldview_type in SYSTEM_WORLDVIEW_CONFIGS:
        config = SYSTEM_WORLDVIEW_CONFIGS[worldview_type]
        return WorldviewConfigResponse(
            id=config["id"],
            type=config["type"],
            name=config["name"],
            description=config["description"],
            timeScale=config["timeScale"],
            techLevel=config["techLevel"],
            magicLevel=config["magicLevel"],
            politicalComplexity=config["politicalComplexity"],
            economicSystem=config["economicSystem"],
            moduleConfigs=config["moduleConfigs"],
            theme=config["theme"],
            adaptationRules=config["adaptationRules"],
            presets=config["presets"],
            is_system=config["is_system"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    raise HTTPException(status_code=404, detail=f"世界观类型 '{worldview_type}' 不存在")


@router.post("/worldviews", response_model=WorldviewConfigResponse, status_code=201)
def create_worldview(
    worldview_data: WorldviewConfigCreate, db: Session = Depends(get_db)
):
    """创建自定义世界观配置"""
    logger.info(f"Creating custom worldview: {worldview_data.name}")

    try:
        _check_worldview_name_exists(db, worldview_data.name)

        custom_wv = CustomWorldviewConfig(
            id=str(uuid.uuid4()),
            name=worldview_data.name,
            description=worldview_data.description,
            type=worldview_data.type.value,
            time_scale=worldview_data.timeScale.value,
            tech_level=worldview_data.techLevel.value,
            magic_level=worldview_data.magicLevel.value,
            political_complexity=worldview_data.politicalComplexity.value,
            economic_system=worldview_data.economicSystem.value,
            module_configs=(
                worldview_data.moduleConfigs.model_dump()
                if worldview_data.moduleConfigs
                else {}
            ),
            theme=worldview_data.theme.model_dump() if worldview_data.theme else {},
            relation_rules=(
                [rule.model_dump() for rule in worldview_data.adaptationRules]
                if worldview_data.adaptationRules
                else []
            ),
            presets=(
                [preset.model_dump() for preset in worldview_data.presets]
                if worldview_data.presets
                else []
            ),
            is_system=False,
            is_active=True,
        )

        db.add(custom_wv)
        db.commit()
        db.refresh(custom_wv)

        logger.info(f"Custom worldview created: {custom_wv.id}")
        return _convert_custom_worldview_to_response(custom_wv)

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating worldview: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界观配置时发生数据库错误")

    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating worldview: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界观配置时发生未知错误")


@router.put("/worldviews/{worldview_id}", response_model=WorldviewConfigResponse)
def update_worldview(
    worldview_id: str,
    worldview_data: WorldviewConfigUpdate,
    db: Session = Depends(get_db),
):
    """更新自定义世界观配置"""
    logger.info(f"Updating worldview: {worldview_id}")

    custom_wv = (
        db.query(CustomWorldviewConfig)
        .filter(CustomWorldviewConfig.id == worldview_id)
        .first()
    )
    if not custom_wv:
        raise HTTPException(
            status_code=404, detail=f"世界观配置 '{worldview_id}' 不存在"
        )

    if custom_wv.is_system:
        raise HTTPException(status_code=403, detail="无法修改系统世界观配置")

    update_data = worldview_data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != custom_wv.name:
        _check_worldview_name_exists(db, update_data["name"], exclude_id=worldview_id)
        custom_wv.name = update_data["name"]

    if "description" in update_data:
        custom_wv.description = update_data["description"]

    if "timeScale" in update_data:
        custom_wv.time_scale = update_data["timeScale"].value

    if "techLevel" in update_data:
        custom_wv.tech_level = update_data["techLevel"].value

    if "magicLevel" in update_data:
        custom_wv.magic_level = update_data["magicLevel"].value

    if "politicalComplexity" in update_data:
        custom_wv.political_complexity = update_data["politicalComplexity"].value

    if "economicSystem" in update_data:
        custom_wv.economic_system = update_data["economicSystem"].value

    if "moduleConfigs" in update_data:
        custom_wv.module_configs = (
            update_data["moduleConfigs"].model_dump()
            if update_data["moduleConfigs"]
            else {}
        )

    if "theme" in update_data:
        custom_wv.theme = (
            update_data["theme"].model_dump() if update_data["theme"] else {}
        )

    if "adaptationRules" in update_data:
        custom_wv.relation_rules = (
            [rule.model_dump() for rule in update_data["adaptationRules"]]
            if update_data["adaptationRules"]
            else []
        )

    if "presets" in update_data:
        custom_wv.presets = (
            [preset.model_dump() for preset in update_data["presets"]]
            if update_data["presets"]
            else []
        )

    db.commit()
    db.refresh(custom_wv)

    logger.info(f"Worldview updated: {worldview_id}")
    return _convert_custom_worldview_to_response(custom_wv)


@router.delete("/worldviews/{worldview_id}")
def delete_worldview(worldview_id: str, db: Session = Depends(get_db)):
    """删除自定义世界观配置（软删除）"""
    logger.info(f"Deleting worldview: {worldview_id}")

    custom_wv = (
        db.query(CustomWorldviewConfig)
        .filter(CustomWorldviewConfig.id == worldview_id)
        .first()
    )
    if not custom_wv:
        raise HTTPException(
            status_code=404, detail=f"世界观配置 '{worldview_id}' 不存在"
        )

    if custom_wv.is_system:
        raise HTTPException(status_code=403, detail="无法删除系统世界观配置")

    custom_wv.is_active = False
    db.commit()

    logger.info(f"Worldview deleted (soft): {worldview_id}")
    return {"message": "世界观配置删除成功"}


@router.get(
    "/worldviews/{worldview_type}/adaptations",
    response_model=WorldviewAdaptationsResponse,
)
def get_worldview_adaptations(
    worldview_type: WorldviewType, db: Session = Depends(get_db)
):
    """获取世界观适配规则"""
    logger.info(f"Getting adaptations for worldview: {worldview_type}")

    if worldview_type in SYSTEM_WORLDVIEW_CONFIGS:
        config = SYSTEM_WORLDVIEW_CONFIGS[worldview_type]
        return WorldviewAdaptationsResponse(
            worldview_type=worldview_type,
            module_configs=config["moduleConfigs"],
            adaptation_rules=config["adaptationRules"],
        )

    raise HTTPException(status_code=404, detail=f"世界观类型 '{worldview_type}' 不存在")
