"""跨模块关联类型注册表（核心集）。

数据来源：docs/worldbuilding/cross_module_link_design.md 第 4 节「关联类型注册表（核心集）」。
共 54 条核心关联类型，顺序与文档表格一致；politics.treaty_between 已废弃，不在此注册。
本模块只提供静态契约与校验，不做任何数据库访问，也不含任何 UI 逻辑。
"""

from __future__ import annotations

from dataclasses import dataclass

# (module, kind)；kind 为 "*" 表示该模块下的任意 kind。
KindRef = tuple[str, str]


@dataclass(frozen=True)
class LinkTypeDef:
    """单个关联类型的契约定义（对应文档 4.x 表格中的一行）。"""

    id: str
    label: str
    reverse_label: str
    directed: bool
    icon: str
    color: str
    line_style: str
    group: str
    source: frozenset[KindRef] | None
    target: frozenset[KindRef] | None


# ---------------------------------------------------------------------------
# 规范 kind 词表：文档 4.x 表格里的中文描述 -> (module, kind)
# ---------------------------------------------------------------------------

_MAP_ANY: KindRef = ("map", "*")  # 地图地区 / 地点 / 领土 / 聚居地
_POLITY: KindRef = ("politics", "polity")  # 政权
_ORGANIZATION: KindRef = ("politics", "organization")  # 组织
_FIGURE: KindRef = ("politics", "figure")  # 政治人物
_TREATY: KindRef = ("politics", "treaty")  # 条约
_EVENT: KindRef = ("history", "event")  # 历史事件
_ERA: KindRef = ("history", "era")  # 时代
_ECONOMY_ANY: KindRef = ("economy", "*")  # 经济实体（未指明具体 kind）
_RESOURCE: KindRef = ("economy", "resource")  # 资源
_GOOD: KindRef = ("economy", "good")  # 商品
_INDUSTRY: KindRef = ("economy", "industry")  # 产业
_MARKET: KindRef = ("economy", "market")  # 市场
_CURRENCY: KindRef = ("economy", "currency")  # 货币
_ACTOR: KindRef = ("economy", "actor")  # 经济行为体
_INSTITUTION: KindRef = ("economy", "institution")  # 经济机构
_RACE: KindRef = ("races", "race")  # 种族
_SUBRACE: KindRef = ("races", "subrace")  # 亚种
_SYSTEM: KindRef = ("systems", "system")  # 体系
_SYSTEM_ANY: KindRef = ("systems", "*")  # 体系节点（未指明具体 kind）
_TIER: KindRef = ("systems", "tier")  # 境界层级
_ABILITY: KindRef = ("systems", "ability")  # 能力
_CHARACTER: KindRef = ("character", "character")  # 全局角色


# ---------------------------------------------------------------------------
# 关联类型定义（顺序 = 文档 4.1 -> 4.7）
# ---------------------------------------------------------------------------

