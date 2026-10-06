/**
 * 世界观前端领域类型与纯函数（Phase 2 P2-T1）
 *
 * 契约类型一律从 OpenAPI 生成（services/worldbuildingApi.ts re-export），
 * 本文件只放契约之外的派生类型与纯函数，不重复定义后端已有结构。
 */

import type {
  ComplexityLevel,
  EntityRef,
  LinkTypeDef,
  ModuleItemV2,
  SubmoduleV2,
  World,
  WorldLink,
  WorldModuleV2,
} from '@/services/worldbuildingApi';

export type { ComplexityLevel, EntityRef, LinkTypeDef, World, WorldLink };
export type WorldModuleDetailV2 = WorldModuleV2;
export type Submodule = SubmoduleV2;
export type ModuleItem = ModuleItemV2;

/** 世界模块类型（契约 §2.2） */
export type ModuleType =
  | 'map'
  | 'history'
  | 'politics'
  | 'economy'
  | 'races'
  | 'systems'
  | 'special';

export const MODULE_TYPES: ModuleType[] = [
  'map',
  'history',
  'politics',
  'economy',
  'races',
  'systems',
  'special',
];

export const MODULE_LABELS: Record<ModuleType, string> = {
  map: '地图',
  history: '历史',
  politics: '政治',
  economy: '经济',
  races: '种族',
  systems: '体系',
  special: '特殊',
};

export const CHARACTER_MODULE = 'character';

/** 关联面板按模块分组的展示顺序（契约 §3） */
export const LINK_MODULE_ORDER: string[] = [
  'history',
  'politics',
  'economy',
  'races',
  'systems',
  'character',
  'map',
  'special',
];

export const moduleLabel = (module: string): string =>
  MODULE_LABELS[module as ModuleType] ?? (module === CHARACTER_MODULE ? '角色' : module);

/** 契约 §6.5 建议领域色：徽章与节点按模块着色 */
export const MODULE_COLORS: Record<string, string> = {
  history: 'amber',
  politics: 'red',
  economy: 'emerald',
  races: 'teal',
  systems: 'violet',
  character: 'slate',
  map: 'blue',
  special: 'neutral',
};

/** kind 展示名（契约 §3/§4 主要 kind；自定义 kind 直接回退原值） */
export const KIND_LABELS: Record<string, string> = {
  era: '时代',
  event: '事件',
  polity: '政权',
  organization: '组织',
  figure: '人物',
  treaty: '条约',
  race: '种族',
  subrace: '亚种',
  system: '体系',
  tier: '境界',
  ability: '能力',
  rule: '规则',
  cost: '代价',
  resource: '资源',
  good: '物产',
  industry: '产业',
  market: '市场',
  currency: '货币',
  actor: '参与者',
  institution: '机构',
  character: '角色',
  region: '地区',
  location: '地点',
  custom: '自定义',
  item: '条目',
};

export const kindLabel = (kind: string): string => KIND_LABELS[kind] ?? kind;

/** 模块徽章配色（Tailwind 类名，light/dark 双套，契约 §6.6） */
export const MODULE_BADGE_CLASSES: Record<string, string> = {
  history: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  politics: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  economy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  races: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  systems: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  character: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  map: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  special: 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30',
};

export const moduleBadgeClass = (module: string): string =>
  MODULE_BADGE_CLASSES[module] ?? MODULE_BADGE_CLASSES.special;

/** 失效引用统一的警示样式（契约 §2.5 / §5.3） */
export const INVALID_BADGE_CLASS =
  'bg-destructive/10 text-destructive border-destructive/40 border-dashed';


/** EntityRef 稳定字符串键，用于索引与去重 */
export const refKey = (ref: EntityRef): string => `${ref.module}:${ref.kind}:${ref.id}`;

export const sameRef = (a?: EntityRef | null, b?: EntityRef | null): boolean =>
  !!a && !!b && a.module === b.module && a.kind === b.kind && a.id === b.id;

export type { WorldModuleV2, SubmoduleV2, ModuleItemV2 };

/** submodule -> EntityRef（kind 由 P1 回填，缺省按契约 §2.3 退化） */
export const submoduleToRef = (
  moduleType: string,
  submodule: SubmoduleV2
): EntityRef => ({
  module: moduleType,
  kind: submodule.kind || (moduleType === 'history' ? 'event' : 'custom'),
  id: submodule.id,
});

/** character -> EntityRef（契约 §2.5：module = 'character'） */
export const characterToRef = (characterId: string): EntityRef => ({
  module: CHARACTER_MODULE,
  kind: 'character',
  id: characterId,
});

/** 出链/入链分组：按方向切分一个实体相关的全部关联 */
export interface GroupedLinks {
  outgoing: WorldLink[];
  incoming: WorldLink[];
}

