"""wbl_p5_01_backfill_economy

经济旧数据回填（Phase 5 P5-T4；phase5_economy.md §6 迁移清单、economy_ui_design §3.5 / §7.8 / §11.6）：

1. 子模块 kind（仅 module_type = 'economy'）：`color = type:<old>:<level>[:<status>]` 前缀按六类旧类型
   语义映射回填 —— currency -> currency、commodity -> good、resource -> resource、
   industry -> industry、economic_zone -> market、trade_route -> custom_route；其余 `type:*`
   保留字面值。P1-MIG-04 已把 kind 推成旧类型名（如 `commodity`）的行按同一张表归一，
   kind 空缺时从 color 推导。
2. 旧等级：color 前缀的 level 分量写入 `world_submodules.meta.level`；四个已知等级
   （global / national / regional / local）以去星级 label（全球级 / 国家级 / 区域级 / 地方级）与
   rank 4 / 3 / 2 / 1 合并进 `world_modules.config.levels`（不含 `★` / `○` 等星级字符）。
3. name = 'moduleConfig' 的 item -> `world_modules.config`（合并，config 已有键优先，不删旧 item）。
4. name = 'relations' 的 item 的 `<关系类型>:<目标ID>:<流量>:<开始>:<结束>` -> `world_links`：
   命中契约 §4 且源 / 目标 kind 合法时用对应 economy.*，否则按 P1-MIG-05 口径回落（对称旧类型 ->
   `core.related_to`，其余有向 -> `core.references`，`directed` 取 registry 定义）并把原名放
   `label` 与 `meta.legacyRelationType`；`volume` -> `meta.flow`（仅数字，缺失不猜）；起止 -> `time`；
   端点不存在、重复边一律跳过并计数（等价边去重含对称关联的反向匹配）。
5. name = 'customFields' 的 item -> 对应 submodule 的 `meta.customFields`（合并，现值优先）。
6. emoji 图标 -> Lucide 名（映射失败回退 `shapes`），原 emoji 保留进 `meta.legacyIcon`。
7. kind 词表同步：本迁移归一化过 kind 的经济子模块，其 `world_links.source_kind` / `target_kind`
   一并改写（只当现值仍等于旧值时写），避免同库内 kind 与关联端点词表自相矛盾。
8. 可升级的边：P1-MIG-05 因旧 kind 词表判非法而降级为通用类型的 `economy_relations` 边，用
   `LEGACY_RELATION_MAP` + registry（新 kind）重算 link_type / directed；升级不成立时保持原样。

幂等：所有写入先读现值，只有值变化才写；空库与旧库都可重复执行；**只回填不删**（旧 item、`color`、
`icon` 原值一律保留）。upgrade 打印一次 JSON 报告（`logger.info`）。

记账键（downgrade 依据，你可以在 meta / config / link.meta 里看到它们）：
- `world_submodules.meta`：`_p5LegacyKind`（改写前 kind，"" 表示原为空）、`_p5KindWritten`（本次写入的
  kind）、`_p5LevelWritten`（本次写入的 meta.level）、`_p5CustomFields` =
  {"created", "keys", "original"}（`original` 记原 customFields：原值是 dict 时记副本，原值不是 dict
  （形状非法）时记原文本身，原本没有该键时记哨兵 "missing"）、
  `_p5IconWritten` = {"lucide": 本次投影出的 Lucide 名, "legacy": 原 emoji（本次写入的
  legacyIcon）}、`_p5RawMeta`（meta 原值不是合法 JSON 对象时保存原文）。
- `world_modules.config._p5Legacy`：{"configItemId", "configKeys": {k: 写入值},
  "levelsWritten": {id: 写入的 LevelDef}, "levelsOriginal": {id: 原 LevelDef},
  "hadLevelsKey"（原 config 是否本来就有 `levels` 键）, "levelsRaw"（原 `levels` 不是 list 时的原文，
  在 `hadLevelsKey` 为真时才有意义）, "hadConfig", "rawConfig"}。
- `world_links.meta`：`_p5Source` = {"itemId", "key", "snapshot"}（本次新建的边 + 本次插入的列快照）、
  `_p5SourceKind` / `_p5TargetKind` = {"from": 改写前的端点 kind, "to": 本次改写成的 kind}、
  `_p5LinkType` = {"linkType", "directed", "label"}（link_type 升级前的值）。

downgrade 只撤本次写入：每一项都只在「现值仍等于本次写入值」时撤销，用户在后迁移期改过的一律保留；
不删旧 item、不动 color 原值；`meta = '{}'` 保持 `'{}'`（不退化成 NULL）；`world_links.meta` 不是合法
JSON 时按「用户改过」处理，跳过而绝不让整条 downgrade 失败。

Revision ID: d4e8b1c7a206
Revises: c1f7a4b9e2d3
Create Date: 2026-10-08 10:30:00.000000

"""

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e8b1c7a206"
down_revision: Union[str, None] = "c1f7a4b9e2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

# 与 P1-MIG-05 相同的确定性命名空间（迁移内自带，避免依赖可变的运行时配置）
NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")

# 六类旧经济类型 -> 新 kind（§3.5：其余 type:* 原值保留）
LEGACY_KIND_MAP: Dict[str, str] = {
    "currency": "currency",
    "commodity": "good",
    "resource": "resource",
    "industry": "industry",
    "economic_zone": "market",
    "trade_route": "custom_route",
}

# §7.4 四个已知等级：去星级的 label 与 rank
LEVEL_DEFS: Tuple[Tuple[str, str, int], ...] = (
    ("global", "全球级", 4),
    ("national", "国家级", 3),
    ("regional", "区域级", 2),
    ("local", "地方级", 1),
)

# 星级 / 圆点拼贴字符（§7.4：等级不使用星级，迁移时清除）
STAR_CHARS = "★☆○●◯◎◆◇■□▲△・·*"

# 旧经济关系类型 -> 契约 §4.4（命中且 kind 合法才使用，否则按 P1-MIG-05 口径回落）
LEGACY_RELATION_MAP: Dict[str, str] = {
    "supplier": "economy.supplies",
    "consumer": "economy.consumes",
    "dependency": "economy.requires",
    "trade_partner": "economy.flows_to",
}
# 语义对称的旧关系类型（与 P1-MIG-05 的 SYMMETRIC_LEGACY_TYPES 同口径）：
# 候选类型校验不通过时用 core.related_to，其余（有向）用 core.references
SYMMETRIC_LEGACY_TYPES = {"trade_partner", "competitor"}
GENERAL_DIRECTED = "core.references"
GENERAL_SYMMETRIC = "core.related_to"
# P1-MIG-05 会写下的通用回落类型：只有当前 link_type 属于这两者（或已是同一次升级的结果）才重算
GENERAL_LINK_TYPES = (GENERAL_DIRECTED, GENERAL_SYMMETRIC)

