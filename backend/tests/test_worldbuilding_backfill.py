"""回填测试（Phase 1 P1-T8 / Phase 0 §7 回填类）

旧库（含 E1-E8 全部旧编码）升级到 head 后，逐项核对回填结果与对账基线。
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from alembic import command

from tests.conftest import (
    _sql,
    alembic_config,
    parse_json,
    read_rows,
    read_scalar,
)

EXPECTED_LINK_TYPES = {
    "history.causes",
    "core.related_to",
    "core.references",
    "character.appears_in",
}


def _links(db_path: Path):
    return read_rows(
        db_path,
        "SELECT id, world_id, source_module, source_kind, source_id, target_module, "
        " target_kind, target_id, link_type, directed, meta, time FROM world_links",
    )


def _meta(link):
    return parse_json(link["meta"]) or {}


def test_module_config_items_backfilled_into_config(migrated_legacy_db: Path):
    """E4：moduleConfig 条目 -> WorldModule.config，旧条目保留可双读。"""

    modules = {
        row["module_type"]: parse_json(row["config"])
        for row in read_rows(
            migrated_legacy_db, "SELECT module_type, config FROM world_modules"
        )
    }
    assert modules["history"] == {"timeUnit": "era", "timelineStyle": "linear"}
    # economy：P1 把旧条目键写进 config；P5-T4 再补四个等级定义与记账键（旧键原样保留）
    economy = modules["economy"]
    assert economy["entityTypes"] == [{"id": "industry"}]
    assert {level["id"] for level in economy["levels"]} == {
        "global",
        "national",
        "regional",
        "local",
    }
    assert "_p5Legacy" in economy
    assert modules["politics"] is None

    config_items = read_scalar(
        migrated_legacy_db,
        "SELECT count(*) FROM world_module_items WHERE name = 'moduleConfig'",
    )
    assert config_items == 2


def test_submodule_kind_and_meta_backfilled(migrated_legacy_db: Path):
    """E1/E2/E3：color/icon 旧编码 -> kind/meta，原 color 不动。"""

    submodules = {
        row["id"]: row
        for row in read_rows(
            migrated_legacy_db,
            "SELECT id, color, icon, kind, meta FROM world_submodules",
        )
    }

    era = submodules["E1"]
    assert era["kind"] == "era"
    assert era["color"] == "era:ochre"
    era_meta = parse_json(era["meta"])
    assert era_meta["theme"] == "ochre"
    assert era_meta["time"] == {"start": "100", "end": "200"}

    event = submodules["EV1"]
    assert event["kind"] == "event"
    assert parse_json(event["meta"])["legacyColor"] == "#64748b"

    industry = submodules["EN1"]
    assert industry["kind"] == "industry"
    assert parse_json(industry["meta"])["level"] == "global"

    commodity = submodules["EN2"]
    # P5-T4 的六类旧经济类型语义映射：commodity -> good；color 与 meta.level 保留
    assert commodity["kind"] == "good"
    assert commodity["color"] == "type:commodity:regional"
    assert parse_json(commodity["meta"])["level"] == "regional"

    polity = submodules["POL1"]
    assert polity["kind"] == "custom"
    assert parse_json(polity["meta"])["legacyColor"] == "custom"


def test_seven_modules_per_world(migrated_legacy_db: Path):
    """契约 §2.2：每个世界七个模块；原 3 个保留，补齐 4 个空模块。"""

    module_types = [
        row["module_type"]
        for row in read_rows(
            migrated_legacy_db, "SELECT module_type FROM world_modules"
        )
    ]
    assert sorted(module_types) == sorted(
        ["map", "history", "politics", "economy", "races", "systems", "special"]
    )
    assert len(module_types) == len(set(module_types)) == 7


def test_bidirectional_relations_backfilled(migrated_legacy_db: Path):
    """E-relations：旧表回填 world_links，孤儿不进库，旧表行数不变。"""

    links = _links(migrated_legacy_db)
    from_relations = [
        link
        for link in links
        if _meta(link).get("migratedFrom") == "bidirectional_relations"
    ]
    assert len(from_relations) == 2

    mapped = {_meta(link)["legacyRelationId"]: link for link in from_relations}
    assert set(mapped) == {"R1", "R2"}

    causal = mapped["R1"]
    assert causal["link_type"] == "history.causes"
    assert causal["directed"] == 1
    assert causal["source_id"] == "EV1" and causal["target_id"] == "POL1"
    assert _meta(causal)["legacyRelationType"] == "causal"
    assert _meta(causal)["strength"] == "strong"
    assert _meta(causal)["confidence"] == 0.9
    assert _meta(causal)["legacySourceName"] == "大战"

    symmetric = mapped["R2"]
    assert symmetric["link_type"] == "core.related_to"
    assert symmetric["directed"] == 0

    # 孤儿 R3 不落库
    assert "R3" not in {_meta(link).get("legacyRelationId") for link in links}
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM bidirectional_relations")
        == 3
    )


def test_economy_relations_items_backfilled_with_time_and_volume(
    migrated_legacy_db: Path,
):
    """E7：item(name="relations") 的值编码 -> world_links（含 volume 与时间）。"""

    links = [
        link
        for link in _links(migrated_legacy_db)
        if _meta(link).get("migratedFrom") == "economy_relations"
    ]
    assert len(links) == 1

    link = links[0]
    assert link["source_id"] == "EN1" and link["target_id"] == "EN2"
    # P5-T4 把 EN2 的 kind 归一化成 good，并把这条边（P1 时代因旧词表判非法而写的）端点词表
    # 一并同步 —— 同库内 world_submodules.kind 与 world_links.*_kind 必须一致
    assert link["source_kind"] == "industry" and link["target_kind"] == "good"
    assert parse_json(link["time"]) == {"start": "10", "end": "20"}
    meta = _meta(link)
    assert meta["legacyKey"] == "rel-1"
    assert meta["legacyRelationType"] == "supplier"
    assert meta["volume"] == "100"
    assert meta["_p5TargetKind"] == {"from": "commodity", "to": "good"}
    # supplier 的候选 economy.supplies 需要 market/organization 等目标，新 kind（good）仍不匹配；
    # 但 P1-MIG-05 口径：有向旧类型校验不通过 -> core.references（不是 core.related_to）
    assert link["link_type"] == "core.references"
    assert link["directed"] == 1


def test_character_refs_backfilled_as_appears_in(migrated_legacy_db: Path):
    """E5/E6：_char_ref / _char_link -> character.appears_in，目标为 history.event。"""

    links = [
        link
        for link in _links(migrated_legacy_db)
        if _meta(link).get("migratedFrom") in ("_char_ref", "_char_link")
    ]
    assert len(links) == 2

    for link in links:
        assert link["link_type"] == "character.appears_in"
        assert link["source_module"] == "character"
        assert link["source_id"] == "C1"
        assert link["target_module"] == "history"
        assert link["target_kind"] == "event"
        assert link["target_id"] == "EV1"
        assert link["directed"] == 1

    assert {_meta(link)["legacyItemId"] for link in links} == {"I4", "I5"}

    # 旧 item 不删除
    assert (
        read_scalar(
            migrated_legacy_db,
            "SELECT count(*) FROM world_module_items WHERE name LIKE '_char_ref_%'",
        )
        == 1
    )


def test_all_backfilled_link_types_are_in_contract_registry(migrated_legacy_db: Path):
    """回填只允许契约 §4 内的 link_type。"""

    from app.services.link_registry import link_type_ids

    contract_ids = set(link_type_ids())
    backfilled = {link["link_type"] for link in _links(migrated_legacy_db)}
    assert backfilled == EXPECTED_LINK_TYPES
    assert backfilled <= contract_ids
    assert "politics.treaty_between" not in backfilled


def test_row_reconciliation_against_phase0_baseline(migrated_legacy_db: Path):
    """对账基线（phase0_inventory_report.md §7 同口径）：旧表行数不减，仅新增新结构。"""

    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM worlds") == 1
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_modules") == 7
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_submodules") == 5
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_module_items") == 5
    )
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM bidirectional_relations")
        == 3
    )
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_links") == 5
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM characters") == 1
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_instances") == 0
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM worldview_configs") == 0
    )


def test_legacy_world_settings_keep_template_fields(migrated_legacy_db: Path):
    """D2：旧模板字段降级进 settings.legacyTemplate，可被旧接口读回。"""

    settings = parse_json(
        read_scalar(migrated_legacy_db, "SELECT settings FROM worlds WHERE id='W1'")
    )
    legacy = settings["legacyTemplate"]
    assert legacy["tags"] == ["旧标签"]
    assert legacy["is_public"] is True
    assert legacy["created_by"] == "user-1"
    assert json.dumps(settings, ensure_ascii=False).count("legacyTemplate") == 1


# ---------------------------------------------- P1 审查修复的回归用例


def _upgrade_with_extra_rows(legacy_db: Path, statements) -> None:
    """在旧库里追加数据后再升级到 head（复用 legacy_db 夹具）。"""

    connection = sqlite3.connect(legacy_db)
    for statement, parameters in statements:
        connection.execute(statement, parameters)
    connection.commit()
    connection.close()
    command.upgrade(alembic_config(legacy_db), "head")


def test_container_world_gets_seven_modules(legacy_db: Path):
    """多世界项目 -> 迁移容器世界同样满足契约 §2.2 的七模块。"""

    _upgrade_with_extra_rows(
        legacy_db,
        [
            (
                _sql(
                    "INSERT INTO world_templates",
                    "(id, name, description, cover_image, tags, is_public,",
                    " is_system_template, created_at, updated_at, created_by,",
                    " project_id)",
                    "VALUES ('W2','第二个世界',NULL,NULL,NULL,0,0,",
                    " CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,'P1')",
                ),
                (),
            )
        ],
    )

    containers = read_rows(
        legacy_db,
        "SELECT id, settings FROM worlds "
        "WHERE json_extract(settings, '$.migrationContainer') = 1",
    )
    assert len(containers) == 1

    module_types = sorted(
        row["module_type"]
        for row in read_rows(
            legacy_db,
            "SELECT module_type FROM world_modules WHERE world_id = ?",
            (containers[0]["id"],),
        )
    )
    assert module_types == sorted(
        ["map", "history", "politics", "economy", "races", "systems", "special"]
    )

    # 旧关联归属到容器世界（3 个世界 -> 无法确定归属）
    assert (
        read_scalar(
            legacy_db,
            "SELECT count(*) FROM world_links WHERE world_id = ?",
            (containers[0]["id"],),
        )
        == 2
    )

    # 重跑 MIG-05/06：容器模块与关联都不得重复
    links_before = read_scalar(legacy_db, "SELECT count(*) FROM world_links")
    config = alembic_config(legacy_db)
    command.stamp(config, "cef4ae3ffe96")
    command.upgrade(config, "head")

    assert (
        read_scalar(
            legacy_db,
            "SELECT count(*) FROM world_modules WHERE world_id = ?",
            (containers[0]["id"],),
        )
        == 7
    )
    assert read_scalar(legacy_db, "SELECT count(*) FROM world_links") == links_before


def test_legacy_metadata_cannot_override_migration_bookkeeping(legacy_db: Path):
    """旧 metadata_json 不得覆盖记账键（projectId / legacyRelationType / strength）。"""

    _upgrade_with_extra_rows(
        legacy_db,
        [
            (
                _sql(
                    "INSERT INTO bidirectional_relations",
                    "(id, source_module, source_entity_type, source_entity_id,",
                    " source_entity_name, target_module, target_entity_type,",
                    " target_entity_id, target_entity_name, relation_type,",
                    " bidirectional, strength, metadata_json, project_id,",
                    " created_at, updated_at)",
                    "VALUES ('R4','history','event','EV1','大战','politics','polity',",
                    " 'POL1','旧政权','causal',0,'weak',?, 'P1',",
                    " CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                ),
                (
                    json.dumps(
                        {
                            "projectId": "HACKED",
                            "legacyRelationType": "temporal",
                            "strength": "strong",
                            "confidence": 0.5,
                        },
                        ensure_ascii=False,
                    ),
                ),
            )
        ],
    )

    rows = read_rows(
        legacy_db,
        "SELECT meta FROM world_links "
        "WHERE json_extract(meta, '$.legacyRelationId') = 'R4'",
    )
    assert len(rows) == 1
    meta = parse_json(rows[0]["meta"])
    assert meta["projectId"] == "P1"
    assert meta["legacyRelationType"] == "causal"
    assert meta["strength"] == "weak"
    assert meta["confidence"] == 0.5


def test_char_ref_outside_history_degrades_to_general_type(legacy_db: Path):
    """非 history 模块的 _char_ref：character.appears_in 的 kind 约束不成立时降级。"""

    _upgrade_with_extra_rows(
        legacy_db,
        [
            (
                _sql(
                    "INSERT INTO world_module_items",
                    "(id, module_id, submodule_id, name, content, order_index,",
                    " is_published, created_at, updated_at)",
                    "VALUES ('I6','M_E','EN1','_char_ref_C1',?,0,1,",
                    " CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                ),
                (json.dumps({"_char_ref:C1": "关羽"}, ensure_ascii=False),),
            )
        ],
    )

    rows = read_rows(
        legacy_db,
        "SELECT link_type, meta FROM world_links "
        "WHERE json_extract(meta, '$.legacyItemId') = 'I6'",
    )
    assert len(rows) == 1
    assert rows[0]["link_type"] == "core.references"
    assert parse_json(rows[0]["meta"])["degradedFrom"] == "character.appears_in"
