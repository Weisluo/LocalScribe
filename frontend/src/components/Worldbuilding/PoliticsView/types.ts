/**
 * 政治模块类型与纯函数（Phase 4 P4-T1；politics_ui_design §3 全文）
 *
 * 契约类型一律来自 OpenAPI 生成（services/worldbuildingApi re-export），
 * 本文件只放契约之外的派生类型、聚合视图与纯函数，不重复定义后端已有结构。
 *
 * 三处权重（§2.1/§2.4）在本文件的落点：
 * - 信息架构：PoliticsKind + POLITICS_ITEM_GROUPS（字段组按 kind 归属）；
 * - 数据形态：分 kind 的 meta 接口 + items 字段组 content 接口；
 * - 布局：PolityAtlasNode / FigureTenureBand / TreatyRibbonView（聚合视图，非持久化）。
 */

import type {
  EntityRef,
  ModuleItemV2,
  SubmoduleV2,
  WorldLink,
} from '@/services/worldbuildingApi';
import type { ComplexityLevel } from '@/components/common/ComplexitySwitcher';
import type {
  CustomFieldDef,
  CustomFieldValue,
  CustomLinkTypeDef,
  EntityTypeDef,
  LevelDef,
  ModuleConfig,
  StatusDef,
} from '../shared/moduleConfig';

export type { CustomFieldDef, CustomFieldValue, CustomLinkTypeDef, LevelDef, ModuleConfig, StatusDef };

export const POLITICS_MODULE = 'politics';

/* ------------------------------------------------------------------ *
 * 3.2 kind 与枚举
 * ------------------------------------------------------------------ */

/** 内置四种 kind；自定义 kind 使用 custom_xxx（契约 kind 命名约定）。 */
export type PoliticsKind = 'polity' | 'organization' | 'figure' | 'treaty' | `custom_${string}`;

export const POLITY_KIND = 'polity';
export const ORGANIZATION_KIND = 'organization';
export const FIGURE_KIND = 'figure';
export const TREATY_KIND = 'treaty';

/** 内置四 kind 的定义顺序即版图权重顺序：政权 -> 组织 -> 人物 -> 条约。 */
export const POLITICS_BUILTIN_KINDS: EntityTypeDef[] = [
  {
    id: POLITY_KIND,
    label: '政权',
    icon: 'landmark',
    color: 'gold',
    description: '版图主干与容器',
  },
  {
    id: ORGANIZATION_KIND,
    label: '组织',
    icon: 'shield',
    color: 'red',
    description: '政权卫星、跨国或独立势力；scope 在 meta',
  },
  {
    id: FIGURE_KIND,
    label: '人物',
    icon: 'user-round',
    color: 'slate',
    description: '全局 Character 的政治身份',
  },
  {
    id: TREATY_KIND,
    label: '条约',
    icon: 'scroll-text',
    color: 'green',
    description: '缔约方之间的边与条款',
  },
];

/** 自定义 kind 必须声明它附着在哪一层（§7.1.2），禁止新增平级主视图。 */
export type PoliticsAttachment = 'satellite' | 'independent' | 'edge';

/**
 * 组织在三层版图中的位置，由归属边推导并显式存于 meta，便于查询与降级渲染。
 * 只挂一个政权 -> intra_polity；挂多个政权或跨政权网络 -> cross_polity；
 * 无政权归属且用户标记独立 -> independent。
 */
export type PoliticsScope = 'intra_polity' | 'cross_polity' | 'independent';

export const POLITICS_SCOPES: PoliticsScope[] = [
  'intra_polity',
  'cross_polity',
  'independent',
];

export const SCOPE_LABELS: Record<PoliticsScope, string> = {
  intra_polity: '政权内',
  cross_polity: '跨国',
  independent: '独立',
};

export const normalizeScope = (value: unknown): PoliticsScope =>
  value === 'cross_polity' || value === 'independent' ? value : 'intra_polity';

/** 政治模块的 items 字段组名，与 WorldModuleItem.name 对应（§3.2）。 */
export type PoliticsItemGroup =
  | 'government'
  | 'chronicle'
  | 'demographics'
  | 'economy_base'
  | 'org_doctrine'
  | 'org_structure'
  | 'figure_identity'
  | 'treaty_terms'
  | 'treaty_amendments'
  | 'custom';

export const POLITICS_ITEM_GROUP_LABELS: Record<PoliticsItemGroup, string> = {
  government: '政府体制',
  chronicle: '沿革锚点',
  demographics: '人口与构成',
  economy_base: '经济基础',
  org_doctrine: '宗旨与运行',
  org_structure: '内部架构',
  figure_identity: '政治身份',
  treaty_terms: '条款',
  treaty_amendments: '修订与履行',
  custom: '自定义字段组',
};

/** 字段组按 kind 的归属；界面据此决定详情分段与默认折叠（§3.4 末表）。 */
export const POLITICS_ITEM_GROUPS: Record<
  'polity' | 'organization' | 'figure' | 'treaty',
  PoliticsItemGroup[]
> = {
  polity: ['government', 'chronicle', 'demographics', 'economy_base', 'custom'],
  organization: ['org_doctrine', 'org_structure', 'chronicle', 'custom'],
  figure: ['figure_identity', 'custom'],
  treaty: ['treaty_terms', 'treaty_amendments', 'custom'],
};

/** 自定义 kind 继承其附着层的字段组（§7.1.5：不复制一套新 Tab）。 */
export const itemGroupsOf = (kind: string): PoliticsItemGroup[] => {
  if (kind === ORGANIZATION_KIND) return POLITICS_ITEM_GROUPS.organization;
  if (kind === FIGURE_KIND) return POLITICS_ITEM_GROUPS.figure;
  if (kind === TREATY_KIND) return POLITICS_ITEM_GROUPS.treaty;
  return POLITICS_ITEM_GROUPS.polity;
};

/** 政权不建父级；parent_id 只用于 organization 树，最多 3 层（§3.8.4、§7.1.3）。 */
export const POLITICS_MAX_ORG_DEPTH = 3;

