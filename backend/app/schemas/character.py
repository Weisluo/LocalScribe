"""
人物设定系统 - Pydantic Schemas

提供人物角色相关的数据验证和序列化模型
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

# ==================== 枚举定义 ====================


class CharacterLevel(str, Enum):
    """角色等级"""

    PROTAGONIST = "protagonist"  # 主角
    MAJOR_SUPPORT = "major_support"  # 重要配角
    SUPPORT = "support"  # 配角
    MINOR = "minor"  # 小角色


class CharacterGender(str, Enum):
    """角色性别"""

    MALE = "male"  # 男
    FEMALE = "female"  # 女
    OTHER = "other"  # 其他
    UNKNOWN = "unknown"  # 未知


class AliasType(str, Enum):
    """别名类型"""

    ZI = "zi"  # 字
    HAO = "hao"  # 号
    NICKNAME = "nickname"  # 外号
    TITLE = "title"  # 称号
    OTHER = "other"  # 其他


class RelationType(str, Enum):
    """关系类型"""

    FAMILY = "family"  # 亲情
    LOVE = "love"  # 爱情
    FRIEND = "friend"  # 友情
    MASTER = "master"  # 师父
    APPRENTICE = "apprentice"  # 徒弟
    ENEMY = "enemy"  # 敌对
    OTHER = "other"  # 其他


class ArtifactType(str, Enum):
    """器物类型"""

    WEAPON = "weapon"  # 武器
    ARMOR = "armor"  # 防具
    ACCESSORY = "accessory"  # 饰品
    TREASURE = "treasure"  # 法宝
    OTHER = "other"  # 其他


class ArtifactRarity(str, Enum):
    """器物等级"""

    LEGENDARY = "legendary"  # 神器
    EPIC = "epic"  # 传说
    RARE = "rare"  # 稀有
    COMMON = "common"  # 普通


# ==================== 基础 Schema ====================


class CharacterAliasBase(BaseModel):
    """别名基础 Schema"""

    alias_type: AliasType = Field(..., description="别名类型")
    content: str = Field(..., min_length=1, max_length=255, description="别名内容")
    order_index: int = Field(0, ge=0, description="排序索引")


class CharacterAliasCreate(CharacterAliasBase):
    """创建别名 Schema"""

    pass


class CharacterAliasUpdate(BaseModel):
    """更新别名 Schema"""

    alias_type: Optional[AliasType] = None
    content: Optional[str] = Field(None, min_length=1, max_length=255)
    order_index: Optional[int] = Field(None, ge=0)


class CharacterAliasResponse(CharacterAliasBase):
    """别名响应 Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    character_id: str
    created_at: datetime
    updated_at: datetime


# ==================== 卡片内容项 Schema ====================


class CardContentItem(BaseModel):
    """卡片内容项"""

    key: str = Field(..., description="字段名")
    value: Any = Field(..., description="字段值")
    type: str = Field(
        "text", description="字段类型: text|rich_text|list|image|number|boolean"
    )


class CharacterCardBase(BaseModel):
    """卡片基础 Schema"""

    title: str = Field(..., min_length=1, max_length=255, description="卡片标题")
    icon: Optional[str] = Field(None, max_length=100, description="卡片图标")
    content: List[CardContentItem] = Field(default_factory=list, description="卡片内容")
    order_index: int = Field(0, ge=0, description="排序索引")


class CharacterCardCreate(CharacterCardBase):
    """创建卡片 Schema"""

    pass


class CharacterCardUpdate(BaseModel):
    """更新卡片 Schema"""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    icon: Optional[str] = Field(None, max_length=100)
    content: Optional[List[CardContentItem]] = None
    order_index: Optional[int] = Field(None, ge=0)


