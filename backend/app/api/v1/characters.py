"""
人物设定系统 - API路由

提供人物角色的完整CRUD接口，包括：
- 人物基础信息管理
- 别名管理
- 信息小卡片管理
- 人物关系管理
- 器物管理
"""

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlalchemy import asc, case, desc, func, or_
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_db
from app.core.logging import get_logger
from app.models.character import (
    Character,
    CharacterAlias,
    CharacterArtifact,
    CharacterCard,
    CharacterRelationship,
)
from app.models.project import Project
from app.schemas.character import (
    BatchDeleteRequest,
    BatchUpdateOrderRequest,
    CharacterAliasCreate,
    CharacterAliasResponse,
    CharacterAliasUpdate,
    CharacterArtifactCreate,
    CharacterArtifactResponse,
    CharacterArtifactUpdate,
    CharacterCardCreate,
    CharacterCardResponse,
    CharacterCardUpdate,
    CharacterCreate,
    CharacterDetailResponse,
    CharacterLevel,
    CharacterListItem,
    CharacterRelationshipCreate,
    CharacterRelationshipResponse,
    CharacterRelationshipUpdate,
    CharacterSimpleResponse,
    CharacterStats,
    CharacterUpdate,
)

logger = get_logger(__name__)
router = APIRouter()


# ==================== 辅助函数 ====================


def get_character_or_404(
    db: Session, character_id: str, project_id: str, load_relations: bool = False
) -> Character:
    """获取人物，如果不存在则返回404

    Args:
        load_relations: 是否预加载关联数据（别名、卡片、关系、器物）
    """
    query = db.query(Character).filter(
        Character.id == character_id, Character.project_id == project_id
    )

    if load_relations:
        query = query.options(
            selectinload(Character.aliases),
            selectinload(Character.cards),
            selectinload(Character.artifacts),
            selectinload(Character.relationships).selectinload(
                CharacterRelationship.target_character
            ),
        )

    character = query.first()
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"人物不存在: {character_id}",
        )
    return character


def build_character_query(db: Session, project_id: str):
    """构建人物查询，包含所有关联数据"""
    return (
        db.query(Character)
        .filter(Character.project_id == project_id)
        .options(
            selectinload(Character.aliases),
            selectinload(Character.cards),
            selectinload(Character.artifacts),
            selectinload(Character.relationships).selectinload(
                CharacterRelationship.target_character
            ),
        )
    )


# ==================== 人物主接口 ====================