/* ------------------------------------------------------------------ *
 * 3.3 meta：基础字段与分 kind 扩展
 * ------------------------------------------------------------------ */

export interface PoliticsTimeSpan {
  start?: string;
  end?: string;
  display?: string;
}

/** 四类共用的轻量基础字段，来自契约 WorldSubmodule.meta / WorldEntityBase。 */
export interface PoliticsMetaBase {
  level?: string;
  status?: string;
  time?: PoliticsTimeSpan;
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
  note?: string;
  /** P4 回填迁移标记的旧 generic 数据（§8）：读取侧标「旧数据」并保留只读 */
  legacy?: boolean;
}

export interface PolityMeta extends PoliticsMetaBase {
  governmentFormId?: string;
  governmentFormLabel?: string;
  capitalLabel?: string;
  population?: number;
  populationYear?: string;
}

/** 组织：政权卫星 / 跨国势力 / 独立势力。归属关系在边上，meta 只存 scope 与类型。 */
export interface OrganizationMeta extends PoliticsMetaBase {
  scope: PoliticsScope;
  orgSubtypeId?: string;
  baseLabel?: string;
  influenceNote?: string;
}

/** 人物：全局 Character 的政治投影。不存姓名、头像、种族、生平。 */
export interface FigureMeta extends PoliticsMetaBase {
  characterId: string;
  identityLabel?: string;
  primaryOfficeLabel?: string;
  courtRank?: string;
  factionLabel?: string;
}

/** 条约：作为边载荷存在的实体。缔约方是 signatory_of 边，条款是 items。 */
export interface TreatyMeta extends PoliticsMetaBase {
  treatyTypeId?: string;
  effectiveAt?: string;
  expiresAt?: string;
  breachState?: string;
  visibility?: string;
  summary?: string;
}

export type PoliticsMeta =
  | PolityMeta
  | OrganizationMeta
  | FigureMeta
  | TreatyMeta
  | PoliticsMetaBase;

/* ------------------------------------------------------------------ *
 * 3.4 items：字段组 content 定义
 * ------------------------------------------------------------------ */

export interface GovernmentContent {
  formId?: string;
  formLabel?: string;
  legitimacy?: string;
  succession?: string;
  decisionProcess?: string;
  checks?: string;
  notes?: string;
}

export interface ChronicleEntry {
  id: string;
  order: number;
  title: string;
  summary?: string;
  time?: PoliticsTimeSpan;
  kindId?: string;
}

export interface ChronicleContent {
  entries: ChronicleEntry[];
}

export interface CensusRow {
  id: string;
  label: string;
  value?: number;
  unit?: string;
  note?: string;
}

export interface DemographicsContent {
  population?: number;
  year?: string;
  censusRows?: CensusRow[];
  compositionNote?: string;
}

export interface EconomyBaseContent {
  summary?: string;
  sectorLabels?: string[];
  treasuryNote?: string;
  taxationNote?: string;
}

export interface OrgDoctrineContent {
  creed?: string;
  recruitment?: string;
  discipline?: string;
  resourceNote?: string;
}

export interface OrgStructureEntry {
  id: string;
  order: number;
  title: string;
  tierLabel?: string;
  seats?: number;
  note?: string;
}

export interface OrgStructureContent {
  entries: OrgStructureEntry[];
}

export interface FigureIdentityContent {
  publicStanding?: string;
  factionNote?: string;
  privateNote?: string;
  aliases?: string[];
}

export interface TreatyTerm {
  id: string;
  order: number;
  title: string;
  content?: string;
  categoryId?: string;
  binding?: boolean;
  secret?: boolean;
}

export interface TreatyTermsContent {
  terms: TreatyTerm[];
}

export interface TreatyAmendment {
  id: string;
  order: number;
  title: string;
  content?: string;
  time?: PoliticsTimeSpan;
  kindId?: string;
}

export interface TreatyAmendmentsContent {
  amendments: TreatyAmendment[];
}

/** 字段组名到 content 类型的映射。 */
export interface PoliticsItemContentMap {
  government: GovernmentContent;
  chronicle: ChronicleContent;
  demographics: DemographicsContent;
  economy_base: EconomyBaseContent;
  org_doctrine: OrgDoctrineContent;
  org_structure: OrgStructureContent;
  figure_identity: FigureIdentityContent;
  treaty_terms: TreatyTermsContent;
  treaty_amendments: TreatyAmendmentsContent;
  custom: Record<string, CustomFieldValue>;
}

/* ------------------------------------------------------------------ *
 * 3.5 实体联合类型与版图聚合视图
 * ------------------------------------------------------------------ */

/** 把契约的 WorldSubmodule 特化为某 kind + 对应 meta。 */
export type PoliticsSubmodule<K extends string, M> = Omit<SubmoduleV2, 'kind' | 'meta'> & {
  kind: K;
  meta: M;
};

export type PolityEntity = PoliticsSubmodule<'polity', PolityMeta>;
export type OrganizationEntity = PoliticsSubmodule<'organization', OrganizationMeta>;
export type FigureEntity = PoliticsSubmodule<'figure', FigureMeta>;
export type TreatyEntity = PoliticsSubmodule<'treaty', TreatyMeta>;
export type PoliticsEntity =
  | PolityEntity
  | OrganizationEntity
  | FigureEntity
  | TreatyEntity;

/** 任职边（§3.8.2）：职位与任期不在 meta 复制，而是 member_of / leads 边。 */
export interface FigureTenureBand {
  figureId: string;
  officeTitle: string;
  start?: string;
  end?: string;
  isPrimary: boolean;
  /** 指向 WorldLink；编辑任期即编辑边 */
  edgeId: string;
}

export interface TreatyPartyView {
  ref: EntityRef;
  label: string;
  role?: string;
  signedAt?: string;
  /** 由旧 politics.treaty_between 等价转换而来（§3.8.1）：展示时标「旧数据」 */
  legacy?: boolean;
}

