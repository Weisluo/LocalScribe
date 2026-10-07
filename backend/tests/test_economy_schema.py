"""经济 schema 与归一化测试（Phase 5 P5-T1 / P5-T6）

覆盖 backend/app/schemas/economy.py：
- JSON 一律 camelCase（alias_generator=to_camel），同时接受 snake_case 输入
- `normalize_metric_value` 丢弃非法值（禁止用 0 补点）、`normalize_intensity` 只认 1-5 整数
- `stage_of_kind` 内置映射与 config.stages 覆盖、`is_economy_stage` 只认契约枚举
- `EconomyConfig` 的 extra="allow"：未知键（含旧 moduleConfig 的遗留键）不丢
- 常量的契约口径：800 阈值、custom_cycle、推荐 kind、三档复杂度
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.economy import (
    CYCLE_KIND,
    DEFAULT_STAGES,
    DEGRADE_NODE_THRESHOLD,
    RECOMMENDED_ECONOMY_KINDS,
    EconomyChip,
    EconomyConfig,
    EconomyCycle,
    EconomyEdge,
    EconomyGraph,
    EconomyGraphCounts,
    EconomyMetricSample,
    EconomyNode,
    EconomySummary,
    is_economy_stage,
    stage_of_kind,
    normalize_intensity,
    normalize_metric_value,
)

# ------------------------------------------------------------------ camelCase


def test_node_dump_uses_camel_case_aliases():
    node = EconomyNode(
        id="E1",
        name="铁矿业",
        kind="industry",
        stage="transform",
        order_index=2,
        time_order=310.0,
        cycle_phase_id="boom",
        custom_fields={"seat": "王都"},
        metric_ids=["m1"],
        has_metrics=True,
        ref={"module": "economy", "kind": "industry", "id": "E1"},
    )
    payload = node.model_dump(by_alias=True)
    assert "orderIndex" in payload
    assert "timeOrder" in payload
    assert "cyclePhaseId" in payload
    assert "customFields" in payload
    assert "metricIds" in payload
    assert "hasMetrics" in payload
    assert payload["customFields"] == {"seat": "王都"}
    assert "order_index" not in payload


def test_edge_dump_uses_camel_case_and_accepts_snake_case_input():
    edge = EconomyEdge(
        id="L1",
        link_type="economy.flows_to",
        source={"module": "economy", "kind": "market", "id": "M1"},
        target={"module": "economy", "kind": "market", "id": "M2"},
        flow_series=[{"start": "310", "value": 10}],
        surplus_derived=True,
        price_band=[1.0, 2.0],
        route_note="沿河北上",
    )
    payload = edge.model_dump(by_alias=True)
    assert payload["linkType"] == "economy.flows_to"
    assert payload["flowSeries"] == [{"start": "310", "value": 10}]
    assert payload["surplusDerived"] is True
    assert payload["priceBand"] == [1.0, 2.0]
    assert payload["routeNote"] == "沿河北上"

    # snake_case 输入同样被接受（populate_by_name=True）
    again = EconomyEdge.model_validate(
        {
            "id": "L2",
            "link_type": "core.related_to",
            "source": {"module": "economy", "kind": "good", "id": "G1"},
            "target": {"module": "economy", "kind": "good", "id": "G2"},
            "surplus_derived": True,
        }
    )
    assert again.surplus_derived is True


def test_chip_and_cycle_alias_roundtrip():
    chip = EconomyChip.model_validate(
        {
            "id": "C1",
            "label": "通货甲",
            "kind": "currency",
            "entityRef": {"module": "economy", "kind": "currency", "id": "E9"},
        }
    )
    assert chip.entity_ref is not None
    assert chip.model_dump(by_alias=True)["entityRef"]["id"] == "E9"

    cycle = EconomyCycle.model_validate(
        {
            "id": "CY1",
            "name": "长夏周期",
            "phases": [{"id": "p1", "label": "繁荣", "start": "300", "end": "320"}],
            "eraRef": {"module": "history", "kind": "era", "id": "H1"},
        }
    )
    assert cycle.phases[0].start == "300"
    assert cycle.model_dump(by_alias=True)["eraRef"]["module"] == "history"


def test_summary_defaults_are_safe():
    summary = EconomySummary(
        module_id="M1",
        world_id="W1",
        module_name="经济",
        complexity="sketch",
        config=EconomyConfig(),
    )
    assert summary.fold.links == 0
    assert summary.totals.entities == 0
    assert summary.stages == []
    assert summary.time_range.anchored is False
    payload = summary.model_dump(by_alias=True)
    assert payload["moduleId"] == "M1"
    assert payload["timeRange"]["anchored"] is False


# ------------------------------------------------------- normalize_metric_value


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (3, 3.0),
        (0, 0.0),  # 用户填的 0 是有效值，与「缺采样」不同
        (2.5, 2.5),
        ([1, 2], [1.0, 2.0]),
        ([0, 0], [0.0, 0.0]),
    ],
)
def test_normalize_metric_value_accepts_numbers_and_bands(raw, expected):
    assert normalize_metric_value(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [None, True, False, "3", "", [1], [1, 2, 3], [True, 2], [1, "2"], {"low": 1}, []],
)
def test_normalize_metric_value_drops_invalid_values(raw):
    """非法 / 缺值一律 None：调用方必须丢弃，禁止补 0。"""

    assert normalize_metric_value(raw) is None


def test_metric_sample_rejects_missing_value():
    with pytest.raises(ValidationError):
        EconomyMetricSample(t="310")


# ------------------------------------------------------- normalize_intensity


@pytest.mark.parametrize("raw", [1, 2, 3, 4, 5])
def test_normalize_intensity_accepts_one_to_five(raw):
    assert normalize_intensity(raw) == raw


@pytest.mark.parametrize("raw", [0, 6, -1, 2.5, True, "3", None, [3]])
def test_normalize_intensity_rejects_out_of_contract(raw):
    assert normalize_intensity(raw) is None


# --------------------------------------------------------- stage_of_kind


def test_stage_of_kind_builtin_mapping():
    assert stage_of_kind("resource") == "upstream"
    assert stage_of_kind("industry") == "transform"
    assert stage_of_kind("market") == "exchange"
    assert stage_of_kind("actor") == "operator"
    assert stage_of_kind("currency") == "crosscut"
    assert stage_of_kind(CYCLE_KIND) == "crosscut"
    # 未知 kind 回落 transform（不报错、不拦截自定义类型）
    assert stage_of_kind("custom_port") == "transform"
    assert stage_of_kind(None) == "transform"


def test_stage_of_kind_config_override_wins():
    config = {
        "stages": [
            {
                "id": "exchange",
                "label": "交换",
                "order": 0,
                "defaultKinds": ["resource"],
            },
            {"id": "bogus", "label": "非法", "order": 1, "defaultKinds": ["good"]},
        ]
    }
    assert stage_of_kind("resource", config) == "exchange"
    # 非法阶段 id 被忽略，good 走内置映射
    assert stage_of_kind("good", config) == "transform"
    assert stage_of_kind("market", config) == "exchange"


def test_is_economy_stage_contract_enum():
    for stage in DEFAULT_STAGES:
        assert is_economy_stage(stage) is True
    for value in ("bogus", "", None, 1, ["upstream"]):
        assert is_economy_stage(value) is False


# ------------------------------------------------------------ EconomyConfig


def test_config_accepts_camel_case_and_keeps_unknown_keys():
    config = EconomyConfig.model_validate(
        {
            "defaultComplexity": "sandbox",
            "displayMode": "network",
            "entityTypes": [{"id": "good", "label": "货物"}],
            "stages": [
                {
                    "id": "upstream",
                    "label": "上游",
                    "order": 0,
                    "defaultKinds": ["resource"],
                }
            ],
            "sketchFields": [
                {"id": "form", "label": "经济形态", "type": "text", "maxItems": 3}
            ],
            "metrics": [
                {
                    "id": "m1",
                    "label": "供给量",
                    "valueType": "band",
                    "polarity": "higher-better",
                }
            ],
            "layers": [
                {
                    "id": "flows",
                    "label": "流量",
                    "icon": "route",
                    "minComplexity": "sandbox",
                    "defaultOn": True,
                }
            ],
            "defaultFlowUnit": "袋/季",
            # 旧 moduleConfig 遗留的未知键必须原样保留（extra="allow"）
            "timeUnit": "era",
            "customKey": {"nested": [1, 2]},
        }
    )
    assert config.default_complexity == "sandbox"
    assert config.display_mode == "network"
    assert config.entity_types[0]["id"] == "good"
    assert config.sketch_fields[0].max_items == 3
    assert config.metrics[0].value_type == "band"
    assert config.layers[0].min_complexity == "sandbox"
    assert config.default_flow_unit == "袋/季"

    payload = config.model_dump(by_alias=True)
    assert payload["timeUnit"] == "era"
    assert payload["customKey"] == {"nested": [1, 2]}
    assert payload["defaultComplexity"] == "sandbox"
    assert payload["sketchFields"][0]["maxItems"] == 3


def test_config_rejects_invalid_declared_enum():
    with pytest.raises(ValidationError):
        EconomyConfig.model_validate({"defaultComplexity": "extreme"})


# --------------------------------------------------------------- 常量口径


def test_economy_constants_match_contract():
    assert DEGRADE_NODE_THRESHOLD == 800
    assert CYCLE_KIND == "custom_cycle"
    assert RECOMMENDED_ECONOMY_KINDS == (
        "resource",
        "good",
        "industry",
        "market",
        "currency",
        "actor",
        "institution",
    )
    assert DEFAULT_STAGES == (
        "upstream",
        "transform",
        "exchange",
        "operator",
        "crosscut",
    )


def test_graph_defaults_are_not_degraded():
    graph = EconomyGraph(module_id="M1", world_id="W1", complexity="structure")
    assert graph.degraded is False
    assert graph.node_limit == DEGRADE_NODE_THRESHOLD
    assert graph.nodes == []
    assert graph.counts.nodes == 0
    assert graph.applied_window is None
    assert graph.counts.by_kind_stage == {}


def test_graph_counts_expose_by_kind_stage_alias():
    """S4：类型 × 阶段交叉计数是降级账册矩阵的数据源，键为 ``<kind>|<stage>``。"""

    counts = EconomyGraphCounts(
        nodes=2,
        by_kind={"industry": 1, "market": 1},
        by_stage={"transform": 1, "exchange": 1},
        by_kind_stage={"industry|transform": 1, "market|exchange": 1},
    )
    payload = counts.model_dump(by_alias=True)

    assert payload["byKindStage"] == {"industry|transform": 1, "market|exchange": 1}
    assert "by_kind_stage" not in payload
    assert sum(payload["byKindStage"].values()) == sum(payload["byKind"].values())

    # snake_case 输入同样被接受（populate_by_name=True）
    again = EconomyGraphCounts.model_validate({"by_kind_stage": {"good|transform": 2}})
    assert again.by_kind_stage == {"good|transform": 2}
