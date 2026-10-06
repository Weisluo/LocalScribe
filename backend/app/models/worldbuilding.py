from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    literal,
    text,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from sqlalchemy.sql import func

from . import Base

if TYPE_CHECKING:
    from .project import Project

# JSON 配置字段的宽松类型（契约 §2.7 的 ModuleConfig / §2.1 的 WorldSettings）
DocDict = Dict[str, Any]

# 旧模板字段的降级存放位置：worlds.settings["legacyTemplate"]
LEGACY_TEMPLATE_KEY = "legacyTemplate"

# 七个固定模块的默认展示信息（不预设世界观内容，仅模块骨架）
DEFAULT_MODULE_SPECS = (
    ("map", "地图", "map"),
    ("history", "历史", "scroll-text"),
    ("politics", "政治", "crown"),
    ("economy", "经济", "coins"),
    ("races", "种族", "users"),
    ("systems", "体系", "sparkles"),
    ("special", "特殊", "star"),
)


class World(Base):
    """世界 - 唯一的顶层容器，归属某个项目

    由 world_templates 改名而来（P1-MIG-01）：
    - 新增 tone / settings（JSON 配置，见契约 §2.1、§2.8）
    - 原 tags / is_public / is_system_template / created_by 不再作为列，
      其旧值在迁移时降级进 settings["legacyTemplate"]，并保留同名只读属性以兼容旧接口。
    """

    __tablename__ = "worlds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tone: Mapped[Optional[DocDict]] = mapped_column(JSON, nullable=True)
    settings: Mapped[Optional[DocDict]] = mapped_column(JSON, nullable=True)
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=True
    )  # 所属项目（旧库允许为空）

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    modules: Mapped[List["WorldModule"]] = relationship(
        back_populates="world", cascade="all, delete-orphan"
    )
    project: Mapped[Optional["Project"]] = relationship(back_populates="worlds")

    # ---- 旧字段兼容（只读属性 + 可写 setter，值存 settings.legacyTemplate） ----

    def _legacy_bucket(self) -> DocDict:
        return dict((self.settings or {}).get(LEGACY_TEMPLATE_KEY) or {})

    def get_legacy_field(self, name: str) -> Any:
        return self._legacy_bucket().get(name)

    def set_legacy_field(self, name: str, value: Any) -> None:
        settings = dict(self.settings or {})
        bucket = dict(settings.get(LEGACY_TEMPLATE_KEY) or {})
        if value is None:
            bucket.pop(name, None)
        else:
            bucket[name] = value
        if bucket:
            settings[LEGACY_TEMPLATE_KEY] = bucket
        else:
            settings.pop(LEGACY_TEMPLATE_KEY, None)
        self.settings = settings

    @property
    def tags(self) -> Optional[List[str]]:
        return self.get_legacy_field("tags")

    @tags.setter
    def tags(self, value: Optional[List[str]]) -> None:
        self.set_legacy_field("tags", value)

    @property
    def created_by(self) -> Optional[str]:
        return self.get_legacy_field("created_by")

    @created_by.setter
    def created_by(self, value: Optional[str]) -> None:
        self.set_legacy_field("created_by", value)

    # is_public / is_system_template 语义已取消（契约 §0.1：不再有模板市场），
    # 旧值仅作为历史信息保留在 settings.legacyTemplate 中，查询按 False 处理。
    @hybrid_property
    def is_public(self) -> bool:
        return bool(self.get_legacy_field("is_public"))

    @is_public.setter  # type: ignore[no-redef]
    def is_public(self, value: bool) -> None:
        self.set_legacy_field("is_public", value)

    @is_public.expression  # type: ignore[no-redef]
    def is_public(cls):  # noqa: N805
        return literal(False)

    @hybrid_property
    def is_system_template(self) -> bool:
        return bool(self.get_legacy_field("is_system_template"))

    @is_system_template.setter  # type: ignore[no-redef]
    def is_system_template(self, value: bool) -> None:
        self.set_legacy_field("is_system_template", value)

    @is_system_template.expression  # type: ignore[no-redef]
    def is_system_template(cls):  # noqa: N805
        return literal(False)


# 旧类名兼容：旧接口（/templates）与旧导入路径继续可用，读写同一张 worlds 表
WorldTemplate = World


def derive_submodule_kind(color, module_type=None) -> str:
    """从旧 color 前缀编码推导 kind（契约 §2.3，P1-MIG-04 同口径）。

    - history 模块：color=era:* -> era，其余（历史事件的默认色值）-> event
    - 其他模块：era:ochre -> era；type:currency:global -> currency；其余 -> custom
    """

    if module_type == "history":
        if color and str(color).startswith("era:"):
            return "era"
        return "event"
    if not color:
        return "custom"
    if color.startswith("era:"):
        return "era"
    if color.startswith("type:"):
        parts = color.split(":")
        return parts[1] or "custom"
    return "custom"