export interface TreatyRibbonView {
  treaty: TreatyEntity;
  parties: TreatyPartyView[];
  /** 缔约方节点 id */
  anchorA: string;
  /** 单方条约时为 undefined，改画节点旌旗 */
  anchorB?: string;
  line: 'double';
  color: 'green';
  status: TreatyStatus;
}

export type TreatyStatus = 'active' | 'expired' | 'suspended' | 'unknown';

/** 版图尺寸档：rank 是唯一的尺寸变量（§2.1 补充规则 1）。 */
export type AtlasSizeTier = 'high' | 'mid' | 'low';

/* ------------------------------------------------------------------ *
 * 3.8 政治边的落库规则
 * ------------------------------------------------------------------ */

/** 政治模块使用的契约 §4.3 关联类型。 */
export const POLITICS_LINK_TYPES = {
  controlsRegion: 'politics.controls_region',
  capitalAt: 'politics.capital_at',
  memberOf: 'politics.member_of',
  leads: 'politics.leads',
  foundedBy: 'politics.founded_by',
  subordinateTo: 'politics.subordinate_to',
  signatoryOf: 'politics.signatory_of',
  includesRace: 'politics.includes_race',
  allyOf: 'politics.ally_of',
  atWarWith: 'politics.at_war_with',
  vassalOf: 'politics.vassal_of',
  tradesWith: 'politics.trades_with',
  marriageTie: 'politics.marriage_tie',
  succeeds: 'politics.succeeds',
} as const;

/** 已废弃边：不创建、不查询、不渲染；旧数据在展示层等价转换为 signatory_of（§3.8.1）。 */
export const LEGACY_TREATY_LINK_TYPE = 'politics.treaty_between';

export type PoliticsLinkType = (typeof POLITICS_LINK_TYPES)[keyof typeof POLITICS_LINK_TYPES];

/** 缔约唯一规范边：缎带一律由它的缔约方集合投影生成，不重复写边。 */
export const SIGNATORY_LINK_TYPE = POLITICS_LINK_TYPES.signatoryOf;

/** 关系层的一般关系类型（条约单独一层，避免误读，§4.7.2）。 */
export const POLITICS_RELATION_LAYERS: {
  id: PoliticsLinkType;
  /** 与契约 §4.3 表格逐字一致（出链视角） */
  label: string;
  /** 与契约 §4.3 表格逐字一致（入链视角） */
  reverseLabel: string;
  lineStyle: 'solid' | 'dashed' | 'double';
  directed: boolean;
  color: string;
  icon: string;
}[] = [
  { id: POLITICS_LINK_TYPES.allyOf, label: '同盟', reverseLabel: '同盟', lineStyle: 'solid', directed: false, color: 'emerald', icon: 'handshake' },
  { id: POLITICS_LINK_TYPES.atWarWith, label: '敌对 / 战争', reverseLabel: '敌对 / 战争', lineStyle: 'double', directed: false, color: 'red', icon: 'swords' },
  { id: POLITICS_LINK_TYPES.vassalOf, label: '附庸于', reverseLabel: '宗主', lineStyle: 'dashed', directed: true, color: 'amber', icon: 'chevron-down' },
  { id: POLITICS_LINK_TYPES.tradesWith, label: '贸易往来', reverseLabel: '贸易往来', lineStyle: 'solid', directed: false, color: 'blue', icon: 'arrow-left-right' },
  { id: POLITICS_LINK_TYPES.marriageTie, label: '联姻', reverseLabel: '联姻', lineStyle: 'double', directed: false, color: 'pink', icon: 'heart-handshake' },
];

/** 契约 §4.3 关系类型的展示文案：无 link 对象时（图例 / 边层 / 矩阵）按视角取。 */
export const linkTypeLabelFor = (linkType: string, outgoing: boolean): string => {
  const layer = POLITICS_RELATION_LAYERS.find((candidate) => candidate.id === linkType);
  if (layer) return outgoing ? layer.label : layer.reverseLabel;
  if (linkType === SIGNATORY_LINK_TYPE) return outgoing ? '签署 / 加入' : '签署方';
  return linkType;
};

/** 任职边类型：leads 为最高领导 / 机构首长，member_of 为一般成员。 */
export const TENURE_LINK_TYPES: string[] = [
  POLITICS_LINK_TYPES.leads,
  POLITICS_LINK_TYPES.memberOf,
];

/** 政权 / 组织之间的层级与归属边（包含边，不是一般关系） */
export const CONTAINMENT_LINK_TYPES: string[] = [
  POLITICS_LINK_TYPES.subordinateTo,
  POLITICS_LINK_TYPES.memberOf,
];

/** 跨模块引用清单（§1.4 / §6.1）：政治只引用，不复制。 */
export const POLITICS_CROSS_MODULE_LINK_TYPES: string[] = [
  'history.milestone_of',
  'history.occurs_at',
  'history.involves',
  'history.causes',
  'history.caused_by',
  'economy.regulated_by',
  'economy.taxed_by',
  'economy.supplies',
  'economy.owned_by',
  'economy.currency_of',
  'systems.practiced_by',
  'character.belongs_to_race',
  'character.practices_system',
  'character.attained',
  'character.serves',
  'character.owns',
  'character.appears_in',
  'races.notable_figure',
];

/** 沿革视图消费的历史关联（§4.5.2） */
export const CHRONICLE_HISTORY_LINK_TYPES: string[] = [
  'history.milestone_of',
  'history.occurs_at',
  'history.involves',
];

/* ------------------------------------------------------------------ *
 * 6.3 经济基础 / 6.5 体系 的分组（政治详情只按关系类型分组展示）
 * ------------------------------------------------------------------ */

export const ECONOMY_BASE_LINK_TYPES: { id: string; label: string }[] = [
  { id: 'economy.regulated_by', label: '受管制' },
  { id: 'economy.taxed_by', label: '征税' },
  { id: 'economy.supplies', label: '供给' },
  { id: 'economy.owned_by', label: '归属' },
  { id: 'economy.currency_of', label: '流通货币' },
];

