from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# 世界备份格式版本（P6-T11；worldview_configuration_system §7）。
# 1 = World/WorldModule/WorldSubmodule/WorldModuleItem/WorldLink 的新结构（P1 之后），
# 升版时在 import_world 里按版本先迁移再加载；未知字段一律保留。
WORLD_SCHEMA_VERSION = 1


# 枚举定义
class ModuleType(str, Enum):
    MAP = "map"
    HISTORY = "history"
    POLITICS = "politics"
    ECONOMY = "economy"
    RACES = "races"
    SYSTEMS = "systems"
    SPECIAL = "special"


# 世界模块 Schema
class WorldModuleBase(BaseModel):
    module_type: ModuleType = Field(..., description="模块类型")
    name: str = Field(..., min_length=1, max_length=255, description="模块名称")
    description: Optional[str] = Field(None, description="模块描述")
    icon: Optional[str] = Field(None, max_length=100, description="模块图标")
    order_index: int = Field(0, ge=0, description="排序索引")
    config: Optional[Dict[str, Any]] = Field(
        None, description="模块配置（契约 §2.7，取代 moduleConfig 条目）"
    )
    is_collapsible: bool = Field(True, description="是否可折叠")
    is_required: bool = Field(False, description="是否必需")


class WorldModuleCreate(WorldModuleBase):
    pass


class WorldModuleUpdate(BaseModel):
    # 端点会先比较 module_type 再逐字段 setattr，缺这个字段会直接 AttributeError（500）
    module_type: Optional[ModuleType] = Field(None, description="模块类型")
    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="模块名称"
    )
    description: Optional[str] = Field(None, description="模块描述")
    icon: Optional[str] = Field(None, max_length=100, description="模块图标")
    order_index: Optional[int] = Field(None, ge=0, description="排序索引")
    config: Optional[Dict[str, Any]] = Field(None, description="模块配置（契约 §2.7）")
    is_collapsible: Optional[bool] = Field(None, description="是否可折叠")
    is_required: Optional[bool] = Field(None, description="是否必需")


class WorldModuleResponse(WorldModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    world_id: str
    created_at: datetime
    updated_at: datetime
    submodule_count: int = 0
    item_count: int = 0


# 子模块 Schema
class WorldSubmoduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="子模块名称")
    description: Optional[str] = Field(None, description="子模块描述")
    order_index: int = Field(0, ge=0, description="排序索引")
    kind: Optional[str] = Field(
        None,
        max_length=50,
        description="语义类型（契约 §2.3）；不传时按 color 旧编码推导",
    )
    meta: Optional[Dict[str, Any]] = Field(None, description="基础字段（契约 §2.3）")
    color: Optional[str] = Field(
        None, max_length=50, description="颜色标识（支持十六进制或语义化颜色名称）"
    )
    icon: Optional[str] = Field(None, max_length=100, description="图标")
    parent_id: Optional[str] = Field(
        None, description="父级子模块ID（用于时代-事件层级）"
    )


class WorldSubmoduleCreate(WorldSubmoduleBase):
    pass


class WorldSubmoduleUpdate(BaseModel):
    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="子模块名称"
    )
    description: Optional[str] = Field(None, description="子模块描述")
    order_index: Optional[int] = Field(None, ge=0, description="排序索引")
    kind: Optional[str] = Field(None, max_length=50, description="语义类型")
    meta: Optional[Dict[str, Any]] = Field(None, description="基础字段")
    color: Optional[str] = Field(
        None, max_length=50, description="颜色标识（支持十六进制或语义化颜色名称）"
    )
    icon: Optional[str] = Field(None, max_length=100, description="图标")
    parent_id: Optional[str] = Field(None, description="父级子模块ID")


class WorldSubmoduleResponse(WorldSubmoduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module_id: str
    created_at: datetime
    updated_at: datetime
    item_count: int = 0


# 模块项 Schema
class WorldModuleItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="项名称")
    content: Dict[str, Any] = Field(..., description="结构化内容")
    order_index: int = Field(0, ge=0, description="排序索引")
    is_published: bool = Field(True, description="是否发布")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if not isinstance(v, dict):
            raise ValueError("内容必须是字典格式")
        if len(v) > 50:
            raise ValueError("内容字段数量不能超过 50 个")
        for key, value in v.items():
            if len(key) > 100:
                raise ValueError("内容键名长度不能超过 100 个字符")
            if isinstance(value, str) and len(value) > 5000:
                raise ValueError("内容值长度不能超过 5000 个字符")
        return v


class WorldModuleItemCreate(WorldModuleItemBase):
    submodule_id: Optional[str] = Field(None, description="子模块ID")


class WorldModuleItemUpdate(BaseModel):
    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="项名称"
    )
    content: Optional[Dict[str, Any]] = Field(None, description="结构化内容")
    order_index: Optional[int] = Field(None, ge=0, description="排序索引")
    is_published: Optional[bool] = Field(None, description="是否发布")
    submodule_id: Optional[str] = Field(None, description="子模块ID")


