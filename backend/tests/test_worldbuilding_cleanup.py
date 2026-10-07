"""退场守卫与最终迁移校验（Phase 6 P6-T10 / P6-T11）

覆盖：
1. 静态守卫：backend/app 不再有旧路由 / 旧模型标识，frontend/src 无清单外的旧用法
2. alembic 只有一个 head，且等于 P6-T11 的新修订
3. 升级到 head 后 PRAGMA foreign_key_check 干净（空库 + 迁移过的旧库）
4. 对账：旧库升级到 head 前后，世界 / 关联 / 模块 / 条目行数一致，三张旧表已删除
5. 幂等：重复 upgrade、downgrade 一步再 upgrade
"""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple

from alembic import command
from alembic.script import ScriptDirectory

from tests.conftest import (
    PRE_PHASE1_REVISION,
    alembic_config,
    read_scalar,
    seed_legacy_database,
    table_names,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
APP_DIR = BACKEND_DIR / "app"
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"

P5_REVISION = "d4e8b1c7a206"  # P5-T4 经济回填（P6-T11 的 down_revision）
P6_REVISION = "74bd4aa85478"  # P6-T11 drop legacy tables

LEGACY_TABLES = ("world_instances", "worldview_configs", "bidirectional_relations")

# 旧模型 / 旧表标识：backend/app 与 frontend/src 都必须为 0
LEGACY_IDENTIFIERS = (
    "WorldTemplate",
    "WorldInstance",
    "CustomWorldviewConfig",
    "BidirectionalRelation",
    "bidirectional_relations",
    "world_instances",
    "worldview_configs",
    # P1-MIG-01 之前的表名：P6 downgrade 曾把重建表的入向外键指回它（建得出、写不进的坏表），
    # 因此这个词必须进清单，注释里的残留同样算命中
    "world_templates",
)

# 旧 worldbuilding 路由装饰器（backend/app）
BACKEND_LEGACY_ROUTE_RE = re.compile(
    r"@router\.(?:get|post|put|delete|patch)\(\s*[\"']/?"
    r"(?:worldbuilding/)?(?:templates|instances|worldviews)\b"
)
# 旧 worldbuilding API 路径字面量（frontend/src 的调用点）
FRONTEND_LEGACY_ROUTE_RE = re.compile(
    r"[\"'`](?:/api/v1)?/worldbuilding/(?:templates|instances|worldviews)\b"
)

# Phase 6 前端退场已全部完成（P6-T10/T11 + P6-T1/T2/T6 落地后，
# frontend/src 含生成产物 types/api.ts 在内均为 0 命中），这里不再留待清清单，
# 本用例对 frontend/src 全量硬断言 0 命中。
FRONTEND_CLEANUP_PENDING: set = set()


def _pending_frontend_files() -> set:
    """待清清单（Phase 6 收口后恒为空集）。"""

    return set(globals().get("FRONTEND_CLEANUP_PENDING") or ())


def _source_files(root: Path, suffixes: Tuple[str, ...]) -> List[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix in suffixes
        and "__pycache__" not in path.parts
    )


def _relative(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _identifier_hits(root: Path, suffixes: Tuple[str, ...]) -> Dict[str, int]:
    hits: Dict[str, int] = {}
    for path in _source_files(root, suffixes):
        count = sum(_read(path).count(name) for name in LEGACY_IDENTIFIERS)
        if count:
            hits[_relative(root, path)] = count
    return hits


def _scanned_file_count(root: Path, suffixes: Tuple[str, ...]) -> int:
    return len(_source_files(root, suffixes))


def _backend_route_hits() -> Dict[str, int]:
    hits: Dict[str, int] = {}
    for path in _source_files(APP_DIR, (".py",)):
        count = len(BACKEND_LEGACY_ROUTE_RE.findall(_read(path)))
        if count:
            hits[_relative(APP_DIR, path)] = count
    return hits


def _frontend_route_hit_files() -> set:
    return {
        _relative(FRONTEND_SRC, path)
        for path in _source_files(FRONTEND_SRC, (".ts", ".tsx"))
        if FRONTEND_LEGACY_ROUTE_RE.search(_read(path))
    }


# ---------------------------------------------------------------- 1. 静态守卫


def test_backend_app_has_no_legacy_routes():
    """backend/app 里不能再有 /templates、/instances、/worldviews 路由。"""

    assert _backend_route_hits() == {}


def test_backend_app_has_no_legacy_identifiers():
    """backend/app 里不能再出现旧模型 / 旧表标识，也不能有 WorldModule.template_id 残留。"""

    # 扫描集合必须先非空，否则下面的断言会退化成「空 == 空」恒真
    assert _scanned_file_count(APP_DIR, (".py",)) > 0
    assert _identifier_hits(APP_DIR, (".py",)) == {}

    template_id_hits = {
        _relative(APP_DIR, path): _read(path).count("template_id")
        for path in _source_files(APP_DIR, (".py",))
        if "template_id" in _read(path)
    }
    assert not template_id_hits, f"backend/app 仍有 template_id 残留：{template_id_hits}"


def _frontend_legacy_hits() -> Dict[str, int]:
    hits: Dict[str, int] = {}
    for path in _source_files(FRONTEND_SRC, (".ts", ".tsx")):
        text = _read(path)
        count = len(FRONTEND_LEGACY_ROUTE_RE.findall(text)) + sum(
            text.count(name) for name in LEGACY_IDENTIFIERS
        )
        if count:
            hits[_relative(FRONTEND_SRC, path)] = count
    return hits


def test_frontend_has_no_unlisted_legacy_usage():
    """frontend/src（含 OpenAPI 生成产物）不得再出现旧路由 / 旧模型用法。"""

    pending = _pending_frontend_files()
    unexpected = {
        path: count
        for path, count in _frontend_legacy_hits().items()
        if path not in pending
    }
    assert (
        unexpected == {}
    ), f"frontend/src 出现清单外的旧路由 / 旧模型用法：{unexpected}"

    # 旧 worldbuilding 路径字面量（templates / instances / worldviews）必须全部消失，
    # 生成产物 types/api.ts 也不例外（后端下架 + 重跑 gen:types 后应自然清空）
    route_files = _frontend_route_hit_files()
    assert route_files == set(), f"frontend/src 仍有旧 worldbuilding 路径调用点：{route_files}"


# ---------------------------------------------------------------- 2. 迁移 head


def test_alembic_head_is_single_p6_revision(tmp_path: Path):
    script = ScriptDirectory.from_config(alembic_config(tmp_path / "unused.db"))
    heads = script.get_heads()

    assert heads == [P6_REVISION]
    assert P6_REVISION in {revision.revision for revision in script.walk_revisions()}


# ---------------------------------------------------------------- 3. 外键检查


def _foreign_key_check(db_path: Path) -> list:
    connection = sqlite3.connect(str(db_path))
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        return connection.execute("PRAGMA foreign_key_check").fetchall()
    finally:
        connection.close()


def test_foreign_key_check_is_clean(empty_head_db: Path, migrated_legacy_db: Path):
    """删表后没有悬空外键：空库与迁移过的旧库都干净。"""

    assert _foreign_key_check(empty_head_db) == []
    assert _foreign_key_check(migrated_legacy_db) == []


# ---------------------------------------------------------------- 4. 数据对账


COUNTED_TABLES = (
    "worlds",
    "world_modules",
    "world_submodules",
    "world_module_items",
    "world_links",
    "characters",
)


def _row_counts(db_path: Path) -> Dict[str, int]:
    return {
        table: read_scalar(db_path, f"SELECT count(*) FROM {table}")
        for table in COUNTED_TABLES
    }


def _seeded_legacy_db(db_path: Path) -> Path:
    command.upgrade(alembic_config(db_path), PRE_PHASE1_REVISION)
    seed_legacy_database(db_path)
    return db_path


def _missing_fk_targets(db_path: Path) -> list:
    """重建表里指向「库中不存在的表」的外键：`(表, 目标表)` 列表。

    SQLite 建表时不校验父表存在，所以 downgrade 可能静默产出一张写入即
    `no such table` 的坏表；`PRAGMA foreign_key_check` 也查不出来，必须自己比表名。
    """

    connection = sqlite3.connect(str(db_path))
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        missing = []
        for table in LEGACY_TABLES:
            if table not in tables:
                continue
            for row in connection.execute(f"PRAGMA foreign_key_list('{table}')"):
                if row[2] not in tables:
                    missing.append((table, row[2]))
        return missing
    finally:
        connection.close()


def _world_instance_insert_probe(db_path: Path, template_id: str, project_id: str):
    """在降级库上真写一行 world_instances（foreign_keys=ON），坏外键会直接抛错。"""

    connection = sqlite3.connect(str(db_path))
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute(
            "INSERT INTO world_instances "
            "(id, template_id, project_id, name, created_at, updated_at) "
            "VALUES ('probe-instance', ?, ?, '探针', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            (template_id, project_id),
        )
        connection.commit()
    finally:
        connection.close()


def test_legacy_table_drop_keeps_user_data(tmp_path: Path):
    """P6-T11 只删旧表：新结构行数与 P6 前 head 完全一致，三张旧表消失。"""

    pre_db = _seeded_legacy_db(tmp_path / "pre.db")
    command.upgrade(alembic_config(pre_db), P5_REVISION)
    before = _row_counts(pre_db)
    assert before["world_links"] == 5  # 基线：E1-E8 旧编码回填出的 5 条关联

    post_db = _seeded_legacy_db(tmp_path / "post.db")
    command.upgrade(alembic_config(post_db), "head")
    after = _row_counts(post_db)

    assert after == before
    tables = table_names(post_db)
    for legacy in LEGACY_TABLES:
        assert legacy not in tables


# ---------------------------------------------------------------- 5. 幂等


def test_repeated_upgrade_and_downgrade_step_are_idempotent(tmp_path: Path):
    """upgrade 重复执行是 no-op；downgrade 一步（只重建空表）后再 upgrade 仍回到同一状态。"""

    db_path = _seeded_legacy_db(tmp_path / "idempotent.db")
    config = alembic_config(db_path)
    command.upgrade(config, "head")
    tables = table_names(db_path)
    counts = _row_counts(db_path)

    command.upgrade(config, "head")
    assert table_names(db_path) == tables
    assert _row_counts(db_path) == counts
    assert read_scalar(db_path, "SELECT count(*) FROM alembic_version") == 1

    command.downgrade(config, P5_REVISION)
    downgraded = table_names(db_path)
    for legacy in LEGACY_TABLES:
        assert legacy in downgraded
    assert read_scalar(db_path, "SELECT count(*) FROM bidirectional_relations") == 0
    assert read_scalar(db_path, "SELECT count(*) FROM world_instances") == 0
    assert read_scalar(db_path, "SELECT count(*) FROM worldview_configs") == 0

    # 重建表必须可用：外键目标都存在（P6 曾把 world_instances 的 template_id 指回
    # P1 已改名的旧表，建得出但写不进），并且真写得进一行
    assert _missing_fk_targets(db_path) == []
    _world_instance_insert_probe(db_path, template_id="W1", project_id="P1")
    assert read_scalar(db_path, "SELECT count(*) FROM world_instances") == 1

    command.upgrade(config, "head")
    assert table_names(db_path) == tables
    assert _row_counts(db_path) == counts
