/**
 * 政治数据层类型（Phase 4 P4-T2；politics_ui_design §3.9/§4.2/§4.4/§4.5/§11.2）
 *
 * 这里是 PoliticsView 内部冻结的接口：组件只依赖 UsePoliticsResult，
 * 不各自发起链接 / 实体请求（§11.2：世界级 lists 一次取回，客户端聚合）。
 */

import type { EntityRef, ModuleItemV2, SubmoduleV2, WorldLink } from '@/services/worldbuildingApi';
import type { ComplexityLevel } from '@/components/common/ComplexitySwitcher';
import type { CustomFieldValue, LevelDef, ModuleConfig, StatusDef } from '../../shared/moduleConfig';
import type { ModuleTerms } from '../../shared/useModuleConfig';
import type { LinkCountEntry } from '../../shared/useLinkCountMap';
import type { EntityIndexEntry, EntityRefsResult } from '../../hooks/useEntityRefs';
import type {
  AtlasSizeTier,
  ChronicleEntry,
  DemographicsContent,
  EconomyBaseContent,
  FigureEntity,
  FigureMeta,
  FigureTenureBand,
  GovernmentContent,
  OrganizationEntity,
  OrganizationMeta,
  OrgDoctrineContent,
  OrgStructureEntry,
  PolityEntity,
  PolityMeta,
  PoliticsCapabilities,
  PoliticsEntity,
  PoliticsMetaBase,
  PoliticsScope,
  PoliticsTimeSpan,
  TreatyAmendment,
  TreatyEntity,
  TreatyMeta,
  TreatyPartyView,
  TreatyRibbonView,
  TreatyStatus,
  TreatyTerm,
} from '../types';

export type { ComplexityLevel, ModuleConfig, ModuleTerms };

/**
 * 四类实体视图类型在这里一并 re-export，组件从 `../hooks/politicsTypes`
 * 或 `../hooks` 都能拿到，不必在契约类型与视图类型之间来回跳。
 */
export type {
  FigureEntity,
  FigureTenureBand,
  OrganizationEntity,
  PolityEntity,
  PoliticsEntity,
  TreatyEntity,
  TreatyPartyView,
  TreatyRibbonView,
  TreatyTerm,
  PoliticsScope,
  PoliticsTimeSpan,
} from '../types';

/* ------------------------------------------------------------------ *
 * 侧栏层级导航（过滤器，不是四个页面，§2.3 / §5.1.2）
 * ------------------------------------------------------------------ */

export type PoliticsKindFilter = 'all' | 'polity' | 'organization' | 'figure' | 'treaty' | string;

export interface PoliticsFilterState {
  kind: PoliticsKindFilter;
  level: string;
  status: string;
  search: string;
}

export const EMPTY_POLITICS_FILTER: PoliticsFilterState = {
  kind: 'all',
  level: '',
  status: '',
  search: '',
};

/* ------------------------------------------------------------------ *
 * 版图
 * ------------------------------------------------------------------ */

export interface AtlasNodeView {
  polity: PolityEntity;
  weight: number;
  sizeTier: AtlasSizeTier;
  /** 布局环：rank 越高越靠中心 */
  ring: number;
  satellites: OrganizationEntity[];
  coreFigures: FigureEntity[];
  /** 全部人物（头像条之外的溢出计数按它算） */
  figures: FigureEntity[];
  tenureBands: FigureTenureBand[];
  ribbons: TreatyRibbonView[];
  relationCount: { out: number; in: number };
  /** StatusDef.isTerminal：画布降为幽灵节点（不消失） */
  terminal: boolean;
}

export interface IndependentForceView {
  entity: PoliticsEntity;
  scope: PoliticsScope;
  /** 跨国组织吸附的政权 id 列表 */
  anchors: string[];
  memberCount: number;
  /** 上溯不到任何政权：按「未归属」呈现，不再静默隐藏（§9） */
  unattached?: boolean;
}

