"""
人物设定系统 - 数据库模型

提供人物角色管理功能，包括：
- 人物基础信息（姓名、性别、等级等）
- 别名系统（字、号、外号、称号等）
- 信息小卡片（自定义字段）
- 人物关系
- 器物
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.project import Project


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


class Character(Base):
    """
    人物主表

    存储人物的基础信息和元数据
    """

    __tablename__ = "characters"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 所属项目
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False, index=True
    )

    # 基础信息
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="姓名"
    )
    gender: Mapped[str] = mapped_column(
        String(20), default="unknown", comment="性别"
    )
    birth_date: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="生辰"
    )
    birthplace: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="出生地"
    )

    # 种族
    race: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="种族"
    )

    # 阵营归属
    faction: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="阵营归属"
    )

    # 角色等级
    level: Mapped[str] = mapped_column(
        String(20), default="minor", comment="角色等级"
    )

    # 判词/引言
    quote: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="判词/引言"
    )

    # 人物形象图片
    avatar: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="头像URL"
    )
    full_image: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="全身形象图片URL"
    )

    # 出场信息
    first_appearance_volume: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="首次出场卷"
    )
    first_appearance_act: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="首次出场幕"
    )
    first_appearance_chapter: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="首次出场章"
    )
    last_appearance_volume: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="最后出场卷"
    )
    last_appearance_act: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="最后出场幕"
    )
    last_appearance_chapter: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="最后出场章"
    )

    # 排序索引
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序索引"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    project: Mapped["Project"] = relationship(back_populates="characters")
    aliases: Mapped[List["CharacterAlias"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterAlias.order_index",
    )
    cards: Mapped[List["CharacterCard"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterCard.order_index",
    )
    relationships: Mapped[List["CharacterRelationship"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        foreign_keys="CharacterRelationship.character_id",
    )
    artifacts: Mapped[List["CharacterArtifact"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterArtifact.order_index",
    )

    def __repr__(self) -> str:
        return f"<Character {self.name}>"


class CharacterAlias(Base):
    """
    人物别名表

    存储人物的字、号、外号、称号等别名信息
    支持自定义别名类型
    """

    __tablename__ = "character_aliases"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 所属人物
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=False, index=True
    )

    # 别名类型
    alias_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="别名类型: zi(字), hao(号), nickname(外号), title(称号), other(其他)"
    )

    # 别名内容
    content: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="别名内容"
    )

    # 排序索引
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序索引"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    character: Mapped["Character"] = relationship(back_populates="aliases")

    def __repr__(self) -> str:
        return f"<CharacterAlias {self.alias_type}: {self.content}>"


class CharacterCard(Base):
    """
    人物信息小卡片表

    存储人物的自定义信息卡片，如基础信息、外貌特征、性格画像等
    每个卡片包含自定义的字段内容（JSON格式）
    """

    __tablename__ = "character_cards"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 所属人物
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=False, index=True
    )

    # 卡片信息
    title: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="卡片标题"
    )
    icon: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="卡片图标"
    )

    # 卡片内容（JSON格式，存储自定义字段）
    # 格式: [{"key": "字段名", "value": "字段值", "type": "text|rich_text|list|image"}, ...]
    content: Mapped[dict] = mapped_column(
        JSON, default=list, comment="卡片内容"
    )

    # 排序索引
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序索引"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    character: Mapped["Character"] = relationship(back_populates="cards")

    def __repr__(self) -> str:
        return f"<CharacterCard {self.title}>"


class CharacterRelationship(Base):
    """
    人物关系表

    存储人物之间的关系，如亲情、爱情、友情、师徒、敌对关系等
    """

    __tablename__ = "character_relationships"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 关系发起人（本人物）
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=False, index=True
    )

    # 关系目标人物
    target_character_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=True, index=True
    )

    # 目标人物名称（如果目标人物未创建，可以只存名称）
    target_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="目标人物名称"
    )

    # 关系类型
    relation_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="关系类型: family(亲情), love(爱情), friend(友情), master(师父), apprentice(徒弟), enemy(敌对), other(其他)"
    )

    # 关系描述
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="关系描述"
    )

    # 关系强度/亲密度
    strength: Mapped[int] = mapped_column(
        Integer, default=50, comment="关系强度 0-100"
    )

    # 是否为双向关系
    is_bidirectional: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="是否为双向关系"
    )

    # 反向关系描述（如A视B为师父，B视A为徒弟）
    reverse_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="反向关系描述"
    )

    # 排序索引
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序索引"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    character: Mapped["Character"] = relationship(
        back_populates="relationships",
        foreign_keys=[character_id]
    )
    target_character: Mapped[Optional["Character"]] = relationship(
        foreign_keys=[target_character_id]
    )

    def __repr__(self) -> str:
        return f"<CharacterRelationship {self.relation_type}>"


class CharacterArtifact(Base):
    """
    人物器物表

    存储人物拥有的器物、法宝、武器等物品
    """

    __tablename__ = "character_artifacts"

    # 主键
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # 所属人物
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=False, index=True
    )

    # 器物信息
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="器物名称"
    )
    quote: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="器物判词"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="器物描述"
    )

    # 器物类型（自定义）
    artifact_type: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="器物类型（自定义）"
    )

    # 器物等级
    rarity: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="器物等级: legendary(神器), epic(传说), rare(稀有), common(普通)"
    )

    # 器物图片
    image: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="器物图片URL"
    )

    # 排序索引
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序索引"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM关系
    character: Mapped["Character"] = relationship(back_populates="artifacts")

    def __repr__(self) -> str:
        return f"<CharacterArtifact {self.name}>"