class CharacterCardResponse(CharacterCardBase):
    """卡片响应 Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    character_id: str
    created_at: datetime
    updated_at: datetime


# ==================== 人物关系 Schema ====================


class TargetCharacterInfo(BaseModel):
    """目标人物简要信息"""

    id: str
    name: str
    avatar: Optional[str] = None
    level: str = "other"


class CharacterRelationshipBase(BaseModel):
    """关系基础 Schema"""

    target_character_id: Optional[str] = Field(None, description="目标人物ID")
    target_name: Optional[str] = Field(None, max_length=255, description="目标人物名称")
    relation_type: RelationType = Field(..., description="关系类型")
    description: Optional[str] = Field(None, description="关系描述")
    strength: int = Field(50, ge=0, le=100, description="关系强度 0-100")
    is_bidirectional: bool = Field(True, description="是否为双向关系")
    reverse_description: Optional[str] = Field(None, description="反向关系描述")
    order_index: int = Field(0, ge=0, description="排序索引")


class CharacterRelationshipCreate(CharacterRelationshipBase):
    """创建关系 Schema"""

    pass


class CharacterRelationshipUpdate(BaseModel):
    """更新关系 Schema"""

    target_character_id: Optional[str] = None
    target_name: Optional[str] = Field(None, max_length=255)
    relation_type: Optional[RelationType] = None
    description: Optional[str] = None
    strength: Optional[int] = Field(None, ge=0, le=100)
    is_bidirectional: Optional[bool] = None
    reverse_description: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=0)


class CharacterRelationshipResponse(CharacterRelationshipBase):
    """关系响应 Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    character_id: str
    target_character: Optional[TargetCharacterInfo] = None
    created_at: datetime
    updated_at: datetime


# ==================== 器物 Schema ====================


class CharacterArtifactBase(BaseModel):
    """器物基础 Schema"""

    name: str = Field(..., min_length=1, max_length=255, description="器物名称")
    quote: Optional[str] = Field(None, max_length=500, description="器物判词")
    description: Optional[str] = Field(None, description="器物描述")
    artifact_type: Optional[str] = Field(None, max_length=100, description="器物类型（自定义）")
    rarity: Optional[ArtifactRarity] = Field(None, description="器物等级")
    image: Optional[str] = Field(None, max_length=500, description="器物图片URL")
    order_index: int = Field(0, ge=0, description="排序索引")


class CharacterArtifactCreate(CharacterArtifactBase):
    """创建器物 Schema"""

    pass


class CharacterArtifactUpdate(BaseModel):
    """更新器物 Schema"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quote: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    artifact_type: Optional[str] = Field(None, max_length=100)
    rarity: Optional[ArtifactRarity] = None
    image: Optional[str] = Field(None, max_length=500)
    order_index: Optional[int] = Field(None, ge=0)


class CharacterArtifactResponse(CharacterArtifactBase):
    """器物响应 Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    character_id: str
    created_at: datetime
    updated_at: datetime


# ==================== 人物主 Schema ====================


class CharacterBase(BaseModel):
    """人物基础 Schema"""

    name: str = Field(..., min_length=1, max_length=255, description="姓名")
    gender: CharacterGender = Field(CharacterGender.UNKNOWN, description="性别")
    birth_date: Optional[str] = Field(None, max_length=100, description="生辰")
    birthplace: Optional[str] = Field(None, max_length=255, description="出生地")
    race: Optional[str] = Field(None, max_length=100, description="种族")
    faction: Optional[str] = Field(None, max_length=100, description="阵营归属")
    level: CharacterLevel = Field(CharacterLevel.MINOR, description="角色等级")
    quote: Optional[str] = Field(None, description="判词/引言")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")
    full_image: Optional[str] = Field(
        None, max_length=500, description="全身形象图片URL"
    )
    first_appearance_volume: Optional[str] = Field(
        None, max_length=100, description="首次出场卷"
    )
    first_appearance_act: Optional[str] = Field(
        None, max_length=100, description="首次出场幕"
    )
    first_appearance_chapter: Optional[str] = Field(
        None, max_length=100, description="首次出场章"
    )
    last_appearance_volume: Optional[str] = Field(
        None, max_length=100, description="最后出场卷"
    )
    last_appearance_act: Optional[str] = Field(
        None, max_length=100, description="最后出场幕"
    )
    last_appearance_chapter: Optional[str] = Field(
        None, max_length=100, description="最后出场章"
    )
    order_index: int = Field(0, ge=0, description="排序索引")


