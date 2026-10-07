"""P6 契约冒烟：schema_version、导入报告、两种恢复模式、模块补齐路由。

（Lead 集成用；随后由 P6 后端工作流扩展为正式用例）
"""

import sqlite3
from pathlib import Path

API = "/api/v1/worldbuilding"


def _create_project(client):
    body = client.post("/api/v1/projects", json={"title": "P6 冒烟"}).json()
    return body["id"]


def test_world_export_carries_schema_version(client):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "备份世界", "project_id": project_id}
    ).json()
    exported = client.get(f"{API}/worlds/{world['id']}/export")
    assert exported.status_code == 200
    payload = exported.json()
    assert payload["schema_version"] == 1
    assert len(payload["modules"]) == 7


def test_world_import_new_mode_reports_mapping(client):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "源世界", "project_id": project_id}
    ).json()
    module = client.get(f"{API}/worlds/{world['id']}").json()["modules"][1]
    submodule = client.post(
        f"{API}/modules/{module['id']}/submodules",
        json={"name": "第一纪元", "kind": "era"},
    ).json()
    client.post(
        f"{API}/worlds/{world['id']}/links",
        json={
            "source": {"module": "history", "kind": "era", "id": submodule["id"]},
            "target": {"module": "history", "kind": "event", "id": "ghost-event"},
            "link_type": "core.related_to",
        },
    )
    exported = client.get(f"{API}/worlds/{world['id']}/export").json()
    exported["project_id"] = project_id

    imported = client.post(f"{API}/worlds/import", json=exported)
    assert imported.status_code == 201, imported.text
    report = imported.json()
    assert report["mode"] == "new"
    assert report["schema_version"] == 1
    assert report["entity_count"] == 1
    assert report["link_count"] == 1
    assert submodule["id"] in report["id_map"]
    assert report["id_map"][submodule["id"]] != submodule["id"]
    assert report["dangling_refs"] == [
        {
            "role": "target",
            "module": "history",
            "kind": "event",
            "id": "ghost-event",
            "link_type": "core.related_to",
        }
    ]


def test_world_import_rejects_future_schema_version(client):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "版本世界", "project_id": project_id}
    ).json()
    exported = client.get(f"{API}/worlds/{world['id']}/export").json()
    exported["schema_version"] = 99
    resp = client.post(f"{API}/worlds/import", json=exported)
    assert resp.status_code == 400
    assert "备份版本" in resp.json()["detail"]


def test_world_import_overwrite_requires_confirm(client):
    project_id = _create_project(client)
    source = client.post(
        f"{API}/worlds", json={"name": "备份源", "project_id": project_id}
    ).json()
    target = client.post(
        f"{API}/worlds", json={"name": "目标世界", "project_id": project_id}
    ).json()

    # 目标世界放一个「只属于它」的实体，覆盖后必须消失
    target_modules = client.get(f"{API}/worlds/{target['id']}").json()["modules"]
    target_history = next(m for m in target_modules if m["module_type"] == "history")
    client.post(
        f"{API}/modules/{target_history['id']}/submodules",
        json={"name": "目标世界的旧时代", "kind": "era"},
    )
    client.post(
        f"{API}/modules/{target_history['id']}/items",
        json={"name": "已有条目", "content": {"text": "非空"}},
    )

    # 备份源自带一个实体，覆盖后应出现在目标世界里
    source_history = next(
        m
        for m in client.get(f"{API}/worlds/{source['id']}").json()["modules"]
        if m["module_type"] == "history"
    )
    source_era = client.post(
        f"{API}/modules/{source_history['id']}/submodules",
        json={"name": "源世界时代", "kind": "era"},
    ).json()
    exported = client.get(f"{API}/worlds/{source['id']}/export").json()
    exported["mode"] = "overwrite"
    exported["target_world_id"] = target["id"]
    exported["confirm_overwrite"] = False
    blocked = client.post(f"{API}/worlds/import", json=exported)
    assert blocked.status_code == 409

    exported["confirm_overwrite"] = True
    done = client.post(f"{API}/worlds/import", json=exported)
    assert done.status_code == 201, done.text
    report = done.json()
    assert report["mode"] == "overwrite"
    assert report["world"]["id"] == target["id"]
    assert report["entity_count"] == 1
    assert source_era["id"] in report["id_map"]

    # 覆盖语义：目标世界旧内容被清空、备份内容在新 id 空间重建
    overwritten = client.get(f"{API}/worlds/{target['id']}").json()
    names = [
        submodule["name"]
        for module in overwritten["modules"]
        for submodule in module["submodules"]
    ]
    assert names == ["源世界时代"], names
    item_names = [
        item["name"] for module in overwritten["modules"] for item in module["items"]
    ]
    assert item_names == [], item_names
    # 覆盖后仍然只有一个世界，没有多建
    listed = client.get(f"{API}/worlds", params={"project_id": project_id}).json()
    assert len([w for w in listed if w["id"] == target["id"]]) == 1


def test_world_import_keep_dangling_false_drops_link(client):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "失效引用", "project_id": project_id}
    ).json()
    exported = client.get(f"{API}/worlds/{world['id']}/export").json()
    exported["keep_dangling"] = False
    exported["links"] = [
        {
            "source_module": "history",
            "source_kind": "era",
            "source_id": "ghost-era",
            "target_module": "politics",
            "target_kind": "polity",
            "target_id": "ghost-polity",
            "link_type": "core.related_to",
        }
    ]
    resp = client.post(f"{API}/worlds/import", json=exported)
    assert resp.status_code == 201, resp.text
    report = resp.json()
    assert report["link_count"] == 0
    assert report["skipped_links"] == 1
    assert {entry["role"] for entry in report["dangling_refs"]} == {"source", "target"}
    assert client.get(f"{API}/worlds/{report['world']['id']}/links").json() == []