export const SYSTEMS_LINK_TYPES: { id: string; label: string }[] = [
  { id: 'systems.practiced_by', label: '修习 / 推行' },
];

/* ------------------------------------------------------------------ *
 * 8. 复杂度能力（政治侧口径；共用能力矩阵在 ComplexitySwitcher/types.ts）
 * ------------------------------------------------------------------ */

export interface PoliticsCapabilities {
  /** 只画政权节点与统治者头像条 */
  atlasPolityOnly: boolean;
  /** 卫星簇 + 独立势力带 */
  satellites: boolean;
  /** 任职带（structure 起） */
  tenureBands: boolean;
  /** 关系边层 */
  relationEdges: boolean;
  /** 条约缎带 */
  treatyRibbons: boolean;
  /** 条约簿（sketch 只做计数，structure 起可检索维护，§4.6.4/§8.1） */
  treatyBook: boolean;
  /** 六段详情 */
  fullDetail: boolean;
  /** 沿革条约有效期缎带 */
  chronicleTreaties: boolean;
  /** 时间滑杆 */
  timeline: boolean;
  /** 关系强度映射线宽 */
  relationStrength: boolean;
  /** 派生分布（人口 / 体系） */
  derivedDistribution: boolean;
  /** 沿革与历史事件叠加 */
  historyOverlay: boolean;
}

export const POLITICS_CAPABILITIES: Record<ComplexityLevel, PoliticsCapabilities> = {
  sketch: {
    atlasPolityOnly: true,
    satellites: false,
    tenureBands: false,
    relationEdges: false,
    treatyRibbons: false,
    treatyBook: false,
    fullDetail: false,
    chronicleTreaties: false,
    timeline: false,
    relationStrength: false,
    derivedDistribution: false,
    historyOverlay: false,
  },
  structure: {
    atlasPolityOnly: false,
    satellites: true,
    tenureBands: true,
    relationEdges: true,
    treatyRibbons: true,
    treatyBook: true,
    fullDetail: true,
    chronicleTreaties: true,
    timeline: false,
    relationStrength: false,
    derivedDistribution: false,
    historyOverlay: true,
  },
  sandbox: {
    atlasPolityOnly: false,
    satellites: true,
    tenureBands: true,
    relationEdges: true,
    treatyRibbons: true,
    treatyBook: true,
    fullDetail: true,
    chronicleTreaties: true,
    timeline: true,
    relationStrength: true,
    derivedDistribution: true,
    historyOverlay: true,
  },
};

/* ------------------------------------------------------------------ *
 * 11.3 降级阈值
 * ------------------------------------------------------------------ */

export const ATLAS_FULL_POLITY_LIMIT = 60;
/** 边数上限（§11.3 首行：<=300 边才算完整档） */
export const ATLAS_FULL_EDGE_LIMIT = 300;
export const ATLAS_FOLD_POLITY_LIMIT = 200;
export const ATLAS_FOLD_EDGE_LIMIT = 1200;
export const ROSTER_VIRTUAL_LIMIT = 200;
export const FOCUS_PIN_LIMIT = 3;

export type AtlasDegradeMode = 'full' | 'folded' | 'matrix';

/**
 * 版图降级（§11.3）：<=60 政权且 <=300 边完整；61-200 政权或 <=1200 边折叠低 rank 节点；
 * >200 政权或 >2000 边直接降为「按等级分组的矩阵 + 关系列表」。
 */
export const atlasDegradeMode = (polityCount: number, edgeCount: number): AtlasDegradeMode => {
  if (polityCount > ATLAS_FOLD_POLITY_LIMIT || edgeCount > 2000) return 'matrix';
  if (polityCount > ATLAS_FULL_POLITY_LIMIT || edgeCount > ATLAS_FULL_EDGE_LIMIT) return 'folded';
  return 'full';
};

/** 名录超过 200 行启用虚拟滚动（§11.1.5）。 */
export const shouldVirtualizeRoster = (rowCount: number): boolean =>
  rowCount > ROSTER_VIRTUAL_LIMIT;

/** 单选实体出入链超过 200：LinkPanel 分组折叠，先显示计数与前 20 条（§11.3）。
 *  实现与阈值在共用件侧（common/LinkPanel/types），这里只做再导出，避免 common 反向依赖本模块。 */
export { LINKPANEL_FOLD_LIMIT, shouldFoldLinkPanel } from '@/components/common/LinkPanel/types';

/* ------------------------------------------------------------------ *
 * 实体转换与读取辅助
 * ------------------------------------------------------------------ */

export const politicsRefOf = (id: string, kind: string): EntityRef => ({
  module: POLITICS_MODULE,
  kind,
  id,
});

export const politicsRef = politicsRefOf;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (meta: Record<string, unknown>, key: string): string | undefined =>
  typeof meta[key] === 'string' && meta[key] ? (meta[key] as string) : undefined;

const readNumber = (meta: Record<string, unknown>, key: string): number | undefined =>
  typeof meta[key] === 'number' && Number.isFinite(meta[key]) ? (meta[key] as number) : undefined;

const readTime = (meta: Record<string, unknown>): PoliticsTimeSpan | undefined =>
  isRecord(meta.time) ? (meta.time as PoliticsTimeSpan) : undefined;

const readStringArray = (meta: Record<string, unknown>, key: string): string[] =>
  Array.isArray(meta[key])
    ? (meta[key] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];

/**
 * 只保留显式定义的键。
 *
 * 读取 meta 时先用 `raw` 做基底、再用归一化后的已知字段覆盖：
 * 这样「未知键一律保留」（与 mergeMeta 的写入口径一致，降档或未来新增字段都不丢数据），
 * 同时把已知字段规范化。值缺失的键不写回，避免用 undefined 覆盖 raw 里的原值。
 */
const definedOnly = (source: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
};