# 旧 emoji 图标 -> Lucide 名（与 app/services/economy_service.py 读取侧投影同一张表）
EMOJI_ICON_MAP: Dict[str, str] = {
    "💰": "coins",
    "🪙": "coins",
    "💵": "banknote",
    "💴": "banknote",
    "💶": "banknote",
    "💷": "banknote",
    "⚙": "settings",
    "🏭": "factory",
    "🔧": "wrench",
    "⛏": "pickaxe",
    "🪨": "mountain",
    "💎": "gem",
    "🌾": "wheat",
    "🌽": "wheat",
    "🐟": "fish",
    "🐄": "beef",
    "🐑": "sheep",
    "🪵": "trees",
    "🌲": "trees",
    "🧵": "spool",
    "🏪": "store",
    "🏬": "store",
    "🏦": "landmark",
    "🏛": "landmark",
    "🚚": "truck",
    "🚛": "truck",
    "🚢": "ship",
    "⛵": "ship",
    "🛶": "ship",
    "⚖": "scale",
    "📦": "package",
    "📜": "scroll-text",
    "🗺": "map",
    "👤": "user",
    "🧑": "user",
    "👥": "users",
    "🛡": "shield",
    "🔑": "key-round",
    "🌍": "globe",
    "🔥": "flame",
    "🏗": "construction",
    "🧭": "compass",
    "📊": "chart-column",
    "📈": "chart-line",
    "🪧": "signpost",
    "🏕": "tent",
}
EMOJI_ICON_FALLBACK = "shapes"
EMOJI_VARIATION_SELECTORS = "\ufe0e\ufe0f\u200d"
LUCIDE_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# 记账键
KIND_MARKER = "_p5LegacyKind"
KIND_WRITTEN_MARKER = "_p5KindWritten"
LEVEL_MARKER = "_p5LevelWritten"
CUSTOM_FIELDS_MARKER = "_p5CustomFields"
ICON_MARKER = "_p5IconWritten"
RAW_META_MARKER = "_p5RawMeta"
CONFIG_MARKER = "_p5Legacy"
LINK_MARKER = "_p5Source"
SOURCE_KIND_MARKER = "_p5SourceKind"
TARGET_KIND_MARKER = "_p5TargetKind"
LINK_TYPE_MARKER = "_p5LinkType"
# customFields 原值不存在时的占位哨兵（有但形状非法时直接记原文）
CUSTOM_FIELDS_MISSING = "missing"


# ---------------------------------------------------------------------------
# 通用取值
# ---------------------------------------------------------------------------


def _parse_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _as_str(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _as_float(value: Any) -> Optional[float]:
    """数字 -> float；bool 与其它类型 -> None（volume 缺失不猜）。"""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _as_number(value: Any) -> Optional[float]:
    """数字或数字字符串 -> float（旧 relations 编码里的流量是字符串）。"""

    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = _as_str(value)
    if text is None:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _snapshot(value: Any) -> Any:
    """深拷贝快照（只为比较 / 记账，不参与业务判断）。"""

    return json.loads(json.dumps(value, ensure_ascii=False))


def _deterministic_id(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, ":".join(parts)))


def _resolve_link_type(
    relation_type: str,
    source: Tuple[str, str, str],
    target: Tuple[str, str, str],
    validate_link_type,
) -> Tuple[str, bool, Optional[str]]:
    """P1-MIG-05 口径：候选类型校验通过则用之，否则对称旧类型 -> core.related_to、其余 -> core.references。

    返回 (link_type, directed, label)；label 为 None 表示用上了契约类型（不回填原名）。
    对称 / 有向用同一口径，升级与回落共用，保证与 P1-MIG-05 落库结果一致。
    """

    candidate = LEGACY_RELATION_MAP.get(relation_type)
    if candidate:
        ok, _error = validate_link_type(
            candidate, source[0], source[1], target[0], target[1]
        )
        if ok:
            return candidate, True, None
    if relation_type in SYMMETRIC_LEGACY_TYPES:
        return GENERAL_SYMMETRIC, False, relation_type
    return GENERAL_DIRECTED, True, relation_type


def _color_parts(color: Any) -> Optional[List[str]]:
    if not color or not str(color).startswith("type:"):
        return None
    return str(color).split(":")


def _kind_from_color(color: Any) -> Optional[str]:
    """`type:<old>:...` -> 六类映射后的 kind；其余 type:* 返回原字面值。"""

    parts = _color_parts(color)
    if parts is None:
        return None
    token = _as_str(parts[1]) if len(parts) > 1 else None
    if not token:
        return None
    return LEGACY_KIND_MAP.get(token, token)


def _level_from_color(color: Any) -> Optional[str]:
    """`type:<old>:<level>[:<status>]` 的等级分量。"""

    parts = _color_parts(color)
    if parts is None or len(parts) < 3:
        return None
    return _as_str(parts[2])


def _generic_kind(color: Any) -> str:
    """非六类旧类型的 P1 口径兜底（与 app.models.worldbuilding.derive_submodule_kind 同义）。"""

    if not color:
        return "custom"
    text = str(color)
    if text.startswith("era:"):
        return "era"
    if text.startswith("type:"):
        parts = text.split(":")
        return parts[1] if len(parts) > 1 and parts[1] else "custom"
    return "custom"


def _normalized_kind(kind: Any, color: Any) -> Optional[str]:
    """kind 归一化：已有 kind 走六类映射；空缺时由 color 推导；都没有则保持空缺。"""

    current = _as_str(kind)
    if current:
        return LEGACY_KIND_MAP.get(current, current)
    derived = _kind_from_color(color)
    if derived:
        return derived
    if color:
        return _generic_kind(color)
    return None


def _has_star(text: Any) -> bool:
    return isinstance(text, str) and any(char in STAR_CHARS for char in text)


def _is_emoji(text: str) -> bool:
    for char in text:
        code = ord(char)
        if char in EMOJI_VARIATION_SELECTORS:
            continue
        if 0x1F000 <= code <= 0x1FAFF or 0x2600 <= code <= 0x27BF:
            return True
        if 0x2B00 <= code <= 0x2BFF or code in (0x203C, 0x2049, 0x2122):
            return True
    return False


