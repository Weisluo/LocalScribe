"""
跨模块引用系统 - 数据库模型

用于存储世界观各模块（历史、政治、经济、地图、种族、体系、特殊）之间的关联关系。
Phase 1 决策 D1 起 world_links 是唯一关系来源；Phase 6 P6-T11 删除旧的双向关联表。
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class WorldLink(Base):
    """世界关联（WorldLink） - 契约 §2.5

    跨模块或模块内两个实体之间的唯一关联存储；不再把关联写进 item.content。
    源/目标用 source_module/source_kind/source_id 与 target_module/target_kind/target_id
    表达 EntityRef；对称关联只落一条（directed=False，反向按 link_type 匹配展示）。
    """

    __tablename__ = "world_links"
    __table_args__ = (
        Index("ix_world_links_world_source", "world_id", "source_module", "source_id"),
        Index("ix_world_links_world_target", "world_id", "target_module", "target_id"),
        Index("ix_world_links_world_type", "world_id", "link_type"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    world_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("worlds.id"), nullable=False
    )

    # 源实体
    source_module: Mapped[str] = mapped_column(String(50), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(100), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # 目标实体
    target_module: Mapped[str] = mapped_column(String(50), nullable=False)
    target_kind: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # 关联语义
    link_type: Mapped[str] = mapped_column(String(50), nullable=False)
    directed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    meta: Mapped[Optional[Dict[str, Any]]] = mapped_column("meta", JSON, nullable=True)
    time_range: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "time", JSON, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<WorldLink {self.source_module}:{self.source_id} "
            f"-[{self.link_type}]-> {self.target_module}:{self.target_id}>"
        )