@router.get(
    "/projects/{project_id}/characters",
    response_model=List[CharacterListItem],
    summary="获取人物列表",
    description="""
获取指定项目下的人物列表，支持多种筛选和排序方式。

**功能特性：**
- 按角色等级筛选（主角/重要配角/配角/小角色）
- 按姓名或别名模糊搜索
- 自定义排序字段和排序方向
- 预加载别名数据，避免 N+1 查询问题

**典型使用场景：**
1. 左侧人物栏展示：按排序索引升序排列
2. 搜索功能：通过 search 参数模糊匹配
3. 等级筛选：通过 level 参数筛选特定等级角色
    """,
)
def list_characters(
    project_id: str = Path(..., description="项目ID"),
    level: Optional[CharacterLevel] = Query(
        None,
        description="角色等级筛选：protagonist(主角), major_support(重要配角), support(配角), minor(小角色)",
    ),
    search: Optional[str] = Query(None, description="搜索关键词，匹配姓名或别名"),
    volume: Optional[str] = Query(None, description="筛选卷"),
    act: Optional[str] = Query(None, description="筛选幕"),
    chapter: Optional[str] = Query(None, description="筛选章"),
    sort_by: str = Query(
        "default",
        description="排序字段：default(默认-按等级+出场时间), order_index(自定义排序), name, created_at, updated_at",
    ),
    sort_order: str = Query("asc", description="排序方向：asc(升序), desc(降序)"),
    db: Session = Depends(get_db),
):
    """
    获取人物列表

    - 支持按等级筛选
    - 支持按姓名/别名搜索
    - 支持自定义排序
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    # 构建查询 - 使用 selectinload 预加载别名避免 N+1
    query = db.query(Character).filter(Character.project_id == project_id)

    # 应用筛选
    if level:
        query = query.filter(Character.level == level.value)

    if search:
        # 搜索姓名或别名 - 使用子查询避免 join 导致的重复记录问题
        search_pattern = f"%{search}%"
        alias_subquery = (
            db.query(CharacterAlias.character_id)
            .filter(CharacterAlias.content.ilike(search_pattern))
            .subquery()
        )
        query = query.filter(
            or_(
                Character.name.ilike(search_pattern),
                Character.id.in_(alias_subquery.select()),
            )
        )

    # 按出场章节筛选
    if volume:
        query = query.filter(Character.first_appearance_volume == volume)
    if act:
        query = query.filter(Character.first_appearance_act == act)
    if chapter:
        query = query.filter(Character.first_appearance_chapter == chapter)

    # 预加载关联数据（在分页/排序前应用）
    query = query.options(selectinload(Character.aliases))

    # 应用排序
    if sort_by == "default":
        # 默认排序：先按等级排序，同等级按出场时间排序
        # 等级顺序：protagonist(1) > major_support(2) > support(3) > minor(4)
        level_order = case(
            (Character.level == "protagonist", 1),
            (Character.level == "major_support", 2),
            (Character.level == "support", 3),
            (Character.level == "minor", 4),
            else_=5,
        )
        if sort_order.lower() == "desc":
            query = query.order_by(desc(level_order), desc(Character.first_appearance_volume), desc(Character.first_appearance_act), desc(Character.first_appearance_chapter))
        else:
            query = query.order_by(asc(level_order), asc(Character.first_appearance_volume), asc(Character.first_appearance_act), asc(Character.first_appearance_chapter))
    else:
        sort_column = getattr(Character, sort_by, Character.order_index)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

    characters = query.all()
    return characters


@router.post(
    "/projects/{project_id}/characters",
    response_model=CharacterDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建新人物",
    description="""
创建一个新的人物角色，支持一次性创建所有关联数据。

**功能特性：**
- 创建人物基础信息（姓名、性别、等级等）
- 同时创建别名（字、号、外号、称号）
- 同时创建信息小卡片（基础信息、外貌特征等）
- 同时创建人物关系（亲情、爱情、友情等）
- 同时创建器物（武器、法宝等）

**数据验证：**
- 姓名：必填，1-255字符
- 性别：male(男), female(女), other(其他), unknown(未知)
- 等级：protagonist(主角), major_support(重要配角), support(配角), minor(小角色)
- 关系强度：0-100 整数