def _lucide_icon(icon: Any) -> Optional[str]:
    text = _as_str(icon)
    if not text:
        return None
    cleaned = "".join(char for char in text if char not in EMOJI_VARIATION_SELECTORS)
    if LUCIDE_NAME_RE.match(cleaned):
        return cleaned
    if _is_emoji(cleaned):
        return EMOJI_ICON_MAP.get(cleaned, EMOJI_ICON_FALLBACK)
    if ":" in cleaned:
        return None
    return EMOJI_ICON_FALLBACK


def _parse_legacy_relation(
    value: Any,
) -> Optional[Tuple[str, str, Optional[float], Optional[str], Optional[str]]]:
    """`<关系类型>:<目标ID>:<流量>:<开始>:<结束>` -> 元组；残缺项返回 None。"""

    text = str(value) if value is not None else ""
    parts = text.split(":")
    if len(parts) < 2:
        return None
    relation_type = _as_str(parts[0])
    target_id = _as_str(parts[1])
    if not relation_type or not target_id:
        return None
    volume = _as_number(parts[2]) if len(parts) >= 3 and parts[2] else None
    start = _as_str(parts[3]) if len(parts) >= 4 else None
    end = _as_str(parts[4]) if len(parts) >= 5 else None
    return (relation_type, target_id, volume, start, end)


# ---------------------------------------------------------------------------
# 取数
# ---------------------------------------------------------------------------


def _load_modules(conn) -> Dict[str, Dict[str, Any]]:
    """经济模块 -> {"id", "world_id", "config", "raw_config"}。"""

    rows = conn.execute(
        sa.text(
            "SELECT id, world_id, config FROM world_modules "
            "WHERE module_type = 'economy' ORDER BY id"
        )
    ).fetchall()
    modules: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        row = row._mapping
        parsed = _parse_json(row["config"], None)
        modules[row["id"]] = {
            "id": row["id"],
            "world_id": row["world_id"],
            "config": dict(parsed) if isinstance(parsed, dict) else {},
            "raw_config": row["config"],
            "malformed_config": row["config"] is not None
            and not isinstance(parsed, dict),
        }
    return modules


def _load_submodules(conn) -> List[Dict[str, Any]]:
    """经济子模块状态（含 meta 快照，供各步骤复用与幂等比较）。"""

    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.module_id AS module_id, s.kind AS kind, "
            "       s.color AS color, s.icon AS icon, s.meta AS meta "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.module_type = 'economy' ORDER BY s.id"
        )
    ).fetchall()
    states: List[Dict[str, Any]] = []
    for row in rows:
        row = row._mapping
        parsed = _parse_json(row["meta"], None)
        meta = dict(parsed) if isinstance(parsed, dict) else {}
        states.append(
            {
                "id": row["id"],
                "module_id": row["module_id"],
                "kind": row["kind"],
                "color": row["color"],
                "icon": row["icon"],
                "meta": meta,
                "raw_meta": row["meta"],
                "malformed_meta": row["meta"] is not None
                and not isinstance(parsed, dict),
                "original_kind": row["kind"],
                "original_icon": row["icon"],
                "original_meta": _snapshot(meta),
                "meta_dirty": False,
            }
        )
    return states


def _load_items(conn) -> List[Dict[str, Any]]:
    rows = conn.execute(
        sa.text(
            "SELECT i.id AS id, i.module_id AS module_id, "
            "       i.submodule_id AS submodule_id, "
            "       i.name AS name, i.content AS content, "
            "       i.order_index AS order_index "
            "FROM world_module_items i JOIN world_modules m ON i.module_id = m.id "
            "WHERE m.module_type = 'economy' "
            "  AND i.name IN ('moduleConfig', 'relations', 'customFields') "
            "ORDER BY i.order_index, i.id"
        )
    ).fetchall()
    items: List[Dict[str, Any]] = []
    for row in rows:
        row = row._mapping
        content = _parse_json(row["content"], None)
        items.append(
            {
                "id": row["id"],
                "module_id": row["module_id"],
                "submodule_id": row["submodule_id"],
                "name": row["name"],
                "content": content,
                "order_index": row["order_index"],
            }
        )
    return items


def _load_world_entities(conn, world_ids: Sequence[str]) -> Dict[str, Dict[str, str]]:
    """{entity_id: {"module", "kind"}}：旧关系端点的模块与 kind（按世界批量取一次）。"""

    result: Dict[str, Dict[str, str]] = {}
    if not world_ids:
        return result
    worlds = list(world_ids)
    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, m.module_type AS module_type, s.kind AS kind, "
            "       s.color AS color "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.world_id IN :worlds"
        ).bindparams(sa.bindparam("worlds", expanding=True)),
        {"worlds": worlds},
    ).fetchall()
    for row in rows:
        row = row._mapping
        kind = _normalized_kind(row["kind"], row["color"]) or "custom"
        result[row["id"]] = {"module": row["module_type"], "kind": kind}
    item_rows = conn.execute(
        sa.text(
            "SELECT i.id AS id, m.module_type AS module_type "
            "FROM world_module_items i JOIN world_modules m ON i.module_id = m.id "
            "WHERE m.world_id IN :worlds"
        ).bindparams(sa.bindparam("worlds", expanding=True)),
        {"worlds": worlds},
    ).fetchall()
    for row in item_rows:
        row = row._mapping
        result[row["id"]] = {"module": row["module_type"], "kind": "entry"}
    return result


# ---------------------------------------------------------------------------
# 步骤 1 / 2 / 5 / 6：子模块 kind / meta.level / customFields / emoji 图标
# ---------------------------------------------------------------------------


def _backfill_submodule_kinds(
    states: Sequence[Dict[str, Any]], report: Dict[str, int]
) -> None:
    for state in states:
        normalized = _normalized_kind(state["kind"], state["color"])
        if normalized and normalized != state["kind"]:
            state["kind"] = normalized
            state["meta"].setdefault(KIND_MARKER, state["original_kind"] or "")
            state["meta"].setdefault(KIND_WRITTEN_MARKER, normalized)
            state["meta_dirty"] = True
            report["kind_backfilled"] += 1


def _backfill_levels(states: Sequence[Dict[str, Any]], report: Dict[str, int]) -> None:
    for state in states:
        level = _level_from_color(state["color"])
        if not level or state["meta"].get("level"):
            continue
        state["meta"]["level"] = level
        state["meta"].setdefault(LEVEL_MARKER, level)
        state["meta_dirty"] = True
        report["level_backfilled"] += 1


