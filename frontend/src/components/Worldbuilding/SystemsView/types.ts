/**
 * 体系模块领域类型与纯函数（Phase 3 P3-T5；systems_ui_design §2/§3）
 *
 * 归属与复用分离：全部节点 parent_id 指向 system；ability/rule/cost 通过
 * systems.grants / systems.costs 挂到阶位，因此同一节点可被多个阶位复用。
 * 排序只看 TierMeta.rank（渲染前归一化），advances_to / requires 做环路检测。
 */

import type {
  EntityRef,
  ModuleItemV2,
  SubmoduleV2,
  WorldLink,
} from '@/services/worldbuildingApi';
import {
  readMetaBoolean,
  readMetaNumber,
  readMetaRecord,
  readMetaString,
  type CustomFieldDef,
  type CustomFieldValue,
  type EntityTypeDef,
} from '../shared/moduleConfig';

export const SYSTEMS_MODULE = 'systems';
export const SYSTEM_KIND = 'system';
export const TIER_KIND = 'tier';
export const ABILITY_KIND = 'ability';
export const RULE_KIND = 'rule';
export const COST_KIND = 'cost';

/** 体系层级上限：module -> system -> tier/节点 -> 自定义（systems_ui_design §2.5） */
export const SYSTEMS_MAX_DEPTH = 3;
/** 阶梯降级阈值：> 300 节点只渲染视口内（systems_ui_design §11） */
export const SYSTEM_NODE_LIMIT = 300;
export const DEFAULT_RANK_STEP = 10;

export const SYSTEM_KINDS: EntityTypeDef[] = [
  { id: SYSTEM_KIND, label: '体系', icon: 'layers', color: 'violet' },
  { id: TIER_KIND, label: '阶位', icon: 'chevrons-up', color: 'violet', parentKind: SYSTEM_KIND },
  { id: ABILITY_KIND, label: '能力', icon: 'gift', color: 'purple', parentKind: SYSTEM_KIND },
  { id: RULE_KIND, label: '规则', icon: 'scroll-text', color: 'violet', parentKind: SYSTEM_KIND },
  { id: COST_KIND, label: '代价', icon: 'flame', color: 'orange', parentKind: SYSTEM_KIND },
];

/** 可复用节点 kind（挂在阶位上的 chip） */
export const SYSTEM_NODE_KINDS = [ABILITY_KIND, RULE_KIND, COST_KIND];

export interface CodexItemDef {
  name: string;
  label: string;
  fields: CustomFieldDef[];
}

/** 长文 item（systems_ui_design §3.3） */
export const SYSTEM_CODEX_ITEMS: CodexItemDef[] = [
  {
    name: 'codex.overview',
    label: '体系总述',
    fields: [
      { id: 'summary', label: '摘要', type: 'text' },
      { id: 'body', label: '正文', type: 'textarea' },
    ],
  },
  {
    name: 'codex.principle',
    label: '规则与原理',
    fields: [
      { id: 'summary', label: '摘要', type: 'text' },
      { id: 'body', label: '正文', type: 'textarea' },
    ],
  },
  {
    name: 'tier.breakthrough',
    label: '突破条件',
    fields: [
      { id: 'condition', label: '条件', type: 'textarea' },
      { id: 'examples', label: '示例', type: 'textarea' },
    ],
  },
  {
    name: 'node.detail',
    label: '节点长文',
    fields: [
      { id: 'summary', label: '摘要', type: 'text' },
      { id: 'body', label: '正文', type: 'textarea' },
      { id: 'examples', label: '示例', type: 'textarea' },
    ],
  },
];

export interface SystemMeta {
  tagline?: string;
  categoryLabel?: string;
  icon?: string;
  color?: string;
  rankDirection?: 'ascending' | 'descending';
  customFields: Record<string, CustomFieldValue>;
  raw: Record<string, unknown>;
}

export interface TierMeta {
  rank: number;
  breakthrough?: string;
  branch?: string;
  status?: string;
  customFields: Record<string, CustomFieldValue>;
  raw: Record<string, unknown>;
}

