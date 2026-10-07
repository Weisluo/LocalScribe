"""Phase 1 测试夹具（世界观数据地基）

约定：
- `app.core.database` 在导入时就把 DATABASE_URL 绑成引擎，所以必须在导入 app 之前
  指向测试库；本文件在导入阶段设置环境变量，API 测试全程使用同一个会话级临时库。
- 会话库路径写入带进程号的 `LOCALSCRIBE_TEST_DB_<pid>`，重复导入（`conftest` /
  `tests.conftest`）时复用，保证 env 与 pytest 夹具升级的是同一个文件；
  键名带进程号，并行跑 pytest 不会共用同一个 SQLite 文件，外部预设的旧变量也不会被误用。
- 迁移/回填测试使用独立临时库与 alembic API，不经过 FastAPI，避免互相污染。
"""

from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]
PRE_PHASE1_REVISION = "a8f3e9c2b1d4"

# 必须在导入 app.* 之前设置。
# conftest 可能被导入两次（pytest 注册的 `conftest` 与测试模块里的 `tests.conftest`），
# 模块级代码会整体重跑：会话库路径与环境变量必须在本进程内幂等，第二次导入复用同一路径，
# 否则 app 引擎会连到另一个还没建表的空库（表现为大批 no such table: projects）。
# 键名带 pid：并行 pytest 进程各拿各的临时库，外部预设 / 历史残留的同名变量也不会被复用。
_SESSION_DB_ENV = f"LOCALSCRIBE_TEST_DB_{os.getpid()}"
_SESSION_DB = Path(
    os.environ.get(_SESSION_DB_ENV)
    or (tempfile.mkdtemp(prefix="localscribe-wbl-") + "/app.db")
)
os.environ["DATABASE_URL"] = f"sqlite:///{_SESSION_DB.as_posix()}"
os.environ[_SESSION_DB_ENV] = str(_SESSION_DB)


def alembic_config(db_path: Path) -> Config:
    """指向任意 SQLite 文件的 alembic 配置。"""

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path.as_posix()}")
    return config


@pytest.fixture(scope="session")
def app_db_path() -> Path:
    """应用使用的会话级库：升级到 head 后所有 API 测试共用。"""

    command.upgrade(alembic_config(_SESSION_DB), "head")
    return _SESSION_DB


@pytest.fixture(scope="session")
def client(app_db_path: Path):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def _sql(*lines: str) -> str:
    """把多行 SQL 片段拼成一条语句（避免测试文件里出现超长行）。"""

    return " ".join(" ".join(line.split()) for line in lines)