/** 关系边层的渲染单元（含反向标签解析，不在组件内查注册表） */
export interface PoliticsEdgeView {
  link: WorldLink;
  linkType: string;
  label: string;
  from: EntityRef;
  to: EntityRef;
  directed: boolean;
  lineStyle: 'solid' | 'dashed' | 'double';
  color: string;
  icon: string;
  strength?: number;
  note?: string;
  time?: PoliticsTimeSpan;
  /** 失效引用：目标实体不在索引里（§3.8.7） */
  dangling: boolean;
}

/** §11.3 边聚合：同一对节点的同类边合并为一条，在边卡内展开 */
export interface AggregatedEdgeView {
  key: string;
  linkType: string;
  label: string;
  from: EntityRef;
  to: EntityRef;
  directed: boolean;
  lineStyle: 'solid' | 'dashed' | 'double';
  color: string;
  icon: string;
  memberIds: string[];
  /** 聚合多条时取最后一条的强度 */
  strength?: number;
  dangling: boolean;
}

/* ------------------------------------------------------------------ *
 * 详情面板分段
 * ------------------------------------------------------------------ */

export interface PolityDetailView {
  meta: PolityMeta;
  government: GovernmentContent;
  demographics: DemographicsContent;
  economyBase: EconomyBaseContent;
  chronicle: ChronicleEntry[];
  organizations: OrganizationEntity[];
  figures: FigureEntity[];
  tenureBands: FigureTenureBand[];
  treaties: { ribbon: TreatyRibbonView; parties: TreatyPartyView[] }[];
  territories: EntityRef[];
  capital?: EntityRef;
  races: { ref: EntityRef; label: string; share?: number; note?: string }[];
  systems: { ref: EntityRef; label: string }[];
  economyLinks: { id: string; label: string; refs: EntityRef[] }[];
  historyEvents: { ref: EntityRef; label: string; linkType: string; time?: PoliticsTimeSpan }[];
  counts: { out: number; in: number };
}

export interface OrganizationDetailView {
  meta: OrganizationMeta;
  doctrine: OrgDoctrineContent;
  structure: OrgStructureEntry[];
  chronicle: ChronicleEntry[];
  scope: PoliticsScope;
  parents: { ref: EntityRef; label: string; linkType: string }[];
  children: OrganizationEntity[];
  members: FigureEntity[];
  tenureBands: FigureTenureBand[];
  treaties: { ribbon: TreatyRibbonView; parties: TreatyPartyView[] }[];
  counts: { out: number; in: number };
}

export interface FigureDetailView {
  meta: FigureMeta;
  identity: {
    publicStanding?: string;
    factionNote?: string;
    privateNote?: string;
    aliases?: string[];
  };
  /** 全局 Character 索引项；未绑定时为 undefined（§6.6.5 显示修补入口） */
  character?: EntityIndexEntry;
  bands: FigureTenureBand[];
  /** 任职带上的目标实体（政权 / 组织 / 条约） */
  offices: { band: FigureTenureBand; ref?: EntityRef; label: string }[];
  counts: { out: number; in: number };
}

export interface TreatyDetailView {
  meta: TreatyMeta;
  status: TreatyStatus;
  parties: TreatyPartyView[];
  terms: TreatyTerm[];
  amendments: TreatyAmendment[];
  /** 单缔约方时为 true，画节点旌旗（§4.6.1） */
  singleParty: boolean;
  counts: { out: number; in: number };
}

export type FocusDetailView =
  | { kind: 'polity'; view: PolityDetailView }
  | { kind: 'organization'; view: OrganizationDetailView }
  | { kind: 'figure'; view: FigureDetailView }
  | { kind: 'treaty'; view: TreatyDetailView }
  | { kind: 'unknown'; view: UnknownDetailView };

/**
 * 无法归入四形态的实体（未登记的 custom kind / 旧 generic 数据）。
 * 只读展示，绝不冒充政权的「条约式」面板（§3.6/§7.1.2）。
 */
export interface UnknownDetailView {
  meta: PoliticsMetaBase;
  counts: { out: number; in: number };
}

