"""迁移容器关联归位（P2-T12，契约 §6）后端测试。

覆盖：
- 单条归位：显式 world_id、省略后按端点推导（含无请求体）、meta 记账键保留 + 追加
- 409：端点分属不同世界（不落库）、目标世界已有等价边（含有向/对称两种），
  两种 409 均返回结构化判别码（endpoint_world_conflict / duplicate_link）
- 400：跨项目、已位于目标世界、契约外 link_type；404：未知 link/world
- 角色端点：项目单世界可推导、多世界歧义（character_world_ambiguous）
- 批量：单事务、同批次对称等价边去重、link_ids 保序去重、
  invalid 携带稳定 code、请求级失败不产生部分写入、模块计数同步
- 旧 /relations 与 /templates 行为不变

说明：契约外 link_type、对称反向边、非对象 meta 的行无法经写入侧 API 造出
（写入前必过 registry 校验与对称去重），因此用原生 SQL 直接落库来构造这些分支。
"""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pytest

API = "/api/v1/worldbuilding"
PROJECTS = "/api/v1/projects/"
RELATIONS = "/api/v1/relations"

EndpointRef = Dict[str, str]


# ---------------------------------------------------------------------------
# 请求封装
# ---------------------------------------------------------------------------


def _create_project(client, title: str) -> str:
    response = client.post(PROJECTS, json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_world(
    client, name: str, project_id: str, settings: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name, "project_id": project_id}
    if settings is not None:
        payload["settings"] = settings
    response = client.post(f"{API}/worlds", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _modules_by_type(client, world_id: str) -> Dict[str, Dict[str, Any]]:
    response = client.get(f"{API}/worlds/{world_id}")
    assert response.status_code == 200, response.text
    return {module["module_type"]: module for module in response.json()["modules"]}


def _create_submodule(client, module_id: str, name: str, kind: str) -> str:
    response = client.post(
        f"{API}/modules/{module_id}/submodules", json={"name": name, "kind": kind}
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _world_with_entity(
    client, project_id: str, name: str, module_type: str, kind: str, entity_name: str
) -> Tuple[str, str]:
    """建一个世界并放一个可解析端点，返回 (world_id, entity_id)。"""

    world_id = _create_world(client, name, project_id)["id"]
    modules = _modules_by_type(client, world_id)
    entity_id = _create_submodule(client, modules[module_type]["id"], entity_name, kind)
    return world_id, entity_id


def _edge(event_id: str, polity_id: str) -> Tuple[EndpointRef, EndpointRef]:
    """history.event -> politics.polity，可配 history.involves / core.references。"""

    return (
        {"module": "history", "kind": "event", "id": event_id},
        {"module": "politics", "kind": "polity", "id": polity_id},
    )


def _create_link(
    client,
    world_id: str,
    source: EndpointRef,
    target: EndpointRef,
    link_type: str,
    meta: Optional[Dict[str, Any]] = None,
    label: Optional[str] = None,
    note: Optional[str] = None,
    time: Optional[Dict[str, Optional[str]]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "source": source,
        "target": target,
        "link_type": link_type,
    }
    if meta is not None:
        payload["meta"] = meta
    if label is not None:
        payload["label"] = label
    if note is not None:
        payload["note"] = note
    if time is not None:
        payload["time"] = time
    response = client.post(f"{API}/worlds/{world_id}/links", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _get_link(client, link_id: str) -> Dict[str, Any]:
    response = client.get(f"{API}/links/{link_id}")
    assert response.status_code == 200, response.text
    return response.json()


def _world_link_ids(client, world_id: str) -> List[str]:
    response = client.get(f"{API}/worlds/{world_id}/links")
    assert response.status_code == 200, response.text
    return [link["id"] for link in response.json()]


def _counts(client, world_id: str) -> List[Dict[str, Any]]:
    response = client.get(f"{API}/worlds/{world_id}/links/counts")
    assert response.status_code == 200, response.text
    return response.json()


def _create_character(client, project_id: str, name: str) -> str:
    response = client.post(f"{PROJECTS}{project_id}/characters", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _move_one(
    client, link_id: str, world_id: Optional[str] = None, with_body: bool = True
):
    url = f"{API}/links/{link_id}/move"
    if not with_body:
        return client.post(url)
    payload: Dict[str, Any] = {} if world_id is None else {"world_id": world_id}
    return client.post(url, json=payload)


def _move_many(
    client,
    world_id: str,
    link_ids: List[str],
    target_world_id: Optional[str] = None,
):
    payload: Dict[str, Any] = {"link_ids": link_ids}
    if target_world_id is not None:
        payload["target_world_id"] = target_world_id
    return client.post(f"{API}/worlds/{world_id}/links/move", json=payload)


# ---------------------------------------------------------------------------
# 原生 SQL 辅助（读取落库结果 / 构造契约外 link_type）
# ---------------------------------------------------------------------------


def _query(db_path: Path, sql: str, parameters: tuple = ()) -> List[Dict[str, Any]]:
    connection = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in connection.execute(sql, parameters).fetchall()]
    finally:
        connection.close()


def _insert_link_row(
    db_path: Path,
    world_id: str,
    source: EndpointRef,
    target: EndpointRef,
    link_type: str,
    directed: bool = True,
    meta: Optional[str] = None,
) -> str:
    """直接落库一条关联（写入侧 API 造不出的形状：对称反向边、非对象 meta 等）。"""

    link_id = str(uuid.uuid4())
    connection = sqlite3.connect(str(db_path))
    try:
        connection.execute(
            "INSERT INTO world_links (id, world_id, source_module, source_kind, "
            "source_id, target_module, target_kind, target_id, link_type, directed, "
            "label, note, meta, time, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,NULL,"
            "CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            (
                link_id,
                world_id,
                source["module"],
                source["kind"],
                source["id"],
                target["module"],
                target["kind"],
                target["id"],
                link_type,
                1 if directed else 0,
                meta,
            ),
        )
        connection.commit()
    finally:
        connection.close()
    return link_id


def _insert_contract_foreign_link(
    db_path: Path, world_id: str, source: EndpointRef, target: EndpointRef
) -> str:
    """直接落库一条契约外 link_type 的关联（写入侧 API 不会接受）。"""

    return _insert_link_row(
        db_path,
        world_id,
        source,
        target,
        "ghost.link",
        meta=json.dumps({"migratedFrom": "test"}, ensure_ascii=False),
    )


# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


@pytest.fixture()
def staged(client) -> Dict[str, Any]:
    """同项目下的迁移容器世界 + 目标世界；目标世界含 event/polity 两个端点。"""

    project_id = _create_project(client, "P2-T12 归位项目")
    container = _create_world(
        client,
        "关联迁移容器",
        project_id,
        settings={"migrationContainer": True, "projectId": project_id},
    )
    target = _create_world(client, "归位目标世界", project_id)
    modules = _modules_by_type(client, target["id"])
    event_id = _create_submodule(client, modules["history"]["id"], "大战", "event")
    polity_id = _create_submodule(client, modules["politics"]["id"], "旧政权", "polity")
    return {
        "project_id": project_id,
        "container_id": container["id"],
        "target_id": target["id"],
        "event_id": event_id,
        "polity_id": polity_id,
    }


# ---------------------------------------------------------------------------
# 单条归位
# ---------------------------------------------------------------------------


def test_move_routes_follow_frozen_contract(client):
    """契约 §6：两条路由挂在 /api/v1/worldbuilding 下，且不新增 GET。"""

    schema = client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/v1/worldbuilding/links/{link_id}/move",
        "/api/v1/worldbuilding/worlds/{world_id}/links/move",
    ):
        assert path in schema
        assert set(schema[path]) == {"post"}


def test_move_link_with_explicit_world_keeps_meta_and_endpoints(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    meta = {
        "projectId": staged["project_id"],
        "legacyRelationType": "causal",
        "strength": "strong",
        "legacySourceName": "大战",
        "legacyTargetName": "旧政权",
        "confidence": 0.9,
    }
    link = _create_link(
        client,
        staged["container_id"],
        source,
        target,
        "history.involves",
        meta=meta,
        label="因果",
        note="归位备注",
        time={"start": "100", "end": "200"},
    )

    response = _move_one(client, link["id"], staged["target_id"])
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["id"] == link["id"]
    assert body["world_id"] == staged["target_id"]
    # 只改 world_id：端点、语义字段、time 全保留
    assert body["source"] == source
    assert body["target"] == target
    assert body["link_type"] == "history.involves"
    assert body["label"] == "因果"
    assert body["note"] == "归位备注"
    assert body["time"] == {"start": "100", "end": "200"}

    # meta 记账键保留 + 追加 reclassifiedFrom / reclassifiedAt
    for key, value in meta.items():
        assert body["meta"][key] == value
    assert body["meta"]["reclassifiedFrom"] == staged["container_id"]
    assert isinstance(body["meta"]["reclassifiedAt"], str)
    datetime.fromisoformat(body["meta"]["reclassifiedAt"])

    # 落库与列表归属同步
    assert _get_link(client, link["id"]) == body
    assert link["id"] in _world_link_ids(client, staged["target_id"])
    assert link["id"] not in _world_link_ids(client, staged["container_id"])


def test_move_link_without_body_derives_world_from_endpoints(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    # 完全不发请求体：按 source/target_id -> module_id -> world_id 推导
    response = _move_one(client, link["id"], with_body=False)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["world_id"] == staged["target_id"]
    assert body["meta"]["reclassifiedFrom"] == staged["container_id"]


def test_move_link_derives_world_from_module_item_endpoint(client, staged):
    """端点解析同样覆盖 world_module_items（模块项也是合法实体）。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    modules = _modules_by_type(client, staged["target_id"])
    item = client.post(
        f"{API}/modules/{modules['history']['id']}/items",
        json={"name": "条目", "content": {"text": "内容"}},
    )
    assert item.status_code == 200, item.text
    item_id = item.json()["id"]

    link = _create_link(
        client,
        staged["container_id"],
        {"module": "history", "kind": "event", "id": item_id},
        target,
        "history.involves",
    )
    response = _move_one(client, link["id"], with_body=False)
    assert response.status_code == 200, response.text
    assert response.json()["world_id"] == staged["target_id"]


def test_move_link_endpoint_world_conflict_returns_409_without_write(client, staged):
    _, third_polity = _world_with_entity(
        client, staged["project_id"], "第三世界", "politics", "polity", "第三政权"
    )
    source = {"module": "history", "kind": "event", "id": staged["event_id"]}
    target = {"module": "politics", "kind": "polity", "id": third_polity}
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    response = _move_one(client, link["id"])
    assert response.status_code == 409, response.text
    assert response.json()["detail"] == {
        "code": "endpoint_world_conflict",
        "message": "关联两端分属不同世界，请显式指定 world_id",
    }

    # 不落库：world_id 与 meta 均未变
    fetched = _get_link(client, link["id"])
    assert fetched["world_id"] == staged["container_id"]
    assert fetched["meta"] is None
    assert link["id"] in _world_link_ids(client, staged["container_id"])


def test_move_link_with_explicit_world_overrides_endpoint_conflict(client, staged):
    """显式指定 world_id 时不再做端点推导，端点分属不同世界也允许。"""

    _, third_polity = _world_with_entity(
        client, staged["project_id"], "第三世界", "politics", "polity", "第三政权"
    )
    link = _create_link(
        client,
        staged["container_id"],
        {"module": "history", "kind": "event", "id": staged["event_id"]},
        {"module": "politics", "kind": "polity", "id": third_polity},
        "history.involves",
    )

    response = _move_one(client, link["id"], staged["target_id"])
    assert response.status_code == 200, response.text
    assert response.json()["world_id"] == staged["target_id"]


def test_move_link_to_world_with_equivalent_edge_returns_409(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    existing = _create_link(
        client, staged["target_id"], source, target, "history.involves"
    )

    response = _move_one(client, link["id"], staged["target_id"])
    assert response.status_code == 409, response.text
    # 既有 link id 固定在结构化 detail 里（前端据此改用已有边）
    assert response.json()["detail"] == {
        "code": "duplicate_link",
        "message": "目标世界已有等价关联",
        "existing_id": existing["id"],
    }

    fetched = _get_link(client, link["id"])
    assert fetched["world_id"] == staged["container_id"]
    assert fetched["meta"] is None


def test_move_link_detects_symmetric_duplicate_in_target_world(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "core.related_to"
    )
    # 目标世界已有反向等价边：对称关系正反向任一命中即为重复
    existing = _create_link(
        client, staged["target_id"], target, source, "core.related_to"
    )

    response = _move_one(client, link["id"], staged["target_id"])
    assert response.status_code == 409, response.text
    assert response.json()["detail"] == {
        "code": "duplicate_link",
        "message": "目标世界已有等价关联",
        "existing_id": existing["id"],
    }
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]


def test_move_link_cross_project_returns_400(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    other_project_id = _create_project(client, "P2-T12 别的项目")
    other_world = _create_world(client, "别项目世界", other_project_id)

    response = _move_one(client, link["id"], other_world["id"])
    assert response.status_code == 400, response.text
    assert "不属于同一项目" in response.json()["detail"]
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]


def test_move_link_unknown_link_or_world_returns_404(client, staged):
    assert _move_one(client, "missing-link").status_code == 404

    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    response = _move_one(client, link["id"], "missing-world")
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "世界不存在: missing-world"
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]


def test_move_link_rejects_contract_foreign_link_type(client, staged, app_db_path):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    ghost_id = _insert_contract_foreign_link(
        app_db_path, staged["container_id"], source, target
    )

    response = _move_one(client, ghost_id, staged["target_id"])
    assert response.status_code == 400, response.text
    assert "未知的关联类型" in response.json()["detail"]

    rows = _query(
        app_db_path, "SELECT world_id FROM world_links WHERE id = ?", (ghost_id,)
    )
    assert rows[0]["world_id"] == staged["container_id"]


def test_move_link_to_current_world_returns_400(client, staged):
    """归位到关联当前所在世界：400，且不产生记账写入。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    response = _move_one(client, link["id"], staged["container_id"])
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "关联已位于目标世界，无需归位"

    fetched = _get_link(client, link["id"])
    assert fetched["world_id"] == staged["container_id"]
    assert fetched["meta"] is None


def test_move_link_409_detail_shapes(client, staged):
    """两种 409 的 detail 都是结构化判别码，前端可分别处理。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])

    # 目标世界已有等价边：可改用既有边
    duplicate = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    existing = _create_link(
        client, staged["target_id"], source, target, "history.involves"
    )
    response = _move_one(client, duplicate["id"], staged["target_id"])
    assert response.status_code == 409, response.text
    assert response.json()["detail"] == {
        "code": "duplicate_link",
        "message": "目标世界已有等价关联",
        "existing_id": existing["id"],
    }

    # 端点分属不同世界：没有替代边，不得与上一种混为一谈
    _, third_polity = _world_with_entity(
        client, staged["project_id"], "第四世界", "politics", "polity", "第四政权"
    )
    split = _create_link(
        client,
        staged["container_id"],
        source,
        {"module": "politics", "kind": "polity", "id": third_polity},
        "history.involves",
    )
    response = _move_one(client, split["id"])
    assert response.status_code == 409, response.text
    assert response.json()["detail"] == {
        "code": "endpoint_world_conflict",
        "message": "关联两端分属不同世界，请显式指定 world_id",
    }


def test_move_link_preserves_non_object_meta_as_legacy_meta(
    client, staged, app_db_path
):
    """meta 是 JSON 字符串/数组的历史行：原值转入 legacyMeta，不静默丢弃。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    string_link = _insert_link_row(
        app_db_path,
        staged["container_id"],
        source,
        target,
        "history.involves",
        meta=json.dumps("历史字符串 meta", ensure_ascii=False),
    )
    array_link = _insert_link_row(
        app_db_path,
        staged["container_id"],
        source,
        target,
        "core.references",
        meta=json.dumps(["旧数组"], ensure_ascii=False),
    )

    # 注意：migrations/env.py 的 fileConfig 会 disable 已存在的 logger，
    # 且 app.main 导入时会清空根处理器，所以这里直接给 service logger
    # 挂处理器并临时解除 disabled（测试结束恢复）
    warnings: List[str] = []
    service_logger = logging.getLogger("app.services.link_service")
    original_level = service_logger.level
    original_disabled = service_logger.disabled

    class _CaptureHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            warnings.append(record.getMessage())

    handler = _CaptureHandler()
    service_logger.addHandler(handler)
    service_logger.setLevel(logging.WARNING)
    service_logger.disabled = False
    try:
        string_response = _move_one(client, string_link, staged["target_id"])
        array_response = _move_one(client, array_link, staged["target_id"])
    finally:
        service_logger.disabled = original_disabled
        service_logger.setLevel(original_level)
        service_logger.removeHandler(handler)

    for response, legacy in (
        (string_response, "历史字符串 meta"),
        (array_response, ["旧数组"]),
    ):
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["world_id"] == staged["target_id"]
        assert body["meta"]["legacyMeta"] == legacy
        assert body["meta"]["reclassifiedFrom"] == staged["container_id"]
        assert isinstance(body["meta"]["reclassifiedAt"], str)
        datetime.fromisoformat(body["meta"]["reclassifiedAt"])

    # 两条非对象 meta 各留一条 warning
    assert len(warnings) == 2
    assert all("legacyMeta" in message for message in warnings)

    # 落库与响应一致
    for link_id in (string_link, array_link):
        rows = _query(
            app_db_path, "SELECT meta FROM world_links WHERE id = ?", (link_id,)
        )
        assert json.loads(rows[0]["meta"]) == _get_link(client, link_id)["meta"]


# ---------------------------------------------------------------------------
# 角色端点（character.character 是项目级实体）
# ---------------------------------------------------------------------------


def test_move_link_resolves_character_endpoint_in_single_world_project(client):
    """项目只有一个世界时，角色端点解析到该世界；两端都是角色也可推导。"""

    project_id = _create_project(client, "角色单世界项目")
    world_id, event_id = _world_with_entity(
        client, project_id, "唯一世界", "history", "event", "唯一事件"
    )
    first = _create_character(client, project_id, "角色甲")
    second = _create_character(client, project_id, "角色乙")
    character = {"module": "character", "kind": "character", "id": first}

    # character -> history.event：两端都指向唯一世界，等于关联当前世界
    link = _create_link(
        client,
        world_id,
        character,
        {"module": "history", "kind": "event", "id": event_id},
        "core.references",
    )
    response = _move_one(client, link["id"], with_body=False)
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "关联已位于目标世界，无需归位"

    # character -> character：只有走角色分支才能解析到唯一世界（否则无法推导）
    pair = _create_link(
        client,
        world_id,
        character,
        {"module": "character", "kind": "character", "id": second},
        "core.related_to",
    )
    response = _move_one(client, pair["id"], with_body=False)
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "关联已位于目标世界，无需归位"

    assert _get_link(client, link["id"])["world_id"] == world_id
    assert _get_link(client, pair["id"])["world_id"] == world_id


def test_move_character_endpoint_with_multiple_worlds_reports_ambiguous(client, staged):
    """项目有多个世界时角色无法唯一归属：批量 invalid 带 code，单条 400。"""

    first = _create_character(client, staged["project_id"], "歧义角色甲")
    second = _create_character(client, staged["project_id"], "歧义角色乙")
    character = {"module": "character", "kind": "character", "id": first}
    other_character = {"module": "character", "kind": "character", "id": second}
    ambiguous_reason = (
        "无法推导目标世界：关联端点含角色，角色为项目级实体、"
        "无法唯一归属世界，请显式指定 world_id"
    )

    link = _create_link(
        client, staged["container_id"], character, other_character, "core.related_to"
    )
    response = _move_many(client, staged["container_id"], [link["id"]])
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 0,
        "conflicts": [],
        "invalid": [
            {
                "link_id": link["id"],
                "code": "character_world_ambiguous",
                "reason": ambiguous_reason,
            }
        ],
    }
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]

    # 单条同一语义：400 字符串 detail
    single = _move_one(client, link["id"], with_body=False)
    assert single.status_code == 400, single.text
    assert single.json()["detail"] == ambiguous_reason
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]

    # 另一端可解析时用可解析的一端：角色歧义不阻塞归位
    mixed = _create_link(
        client,
        staged["container_id"],
        character,
        {"module": "history", "kind": "event", "id": staged["event_id"]},
        "core.references",
    )
    response = _move_many(client, staged["container_id"], [mixed["id"]])
    assert response.status_code == 200, response.text
    assert response.json() == {"moved": 1, "conflicts": [], "invalid": []}
    assert _get_link(client, mixed["id"])["world_id"] == staged["target_id"]


# ---------------------------------------------------------------------------
# 批量归位
# ---------------------------------------------------------------------------


def test_batch_move_reports_conflict_and_invalid_without_blocking(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    ok_link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    conflict_link = _create_link(
        client, staged["container_id"], source, target, "core.references"
    )
    existing = _create_link(
        client, staged["target_id"], source, target, "core.references"
    )
    other_world_id, other_polity = _world_with_entity(
        client, staged["project_id"], "别的世界", "politics", "polity", "别的政权"
    )
    other_link = _create_link(
        client,
        other_world_id,
        source,
        {"module": "politics", "kind": "polity", "id": other_polity},
        "history.involves",
    )

    response = _move_many(
        client,
        staged["container_id"],
        [ok_link["id"], conflict_link["id"], other_link["id"]],
        staged["target_id"],
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["moved"] == 1
    assert body["conflicts"] == [
        {
            "link_id": conflict_link["id"],
            "code": "duplicate_link",
            "existing_id": existing["id"],
        }
    ]
    assert body["invalid"] == [
        {
            "link_id": other_link["id"],
            "code": "not_in_world",
            "reason": "关联不属于该世界",
        }
    ]

    # 成功项落位、冲突项与非法项原地不动
    assert _get_link(client, ok_link["id"])["world_id"] == staged["target_id"]
    assert _get_link(client, conflict_link["id"])["world_id"] == staged["container_id"]
    assert _get_link(client, other_link["id"])["world_id"] == other_world_id


def test_batch_move_derives_target_per_link_and_reports_invalid(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    ok_link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    _, third_polity = _world_with_entity(
        client, staged["project_id"], "第三世界", "politics", "polity", "第三政权"
    )
    split_link = _create_link(
        client,
        staged["container_id"],
        source,
        {"module": "politics", "kind": "polity", "id": third_polity},
        "history.involves",
    )
    orphan_link = _create_link(
        client,
        staged["container_id"],
        {"module": "history", "kind": "event", "id": "ghost-source"},
        {"module": "politics", "kind": "polity", "id": "ghost-target"},
        "core.references",
    )

    response = _move_many(
        client,
        staged["container_id"],
        [ok_link["id"], split_link["id"], orphan_link["id"]],
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["moved"] == 1
    assert body["conflicts"] == []
    invalid = {item["link_id"]: item for item in body["invalid"]}
    assert set(invalid) == {split_link["id"], orphan_link["id"]}
    assert invalid[split_link["id"]]["code"] == "endpoint_world_conflict"
    assert "分属不同世界" in invalid[split_link["id"]]["reason"]
    assert invalid[orphan_link["id"]]["code"] == "unresolvable_endpoint"
    assert "无法推导目标世界" in invalid[orphan_link["id"]]["reason"]

    assert _get_link(client, ok_link["id"])["world_id"] == staged["target_id"]
    assert _get_link(client, split_link["id"])["world_id"] == staged["container_id"]
    assert _get_link(client, orphan_link["id"])["world_id"] == staged["container_id"]


def test_batch_move_to_current_world_reports_invalid(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    response = _move_many(
        client, staged["container_id"], [link["id"]], staged["container_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 0,
        "conflicts": [],
        "invalid": [
            {
                "link_id": link["id"],
                "code": "already_in_target",
                "reason": "关联已位于目标世界，无需归位",
            }
        ],
    }


def test_batch_move_unknown_link_or_world_returns_404(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    assert (
        _move_many(client, staged["container_id"], ["missing-link"]).status_code == 404
    )
    assert _move_many(client, "missing-world", [link["id"]]).status_code == 404
    assert (
        _move_many(client, staged["container_id"], [link["id"]], "missing-world")
    ).status_code == 404
    # 请求级失败不产生部分写入
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]


def test_batch_move_rejects_contract_foreign_link_type_without_partial_write(
    client, staged, app_db_path
):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    ok_link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    ghost_a = _insert_contract_foreign_link(
        app_db_path, staged["container_id"], source, target
    )
    ghost_b = _insert_contract_foreign_link(
        app_db_path, staged["container_id"], source, target
    )

    response = _move_many(
        client,
        staged["container_id"],
        [ghost_a, ok_link["id"], ghost_b],
        staged["target_id"],
    )
    assert response.status_code == 400, response.text
    # 结构化 detail：前端可据此指出具体是哪几行
    assert response.json()["detail"] == {
        "code": "foreign_link_type",
        "message": "未知的关联类型：ghost.link",
        "link_ids": [ghost_a, ghost_b],
    }
    # 合法项也不得落库（整体拒绝）
    assert _get_link(client, ok_link["id"])["world_id"] == staged["container_id"]
    assert _get_link(client, ghost_a)["world_id"] == staged["container_id"]
    assert _get_link(client, ghost_b)["world_id"] == staged["container_id"]


def test_batch_move_cross_project_returns_400(client, staged):
    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    other_project_id = _create_project(client, "P2-T12 别的项目")
    other_world = _create_world(client, "别项目世界", other_project_id)

    response = _move_many(
        client, staged["container_id"], [link["id"]], other_world["id"]
    )
    assert response.status_code == 400, response.text
    assert "不属于同一项目" in response.json()["detail"]
    assert _get_link(client, link["id"])["world_id"] == staged["container_id"]


def test_batch_move_dedupes_symmetric_reverse_edges_in_same_batch(
    client, staged, app_db_path
):
    """同批次内新产生的对称等价边：第一条 moved，第二条 conflicts，不再双写。"""

    event = {"module": "history", "kind": "event", "id": staged["event_id"]}
    polity = {"module": "politics", "kind": "polity", "id": staged["polity_id"]}
    first = _create_link(
        client, staged["container_id"], event, polity, "core.related_to"
    )
    # 反向等价边无法经写入侧 API 造出（会被对称去重拒绝），用原生 SQL 落库
    second_id = _insert_link_row(
        app_db_path,
        staged["container_id"],
        polity,
        event,
        "core.related_to",
        directed=False,
    )

    response = _move_many(
        client, staged["container_id"], [first["id"], second_id], staged["target_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 1,
        "conflicts": [
            {
                "link_id": second_id,
                "code": "duplicate_link",
                "existing_id": first["id"],
            }
        ],
        "invalid": [],
    }
    assert _get_link(client, first["id"])["world_id"] == staged["target_id"]
    assert _get_link(client, second_id)["world_id"] == staged["container_id"]

    rows = _query(
        app_db_path,
        "SELECT id FROM world_links WHERE world_id = ? AND link_type = ?",
        (staged["target_id"], "core.related_to"),
    )
    assert [row["id"] for row in rows] == [first["id"]]


def test_batch_move_dedupes_identical_edges_in_same_batch(client, staged, app_db_path):
    """同批次内两条完全相同的边（core.references）：同样只落一条。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    first_id = _insert_link_row(
        app_db_path, staged["container_id"], source, target, "core.references"
    )
    second_id = _insert_link_row(
        app_db_path, staged["container_id"], source, target, "core.references"
    )

    response = _move_many(
        client, staged["container_id"], [first_id, second_id], staged["target_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 1,
        "conflicts": [
            {
                "link_id": second_id,
                "code": "duplicate_link",
                "existing_id": first_id,
            }
        ],
        "invalid": [],
    }
    assert _get_link(client, first_id)["world_id"] == staged["target_id"]
    assert _get_link(client, second_id)["world_id"] == staged["container_id"]

    rows = _query(
        app_db_path,
        "SELECT id FROM world_links WHERE world_id = ? AND link_type = ?",
        (staged["target_id"], "core.references"),
    )
    assert [row["id"] for row in rows] == [first_id]


def test_batch_move_ignores_duplicate_link_ids(client, staged):
    """link_ids 保序去重：重复项不再被误报为「不属于该世界」。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )

    response = _move_many(
        client, staged["container_id"], [link["id"], link["id"]], staged["target_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"moved": 1, "conflicts": [], "invalid": []}
    assert _get_link(client, link["id"])["world_id"] == staged["target_id"]
    assert link["id"] in _world_link_ids(client, staged["target_id"])
    assert link["id"] not in _world_link_ids(client, staged["container_id"])


def test_batch_move_invalid_carries_stable_code(client, staged):
    """invalid 元素带稳定 code：not_in_world / already_in_target / 推导两类失败。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    in_world = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    other_world_id, other_polity = _world_with_entity(
        client, staged["project_id"], "编码世界", "politics", "polity", "编码政权"
    )
    foreign = _create_link(
        client,
        other_world_id,
        source,
        {"module": "politics", "kind": "polity", "id": other_polity},
        "history.involves",
    )

    # 显式目标即当前世界：已在该世界 / 不属于该世界
    response = _move_many(
        client,
        staged["container_id"],
        [in_world["id"], foreign["id"]],
        staged["container_id"],
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 0,
        "conflicts": [],
        "invalid": [
            {
                "link_id": in_world["id"],
                "code": "already_in_target",
                "reason": "关联已位于目标世界，无需归位",
            },
            {
                "link_id": foreign["id"],
                "code": "not_in_world",
                "reason": "关联不属于该世界",
            },
        ],
    }
    assert _get_link(client, in_world["id"])["world_id"] == staged["container_id"]
    assert _get_link(client, foreign["id"])["world_id"] == other_world_id

    # 省略目标世界按端点推导：端点分属不同世界 / 两端都解析不到
    _, third_polity = _world_with_entity(
        client,
        staged["project_id"],
        "编码第三世界",
        "politics",
        "polity",
        "编码第三政权",
    )
    split = _create_link(
        client,
        staged["container_id"],
        source,
        {"module": "politics", "kind": "polity", "id": third_polity},
        "history.involves",
    )
    orphan = _create_link(
        client,
        staged["container_id"],
        {"module": "history", "kind": "event", "id": "ghost-source"},
        {"module": "politics", "kind": "polity", "id": "ghost-target"},
        "core.references",
    )

    response = _move_many(client, staged["container_id"], [split["id"], orphan["id"]])
    assert response.status_code == 200, response.text
    assert response.json() == {
        "moved": 0,
        "conflicts": [],
        "invalid": [
            {
                "link_id": split["id"],
                "code": "endpoint_world_conflict",
                "reason": "关联两端分属不同世界，请显式指定 world_id",
            },
            {
                "link_id": orphan["id"],
                "code": "unresolvable_endpoint",
                "reason": (
                    "无法推导目标世界：关联两端实体均不存在，请显式指定 world_id"
                ),
            },
        ],
    }
    assert _get_link(client, split["id"])["world_id"] == staged["container_id"]
    assert _get_link(client, orphan["id"])["world_id"] == staged["container_id"]


def test_batch_move_records_meta_accounting_keys(client, staged, app_db_path):
    """批量归位成功项的 meta 记账键与单条一致（保留原值 + 追加记账）。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    meta = {"legacyRelationType": "causal", "strength": "strong"}
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves", meta=meta
    )

    response = _move_many(
        client, staged["container_id"], [link["id"]], staged["target_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"moved": 1, "conflicts": [], "invalid": []}

    moved = _get_link(client, link["id"])
    assert moved["world_id"] == staged["target_id"]
    assert moved["meta"]["legacyRelationType"] == "causal"
    assert moved["meta"]["strength"] == "strong"
    assert moved["meta"]["reclassifiedFrom"] == staged["container_id"]
    assert isinstance(moved["meta"]["reclassifiedAt"], str)
    datetime.fromisoformat(moved["meta"]["reclassifiedAt"])

    rows = _query(
        app_db_path,
        "SELECT world_id, meta FROM world_links WHERE id = ?",
        (link["id"],),
    )
    assert rows[0]["world_id"] == staged["target_id"]
    assert json.loads(rows[0]["meta"]) == moved["meta"]


def test_batch_move_updates_module_counts(client, staged):
    """归位后模块级计数跟着变化（容器减、目标加）。"""

    source, target = _edge(staged["event_id"], staged["polity_id"])
    link = _create_link(
        client, staged["container_id"], source, target, "history.involves"
    )
    expected = [
        {"module": "history", "outgoing": 1, "incoming": 0, "total": 1},
        {"module": "politics", "outgoing": 0, "incoming": 1, "total": 1},
    ]

    assert _counts(client, staged["container_id"]) == expected
    assert _counts(client, staged["target_id"]) == []

    response = _move_many(
        client, staged["container_id"], [link["id"]], staged["target_id"]
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"moved": 1, "conflicts": [], "invalid": []}

    assert _counts(client, staged["container_id"]) == []
    assert _counts(client, staged["target_id"]) == expected

    assert _get_link(client, link["id"])["world_id"] == staged["target_id"]


# ---------------------------------------------------------------------------
# 旧接口行为不变
# ---------------------------------------------------------------------------


def test_legacy_relations_endpoint_unchanged(client, app_db_path):
    project_id = _create_project(client, "P2-T12 旧关系项目")
    world = _create_world(client, "旧关系世界", project_id)
    modules = _modules_by_type(client, world["id"])
    event_id = _create_submodule(client, modules["history"]["id"], "旧事件", "event")
    polity_id = _create_submodule(client, modules["politics"]["id"], "旧政权", "polity")

    payload = {
        "source_module": "history",
        "source_entity_type": "event",
        "source_entity_id": event_id,
        "source_entity_name": "旧事件",
        "target_module": "politics",
        "target_entity_type": "polity",
        "target_entity_id": polity_id,
        "target_entity_name": "旧政权",
        "relation_type": "causal",
        "bidirectional": False,
        "strength": "strong",
        "metadata": {"confidence": 0.9},
        "project_id": project_id,
    }
    response = client.post(RELATIONS, json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["relation_type"] == "causal"
    assert body["strength"] == "strong"
    assert body["project_id"] == project_id
    assert body["metadata_json"] == {"confidence": 0.9}

    # 旧表不新增写入；world_links 落在该项目唯一世界，meta 保留记账键
    assert (
        _query(app_db_path, "SELECT count(*) AS n FROM bidirectional_relations")[0]["n"]
        == 0
    )
    rows = _query(
        app_db_path,
        "SELECT world_id, link_type, meta FROM world_links WHERE id = ?",
        (body["id"],),
    )
    assert len(rows) == 1
    assert rows[0]["world_id"] == world["id"]
    assert rows[0]["link_type"] == "history.causes"
    meta = json.loads(rows[0]["meta"])
    for key in (
        "projectId",
        "legacyRelationType",
        "strength",
        "legacySourceName",
        "legacyTargetName",
    ):
        assert key in meta
    assert "reclassifiedFrom" not in meta

    listed = client.get(f"{RELATIONS}/project/{project_id}")
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [body["id"]]


def test_legacy_templates_endpoint_unchanged(client):
    project_id = _create_project(client, "P2-T12 旧模板项目")

    created = client.post(
        f"{API}/templates",
        json={"name": "旧模板", "project_id": project_id, "is_public": True},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["name"] == "旧模板"
    assert body["project_id"] == project_id
    assert body["is_public"] is True
    assert body["module_count"] == 0

    listed = client.get(f"{API}/templates", params={"project_id": project_id})
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [body["id"]]

    filtered = client.get(
        f"{API}/templates", params={"project_id": project_id, "is_public": True}
    )
    assert filtered.status_code == 200, filtered.text
    assert [item["id"] for item in filtered.json()] == [body["id"]]