export interface SystemNodeMeta {
  nodeType: string;
  summary?: string;
  reusable: boolean;
  magnitude?: string;
  costHint?: string;
  customFields: Record<string, CustomFieldValue>;
  raw: Record<string, unknown>;
}

const customFieldsOf = (meta: unknown): Record<string, CustomFieldValue> =>
  (readMetaRecord(meta, 'customFields') as Record<string, CustomFieldValue>) ?? {};

export const readSystemMeta = (meta: unknown): SystemMeta => ({
  tagline: readMetaString(meta, 'tagline'),
  categoryLabel: readMetaString(meta, 'categoryLabel'),
  icon: readMetaString(meta, 'icon'),
  color: readMetaString(meta, 'color'),
  rankDirection:
    readMetaString(meta, 'rankDirection') === 'descending' ? 'descending' : 'ascending',
  customFields: customFieldsOf(meta),
  raw: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {},
});

export const readTierMeta = (meta: unknown, fallbackRank = 0): TierMeta => ({
  rank: readMetaNumber(meta, 'rank') ?? fallbackRank,
  breakthrough: readMetaString(meta, 'breakthrough'),
  branch: readMetaString(meta, 'branch'),
  status: readMetaString(meta, 'status'),
  customFields: customFieldsOf(meta),
  raw: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {},
});

export const readSystemNodeMeta = (meta: unknown, kind: string): SystemNodeMeta => ({
  nodeType: readMetaString(meta, 'nodeType') ?? kind,
  summary: readMetaString(meta, 'summary'),
  reusable: readMetaBoolean(meta, 'reusable') ?? true,
  magnitude: readMetaString(meta, 'magnitude'),
  costHint: readMetaString(meta, 'costHint'),
  customFields: customFieldsOf(meta),
  raw: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {},
});

export interface SystemNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  orderIndex: number;
  systemMeta: SystemMeta;
  tierMeta: TierMeta;
  nodeMeta: SystemNodeMeta;
  submodule: SubmoduleV2;
  ref: EntityRef;
}

export interface SystemEntity {
  id: string;
  name: string;
  meta: SystemMeta;
  node: SystemNode;
  ref: EntityRef;
  /** 阶位（按 rank 归一化后排序） */
  tiers: SystemNode[];
  /** ability / rule / cost 等可复用节点 */
  members: SystemNode[];
  nodeCount: number;
  degraded: boolean;
}

export const systemRefOf = (id: string, kind: string = SYSTEM_KIND): EntityRef => ({
  module: SYSTEMS_MODULE,
  kind,
  id,
});

export const isSystemEntityRef = (ref?: EntityRef | null): boolean =>
  !!ref && ref.module === SYSTEMS_MODULE && ref.kind !== 'item';

/**
 * 阶位判定：内置 tier，或声明了 meta.rank 的自定义 kind
 * （自定义 kind 必须 parentKind=system，语义由用户决定，不做预设）
 */
export const isTierNode = (node: SystemNode): boolean =>
  node.kind === TIER_KIND ||
  (node.kind.startsWith('custom_') && readMetaNumber(node.submodule.meta, 'rank') !== undefined);

export const toSystemNode = (submodule: SubmoduleV2): SystemNode => {
  const kind = submodule.kind || SYSTEM_KIND;
  return {
    id: submodule.id,
    name: submodule.name,
    kind,
    description: submodule.description ?? undefined,
    icon: submodule.icon ?? undefined,
    color: submodule.color ?? undefined,
    parentId: submodule.parent_id ?? undefined,
    orderIndex: submodule.order_index,
    systemMeta: readSystemMeta(submodule.meta),
    tierMeta: readTierMeta(submodule.meta, submodule.order_index),
    nodeMeta: readSystemNodeMeta(submodule.meta, kind),
    submodule,
    ref: systemRefOf(submodule.id, kind),
  };
};