/** meta 解析：未知键不丢（与 mergeMeta 同口径），已知字段规范化。 */
export const readPoliticsMeta = (raw: unknown): PoliticsMetaBase => {
  const meta = isRecord(raw) ? raw : {};
  return {
    ...meta,
    ...definedOnly({
      level: readString(meta, 'level'),
      status: readString(meta, 'status'),
      time: readTime(meta),
      // 非数组的旧 tags（如 'a,b'）不归一化成 []：否则任何一次保存都会把原值写掉
      tags: Array.isArray(meta.tags) ? readStringArray(meta, 'tags') : undefined,
      customFields: isRecord(meta.customFields)
        ? (meta.customFields as Record<string, CustomFieldValue>)
        : undefined,
      note: readString(meta, 'note'),
      // P4 回填迁移写入的 legacy 标记（§8）：读取侧据此标「旧数据」并禁编辑
      legacy: meta.legacy === true ? true : undefined,
    }),
  } as PoliticsMetaBase;
};

export const readPolityMeta = (raw: unknown): PolityMeta => {
  const meta = isRecord(raw) ? raw : {};
  return {
    ...meta,
    ...readPoliticsMeta(meta),
    ...definedOnly({
      governmentFormId: readString(meta, 'governmentFormId'),
      governmentFormLabel: readString(meta, 'governmentFormLabel'),
      capitalLabel: readString(meta, 'capitalLabel'),
      population: readNumber(meta, 'population'),
      populationYear: readString(meta, 'populationYear'),
    }),
  } as PolityMeta;
};

export const readOrganizationMeta = (raw: unknown): OrganizationMeta => {
  const meta = isRecord(raw) ? raw : {};
  return {
    ...meta,
    ...readPoliticsMeta(meta),
    ...definedOnly({
      scope: normalizeScope(meta.scope),
      orgSubtypeId: readString(meta, 'orgSubtypeId'),
      baseLabel: readString(meta, 'baseLabel'),
      influenceNote: readString(meta, 'influenceNote'),
    }),
  } as OrganizationMeta;
};

export const readFigureMeta = (raw: unknown): FigureMeta => {
  const meta = isRecord(raw) ? raw : {};
  return {
    ...meta,
    ...readPoliticsMeta(meta),
    ...definedOnly({
      characterId: readString(meta, 'characterId') ?? '',
      identityLabel: readString(meta, 'identityLabel'),
      primaryOfficeLabel: readString(meta, 'primaryOfficeLabel'),
      courtRank: readString(meta, 'courtRank'),
      factionLabel: readString(meta, 'factionLabel'),
    }),
  } as FigureMeta;
};

export const readTreatyMeta = (raw: unknown): TreatyMeta => {
  const meta = isRecord(raw) ? raw : {};
  return {
    ...meta,
    ...readPoliticsMeta(meta),
    ...definedOnly({
      treatyTypeId: readString(meta, 'treatyTypeId'),
      effectiveAt: readString(meta, 'effectiveAt'),
      expiresAt: readString(meta, 'expiresAt'),
      breachState: readString(meta, 'breachState'),
      visibility: readString(meta, 'visibility'),
      summary: readString(meta, 'summary'),
    }),
  } as TreatyMeta;
};

/** 按 kind 读取 meta（自定义 kind 回落到基础字段）。 */
export const readMetaOfKind = (kind: string, raw: unknown): PoliticsMeta => {
  if (kind === POLITY_KIND) return readPolityMeta(raw);
  if (kind === ORGANIZATION_KIND) return readOrganizationMeta(raw);
  if (kind === FIGURE_KIND) return readFigureMeta(raw);
  if (kind === TREATY_KIND) return readTreatyMeta(raw);
  return readPoliticsMeta(raw);
};

/** 契约 WorldSubmodule -> 政治实体（kind/meta 已由 P1 回填，缺省退化 custom）。 */
export const toPoliticsEntity = (submodule: SubmoduleV2): PoliticsEntity => {
  const kind = submodule.kind || 'custom';
  return {
    ...submodule,
    kind,
    meta: readMetaOfKind(kind, submodule.meta),
  } as unknown as PoliticsEntity;
};

export const entityRefOf = (submodule: Pick<SubmoduleV2, 'id' | 'kind'>): EntityRef =>
  politicsRefOf(submodule.id, submodule.kind || 'custom');

/** 某 kind 的实体过滤（自定义 kind 归入其附着层的形态，由调用方决定是否含入）。 */
export const entitiesOfKind = <T extends PoliticsEntity>(
  entities: PoliticsEntity[],
  kind: string
): T[] => entities.filter((entity) => entity.kind === kind) as unknown as T[];

export const politiesOf = (entities: PoliticsEntity[]): PolityEntity[] =>
  entitiesOfKind<PolityEntity>(entities, POLITY_KIND);

export const organizationsOf = (entities: PoliticsEntity[]): OrganizationEntity[] =>
  entitiesOfKind<OrganizationEntity>(entities, ORGANIZATION_KIND);

export const figuresOf = (entities: PoliticsEntity[]): FigureEntity[] =>
  entitiesOfKind<FigureEntity>(entities, FIGURE_KIND);

export const treatiesOf = (entities: PoliticsEntity[]): TreatyEntity[] =>
  entitiesOfKind<TreatyEntity>(entities, TREATY_KIND);

/* ------------------------------------------------------------------ *
 * items 字段组读取
 * ------------------------------------------------------------------ */

export const itemContentOf = <K extends keyof PoliticsItemContentMap>(
  items: ModuleItemV2[],
  submoduleId: string | null | undefined,
  name: K
): PoliticsItemContentMap[K] | undefined => {
  const found = items.find(
    (item) => item.name === name && (item.submodule_id ?? null) === (submoduleId ?? null)
  );
  return found?.content as PoliticsItemContentMap[K] | undefined;
};

/** 沿革条目：items.chronicle.entries，按 order 稳定排序（§3.4）。 */
export const chronicleEntriesOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): ChronicleEntry[] => {
  const content = itemContentOf(items, submoduleId, 'chronicle');
  const entries = Array.isArray(content?.entries) ? content.entries : [];
  return [...entries].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id))
  );
};

