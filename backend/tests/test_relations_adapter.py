"""旧 /relations 服务 -> world_links 适配层测试（自包含，不依赖 FastAPI）。

- 用 alembic API 把临时 SQLite 升级到 head（覆盖 sqlalchemy.url，script_location=migrations）
- 只用原生 SQLAlchemy Session + app.models ORM，不用 TestClient，
  也不使用 app.core.database 的引擎/会话（它在导入时就绑到开发库）
- 迁移只跑一次（module 级），每个用例复制空库文件获得隔离，控制总运行时间
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Dict, Iterator, Optional, Tuple

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    BidirectionalRelation,
    Project,
    World,
    WorldLink,
    WorldModule,
    WorldSubmodule,
)
from app.schemas.relation import (
    ModuleType,
    RelationCreate,
    RelationResponse,
    RelationType,
    RelationUpdate,
    StrengthType,
)
from app.services.link_service import LinkService, resolve_project_world
from app.services.relation_service import RelationService

BACKEND_DIR = Path(__file__).resolve().parents[1]

EndpointRef = Tuple[str, str]


def _alembic_config(db_path: Path) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path.as_posix()}")
    return config


@pytest.fixture(scope="module")
def migrated_db(tmp_path_factory) -> Path:
    """升级到 head 的空库（模块内只迁移一次，避免每个用例几百毫秒的重复开销）。"""

    db_path = tmp_path_factory.mktemp("relations-adapter") / "head.db"
    command.upgrade(_alembic_config(db_path), "head")
    return db_path


@pytest.fixture()
def db_session(migrated_db: Path, tmp_path: Path) -> Iterator[Session]:
    """每个用例一个复制出来的空 head 库 + 原生 Session。"""

    db_path = tmp_path / "relations_adapter.db"
    shutil.copyfile(migrated_db, db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _seed(db: Session) -> Dict[str, str]:
    """最小世界观数据：一个项目/世界 + history/politics/economy 模块与子模块。"""

    project = Project(id="P-ADAPTER", title="适配层测试项目")
    world = World(id="W-ADAPTER", name="测试世界", project_id=project.id)
    db.add_all([project, world])
    db.flush()

    history = WorldModule(
        id="M-HISTORY", world_id=world.id, module_type="history", name="历史"
    )
    politics = WorldModule(
        id="M-POLITICS", world_id=world.id, module_type="politics", name="政治"
    )
    economy = WorldModule(
        id="M-ECONOMY", world_id=world.id, module_type="economy", name="经济"
    )
    db.add_all([history, politics, economy])
    db.flush()

    event = WorldSubmodule(
        id="S-EVENT", module_id=history.id, name="大战", kind="event"
    )
    polity = WorldSubmodule(
        id="S-POLITY", module_id=politics.id, name="旧政权", kind="polity"
    )
    organization = WorldSubmodule(
        id="S-ORG", module_id=politics.id, name="枢密院", kind="organization"
    )
    industry = WorldSubmodule(
        id="S-INDUSTRY", module_id=economy.id, name="冶铁业", kind="industry"
    )
    good = WorldSubmodule(id="S-GOOD", module_id=economy.id, name="铁器", kind="good")
    db.add_all([event, polity, organization, industry, good])
    db.commit()

    return {
        "project_id": project.id,
        "world_id": world.id,
        "event_id": event.id,
        "event_name": event.name,
        "polity_id": polity.id,
        "polity_name": polity.name,
        "org_id": organization.id,
        "org_name": organization.name,
        "industry_id": industry.id,
        "industry_name": industry.name,
        "good_id": good.id,
        "good_name": good.name,
    }


@pytest.fixture()
def ids(db_session: Session) -> Dict[str, str]:
    return _seed(db_session)


# (module, kind) -> (id 键, name 键)
_ENDPOINTS = {
    ("history", "event"): ("event_id", "event_name"),
    ("politics", "polity"): ("polity_id", "polity_name"),
    ("politics", "organization"): ("org_id", "org_name"),
    ("economy", "industry"): ("industry_id", "industry_name"),
    ("economy", "good"): ("good_id", "good_name"),
}


def _payload(
    ids: Dict[str, str],
    source_ref: EndpointRef,
    target_ref: EndpointRef,
    relation_type: RelationType,
    bidirectional: bool = False,
    strength: StrengthType = StrengthType.MEDIUM,
    metadata: Optional[Dict[str, object]] = None,
) -> RelationCreate:
    """按旧 RelationCreate 形状构造请求。"""

    source_id_key, source_name_key = _ENDPOINTS[source_ref]
    target_id_key, target_name_key = _ENDPOINTS[target_ref]
    return RelationCreate(
        source_module=ModuleType(source_ref[0]),
        source_entity_type=source_ref[1],
        source_entity_id=ids[source_id_key],
        source_entity_name=ids[source_name_key],
        target_module=ModuleType(target_ref[0]),
        target_entity_type=target_ref[1],
        target_entity_id=ids[target_id_key],
        target_entity_name=ids[target_name_key],
        relation_type=relation_type,
        bidirectional=bidirectional,
        strength=strength,
        metadata=dict(metadata) if metadata else None,
        project_id=ids["project_id"],
    )


def _causal_payload(ids: Dict[str, str], bidirectional: bool = False) -> RelationCreate:
    """历史事件 -> 政治政权 的因果关联（映射到 history.causes）。"""

    return _payload(
        ids,
        ("history", "event"),
        ("politics", "polity"),
        RelationType.CAUSAL,
        bidirectional=bidirectional,
        strength=StrengthType.STRONG,
        metadata={"confidence": 0.9},
    )


def test_create_relation_writes_world_link_only(
    db_session: Session, ids: Dict[str, str]
) -> None:
    response = RelationService.create_relation(db_session, _causal_payload(ids))

    links = db_session.query(WorldLink).all()
    assert len(links) == 1
    link = links[0]
    assert link.world_id == ids["world_id"]
    assert (link.source_module, link.source_kind, link.source_id) == (
        "history",
        "event",
        ids["event_id"],
    )
    assert (link.target_module, link.target_kind, link.target_id) == (
        "politics",
        "polity",
        ids["polity_id"],
    )
    assert link.link_type == "history.causes"
    assert link.directed is True
    assert link.label is None
    assert link.note is None

    assert link.meta["legacyRelationType"] == "causal"
    assert link.meta["strength"] == "strong"
    assert link.meta["legacySourceName"] == ids["event_name"]
    assert link.meta["legacyTargetName"] == ids["polity_name"]
    assert link.meta["projectId"] == ids["project_id"]
    assert link.meta["confidence"] == 0.9

    # 旧表只读：不新增、不双写
    assert db_session.query(BidirectionalRelation).count() == 0

    assert isinstance(response, RelationResponse)
    assert response.id == link.id
    assert response.relation_type == "causal"
    assert response.strength == "strong"
    assert response.bidirectional is False
    assert response.source_entity_type == "event"
    assert response.source_entity_name == ids["event_name"]
    assert response.target_entity_name == ids["polity_name"]
    assert response.metadata_json == {"confidence": 0.9}
    assert response.project_id == ids["project_id"]
    assert response.created_at is not None
    assert response.updated_at is not None


def test_get_relation_by_id_round_trips_legacy_shape(
    db_session: Session, ids: Dict[str, str]
) -> None:
    created = RelationService.create_relation(db_session, _causal_payload(ids))

    fetched = RelationService.get_relation_by_id(db_session, created.id)
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.relation_type == "causal"
    assert fetched.source_entity_id == ids["event_id"]
    assert fetched.target_entity_id == ids["polity_id"]
    assert fetched.bidirectional is False
    assert RelationService.get_relation_by_id(db_session, "missing-id") is None


def test_read_falls_back_to_entity_lookup_for_links_api_rows(
    db_session: Session, ids: Dict[str, str]
) -> None:
    """经 /links 服务写入的关联没有 legacy 名称，读取时按 id 反查子模块名。"""

    link = LinkService.create_link(
        db_session,
        ids["world_id"],
        {
            "source": {
                "module": "politics",
                "kind": "organization",
                "id": ids["org_id"],
            },
            "target": {"module": "politics", "kind": "polity", "id": ids["polity_id"]},
            "link_type": "politics.subordinate_to",
        },
    )

    response = RelationService.get_relation_by_id(db_session, link.id)
    assert response is not None
    assert response.source_entity_name == ids["org_name"]
    assert response.target_entity_name == ids["polity_name"]
    assert response.relation_type == "hierarchical"
    assert response.strength == "medium"
    assert response.metadata_json is None
    assert response.project_id == ids["project_id"]


@pytest.mark.parametrize(
    ("relation_type", "source_ref", "target_ref", "expected_link_type"),
    [
        (
            RelationType.CAUSAL,
            ("history", "event"),
            ("politics", "polity"),
            "history.causes",
        ),
        (
            RelationType.DEPENDENCY,
            ("economy", "industry"),
            ("economy", "good"),
            "economy.requires",
        ),
        (
            RelationType.HIERARCHICAL,
            ("politics", "organization"),
            ("politics", "polity"),
            "politics.subordinate_to",
        ),
    ],
)
def test_legacy_relation_type_maps_to_contract_type(
    db_session: Session,
    ids: Dict[str, str],
    relation_type: RelationType,
    source_ref: EndpointRef,
    target_ref: EndpointRef,
    expected_link_type: str,
) -> None:
    response = RelationService.create_relation(
        db_session, _payload(ids, source_ref, target_ref, relation_type)
    )

    link = db_session.query(WorldLink).one()
    assert link.link_type == expected_link_type
    assert link.directed is True
    assert link.meta["legacyRelationType"] == relation_type.value
    assert response.relation_type == relation_type.value


def test_bidirectional_flag_wins_over_causal_mapping(
    db_session: Session, ids: Dict[str, str]
) -> None:
    """bidirectional=True 一律落 core.related_to（与 P1-MIG-05 回填口径一致）。

    对称标志必须能读回、对称边只落一条，因此此时不做 causal 的语义映射。
    """

    response = RelationService.create_relation(
        db_session, _causal_payload(ids, bidirectional=True)
    )

    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.related_to"
    assert link.directed is False
    assert response.bidirectional is True
    # 旧枚举仍从 meta 记账键读回
    assert response.relation_type == "causal"
    assert response.strength == "strong"

    # 反向重复边是对称边，必须被去重（不新增第二行）
    reversed_payload = _payload(
        ids,
        ("politics", "polity"),
        ("history", "event"),
        RelationType.CAUSAL,
        bidirectional=True,
        strength=StrengthType.STRONG,
    )
    duplicate = RelationService.create_relation(db_session, reversed_payload)
    assert duplicate.id == response.id
    assert duplicate.bidirectional is True
    assert db_session.query(WorldLink).count() == 1

    batched = RelationService.batch_create_relations(db_session, [reversed_payload])
    assert [item.id for item in batched] == [response.id]
    assert db_session.query(WorldLink).count() == 1


def test_unmapped_relation_type_falls_back_to_general_types(
    db_session: Session, ids: Dict[str, str]
) -> None:
    directed = RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("history", "event"),
            ("politics", "polity"),
            RelationType.TEMPORAL,
        ),
    )
    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.references"
    assert link.directed is True
    assert directed.relation_type == "temporal"
    assert directed.bidirectional is False


def test_symmetric_fallback_uses_related_to(
    db_session: Session, ids: Dict[str, str]
) -> None:
    response = RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("history", "event"),
            ("politics", "polity"),
            RelationType.FUNCTIONAL,
            bidirectional=True,
        ),
    )

    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.related_to"
    assert link.directed is False
    assert response.bidirectional is True
    assert response.relation_type == "functional"


def test_invalid_kind_pair_for_mapped_type_degrades_to_general(
    db_session: Session, ids: Dict[str, str]
) -> None:
    """causal 的映射类型要求 history.event 为源，方向相反时降级 core.references。"""

    response = RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("politics", "polity"),
            ("history", "event"),
            RelationType.CAUSAL,
        ),
    )

    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.references"
    assert link.directed is True
    # meta 记账键优先，旧枚举不丢失
    assert response.relation_type == "causal"


def test_batch_create_symmetric_edge_twice_yields_one_row(
    db_session: Session, ids: Dict[str, str]
) -> None:
    forward = _payload(
        ids,
        ("history", "event"),
        ("politics", "polity"),
        RelationType.FUNCTIONAL,
        bidirectional=True,
    )
    reverse = _payload(
        ids,
        ("politics", "polity"),
        ("history", "event"),
        RelationType.FUNCTIONAL,
        bidirectional=True,
    )

    first = RelationService.batch_create_relations(db_session, [forward])
    second = RelationService.batch_create_relations(db_session, [reverse, forward])

    assert len(first) == 1
    assert len(second) == 2
    assert db_session.query(WorldLink).count() == 1
    assert first[0].id == second[0].id == second[1].id
    assert second[1].bidirectional is True

    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.related_to"
    assert link.directed is False


def test_get_project_relations_and_filters(
    db_session: Session, ids: Dict[str, str]
) -> None:
    RelationService.create_relation(db_session, _causal_payload(ids))
    RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("politics", "organization"),
            ("politics", "polity"),
            RelationType.HIERARCHICAL,
        ),
    )

    everything = RelationService.get_project_relations(db_session, ids["project_id"])
    assert len(everything) == 2
    assert {item.relation_type for item in everything} == {"causal", "hierarchical"}

    history_sources = RelationService.get_project_relations(
        db_session, ids["project_id"], source_module="history"
    )
    assert [item.relation_type for item in history_sources] == ["causal"]

    politics_targets = RelationService.get_project_relations(
        db_session, ids["project_id"], target_module="politics"
    )
    assert len(politics_targets) == 2

    hierarchical = RelationService.get_project_relations(
        db_session, ids["project_id"], relation_type="hierarchical"
    )
    assert [item.source_entity_id for item in hierarchical] == [ids["org_id"]]

    assert RelationService.get_project_relations(db_session, "P-MISSING") == []


def test_get_relation_statistics_shape(
    db_session: Session, ids: Dict[str, str]
) -> None:
    RelationService.create_relation(db_session, _causal_payload(ids))
    RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("history", "event"),
            ("politics", "polity"),
            RelationType.FUNCTIONAL,
            bidirectional=True,
        ),
    )

    stats = RelationService.get_relation_statistics(db_session, ids["project_id"])
    assert stats.total_relations == 2
    assert stats.bidirectional_count == 1
    assert stats.by_module == {"history": 2}
    assert stats.by_relation_type == {"causal": 1, "functional": 1}
    assert stats.by_strength == {"strong": 1, "medium": 1}
    assert stats.cross_module_relations == 2

    top = stats.top_connected_entities
    assert top[0]["entity_id"] == ids["event_id"]
    assert top[0]["module"] == "history"
    assert top[0]["entity_name"] == ids["event_name"]
    assert top[0]["connection_count"] == 2

    assert stats.total_relations == sum(stats.by_relation_type.values())
    assert stats.total_relations == sum(stats.by_strength.values())
    assert (
        RelationService.get_relation_statistics(db_session, "P-MISSING").total_relations
        == 0
    )


def test_entity_relation_network_splits_incoming_outgoing_bidirectional(
    db_session: Session, ids: Dict[str, str]
) -> None:
    RelationService.create_relation(db_session, _causal_payload(ids))
    RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("politics", "polity"),
            ("history", "event"),
            RelationType.FUNCTIONAL,
            bidirectional=True,
        ),
    )

    network = RelationService.get_entity_relation_network(
        db_session, ids["project_id"], ids["event_id"]
    )
    assert network.entity.entity_id == ids["event_id"]
    assert network.entity.module == ModuleType.HISTORY
    assert [item.relation_type for item in network.outgoing] == ["causal"]
    assert network.incoming == []
    assert len(network.bidirectional) == 1
    assert network.total_count == 2

    polity_network = RelationService.get_entity_relation_network(
        db_session, ids["project_id"], ids["polity_id"]
    )
    assert [item.relation_type for item in polity_network.incoming] == ["causal"]
    assert len(polity_network.bidirectional) == 1

    filtered = RelationService.get_entity_relation_network(
        db_session, ids["project_id"], ids["event_id"], module_filter="economy"
    )
    assert filtered.total_count == 0
    assert filtered.entity.entity_type == "unknown"


def test_delete_relation_removes_world_link_and_checks_project(
    db_session: Session, ids: Dict[str, str]
) -> None:
    created = RelationService.create_relation(db_session, _causal_payload(ids))

    assert (
        RelationService.delete_relation(
            db_session, created.id, project_id=ids["project_id"]
        )
        is True
    )
    assert db_session.query(WorldLink).count() == 0
    assert (
        RelationService.delete_relation(
            db_session, created.id, project_id=ids["project_id"]
        )
        is False
    )

    db_session.add(Project(id="P-OTHER", title="别的项目"))
    db_session.commit()
    created_again = RelationService.create_relation(db_session, _causal_payload(ids))
    assert (
        RelationService.delete_relation(
            db_session, created_again.id, project_id="P-OTHER"
        )
        is False
    )
    assert db_session.query(WorldLink).count() == 1


def test_update_relation_fields_and_missing_id(
    db_session: Session, ids: Dict[str, str]
) -> None:
    created = RelationService.create_relation(db_session, _causal_payload(ids))

    updated = RelationService.update_relation(
        db_session,
        created.id,
        RelationUpdate(
            strength=StrengthType.WEAK,
            metadata={"confidence": 0.1, "legacyRelationType": "functional"},
        ),
        project_id=ids["project_id"],
    )
    assert updated is not None
    assert updated.strength == "weak"
    # 合并而非替换；客户端 metadata 不能覆盖记账键
    assert updated.metadata_json == {"confidence": 0.1}
    assert updated.relation_type == "causal"

    symmetric = RelationService.update_relation(
        db_session,
        created.id,
        RelationUpdate(bidirectional=True),
        project_id=ids["project_id"],
    )
    assert symmetric is not None
    assert symmetric.bidirectional is True
    link = db_session.query(WorldLink).one()
    assert link.link_type == "core.related_to"
    assert link.directed is False
    assert link.meta["legacyRelationType"] == "causal"

    directed_again = RelationService.update_relation(
        db_session,
        created.id,
        RelationUpdate(bidirectional=False, relation_type=RelationType.CAUSAL),
        project_id=ids["project_id"],
    )
    assert directed_again is not None
    assert directed_again.relation_type == "causal"
    assert db_session.query(WorldLink).one().link_type == "history.causes"

    assert (
        RelationService.update_relation(
            db_session, "missing-id", RelationUpdate(), project_id=ids["project_id"]
        )
        is None
    )

    db_session.add(Project(id="P-OTHER", title="别的项目"))
    db_session.commit()
    assert (
        RelationService.update_relation(
            db_session,
            created.id,
            RelationUpdate(strength=StrengthType.STRONG),
            project_id="P-OTHER",
        )
        is None
    )


def test_discover_relations_keeps_rule_table_and_contract_types(
    db_session: Session, ids: Dict[str, str]
) -> None:
    RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("politics", "organization"),
            ("politics", "polity"),
            RelationType.HIERARCHICAL,
        ),
    )

    discovery = RelationService.discover_relations(
        db_session,
        ids["project_id"],
        ids["event_id"],
        ModuleType.HISTORY,
        "event",
        ids["event_name"],
    )
    assert discovery.entity.entity_id == ids["event_id"]
    assert discovery.entity.entity_type == "event"
    assert discovery.total_count == 1
    item = discovery.discoveries[0]
    assert item.target_entity_id == ids["org_id"]
    assert item.target_entity_name == ids["org_name"]
    assert item.relation_type == RelationType.CAUSAL
    assert item.strength == StrengthType.MEDIUM
    assert item.confidence == 0.9

    # 已存在的关联不再推荐
    RelationService.create_relation(
        db_session,
        _payload(
            ids,
            ("history", "event"),
            ("politics", "organization"),
            RelationType.CAUSAL,
        ),
    )
    after = RelationService.discover_relations(
        db_session,
        ids["project_id"],
        ids["event_id"],
        ModuleType.HISTORY,
        "event",
        ids["event_name"],
    )
    assert after.total_count == 0


def test_create_relation_rejects_unknown_project(
    db_session: Session, ids: Dict[str, str]
) -> None:
    payload = _causal_payload(ids).model_copy(update={"project_id": "P-MISSING"})

    with pytest.raises(ValueError):
        RelationService.create_relation(db_session, payload)
    assert db_session.query(WorldLink).count() == 0


def test_entity_validation_accepts_submodules_and_items(
    db_session: Session, ids: Dict[str, str]
) -> None:
    assert (
        RelationService.verify_entity_exists(
            db_session, ModuleType.HISTORY, "event", ids["event_id"], ids["project_id"]
        )
        is True
    )
    assert (
        RelationService.verify_entity_exists(
            db_session, ModuleType.HISTORY, "event", "missing-id", ids["project_id"]
        )
        is False
    )

    ok, message = RelationService.validate_relation_entities(
        db_session, _causal_payload(ids)
    )
    assert ok is True
    assert message == ""

    broken = _causal_payload(ids).model_copy(update={"source_entity_id": "missing-id"})
    ok, message = RelationService.validate_relation_entities(db_session, broken)
    assert ok is False
    assert "not found" in message


def test_container_world_created_by_resolver_has_seven_modules(
    db_session: Session, ids: Dict[str, str]
) -> None:
    """P1 审查修复：容器世界必须满足契约 §2.2 的七模块不变式。"""

    db_session.add(
        World(id="W-SECOND", name="第二个世界", project_id=ids["project_id"])
    )
    db_session.commit()

    container = resolve_project_world(db_session, ids["project_id"])
    assert container.settings["migrationContainer"] is True

    module_types = sorted(
        module.module_type
        for module in db_session.query(WorldModule).filter(
            WorldModule.world_id == container.id
        )
    )
    assert module_types == sorted(
        ["map", "history", "politics", "economy", "races", "systems", "special"]
    )

    # 重复调用复用同一个容器世界，不重复建模块
    assert resolve_project_world(db_session, ids["project_id"]).id == container.id
    assert (
        db_session.query(WorldModule)
        .filter(WorldModule.world_id == container.id)
        .count()
        == 7
    )