export const isOutgoing = (link: WorldLink, ref: EntityRef): boolean =>
  link.source.module === ref.module &&
  link.source.kind === ref.kind &&
  link.source.id === ref.id;

/** 该关联是否以 ref 为端点（出链或入链任一方向） */
export const linkInvolves = (link: WorldLink, ref: EntityRef): boolean =>
  isOutgoing(link, ref) ||
  (link.target.module === ref.module &&
    link.target.kind === ref.kind &&
    link.target.id === ref.id);

/**
 * 出链/入链分组（Phase 3 修复）。
 * 入参可能是整个世界级共享列表，因此**必须**同时判对端：早先只判 source，
 * 会把与 ref 无关的关联全部误计入入链（计数、chip、删除提示都会串）。
 */
export const splitLinks = (links: WorldLink[], ref: EntityRef): GroupedLinks => {
  const outgoing: WorldLink[] = [];
  const incoming: WorldLink[] = [];
  for (const link of links) {
    if (isOutgoing(link, ref)) {
      outgoing.push(link);
    } else if (linkInvolves(link, ref)) {
      incoming.push(link);
    }
  }
  return { outgoing, incoming };
};

/**
 * 关联行在 source 视角下展示的类型标签：
 * 出链用 label，入链用 reverse_label（契约 §2.5 / §5.1）。
 * 注意：契约写作 reverseLabel，OpenAPI 响应字段为 reverse_label。
 */
export const linkDisplayLabel = (
  link: WorldLink,
  ref: EntityRef,
  registry: Map<string, LinkTypeDef>
): string => {
  const definition = registry.get(link.link_type);
  if (isOutgoing(link, ref)) {
    return link.label || definition?.label || link.link_type;
  }
  return definition?.reverse_label || definition?.label || link.link_type;
};

/** 关联行在 source 视角下展示的对端实体 */
export const linkCounterpart = (link: WorldLink, ref: EntityRef): EntityRef =>
  isOutgoing(link, ref) ? link.target : link.source;

/** 按对端模块分组，模块内按 link_type 稳定排序（契约 §5.1） */
export interface LinkGroup {
  module: string;
  links: WorldLink[];
}

export const groupLinksByModule = (
  links: WorldLink[],
  ref: EntityRef
): LinkGroup[] => {
  const groups = new Map<string, WorldLink[]>();
  for (const link of links) {
    const module = linkCounterpart(link, ref).module;
    const bucket = groups.get(module);
    if (bucket) {
      bucket.push(link);
    } else {
      groups.set(module, [link]);
    }
  }
  const orderOf = (module: string) => {
    const index = LINK_MODULE_ORDER.indexOf(module);
    return index < 0 ? LINK_MODULE_ORDER.length : index;
  };
  return [...groups.entries()]
    .map(([module, grouped]) => ({
      module,
      links: [...grouped].sort(
        (a, b) =>
          a.link_type.localeCompare(b.link_type) || a.id.localeCompare(b.id)
      ),
    }))
    .sort((a, b) => orderOf(a.module) - orderOf(b.module) || a.module.localeCompare(b.module));
};

/** 契约 §5.5：sketch 档新增关联默认 core.related_to */
export const SKETCH_DEFAULT_LINK_TYPE = 'core.related_to';

/** 契约 §5.3：行内引用 token */
export const INLINE_TOKEN_PATTERN = /\[\[([^\]|:]+):([^\]|:]+):([^\]|]+)\|([^\]]*)\]\]/g;

export interface InlineToken {
  ref: EntityRef;
  displayName: string;
  raw: string;
  start: number;
  end: number;
}

/** 解析正文中的 [[module:kind:id|显示名]] token（显示名以实时解析为准） */
export const parseInlineTokens = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  if (!text) return tokens;
  INLINE_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_TOKEN_PATTERN.exec(text)) !== null) {
    tokens.push({
      ref: { module: match[1], kind: match[2], id: match[3] },
      displayName: match[4],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
};

export const buildInlineToken = (ref: EntityRef, displayName: string): string =>
  `[[${ref.module}:${ref.kind}:${ref.id}|${displayName}]]`;

/** 世界是否为迁移容器（P1-MIG-05 口径：settings.migrationContainer === true） */
export const isMigrationContainer = (world: World): boolean =>
  (world.settings as Record<string, unknown> | null | undefined)?.migrationContainer === true;

/** 迁移容器关联的记账键（phase2 §1「迁移容器口径」） */
export interface MigrationLinkMeta {
  projectId?: string;
  legacyRelationType?: string;
  strength?: string;
  legacySourceName?: string;
  legacyTargetName?: string;
  reclassifiedFrom?: string;
  reclassifiedAt?: string;
}