export const treatyTermsOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): TreatyTerm[] => {
  const content = itemContentOf(items, submoduleId, 'treaty_terms');
  const terms = Array.isArray(content?.terms) ? content.terms : [];
  return [...terms].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id))
  );
};

export const treatyAmendmentsOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): TreatyAmendment[] => {
  const content = itemContentOf(items, submoduleId, 'treaty_amendments');
  const amendments = Array.isArray(content?.amendments) ? content.amendments : [];
  return [...amendments].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id))
  );
};

export const orgStructureOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): OrgStructureEntry[] => {
  const content = itemContentOf(items, submoduleId, 'org_structure');
  const entries = Array.isArray(content?.entries) ? content.entries : [];
  return [...entries].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id))
  );
};

export const governmentOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): GovernmentContent => itemContentOf(items, submoduleId, 'government') ?? {};

export const demographicsOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): DemographicsContent => itemContentOf(items, submoduleId, 'demographics') ?? {};

export const economyBaseOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): EconomyBaseContent => itemContentOf(items, submoduleId, 'economy_base') ?? {};

export const orgDoctrineOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): OrgDoctrineContent => itemContentOf(items, submoduleId, 'org_doctrine') ?? {};

export const figureIdentityOf = (
  items: ModuleItemV2[],
  submoduleId: string | null | undefined
): FigureIdentityContent => itemContentOf(items, submoduleId, 'figure_identity') ?? {};

/* ------------------------------------------------------------------ *
 * 3.9 / §2.1 计数与排序
 * ------------------------------------------------------------------ */

export const weightOf = (level: string | undefined, levels: LevelDef[]): number => {
  if (!level) return 0;
  const found = levels.find((def) => def.id === level);
  const rank = (found as { rank?: number } | undefined)?.rank;
  return typeof rank === 'number' && Number.isFinite(rank) ? rank : 0;
};

export type RankedLevel = LevelDef & { rank?: number };

/** rank 降序，同 rank 按名称（§2.1 补充规则：相同 rank 允许并列，布局环按 weight 分层） */
export const sortLevelsByRank = (levels: RankedLevel[]): RankedLevel[] =>
  [...levels].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.label.localeCompare(b.label, 'zh-Hans-CN'));

/**
 * rank -> 尺寸档（§4.1）：按等级集合内的相对高低分档。
 * 无等级或全部同 rank 时统一为 mid，避免空等级体系把节点全渲染成小卡。
 */
export const atlasSizeTier = (
  weight: number,
  allWeights: number[]
): AtlasSizeTier => {
  const distinct = [...new Set(allWeights)].sort((a, b) => b - a);
  if (distinct.length <= 1) return 'mid';
  const index = distinct.indexOf(weight);
  if (index === 0) return 'high';
  if (index === distinct.length - 1) return 'low';
  return 'mid';
};

/** 布局环：rank 越高越靠中心（环 0 为中心环） */
export const atlasRingOf = (weight: number, allWeights: number[]): number => {
  const distinct = [...new Set(allWeights)].sort((a, b) => b - a);
  const index = distinct.indexOf(weight);
  return index < 0 ? distinct.length : index;
};

export const isTerminalStatus = (
  status: string | undefined,
  statuses: StatusDef[]
): boolean => {
  if (!status) return false;
  return statuses.find((def) => def.id === status)?.isTerminal === true;
};

/* ------------------------------------------------------------------ *
 * 3.8.1 条约缎带投影
 * ------------------------------------------------------------------ */

const isTreatyRef = (ref: EntityRef): boolean =>
  ref.module === POLITICS_MODULE && ref.kind === TREATY_KIND;

/** 缔约方是否以该 ref 为源（signatory_of 有向：政权 / 组织 -> 条约） */
export const isSignatoryLink = (link: WorldLink): boolean =>
  link.link_type === SIGNATORY_LINK_TYPE && isTreatyRef(link.target);

/**
 * 旧 treaty_between 的等价转换：源与目标都是政权 / 组织，等价于双方各一条 signatory_of。
 * 只做读取转换，保存时写回 signatory_of（§3.8.1）。
 */
export const isLegacyTreatyLink = (link: WorldLink): boolean =>
  link.link_type === LEGACY_TREATY_LINK_TYPE;

export interface TreatyProjection {
  treatyId: string;
  parties: TreatyPartyView[];
}

/**
 * 由 signatory_of 边集合投影出「条约 -> 缔约方」（不含条约实体本身）。
 * 同一 (treaty, party) 去重；meta.role / time.start 记入缔约方视图。
 *
 * 旧 politics.treaty_between（已废弃）在展示层等价转换为 signatory_of（§3.8.1 / §4.6.6）：
 * 一端是条约、另一端是政权 / 组织时按缔约方并入同一集合，用 legacy 标记；
 * 两端都不是条约的旧边无法投影为缎带，由 legacyTreatyEdges 单独回报。
 */
