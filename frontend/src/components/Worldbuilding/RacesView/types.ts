/**
 * 种族模块领域类型与纯函数（Phase 3 P3-T2；races_ui_design §2/§3）
 *
 * 层级只用 parent_id（race -> subrace，最多两层）；跨族关系用 races.related_to 落 WorldLink；
 * meta 里未知字段一律保留（P3-T8 删除字段只删显式键）。
 */

import type {
  EntityRef,
  ModuleItemV2,
  SubmoduleV2,
  WorldLink,
} from '@/services/worldbuildingApi';
import {
  kindDepth,
  readMetaRecord,
  readMetaString,
  readMetaStringArray,
  type CustomFieldDef,
  type CustomFieldValue,
  type EntityTypeDef,
  type ModuleConfig,
  type RelationKindDef,
} from '../shared/moduleConfig';

export const RACES_MODULE = 'races';
export const RACE_KIND = 'race';
export const SUBRACE_KIND = 'subrace';
/** 种族层级上限（race=1、subrace=2，契约 races_ui_design §2.1） */
export const RACES_MAX_DEPTH = 2;
/** 血缘树降级阈值：> 80 节点改列表（races_ui_design §4.3） */
export const RACE_LINEAGE_LIMIT = 80;
/** 图鉴网格虚拟滚动阈值（races_ui_design §11） */
export const RACE_CARD_VIRTUAL_LIMIT = 200;

export const RACE_KINDS: EntityTypeDef[] = [
  { id: RACE_KIND, label: '种族', icon: 'book-marked', color: 'teal' },
  {
    id: SUBRACE_KIND,
    label: '亚种',
    icon: 'sprout',
    color: 'teal',
    parentKind: RACE_KIND,
  },
];

/** 图鉴长文 item（races_ui_design §3.3） */
export interface AtlasItemDef {
  name: string;
  label: string;
  fields: CustomFieldDef[];
}

export const RACE_ATLAS_ITEMS: AtlasItemDef[] = [
  {
    name: 'atlas.profile',
    label: '生理档案',
    fields: [
      { id: 'appearance', label: '外貌', type: 'textarea' },
      { id: 'lifespan', label: '寿命', type: 'text' },
      { id: 'reproduction', label: '繁衍', type: 'textarea' },
      { id: 'diet', label: '食性', type: 'text' },
    ],
  },
  {
    name: 'atlas.culture',
    label: '文化与社会',
    fields: [
      { id: 'culture', label: '文化', type: 'textarea' },
      { id: 'language', label: '语言', type: 'text' },
      { id: 'custom', label: '习俗', type: 'textarea' },
    ],
  },
  {
    name: 'atlas.talents',
    label: '天赋文本',
    fields: [
      { id: 'talents', label: '天赋', type: 'textarea' },
      { id: 'limits', label: '限制', type: 'textarea' },
    ],
  },
  {
    name: 'atlas.origins',
    label: '历史渊源',
    fields: [
      { id: 'summary', label: '摘要', type: 'text' },
      { id: 'body', label: '正文', type: 'textarea' },
    ],
  },
];

export interface RaceEmblem {
  icon?: string;
  color?: string;
  motif?: string;
}

export interface RaceMeta {
  tagline?: string;
  traits: string[];
  habitatText?: string;
  originText?: string;
  emblem?: RaceEmblem;
  status?: string;
  customFields: Record<string, CustomFieldValue>;
  /** 原始 meta：写回时作为合并基底，未知字段不丢 */
  raw: Record<string, unknown>;
}

export const readRaceMeta = (meta: unknown): RaceMeta => {
  const emblem = readMetaRecord(meta, 'emblem');
  const customFields = readMetaRecord(meta, 'customFields');
  return {
    tagline: readMetaString(meta, 'tagline'),
    traits: readMetaStringArray(meta, 'traits'),
    habitatText: readMetaString(meta, 'habitatText'),
    originText: readMetaString(meta, 'originText'),
    emblem: emblem
      ? {
          icon: typeof emblem.icon === 'string' ? emblem.icon : undefined,
          color: typeof emblem.color === 'string' ? emblem.color : undefined,
          motif: typeof emblem.motif === 'string' ? emblem.motif : undefined,
        }
      : undefined,
    status: readMetaString(meta, 'status'),
    customFields: (customFields as Record<string, CustomFieldValue>) ?? {},
    raw: (meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}),
  };
};