def test_world_module_create_route(client, app_db_path: Path):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "补模块", "project_id": project_id}
    ).json()
    modules = client.get(f"{API}/worlds/{world['id']}").json()["modules"]
    history = next(module for module in modules if module["module_type"] == "history")
    dup = client.post(
        f"{API}/worlds/{world['id']}/modules",
        json={"module_type": "history", "name": "历史"},
    )
    assert dup.status_code == 400
    # 先删掉 special 再补齐，验证缺模块的旧世界路径
    # （P6-T10 已下架 DELETE /modules/{id}，这里直接落库构造缺模块状态）
    special = next(module for module in modules if module["module_type"] == "special")
    connection = sqlite3.connect(str(app_db_path))
    try:
        connection.execute("DELETE FROM world_modules WHERE id = ?", (special["id"],))
        connection.commit()
    finally:
        connection.close()
    created = client.post(
        f"{API}/worlds/{world['id']}/modules",
        json={"module_type": "special", "name": "特殊", "icon": "sparkles"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["world_id"] == world["id"]
    assert history["id"] != created.json()["id"]


def test_unknown_link_type_falls_back_and_is_reported(client):
    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "未知类型", "project_id": project_id}
    ).json()
    exported = client.get(f"{API}/worlds/{world['id']}/export").json()
    exported["links"] = [
        {
            "source_module": "history",
            "source_kind": "era",
            "source_id": "era-1",
            "target_module": "politics",
            "target_kind": "polity",
            "target_id": "polity-1",
            "link_type": "legacy.made_up",
            "directed": True,
        }
    ]
    resp = client.post(f"{API}/worlds/import", json=exported)
    assert resp.status_code == 201, resp.text
    report = resp.json()
    assert report["unknown_link_types"] == ["legacy.made_up"]
    assert report["link_count"] == 1
    assert any("回落" in warning for warning in report["warnings"])

    # 回落必须同时把边改成对称（directed=False）——旧 kind 词表判非法的边本就对称
    links = client.get(f"{API}/worlds/{report['world']['id']}/links").json()
    assert len(links) == 1
    assert links[0]["link_type"] == "core.related_to"
    assert links[0]["directed"] is False


def test_world_detail_fills_module_and_submodule_counts(client):
    """模块与子模块计数必须是真实值（前端模块页 / 地图-特殊分支按它判断有无内容）。"""

    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "计数世界", "project_id": project_id}
    ).json()
    modules = client.get(f"{API}/worlds/{world['id']}").json()["modules"]
    history = next(module for module in modules if module["module_type"] == "history")
    assert history["submodule_count"] == 0 and history["item_count"] == 0

    era = client.post(
        f"{API}/modules/{history['id']}/submodules", json={"name": "第一纪元", "kind": "era"}
    ).json()
    client.post(
        f"{API}/modules/{history['id']}/items",
        json={"name": "纪元条目", "content": {"text": "内容"}, "submodule_id": era["id"]},
    )
    refreshed = next(
        module
        for module in client.get(f"{API}/worlds/{world['id']}").json()["modules"]
        if module["module_type"] == "history"
    )
    assert refreshed["submodule_count"] == 1
    assert refreshed["item_count"] == 1
    assert refreshed["submodules"][0]["item_count"] == 1


def test_clear_world_content_keeps_modules_and_config(client):
    """清空世界数据：实体与关联清零，模块与 module.config 保留。"""

    project_id = _create_project(client)
    world = client.post(
        f"{API}/worlds", json={"name": "待清空", "project_id": project_id}
    ).json()
    modules = client.get(f"{API}/worlds/{world['id']}").json()["modules"]
    history = next(module for module in modules if module["module_type"] == "history")
    configured = client.put(
        f"{API}/modules/{history['id']}",
        json={"config": {"entityTypes": [{"id": "custom_x", "label": "自定义"}]}},
    )
    assert configured.status_code == 200, configured.text
    era = client.post(
        f"{API}/modules/{history['id']}/submodules", json={"name": "第一纪元", "kind": "era"}
    ).json()
    client.post(
        f"{API}/worlds/{world['id']}/links",
        json={
            "source": {"module": "history", "kind": "era", "id": era["id"]},
            "target": {"module": "history", "kind": "event", "id": "ev-1"},
            "link_type": "core.related_to",
        },
    )
    assert len(client.get(f"{API}/worlds/{world['id']}/links").json()) == 1

    cleared = client.delete(f"{API}/worlds/{world['id']}/content")
    assert cleared.status_code == 204, cleared.text

    after = client.get(f"{API}/worlds/{world['id']}").json()
    assert [module["submodule_count"] for module in after["modules"]] == [0] * 7
    assert [module["item_count"] for module in after["modules"]] == [0] * 7
    assert client.get(f"{API}/worlds/{world['id']}/links").json() == []
    history_after = next(
        module for module in after["modules"] if module["module_type"] == "history"
    )
    assert history_after["config"]["entityTypes"][0]["id"] == "custom_x"