export const projectSignatories = (
  links: WorldLink[],
  resolveName: (ref: EntityRef) => string
): Map<string, TreatyPartyView[]> => {
  const byTreaty = new Map<string, TreatyPartyView[]>();
  const seen = new Set<string>();
  for (const link of links) {
    if (isLegacyTreatyLink(link)) {
      const endpoints = [link.source, link.target];
      const treatySide = endpoints.find(isTreatyRef);
      if (!treatySide) continue;
      const other = endpoints[0].id === treatySide.id ? endpoints[1] : endpoints[0];
      if (other.module !== POLITICS_MODULE || isTreatyRef(other)) continue;
      const legacyKey = `${treatySide.id}:${other.module}:${other.kind}:${other.id}`;
      if (seen.has(legacyKey)) continue;
      seen.add(legacyKey);
      const party: TreatyPartyView = { ref: other, label: resolveName(other), legacy: true };
      const legacyBucket = byTreaty.get(treatySide.id);
      if (legacyBucket) legacyBucket.push(party);
      else byTreaty.set(treatySide.id, [party]);
      continue;
    }
    if (!isSignatoryLink(link)) continue;
    const treatyId = link.target.id;
    const key = `${treatyId}:${link.source.module}:${link.source.kind}:${link.source.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = isRecord(link.meta) ? link.meta : {};
    const party: TreatyPartyView = {
      ref: link.source,
      label: resolveName(link.source),
      role: readString(meta, 'role'),
      signedAt: readString(meta, 'signedAt') ?? link.time?.start ?? undefined,
    };
    const bucket = byTreaty.get(treatyId);
    if (bucket) {
      bucket.push(party);
    } else {
      byTreaty.set(treatyId, [party]);
    }
  }
  return byTreaty;
};

/**
 * 无法投影为缎带的旧 politics.treaty_between 边（两端都是政权 / 组织，§3.8.1）。
 * 不做猜测转换，只回报给条约簿提示「N 条旧条约边待转换」。
 */
export const legacyTreatyEdges = (links: WorldLink[]): WorldLink[] =>
  links.filter((link) => {
    if (!isLegacyTreatyLink(link)) return false;
    return !isTreatyRef(link.source) && !isTreatyRef(link.target);
  });

/**
 * 条约状态：由 StatusDef.isTerminal + breachState + 有效期是否填写推导（§4.6.5）。
 * 不与宿主时钟比较：世界内时间由用户在沙盘档看时点（§5.6），古代/架空纪年不能被判「已失效」。
 */
export const treatyStatusOf = (
  treaty: TreatyEntity,
  statuses: StatusDef[]
): TreatyStatus => {
  const meta = treaty.meta as TreatyMeta;
  if (meta.breachState && meta.breachState.trim()) return 'suspended';
  if (isTerminalStatus(meta.status, statuses)) return 'expired';
  return meta.status || meta.effectiveAt || meta.expiresAt || meta.time ? 'active' : 'unknown';
};

export const TREATY_STATUS_LABELS: Record<TreatyStatus, string> = {
  active: '生效中',
  expired: '已失效',
  suspended: '中止 / 违约',
  unknown: '未标注',
};

/* ------------------------------------------------------------------ *
 * 3.8.2 任职带投影
 * ------------------------------------------------------------------ */

/**
 * 由任职边投影出某人物的任职带（§3.8.2）：meta.officeTitle / isPrimary / courtRank，
 * time.start / time.end。编辑任期即编辑边。
 */
export const tenureBandsOf = (
  links: WorldLink[],
  figureId: string
): FigureTenureBand[] =>
  links
    .filter(
      (link) =>
        TENURE_LINK_TYPES.includes(link.link_type) &&
        link.source.module === POLITICS_MODULE &&
        link.source.id === figureId
    )
    .map((link) => {
      const meta = isRecord(link.meta) ? link.meta : {};
      return {
        figureId,
        officeTitle: readString(meta, 'officeTitle') ?? '',
        start: link.time?.start ?? undefined,
        end: link.time?.end ?? undefined,
        isPrimary: meta.isPrimary === true,
        edgeId: link.id,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        (a.start ?? '').localeCompare(b.start ?? '') ||
        a.edgeId.localeCompare(b.edgeId)
    );

/** 头像条取「主要任职优先 + 有任职时间者优先」，最多 max 个（§2.2 第 4 层）。 */
export const coreFiguresOf = (
  figures: FigureEntity[],
  links: WorldLink[],
  max: number
): FigureEntity[] => {
  const scored = figures.map((figure) => {
    const bands = tenureBandsOf(links, figure.id);
    const primary = bands.some((band) => band.isPrimary);
    return { figure, primary, bands: bands.length };
  });
  scored.sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      b.bands - a.bands ||
      a.figure.name.localeCompare(b.figure.name, 'zh-Hans-CN')
  );
  return scored.slice(0, max).map((item) => item.figure);
};

/* ------------------------------------------------------------------ *
 * 3.8.3 组织 scope 推导
 * ------------------------------------------------------------------ */

/**
 * scope 是渲染缓存，由归属边推导（§3.8.3）：只看「上溯到的政权数」。
 * - 只挂一个政权（直接挂，或经上级组织链上溯到一个政权）-> intra_polity
 * - 挂多个政权 / 跨政权网络 -> cross_polity
 * - 用户显式标记 independent -> independent（标签优先于推导）
 * - 上溯不到任何政权 -> 不猜值：返回 independent 并置 unattached，UI 按「未归属」呈现
 *
 * 组织父级链要一起上溯（§7.1.3 允许三层组织树），否则第二层起会被误判成无归属。
 */
export interface OrganizationScopeResolution {
  scope: PoliticsScope;
  /** 上溯到的政权 id（去重、稳定排序），供跨国势力吸附与卫星归位 */
  anchors: string[];
  /** 既无政权归属也无组织父级（或仅有组织父级但上溯不到政权） */
  unattached: boolean;
}

const pushRef = (map: Map<string, string[]>, key: string, value: string): void => {
  const bucket = map.get(key);
  if (bucket) {
    if (!bucket.includes(value)) bucket.push(value);
  } else {
    map.set(key, [value]);
  }
};

export const resolveOrganizationScope = (
  links: WorldLink[],
  organizationId: string,
  declared?: PoliticsScope
): OrganizationScopeResolution => {
  const polityParentsOf = new Map<string, string[]>();
  const orgParentsOf = new Map<string, string[]>();
  for (const link of links) {
    if (link.source.module !== POLITICS_MODULE) continue;
    if (link.target.module !== POLITICS_MODULE) continue;
    const isSubordinate = link.link_type === POLITICS_LINK_TYPES.subordinateTo;
    const isMember = link.link_type === POLITICS_LINK_TYPES.memberOf;
    if (!isSubordinate && !isMember) continue;
    if (link.target.kind === POLITY_KIND) {
      pushRef(polityParentsOf, link.source.id, link.target.id);
    } else if (isSubordinate && link.target.kind === ORGANIZATION_KIND) {
      pushRef(orgParentsOf, link.source.id, link.target.id);
    }
  }

  const anchors = new Set<string>();
  for (const polityId of polityParentsOf.get(organizationId) ?? []) anchors.add(polityId);
  // 沿组织父链上溯（环路安全）
  const visited = new Set<string>([organizationId]);
  const queue = [...(orgParentsOf.get(organizationId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const polityId of polityParentsOf.get(current) ?? []) anchors.add(polityId);
    queue.push(...(orgParentsOf.get(current) ?? []));
  }
  const anchorList = [...anchors].sort();

  if (declared === 'independent') {
    return { scope: 'independent', anchors: anchorList, unattached: false };
  }
  if (anchorList.length > 1) {
    return { scope: 'cross_polity', anchors: anchorList, unattached: false };
  }
  if (anchorList.length === 1) {
    return { scope: 'intra_polity', anchors: anchorList, unattached: false };
  }
  return { scope: declared ?? 'independent', anchors: [], unattached: true };
};

/** 兼容入口：只取 scope（写入路径的 scope 重算与读取推导共用同一实现）。 */
export const deriveScope = (
  organizationId: string,
  links: WorldLink[],
  current?: PoliticsScope
): PoliticsScope => resolveOrganizationScope(links, organizationId, current).scope;

/** subordinate_to 组织链上的全部后代 id（不含自身），用于选择器排除与成环阻断（§5.7）。 */
export const orgDescendantIds = (links: WorldLink[], rootId: string): Set<string> => {
  const childrenOf = new Map<string, string[]>();
  for (const link of links) {
    if (link.link_type !== POLITICS_LINK_TYPES.subordinateTo) continue;
    if (link.source.module !== POLITICS_MODULE || link.target.module !== POLITICS_MODULE) continue;
    if (link.target.kind !== ORGANIZATION_KIND) continue;
    pushRef(childrenOf, link.target.id, link.source.id);
  }
  const descendants = new Set<string>();
  const queue = [...(childrenOf.get(rootId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === rootId || descendants.has(current)) continue;
    descendants.add(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }
  return descendants;
};

/** 组织在树中的层级（1 起）：沿 subordinate_to 组织父链上溯（§7.1.3 上限 3）。 */
export const orgEdgeDepthOf = (links: WorldLink[], organizationId: string): number => {
  const parentsOf = new Map<string, string[]>();
  for (const link of links) {
    if (link.link_type !== POLITICS_LINK_TYPES.subordinateTo) continue;
    if (link.source.module !== POLITICS_MODULE || link.target.module !== POLITICS_MODULE) continue;
    if (link.target.kind !== ORGANIZATION_KIND) continue;
    pushRef(parentsOf, link.source.id, link.target.id);
  }
  let depth = 1;
  let cursor: string | undefined = (parentsOf.get(organizationId) ?? [])[0];
  const visited = new Set<string>([organizationId]);
  while (cursor && !visited.has(cursor) && depth < 32) {
    visited.add(cursor);
    depth += 1;
    cursor = (parentsOf.get(cursor) ?? [])[0];
  }
  return depth;
};

/** 子树高度（含自身）：用于判断挂到新父级后是否超过深度上限。 */
export const orgSubtreeHeight = (links: WorldLink[], rootId: string): number => {
  const descendants = orgDescendantIds(links, rootId);
  if (descendants.size === 0) return 1;
  let height = 1;
  for (const id of descendants) {
    height = Math.max(height, orgEdgeDepthOf(links, id) - orgEdgeDepthOf(links, rootId) + 1);
  }
  return height;
};

/** 成环阻断（§5.7）：目标父级是自己或自己的后代时拒绝挂载。 */
export const wouldCreateOrgLinkCycle = (
  links: WorldLink[],
  organizationId: string,
  parentId: string | null | undefined
): boolean => {
  if (!parentId) return false;
  if (parentId === organizationId) return true;
  return orgDescendantIds(links, organizationId).has(parentId);
};

/** 组织树成环检测（§5.7 阻断规则，parent_id 口径）；parentId 为空表示脱离树。 */
export const wouldCreateOrgCycle = (
  submodules: SubmoduleV2[],
  nodeId: string,
  parentId: string | null
): boolean => {
  if (!parentId) return false;
  if (parentId === nodeId) return true;
  const byId = new Map(submodules.map((item) => [item.id, item]));
  let cursor: string | null = parentId;
  const visited = new Set<string>([nodeId]);
  while (cursor) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
  return false;
};

/** 组织树深度（1 起，parent_id 口径）；超过上限时拒绝挂载（§7.1.3）。 */
export const orgDepthOf = (submodules: SubmoduleV2[], nodeId: string): number => {
  const byId = new Map(submodules.map((item) => [item.id, item]));
  let depth = 1;
  let cursor: string | null = byId.get(nodeId)?.parent_id ?? null;
  const visited = new Set<string>([nodeId]);
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    depth += 1;
    cursor = byId.get(cursor)?.parent_id ?? null;
    if (depth > 32) break;
  }
  return depth;
};

/* ------------------------------------------------------------------ *
 * 5.2 表单 -> meta patch
 * ------------------------------------------------------------------ */

export const cleanText = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/* ------------------------------------------------------------------ *
 * 7.1 自定义 kind 附着层
 * ------------------------------------------------------------------ */

/** 自定义 kind 必须声明附着层；缺省按 satellite（政权卫星，形态同 organization）。 */
export const attachmentOf = (def: EntityTypeDef): PoliticsAttachment => {
  const declared = (def as { attachment?: unknown }).attachment;
  if (declared === 'independent' || declared === 'edge' || declared === 'satellite') {
    return declared;
  }
  // 无声明时按 parentKind 推断：挂政权 -> 卫星；挂组织 -> 卫星；其余 -> 边载荷
  if (def.parentKind === POLITY_KIND || def.parentKind === ORGANIZATION_KIND) return 'satellite';
  return 'edge';
};