export interface RaceNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  orderIndex: number;
  meta: RaceMeta;
  submodule: SubmoduleV2;
  ref: EntityRef;
  children: RaceNode[];
}

export const raceRefOf = (id: string, kind: string = RACE_KIND): EntityRef => ({
  module: RACES_MODULE,
  kind,
  id,
});

/** 种族模块内的实体（race / subrace / 自定义族裔 kind） */
export const isRaceEntityRef = (ref?: EntityRef | null): boolean =>
  !!ref &&
  ref.module === RACES_MODULE &&
  ref.kind !== 'item';

export interface LineageCrossEdge {
  link: WorldLink;
  sourceId: string;
  targetId: string;
  relationKind: string;
}

export interface LineageModel {
  /** 顶层节点（parent_id 为空） */
  roots: RaceNode[];
  /** 所有节点（含子级），按层级展开 */
  nodes: RaceNode[];
  nodeCount: number;
  /** 超过阈值时降级为分组列表 */
  degraded: boolean;
  /** 跨族关系边（races.related_to） */
  crossEdges: LineageCrossEdge[];
}

export const DEFAULT_RACE_RELATION_KINDS: RelationKindDef[] = [
  { id: 'bloodline', label: '血缘', color: 'emerald', lineStyle: 'double' },
  { id: 'origin', label: '渊源', color: 'teal', lineStyle: 'double' },
  { id: 'hostility', label: '敌对', color: 'rose', lineStyle: 'dashed' },
];

export const raceRelationKinds = (config: ModuleConfig): RelationKindDef[] => {
  const configured = config.relationKinds;
  return Array.isArray(configured) && configured.length > 0
    ? configured
    : DEFAULT_RACE_RELATION_KINDS;
};

/** 边的语义分色：link.meta.relationKind 缺省为第一条 relationKind */
export const relationKindOfEdge = (
  link: WorldLink,
  relationKinds: RelationKindDef[]
): string => {
  const raw = readMetaString(link.meta, 'relationKind');
  if (raw) return raw;
  return relationKinds[0]?.id ?? 'bloodline';
};

export const relationKindDef = (
  id: string,
  relationKinds: RelationKindDef[]
): RelationKindDef =>
  relationKinds.find((item) => item.id === id) ?? {
    id,
    label: id,
    color: 'slate',
    lineStyle: 'dashed',
  };

export const shouldDegradeLineage = (nodeCount: number): boolean =>
  nodeCount > RACE_LINEAGE_LIMIT;

/**
 * submodule -> RaceNode 树（只说 parent_id，不建关联）
 *
 * 层级只有两层（RACES_MAX_DEPTH / races_ui_design §2：第三层族裔不存在），
 * 所以 parent_id 链路里出现自指、成环、或层级 > 2 时整条链视为不可信：
 * 该节点一律接回 roots 当第一层渲染，保证每个条目都可见、可删（Phase 3 修复：
 * 早先成环会让 roots 为空，整个模块退化成空态，成员既看不见也删不掉）。
 * 无环且不超层的常见情形与旧实现完全一致。
 */