/* ------------------------------------------------------------------ *
 * 名录
 * ------------------------------------------------------------------ */

export interface RosterPolityRow {
  polity: PolityEntity;
  weight: number;
  organizations: OrganizationEntity[];
  figures: {
    entity: FigureEntity;
    office: string;
    start?: string;
    end?: string;
    isPrimary: boolean;
  }[];
  counts: { out: number; in: number };
  satelliteCount: number;
  figureCount: number;
  treatyCount: number;
  terminal: boolean;
  /** 回填迁移标记的旧数据：只读 + 警示（§8） */
  legacy: boolean;
}

export interface RosterIndependentRow {
  entity: PoliticsEntity;
  scope: PoliticsScope;
  memberCount: number;
  counts: { out: number; in: number };
  /** 上溯不到政权（未归属）：名录按「未归属」分组显示 */
  unattached?: boolean;
  legacy?: boolean;
}

export interface RosterTreatyRow {
  treaty: TreatyEntity;
  status: TreatyStatus;
  parties: TreatyPartyView[];
  termCount: number;
  amendmentCount: number;
  counts: { out: number; in: number };
}

/* ------------------------------------------------------------------ *
 * 沿革
 * ------------------------------------------------------------------ */

export interface ChronicleAnchorView {
  id: string;
  label: string;
  time: PoliticsTimeSpan;
  /** 'chronicle' 来自 items.chronicle；'history' 来自 history.* 入链 */
  source: 'chronicle' | 'history';
  linkType?: string;
  /** 历史事件 / 时代的跳转目标 */
  ref?: EntityRef;
  kindId?: string;
}

export interface ChronicleLane {
  entity: PoliticsEntity;
  /** 泳道高度权重（rank） */
  weight: number;
  start?: string;
  end?: string;
  terminal: boolean;
  anchors: ChronicleAnchorView[];
  /** 组织存续期细线（§4.5.4） */
  isOrganization: boolean;
}

export interface ChronicleTreatyBand {
  treaty: TreatyEntity;
  status: TreatyStatus;
  start?: string;
  end?: string;
}

export interface ChronicleSpan {
  /** ISO 时间的比较键 */
  key?: string;
  label: string;
  year?: number;
}

/* ------------------------------------------------------------------ *
 * 写操作
 * ------------------------------------------------------------------ */

export interface PoliticsEntityForm {
  name: string;
  kind: string;
  description?: string;
  icon?: string;
  color?: string;
  orderIndex?: number;
}

export interface PolityFormValues extends PoliticsEntityForm {
  level?: string;
  status?: string;
  time?: PoliticsTimeSpan;
  note?: string;
  governmentFormLabel?: string;
  capitalLabel?: string;
  population?: number;
  populationYear?: string;
  tags?: string[];
  /** 统治者（全局 Character id）：保存时建 leads 边（§5.2） */
  rulerCharacterId?: string;
  rulerOfficeTitle?: string;
  rulerStart?: string;
  rulerEnd?: string;
  rulerIsPrimary?: boolean;
  customFields?: Record<string, CustomFieldValue>;
}

export interface OrganizationFormValues extends PoliticsEntityForm {
  scope: PoliticsScope;
  level?: string;
  status?: string;
  time?: PoliticsTimeSpan;
  note?: string;
  orgSubtypeId?: string;
  baseLabel?: string;
  influenceNote?: string;
  /** 归属政权 / 上级组织：保存时建 subordinate_to 边（§3.8.3） */
  parentRef?: EntityRef | null;
  customFields?: Record<string, CustomFieldValue>;
}

export interface FigureFormValues extends PoliticsEntityForm {
  characterId: string;
  identityLabel?: string;
  courtRank?: string;
  factionLabel?: string;
  note?: string;
  time?: PoliticsTimeSpan;
  /** 任职：officeTitle + 时间 + isPrimary，保存时建 leads / member_of 边 */
  officeRef?: EntityRef | null;
  officeTitle?: string;
  officeStart?: string;
  officeEnd?: string;
  officeIsPrimary?: boolean;
  officeLinkType?: string;
  customFields?: Record<string, CustomFieldValue>;
}