class WorldModuleItemResponse(WorldModuleItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module_id: str
    submodule_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============= World Schema（契约 §2.1 / §2.8，Phase 1 P1-T1） =============


class WorldTone(BaseModel):
    """世界视觉基调（契约 §2.8）

    extra="allow"：与 WorldSettings 同口径，未识别的基调键不能被静默丢弃
    （worldview_configuration_system §7「未知字段保留不丢弃」）。
    """

    model_config = ConfigDict(extra="allow")

    palette: Optional[str] = Field(None, description="parchment/ink/slate/custom")
    accent: Optional[str] = Field(None, max_length=50)
    texture: Optional[str] = Field(None, description="none/paper/grid/starfield")
    radius: Optional[str] = Field(None, description="sm/md/lg")


class WorldSettings(BaseModel):
    """世界自定义配置（契约 §2.1）"""

    model_config = ConfigDict(extra="allow")

    terminology: Optional[Dict[str, str]] = None
    calendar: Optional[Dict[str, Any]] = None
    complexity: Optional[str] = Field(None, description="sketch/structure/sandbox")
    moduleConfigs: Optional[Dict[str, Any]] = None


class WorldCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="世界名称")
    description: Optional[str] = Field(None, description="世界描述")
    cover_image: Optional[str] = Field(None, max_length=500, description="封面图片 URL")
    project_id: Optional[str] = Field(None, description="所属项目")
    tone: Optional[WorldTone] = None
    settings: Optional[WorldSettings] = None


class WorldUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    cover_image: Optional[str] = Field(None, max_length=500)
    project_id: Optional[str] = None
    tone: Optional[WorldTone] = None
    settings: Optional[WorldSettings] = None


class WorldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    project_id: Optional[str] = None
    tone: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    module_count: int = 0
    link_count: int = 0


class WorldModuleWithItemsV2(WorldModuleResponse):
    """模块（含 config 与嵌套内容），/worlds 详情使用"""

    world_id: str
    submodules: List[WorldSubmoduleResponse] = []
    items: List[WorldModuleItemResponse] = []


class WorldWithModules(WorldResponse):
    modules: List[WorldModuleWithItemsV2] = []


class WorldLinkExportEntry(BaseModel):
    """导出时的关联条目（契约 §2.5）"""

    source_module: str
    source_kind: str
    source_id: str
    target_module: str
    target_kind: str
    target_id: str
    link_type: str
    directed: bool = True
    label: Optional[str] = None
    note: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    time: Optional[Dict[str, Any]] = None


class WorldImportMode(str, Enum):
    """世界备份恢复模式（worldbuilding_ui_design §3.4）"""

    NEW = "new"
    OVERWRITE = "overwrite"


class WorldExport(BaseModel):
    """世界备份（契约 §2.1：世界 JSON 备份 / 恢复，不是模板分发）

    extra="allow"：备份是用户个人数据的迁移手段，顶层未知键不能被静默丢弃
    （worldview_configuration_system §7「未知字段保留不丢弃」）。
    """

    model_config = ConfigDict(extra="allow")

    schema_version: int = Field(
        WORLD_SCHEMA_VERSION, description="备份格式版本（P6-T11）"
    )
    world: WorldResponse
    modules: List[WorldModuleWithItemsV2]
    links: List[WorldLinkExportEntry] = []


class WorldImport(BaseModel):
    """世界恢复请求"""

    model_config = ConfigDict(extra="allow")

    world: WorldResponse
    modules: List[WorldModuleWithItemsV2] = []
    links: List[WorldLinkExportEntry] = []
    project_id: Optional[str] = None
    name: Optional[str] = None
    # 备份格式版本：缺省视为最新（旧备份里本来没有这个键）
    schema_version: Optional[int] = Field(None, description="备份格式版本")
    # 两种恢复模式（worldbuilding_ui_design §3.4）
    mode: WorldImportMode = Field(
        WorldImportMode.NEW, description="new=恢复为新世界；overwrite=覆盖已有世界"
    )
    target_world_id: Optional[str] = Field(
        None, description="mode=overwrite 时的目标世界 id"
    )
    confirm_overwrite: bool = Field(
        False, description="覆盖非空世界必须显式确认（重数据保护）"
    )
    keep_dangling: bool = Field(
        True, description="端点无法解析时保留为失效引用，而不是丢弃该关联"
    )


class DanglingRefEntry(BaseModel):
    """导入时无法归属的关联端点（worldbuilding_ui_design §3.4：失效引用单独列出）"""

    role: str = Field(..., description="source / target")
    module: str
    kind: str
    id: str
    link_type: str


class WorldImportReport(BaseModel):
    """世界备份恢复结果（P6-T2：id 映射、失效引用与降级项报告）"""

    world: WorldResponse
    mode: str = WorldImportMode.NEW.value
    schema_version: int = WORLD_SCHEMA_VERSION
    entity_count: int = 0
    link_count: int = 0
    merged_duplicates: int = 0
    skipped_links: int = 0
    id_map: Dict[str, str] = {}
    dangling_refs: List[DanglingRefEntry] = []
    unknown_kinds: List[str] = []
    unknown_link_types: List[str] = []
    warnings: List[str] = []