def _backfill_custom_fields(
    states: Sequence[Dict[str, Any]],
    items: Sequence[Dict[str, Any]],
    report: Dict[str, int],
) -> None:
    by_id = {state["id"]: state for state in states}
    for item in items:
        if item["name"] != "customFields":
            continue
        state = by_id.get(item["submodule_id"] or "")
        content = item["content"]
        if state is None or not isinstance(content, dict) or not content:
            if state is None:
                report["custom_fields_orphans"] += 1
            continue

        existing = state["meta"].get("customFields")
        created = not isinstance(existing, dict)
        target = dict(existing) if isinstance(existing, dict) else {}
        marker = state["meta"].get(CUSTOM_FIELDS_MARKER)
        if not isinstance(marker, dict):
            marker = {"created": created, "keys": {}}
        # 原值快照：合法的 dict 记原值副本；没有该键记 CUSTOM_FIELDS_MISSING 哨兵；
        # 有但形状非法（如字符串 / 数字）就记原文本身，downgrade 才能原样写回
        if "original" not in marker:
            if isinstance(existing, dict):
                marker["original"] = _snapshot(existing)
            elif "customFields" in state["meta"]:
                marker["original"] = existing
            else:
                marker["original"] = CUSTOM_FIELDS_MISSING
        written: Dict[str, Any] = {}
        for key, value in content.items():
            if key in target:
                continue
            target[key] = _snapshot(value)
            written[key] = _snapshot(value)
        if not written:
            continue
        state["meta"]["customFields"] = target
        merged_keys = dict(marker.get("keys") or {})
        for key, value in written.items():
            merged_keys.setdefault(key, value)
        marker["keys"] = merged_keys
        marker["created"] = bool(marker.get("created", created))
        state["meta"][CUSTOM_FIELDS_MARKER] = marker
        state["meta_dirty"] = True
        report["custom_fields_backfilled"] += len(written)


def _backfill_icons(states: Sequence[Dict[str, Any]], report: Dict[str, int]) -> None:
    for state in states:
        icon = state["icon"]
        if not isinstance(icon, str) or not icon:
            continue
        text = "".join(char for char in icon if char not in EMOJI_VARIATION_SELECTORS)
        if not _is_emoji(text) or state["meta"].get(ICON_MARKER):
            continue
        lucide = _lucide_icon(icon)
        if not lucide or lucide == icon:
            continue
        if not state["meta"].get("legacyIcon"):
            state["meta"]["legacyIcon"] = icon
        # marker 同时记本次投影名与原 emoji：downgrade 才能逐字段判断用户是否改过
        state["meta"][ICON_MARKER] = {"lucide": lucide, "legacy": icon}
        state["icon"] = lucide
        state["meta_dirty"] = True
        report["icons_mapped"] += 1


def _flush_submodules(
    conn, states: Sequence[Dict[str, Any]], report: Dict[str, int]
) -> None:
    """落盘子模块：kind / icon / meta 分别只在变化时写。"""

    for state in states:
        if state["kind"] != state["original_kind"]:
            conn.execute(
                sa.text("UPDATE world_submodules SET kind = :kind WHERE id = :id"),
                {"kind": state["kind"], "id": state["id"]},
            )
        if state["icon"] != state["original_icon"]:
            conn.execute(
                sa.text("UPDATE world_submodules SET icon = :icon WHERE id = :id"),
                {"icon": state["icon"], "id": state["id"]},
            )
        meta_changed = state["meta"] != state["original_meta"]
        if not meta_changed:
            continue
        if state["malformed_meta"]:
            # meta 原值不是合法 JSON 对象：保存原文，downgrade 才能原样还原
            state["meta"].setdefault(RAW_META_MARKER, state["raw_meta"])
            report["malformed_meta"] += 1
        conn.execute(
            sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
            {"meta": _dump_json(state["meta"]), "id": state["id"]},
        )
        report["meta_written"] += 1


# ---------------------------------------------------------------------------
# 步骤 2 / 3：moduleConfig -> config，等级去星级
# ---------------------------------------------------------------------------


def _merge_config_marker(config: Dict[str, Any]) -> Dict[str, Any]:
    marker = config.get(CONFIG_MARKER)
    if not isinstance(marker, dict):
        marker = {}
        config[CONFIG_MARKER] = marker
    marker.setdefault("configKeys", {})
    marker.setdefault("levelsWritten", {})
    marker.setdefault("levelsOriginal", {})
    return marker


def _backfill_module_config(
    modules: Dict[str, Dict[str, Any]],
    items: Sequence[Dict[str, Any]],
    report: Dict[str, int],
) -> None:
    config_items: Dict[str, List[Dict[str, Any]]] = {}
    for item in items:
        if item["name"] == "moduleConfig":
            config_items.setdefault(item["module_id"], []).append(item)

    for module_id in sorted(modules):
        module = modules[module_id]
        config = dict(module["config"])
        original = _snapshot(config)
        marker = _merge_config_marker(config)
        raw_config = module.get("raw_config")
        marker.setdefault("hadConfig", raw_config is not None)
        if module.get("malformed_config") and raw_config is not None:
            marker.setdefault("rawConfig", raw_config)

        for item in config_items.get(module_id, []):
            content = item["content"]
            if not isinstance(content, dict):
                report["config_items_skipped"] += 1
                continue
            written: Dict[str, Any] = {}
            for key, value in content.items():
                if key in config:
                    continue
                # 深拷贝：config 与 item.content、记账值三者不共享对象，
                # 否则后续等级合并的原地修改会污染记账快照（downgrade 无法比较）
                config[key] = _snapshot(value)
                written[key] = _snapshot(value)
            if written:
                marker["configItemId"] = item["id"]
                keys = dict(marker.get("configKeys") or {})
                for key, value in written.items():
                    keys.setdefault(key, value)
                marker["configKeys"] = keys
                report["config_keys_written"] += len(written)

        marker["hadLevelsKey"] = marker.get("hadLevelsKey", "levels" in config)
        _merge_level_defs(config, marker, report)
        module["config"] = config
        if _snapshot(config) != original:
            module["config_dirty"] = True


