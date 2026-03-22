from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum

# 枚举定义
class ModuleType(str, Enum):
    MAP = "map"
    HISTORY = "history"
    POLITICS = "politics"
    ECONOMY = "economy"
    RACES = "races"
    SYSTEMS = "systems"
    SPECIAL = "special"

# 基础 Schema
class WorldBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="世界名称")
    description: Optional[str] = Field(None, max_length=1000, description="世界描述")
    cover_image: Optional[str] = Field(None, max_length=500, description="封面图片 URL")
    tags: Optional[List[str]] = Field(None, max_length=10, description="标签列表")
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v:
            for tag in v:
                if tag and len(tag) > 20:
                    raise ValueError('每个标签长度不能超过 20 个字符')
        return v

# 世界模板 Schema
class WorldTemplateCreate(WorldBase):
    is_public: bool = False
    is_system_template: bool = False
    project_id: Optional[str] = None

class WorldTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_system_template: Optional[bool] = None
    project_id: Optional[str] = None

class WorldTemplateResponse(WorldBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_public: bool
    is_system_template: bool
    project_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    module_count: int = 0
    instance_count: int = 0

# 世界模块 Schema
class WorldModuleBase(BaseModel):
    module_type: ModuleType = Field(..., description="模块类型")
    name: str = Field(..., min_length=1, max_length=255, description="模块名称")
    description: Optional[str] = Field(None, max_length=1000, description="模块描述")
    icon: Optional[str] = Field(None, max_length=100, description="模块图标")
    order_index: int = Field(0, ge=0, description="排序索引")
    is_collapsible: bool = Field(True, description="是否可折叠")
    is_required: bool = Field(False, description="是否必需")

class WorldModuleCreate(WorldModuleBase):
    pass

class WorldModuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="模块名称")
    description: Optional[str] = Field(None, max_length=1000, description="模块描述")
    icon: Optional[str] = Field(None, max_length=100, description="模块图标")
    order_index: Optional[int] = Field(None, ge=0, description="排序索引")
    is_collapsible: Optional[bool] = Field(None, description="是否可折叠")
    is_required: Optional[bool] = Field(None, description="是否必需")

class WorldModuleResponse(WorldModuleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    template_id: str
    created_at: datetime
    updated_at: datetime
    submodule_count: int = 0
    item_count: int = 0

# 子模块 Schema
class WorldSubmoduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="子模块名称")
    description: Optional[str] = Field(None, max_length=1000, description="子模块描述")
    order_index: int = Field(0, ge=0, description="排序索引")
    color: Optional[str] = Field(None, max_length=50, description="颜色标识（支持十六进制或语义化颜色名称）")
    icon: Optional[str] = Field(None, max_length=100, description="图标")
    parent_id: Optional[str] = Field(None, description="父级子模块ID（用于时代-事件层级）")

class WorldSubmoduleCreate(WorldSubmoduleBase):
    pass

class WorldSubmoduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="子模块名称")
    description: Optional[str] = Field(None, max_length=1000, description="子模块描述")
    order_index: Optional[int] = Field(None, ge=0, description="排序索引")
    color: Optional[str] = Field(None, max_length=50, description="颜色标识（支持十六进制或语义化颜色名称）")
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
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not isinstance(v, dict):
            raise ValueError('内容必须是字典格式')
        if len(v) > 50:
            raise ValueError('内容字段数量不能超过 50 个')
        for key, value in v.items():
            if len(key) > 100:
                raise ValueError('内容键名长度不能超过 100 个字符')
            if isinstance(value, str) and len(value) > 5000:
                raise ValueError('内容值长度不能超过 5000 个字符')
        return v

class WorldModuleItemCreate(WorldModuleItemBase):
    submodule_id: Optional[str] = Field(None, description="子模块ID")

class WorldModuleItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="项名称")
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

# 世界实例 Schema
class WorldInstanceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="实例名称")
    description: Optional[str] = Field(None, max_length=1000, description="实例描述")
    custom_data: Optional[Dict[str, Any]] = Field(None, description="自定义数据")
    
    @field_validator('custom_data')
    @classmethod
    def validate_custom_data(cls, v):
        if v and len(v) > 100:
            raise ValueError('自定义数据字段数量不能超过 100 个')
        return v

class WorldInstanceCreate(WorldInstanceBase):
    template_id: str = Field(..., description="模板ID")
    project_id: str = Field(..., description="项目ID")

class WorldInstanceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="实例名称")
    description: Optional[str] = Field(None, max_length=1000, description="实例描述")
    custom_data: Optional[Dict[str, Any]] = Field(None, description="自定义数据")

class WorldInstanceResponse(WorldInstanceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    template_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

# 嵌套响应 Schema
class WorldModuleWithItems(WorldModuleResponse):
    submodules: List[WorldSubmoduleResponse] = []
    items: List[WorldModuleItemResponse] = []

class WorldSubmoduleWithItems(WorldSubmoduleResponse):
    items: List[WorldModuleItemResponse] = []

class WorldTemplateWithModules(WorldTemplateResponse):
    modules: List[WorldModuleWithItems] = []

# 导入/导出 Schema
class WorldTemplateExport(BaseModel):
    template: WorldTemplateResponse
    modules: List[WorldModuleWithItems]

class WorldTemplateImport(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    modules: List[WorldModuleWithItems]

# 批量操作 Schema
class BatchDeleteRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1, max_length=100, description="要删除的 ID 列表")
    
    @field_validator('ids')
    @classmethod
    def validate_ids(cls, v):
        if len(v) > 100:
            raise ValueError('批量删除数量不能超过 100 个')
        return v

class BatchUpdateOrderRequest(BaseModel):
    items: List[Dict[str, Any]] = Field(..., min_length=1, max_length=100, description="排序项列表")
    
    @field_validator('items')
    @classmethod
    def validate_items(cls, v):
        if len(v) > 100:
            raise ValueError('批量排序数量不能超过 100 个')
        for item in v:
            if not isinstance(item, dict) or 'id' not in item or 'order_index' not in item:
                raise ValueError('每个排序项必须包含 id 和 order_index 字段')
            if not isinstance(item['order_index'], int) or item['order_index'] < 0:
                raise ValueError('order_index 必须是大于等于 0 的整数')
        return v

# 搜索和筛选 Schema
class WorldTemplateFilter(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_system_template: Optional[bool] = None
    created_by: Optional[str] = None
    project_id: Optional[str] = None