def seed_legacy_database(db_path: Path) -> Dict[str, str]:
    """在 Phase 1 迁移前的库结构上写入 Phase 0 盘点到的全部旧编码（E1-E8）。"""

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()

    cursor.execute(
        "INSERT INTO projects (id, title, created_at, updated_at) "
        "VALUES ('P1','项目一',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
    )
    cursor.execute(
        _sql(
            "INSERT INTO world_templates",
            "(id, name, description, cover_image, tags, is_public, is_system_template,",
            "created_at, updated_at, created_by, project_id)",
            "VALUES ('W1','旧世界',NULL,NULL,'[\"旧标签\"]',1,0,CURRENT_TIMESTAMP,",
            "CURRENT_TIMESTAMP,'user-1','P1')",
        )
    )

    for module_id, module_type, name, icon, order_index in (
        ("M_H", "history", "历史", "scroll-text", 0),
        ("M_E", "economy", "经济", "coins", 1),
        ("M_P", "politics", "政治", "crown", 2),
    ):
        cursor.execute(
            _sql(
                "INSERT INTO world_modules",
                "(id, template_id, module_type, name, description, icon, order_index,",
                "is_collapsible, is_required, created_at, updated_at)",
                "VALUES (?,?,?,?,NULL,?,?,1,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            (module_id, "W1", module_type, name, icon, order_index),
        )

    for submodule_id, module_id, parent_id, name, color, icon in (
        ("E1", "M_H", None, "第一纪元", "era:ochre", "era:100:200"),
        ("EV1", "M_H", "E1", "大战", "#64748b", None),
        ("EN1", "M_E", None, "铁矿业", "type:industry:global", None),
        ("EN2", "M_E", None, "铁矿石", "type:commodity:regional", None),
        ("POL1", "M_P", None, "旧政权", "custom", None),
    ):
        cursor.execute(
            _sql(
                "INSERT INTO world_submodules",
                "(id, module_id, parent_id, name, description, order_index,",
                "color, icon, created_at, updated_at)",
                "VALUES (?,?,?,?,NULL,0,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            (submodule_id, module_id, parent_id, name, color, icon),
        )

    for item_id, module_id, submodule_id, name, content in (
        (
            "I1",
            "M_H",
            None,
            "moduleConfig",
            '{"timeUnit": "era", "timelineStyle": "linear"}',
        ),
        ("I2", "M_E", None, "moduleConfig", '{"entityTypes": [{"id": "industry"}]}'),
        ("I3", "M_E", "EN1", "relations", '{"rel-1": "supplier:EN2:100:10:20"}'),
        ("I4", "M_H", "EV1", "_char_ref_C1", '{"_char_ref:C1": "关羽"}'),
        ("I5", "M_H", "EV1", "参战方", '{"_char_link:I5:C1": "关羽"}'),
    ):
        cursor.execute(
            _sql(
                "INSERT INTO world_module_items",
                "(id, module_id, submodule_id, name, content, order_index,",
                "is_published, created_at, updated_at)",
                "VALUES (?,?,?,?,?,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            (item_id, module_id, submodule_id, name, content),
        )

    cursor.execute(
        "INSERT INTO characters (id, project_id, name, gender, level, order_index, "
        " created_at, updated_at) "
        "VALUES ('C1','P1','关羽','男','main',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
    )

    for relation in (
        (
            "R1",
            "history",
            "event",
            "EV1",
            "大战",
            "politics",
            "polity",
            "POL1",
            "旧政权",
            "causal",
            0,
            "strong",
            '{"confidence": 0.9}',
            "P1",
        ),
        (
            "R2",
            "economy",
            "commodity",
            "EN2",
            "铁矿石",
            "history",
            "event",
            "EV1",
            "大战",
            "temporal",
            1,
            "medium",
            None,
            "P1",
        ),
        (
            "R3",
            "history",
            "event",
            "MISSING",
            "不存在",
            "politics",
            "polity",
            "POL1",
            "旧政权",
            "causal",
            0,
            "weak",
            None,
            "P1",
        ),
    ):
        cursor.execute(
            _sql(
                "INSERT INTO bidirectional_relations",
                "(id, source_module, source_entity_type, source_entity_id,",
                "source_entity_name, target_module, target_entity_type,",
                "target_entity_id, target_entity_name, relation_type,",
                "bidirectional, strength, metadata_json, project_id,",
                "created_at, updated_at)",
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,",
                "CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            relation,
        )

    connection.commit()
    connection.close()
    return {"world_id": "W1", "project_id": "P1", "character_id": "C1"}


@pytest.fixture()
def legacy_db(tmp_path: Path) -> Path:
    """Phase 1 之前的旧库（含旧编码数据），未升级。"""

    db_path = tmp_path / "legacy.db"
    command.upgrade(alembic_config(db_path), PRE_PHASE1_REVISION)
    seed_legacy_database(db_path)
    return db_path


@pytest.fixture()
def migrated_legacy_db(legacy_db: Path) -> Path:
    """旧库升级到 head（P1-MIG-01..06 全部执行）。"""

    command.upgrade(alembic_config(legacy_db), "head")
    return legacy_db


@pytest.fixture()
def empty_head_db(tmp_path: Path) -> Path:
    """空库直接升级到 head。"""

    db_path = tmp_path / "empty.db"
    command.upgrade(alembic_config(db_path), "head")
    return db_path


def read_rows(db_path: Path, sql: str, parameters: tuple = ()):
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in connection.execute(sql, parameters).fetchall()]
    finally:
        connection.close()


def read_scalar(db_path: Path, sql: str, parameters: tuple = ()):
    rows = read_rows(db_path, sql, parameters)
    return list(rows[0].values())[0] if rows else None


def column_names(db_path: Path, table: str) -> list:
    return [row["name"] for row in read_rows(db_path, f"PRAGMA table_info({table})")]


def table_names(db_path: Path) -> set:
    return {
        row["name"]
        for row in read_rows(
            db_path, "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }


def make_engine(db_path: Path) -> sa.Engine:
    return sa.create_engine(f"sqlite:///{db_path.as_posix()}")


def parse_json(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return None