**使用建议：**
- 首次创建时可仅填写基础信息，后续逐步完善
- 关系目标可以是已创建的人物ID，也可以是名称（待后续创建）
    """,
)
def create_character(
    project_id: str,
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
):
    """
    创建新人物

    可以一次性创建人物及其别名、卡片、关系、器物
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    try:
        # 创建人物主记录
        character = Character(
            project_id=project_id,
            name=character_data.name,
            gender=character_data.gender.value,
            birth_date=character_data.birth_date,
            birthplace=character_data.birthplace,
            race=character_data.race,
            faction=character_data.faction,
            level=character_data.level.value,
            quote=character_data.quote,
            avatar=character_data.avatar,
            full_image=character_data.full_image,
            first_appearance_volume=character_data.first_appearance_volume,
            first_appearance_act=character_data.first_appearance_act,
            first_appearance_chapter=character_data.first_appearance_chapter,
            last_appearance_volume=character_data.last_appearance_volume,
            last_appearance_act=character_data.last_appearance_act,
            last_appearance_chapter=character_data.last_appearance_chapter,
            order_index=character_data.order_index,
        )
        db.add(character)
        db.flush()  # 获取character.id

        # 创建别名
        for alias_data in character_data.aliases:
            alias = CharacterAlias(
                character_id=character.id,
                alias_type=alias_data.alias_type.value,
                content=alias_data.content,
                order_index=alias_data.order_index,
            )
            db.add(alias)

        # 创建卡片
        for card_data in character_data.cards:
            card = CharacterCard(
                character_id=character.id,
                title=card_data.title,
                icon=card_data.icon,
                content=[item.model_dump() for item in card_data.content],
                order_index=card_data.order_index,
            )
            db.add(card)

        # 创建关系
        for rel_data in character_data.relationships:
            relationship = CharacterRelationship(
                character_id=character.id,
                target_character_id=rel_data.target_character_id,
                target_name=rel_data.target_name,
                relation_type=rel_data.relation_type.value,
                description=rel_data.description,
                strength=rel_data.strength,
                is_bidirectional=rel_data.is_bidirectional,
                reverse_description=rel_data.reverse_description,
                order_index=rel_data.order_index,
            )
            db.add(relationship)

        # 创建器物
        for artifact_data in character_data.artifacts:
            artifact = CharacterArtifact(
                character_id=character.id,
                name=artifact_data.name,
                quote=artifact_data.quote,
                description=artifact_data.description,
                artifact_type=artifact_data.artifact_type,
                rarity=artifact_data.rarity.value if artifact_data.rarity else None,
                image=artifact_data.image,
                order_index=artifact_data.order_index,
            )
            db.add(artifact)

        db.commit()
        db.refresh(character)

        logger.info(f"创建人物成功: {character.name} (ID: {character.id})")
        return character

    except Exception as e:
        db.rollback()
        logger.error(f"创建人物失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建人物失败: {str(e)}",
        )


# ==================== 选择器接口 ====================


@router.get(
    "/projects/{project_id}/characters/simple",
    response_model=List[CharacterSimpleResponse],
)
def list_characters_simple(
    project_id: str,
    exclude_id: Optional[str] = Query(None, description="排除的人物ID（用于关系选择）"),
    db: Session = Depends(get_db),
):
    """
    获取人物简要列表（用于选择器）

    - 返回ID、名称、等级、头像
    - 可排除特定人物（避免选择自己作为关系目标）
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    query = db.query(Character).filter(Character.project_id == project_id)

    if exclude_id:
        query = query.filter(Character.id != exclude_id)

    characters = query.order_by(Character.order_index, Character.name).all()

    return [
        CharacterSimpleResponse(
            id=c.id,
            name=c.name,
            level=c.level,
            avatar=c.avatar,
        )
        for c in characters
    ]


@router.get(
    "/projects/{project_id}/characters/{character_id}",
    response_model=CharacterDetailResponse,
    summary="获取人物详情",
    description="""
获取指定人物的完整信息，包括所有关联数据。

**返回数据包含：**
- 人物基础信息（姓名、性别、等级、头像等）
- 别名列表（字、号、外号、称号）
- 信息小卡片列表（基础信息、外貌特征等）
- 人物关系列表（亲情、爱情、友情等）
- 器物列表（武器、法宝等）

**性能优化：**
- 使用 selectinload 预加载所有关联数据
- 避免多次数据库查询
    """,
)
def get_character(
    project_id: str = Path(..., description="项目ID"),
    character_id: str = Path(..., description="人物ID"),
    db: Session = Depends(get_db),
):
    """获取人物详情"""
    character = (
        build_character_query(db, project_id)
        .filter(Character.id == character_id)
        .first()
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"人物不存在: {character_id}",
        )

    return character


@router.put(
    "/projects/{project_id}/characters/{character_id}",
    response_model=CharacterDetailResponse,
    summary="更新人物信息",
    description="""
更新人物的基础信息，不包括关联数据。

**可更新字段：**
- 姓名、性别、生辰、出生地
- 角色等级、判词/引言
- 头像、全身形象图片
- 首次出场信息（卷/幕/章）
- 排序索引

