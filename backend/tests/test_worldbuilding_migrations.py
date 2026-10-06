"""迁移测试（Phase 1 P1-T9 / Phase 0 §7 迁移类）

覆盖：空库 upgrade、旧库 upgrade、逐级 downgrade/upgrade、重复 upgrade 幂等、线性 head。
"""

from __future__ import annotations

import json
from pathlib import Path

from alembic import command
from alembic.script import ScriptDirectory

from tests.conftest import (
    PRE_PHASE1_REVISION,
    alembic_config,
    column_names,
    read_rows,
    read_scalar,
    table_names,
)

PHASE1_REVISIONS = (
    "570767e6d582",  # P1-MIG-01 worlds rename
    "fa05a62b0da8",  # P1-MIG-02 config/kind/meta
    "d5a573ce6f22",  # P1-MIG-03 world_links
    "cef4ae3ffe96",  # P1-MIG-04 backfill modules
    "2160f6984e8a",  # P1-MIG-05 backfill links
    "8a5f26a774e3",  # P1-MIG-06 backfill char refs
)

P4_REVISION = "c1f7a4b9e2d3"  # P4-T12 backfill politics


def test_heads_is_single_and_phase1_is_linear(tmp_path: Path):
    """只有一个 head，且六个 Phase 1 迁移按 P1-MIG-01..06 线性串联。"""

    config = alembic_config(tmp_path / "unused.db")
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == [P4_REVISION]

    chain = [revision.revision for revision in script.walk_revisions()]
    chain.reverse()
    assert chain[-7:-1] == list(PHASE1_REVISIONS)
    assert chain[-8] == PRE_PHASE1_REVISION
    # P4 回填迁移基于 P1 head 线性串联（不修改已发布迁移）
    assert chain[-1] == P4_REVISION
    assert chain[-2] == PHASE1_REVISIONS[-1]


def test_empty_db_upgrade_creates_new_schema(empty_head_db: Path):
    """空库 upgrade：worlds / world_links / kind / meta / config 全部就位。"""

    tables = table_names(empty_head_db)
    assert "worlds" in tables
    assert "world_templates" not in tables
    assert "world_links" in tables
    assert "bidirectional_relations" in tables

    assert "settings" in column_names(empty_head_db, "worlds")
    assert "tone" in column_names(empty_head_db, "worlds")
    assert "world_id" in column_names(empty_head_db, "world_modules")
    assert "template_id" not in column_names(empty_head_db, "world_modules")
    assert "config" in column_names(empty_head_db, "world_modules")
    assert "kind" in column_names(empty_head_db, "world_submodules")
    assert "meta" in column_names(empty_head_db, "world_submodules")

    indexes = {
        row["name"]
        for row in read_rows(empty_head_db, "PRAGMA index_list(world_links)")
    }
    assert {
        "ix_world_links_world_source",
        "ix_world_links_world_target",
        "ix_world_links_world_type",
    } <= indexes


def test_empty_db_downgrade_and_reupgrade_is_idempotent(empty_head_db: Path):
    """逐级 downgrade 回 Phase 1 前结构，再 upgrade 回来。"""

    config = alembic_config(empty_head_db)

    command.downgrade(config, PRE_PHASE1_REVISION)
    tables = table_names(empty_head_db)
    assert "world_templates" in tables
    assert "worlds" not in tables
    assert "world_links" not in tables
    assert "template_id" in column_names(empty_head_db, "world_modules")
    assert "kind" not in column_names(empty_head_db, "world_submodules")

    command.upgrade(config, "head")
    tables = table_names(empty_head_db)
    assert "worlds" in tables
    assert "world_links" in tables
    assert "world_id" in column_names(empty_head_db, "world_modules")

    # 已是最新时再 upgrade 一次不应报错也不应改变结构
    command.upgrade(config, "head")
    assert read_scalar(empty_head_db, "SELECT count(*) FROM alembic_version") == 1


def test_legacy_db_upgrade_moves_columns_and_keeps_rows(migrated_legacy_db: Path):
    """旧库 upgrade：旧列降级进 settings.legacyTemplate，行数与关联数据不丢。"""

    assert table_names(migrated_legacy_db) >= {"worlds", "world_links"}
    assert "world_templates" not in table_names(migrated_legacy_db)

    worlds = read_rows(migrated_legacy_db, "SELECT id, name, settings FROM worlds")
    assert len(worlds) == 1
    assert worlds[0]["name"] == "旧世界"
    assert '"legacyTemplate"' in worlds[0]["settings"]
    assert "旧标签" in worlds[0]["settings"]
    assert "user-1" in worlds[0]["settings"]

    # 旧表数据保持原样（只读，不删）
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM bidirectional_relations")
        == 3
    )
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_module_items") == 5
    )
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_submodules") == 5

    # 七个模块补齐（原有 3 个 + 新增 4 个）
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_modules") == 7


def test_legacy_db_downgrade_restores_legacy_schema_and_data(migrated_legacy_db: Path):
    """downgrade 回到旧结构：world_templates 与旧列恢复，旧值写回。"""

    config = alembic_config(migrated_legacy_db)
    command.downgrade(config, PRE_PHASE1_REVISION)

    tables = table_names(migrated_legacy_db)
    assert "world_templates" in tables
    assert "worlds" not in tables
    assert "world_links" not in tables

    columns = column_names(migrated_legacy_db, "world_templates")
    for column in ("tags", "is_public", "is_system_template", "created_by"):
        assert column in columns
    assert "settings" not in columns
    assert "tone" not in columns

    row = read_rows(
        migrated_legacy_db,
        "SELECT id, name, tags, is_public, created_by FROM world_templates",
    )[0]
    assert row["name"] == "旧世界"
    assert json.loads(row["tags"]) == ["旧标签"]
    assert row["is_public"] == 1
    assert row["created_by"] == "user-1"

    assert "template_id" in column_names(migrated_legacy_db, "world_modules")
    # P1-MIG-04 补齐的 4 个空模块在 downgrade 时被删除，回到旧库原有的 3 个模块
    assert read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_modules") == 3
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM bidirectional_relations")
        == 3
    )


def test_backfill_revision_rerun_does_not_duplicate(migrated_legacy_db: Path):
    """把版本指针退回 P1-MIG-03 后重新 upgrade：回填必须幂等，不新增行。"""

    config = alembic_config(migrated_legacy_db)
    before = {
        "links": read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_links"),
        "modules": read_scalar(
            migrated_legacy_db, "SELECT count(*) FROM world_modules"
        ),
        "configs": read_scalar(
            migrated_legacy_db,
            "SELECT count(*) FROM world_modules WHERE config IS NOT NULL",
        ),
    }

    command.stamp(config, "d5a573ce6f22")
    command.upgrade(config, "head")

    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_links")
        == before["links"]
    )
    assert (
        read_scalar(migrated_legacy_db, "SELECT count(*) FROM world_modules")
        == before["modules"]
    )
    assert (
        read_scalar(
            migrated_legacy_db,
            "SELECT count(*) FROM world_modules WHERE config IS NOT NULL",
        )
        == before["configs"]
    )


def test_old_items_are_not_deleted_by_backfill(migrated_legacy_db: Path):
    """回填只读旧 item：moduleConfig / relations / _char_ref 条目全部保留。"""

    names = {
        row["name"]
        for row in read_rows(migrated_legacy_db, "SELECT name FROM world_module_items")
    }
    assert {"moduleConfig", "relations", "_char_ref_C1", "参战方"} <= names