def _merge_level_defs(
    config: Dict[str, Any], marker: Dict[str, Any], report: Dict[str, int]
) -> None:
    """四个已知等级写入 config.levels：缺则新增，带星级或缺 rank 则改写。"""

    levels = config.get("levels")
    if not isinstance(levels, list):
        # 形状非法的存量值（如 {"global": 4}）不能静默丢弃：记原文供 downgrade 原样写回
        if "levels" in config and "levelsRaw" not in marker:
            marker["levelsRaw"] = _snapshot(levels)
        levels = []
        config["levels"] = levels
    written = dict(marker.get("levelsWritten") or {})
    original = dict(marker.get("levelsOriginal") or {})

    for level_id, label, rank in LEVEL_DEFS:
        found = next(
            (
                (index, item)
                for index, item in enumerate(levels)
                if isinstance(item, dict) and item.get("id") == level_id
            ),
            None,
        )
        if found is None:
            new_entry = {"id": level_id, "label": label, "rank": rank}
            levels.append(new_entry)
            written[level_id] = new_entry
            report["levels_added"] += 1
            continue
        index, entry = found
        desired = dict(entry)
        current_label = entry.get("label")
        if (
            not isinstance(current_label, str)
            or not current_label.strip()
            or _has_star(current_label)
        ):
            desired["label"] = label
        current_rank = entry.get("rank")
        if isinstance(current_rank, bool) or not isinstance(current_rank, int):
            desired["rank"] = rank
        if desired == entry:
            continue
        original.setdefault(level_id, _snapshot(entry))
        levels[index] = desired
        written[level_id] = desired
        report["levels_destarred"] += 1

    if written:
        marker["levelsWritten"] = written
    if original:
        marker["levelsOriginal"] = original


def _flush_modules(
    conn, modules: Dict[str, Dict[str, Any]], report: Dict[str, int]
) -> None:
    for module_id in sorted(modules):
        module = modules[module_id]
        if not module.get("config_dirty"):
            continue
        conn.execute(
            sa.text("UPDATE world_modules SET config = :config WHERE id = :id"),
            {"config": _dump_json(module["config"]), "id": module_id},
        )
        report["modules_written"] += 1


# ---------------------------------------------------------------------------
# 步骤 4：旧 relations 条目 -> world_links
# ---------------------------------------------------------------------------


def _registry():
    """延迟导入 registry：迁移文件在 alembic 环境里运行，保持与 P1-MIG-05 同做法。"""

    from app.services.link_registry import get_link_type, validate_link_type

    return get_link_type, validate_link_type


def _find_duplicate(
    conn,
    world_id: str,
    source: Tuple[str, str, str],
    target: Tuple[str, str, str],
    link_type: str,
) -> bool:
    """等价边查询：对称关联正反向都算重复，有向关联只比同向（与 LinkService.find_duplicate 同义）。"""

    get_link_type, _validate_link_type = _registry()
    definition = get_link_type(link_type)
    params = {
        "w": world_id,
        "lt": link_type,
        "sm": source[0],
        "sk": source[1],
        "si": source[2],
        "tm": target[0],
        "tk": target[1],
        "ti": target[2],
    }
    same = (
        "(source_module = :sm AND source_kind = :sk AND source_id = :si AND "
        " target_module = :tm AND target_kind = :tk AND target_id = :ti)"
    )
    if definition is not None and not definition.directed:
        reverse = (
            "(source_module = :tm AND source_kind = :tk AND source_id = :ti AND "
            " target_module = :sm AND target_kind = :sk AND target_id = :si)"
        )
        condition = f"({same} OR {reverse})"
    else:
        condition = same
    row = conn.execute(
        sa.text(
            f"SELECT 1 FROM world_links WHERE world_id = :w AND link_type = :lt "
            f"AND {condition} LIMIT 1"
        ),
        params,
    ).fetchone()
    return row is not None


def _insert_link(
    conn,
    *,
    link_id: str,
    world_id: str,
    source: Tuple[str, str, str],
    target: Tuple[str, str, str],
    link_type: str,
    directed: bool,
    label: Optional[str],
    meta: Dict[str, Any],
    time_range: Optional[Dict[str, Any]],
    item_id: str,
    key: str,
) -> bool:
    # 记账键在写入前补上本次插入的列快照：downgrade 只有在每一列都仍等于本次写入值时才删边
    source_marker = dict(meta.get(LINK_MARKER) or {})
    source_marker["itemId"] = item_id
    source_marker["key"] = key
    source_marker.setdefault(
        "snapshot",
        {
            "label": label,
            "directed": 1 if directed else 0,
            "link_type": link_type,
        },
    )
    meta[LINK_MARKER] = source_marker
    conn.execute(
        sa.text(
            "INSERT INTO world_links "
            "(id, world_id, source_module, source_kind, source_id, "
            " target_module, target_kind, target_id, link_type, directed, label, note, "
            " meta, time, created_at, updated_at) "
            "VALUES (:id, :world_id, :source_module, :source_kind, :source_id, "
            " :target_module, :target_kind, :target_id, :link_type, :directed, "
            " :label, NULL, "
            " :meta, :time, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {
            "id": link_id,
            "world_id": world_id,
            "source_module": source[0],
            "source_kind": source[1],
            "source_id": source[2],
            "target_module": target[0],
            "target_kind": target[1],
            "target_id": target[2],
            "link_type": link_type,
            "directed": 1 if directed else 0,
            "label": label,
            "meta": _dump_json(meta),
            "time": _dump_json(time_range) if time_range else None,
        },
    )
    return True


def _backfill_relations(
    conn,
    modules: Dict[str, Dict[str, Any]],
    states: Sequence[Dict[str, Any]],
    items: Sequence[Dict[str, Any]],
    report: Dict[str, int],
) -> None:
    get_link_type, validate_link_type = _registry()
    submodule_kinds = {state["id"]: state["kind"] for state in states}
    world_ids = sorted({module["world_id"] for module in modules.values()})
    entities = _load_world_entities(conn, world_ids)

    relation_items: Dict[str, List[Dict[str, Any]]] = {}
    for item in items:
        if item["name"] == "relations":
            relation_items.setdefault(item["module_id"], []).append(item)

    for module_id in sorted(modules):
        module = modules[module_id]
        world_id = module["world_id"]
        for item in relation_items.get(module_id, []):
            content = item["content"]
            source_id = item["submodule_id"]
            if not isinstance(content, dict) or not content:
                continue
            if not source_id or source_id not in submodule_kinds:
                report["relations_orphans"] += len(content)
                continue
            source_kind = submodule_kinds[source_id] or "custom"
            source = ("economy", source_kind, source_id)
            for key in sorted(content):
                parsed = _parse_legacy_relation(content[key])
                if parsed is None:
                    report["relations_orphans"] += 1
                    continue
                relation_type, target_id, volume, start, end = parsed
                target_entry = entities.get(target_id)
                if target_entry is None:
                    report["relations_orphans"] += 1
                    continue
                target = (target_entry["module"], target_entry["kind"], target_id)

                # P1-MIG-05 口径：候选命中且（新 kind 下）校验通过才用 economy.*，
                # 否则对称旧类型 -> core.related_to、其余有向 -> core.references
                link_type, directed, label = _resolve_link_type(
                    relation_type, source, target, validate_link_type
                )

                link_id = _deterministic_id("wbl-p5-01", "econ", item["id"], str(key))
                # P1-MIG-05 已把同一条旧 relations 编码转成 world_links（确定性 id 同源），
                # 这里必须先认出来，否则同一条旧关系会被转两次
                p1_link_id = _deterministic_id(
                    "wbl-p1-05", "econ", item["id"], str(key)
                )
                exists = conn.execute(
                    sa.text(
                        "SELECT 1 FROM world_links WHERE id IN (:id, :p1_id) LIMIT 1"
                    ),
                    {"id": link_id, "p1_id": p1_link_id},
                ).fetchone()
                if exists is not None or _find_duplicate(
                    conn, world_id, source, target, link_type
                ):
                    report["relations_duplicates"] += 1
                    continue

                definition = get_link_type(link_type)
                directed = bool(definition.directed) if definition else directed
                meta: Dict[str, Any] = {
                    "legacyRelationType": relation_type,
                    "legacyItemId": item["id"],
                    "legacyKey": key,
                }
                if volume is not None:
                    meta["flow"] = volume
                time_range = None
                if start or end:
                    time_range = {"start": start, "end": end}
                _insert_link(
                    conn,
                    link_id=link_id,
                    world_id=world_id,
                    source=source,
                    target=target,
                    link_type=link_type,
                    directed=directed,
                    label=label,
                    meta=meta,
                    time_range=time_range,
                    item_id=item["id"],
                    key=key,
                )
                report["relations_links_created"] += 1