def derive_submodule_meta(submodule) -> dict:
    """把旧 color/icon 编码的附加信息放进 meta，不丢失原值。"""

    meta = dict(submodule.meta or {})
    color = submodule.color
    if color:
        meta.setdefault("legacyColor", color)
        if color.startswith("era:"):
            meta.setdefault("theme", color.split(":", 1)[1])
        elif color.startswith("type:"):
            parts = color.split(":")
            if len(parts) >= 3:
                meta.setdefault("level", parts[2])
    icon = submodule.icon
    if icon and icon.startswith("era:"):
        parts = icon.split(":")
        if len(parts) >= 3:
            meta.setdefault("time", {"start": parts[1], "end": parts[2]})
    return meta


class WorldModule(Base):
    """世界模块 - 地图、历史、政治、经济、种族、体系、特殊"""

    __tablename__ = "world_modules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    world_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("worlds.id"), nullable=False
    )
    module_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # 模块类型: map, history, politics, economy, races, systems, special
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # 配置（取代原 WorldModuleItem(name="moduleConfig")，契约 §2.2）
    config: Mapped[Optional[DocDict]] = mapped_column(JSON, nullable=True)

    # 配置
    is_collapsible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 旧字段名兼容：旧代码/旧接口仍可用 template_id 读写 world_id
    template_id = synonym("world_id")

    # 关系
    world: Mapped["World"] = relationship(back_populates="modules")
    submodules: Mapped[List["WorldSubmodule"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )
    items: Mapped[List["WorldModuleItem"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )


class WorldSubmodule(Base):
    """子模块 - 模块下的分类（如种族下的不同种族）

    对于历史模块：
    - 时代：parent_id 为 null
    - 事件：parent_id 指向时代
    """

    __tablename__ = "world_submodules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    module_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("world_modules.id"), nullable=False
    )
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("world_submodules.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # 语义类型（取代 color 前缀编码，契约 §2.3）
    kind: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    meta: Mapped[Optional[DocDict]] = mapped_column(JSON, nullable=True)

    # 配置
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    module: Mapped["WorldModule"] = relationship(back_populates="submodules")
    items: Mapped[List["WorldModuleItem"]] = relationship(
        back_populates="submodule", cascade="all, delete-orphan"
    )
    children: Mapped[List["WorldSubmodule"]] = relationship(
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        single_parent=True,
    )


def _module_type_of(connection, submodule: WorldSubmodule) -> Optional[str]:
    module = submodule.__dict__.get("module")
    if module is not None:
        return module.module_type
    if connection is None or not submodule.module_id:
        return None
    row = connection.execute(
        text("SELECT module_type FROM world_modules WHERE id = :id"),
        {"id": submodule.module_id},
    ).fetchone()
    return row[0] if row else None


def _fill_submodule_kind_meta(connection, submodule: WorldSubmodule) -> None:
    if not submodule.kind:
        submodule.kind = derive_submodule_kind(
            submodule.color, _module_type_of(connection, submodule)
        )
    submodule.meta = derive_submodule_meta(submodule)


@event.listens_for(WorldSubmodule, "before_insert")
def _submodule_before_insert(mapper, connection, target):  # noqa: ANN001
    _fill_submodule_kind_meta(connection, target)


@event.listens_for(WorldSubmodule, "before_update")
def _submodule_before_update(mapper, connection, target):  # noqa: ANN001
    _fill_submodule_kind_meta(connection, target)


class WorldModuleItem(Base):
    """模块项 - 具体的世界设定内容"""

    __tablename__ = "world_module_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    module_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("world_modules.id"), nullable=False
    )
    submodule_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("world_submodules.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[Optional[DocDict]] = mapped_column(JSON, nullable=True)

    # 元数据
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    module: Mapped["WorldModule"] = relationship(back_populates="items")
    submodule: Mapped[Optional["WorldSubmodule"]] = relationship(back_populates="items")


class WorldInstance(Base):
    """世界实例 - 基于模板创建的具体世界

    概念已取消（契约 §8），仅保留旧数据只读兼容；写接口在兼容层返回迁移指引。
    """

    __tablename__ = "world_instances"

    id = Column(String(36), primary_key=True, index=True)
    template_id = Column(String(36), ForeignKey("worlds.id"), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # 自定义配置
    custom_data = Column(JSON)  # 自定义数据覆盖

    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    template = relationship("World")
    project = relationship("Project", back_populates="world_instances")


class CustomWorldviewConfig(Base):
    """自定义世界观配置（旧表，Phase 6 下线）"""

    __tablename__ = "worldview_configs"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text)

    # 世界观类型 (使用 WorldviewType 枚举值)
    type = Column(String(50), nullable=False, index=True)

    # 基础配置
    time_scale = Column(String(50), nullable=False)
    tech_level = Column(String(50), nullable=False)
    magic_level = Column(String(50), nullable=False)
    political_complexity = Column(String(50), nullable=False)
    economic_system = Column(String(50), nullable=False)

    # 详细配置 (JSON 格式存储复杂对象)
    module_configs = Column(JSON)
    theme = Column(JSON)
    relation_rules = Column(JSON)
    presets = Column(JSON)

    # 元数据
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(36), nullable=True)
