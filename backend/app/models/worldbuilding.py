from sqlalchemy import Column, String, Text, JSON, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base

class WorldTemplate(Base):
    """世界模板 - 可重用的世界观模板"""
    __tablename__ = "world_templates"
    
    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)  # 世界名
    description = Column(Text)  # 世界描述
    cover_image = Column(String(500))  # 封面图片URL
    tags = Column(JSON)  # 标签列表
    is_public = Column(Boolean, default=False)  # 是否公开
    is_system_template = Column(Boolean, default=False)  # 是否系统模板
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)  # 所属项目

    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(36), nullable=True)  # 用户ID，暂不设置外键约束
    
    # 关系
    modules = relationship("WorldModule", back_populates="template", cascade="all, delete-orphan")
    instances = relationship("WorldInstance", back_populates="template", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="world_templates")

class WorldModule(Base):
    """世界模块 - 地图、历史、政治、经济、种族、体系、特殊"""
    __tablename__ = "world_modules"
    
    id = Column(String(36), primary_key=True, index=True)
    template_id = Column(String(36), ForeignKey("world_templates.id"), nullable=False)
    module_type = Column(String(50), nullable=False, index=True)  # 模块类型: map, history, politics, economy, races, systems, special
    name = Column(String(255), nullable=False)  # 模块名称
    description = Column(Text)  # 模块描述
    icon = Column(String(100))  # 模块图标
    order_index = Column(Integer, default=0)  # 排序索引
    
    # 配置
    is_collapsible = Column(Boolean, default=True)  # 是否可折叠
    is_required = Column(Boolean, default=False)  # 是否必需
    
    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    template = relationship("WorldTemplate", back_populates="modules")
    submodules = relationship("WorldSubmodule", back_populates="module", cascade="all, delete-orphan")
    items = relationship("WorldModuleItem", back_populates="module", cascade="all, delete-orphan")

class WorldSubmodule(Base):
    """子模块 - 模块下的分类（如种族下的不同种族）
    
    对于历史模块：
    - 时代：parent_id 为 null
    - 事件：parent_id 指向时代
    """
    __tablename__ = "world_submodules"
    
    id = Column(String(36), primary_key=True, index=True)
    module_id = Column(String(36), ForeignKey("world_modules.id"), nullable=False)
    parent_id = Column(String(36), ForeignKey("world_submodules.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, default=0)
    
    # 配置
    color = Column(String(20))  # 颜色标识
    icon = Column(String(100))  # 图标
    
    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    module = relationship("WorldModule", back_populates="submodules")
    items = relationship("WorldModuleItem", back_populates="submodule", cascade="all, delete-orphan")
    children = relationship("WorldSubmodule", backref="parent", remote_side=[id], cascade="all, delete-orphan", single_parent=True)

class WorldModuleItem(Base):
    """模块项 - 具体的世界设定内容"""
    __tablename__ = "world_module_items"
    
    id = Column(String(36), primary_key=True, index=True)
    module_id = Column(String(36), ForeignKey("world_modules.id"), nullable=False)
    submodule_id = Column(String(36), ForeignKey("world_submodules.id"), nullable=True)
    name = Column(String(255), nullable=False)
    content = Column(JSON)  # 结构化内容
    
    # 元数据
    order_index = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    module = relationship("WorldModule", back_populates="items")
    submodule = relationship("WorldSubmodule", back_populates="items")

class WorldInstance(Base):
    """世界实例 - 基于模板创建的具体世界"""
    __tablename__ = "world_instances"

    id = Column(String(36), primary_key=True, index=True)
    template_id = Column(String(36), ForeignKey("world_templates.id"), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # 自定义配置
    custom_data = Column(JSON)  # 自定义数据覆盖

    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系
    template = relationship("WorldTemplate", back_populates="instances")
    project = relationship("Project", back_populates="world_instances")