# ---------------------------------------------------------------------------
# 步骤 7 / 8：kind 词表同步 + 可升级的 economy_relations 边
# ---------------------------------------------------------------------------


def _normalized_kind_map(
    states: Sequence[Dict[str, Any]],
) -> Dict[str, Tuple[Optional[str], str]]:
    """本次归一化过 kind 的子模块 -> (旧 kind, 新 kind)。"""

    changed: Dict[str, Tuple[Optional[str], str]] = {}
    for state in states:
        if state["kind"] == state["original_kind"]:
            continue
        if not state["kind"]:
            continue
        changed[state["id"]] = (state["original_kind"], state["kind"])
    return changed


def _load_link_rows(conn) -> List[Dict[str, Any]]:
    """world_links 当前状态（meta 解析失败的行原样保留，交由调用方跳过）。"""

    rows = conn.execute(
        sa.text(
            "SELECT id, source_kind, source_id, target_kind, target_id, "
            "       link_type, directed, label, meta FROM world_links ORDER BY id"
        )
    ).fetchall()
    result: List[Dict[str, Any]] = []
    for row in rows:
        row = row._mapping
        parsed = _parse_json(row["meta"], None)
        result.append(
            {
                "id": row["id"],
                "source_kind": row["source_kind"],
                "source_id": row["source_id"],
                "target_kind": row["target_kind"],
                "target_id": row["target_id"],
                "link_type": row["link_type"],
                "directed": row["directed"],
                "label": row["label"],
                "meta": row["meta"],
                "parsed": parsed if isinstance(parsed, dict) else None,
            }
        )
    return result


def _sync_link_kinds(
    conn, states: Sequence[Dict[str, Any]], report: Dict[str, int]
) -> None:
    """步骤 7：本迁移归一化过 kind 的经济子模块，其在 world_links 里的端点 kind 一并改写。

    只当端点现值仍等于旧 kind 时才写（用户改过的不动）；旧值记进 `meta._p5SourceKind` /
    `meta._p5TargetKind`，downgrade 精确还原。
    """

    changed = _normalized_kind_map(states)
    if not changed:
        return

    for link in _load_link_rows(conn):
        meta = link["parsed"]
        if meta is None:
            continue
        updated = False
        for column, id_key, marker in (
            ("source_kind", "source_id", SOURCE_KIND_MARKER),
            ("target_kind", "target_id", TARGET_KIND_MARKER),
        ):
            entry = changed.get(link[id_key] or "")
            if entry is None or marker in meta:
                continue
            old_kind, new_kind = entry
            if (link[column] or "") != (old_kind or ""):
                continue
            # 旧值 / 本次改写值一起记（downgrade 无法从库里反推旧的 kind 词表）
            meta[marker] = {"from": link[column], "to": new_kind}
            if link[column] != new_kind:
                conn.execute(
                    sa.text(f"UPDATE world_links SET {column} = :kind WHERE id = :id"),
                    {"kind": new_kind, "id": link["id"]},
                )
                report["link_kind_synced"] += 1
                updated = True
        if updated:
            conn.execute(
                sa.text("UPDATE world_links SET meta = :meta WHERE id = :id"),
                {"meta": _dump_json(meta), "id": link["id"]},
            )


def _upgrade_legacy_links(
    conn,
    states: Sequence[Dict[str, Any]],
    report: Dict[str, int],
) -> None:
    """步骤 8：P1-MIG-05 因旧 kind 词表判非法而降级的 economy_relations 边，用新 kind 重算。

    只处理当前 link_type 属于 P1 回落结果（core.references / core.related_to）的边；重算不成立
    （仍不匹配 registry）时保持原样。仅当重算结果与现值不同才写，原值记进 `meta._p5LinkType`。
    """

    _get_link_type, validate_link_type = _registry()
    submodule_kinds = {state["id"]: state["kind"] for state in states}
    for link in _load_link_rows(conn):
        meta = link["parsed"]
        if meta is None:
            continue
        if meta.get("migratedFrom") != "economy_relations":
            continue
        if link["link_type"] not in GENERAL_LINK_TYPES:
            continue
        relation_type = _as_str(meta.get("legacyRelationType"))
        if relation_type is None:
            continue
        source_kind = submodule_kinds.get(link["source_id"])
        target_kind = submodule_kinds.get(link["target_id"])
        if not source_kind or not target_kind:
            continue
        source = ("economy", source_kind, link["source_id"])
        target = ("economy", target_kind, link["target_id"])
        link_type, directed, label = _resolve_link_type(
            relation_type, source, target, validate_link_type
        )
        desired = 1 if directed else 0
        if link_type == link["link_type"] and desired == link["directed"]:
            continue
        if LINK_TYPE_MARKER not in meta:
            meta[LINK_TYPE_MARKER] = {
                "linkType": link["link_type"],
                "directed": link["directed"],
                "label": link["label"],
            }
        conn.execute(
            sa.text(
                "UPDATE world_links SET link_type = :link_type, directed = :directed, "
                " label = :label, meta = :meta WHERE id = :id"
            ),
            {
                "link_type": link_type,
                "directed": desired,
                "label": label,
                "meta": _dump_json(meta),
                "id": link["id"],
            },
        )
        report["link_types_upgraded"] += 1