LINK_TYPES: tuple[LinkTypeDef, ...] = (
    # 4.1 通用
    LinkTypeDef(
        id="core.references",
        label="引用",
        reverse_label="被引用",
        directed=True,
        icon="link",
        color="slate",
        line_style="dotted",
        group="core",
        source=None,
        target=None,
    ),
    LinkTypeDef(
        id="core.related_to",
        label="相关",
        reverse_label="相关",
        directed=False,
        icon="git-branch",
        color="slate",
        line_style="dotted",
        group="core",
        source=None,
        target=None,
    ),
    LinkTypeDef(
        id="custom.link",
        label="自定义关联",
        reverse_label="自定义关联",
        directed=True,
        icon="link-2",
        color="slate",
        line_style="dashed",
        group="core",
        source=None,
        target=None,
    ),
    # 4.2 历史
    LinkTypeDef(
        id="history.occurs_at",
        label="发生于",
        reverse_label="发生事件",
        directed=True,
        icon="map-pin",
        color="blue",
        line_style="solid",
        group="history",
        source=frozenset({_EVENT, _ERA}),
        target=frozenset({_MAP_ANY, _POLITY, _MARKET}),
    ),
    LinkTypeDef(
        id="history.involves",
        label="涉及",
        reverse_label="被涉及",
        directed=True,
        icon="users",
        color="amber",
        line_style="solid",
        group="history",
        source=frozenset({_EVENT, _ERA}),
        target=frozenset(
            {
                _POLITY,
                _ORGANIZATION,
                _FIGURE,
                _CHARACTER,
                _RACE,
                _SYSTEM,
                _ECONOMY_ANY,
            }
        ),
    ),
    LinkTypeDef(
        id="history.causes",
        label="导致",
        reverse_label="由该事件导致",
        directed=True,
        icon="arrow-right-circle",
        color="orange",
        line_style="solid",
        group="history",
        source=frozenset({_EVENT}),
        target=frozenset({_EVENT, _POLITY, _ORGANIZATION, _ECONOMY_ANY, _SYSTEM_ANY}),
    ),
    LinkTypeDef(
        id="history.caused_by",
        label="起因于",
        reverse_label="引发了",
        directed=True,
        icon="undo-2",
        color="orange",
        line_style="dashed",
        group="history",
        source=frozenset({_EVENT}),
        target=None,
    ),
    LinkTypeDef(
        id="history.milestone_of",
        label="大事记",
        reverse_label="收录大事记",
        directed=True,
        icon="flag",
        color="amber",
        line_style="solid",
        group="history",
        source=frozenset({_EVENT, _ERA}),
        target=frozenset({_POLITY, _RACE, _SYSTEM, _ORGANIZATION}),
    ),
    # 4.3 政治
    LinkTypeDef(
        id="politics.controls_region",
        label="控制领土",
        reverse_label="被控制",
        directed=True,
        icon="map",
        color="gold",
        line_style="solid",
        group="politics",
        source=frozenset({_POLITY}),
        target=frozenset({_MAP_ANY}),
    ),
    LinkTypeDef(
        id="politics.capital_at",
        label="首府位于",
        reverse_label="首府",
        directed=True,
        icon="landmark",
        color="gold",
        line_style="solid",
        group="politics",
        source=frozenset({_POLITY}),
        target=frozenset({_MAP_ANY}),
    ),
    LinkTypeDef(
        id="politics.member_of",
        label="效忠/隶属",
        reverse_label="拥有成员",
        directed=True,
        icon="users-round",
        color="red",
        line_style="solid",
        group="politics",
        source=frozenset({_FIGURE, _ORGANIZATION}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="politics.leads",
        label="领导",
        reverse_label="被领导",
        directed=True,
        icon="crown",
        color="red",
        line_style="solid",
        group="politics",
        source=frozenset({_FIGURE}),
        target=frozenset({_POLITY, _ORGANIZATION, _TREATY}),
    ),
    LinkTypeDef(
        id="politics.founded_by",
        label="建立者",
        reverse_label="建立",
        directed=True,
        icon="hammer",
        color="red",
        line_style="dashed",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_FIGURE, _CHARACTER}),
    ),
    LinkTypeDef(
        id="politics.subordinate_to",
        label="下属于",
        reverse_label="下辖",
        directed=True,
        icon="corner-down-right",
        color="red",
        line_style="solid",
        group="politics",
        source=frozenset({_ORGANIZATION}),
        target=frozenset({_ORGANIZATION, _POLITY}),
    ),
    LinkTypeDef(
        id="politics.signatory_of",
        label="签署/加入",
        reverse_label="签署方",
        directed=True,
        icon="pen-line",
        color="green",
        line_style="solid",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_TREATY}),
    ),
    LinkTypeDef(
        id="politics.includes_race",
        label="民族/种族构成",
        reverse_label="构成",
        directed=True,
        icon="users",
        color="teal",
        line_style="dashed",
        group="politics",
        source=frozenset({_POLITY}),
        target=frozenset({_RACE, _SUBRACE}),
    ),
    LinkTypeDef(
        id="politics.ally_of",
        label="同盟",
        reverse_label="同盟",
        directed=False,
        icon="handshake",
        color="emerald",
        line_style="solid",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="politics.at_war_with",
        label="敌对/战争",
        reverse_label="敌对/战争",
        directed=False,
        icon="swords",
        color="red",
        line_style="double",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="politics.vassal_of",
        label="附庸于",
        reverse_label="宗主",
        directed=True,
        icon="chevron-down",
        color="amber",
        line_style="dashed",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="politics.trades_with",
        label="贸易往来",
        reverse_label="贸易往来",
        directed=False,
        icon="arrow-left-right",
        color="blue",
        line_style="solid",
        group="politics",
        source=frozenset({_POLITY, _ORGANIZATION}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="politics.marriage_tie",
        label="联姻",
        reverse_label="联姻",
        directed=False,
        icon="heart-handshake",
        color="pink",
        line_style="double",
        group="politics",
        source=frozenset({_FIGURE}),
        target=frozenset({_FIGURE}),
    ),
    LinkTypeDef(
        id="politics.succeeds",
        label="继承",
        reverse_label="前任",
        directed=True,
        icon="arrow-right",
        color="red",
        line_style="dashed",
        group="politics",
        source=frozenset({_FIGURE}),
        target=frozenset({_FIGURE}),
    ),
    # 4.4 经济
    LinkTypeDef(
        id="economy.produces",
        label="生产",
        reverse_label="被生产",
        directed=True,
        icon="factory",
        color="green",
        line_style="solid",
        group="economy",
        source=frozenset({_INDUSTRY}),
        target=frozenset({_GOOD}),
    ),
    LinkTypeDef(
        id="economy.consumes",
        label="消耗",
        reverse_label="被消耗",
        directed=True,
        icon="package-minus",
        color="green",
        line_style="solid",
        group="economy",
        source=frozenset({_INDUSTRY}),
        target=frozenset({_RESOURCE, _GOOD}),
    ),
    LinkTypeDef(
        id="economy.requires",
        label="依赖",
        reverse_label="被依赖",
        directed=True,
        icon="git-branch",
        color="teal",
        line_style="dashed",
        group="economy",
        source=frozenset({_INDUSTRY, _GOOD}),
        target=frozenset({_RESOURCE, _GOOD}),
    ),
    LinkTypeDef(
        id="economy.traded_at",
        label="交易于",
        reverse_label="交易于此",
        directed=True,
        icon="store",
        color="green",
        line_style="solid",
        group="economy",
        source=frozenset({_GOOD, _RESOURCE}),
        target=frozenset({_MARKET}),
    ),
    # 文档线型列标注「solid（线宽 = 流量）」，线宽属于视觉层，这里只保留线型。
    LinkTypeDef(
        id="economy.flows_to",
        label="流通至",
        reverse_label="自该地流入",
        directed=True,
        icon="route",
        color="cyan",
        line_style="solid",
        group="economy",
        source=frozenset({_MARKET}),
        target=frozenset({_MARKET}),
    ),
    LinkTypeDef(
        id="economy.currency_of",
        label="流通货币",
        reverse_label="通行货币为",
        directed=True,
        icon="coins",
        color="yellow",
        line_style="solid",
        group="economy",
        source=frozenset({_CURRENCY}),
        target=frozenset({_POLITY, _MARKET, _ORGANIZATION, _ACTOR, _INSTITUTION}),
    ),
    LinkTypeDef(
        id="economy.owned_by",
        label="归属/控制",
        reverse_label="拥有/控制",
        directed=True,
        icon="key-round",
        color="lime",
        line_style="solid",
        group="economy",
        source=frozenset({_INDUSTRY, _MARKET, _RESOURCE}),
        target=frozenset({_POLITY, _ORGANIZATION, _CHARACTER, _ACTOR, _INSTITUTION}),
    ),
    LinkTypeDef(
        id="economy.regulated_by",
        label="受管制",
        reverse_label="管制",
        directed=True,
        icon="gavel",
        color="amber",
        line_style="dashed",
        group="economy",
        source=frozenset({_ECONOMY_ANY}),
        target=frozenset({_POLITY, _TREATY}),
    ),
    LinkTypeDef(
        id="economy.taxed_by",
        label="征税",
        reverse_label="征税于",
        directed=True,
        icon="landmark",
        color="amber",
        line_style="dotted",
        group="economy",
        source=frozenset({_MARKET, _INDUSTRY}),
        target=frozenset({_POLITY}),
    ),
    LinkTypeDef(
        id="economy.located_in",
        label="位于",
        reverse_label="包含",
        directed=True,
        icon="map-pin",
        color="blue",
        line_style="solid",
        group="economy",
        source=frozenset({_ECONOMY_ANY}),
        target=frozenset({_MAP_ANY}),
    ),
    # 文档线型列标注「solid（线宽 = 流量）」，线宽属于视觉层，这里只保留线型。
    LinkTypeDef(
        id="economy.supplies",
        label="供给",
        reverse_label="由该方供给",
        directed=True,
        icon="truck",
        color="green",
        line_style="solid",
        group="economy",
        source=frozenset({_MARKET, _INDUSTRY, _ACTOR}),
        target=frozenset({_POLITY, _ORGANIZATION, _MARKET, _INDUSTRY, _ACTOR}),
    ),
    LinkTypeDef(
        id="economy.era_context",
        label="对应时代",
        reverse_label="对应经济周期",
        directed=True,
        icon="calendar-range",
        color="cyan",
        line_style="dashed",
        group="economy",
        source=frozenset({_ECONOMY_ANY}),
        target=frozenset({_ERA, _EVENT}),
    ),
    # 4.5 种族
    LinkTypeDef(
        id="races.inhabits",
        label="聚居",
        reverse_label="有该族聚居",
        directed=True,
        icon="map-pin",
        color="teal",
        line_style="solid",
        group="races",
        source=frozenset({_RACE, _SUBRACE}),
        target=frozenset({_MAP_ANY}),
    ),
    LinkTypeDef(
        id="races.origin_at",
        label="起源于",
        reverse_label="是起源地",
        directed=True,
        icon="sprout",
        color="teal",
        line_style="dashed",
        group="races",
        source=frozenset({_RACE}),
        target=frozenset({_MAP_ANY}),
    ),
    LinkTypeDef(
        id="races.related_to",
        label="血缘/渊源",
        reverse_label="血缘/渊源",
        directed=False,
        icon="git-merge",
        color="emerald",
        line_style="double",
        group="races",
        source=frozenset({_RACE}),
        target=frozenset({_RACE}),
    ),
    LinkTypeDef(
        id="races.notable_figure",
        label="代表人物",
        reverse_label="代表种族",
        directed=True,
        icon="user-round",
        color="teal",
        line_style="solid",
        group="races",
        source=frozenset({_RACE}),
        target=frozenset({_CHARACTER}),
    ),
    LinkTypeDef(
        id="races.affinity_with",
        label="体系亲和",
        reverse_label="亲和种族",
        directed=True,
        icon="sparkles",
        color="violet",
        line_style="dashed",
        group="races",
        source=frozenset({_RACE}),
        target=frozenset({_SYSTEM}),
    ),
    LinkTypeDef(
        id="races.specialty",
        label="特产",
        reverse_label="特产于",
        directed=True,
        icon="wheat",
        color="teal",
        line_style="dashed",
        group="races",
        source=frozenset({_RACE, _SUBRACE}),
        target=frozenset({_RESOURCE, _GOOD}),
    ),
    LinkTypeDef(
        id="races.prefers",
        label="消费偏好",
        reverse_label="受偏好",
        directed=True,
        icon="shopping-basket",
        color="teal",
        line_style="dashed",
        group="races",
        source=frozenset({_RACE, _SUBRACE}),
        target=frozenset({_GOOD, _MARKET}),
    ),
    # 该行位于文档 4.5 节，故 group 取 races；id 前缀仍是 character。
    LinkTypeDef(
        id="character.belongs_to_race",
        label="种族归属",
        reverse_label="拥有族裔",
        directed=True,
        icon="user-round",
        color="teal",
        line_style="solid",
        group="races",
        source=frozenset({_CHARACTER}),
        target=frozenset({_RACE, _SUBRACE}),
    ),
    # 4.6 体系
    LinkTypeDef(
        id="systems.advances_to",
        label="进阶",
        reverse_label="前身",
        directed=True,
        icon="arrow-up-right",
        color="violet",
        line_style="solid",
        group="systems",
        source=frozenset({_TIER}),
        target=frozenset({_TIER}),
    ),
    LinkTypeDef(
        id="systems.requires",
        label="前置",
        reverse_label="后续",
        directed=True,
        icon="lock",
        color="violet",
        line_style="dashed",
        group="systems",
        source=frozenset({_TIER, _ABILITY}),
        target=frozenset({_TIER, _ABILITY}),
    ),
    LinkTypeDef(
        id="systems.grants",
        label="赋予",
        reverse_label="由该节点赋予",
        directed=True,
        icon="gift",
        color="purple",
        line_style="solid",
        group="systems",
        source=frozenset({_TIER, _SYSTEM}),
        target=frozenset({_ABILITY}),
    ),
    LinkTypeDef(
        id="systems.costs",
        label="代价",
        reverse_label="消耗于",
        directed=True,
        icon="flame",
        color="orange",
        line_style="dashed",
        group="systems",
        source=frozenset({_ABILITY, _TIER}),
        target=frozenset({_RESOURCE, _GOOD}),
    ),
    LinkTypeDef(
        id="systems.practiced_by",
        label="修习/推行",
        reverse_label="修习者",
        directed=True,
        icon="users",
        color="violet",
        line_style="solid",
        group="systems",
        source=frozenset({_SYSTEM}),
        target=frozenset({_RACE, _ORGANIZATION, _POLITY}),
    ),
    LinkTypeDef(
        id="systems.enables",
        label="技术/能力赋能",
        reverse_label="受赋能",
        directed=True,
        icon="sparkles",
        color="violet",
        line_style="dashed",
        group="systems",
        source=frozenset({_SYSTEM, _TIER}),
        target=frozenset({_INDUSTRY, _GOOD}),
    ),
    LinkTypeDef(
        id="systems.countered_by",
        label="克制",
        reverse_label="被克制",
        directed=False,
        icon="shield",
        color="rose",
        line_style="double",
        group="systems",
        source=frozenset({_SYSTEM, _ABILITY}),
        target=frozenset({_SYSTEM, _ABILITY}),
    ),
    # 该行位于文档 4.6 节，故 group 取 systems；id 前缀仍是 character。
    LinkTypeDef(
        id="character.practices_system",
        label="修习体系",
        reverse_label="修习者",
        directed=True,
        icon="sparkles",
        color="violet",
        line_style="solid",
        group="systems",
        source=frozenset({_CHARACTER}),
        target=frozenset({_SYSTEM}),
    ),
    LinkTypeDef(
        id="character.attained",
        label="达到境界",
        reverse_label="境界达成者",
        directed=True,
        icon="chevrons-up",
        color="violet",
        line_style="solid",
        group="systems",
        source=frozenset({_CHARACTER}),
        target=frozenset({_TIER}),
    ),
    # 4.7 角色（全局人物）；该节表格未列 reverseLabel 列，按契约回退为与 label 同文本。
    LinkTypeDef(
        id="character.appears_in",
        label="登场/参与",
        reverse_label="登场/参与",
        directed=True,
        icon="book-open",
        color="slate",
        line_style="solid",
        group="character",
        source=frozenset({_CHARACTER}),
        target=frozenset({_EVENT}),
    ),
    LinkTypeDef(
        id="character.serves",
        label="效力于",
        reverse_label="效力于",
        directed=True,
        icon="briefcase",
        color="red",
        line_style="solid",
        group="character",
        source=frozenset({_CHARACTER}),
        target=frozenset({_POLITY, _ORGANIZATION}),
    ),
    LinkTypeDef(
        id="character.owns",
        label="拥有/掌控",
        reverse_label="拥有/掌控",
        directed=True,
        icon="key-round",
        color="lime",
        line_style="solid",
        group="character",
        source=frozenset({_CHARACTER}),
        target=frozenset({_ECONOMY_ANY}),
    ),
)