**注意：**
- 别名、卡片、关系、器物需要通过各自的接口单独管理
- 仅更新请求中包含的字段（部分更新）
    """,
)
def update_character(
    project_id: str = Path(..., description="项目ID"),
    character_id: str = Path(..., description="人物ID"),
    character_data: CharacterUpdate = Body(..., description="人物更新数据"),
    db: Session = Depends(get_db),
):
    """更新人物信息"""
    character = get_character_or_404(db, character_id, project_id, load_relations=True)

    # 更新字段
    update_data = character_data.model_dump(exclude_unset=True)

    # 处理枚举字段
    if "gender" in update_data and update_data["gender"]:
        update_data["gender"] = update_data["gender"].value
    if "level" in update_data and update_data["level"]:
        update_data["level"] = update_data["level"].value

    for field, value in update_data.items():
        setattr(character, field, value)

    db.commit()
    db.refresh(character)

    logger.info(f"更新人物成功: {character.name} (ID: {character.id})")
    return character


@router.delete(
    "/projects/{project_id}/characters/{character_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除人物",
    description="""
删除指定人物及其所有关联数据。

**级联删除：**
- 人物主记录
- 所有别名（字、号、外号、称号）
- 所有信息小卡片
- 所有人物关系（作为发起人的关系）
- 所有器物

**警告：**
- 此操作不可逆
- 相关的人物关系会被级联删除
- 建议删除前先确认
    """,
)
def delete_character(
    project_id: str = Path(..., description="项目ID"),
    character_id: str = Path(..., description="人物ID"),
    db: Session = Depends(get_db),
):
    """删除人物"""
    character = get_character_or_404(db, character_id, project_id)

    db.delete(character)
    db.commit()

    logger.info(f"删除人物成功: {character_id}")
    return None


# ==================== 批量操作接口 ====================


@router.post(
    "/projects/{project_id}/characters/batch-delete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="批量删除人物",
    description="""
批量删除多个人物及其关联数据。

**功能特性：**
- 一次性删除多个人物
- 级联删除所有关联数据
- 原子操作，要么全部成功，要么全部失败

**请求体示例：**
```json
{
  "ids": ["char-uuid-1", "char-uuid-2", "char-uuid-3"]
}
```

**注意事项：**
- 仅删除属于指定项目的人物
- 如果某个ID不存在，会被忽略
- 返回实际删除的数量
    """,
)
def batch_delete_characters(
    project_id: str = Path(..., description="项目ID"),
    request: BatchDeleteRequest = Body(..., description="批量删除请求"),
    db: Session = Depends(get_db),
):
    """批量删除人物"""
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    deleted_count = (
        db.query(Character)
        .filter(Character.id.in_(request.ids), Character.project_id == project_id)
        .delete(synchronize_session=False)
    )
    db.commit()

    logger.info(f"批量删除人物成功: {deleted_count} 个")
    return None


@router.post(
    "/projects/{project_id}/characters/batch-update-order",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="批量更新人物排序",
    description="""
批量更新多个人物的排序索引。

**功能特性：**
- 支持拖拽排序后的批量更新
- 仅更新排序索引，不影响其他字段

**请求体示例：**
```json
{
  "orders": {
    "char-uuid-1": 0,
    "char-uuid-2": 1,
    "char-uuid-3": 2
  }
}
```

