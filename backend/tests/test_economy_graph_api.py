"""经济只读 API 测试（Phase 5 P5-T3 / P5-T6）

覆盖 /api/v1/worldbuilding/modules/{id}/economy/{summary,graph,timeline,metrics}：
- summary：config（camelCase）/ 速写卡 / 周期 / 指标定义 / 折叠计数 / 阶段与 kind 桶 / 时间范围 / 未锚定
- graph：节点与边计数、外站节点名解析、meta 平铺（flow 缺省与 0 可区分）、筛选与 applied_* 回显、
  sketch 只回计数、800（或 config.nodeLimit）降级只回 counts、skipped_edges
- timeline：周期带、era_context 时代 / 事件标记（名称解析）、range、unanchored、多单位提示
- metrics：按窗口切片、非法采样丢弃不补 0、窗口内无采样进 empty_entities、metricIds 筛选
- 1 实体 0 边 / 1 实体 1 边退化形态；非经济模块 400、模块不存在 404
- 只用契约 §4 的 link_type
- P5-T5 legacy 投影（只读，不落库）
"""

from __future__ import annotations

import uuid

import pytest

WORLD = "/api/v1/worldbuilding"


# --------------------------------------------------------------------- helpers


def new_project(client) -> str:
    response = client.post(
        "/api/v1/projects", json={"title": f"项目-{uuid.uuid4().hex[:8]}"}
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def make_world(client) -> dict:
    """一个项目 + 一个空白世界（七模块骨架已建），返回模块 id 索引。"""

    project_id = new_project(client)
    response = client.post(
        f"{WORLD}/worlds", json={"name": "经济世界", "project_id": project_id}
    )
    assert response.status_code == 201, response.text
    world = response.json()
    detail = client.get(f"{WORLD}/worlds/{world['id']}").json()
    modules = {module["module_type"]: module for module in detail["modules"]}
    return {"world": world, "modules": modules}


@pytest.fixture()
def economy_world(client) -> dict:
    return make_world(client)


def configure_module(client, module_id: str, config: dict) -> dict:
    """写入 WorldModule.config。

    走会话而不是 ``PUT /modules/{id}``：该旧接口在 `WorldModuleUpdate` 上没有 module_type
    字段却直接访问（P1 之前的既有缺陷，不属于 Phase 5 改动面），这里只关心 config 落库。
    """

    from app.core.database import SessionLocal
    from app.models import WorldModule

    db = SessionLocal()
    try:
        module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
        assert module is not None
        module.config = config
        db.commit()
        return {"id": module.id, "config": module.config}
    finally:
        db.close()


def add_submodule(client, module_id: str, **payload) -> dict:
    body = {"name": "实体", **payload}
    response = client.post(f"{WORLD}/modules/{module_id}/submodules", json=body)
    assert response.status_code in (200, 201), response.text
    return response.json()


def add_item(client, module_id: str, name: str, content: dict, **payload) -> dict:
    body = {"name": name, "content": content, **payload}
    response = client.post(f"{WORLD}/modules/{module_id}/items", json=body)
    assert response.status_code in (200, 201), response.text
    return response.json()


def add_link(client, world_id: str, source: dict, target: dict, link_type: str, **kw):
    body = {
        "source": source,
        "target": target,
        "link_type": link_type,
        **kw,
    }
    response = client.post(f"{WORLD}/worlds/{world_id}/links", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def ref(module: str, kind: str, entity_id: str) -> dict:
    return {"module": module, "kind": kind, "id": entity_id}


def graph_of(client, module_id: str, **params) -> dict:
    response = client.get(f"{WORLD}/modules/{module_id}/economy/graph", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def summary_of(client, module_id: str, **params) -> dict:
    response = client.get(f"{WORLD}/modules/{module_id}/economy/summary", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def timeline_of(client, module_id: str, **params) -> dict:
    response = client.get(
        f"{WORLD}/modules/{module_id}/economy/timeline", params=params
    )
    assert response.status_code == 200, response.text
    return response.json()


def metrics_of(client, module_id: str, **params) -> dict:
    response = client.get(f"{WORLD}/modules/{module_id}/economy/metrics", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def node_by_id(graph: dict, node_id: str) -> dict:
    for node in graph["nodes"]:
        if node["id"] == node_id:
            return node
    raise AssertionError(f"节点不存在: {node_id}")


def edges_of_type(graph: dict, link_type: str) -> list:
    return [edge for edge in graph["edges"] if edge["linkType"] == link_type]


def _series_of(payload: dict, metric_id: str, entity_id: str) -> dict:
    """按 (metricId, 实体) 定位序列：同一指标对多个实体都有序列，不能只按 metricId 取首个。"""

    for series in payload["series"]:
        if series["metricId"] == metric_id and series["entity"]["id"] == entity_id:
            return series
    raise AssertionError(f"序列不存在: {metric_id}/{entity_id}")


# ------------------------------------------------------------------- summary


def test_summary_carries_config_overview_cycles_and_counts(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    configure_module(
        client,
        economy["id"],
        {
            "defaultComplexity": "sketch",
            "displayMode": "lanes",
            "levels": [{"id": "global", "label": "全球级", "rank": 4}],
            "metrics": [{"id": "m_supply", "label": "供给量", "valueType": "number"}],
            "unknownLegacyKey": {"keep": True},
        },
    )
    add_item(
        client,
        economy["id"],
        "economy.overview",
        {
            "form": "集市贸易",
            "currency": {"id": "c1", "label": "通货甲", "kind": "currency"},
            "resources": [{"id": "r1", "label": "物产甲", "kind": "resource"}],
            "industries": [{"id": "i1", "label": "营生甲", "kind": "industry"}],
            "distribution": "少数集中",
        },
    )
    cycle = add_item(
        client,
        economy["id"],
        "economy.cycle",
        {
            "name": "长夏",
            "phases": [
                {"id": "p1", "label": "繁荣", "start": "310", "end": "315"},
                {"id": "p2", "label": "衰退", "start": "315", "end": "320"},
            ],
            "note": "官方记载",
        },
    )
    industry = add_submodule(
        client,
        economy["id"],
        name="营生甲",
        kind="industry",
        color="#16a34a",
        meta={
            "level": "global",
            "unit": "炉",
            "time": {"start": "310", "end": "315"},
        },
    )
    resource = add_submodule(
        client,
        economy["id"],
        name="物产甲",
        kind="resource",
        color="#0e7490",
        meta={"scale": 0},
    )
    add_item(
        client,
        economy["id"],
        "economy.metrics",
        {"values": {"m_supply": [{"t": "311", "value": 5}, {"t": "312", "value": 6}]}},
        submodule_id=industry["id"],
    )
    add_link(
        client,
        world["id"],
        ref("economy", "industry", industry["id"]),
        ref("economy", "resource", resource["id"]),
        "economy.consumes",
        meta={"flow": 12, "unit": "炉"},
    )

    body = summary_of(client, economy["id"])

    assert body["moduleId"] == economy["id"]
    assert body["worldId"] == world["id"]
    assert body["moduleName"] == economy["name"]
    assert body["complexity"] == "sketch"

    # config：camelCase + 未知键不丢
    assert body["config"]["defaultComplexity"] == "sketch"
    assert body["config"]["displayMode"] == "lanes"
    assert body["config"]["unknownLegacyKey"] == {"keep": True}
    assert body["levels"][0]["label"] == "全球级"
    assert [metric["id"] for metric in body["metrics"]] == ["m_supply"]

    # 速写卡
    assert body["overview"]["form"] == "集市贸易"
    assert body["overview"]["currency"]["label"] == "通货甲"
    assert body["overview"]["resources"][0]["id"] == "r1"
    assert body["overview"]["industries"][0]["label"] == "营生甲"
    assert body["overview"]["distribution"] == "少数集中"

    # 周期：id 用 item.id，phases 原样
    assert [cycle_item["id"] for cycle_item in body["cycles"]] == [cycle["id"]]
    assert body["cycles"][0]["name"] == "长夏"
    assert [phase["label"] for phase in body["cycles"][0]["phases"]] == ["繁荣", "衰退"]

    # 计数与折叠
    assert body["totals"]["entities"] == 2
    assert body["totals"]["links"] == 1
    assert body["totals"]["totalFlow"] == 12.0
    assert body["totals"]["flowUnits"] == ["炉"]
    assert body["totals"]["multiUnit"] is False
    assert body["totals"]["surplus"]["unknown"] == 1
    assert body["totals"]["metricCoverage"] == {
        "entitiesWithMetrics": 1,
        "totalEntities": 2,
        "coverage": 0.5,
    }
    assert body["fold"]["links"] == 1
    assert body["fold"]["metrics"] == 2
    assert (
        body["fold"]["fields"] >= 2
    )  # industry: level+unit+time；resource: scale=0 也是已填值
    # 速写卡与周期已在 summary 披露；economy.metrics 条目只计数（降档提示条）
    assert body["userItems"] == 1

    # 阶段与 kind 桶（骨架完整、计数如实）
    stages = {bucket["id"]: bucket["count"] for bucket in body["stages"]}
    assert stages["transform"] == 1
    assert stages["upstream"] == 1
    assert stages["exchange"] == 0
    kinds = {bucket["id"]: bucket["count"] for bucket in body["kinds"]}
    assert kinds["industry"] == 1
    assert kinds["resource"] == 1
    assert kinds["market"] == 0

    # 时间范围用锚点（含周期 phase 边界），未锚定清单按「没有可比较锚点」如实回报
    assert body["timeRange"] == {"start": "310", "end": "320", "anchored": True}
    unanchored_ids = {item["id"] for item in body["unanchored"]}
    assert unanchored_ids == {resource["id"]}  # resource 没有时间，industry 有 310-315
    assert body["unanchored"][0]["kind"] == "resource"


def test_summary_lists_unanchored_entities(client, economy_world):
    economy = economy_world["modules"]["economy"]
    free_text = add_submodule(
        client,
        economy["id"],
        name="自由纪年",
        kind="good",
        meta={"time": {"start": "第三纪"}},
    )
    untimed = add_submodule(client, economy["id"], name="无时间", kind="good")

    body = summary_of(client, economy["id"])

    unanchored_ids = {item["id"] for item in body["unanchored"]}
    assert free_text["id"] in unanchored_ids
    assert untimed["id"] in unanchored_ids
    assert body["timeRange"]["anchored"] is False


# --------------------------------------------------------------------- graph


def test_graph_nodes_edges_external_station_and_meta(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]

    industry = add_submodule(
        client,
        economy["id"],
        name="营生甲",
        kind="industry",
        color="#16a34a",
        meta={
            "level": "regional",
            "status": "active",
            "unit": "炉",
            "scale": 0,
            "time": {"start": "310", "end": "315"},
            "timeOrder": 312,
            "cyclePhaseId": "boom",
            "stub": True,
            "tags": ["主干"],
            "customFields": {"seat": "东市"},
        },
    )
    good = add_submodule(client, economy["id"], name="货物甲", kind="good")
    market = add_submodule(client, economy["id"], name="集市甲", kind="market")
    era = add_submodule(
        client,
        history["id"],
        name="第一纪元",
        kind="era",
        meta={"time": {"start": "300", "end": "340"}},
    )

    add_link(
        client,
        world["id"],
        ref("economy", "industry", industry["id"]),
        ref("economy", "good", good["id"]),
        "economy.produces",
        meta={"flow": 0, "unit": "件"},
    )
    add_link(
        client,
        world["id"],
        ref("economy", "good", good["id"]),
        ref("economy", "market", market["id"]),
        "economy.traded_at",
        meta={
            "intensity": 3,
            "surplus": "deficit",
            "priceBand": [1, 2],
            "confidence": "rumored",
            "routeNote": "沿河北上",
            "flowSeries": [{"start": "310", "end": "315", "value": 5}],
        },
    )
    add_link(
        client,
        world["id"],
        ref("economy", "industry", industry["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["complexity"] == "structure"
    assert graph["degraded"] is False
    assert graph["skippedEdges"] == 0
    assert graph["counts"]["nodes"] == 4  # 3 个经济实体 + 1 个历史外站
    assert graph["counts"]["edges"] == 3
    assert graph["counts"]["externalNodes"] == 1
    assert graph["counts"]["stubNodes"] == 1
    assert graph["counts"]["byKind"] == {"industry": 1, "good": 1, "market": 1}
    assert graph["counts"]["byStage"] == {"transform": 2, "exchange": 1}
    assert graph["counts"]["byLinkType"] == {
        "economy.produces": 1,
        "economy.traded_at": 1,
        "economy.era_context": 1,
    }
    assert graph["appliedKinds"] == []
    assert graph["appliedStages"] == []
    assert graph["appliedWindow"] is None

    node = node_by_id(graph, industry["id"])
    assert node["level"] == "regional"
    assert node["status"] == "active"
    assert node["unit"] == "炉"
    assert node["scale"] == 0  # 0 是有效值
    assert node["time"] == {"start": "310", "end": "315"}
    assert node["timeOrder"] == 312
    assert node["cyclePhaseId"] == "boom"
    assert node["stub"] is True
    assert node["tags"] == ["主干"]
    assert node["customFields"] == {"seat": "东市"}
    assert node["counts"] == {"outgoing": 2, "incoming": 0, "total": 2}
    assert node["external"] is False
    assert node["ref"] == ref("economy", "industry", industry["id"])

    external = node_by_id(graph, era["id"])
    assert external["external"] is True
    assert external["name"] == "第一纪元"
    assert external["kind"] == "era"
    assert external["ref"] == ref("history", "era", era["id"])

    produces = edges_of_type(graph, "economy.produces")[0]
    assert produces["flow"] == 0  # flow = 0 与缺省不同
    assert produces["unit"] == "件"
    assert produces["external"] is False

    traded = edges_of_type(graph, "economy.traded_at")[0]
    assert traded["flow"] is None  # 缺省 = 未知，不按 0 处理
    assert traded["intensity"] == 3
    assert traded["surplus"] == "deficit"
    assert traded["surplusDerived"] is False
    assert traded["priceBand"] == [1.0, 2.0]
    assert traded["confidence"] == "rumored"
    assert traded["routeNote"] == "沿河北上"
    assert traded["flowSeries"] == [{"start": "310", "end": "315", "value": 5}]
    assert traded["reverseLabel"] == "交易于此"

    era_edge = edges_of_type(graph, "economy.era_context")[0]
    assert era_edge["external"] is True
    assert era_edge["target"] == ref("history", "era", era["id"])


def test_graph_sketch_returns_only_counts(client, economy_world):
    economy = economy_world["modules"]["economy"]
    add_submodule(client, economy["id"], name="物产甲", kind="resource")
    add_submodule(client, economy["id"], name="集市甲", kind="market")

    graph = graph_of(client, economy["id"], complexity="sketch")

    assert graph["complexity"] == "sketch"
    assert graph["nodes"] == []
    assert graph["edges"] == []
    assert graph["counts"]["nodes"] == 2
    assert graph["counts"]["byKind"] == {"resource": 1, "market": 1}
    assert graph["counts"]["folded"]["links"] == 0


def test_graph_sketch_fold_links_counts_total_edges_under_filter(client, economy_world):
    """S6 回归：fold.links 是当前筛选下的边总数（返回的 + 被筛掉的），不是只算返回的边。"""

    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    upstream = add_submodule(client, economy["id"], name="物产甲", kind="resource")
    exchange = add_submodule(client, economy["id"], name="集市甲", kind="market")
    works = add_submodule(client, economy["id"], name="营生甲", kind="industry")
    # 两端都是经济实体：kinds=resource 时其中一个端点被筛掉
    add_link(
        client,
        world["id"],
        ref("economy", "resource", upstream["id"]),
        ref("economy", "market", exchange["id"]),
        "economy.traded_at",
    )
    # 端点始终在节点集合里：kinds=resource 时仍会返回（营生甲被筛掉后该边也不返回）
    add_link(
        client,
        world["id"],
        ref("economy", "industry", works["id"]),
        ref("economy", "resource", upstream["id"]),
        "economy.consumes",
    )

    graph = graph_of(client, economy["id"], complexity="sketch", kinds="resource")

    assert graph["counts"]["edges"] == 0  # 明细隐藏
    assert graph["skippedEdges"] == 2  # market / industry 端都被 kinds 筛掉
    # 边总数 = 返回的 0 + 被筛掉的 2；不是「只算本来会返回的边」的 0
    assert graph["counts"]["folded"]["links"] == 2

    unfiltered = graph_of(client, economy["id"], complexity="sketch")

    assert unfiltered["skippedEdges"] == 0
    assert unfiltered["counts"]["folded"]["links"] == 2


def test_graph_filters_by_kind_stage_and_window(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    upstream = add_submodule(
        client,
        economy["id"],
        name="物产甲",
        kind="resource",
        meta={"time": {"start": "300", "end": "305"}},
    )
    exchange = add_submodule(
        client,
        economy["id"],
        name="集市甲",
        kind="market",
        meta={"time": {"start": "320", "end": "330"}},
    )
    add_link(
        client,
        world["id"],
        ref("economy", "resource", upstream["id"]),
        ref("economy", "market", exchange["id"]),
        "core.related_to",
    )

    by_kind = graph_of(client, economy["id"], complexity="structure", kinds="market")
    assert [node["id"] for node in by_kind["nodes"]] == [exchange["id"]]
    assert by_kind["appliedKinds"] == ["market"]
    # 经济端点被筛掉的边不返回，计入 skippedEdges
    assert by_kind["counts"]["edges"] == 0
    assert by_kind["skippedEdges"] == 1

    by_stage = graph_of(
        client, economy["id"], complexity="structure", stages="upstream"
    )
    assert [node["id"] for node in by_stage["nodes"]] == [upstream["id"]]
    assert by_stage["appliedStages"] == ["upstream"]

    windowed = graph_of(
        client,
        economy["id"],
        complexity="structure",
        windowStart="315",
        windowEnd="335",
    )
    assert [node["id"] for node in windowed["nodes"]] == [exchange["id"]]
    assert windowed["appliedWindow"] == {"start": "315", "end": "335"}
    assert windowed["counts"]["edges"] == 0
    assert windowed["skippedEdges"] == 1

    both = graph_of(
        client,
        economy["id"],
        complexity="structure",
        kinds="resource,market",
        stages="exchange",
    )
    assert [node["id"] for node in both["nodes"]] == [exchange["id"]]
    assert both["appliedKinds"] == ["resource", "market"]


def test_graph_survives_oversized_and_boundary_free_text_time(client, economy_world):
    """S1 / S2 回归：自由文本时间与 meta 形状不得让 graph 500。

    - ``meta.time`` 起止超过 ``LinkTimeRange`` 的 100 字符上限：截断到 100（前缀数字保留，
      锚点仍可解析），不再抛 ``ValidationError``；恰好 100 字符原样保留。
    - ``meta.tags`` 是字符串（而不是 list）：不得被拆成字符数组。
    - ``meta.customFields`` 是 list（而不是 dict）：不得因 ``dict()`` 抛 ``ValueError``。
    """

    from app.services.economy_service import _anchor_of

    economy = economy_world["modules"]["economy"]
    boundary = "3" + "0" * 99  # 恰好 100 字符，锚点 300
    boundary_entity = add_submodule(
        client,
        economy["id"],
        name="边界实体",
        kind="resource",
        meta={"time": {"start": boundary, "end": boundary}},
    )
    long_start = "310" + "x" * 147  # 150 字符，锚点 310
    long_end = "320" + "y" * 147
    long_entity = add_submodule(
        client,
        economy["id"],
        name="超长实体",
        kind="market",
        meta={
            "time": {"start": long_start, "end": long_end},
            "tags": "a,b",
            "customFields": ["seat"],
        },
    )

    graph = graph_of(client, economy["id"], complexity="structure")  # 未修复时 500

    assert graph["counts"]["nodes"] == 2
    assert graph["appliedWindow"] is None

    boundary_node = node_by_id(graph, boundary_entity["id"])
    assert boundary_node["time"] == {"start": boundary, "end": boundary}
    assert boundary_node["timeOrder"] is None

    long_node = node_by_id(graph, long_entity["id"])
    assert long_node["time"] == {"start": long_start[:100], "end": long_end[:100]}
    assert len(long_node["time"]["start"]) == 100
    assert len(long_node["time"]["end"]) == 100
    assert long_node["time"]["start"].startswith("310")
    assert _anchor_of(long_node["time"]["start"]) == 310  # 截断后锚点不变
    assert long_node["tags"] == []  # 字符串不再被拆成字符数组
    assert long_node["customFields"] == {}  # list 不再抛 ValueError


def test_graph_clips_oversized_window_applied_echo(client, economy_world):
    """S1 回归：超长 ``windowStart`` / ``windowEnd`` 只截断回显，不 500。"""

    from app.services.economy_service import _anchor_of

    economy = economy_world["modules"]["economy"]
    add_submodule(
        client,
        economy["id"],
        name="物产甲",
        kind="resource",
        meta={"time": {"start": "300", "end": "305"}},
    )
    long_anchor = "310" + "x" * 147
    long_other = "310" + "y" * 147

    graph = graph_of(
        client,
        economy["id"],
        complexity="structure",
        windowStart=long_anchor,
        windowEnd=long_other,
    )

    applied = graph["appliedWindow"]
    assert len(applied["start"]) == 100
    assert len(applied["end"]) == 100
    assert applied["start"] == long_anchor[:100]
    assert applied["end"] == long_other[:100]
    assert _anchor_of(applied["start"]) == 310  # 窗口锚点仍是 310，截断不改变筛选口径
    assert graph["counts"]["nodes"] == 0  # 300-305 与窗口 [310, 310] 不相交


def test_graph_drops_external_nodes_orphaned_by_filters(client, economy_world):
    """S3 回归：经济端点被筛掉时，另一端点（外站）不得作为孤儿节点出现。"""

    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]
    market = add_submodule(client, economy["id"], name="集市甲", kind="market")
    era = add_submodule(client, history["id"], name="第一纪元", kind="era")
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )

    filtered = graph_of(client, economy["id"], complexity="structure", kinds="resource")

    assert filtered["counts"]["nodes"] == 0
    assert filtered["counts"]["externalNodes"] == 0
    assert filtered["counts"]["edges"] == 0
    assert filtered["counts"]["byKind"] == {}
    assert filtered["counts"]["byStage"] == {}
    assert filtered["nodes"] == []  # 孤儿外站节点不得混进节点列表
    assert filtered["skippedEdges"] == 1

    # 对照：未筛选时外站节点照常出现（正常路径没被改坏）
    unfiltered = graph_of(client, economy["id"], complexity="structure")

    assert unfiltered["counts"]["nodes"] == 2
    assert unfiltered["counts"]["externalNodes"] == 1
    assert unfiltered["counts"]["edges"] == 1
    assert [node["id"] for node in unfiltered["nodes"]] == [market["id"], era["id"]]


def test_graph_counts_by_kind_stage_matrix(client, economy_world):
    """S4 回归：by_kind_stage 覆盖全部经济实体，且与 byKind / byStage 同口径。"""

    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    industry = add_submodule(client, economy["id"], name="营生甲", kind="industry")
    add_submodule(client, economy["id"], name="营生乙", kind="industry")
    add_submodule(client, economy["id"], name="集市甲", kind="market")
    good = add_submodule(client, economy["id"], name="货物甲", kind="good")
    add_link(
        client,
        world["id"],
        ref("economy", "industry", industry["id"]),
        ref("economy", "good", good["id"]),
        "economy.produces",
    )

    graph = graph_of(client, economy["id"], complexity="structure")
    counts = graph["counts"]

    assert counts["byKindStage"] == {
        "industry|transform": 2,
        "market|exchange": 1,
        "good|transform": 1,
    }
    # 只统计经济实体（selected）：等于 byKind / byStage 各项之和，不含外站节点
    assert sum(counts["byKindStage"].values()) == sum(counts["byKind"].values())
    assert sum(counts["byKindStage"].values()) == sum(counts["byStage"].values())
    assert counts["byKind"]["industry"] == 2
    assert counts["nodes"] == sum(counts["byKind"].values())

    filtered = graph_of(client, economy["id"], complexity="structure", kinds="industry")
    assert filtered["counts"]["byKindStage"] == {"industry|transform": 2}
    assert filtered["counts"]["nodes"] == 2


def test_graph_degraded_keeps_by_kind_stage_matrix(client, economy_world):
    """S4 回归：降级（只回计数、不回节点明细）时 by_kind_stage 仍是账册矩阵的数据源。"""

    economy = economy_world["modules"]["economy"]
    configure_module(client, economy["id"], {"nodeLimit": 2})
    add_submodule(client, economy["id"], name="营生甲", kind="industry")
    add_submodule(client, economy["id"], name="集市甲", kind="market")
    add_submodule(client, economy["id"], name="货物甲", kind="good")

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["degraded"] is True
    assert graph["nodes"] == []
    assert graph["edges"] == []
    counts = graph["counts"]
    assert counts["byKindStage"] == {
        "industry|transform": 1,
        "market|exchange": 1,
        "good|transform": 1,
    }
    assert sum(counts["byKindStage"].values()) == sum(counts["byKind"].values())
    assert sum(counts["byKindStage"].values()) == 3
    assert counts["nodes"] == 3  # 无外站节点时两者口径一致


def test_graph_skips_edges_with_unresolvable_endpoint(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]
    entity = add_submodule(client, economy["id"], name="物产甲", kind="resource")
    era = add_submodule(client, history["id"], name="第一纪元", kind="era")

    # 经济端点在节点集合里不存在（幽灵 id）：边必须计入 skippedEdges，不建幽灵节点
    add_link(
        client,
        world["id"],
        ref("economy", "custom_cycle", "ghost-cycle"),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )
    # 端点合法的边照常返回
    add_link(
        client,
        world["id"],
        ref("economy", "resource", entity["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["counts"]["edges"] == 1
    assert graph["counts"]["externalNodes"] == 1
    assert graph["skippedEdges"] == 1
    assert [node["id"] for node in graph["nodes"]] == [entity["id"], era["id"]]


def test_graph_degrades_over_node_limit_configured_in_config(client, economy_world):
    economy = economy_world["modules"]["economy"]
    configure_module(client, economy["id"], {"nodeLimit": 2})
    for index in range(3):
        add_submodule(client, economy["id"], name=f"物产{index}", kind="resource")

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["degraded"] is True
    assert graph["nodeLimit"] == 2
    assert graph["nodes"] == []
    assert graph["edges"] == []
    assert graph["counts"]["nodes"] == 3
    assert "上限 2" in graph["degradeReason"]


def test_graph_one_entity_zero_edges(client, economy_world):
    economy = economy_world["modules"]["economy"]
    add_submodule(client, economy["id"], name="唯一实体", kind="market")

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["counts"]["nodes"] == 1
    assert graph["counts"]["edges"] == 0
    assert graph["skippedEdges"] == 0
    assert graph["degraded"] is False
    assert graph["nodes"][0]["counts"] == {"outgoing": 0, "incoming": 0, "total": 0}


def test_graph_one_entity_one_external_edge(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]
    entity = add_submodule(client, economy["id"], name="唯一实体", kind="market")
    era = add_submodule(
        client,
        history["id"],
        name="第一纪元",
        kind="era",
        meta={"time": {"start": "300"}},
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", entity["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )

    graph = graph_of(client, economy["id"], complexity="structure")

    assert graph["counts"]["nodes"] == 2
    assert graph["counts"]["edges"] == 1
    assert node_by_id(graph, entity["id"])["counts"]["outgoing"] == 1
    assert node_by_id(graph, era["id"])["external"] is True


# ------------------------------------------------------------------ timeline


def test_timeline_cycles_era_markers_units_and_unanchored(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]

    cycle = add_item(
        client,
        economy["id"],
        "economy.cycle",
        {
            "name": "长夏",
            "phases": [
                {"id": "p1", "label": "繁荣", "start": "300", "end": "320"},
                {"id": "p2", "label": "衰退", "start": "320", "end": "340"},
            ],
        },
    )
    era = add_submodule(
        client,
        history["id"],
        name="第一纪元",
        kind="era",
        meta={"time": {"start": "300", "end": "340"}, "timeOrder": 300},
    )
    market = add_submodule(
        client, economy["id"], name="集市甲", kind="market", meta={"timeOrder": 312}
    )
    free_text = add_submodule(
        client,
        economy["id"],
        name="自由纪年",
        kind="good",
        meta={"time": {"start": "第三纪"}},
    )
    second_market = add_submodule(
        client, economy["id"], name="集市乙", kind="market", meta={"timeOrder": 330}
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("economy", "good", free_text["id"]),
        "core.related_to",
        meta={"flow": 10, "unit": "袋"},
        time={"start": "300", "end": "310"},
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("economy", "market", second_market["id"]),
        "economy.flows_to",
        meta={"flow": 4, "unit": "件"},
    )

    timeline = timeline_of(client, economy["id"])

    assert [band["cycleId"] for band in timeline["cycles"]] == [cycle["id"]]
    band = timeline["cycles"][0]
    assert band["label"] == "长夏"
    assert band["start"] == "300"
    assert band["end"] == "340"
    assert [phase["id"] for phase in band["phases"]] == ["p1", "p2"]

    assert len(timeline["markers"]) == 1
    marker = timeline["markers"][0]
    assert marker["ref"] == ref("history", "era", era["id"])
    assert marker["label"] == "第一纪元"
    assert marker["source"] == "era"
    assert marker["start"] == "300"
    assert marker["end"] == "340"
    assert marker["order"] == 300

    assert timeline["range"] == {"start": "300", "end": "340", "anchored": True}
    assert timeline["units"] == ["件", "袋"]
    assert timeline["multiUnit"] is True
    assert {item["id"] for item in timeline["unanchored"]} >= {free_text["id"]}
    unanchored_kinds = {item["kind"] for item in timeline["unanchored"]}
    assert "link" in unanchored_kinds  # 无有效期的边也标未锚定

    windowed = timeline_of(client, economy["id"], windowStart="330", windowEnd="340")
    assert {band["cycleId"] for band in windowed["cycles"]} == {cycle["id"]}
    # timeOrder=312 的集市被窗口排除；自由纪年没有锚点，放行并标未锚定
    unanchored_ids = {item["id"] for item in windowed["unanchored"]}
    assert market["id"] not in unanchored_ids
    assert free_text["id"] in unanchored_ids


def test_timeline_cycle_band_orders_phases_by_anchor(client, economy_world):
    """S7 回归：周期带起止按锚点取 min / max，倒序书写的 phases 不再算错。"""

    economy = economy_world["modules"]["economy"]
    cycle = add_item(
        client,
        economy["id"],
        "economy.cycle",
        {
            "name": "长夏",
            "phases": [
                {"id": "p1", "label": "衰退", "start": "320", "end": "340"},
                {"id": "p2", "label": "繁荣", "start": "300", "end": "320"},
            ],
        },
    )

    timeline = timeline_of(client, economy["id"])

    band = timeline["cycles"][0]
    assert band["cycleId"] == cycle["id"]
    assert band["start"] == "300"  # 不是 phases 首项的 320
    assert band["end"] == "340"  # 不是 phases 末项的 320
    assert [phase["id"] for phase in band["phases"]] == ["p1", "p2"]  # 原顺序不回写


def test_timeline_marker_window_uses_entity_anchors(client, economy_world):
    """S8 回归：marker 的窗口判定与节点路径同口径，只用 timeOrder 锚定也算数。"""

    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]
    market = add_submodule(client, economy["id"], name="集市甲", kind="market")
    ordered_era = add_submodule(
        client, history["id"], name="仅纪年序", kind="era", meta={"timeOrder": 350}
    )
    timed_era = add_submodule(
        client,
        history["id"],
        name="有起止",
        kind="era",
        meta={"time": {"start": "300", "end": "310"}},
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("history", "era", ordered_era["id"]),
        "economy.era_context",
    )
    add_link(
        client,
        world["id"],
        ref("economy", "market", market["id"]),
        ref("history", "era", timed_era["id"]),
        "economy.era_context",
    )

    full = timeline_of(client, economy["id"])
    assert {marker["ref"]["id"] for marker in full["markers"]} == {
        ordered_era["id"],
        timed_era["id"],
    }

    windowed = timeline_of(client, economy["id"], windowStart="330", windowEnd="400")
    # timeOrder=350 的 era 现在被窗口保留（修复前窗口判定发生在并入 timeOrder 之前，会被误筛）
    assert {marker["ref"]["id"] for marker in windowed["markers"]} == {
        ordered_era["id"]
    }
    markers = {marker["ref"]["id"]: marker for marker in windowed["markers"]}
    assert markers[ordered_era["id"]]["order"] == 350
    assert markers[ordered_era["id"]]["start"] is None  # 只有 timeOrder，不虚构起止

    outside = timeline_of(client, economy["id"], windowStart="360", windowEnd="400")
    assert outside["markers"] == []


# ------------------------------------------------------------------- metrics


def test_metrics_window_slice_and_no_zero_fill(client, economy_world):
    economy = economy_world["modules"]["economy"]
    configure_module(
        client,
        economy["id"],
        {
            "metrics": [
                {"id": "m_supply", "label": "供给量"},
                {"id": "m_trade", "label": "贸易量", "valueType": "band"},
            ]
        },
    )
    industry = add_submodule(client, economy["id"], name="营生甲", kind="industry")
    add_submodule(client, economy["id"], name="物产甲", kind="resource")
    add_item(
        client,
        economy["id"],
        "economy.metrics",
        {
            "values": {
                "m_supply": [
                    {"t": "310", "value": 5},
                    {"t": "315", "value": "非法"},
                    {"t": "320", "value": 7},
                    {"t": "325", "value": [1, 2]},
                ],
                "m_trade": [],
            }
        },
        submodule_id=industry["id"],
    )

    windowed = metrics_of(
        client,
        economy["id"],
        windowStart="300",
        windowEnd="319",
        metricIds="m_supply,m_trade",
    )

    assert windowed["window"] == {"start": "300", "end": "319", "anchored": True}
    assert [metric["id"] for metric in windowed["metrics"]] == ["m_supply", "m_trade"]
    supply = _series_of(windowed, "m_supply", industry["id"])
    assert supply["entity"] == ref("economy", "industry", industry["id"])
    # 窗口外与非法采样都被丢弃，绝不用 0 补点
    assert [sample["t"] for sample in supply["samples"]] == ["310"]
    assert supply["samples"][0]["value"] == 5

    band_series = _series_of(windowed, "m_trade", industry["id"])
    assert band_series["samples"] == []  # 显式请求但窗口内无采样：返回空序列，不是 0

    empty_ids = {item["id"] for item in windowed["emptyEntities"]}
    assert industry["id"] not in empty_ids  # 窗口内有有效采样
    assert len(empty_ids) >= 1  # 其余实体窗口内无记录

    full = metrics_of(client, economy["id"])
    full_supply = _series_of(full, "m_supply", industry["id"])
    assert [sample["t"] for sample in full_supply["samples"]] == ["310", "320", "325"]
    assert full_supply["samples"][-1]["value"] == [1, 2]  # band 通过校验
    assert all(sample["value"] != 0 for sample in full_supply["samples"])
    assert all(
        sample["t"] != "315" for sample in full_supply["samples"]
    )  # 非法采样已丢弃

    filtered = metrics_of(client, economy["id"], metricIds="m_trade")
    assert [metric["id"] for metric in filtered["metrics"]] == ["m_trade"]
    assert {s["metricId"] for s in filtered["series"]} == {"m_trade"}


# ----------------------------------------------------- 错误码与契约校验


def test_non_economy_module_returns_400(client, economy_world):
    history = economy_world["modules"]["history"]
    for path in ("summary", "graph", "timeline", "metrics"):
        response = client.get(f"{WORLD}/modules/{history['id']}/economy/{path}")
        assert response.status_code == 400, response.text
        assert "不是经济模块" in response.json()["detail"]


def test_missing_module_returns_404(client):
    response = client.get(f"{WORLD}/modules/not-exist/economy/graph")
    assert response.status_code == 404
    assert "模块不存在" in response.json()["detail"]


def test_graph_uses_only_contract_link_types(client, economy_world):
    world = economy_world["world"]
    economy = economy_world["modules"]["economy"]
    history = economy_world["modules"]["history"]
    industry = add_submodule(client, economy["id"], name="营生甲", kind="industry")
    good = add_submodule(client, economy["id"], name="货物甲", kind="good")
    era = add_submodule(client, history["id"], name="第一纪元", kind="era")
    add_link(
        client,
        world["id"],
        ref("economy", "industry", industry["id"]),
        ref("economy", "good", good["id"]),
        "economy.produces",
    )
    add_link(
        client,
        world["id"],
        ref("economy", "good", good["id"]),
        ref("history", "era", era["id"]),
        "economy.era_context",
    )

    registry = client.get(f"{WORLD}/link-registry").json()
    registry_ids = {item["id"] for item in registry}
    economy_ids = {item for item in registry_ids if item.startswith("economy.")}
    assert len(economy_ids) == 12  # 契约 §4.4 全量

    graph = graph_of(client, economy["id"], complexity="structure")
    used = {edge["linkType"] for edge in graph["edges"]}
    assert used <= registry_ids
    assert used <= economy_ids


# ------------------------------------------------- P5-T5 legacy 投影（只读）


def test_legacy_projection_helpers(client, economy_world):
    from app.core.database import SessionLocal
    from app.models import WorldModule, WorldSubmodule
    from app.services.economy_service import EconomyService

    economy = economy_world["modules"]["economy"]
    configure_module(client, economy["id"], {"displayMode": "lanes"})
    add_item(
        client,
        economy["id"],
        "moduleConfig",
        {"displayMode": "ledger", "customKey": 7},
    )
    # 旧编码：commodity -> good、emoji -> Lucide、等级进 meta
    legacy = add_submodule(
        client,
        economy["id"],
        name="旧商品",
        color="type:commodity:regional",
        icon="🌾",
    )
    source = add_submodule(
        client, economy["id"], name="旧产业", color="type:industry:regional"
    )
    target = add_submodule(
        client, economy["id"], name="旧集市", color="type:economic_zone:local"
    )
    relations = add_item(
        client,
        economy["id"],
        "relations",
        {
            "r1": f"supplier:{target['id']}:100:100:200",
            "r2": f"trade_partner:{target['id']}:",
        },
        submodule_id=source["id"],
    )

    db = SessionLocal()
    try:
        module = db.query(WorldModule).filter(WorldModule.id == economy["id"]).first()
        assert module is not None

        merged = EconomyService.project_legacy_config(db, module)
        assert merged["displayMode"] == "lanes"  # config 已有键优先
        assert merged["customKey"] == 7  # 旧条目补齐

        legacy_row = (
            db.query(WorldSubmodule).filter(WorldSubmodule.id == legacy["id"]).first()
        )
        projected = EconomyService.project_legacy_submodule(legacy_row, "economy")
        assert projected["kind"] == "good"
        assert projected["icon"] == "wheat"
        assert projected["meta"]["legacyIcon"] == "🌾"
        assert projected["meta"]["level"] == "regional"
        assert projected["meta"]["customFields"] == {}
        assert projected["legacy"] is True

        edges = EconomyService.project_legacy_links(
            db, module, [source["id"], target["id"]]
        )
    finally:
        db.close()

    assert len(edges) == 2
    mapped, fallback = edges
    assert mapped["id"] == f"{relations['id']}:r1"
    assert mapped["link_type"] == "economy.supplies"  # 命中 registry 且 kind 合法
    assert mapped["label"] is None
    assert mapped["source"] == {
        "module": "economy",
        "kind": "industry",
        "id": source["id"],
    }
    assert mapped["target"]["id"] == target["id"]
    assert mapped["meta"]["flow"] == 100.0
    assert mapped["meta"]["legacyRelationType"] == "supplier"
    assert mapped["time"] == {"start": "100", "end": "200"}
    assert mapped["legacy"] is True

    assert fallback["link_type"] == "core.related_to"  # flows_to 需要 market -> market
    assert fallback["label"] == "trade_partner"  # 原名保留在 label
    assert fallback["meta"]["legacyRelationType"] == "trade_partner"
    assert "flow" not in fallback["meta"]
    assert fallback["time"] is None


def test_legacy_link_fallback_directed_semantics_match_migration(client, economy_world):
    """S5 回归：回落 link_type 的 directed 语义与 P1-MIG-05 一致。

    对称旧类型（``trade_partner`` / ``competitor``）回落 ``core.related_to``；
    有向旧类型（映射缺失或 kind 校验不过）回落 ``core.references``。
    """

    from app.core.database import SessionLocal
    from app.models import WorldModule
    from app.services.economy_service import EconomyService

    economy = economy_world["modules"]["economy"]
    market = add_submodule(
        client, economy["id"], name="旧集市", color="type:economic_zone:local"
    )
    other_market = add_submodule(
        client, economy["id"], name="旧集市乙", color="type:economic_zone:local"
    )
    good = add_submodule(
        client, economy["id"], name="旧商品", color="type:commodity:local"
    )
    other_good = add_submodule(
        client, economy["id"], name="旧商品乙", color="type:commodity:local"
    )
    # market -> good 的 trade_partner：economy.flows_to 需要 source/target 都是 market，
    # 这里故意指向 good，让 candidate 校验不过，落进对称回落分支
    add_item(
        client,
        economy["id"],
        "relations",
        {
            "r1": f"trade_partner:{good['id']}:",
            "r2": f"competitor:{other_market['id']}:",
        },
        submodule_id=market["id"],
    )
    # good -> good 的 supplier：economy.supplies 需要 (market/industry/actor) 源，校验不过，
    # 落进有向回落分支
    add_item(
        client,
        economy["id"],
        "relations",
        {"r3": f"supplier:{other_good['id']}:"},
        submodule_id=good["id"],
    )

    db = SessionLocal()
    try:
        module = db.query(WorldModule).filter(WorldModule.id == economy["id"]).first()
        assert module is not None
        edges = EconomyService.project_legacy_links(
            db,
            module,
            [market["id"], other_market["id"], good["id"], other_good["id"]],
        )
    finally:
        db.close()

    assert len(edges) == 3
    market_edges = [edge for edge in edges if edge["source"]["id"] == market["id"]]
    by_relation = {edge["meta"]["legacyRelationType"]: edge for edge in market_edges}

    # 对称集合内的旧类型：回落 core.related_to（directed=False），与 P1-MIG-05 一致
    assert by_relation["trade_partner"]["link_type"] == "core.related_to"
    assert by_relation["trade_partner"]["directed"] is False
    assert by_relation["competitor"]["link_type"] == "core.related_to"
    assert by_relation["competitor"]["directed"] is False

    # 有向旧类型（映射命中但 kind 校验不过）：回落 core.references（directed=True）
    directed = [edge for edge in edges if edge["source"]["id"] == good["id"]]
    assert len(directed) == 1
    assert directed[0]["meta"]["legacyRelationType"] == "supplier"
    assert directed[0]["link_type"] == "core.references"
    assert directed[0]["directed"] is True
    assert directed[0]["label"] == "supplier"