class CharacterCreate(CharacterBase):
    """创建人物 Schema"""

    aliases: List[CharacterAliasCreate] = Field(
        default_factory=list, description="别名列表"
    )
    cards: List[CharacterCardCreate] = Field(
        default_factory=list, description="卡片列表"
    )
    relationships: List[CharacterRelationshipCreate] = Field(
        default_factory=list, description="关系列表"
    )
    artifacts: List[CharacterArtifactCreate] = Field(
        default_factory=list, description="器物列表"
    )


class CharacterUpdate(BaseModel):
    """更新人物 Schema"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    gender: Optional[CharacterGender] = None
    birth_date: Optional[str] = Field(None, max_length=100)
    birthplace: Optional[str] = Field(None, max_length=255)
    race: Optional[str] = Field(None, max_length=100)
    faction: Optional[str] = Field(None, max_length=100)
    level: Optional[CharacterLevel] = None
    quote: Optional[str] = None
    avatar: Optional[str] = Field(None, max_length=500)
    full_image: Optional[str] = Field(None, max_length=500)
    first_appearance_volume: Optional[str] = Field(None, max_length=100)
    first_appearance_act: Optional[str] = Field(None, max_length=100)
    first_appearance_chapter: Optional[str] = Field(None, max_length=100)
    last_appearance_volume: Optional[str] = Field(None, max_length=100)
    last_appearance_act: Optional[str] = Field(None, max_length=100)
    last_appearance_chapter: Optional[str] = Field(None, max_length=100)
    order_index: Optional[int] = Field(None, ge=0)


class CharacterListItem(BaseModel):
    """人物列表项 Schema（用于左侧人物栏）"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    gender: str
    level: str
    quote: Optional[str] = None
    avatar: Optional[str] = None
    birth_date: Optional[str] = None
    first_appearance_volume: Optional[str] = None
    first_appearance_act: Optional[str] = None
    first_appearance_chapter: Optional[str] = None
    order_index: int
    # 别名摘要
    aliases: List[CharacterAliasResponse] = []
    created_at: datetime
    updated_at: datetime


class CharacterDetailResponse(CharacterBase):
    """人物详情响应 Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    aliases: List[CharacterAliasResponse] = []
    cards: List[CharacterCardResponse] = []
    relationships: List[CharacterRelationshipResponse] = []
    artifacts: List[CharacterArtifactResponse] = []
    created_at: datetime
    updated_at: datetime


class CharacterSimpleResponse(BaseModel):
    """人物简要响应 Schema（用于关系选择）"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    level: str
    avatar: Optional[str] = None


# ==================== 筛选和排序 Schema ====================


class CharacterFilter(BaseModel):
    """人物筛选 Schema"""

    level: Optional[CharacterLevel] = Field(None, description="角色等级筛选")
    gender: Optional[CharacterGender] = Field(None, description="性别筛选")
    search: Optional[str] = Field(None, description="搜索关键词（姓名、别名）")
    volume: Optional[str] = Field(None, description="筛选卷")
    act: Optional[str] = Field(None, description="筛选幕")
    chapter: Optional[str] = Field(None, description="筛选章")


class CharacterSort(BaseModel):
    """人物排序 Schema"""

    field: str = Field("order_index", description="排序字段")
    order: str = Field("asc", description="排序方向: asc|desc")


# ==================== 批量操作 Schema ====================


class BatchUpdateOrderRequest(BaseModel):
    """批量更新排序请求"""

    orders: Dict[str, int] = Field(..., description="人物ID到排序索引的映射")


class BatchDeleteRequest(BaseModel):
    """批量删除请求"""

    ids: List[str] = Field(..., description="要删除的人物ID列表")


# ==================== 统计数据 Schema ====================


class CharacterStats(BaseModel):
    """人物统计 Schema"""

    total: int = Field(..., description="人物总数")
    by_level: Dict[str, int] = Field(default_factory=dict, description="按等级统计")
    by_gender: Dict[str, int] = Field(default_factory=dict, description="按性别统计")