**使用场景：**
- 左侧人物栏拖拽排序
- 批量调整人物显示顺序
    """,
)
def batch_update_character_order(
    project_id: str = Path(..., description="项目ID"),
    request: BatchUpdateOrderRequest = Body(..., description="批量更新排序请求"),
    db: Session = Depends(get_db),
):
    """批量更新人物排序"""
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    for character_id, order_index in request.orders.items():
        character = (
            db.query(Character)
            .filter(Character.id == character_id, Character.project_id == project_id)
            .first()
        )
        if character:
            character.order_index = order_index

    db.commit()
    logger.info("批量更新人物排序成功")
    return None


# ==================== 别名管理接口 ====================


@router.get(
    "/projects/{project_id}/characters/{character_id}/aliases",
    response_model=List[CharacterAliasResponse],
)
def list_aliases(
    project_id: str,
    character_id: str,
    db: Session = Depends(get_db),
):
    """获取人物别名列表"""
    character = get_character_or_404(db, character_id, project_id)
    return character.aliases


@router.post(
    "/projects/{project_id}/characters/{character_id}/aliases",
    response_model=CharacterAliasResponse,
)
def create_alias(
    project_id: str,
    character_id: str,
    alias_data: CharacterAliasCreate,
    db: Session = Depends(get_db),
):
    """添加人物别名"""
    character = get_character_or_404(db, character_id, project_id)

    alias = CharacterAlias(
        character_id=character_id,
        alias_type=alias_data.alias_type.value,
        content=alias_data.content,
        order_index=alias_data.order_index,
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)

    logger.info(f"添加别名成功: {character.name} - {alias.content}")
    return alias


@router.put(
    "/projects/{project_id}/characters/{character_id}/aliases/{alias_id}",
    response_model=CharacterAliasResponse,
)
def update_alias(
    project_id: str,
    character_id: str,
    alias_id: str,
    alias_data: CharacterAliasUpdate,
    db: Session = Depends(get_db),
):
    """更新人物别名"""
    _ = get_character_or_404(db, character_id, project_id)

    alias = (
        db.query(CharacterAlias)
        .filter(
            CharacterAlias.id == alias_id, CharacterAlias.character_id == character_id
        )
        .first()
    )
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"别名不存在: {alias_id}",
        )

    update_data = alias_data.model_dump(exclude_unset=True)
    if "alias_type" in update_data and update_data["alias_type"]:
        update_data["alias_type"] = update_data["alias_type"].value

    for field, value in update_data.items():
        setattr(alias, field, value)

    db.commit()
    db.refresh(alias)
    return alias


@router.delete(
    "/projects/{project_id}/characters/{character_id}/aliases/{alias_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_alias(
    project_id: str,
    character_id: str,
    alias_id: str,
    db: Session = Depends(get_db),
):
    """删除人物别名"""
    _ = get_character_or_404(db, character_id, project_id)

    alias = (
        db.query(CharacterAlias)
        .filter(
            CharacterAlias.id == alias_id, CharacterAlias.character_id == character_id
        )
        .first()
    )
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"别名不存在: {alias_id}",
        )

    db.delete(alias)
    db.commit()
    return None


# ==================== 卡片管理接口 ====================


@router.get(
    "/projects/{project_id}/characters/{character_id}/cards",
    response_model=List[CharacterCardResponse],
)
def list_cards(
    project_id: str,
    character_id: str,
    db: Session = Depends(get_db),
):
    """获取人物卡片列表"""
    character = get_character_or_404(db, character_id, project_id)
    return character.cards


@router.post(
    "/projects/{project_id}/characters/{character_id}/cards",
    response_model=CharacterCardResponse,
)
def create_card(
    project_id: str,
    character_id: str,
    card_data: CharacterCardCreate,
    db: Session = Depends(get_db),
):
    """添加人物信息卡片"""
    character = get_character_or_404(db, character_id, project_id)

    card = CharacterCard(
        character_id=character_id,
        title=card_data.title,
        icon=card_data.icon,
        content=[item.model_dump() for item in card_data.content],
        order_index=card_data.order_index,
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    logger.info(f"添加卡片成功: {character.name} - {card.title}")
    return card


@router.put(
    "/projects/{project_id}/characters/{character_id}/cards/{card_id}",
    response_model=CharacterCardResponse,
)
def update_card(
    project_id: str,
    character_id: str,
    card_id: str,
    card_data: CharacterCardUpdate,
    db: Session = Depends(get_db),
):
    """更新人物信息卡片"""
    _ = get_character_or_404(db, character_id, project_id)

    card = (
        db.query(CharacterCard)
        .filter(CharacterCard.id == card_id, CharacterCard.character_id == character_id)
        .first()
    )
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"卡片不存在: {card_id}",
        )

    update_data = card_data.model_dump(exclude_unset=True)
    if "content" in update_data and update_data["content"]:
        update_data["content"] = [item.model_dump() for item in update_data["content"]]

    for field, value in update_data.items():
        setattr(card, field, value)

    db.commit()
    db.refresh(card)
    return card


@router.delete(
    "/projects/{project_id}/characters/{character_id}/cards/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_card(
    project_id: str,
    character_id: str,
    card_id: str,
    db: Session = Depends(get_db),
):
    """删除人物信息卡片"""
    _ = get_character_or_404(db, character_id, project_id)

    card = (
        db.query(CharacterCard)
        .filter(CharacterCard.id == card_id, CharacterCard.character_id == character_id)
        .first()
    )
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"卡片不存在: {card_id}",
        )

    db.delete(card)
    db.commit()
    return None


# ==================== 关系管理接口 ====================


@router.get(
    "/projects/{project_id}/characters/{character_id}/relationships",
    response_model=List[CharacterRelationshipResponse],
)
def list_relationships(
    project_id: str,
    character_id: str,
    db: Session = Depends(get_db),
):
    """获取人物关系列表"""
    character = (
        db.query(Character)
        .filter(Character.id == character_id, Character.project_id == project_id)
        .options(
            selectinload(Character.relationships).selectinload(
                CharacterRelationship.target_character
            )
        )
        .first()
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"人物不存在: {character_id}",
        )

    return character.relationships


@router.post(
    "/projects/{project_id}/characters/{character_id}/relationships",
    response_model=CharacterRelationshipResponse,
)
def create_relationship(
    project_id: str,
    character_id: str,
    relationship_data: CharacterRelationshipCreate,
    db: Session = Depends(get_db),
):
    """添加人物关系"""
    character = get_character_or_404(db, character_id, project_id)

    # 如果指定了目标人物ID，检查目标人物是否存在
    if relationship_data.target_character_id:
        target = (
            db.query(Character)
            .filter(
                Character.id == relationship_data.target_character_id,
                Character.project_id == project_id,
            )
            .first()
        )
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"目标人物不存在: {relationship_data.target_character_id}",
            )

    relationship = CharacterRelationship(
        character_id=character_id,
        target_character_id=relationship_data.target_character_id,
        target_name=relationship_data.target_name,
        relation_type=relationship_data.relation_type.value,
        description=relationship_data.description,
        strength=relationship_data.strength,
        is_bidirectional=relationship_data.is_bidirectional,
        reverse_description=relationship_data.reverse_description,
        order_index=relationship_data.order_index,
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)

    # 加载 target_character 关系
    if relationship.target_character_id:
        db.refresh(relationship, ["target_character"])

    logger.info(f"添加关系成功: {character.name}")
    return relationship


@router.put(
    "/projects/{project_id}/characters/{character_id}/relationships/{relationship_id}",
    response_model=CharacterRelationshipResponse,
)
def update_relationship(
    project_id: str,
    character_id: str,
    relationship_id: str,
    relationship_data: CharacterRelationshipUpdate,
    db: Session = Depends(get_db),
):
    """更新人物关系"""
    _ = get_character_or_404(db, character_id, project_id)

    relationship = (
        db.query(CharacterRelationship)
        .filter(
            CharacterRelationship.id == relationship_id,
            CharacterRelationship.character_id == character_id,
        )
        .first()
    )
    if not relationship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"关系不存在: {relationship_id}",
        )

    update_data = relationship_data.model_dump(exclude_unset=True)
    if "relation_type" in update_data and update_data["relation_type"]:
        update_data["relation_type"] = update_data["relation_type"].value

    for field, value in update_data.items():
        setattr(relationship, field, value)

    db.commit()
    db.refresh(relationship)
    return relationship


@router.delete(
    "/projects/{project_id}/characters/{character_id}/relationships/{relationship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_relationship(
    project_id: str,
    character_id: str,
    relationship_id: str,
    db: Session = Depends(get_db),
):
    """删除人物关系"""
    _ = get_character_or_404(db, character_id, project_id)

    relationship = (
        db.query(CharacterRelationship)
        .filter(
            CharacterRelationship.id == relationship_id,
            CharacterRelationship.character_id == character_id,
        )
        .first()
    )
    if not relationship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"关系不存在: {relationship_id}",
        )

    db.delete(relationship)
    db.commit()
    return None


# ==================== 器物管理接口 ====================


@router.get(
    "/projects/{project_id}/characters/{character_id}/artifacts",
    response_model=List[CharacterArtifactResponse],
)
def list_artifacts(
    project_id: str,
    character_id: str,
    db: Session = Depends(get_db),
):
    """获取人物器物列表"""
    character = get_character_or_404(db, character_id, project_id)
    return character.artifacts


@router.post(
    "/projects/{project_id}/characters/{character_id}/artifacts",
    response_model=CharacterArtifactResponse,
)
def create_artifact(
    project_id: str,
    character_id: str,
    artifact_data: CharacterArtifactCreate,
    db: Session = Depends(get_db),
):
    """添加人物器物"""
    character = get_character_or_404(db, character_id, project_id)

    artifact = CharacterArtifact(
        character_id=character_id,
        name=artifact_data.name,
        quote=artifact_data.quote,
        description=artifact_data.description,
        artifact_type=artifact_data.artifact_type,
        rarity=artifact_data.rarity.value if artifact_data.rarity else None,
        image=artifact_data.image,
        order_index=artifact_data.order_index,
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)

    logger.info(f"添加器物成功: {character.name} - {artifact.name}")
    return artifact


@router.put(
    "/projects/{project_id}/characters/{character_id}/artifacts/{artifact_id}",
    response_model=CharacterArtifactResponse,
)
def update_artifact(
    project_id: str,
    character_id: str,
    artifact_id: str,
    artifact_data: CharacterArtifactUpdate,
    db: Session = Depends(get_db),
):
    """更新人物器物"""
    _ = get_character_or_404(db, character_id, project_id)

    artifact = (
        db.query(CharacterArtifact)
        .filter(
            CharacterArtifact.id == artifact_id,
            CharacterArtifact.character_id == character_id,
        )
        .first()
    )
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"器物不存在: {artifact_id}",
        )

    update_data = artifact_data.model_dump(exclude_unset=True)

    if "rarity" in update_data and update_data["rarity"] is not None:
        update_data["rarity"] = update_data["rarity"].value

    for field, value in update_data.items():
        setattr(artifact, field, value)

    db.commit()
    db.refresh(artifact)
    return artifact


@router.delete(
    "/projects/{project_id}/characters/{character_id}/artifacts/{artifact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_artifact(
    project_id: str,
    character_id: str,
    artifact_id: str,
    db: Session = Depends(get_db),
):
    """删除人物器物"""
    _ = get_character_or_404(db, character_id, project_id)

    artifact = (
        db.query(CharacterArtifact)
        .filter(
            CharacterArtifact.id == artifact_id,
            CharacterArtifact.character_id == character_id,
        )
        .first()
    )
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"器物不存在: {artifact_id}",
        )

    db.delete(artifact)
    db.commit()
    return None


# ==================== 统计接口 ====================


@router.get("/projects/{project_id}/characters/stats", response_model=CharacterStats)
def get_character_stats(
    project_id: str,
    db: Session = Depends(get_db),
):
    """获取人物统计数据"""
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"项目不存在: {project_id}",
        )

    # 统计总数
    total = db.query(Character).filter(Character.project_id == project_id).count()

    # 按等级统计
    level_stats = (
        db.query(Character.level, func.count(Character.id))
        .filter(Character.project_id == project_id)
        .group_by(Character.level)
        .all()
    )
    by_level = {level: count for level, count in level_stats}

    # 按性别统计
    gender_stats = (
        db.query(Character.gender, func.count(Character.id))
        .filter(Character.project_id == project_id)
        .group_by(Character.gender)
        .all()
    )
    by_gender = {gender: count for gender, count in gender_stats}

    return CharacterStats(
        total=total,
        by_level=by_level,
        by_gender=by_gender,
    )