export interface TreatyFormValues extends PoliticsEntityForm {
  status?: string;
  time?: PoliticsTimeSpan;
  treatyTypeId?: string;
  effectiveAt?: string;
  expiresAt?: string;
  breachState?: string;
  visibility?: string;
  summary?: string;
  /** 缔约方：保存时建多条 signatory_of；>= 2 才画缎带（§5.3） */
  parties: EntityRef[];
  customFields?: Record<string, CustomFieldValue>;
}

export interface PoliticsMutationResult {
  entity: SubmoduleV2;
  /** 关联写入中被跳过（等价边已存在）的类型 */
  skippedLinks: string[];
  failedLinks: string[];
}

/* ------------------------------------------------------------------ *
 * hook 契约（组件唯一的数据入口）
 * ------------------------------------------------------------------ */

export interface UsePoliticsResult {
  worldId: string;
  moduleId: string;
  config: ModuleConfig;
  rawConfig: ModuleConfig | null;
  terms: ModuleTerms;
  capabilities: PoliticsCapabilities;
  complexity: ComplexityLevel;

  entities: PoliticsEntity[];
  byId: Map<string, PoliticsEntity>;
  polities: PolityEntity[];
  organizations: OrganizationEntity[];
  figures: FigureEntity[];
  treaties: TreatyEntity[];
  submodules: SubmoduleV2[];
  items: ModuleItemV2[];
  links: WorldLink[];
  refs: EntityRefsResult;
  counts: Map<string, LinkCountEntry>;

  /**
   * 等级 / 状态定义：永远返回数组（空配置时为空数组），
   * 组件不需要到处写 `?? []`，也不会把「未配置」和「未加载」混为一谈。
   */
  levels: LevelDef[];
  statuses: StatusDef[];

  /** §11.3 版图降级模式 */
  atlasMode: 'full' | 'folded' | 'matrix';
  atlasNodes: AtlasNodeView[];
  /** 独立 / 跨国势力带（含上溯不到政权的未归属组织） */
  independentForces: IndependentForceView[];
  /** 没有任何任职边的人物：名录的人物分组不包含它们，壳层单独给入口（§9） */
  unattachedFigures: FigureEntity[];
  /** 边层：全部一般关系边（不含条约缎带） */
  edgeViews: PoliticsEdgeView[];
  /** 边聚合视图（同一对节点同类边合并） */
  aggregatedEdges: AggregatedEdgeView[];
  ribbons: TreatyRibbonView[];

  rosterPolities: RosterPolityRow[];
  rosterIndependents: RosterIndependentRow[];
  rosterTreaties: RosterTreatyRow[];

  chronicleLanes: ChronicleLane[];
  chronicleTreatyBands: ChronicleTreatyBand[];
  /** 沿革时间刻度（可解析端点，最多 24 个） */
  chronicleSpans: ChronicleSpan[];
  /** 沿革时间范围（无数据时 undefined） */
  chronicleRange?: { start?: string; end?: string };

  /** submodule / item 读取 */
  itemsOf: (submoduleId: string | null | undefined) => ModuleItemV2[];
  itemByName: (submoduleId: string | null | undefined, name: string) => ModuleItemV2 | undefined;
  /** 关联计数（出链 + 入链） */
  countOf: (ref?: EntityRef | null) => number;
  countsOf: (ref?: EntityRef | null) => { out: number; in: number };
  linksOf: (ref?: EntityRef | null) => WorldLink[];
  /** 单实体详情（按 kind 组装分段） */
  detailOf: (entityId: string | null | undefined) => FocusDetailView | undefined;
  /** 某 ref 的 out / in 分组 */
  splitOf: (ref?: EntityRef | null) => { outgoing: WorldLink[]; incoming: WorldLink[] };
  /**
   * 检索（§5.5.4）：组件一律用它，不要直接调 selectors.matchesFilter，
   * 否则别名 / 关联类型 / 对端名称 / kind 专属字段不会进检索面。
   */
  filterMatches: (entity: PoliticsEntity, filter: PoliticsFilterState) => boolean;
  /** 失效世界级查询树（错误态重试按钮用） */
  refetch: () => void;

