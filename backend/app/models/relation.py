"""
跨模块引用系统 - 数据库模型

用于存储世界观各模块（历史、政治、经济、地图、种族、体系、特殊）之间的双向关联关系。
支持跨模块实体的相互引用和反向查询。
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.project import Project


class BidirectionalRelation(Base):
    """
    双向关联关系模型

    存储两个实体之间的关联关系，支持双向查询。
    例如：历史事件与政治实体之间的因果关系。

    Attributes:
        id: 关联唯一标识符
        source_*: 源实体信息（模块、类型、ID、名称）
        target_*: 目标实体信息（模块、类型、ID、名称）
        relation_type: 关系类型（因果、时间、空间、功能、层级、依赖）
        bidirectional: 是否为双向关联
        strength: 关联强度（强、中、弱）
        metadata_json: 扩展元数据（JSON格式）
        project_id: 所属项目ID
    """

    __tablename__ = "bidirectional_relations"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 源实体信息
    # 源模块类型：map, history, politics, economy, races, systems, special
    source_module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source_entity_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )  # 源实体UUID
    source_entity_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 目标实体信息
    # 目标模块类型
    target_module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_entity_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )  # 目标实体UUID
    target_entity_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 关系属性
    relation_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # causal, temporal, spatial, functional, hierarchical, dependency
    bidirectional: Mapped[bool] = mapped_column(Boolean, default=True)
    strength: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # strong, medium, weak

    # 扩展元数据（置信度、创建者、描述等）
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=True)

    # 项目关联
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False, index=True
    )

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    project: Mapped["Project"] = relationship(back_populates="relations")

    def __repr__(self) -> str:
        return (
            f"<BidirectionalRelation {self.source_entity_name} -> "
            f"{self.target_entity_name} ({self.relation_type})>"
        )