export const buildRaceTree = (submodules: SubmoduleV2[]): RaceNode[] => {
  const sorted = [...submodules].sort(
    (a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id)
  );
  const byId = new Map<string, RaceNode>();
  for (const submodule of sorted) {
    byId.set(submodule.id, {
      id: submodule.id,
      name: submodule.name,
      kind: submodule.kind || RACE_KIND,
      description: submodule.description ?? undefined,
      color: submodule.color ?? undefined,
      icon: submodule.icon ?? undefined,
      parentId: submodule.parent_id ?? undefined,
      orderIndex: submodule.order_index,
      meta: readRaceMeta(submodule.meta),
      submodule,
      ref: raceRefOf(submodule.id, submodule.kind || RACE_KIND),
      children: [],
    });
  }
  /** 能否作为子级挂到父级：parent_id 链路无自指/环，且层级不超过 RACES_MAX_DEPTH */
  const canNest = (node: RaceNode): boolean => {
    const visited = new Set<string>([node.id]);
    let level = 1;
    let cursor = node.parentId ? byId.get(node.parentId) : undefined;
    while (cursor) {
      if (visited.has(cursor.id)) return false;
      level += 1;
      if (level > RACES_MAX_DEPTH) return false;
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return true;
  };
  const roots: RaceNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && canNest(node)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
};

export const flattenRaceTree = (roots: RaceNode[]): RaceNode[] => {
  const all: RaceNode[] = [];
  const walk = (nodes: RaceNode[]) => {
    for (const node of nodes) {
      all.push(node);
      walk(node.children);
    }
  };
  walk(roots);
  return all;
};

export const buildLineage = (
  submodules: SubmoduleV2[],
  links: WorldLink[],
  config: ModuleConfig
): LineageModel => {
  const roots = buildRaceTree(submodules);
  const nodes = flattenRaceTree(roots);
  const inTree = new Set(nodes.map((node) => node.id));
  const relationKinds = raceRelationKinds(config);

  const crossEdges: LineageCrossEdge[] = [];
  /** 无序端点对去重：对称关联（A-B 与 B-A）落库两行时只保留一条，避免同一对边画两次 */
  const seenPairs = new Set<string>();
  for (const link of links) {
    if (link.link_type !== 'races.related_to') continue;
    if (link.source.module !== RACES_MODULE || link.target.module !== RACES_MODULE) continue;
    if (!inTree.has(link.source.id) || !inTree.has(link.target.id)) continue;
    const pairKey = `${link.link_type}|${[link.source.id, link.target.id].sort().join('|')}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    crossEdges.push({
      link,
      sourceId: link.source.id,
      targetId: link.target.id,
      relationKind: relationKindOfEdge(link, relationKinds),
    });
  }

  return {
    roots,
    nodes,
    nodeCount: nodes.length,
    degraded: shouldDegradeLineage(nodes.length),
    crossEdges,
  };
};

/** 拖拽换父级前的环路校验：新父级不能是自身或自己的后代 */
export const canReparent = (
  nodes: RaceNode[],
  childId: string,
  nextParentId: string | null
): boolean => {
  if (!nextParentId) return true;
  if (nextParentId === childId) return false;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let cursor = byId.get(nextParentId);
  const visited = new Set<string>();
  while (cursor) {
    if (cursor.id === childId) return false;
    if (visited.has(cursor.id)) return false;
    visited.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return true;
};

/** 支系只能挂在第一层（race 或自定义根 kind）下，第三层不出现 */
export const canOwnSubrace = (
  config: ModuleConfig,
  kind: string,
  kinds: EntityTypeDef[]
): boolean => kindDepth(config, kind, kinds) <= 1;

export const atlasItemOf = (
  items: ModuleItemV2[],
  submoduleId: string,
  name: string
): ModuleItemV2 | undefined =>
  items.find((item) => item.submodule_id === submoduleId && item.name === name);

export const atlasContentOf = (
  items: ModuleItemV2[],
  submoduleId: string,
  name: string
): Record<string, unknown> => atlasItemOf(items, submoduleId, name)?.content ?? {};

/** 种族出链白名单（仅用于 UI 分组/提示，不新增契约类型） */
export const RACES_OUTGOING_LINK_TYPES = [
  'races.inhabits',
  'races.origin_at',
  'races.related_to',
  'races.notable_figure',
  'races.affinity_with',
  'races.specialty',
  'races.prefers',
];

/** 种族入链（其它模块指向种族）：用于入链区语义提示，渲染仍以 LinkPanel 为准 */
export const RACES_INCOMING_LINK_TYPES = [
  'character.belongs_to_race',
  'politics.includes_race',
  'history.involves',
  'history.milestone_of',
];
