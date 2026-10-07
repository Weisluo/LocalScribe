"""兼容与 API 测试（Phase 1 P1-T7 / Phase 0 §7 兼容类）

- 旧接口：/templates、/instances、/worldviews 仍可用（写接口 410 指引）
- 新接口：/worlds、/worlds/{id}/links、/links/{id}、/link-registry
- 兼容读写仍落在新结构（worlds / world_links）
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


# ---------------------------------------------------------------- 旧接口兼容


def test_legacy_templates_create_and_read_back_old_fields(client):
    project_id = new_project(client)
    created = client.post(
        f"{WORLD}/templates",
        json={
            "name": "旧接口世界",
            "description": "desc",
            "tags": ["旧标签", "第二个"],
            "is_public": False,
            "project_id": project_id,
        },
    )
    assert created.status_code in (200, 201), created.text
    body = created.json()

    # 旧响应字段一个不少
    for field in (
        "id",
        "name",
        "description",
        "cover_image",
        "tags",
        "is_public",
        "is_system_template",
        "project_id",
        "created_at",
        "updated_at",
        "created_by",
        "module_count",
        "instance_count",
    ):
        assert field in body, field

    assert body["tags"] == ["旧标签", "第二个"]
    assert body["is_public"] is False
    assert body["is_system_template"] is False

    # 列表与详情
    listed = client.get(f"{WORLD}/templates", params={"project_id": project_id})
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [body["id"]]

    detail = client.get(
        f"{WORLD}/templates/{body['id']}", params={"include_modules": True}
    )
    assert detail.status_code == 200
    assert detail.json()["modules"] == []

    # 新建模块（旧接口）-> 落在 world_modules.world_id
    module = client.post(
        f"{WORLD}/templates/{body['id']}/modules",
        json={"module_type": "history", "name": "历史"},
    )
    assert module.status_code in (200, 201), module.text
    assert module.json()["template_id"] == body["id"]

    modules = client.get(f"{WORLD}/templates/{body['id']}/modules")
    assert modules.status_code == 200
    assert [item["id"] for item in modules.json()] == [module.json()["id"]]

    # 导出仍然返回 template + modules
    exported = client.get(f"{WORLD}/templates/{body['id']}/export")
    assert exported.status_code == 200
    assert exported.json()["template"]["id"] == body["id"]
    assert len(exported.json()["modules"]) == 1

    # 更新（含旧字段）后仍能读回
    updated = client.put(
        f"{WORLD}/templates/{body['id']}", json={"tags": ["改标签"], "name": "改名世界"}
    )
    assert updated.status_code == 200
    assert updated.json()["tags"] == ["改标签"]
    assert updated.json()["name"] == "改名世界"

    # 旧搜索接口按 tags 过滤仍能命中旧值（settings.legacyTemplate）
    searched = client.post(f"{WORLD}/templates/search", json={"tags": ["改标签"]})
    assert searched.status_code == 200
    assert body["id"] in {item["id"] for item in searched.json()}

    assert client.delete(f"{WORLD}/templates/{body['id']}").status_code == 200


def test_legacy_instances_are_read_only_with_guidance(client):
    project_id = new_project(client)

    listed = client.get(f"{WORLD}/projects/{project_id}/instances")
    assert listed.status_code == 200
    assert listed.json() == []

    created = client.post(
        f"{WORLD}/instances",
        json={"template_id": "whatever", "project_id": project_id, "name": "实例"},
    )
    assert created.status_code == 410
    assert "worlds" in created.json()["detail"]

    updated = client.put(f"{WORLD}/instances/whatever", json={"name": "改名"})
    assert updated.status_code == 410

    deleted = client.delete(f"{WORLD}/instances/whatever")
    assert deleted.status_code == 410


def test_legacy_worldviews_read_only_with_guidance(client):
    listed = client.get(f"{WORLD}/worldviews")
    assert listed.status_code == 200
    assert len(listed.json()) >= 6  # 代码内置六套系统预设（只读，不迁移）

    typed = client.get(f"{WORLD}/worldviews/xianxia")
    assert typed.status_code == 200
    assert typed.json()["type"] == "xianxia"

    created = client.post(
        f"{WORLD}/worldviews", json={"type": "custom", "name": "自建"}
    )
    assert created.status_code == 410

    updated = client.put(f"{WORLD}/worldviews/whatever", json={"name": "改名"})
    assert updated.status_code == 410

    deleted = client.delete(f"{WORLD}/worldviews/whatever")
    assert deleted.status_code == 410


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
    updated = client.put(
        f"{WORLD}/modules/{economy['id']}", json={"config": config}
    )
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
    assert payload["world"]["id"] == world_id
    assert len(payload["modules"]) == 7
    assert len(payload["links"]) == 1

    target_project = new_project(client)
    imported = client.post(
        f"{WORLD}/worlds/import", json={**payload, "project_id": target_project}
    )
    assert imported.status_code == 201, imported.text
    new_world_id = imported.json()["id"]
    assert new_world_id != world_id

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

    detail = client.get(f"{WORLD}/worlds/{imported.json()['id']}").json()
    by_name = {s["name"]: s for m in detail["modules"] for s in m["submodules"]}
    assert by_name["大战"]["parent_id"] == by_name["第一纪元"]["id"]


def test_world_import_rejects_contract_external_link_type(client, world_fixture):
    """导入的关联必须过契约 §4 校验，且非法时整包拒绝（不产生半成品世界）。"""

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
    assert response.status_code == 400, response.text
    assert "第 1 条关联非法" in response.json()["detail"]

    # 部分写入必须不存在：目标项目下没有新世界
    assert (
        client.get(f"{WORLD}/worlds", params={"project_id": target_project}).json()
        == []
    )


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

    new_links = client.get(f"{WORLD}/worlds/{imported.json()['id']}/links").json()
    assert len(new_links) == 1
    assert new_links[0]["link_type"] == "core.related_to"
    assert new_links[0]["directed"] is False


def test_world_links_endpoints_404_for_unknown_world(client):
    """未知世界的关联列表与计数返回 404，而不是空数组。"""

    assert client.get(f"{WORLD}/worlds/no-such-world/links").status_code == 404
    assert client.get(f"{WORLD}/worlds/no-such-world/links/counts").status_code == 404


def test_legacy_template_is_public_filter_matches_response(client):
    """旧 /templates 的 is_public 过滤必须与响应字段一致（都读 settings.legacyTemplate）。"""

    project_id = new_project(client)
    public = client.post(
        f"{WORLD}/templates",
        json={"name": "公开世界", "is_public": True, "project_id": project_id},
    ).json()
    private = client.post(
        f"{WORLD}/templates",
        json={"name": "私有世界", "is_public": False, "project_id": project_id},
    ).json()
    assert public["is_public"] is True
    assert private["is_public"] is False

    listed_public = client.get(
        f"{WORLD}/templates", params={"project_id": project_id, "is_public": True}
    ).json()
    assert [item["id"] for item in listed_public] == [public["id"]]

    searched_public = client.post(
        f"{WORLD}/templates/search",
        json={"project_id": project_id, "is_public": True},
    ).json()
    assert [item["id"] for item in searched_public] == [public["id"]]

    listed_private = client.get(
        f"{WORLD}/templates", params={"project_id": project_id, "is_public": False}
    ).json()
    assert [item["id"] for item in listed_private] == [private["id"]]


def test_legacy_template_system_flag_filter_matches_response(client):
    """is_system_template 与 is_public 同口径。"""

    project_id = new_project(client)
    system = client.post(
        f"{WORLD}/templates",
        json={"name": "系统模板", "is_system_template": True, "project_id": project_id},
    ).json()
    assert system["is_system_template"] is True

    listed = client.get(
        f"{WORLD}/templates",
        params={"project_id": project_id, "is_system_template": True},
    ).json()
    assert [item["id"] for item in listed] == [system["id"]]