  /** 写操作 */
  createPolity: (values: PolityFormValues) => Promise<PoliticsMutationResult>;
  createOrganization: (values: OrganizationFormValues) => Promise<PoliticsMutationResult>;
  createFigure: (values: FigureFormValues) => Promise<PoliticsMutationResult>;
  createTreaty: (values: TreatyFormValues) => Promise<PoliticsMutationResult>;
  updateEntity: (
    entityId: string,
    values: Partial<PoliticsEntityForm> & {
      level?: string;
      status?: string;
      time?: PoliticsTimeSpan | null;
      note?: string;
      customFields?: Record<string, CustomFieldValue>;
      parentId?: string | null;
      /** §4.4 名录拖拽排序：落到 submodule.order_index */
      orderIndex?: number;
    },
    /**
     * kind 专属 meta：与上面的通用字段**一次 PUT** 合并提交。
     * 分两次写时第二次会用渲染期旧快照整包替换 meta，回滚第一次写的字段。
     */
    metaPatch?: Record<string, unknown>
  ) => Promise<void>;
  /**
   * 设置 / 更换 / 清除政权统治者（§5.2/§3.8.2）：
   * 写 `figure -> polity` 的 leads 边（figure 由 meta.characterId 关联全局角色），
   * 同一人物时更新既有边的职位与任期，换人时删旧边建新边。
   */
  setRuler: (polityId: string, ruler: RulerInput) => Promise<PoliticsMutationResult>;
  /** 改组织归属：校验成环与三层上限后替换 subordinate_to 边并重算 scope（§5.7） */
  changeOrganizationParent: (
    organizationId: string,
    parentRef: EntityRef | null
  ) => Promise<PoliticsMutationResult>;
  /** 只补 meta（拖拽改 scope、标记独立等） */
  updateMeta: (entityId: string, patch: Record<string, unknown>) => Promise<void>;
  /** 一次写入 meta 的完整合并结果（避免分两次 PUT 互相回滚） */
  updateMetaMerged: (
    entityId: string,
    patch: Record<string, unknown>,
    extraMeta?: Record<string, unknown>
  ) => Promise<void>;
  saveItem: (
    submoduleId: string,
    name: string,
    content: Record<string, unknown>
  ) => Promise<void>;
  deleteEntity: (entityId: string) => Promise<void>;
  /** §3.8.3：归属边变化后重算 scope */
  recalcScope: (organizationId: string) => Promise<PoliticsScope>;

  /** 关联写入（建边 / 改边 / 删边，统一走 world_links） */
  createLinks: (
    items: {
      linkType: string;
      target: EntityRef;
      label?: string;
      note?: string;
      time?: PoliticsTimeSpan;
      meta?: Record<string, unknown>;
    }[],
    source: EntityRef
  ) => Promise<{ created: number; skipped: number; failed: number }>;
  updateLink: (
    linkId: string,
    patch: {
      label?: string | null;
      /** 后端契约是 string | null：清空备注必须发 null（axios 会丢掉 undefined 键） */
      note?: string | null;
      time?: PoliticsTimeSpan | null;
      meta?: Record<string, unknown>;
    }
  ) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;

  canEdit: boolean;
  /** 实体写入（建组织 / 人物 / 条约、改归属、编辑边）在全部复杂度档位可用（§8.5.4） */
  canWriteEntities: boolean;
  isSaving: boolean;
  isLoading: boolean;
  isError: boolean;
}

/** 统治者输入：全局 Character + 任职信息（任职落在 figure -> polity 的 leads 边上） */
export interface RulerInput {
  characterId?: string;
  officeTitle?: string;
  start?: string;
  end?: string;
  isPrimary?: boolean;
}
