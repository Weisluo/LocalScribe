"""兼容与 API 测试（Phase 1 P1-T7 / Phase 0 §7 兼容类；Phase 6 P6-T10 收尾）

- 旧接口：/templates、/instances、/worldviews 兼容窗口已结束，一律 404
- 新接口：/worlds、/worlds/{id}/links、/links/{id}、/link-registry
- 保留的模块 / 子模块 / 条目路由（/modules、/submodules、/items）继续可用
"""

from __future__ import annotations

import uuid

import pytest

WORLD = "/api/v1/worldbuilding"


def new_project(client) -> str:
    response = client.post(
        "/api/v1/projects", json={"title": f"项目-{uuid.uuid4().hex[:8]}"}
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


@pytest.fixture()
def world_fixture(client):
    """一个项目 + 一个通过新 /worlds 接口创建的空白世界。"""

    project_id = new_project(client)
    response = client.post(
        f"{WORLD}/worlds", json={"name": "测试世界", "project_id": project_id}
    )
    assert response.status_code == 201, response.text
    world = response.json()
    detail = client.get(f"{WORLD}/worlds/{world['id']}").json()
    modules = {module["module_type"]: module for module in detail["modules"]}
    return {
        "project_id": project_id,
        "world": world,
        "modules": modules,
        "history_module": modules["history"],
    }


def create_submodule(client, module_id: str, **payload):
    body = {"name": "实体", "color": "#64748b", **payload}
    response = client.post(f"{WORLD}/modules/{module_id}/submodules", json=body)
    assert response.status_code in (200, 201), response.text
    return response.json()


# ------------------------------------------------------ 旧接口下架（P6-T10）

# 兼容窗口在 Phase 6 结束：旧读接口直接 404（不再只读保留）
LEGACY_GET_ROUTES = (
    "/templates",
    "/templates/some-id",
    "/templates/some-id/modules",
    "/templates/some-id/export",
    "/templates/some-id/export/file",
    "/worldviews",
    "/worldviews/xianxia",
    "/worldviews/xianxia/adaptations",
    "/projects/some-project/instances",
)


@pytest.mark.parametrize("path", LEGACY_GET_ROUTES)
def test_legacy_get_routes_are_gone(client, path):
    """下架后旧读接口一律 404。"""

    assert client.get(f"{WORLD}{path}").status_code == 404


LEGACY_WRITE_ROUTES = (
    ("post", "/templates", {"name": "旧模板", "project_id": "p"}),
    ("post", "/templates/search", {"project_id": "p"}),
    ("put", "/templates/some-id", {"name": "改名"}),
    ("delete", "/templates/some-id", None),
    ("post", "/templates/import", {"name": "旧模板", "modules": []}),
    ("post", "/templates/import/file", None),
    ("post", "/templates/some-id/modules", {"module_type": "history", "name": "历史"}),
    ("post", "/instances", {"template_id": "x", "project_id": "p", "name": "实例"}),
    ("put", "/instances/some-id", {"name": "改名"}),
    ("delete", "/instances/some-id", None),
    ("post", "/worldviews", {"type": "custom", "name": "自建"}),
    ("put", "/worldviews/some-id", {"name": "改名"}),
    ("delete", "/worldviews/some-id", None),
    ("post", "/batch/delete", {"ids": ["x"]}),
    ("post", "/batch/order", {"items": [{"id": "x", "order_index": 0}]}),
)


@pytest.mark.parametrize("method,path,body", LEGACY_WRITE_ROUTES)
def test_legacy_write_routes_are_gone(client, method, path, body):
    """下架后旧写接口一律 404（不再返回 410 迁移指引）。"""

    request = getattr(client, method)
    response = (
        request(f"{WORLD}{path}", json=body)
        if body is not None
        else request(f"{WORLD}{path}")
    )
    assert (
        response.status_code == 404
    ), f"{method.upper()} {path}: {response.status_code}"


def test_world_module_delete_route_is_gone(client, world_fixture):
    """DELETE /modules/{id} 已下架；路径仍需承载 PUT /modules/{id}，因此只剩 405。"""

    history = world_fixture["history_module"]
    response = client.delete(f"{WORLD}/modules/{history['id']}")
    # 该路径仍承载 PUT /modules/{id}，所以不是 404 而是 405；这里按文档口径精确锁定
    assert response.status_code == 405, response.status_code
    assert (
        client.get(f"{WORLD}/worlds/{world_fixture['world']['id']}").status_code == 200
    )


def test_surviving_module_structure_routes_still_work(client, world_fixture):
    """保留的模块 / 子模块 / 条目路由仍可用，模块响应字段是 world_id（不是 template_id）。"""

    world_id = world_fixture["world"]["id"]
    history = world_fixture["history_module"]
    assert history["world_id"] == world_id
    assert "template_id" not in history

    renamed = client.put(f"{WORLD}/modules/{history['id']}", json={"name": "编年"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "编年"
    assert renamed.json()["world_id"] == world_id

    created = client.post(
        f"{WORLD}/modules/{history['id']}/submodules",
        json={"name": "第一纪元", "kind": "era"},
    )
    assert created.status_code in (200, 201), created.text
    submodule = created.json()
    assert submodule["module_id"] == history["id"]

    listed = client.get(f"{WORLD}/modules/{history['id']}/submodules")
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()] == [submodule["id"]]

    resaved = client.put(
        f"{WORLD}/submodules/{submodule['id']}", json={"name": "第一纪"}
    )
    assert resaved.status_code == 200
    assert resaved.json()["name"] == "第一纪"

    item = client.post(
        f"{WORLD}/modules/{history['id']}/items",
        json={"name": "参战方", "content": {"a": "b"}, "submodule_id": submodule["id"]},
    )
    assert item.status_code in (200, 201), item.text
    item_id = item.json()["id"]

    in_submodule = client.get(
        f"{WORLD}/modules/{history['id']}/items",
        params={"submodule_id": submodule["id"]},
    )
    assert [row["id"] for row in in_submodule.json()] == [item_id]
    # include_all 缺省时只返回不属于任何子模块的条目
    assert client.get(f"{WORLD}/modules/{history['id']}/items").json() == []

    updated_item = client.put(f"{WORLD}/items/{item_id}", json={"name": "主要参战方"})
    assert updated_item.status_code == 200
    assert updated_item.json()["name"] == "主要参战方"

    assert client.delete(f"{WORLD}/items/{item_id}").status_code == 200
    assert client.delete(f"{WORLD}/submodules/{submodule['id']}").status_code == 200
    assert client.get(f"{WORLD}/modules/{history['id']}/submodules").json() == []


# ---------------------------------------------------------------- 新接口


def test_worlds_crud_creates_seven_modules(client, world_fixture):
    world = world_fixture["world"]
    assert world["module_count"] == 7

    detail = client.get(f"{WORLD}/worlds/{world['id']}").json()
    assert sorted(m["module_type"] for m in detail["modules"]) == sorted(
        ["map", "history", "politics", "economy", "races", "systems", "special"]
    )

    updated = client.put(
        f"{WORLD}/worlds/{world['id']}",
        json={"tone": {"palette": "ink"}, "settings": {"complexity": "sketch"}},
    )
    assert updated.status_code == 200
    assert updated.json()["tone"] == {"palette": "ink"}
    assert updated.json()["settings"]["complexity"] == "sketch"

    listed = client.get(
        f"{WORLD}/worlds", params={"project_id": world_fixture["project_id"]}
    )
    assert world["id"] in {item["id"] for item in listed.json()}

    assert client.get(f"{WORLD}/worlds/does-not-exist").status_code == 404
    assert client.delete(f"{WORLD}/worlds/{world['id']}").status_code == 204
    assert client.get(f"{WORLD}/worlds/{world['id']}").status_code == 404


def test_module_update_accepts_partial_payloads(client, world_fixture):
    """PUT /modules/{id} 只带 config / name 时必须能用（旧实现直接读 module_type → 500）。"""

    economy = world_fixture["modules"]["economy"]
    history = world_fixture["modules"]["history"]

    # 只带 config：经济模块懒创建配置走的就是这条路径
    config = {"defaultComplexity": "structure", "metrics": []}
    updated = client.put(f"{WORLD}/modules/{economy['id']}", json={"config": config})
    assert updated.status_code == 200, updated.text
    assert updated.json()["config"] == config
    assert updated.json()["module_type"] == "economy"
    assert updated.json()["name"] == economy["name"]

    # 只带 name：其余字段不受影响
    renamed = client.put(f"{WORLD}/modules/{economy['id']}", json={"name": "营生"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "营生"
    assert renamed.json()["config"] == config

    # module_type 仍参与重复校验：改成已存在的类型要被拒
    duplicate = client.put(
        f"{WORLD}/modules/{economy['id']}", json={"module_type": "history"}
    )
    assert duplicate.status_code == 400
    assert history["module_type"] == "history"

    detail = client.get(f"{WORLD}/worlds/{world_fixture['world']['id']}").json()
    still_economy = next(m for m in detail["modules"] if m["id"] == economy["id"])
    assert still_economy["module_type"] == "economy"


def test_link_registry_exposes_contract_types(client):
    response = client.get(f"{WORLD}/link-registry")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()}
    assert len(ids) == 54
    assert "character.appears_in" in ids
    assert "politics.treaty_between" not in ids


def test_world_links_crud_and_validation(client, world_fixture):
    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]

    event = create_submodule(client, history_module["id"], name="大战")
    assert event["kind"] == "event"

    era = create_submodule(
        client, history_module["id"], name="第一纪元", color="era:ochre"
    )
    assert era["kind"] == "era"

    character_id = str(uuid.uuid4())
    link_payload = {
        "source": {"module": "history", "kind": "event", "id": event["id"]},
        "target": {"module": "character", "kind": "character", "id": character_id},
        "link_type": "history.involves",
        "note": "参战",
    }
    created = client.post(f"{WORLD}/worlds/{world_id}/links", json=link_payload)
    assert created.status_code == 201, created.text
    link = created.json()
    assert link["link_type"] == "history.involves"
    assert link["directed"] is True
    assert link["reverse_label"] == "被涉及"
    assert link["source"]["id"] == event["id"]

    # 同一条有向边重复创建 -> 409
    duplicate = client.post(f"{WORLD}/worlds/{world_id}/links", json=link_payload)
    assert duplicate.status_code == 409
    assert link["id"] in duplicate.json()["detail"]

    # kind 不匹配 -> 400
    mismatched = client.post(
        f"{WORLD}/worlds/{world_id}/links",
        json={
            **link_payload,
            "source": {"module": "history", "kind": "custom", "id": event["id"]},
        },
    )
    assert mismatched.status_code == 400

    # 契约外 link_type -> 400
    unknown = client.post(
        f"{WORLD}/worlds/{world_id}/links",
        json={**link_payload, "link_type": "history.not_a_type"},
    )
    assert unknown.status_code == 400

    # 世界不存在 -> 404
    missing_world = client.post(
        f"{WORLD}/worlds/no-such-world/links", json=link_payload
    )
    assert missing_world.status_code == 404

    # 对称关联只落一条
    symmetric_payload = {
        "source": {"module": "history", "kind": "era", "id": era["id"]},
        "target": {"module": "history", "kind": "event", "id": event["id"]},
        "link_type": "core.related_to",
    }
    first = client.post(f"{WORLD}/worlds/{world_id}/links", json=symmetric_payload)
    assert first.status_code == 201
    assert first.json()["directed"] is False

    reversed_payload = {
        "source": {"module": "history", "kind": "event", "id": event["id"]},
        "target": {"module": "history", "kind": "era", "id": era["id"]},
        "link_type": "core.related_to",
    }
    second = client.post(f"{WORLD}/worlds/{world_id}/links", json=reversed_payload)
    assert second.status_code == 409
    assert second.json()["detail"].count(first.json()["id"]) == 1

    # 查询：按世界、按实体
    listed = client.get(f"{WORLD}/worlds/{world_id}/links")
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    by_entity = client.get(
        f"{WORLD}/worlds/{world_id}/links",
        params={"module": "history", "entity_id": event["id"]},
    )
    assert by_entity.status_code == 200
    assert len(by_entity.json()) == 2

    half_filtered = client.get(
        f"{WORLD}/worlds/{world_id}/links", params={"module": "history"}
    )
    assert half_filtered.status_code == 422

    # 计数
    counts = client.get(f"{WORLD}/worlds/{world_id}/links/counts")
    assert counts.status_code == 200
    by_module = {item["module"]: item for item in counts.json()}
    assert by_module["history"]["outgoing"] == 2
    assert by_module["character"]["incoming"] == 1
    assert by_module["history"]["total"] >= 2

    # 单条读写
    got = client.get(f"{WORLD}/links/{link['id']}")
    assert got.status_code == 200
    patched = client.patch(
        f"{WORLD}/links/{link['id']}", json={"note": "改备注", "label": "自定义标签"}
    )
    assert patched.status_code == 200
    assert patched.json()["note"] == "改备注"

    assert client.get(f"{WORLD}/links/nope").status_code == 404
    assert client.patch(f"{WORLD}/links/nope", json={"note": "x"}).status_code == 404
    assert client.delete(f"{WORLD}/links/{link['id']}").status_code == 204
    assert client.get(f"{WORLD}/links/{link['id']}").status_code == 404


def test_world_export_import_round_trip(client, world_fixture):
    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]

    event = create_submodule(client, history_module["id"], name="大战")
    item = client.post(
        f"{WORLD}/modules/{history_module['id']}/items",
        json={"name": "参战方", "content": {"a": "b"}, "submodule_id": event["id"]},
    )
    assert item.status_code in (200, 201), item.text

    character_id = str(uuid.uuid4())
    link = client.post(
        f"{WORLD}/worlds/{world_id}/links",
        json={
            "source": {"module": "history", "kind": "event", "id": event["id"]},
            "target": {"module": "character", "kind": "character", "id": character_id},
            "link_type": "history.involves",
        },
    )
    assert link.status_code == 201

    exported = client.get(f"{WORLD}/worlds/{world_id}/export")
    assert exported.status_code == 200
    payload = exported.json()
    assert payload["schema_version"] == 1
    assert payload["world"]["id"] == world_id
    assert len(payload["modules"]) == 7
    assert len(payload["links"]) == 1

    target_project = new_project(client)
    imported = client.post(
        f"{WORLD}/worlds/import", json={**payload, "project_id": target_project}
    )
    assert imported.status_code == 201, imported.text
    report = imported.json()
    assert report["schema_version"] == 1
    assert report["mode"] == "new"
    # 1 个子模块 + 1 个条目
    assert report["entity_count"] == 2
    assert report["link_count"] == 1
    new_world_id = report["world"]["id"]
    assert new_world_id != world_id
    assert event["id"] in report["id_map"]

    detail = client.get(f"{WORLD}/worlds/{new_world_id}").json()
    assert len(detail["modules"]) == 7
    new_history = next(m for m in detail["modules"] if m["module_type"] == "history")
    assert len(new_history["submodules"]) == 1
    assert len(new_history["items"]) == 1
    # 端点 id 已重映射到新实体
    assert new_history["submodules"][0]["id"] != event["id"]

    new_links = client.get(f"{WORLD}/worlds/{new_world_id}/links").json()
    assert len(new_links) == 1
    assert new_links[0]["source"]["id"] == new_history["submodules"][0]["id"]
    assert new_links[0]["link_type"] == "history.involves"


def test_legacy_relation_write_goes_to_world_links(client, world_fixture):
    """旧 /relations 写接口是 world_links 适配层（D1：不再写旧表）。"""

    project_id = world_fixture["project_id"]
    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]
    politics_module = world_fixture["modules"]["politics"]

    event = create_submodule(client, history_module["id"], name="事件")
    polity = client.post(
        f"{WORLD}/modules/{politics_module['id']}/submodules",
        json={"name": "旧政权", "kind": "polity", "color": "custom"},
    )
    assert polity.status_code in (200, 201), polity.text
    polity_id = polity.json()["id"]

    created = client.post(
        "/api/v1/relations",
        json={
            "source_module": "history",
            "source_entity_type": "event",
            "source_entity_id": event["id"],
            "source_entity_name": "事件",
            "target_module": "politics",
            "target_entity_type": "polity",
            "target_entity_id": polity_id,
            "target_entity_name": "旧政权",
            "relation_type": "causal",
            "bidirectional": False,
            "strength": "strong",
            "project_id": project_id,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["source_entity_name"] == "事件"
    assert body["relation_type"] == "causal"
    assert body["bidirectional"] is False

    links = client.get(f"{WORLD}/worlds/{world_id}/links").json()
    assert [link["link_type"] for link in links] == ["history.causes"]
    assert links[0]["directed"] is True

    listed = client.get(f"/api/v1/relations/project/{project_id}")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [body["id"]]

    deleted = client.delete(
        f"/api/v1/relations/{body['id']}", params={"project_id": project_id}
    )
    assert deleted.status_code == 204
    assert client.get(f"{WORLD}/worlds/{world_id}/links").json() == []


def test_legacy_symmetric_relation_matches_backfill_mapping(client, world_fixture):
    """旧接口写 bidirectional=True 时的类型选择与 P1-MIG-05 回填口径一致（core.related_to）。"""

    project_id = world_fixture["project_id"]
    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]
    politics_module = world_fixture["modules"]["politics"]

    event = create_submodule(client, history_module["id"], name="事件二")
    polity = client.post(
        f"{WORLD}/modules/{politics_module['id']}/submodules",
        json={"name": "政权二", "kind": "polity"},
    )
    assert polity.status_code in (200, 201), polity.text

    created = client.post(
        "/api/v1/relations",
        json={
            "source_module": "history",
            "source_entity_type": "event",
            "source_entity_id": event["id"],
            "source_entity_name": "事件二",
            "target_module": "politics",
            "target_entity_type": "polity",
            "target_entity_id": polity.json()["id"],
            "target_entity_name": "政权二",
            "relation_type": "causal",
            "bidirectional": True,
            "project_id": project_id,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["bidirectional"] is True

    links = client.get(f"{WORLD}/worlds/{world_id}/links").json()
    assert [link["link_type"] for link in links] == ["core.related_to"]
    assert links[0]["directed"] is False


# ---------------------------------------------- P1 审查修复的回归用例


def test_world_import_keeps_submodule_parents_regardless_of_order(
    client, world_fixture
):
    """导入必须保住 parent_id：备份里子级（order_index 小）会排在父级之前。"""

    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]

    era = create_submodule(
        client,
        history_module["id"],
        name="第一纪元",
        color="era:ochre",
        order_index=5,
    )
    event = create_submodule(
        client,
        history_module["id"],
        name="大战",
        order_index=0,
        parent_id=era["id"],
    )
    assert event["parent_id"] == era["id"]

    payload = client.get(f"{WORLD}/worlds/{world_id}/export").json()
    exported = [s for module in payload["modules"] for s in module["submodules"]]
    names = [s["name"] for s in exported]
    assert names.index("大战") < names.index("第一纪元"), "前置条件：子级排在父级之前"

    target_project = new_project(client)
    imported = client.post(
        f"{WORLD}/worlds/import", json={**payload, "project_id": target_project}
    )
    assert imported.status_code == 201, imported.text

    detail = client.get(f"{WORLD}/worlds/{imported.json()['world']['id']}").json()
    by_name = {s["name"]: s for m in detail["modules"] for s in m["submodules"]}
    assert by_name["大战"]["parent_id"] == by_name["第一纪元"]["id"]


def test_world_import_reports_contract_external_link_type(client, world_fixture):
    """契约外的 link_type 回落 core.related_to 并计入报告（不再整包拒绝）。"""

    world_id = world_fixture["world"]["id"]
    payload = client.get(f"{WORLD}/worlds/{world_id}/export").json()
    payload["links"] = [
        {
            "source_module": "history",
            "source_kind": "event",
            "source_id": str(uuid.uuid4()),
            "target_module": "character",
            "target_kind": "character",
            "target_id": str(uuid.uuid4()),
            "link_type": "history.not_a_registered_type",
            "directed": True,
        }
    ]

    target_project = new_project(client)
    response = client.post(
        f"{WORLD}/worlds/import", json={**payload, "project_id": target_project}
    )
    assert response.status_code == 201, response.text
    report = response.json()
    assert report["unknown_link_types"] == ["history.not_a_registered_type"]
    assert report["link_count"] == 1
    assert any("回落" in warning for warning in report["warnings"])

    # 端点都在备份里（新生成的两个 uuid 不属于任何实体）→ 失效引用被报告，不丢世界
    assert report["dangling_refs"]
    new_world_id = report["world"]["id"]
    links = client.get(f"{WORLD}/worlds/{new_world_id}/links").json()
    assert [link["link_type"] for link in links] == ["core.related_to"]
    assert links[0]["directed"] is False


def test_world_import_merges_duplicate_symmetric_edges(client, world_fixture):
    """备份里带对称边两个方向时（旧回填允许）导入合并为一条。"""

    world_id = world_fixture["world"]["id"]
    history_module = world_fixture["history_module"]

    first = create_submodule(client, history_module["id"], name="甲")
    second = create_submodule(client, history_module["id"], name="乙")

    payload = client.get(f"{WORLD}/worlds/{world_id}/export").json()
    payload["links"] = [
        {
            "source_module": "history",
            "source_kind": "event",
            "source_id": first["id"],
            "target_module": "history",
            "target_kind": "event",
            "target_id": second["id"],
            "link_type": "core.related_to",
            "directed": False,
        },
        {
            "source_module": "history",
            "source_kind": "event",
            "source_id": second["id"],
            "target_module": "history",
            "target_kind": "event",
            "target_id": first["id"],
            "link_type": "core.related_to",
            "directed": False,
        },
    ]

    target_project = new_project(client)
    imported = client.post(
        f"{WORLD}/worlds/import", json={**payload, "project_id": target_project}
    )
    assert imported.status_code == 201, imported.text
    report = imported.json()
    assert report["merged_duplicates"] == 1
    assert report["link_count"] == 1

    new_links = client.get(f"{WORLD}/worlds/{report['world']['id']}/links").json()
    assert len(new_links) == 1
    assert new_links[0]["link_type"] == "core.related_to"
    assert new_links[0]["directed"] is False


def test_world_links_endpoints_404_for_unknown_world(client):
    """未知世界的关联列表与计数返回 404，而不是空数组。"""

    assert client.get(f"{WORLD}/worlds/no-such-world/links").status_code == 404
    assert client.get(f"{WORLD}/worlds/no-such-world/links/counts").status_code == 404