LINK_TYPES_BY_ID: dict[str, LinkTypeDef] = {
    link_type.id: link_type for link_type in LINK_TYPES
}

# 通用关联类型：对任意源/目标 kind 都可用。
GENERAL_LINK_TYPE_IDS: tuple[str, ...] = (
    "core.references",
    "core.related_to",
    "custom.link",
)


def get_link_type(link_type_id: str) -> LinkTypeDef | None:
    """按 id 取关联类型定义，未注册时返回 None。"""
    return LINK_TYPES_BY_ID.get(link_type_id)


def is_general_link_type(link_type_id: str) -> bool:
    """判断是否为通用关联类型（任意 kind 组合都可建链）。"""
    return link_type_id in GENERAL_LINK_TYPE_IDS


def link_type_ids() -> tuple[str, ...]:
    """按文档顺序返回全部关联类型 id。"""
    return tuple(link_type.id for link_type in LINK_TYPES)


def _match_kind(allowed: frozenset[KindRef] | None, module: str, kind: str) -> bool:
    """判断 (module, kind) 是否命中允许集合；集合内 kind 为 "*" 表示该模块任意 kind。"""
    if allowed is None:
        return True
    return (module, kind) in allowed or (module, "*") in allowed


def validate_link_type(
    link_type_id: str,
    source_module: str,
    source_kind: str,
    target_module: str,
    target_kind: str,
) -> tuple[bool, str | None]:
    """校验一条关联的源/目标 kind 是否符合关联类型契约。

    返回 (ok, error_message)；ok 为 True 时 error_message 为 None。
    """
    definition = LINK_TYPES_BY_ID.get(link_type_id)
    if definition is None:
        return False, f"未知的关联类型：{link_type_id}"
    if is_general_link_type(link_type_id):
        return True, None
    if not _match_kind(definition.source, source_module, source_kind):
        return (
            False,
            f"关联类型 {link_type_id} 不允许源实体 {source_module}.{source_kind}",
        )
    if not _match_kind(definition.target, target_module, target_kind):
        return (
            False,
            f"关联类型 {link_type_id} 不允许目标实体 {target_module}.{target_kind}",
        )
    return True, None