/**
 * rank 归一化：先算「生效 rank」——有限且 > 0 的 rank 保留原值（用户可用 10/20/30 留插入空间），
 * 缺失 / 0 / 非有限值（NaN、Infinity）按排序位置补 (index + 1) * step；
 * 再在生效值上查重：一旦重复就整体重排为 (index + 1) * step，保证 rank 唯一
 * （阶梯顺序、上移/下移与典卷 data-rank 都依赖唯一值）。
 */
export const normalizeTierRanks = (
  tiers: SystemNode[],
  step: number = DEFAULT_RANK_STEP
): Map<string, number> => {
  const sorted = [...tiers].sort(
    (a, b) =>
      a.tierMeta.rank - b.tierMeta.rank ||
      a.orderIndex - b.orderIndex ||
      a.id.localeCompare(b.id)
  );
  // 补位必须与查重使用同一组「生效值」，否则 rank=0 补位后可能与既有 rank 撞车
  const effective = sorted.map((tier) => {
    const rank = tier.tierMeta.rank;
    // 非法值先占位 0，下一轮按排序位置补 (index + 1) * step
    return Number.isFinite(rank) && rank > 0 ? rank : 0;
  });
  const seen = new Set<number>();
  let duplicated = false;
  effective.forEach((rank, index) => {
    const value = rank === 0 ? (index + 1) * step : rank;
    effective[index] = value;
    if (seen.has(value)) duplicated = true;
    seen.add(value);
  });
  const map = new Map<string, number>();
  sorted.forEach((tier, index) => {
    map.set(tier.id, duplicated ? (index + 1) * step : effective[index]);
  });
  return map;
};

export const sortTiersByRank = (
  tiers: SystemNode[],
  ranks: Map<string, number>,
  direction: 'ascending' | 'descending' = 'ascending'
): SystemNode[] => {
  const sorted = [...tiers].sort(
    (a, b) =>
      (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0) ||
      a.orderIndex - b.orderIndex ||
      a.id.localeCompare(b.id)
  );
  return direction === 'descending' ? sorted.reverse() : sorted;
};

/** 下一个阶位 rank：现有最大 rank + step（空体系为 step） */
export const nextRankOf = (tiers: SystemNode[], step: number = DEFAULT_RANK_STEP): number =>
  tiers.length === 0
    ? step
    : Math.max(...tiers.map((tier) => tier.tierMeta.rank)) + step;

export interface StairEdge {
  link: WorldLink;
  /** link_type 去掉 systems. / character. 前缀后的短名 */
  type: string;
  sourceId: string;
  targetId: string;
  /** 对端不属于本体系（如代价指向经济资源） */
  external: boolean;
}

export interface StairModel {
  tiers: SystemNode[];
  members: SystemNode[];
  edges: StairEdge[];
  /** tierId -> 归一化后的 rank */
  ranks: Map<string, number>;
  nodeCount: number;
  degraded: boolean;
}

export const buildStair = (
  nodes: SystemNode[],
  links: WorldLink[],
  systemId: string,
  step: number = DEFAULT_RANK_STEP,
  direction: 'ascending' | 'descending' = 'ascending'
): StairModel => {
  const inSystem = nodes.filter((node) => node.parentId === systemId || node.id === systemId);
  const ids = new Set(inSystem.map((node) => node.id));
  const tiers = inSystem.filter(isTierNode);
  const ranks = normalizeTierRanks(tiers, step);
  const members = inSystem.filter(
    (node) => node.kind !== SYSTEM_KIND && !isTierNode(node)
  );

  const edges: StairEdge[] = [];
  for (const link of links) {
    if (!link.link_type.startsWith('systems.')) continue;
    const sourceInside = ids.has(link.source.id) || link.source.id === systemId;
    const targetInside = ids.has(link.target.id) || link.target.id === systemId;
    if (!sourceInside && !targetInside) continue;
    edges.push({
      link,
      type: link.link_type.slice('systems.'.length),
      sourceId: link.source.id,
      targetId: link.target.id,
      external: !sourceInside || !targetInside,
    });
  }

  return {
    tiers: sortTiersByRank(tiers, ranks, direction),
    members,
    edges,
    ranks,
    nodeCount: inSystem.length,
    degraded: inSystem.length > SYSTEM_NODE_LIMIT,
  };
};