# ---------------------------------------------------------------------------
# upgrade
# ---------------------------------------------------------------------------


def upgrade() -> None:
    conn = op.get_bind()
    report: Dict[str, int] = {
        "modules": 0,
        "submodules": 0,
        "kind_backfilled": 0,
        "level_backfilled": 0,
        "levels_added": 0,
        "levels_destarred": 0,
        "config_keys_written": 0,
        "config_items_skipped": 0,
        "custom_fields_backfilled": 0,
        "custom_fields_orphans": 0,
        "icons_mapped": 0,
        "relations_links_created": 0,
        "relations_duplicates": 0,
        "relations_orphans": 0,
        "link_kind_synced": 0,
        "link_types_upgraded": 0,
        "meta_written": 0,
        "modules_written": 0,
        "malformed_meta": 0,
    }

    modules = _load_modules(conn)
    states = _load_submodules(conn)
    items = _load_items(conn)
    report["modules"] = len(modules)
    report["submodules"] = len(states)

    # 1) kind 归一化（六类旧类型语义映射）
    _backfill_submodule_kinds(states, report)
    # 2) 旧等级 -> meta.level
    _backfill_levels(states, report)
    # 5) customFields 条目 -> meta.customFields
    _backfill_custom_fields(states, items, report)
    # 6) emoji 图标 -> Lucide（原值进 meta.legacyIcon）
    _backfill_icons(states, report)
    _flush_submodules(conn, states, report)

    # 3) moduleConfig 条目 -> config，并把四个已知等级去星级写入 config.levels
    _backfill_module_config(modules, items, report)
    _flush_modules(conn, modules, report)

    # 4) relations 字符串 -> world_links（去重、孤儿跳过）
    _backfill_relations(conn, modules, states, items, report)
    # 7) kind 词表同步：归一化过的经济子模块，其 world_links 端点 kind 一并改写
    _sync_link_kinds(conn, states, report)
    # 8) 可升级的边：P1 因旧 kind 词表降级的 economy_relations 边用新 kind 重算
    _upgrade_legacy_links(conn, states, report)
    report["world_links_total"] = int(
        conn.execute(sa.text("SELECT count(*) FROM world_links")).fetchone()[0]
    )

    logger.info(
        "wbl_p5_01_backfill_economy report: %s",
        json.dumps(report, ensure_ascii=False, sort_keys=True),
    )


# ---------------------------------------------------------------------------
# downgrade
# ---------------------------------------------------------------------------


def _drop_written_keys(meta: Dict[str, Any], written_keys: Dict[str, Any]) -> bool:
    """删掉 meta.customFields 里仍等于本次写入值的键；返回剩余是否为非空 dict。"""

    custom_fields = meta.get("customFields")
    if not isinstance(custom_fields, dict):
        return False
    for key, value in written_keys.items():
        if custom_fields.get(key) == value:
            custom_fields.pop(key, None)
    return bool(custom_fields)


def _downgrade_submodules(conn) -> None:
    """只撤本次写入的 kind / meta.level / customFields / 图标，并清除全部记账键。"""

    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.kind AS kind, s.icon AS icon, s.meta AS meta "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.module_type = 'economy' ORDER BY s.id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        parsed = _parse_json(row["meta"], None)
        if not isinstance(parsed, dict):
            continue
        meta = dict(parsed)
        changed = False
        raw_meta = meta.pop(RAW_META_MARKER, None)
        if raw_meta is not None:
            changed = True

        if KIND_MARKER in meta:
            legacy_kind = meta.pop(KIND_MARKER)
            written_kind = meta.pop(KIND_WRITTEN_MARKER, None)
            if written_kind == row["kind"]:
                conn.execute(
                    sa.text("UPDATE world_submodules SET kind = :kind WHERE id = :id"),
                    {"kind": _as_str(legacy_kind), "id": row["id"]},
                )
            changed = True

        if LEVEL_MARKER in meta:
            written_level = meta.pop(LEVEL_MARKER)
            if meta.get("level") == written_level:
                meta.pop("level", None)
            changed = True

        marker = meta.pop(CUSTOM_FIELDS_MARKER, None)
        if isinstance(marker, dict):
            changed = True
            written_keys = marker.get("keys") or {}
            original = marker.get("original")
            if original == CUSTOM_FIELDS_MISSING:
                # 原本没有 customFields 键：撤掉本次新建的键，其余（用户后加的）保留
                if not _drop_written_keys(meta, written_keys):
                    meta.pop("customFields", None)
            elif isinstance(original, dict):
                # 原本是合法 dict：撤掉本次新建的键，空则回到原值，用户改过则保留现值
                if not _drop_written_keys(meta, written_keys) and marker.get("created"):
                    meta["customFields"] = dict(original)
            elif marker.get("created"):
                # 原值形状非法（字符串 / 数字 / 列表等，包括初始 marker 的 "invalid" 占位）：
                # 撤掉本次新建的键后没有用户新增内容就原样写回，否则保留合并后的现值
                if not _drop_written_keys(meta, written_keys):
                    meta["customFields"] = original

        if ICON_MARKER in meta:
            written_icon = meta.pop(ICON_MARKER)
            # 只在 icon 列仍等于本次写入值时回滚（原 emoji 保留在 legacyIcon）；legacyIcon
            # 只有在未被用户改写（仍等于本次写入的原 emoji，即 marker 记的 {"lucide","legacy"}）
            # 时才一起清除 —— 用户在后迁移期改过的 legacyIcon 一律保留
            lucide = (
                written_icon.get("lucide") if isinstance(written_icon, dict) else None
            )
            written_legacy = (
                written_icon.get("legacy") if isinstance(written_icon, dict) else None
            )
            changed = True
            if lucide is not None and row["icon"] == lucide:
                if (
                    written_legacy is not None
                    and meta.get("legacyIcon") == written_legacy
                ):
                    meta.pop("legacyIcon", None)
                if written_legacy is not None:
                    conn.execute(
                        sa.text(
                            "UPDATE world_submodules SET icon = :icon WHERE id = :id"
                        ),
                        {"icon": written_legacy, "id": row["id"]},
                    )

        if not changed:
            continue
        if raw_meta is not None and not any(
            key for key in meta if not key.startswith("_p5")
        ):
            # upgrade 用记账键整体替换过 meta：原样写回原始文本
            conn.execute(
                sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
                {"meta": raw_meta, "id": row["id"]},
            )
            continue
        conn.execute(
            sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
            {"meta": _dump_json(meta), "id": row["id"]},
        )


