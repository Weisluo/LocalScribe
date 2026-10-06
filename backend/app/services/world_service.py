"""World 服务：世界创建与默认模块骨架（契约 §2.1 / §2.2）。

契约 §2.2 要求「每个世界的七个 module_type 始终存在」，所以凡是新造 World 的地方
（/worlds 接口、旧关联的迁移容器世界）都必须走这里，避免出现零模块的世界。
"""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import DEFAULT_MODULE_SPECS, World, WorldModule


def create_default_modules(db: Session, world_id: str) -> List[WorldModule]:
    """插入七个空模块（只建骨架，不含任何世界观预设内容）。"""

    modules = [
        WorldModule(
            id=str(uuid.uuid4()),
            world_id=world_id,
            module_type=module_type,
            name=name,
            icon=icon,
            order_index=order_index,
            is_collapsible=True,
            is_required=False,
        )
        for order_index, (module_type, name, icon) in enumerate(DEFAULT_MODULE_SPECS)
    ]
    db.add_all(modules)
    db.flush()
    return modules


def create_world(
    db: Session,
    *,
    name: str,
    description: Optional[str] = None,
    cover_image: Optional[str] = None,
    project_id: Optional[str] = None,
    tone: Optional[Dict[str, Any]] = None,
    settings: Optional[Dict[str, Any]] = None,
    world_id: Optional[str] = None,
    with_default_modules: bool = True,
) -> World:
    """新建世界并补齐七个模块；world_id 可指定（迁移容器世界用确定性 UUID）。

    with_default_modules=False 用于「模块由调用方提供」的场景（如备份恢复，
    此时以备份里的模块为准，缺的类型再由调用方补齐），避免建出两套模块。
    """

    world = World(
        id=world_id or str(uuid.uuid4()),
        name=name,
        description=description,
        cover_image=cover_image,
        project_id=project_id,
        tone=tone,
        settings=settings,
    )
    db.add(world)
    db.flush()
    if with_default_modules:
        create_default_modules(db, world.id)
    return world