/** 典卷一阶一卷：按 rank 排列，卷内为突破条件 -> 赋予 -> 规则 -> 代价 -> 关联摘要 */
export interface CodexVolume {
  tier: SystemNode;
  rank: number;
  breakthrough?: string;
  abilities: SystemNode[];
  rules: SystemNode[];
  costs: SystemNode[];
  /** 该阶位的关联总数（批量计数） */
  linkCount: number;
}

export const buildCodexVolumes = (
  stair: StairModel,
  countOf: (nodeId: string) => number,
  breakthroughOf?: (tier: SystemNode) => string | undefined
): CodexVolume[] => {
  const byId = new Map(stair.members.map((node) => [node.id, node]));
  return stair.tiers.map((tier) => {
    const granted = stair.edges
      .filter((edge) => edge.type === 'grants' && edge.sourceId === tier.id)
      .map((edge) => byId.get(edge.targetId))
      .filter((node): node is SystemNode => !!node);
    // costs 边的合法目标是经济资源（体系外，byId 解析不到），因此体系内代价节点
    // 实际是通过 grants 指向 cost kind 建立的——两路都要收，否则卷内「代价」永远为空
    const edgeCosts = stair.edges
      .filter((edge) => edge.type === 'costs' && edge.sourceId === tier.id)
      .map((edge) => byId.get(edge.targetId))
      .filter((node): node is SystemNode => !!node);
    const costMembers = granted.filter((node) => node.kind === COST_KIND);
    const costs = [...edgeCosts, ...costMembers].filter(
      (node, index, all) => all.findIndex((item) => item.id === node.id) === index
    );
    return {
      tier,
      rank: stair.ranks.get(tier.id) ?? tier.tierMeta.rank,
      breakthrough: breakthroughOf?.(tier) ?? tier.tierMeta.breakthrough,
      abilities: granted.filter((node) => node.kind === ABILITY_KIND),
      rules: granted.filter((node) => node.kind === RULE_KIND),
      costs,
      linkCount: countOf(tier.id),
    };
  });
};

export const shouldDegradeStair = (nodeCount: number): boolean =>
  nodeCount > SYSTEM_NODE_LIMIT;

/** 加边前的环路检测（advances_to / requires）：target 能回到 source 即成环 */
export const wouldCreateStairCycle = (
  edges: { sourceId: string; targetId: string }[],
  sourceId: string,
  targetId: string
): boolean => {
  if (sourceId === targetId) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const bucket = outgoing.get(edge.sourceId);
    if (bucket) {
      bucket.push(edge.targetId);
    } else {
      outgoing.set(edge.sourceId, [edge.targetId]);
    }
  }
  const stack = [targetId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
};

/** 可复用标记：同一节点被其它阶位通过 grants / costs 引用时提示复用 */
export const grantSourcesOf = (
  edges: StairEdge[],
  nodeId: string
): StairEdge[] =>
  edges.filter(
    (edge) => edge.targetId === nodeId && (edge.type === 'grants' || edge.type === 'costs')
  );

export const codexContentOf = (
  items: ModuleItemV2[],
  submoduleId: string,
  name: string
): Record<string, unknown> =>
  items.find((item) => item.submodule_id === submoduleId && item.name === name)?.content ?? {};

/** 体系内部与跨模块出链白名单（仅用于 UI 分组/提示） */
export const SYSTEMS_OUTGOING_LINK_TYPES = [
  'systems.advances_to',
  'systems.requires',
  'systems.grants',
  'systems.costs',
  'systems.practiced_by',
  'systems.enables',
  'systems.countered_by',
];

export const SYSTEMS_INCOMING_LINK_TYPES = [
  'character.practices_system',
  'character.attained',
  'races.affinity_with',
  'history.involves',
  'history.milestone_of',
];

/** 阶梯内连线类型（advances_to 主路径 / requires 前置 / countered_by 克制） */
export const STAIR_LINK_TYPES = ['advances_to', 'requires', 'countered_by'];