def _downgrade_module_config(conn) -> None:
    """只撤本次写入的 config 键与等级改写；用户改过的一律保留。"""

    rows = conn.execute(
        sa.text(
            "SELECT id, config FROM world_modules WHERE module_type = 'economy' "
            "ORDER BY id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        parsed = _parse_json(row["config"], None)
        if not isinstance(parsed, dict):
            continue
        config = dict(parsed)
        marker = config.get(CONFIG_MARKER)
        if not isinstance(marker, dict):
            continue
        raw_config = marker.get("rawConfig")

        levels = config.get("levels")
        if isinstance(levels, list):
            written_levels = marker.get("levelsWritten") or {}
            original_levels = marker.get("levelsOriginal") or {}
            for level_id, written_entry in written_levels.items():
                found = next(
                    (
                        (index, item)
                        for index, item in enumerate(levels)
                        if isinstance(item, dict) and item.get("id") == level_id
                    ),
                    None,
                )
                if found is None:
                    continue
                index, entry = found
                if entry != written_entry:
                    continue
                if level_id in original_levels:
                    levels[index] = original_levels[level_id]
                else:
                    levels.pop(index)

        for key, value in (marker.get("configKeys") or {}).items():
            if config.get(key) == value:
                config.pop(key, None)
        if "levelsRaw" in marker:
            # 原 levels 不是 list：本次写入后仍是 [] 才原样写回原文，否则保留用户值
            if config.get("levels") == []:
                config["levels"] = _snapshot(marker["levelsRaw"])
        elif not marker.get("hadLevelsKey") and config.get("levels") == []:
            config.pop("levels", None)

        config.pop(CONFIG_MARKER, None)
        if raw_config is not None and not config:
            # config 原值不是合法 JSON 对象：upgrade 用记账键整体替换过，原样写回原始文本
            conn.execute(
                sa.text("UPDATE world_modules SET config = :config WHERE id = :id"),
                {"config": raw_config, "id": row["id"]},
            )
            continue
        if not config and not marker.get("hadConfig", True):
            # 原 config 列为 NULL：回滚回 NULL，不留下本次写入产生的空对象
            conn.execute(
                sa.text("UPDATE world_modules SET config = NULL WHERE id = :id"),
                {"id": row["id"]},
            )
            continue
        conn.execute(
            sa.text("UPDATE world_modules SET config = :config WHERE id = :id"),
            {"config": _dump_json(config), "id": row["id"]},
        )


def _link_source_snapshot(marker: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """本次插入的列快照；没有快照（旧版记账键 / 手写 marker）时返回 None，按「不删」处理。"""

    snapshot = marker.get("snapshot")
    return snapshot if isinstance(snapshot, dict) else None


def _link_untouched_by_user(row: Any, snapshot: Dict[str, Any]) -> bool:
    """逐字段比对：label / directed / link_type 都仍等于本次写入值才算用户没改过。"""

    return (
        row["label"] == snapshot.get("label")
        and row["directed"] == snapshot.get("directed")
        and row["link_type"] == snapshot.get("link_type")
    )


def _upgrade_targets() -> Tuple[str, ...]:
    """步骤 8 重算可能写出的 link_type 集合（用于判断现值是否仍是本次升级结果）。"""

    return tuple(LEGACY_RELATION_MAP.values()) + GENERAL_LINK_TYPES


def _restore_link_kinds(conn) -> None:
    """步骤 7 的逆操作：端点 kind 仍等于本次改写值时才还原旧 kind。

    旧值 / 本次改写值都记在 marker 里（`{"from", "to"}`），不依赖库里已归一化的 kind 反推；
    用户改过端点值时一律保留。
    """

    for link in _load_link_rows(conn):
        meta = link["parsed"]
        if meta is None:
            continue
        changed = False
        for column, marker in (
            ("source_kind", SOURCE_KIND_MARKER),
            ("target_kind", TARGET_KIND_MARKER),
        ):
            entry = meta.pop(marker, None)
            if entry is None:
                continue
            changed = True
            if not isinstance(entry, dict):
                continue
            if (link[column] or "") != (entry.get("to") or ""):
                continue
            conn.execute(
                sa.text(f"UPDATE world_links SET {column} = :kind WHERE id = :id"),
                {"kind": entry.get("from"), "id": link["id"]},
            )
        if changed:
            conn.execute(
                sa.text("UPDATE world_links SET meta = :meta WHERE id = :id"),
                {"meta": _dump_json(meta), "id": link["id"]},
            )


def _downgrade_links(conn) -> None:
    """只撤本次写入的 world_links：新建的边、升级过的 link_type、改写过的端点 kind。

    每一行都先读现值再在 Python 侧比对（不用 json_extract：`meta` 非法 JSON 时跳过而不是整体失败）；
    新建的边只有「label / directed / link_type 三列都仍等于本次写入值」才删除，用户改过的一律保留
    （记账键也一起保留，便于再次 upgrade 幂等）。
    """

    for link in _load_link_rows(conn):
        meta = link["parsed"]
        if meta is None:
            # meta 不是合法 JSON 对象：按「用户改过」处理，跳过而不是让整条 downgrade 失败
            continue
        marker = meta.get(LINK_MARKER)
        snapshot = _link_source_snapshot(marker) if isinstance(marker, dict) else None
        if snapshot is not None and _link_untouched_by_user(link, snapshot):
            conn.execute(
                sa.text("DELETE FROM world_links WHERE id = :id"), {"id": link["id"]}
            )
            continue

        link_type_marker = meta.pop(LINK_TYPE_MARKER, None)
        if isinstance(link_type_marker, dict):
            if link["link_type"] in _upgrade_targets():
                conn.execute(
                    sa.text(
                        "UPDATE world_links SET link_type = :link_type, "
                        " directed = :directed, label = :label WHERE id = :id"
                    ),
                    {
                        "link_type": link_type_marker.get("linkType"),
                        "directed": link_type_marker.get("directed"),
                        "label": link_type_marker.get("label"),
                        "id": link["id"],
                    },
                )
            conn.execute(
                sa.text("UPDATE world_links SET meta = :meta WHERE id = :id"),
                {"meta": _dump_json(meta), "id": link["id"]},
            )

    _restore_link_kinds(conn)


def downgrade() -> None:
    """只撤本次写入：新建的边、kind / level / customFields / 图标回填、config 合并与等级改写。

    不删旧 item、不动 `color` 与 emoji 图标原值；用户在后迁移期改过的值一律保留。
    """

    conn = op.get_bind()
    _downgrade_links(conn)
    _downgrade_submodules(conn)
    _downgrade_module_config(conn)
