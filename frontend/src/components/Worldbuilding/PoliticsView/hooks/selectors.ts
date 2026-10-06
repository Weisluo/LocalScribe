/**
 * 政治视图派生选择器（Phase 4 P4-T2；politics_ui_design §2.1/§3.5/§3.8/§3.9/§4.2/§4.4/§4.5/§11.3）
 *
 * 全部为纯函数：输入世界级 lists（submodules / items / links）+ 配置，
 * 输出聚合视图。组件与 hook 都不再自行聚合，测试可脱离 React 直接断言这些不变量。
 */

import type { EntityRef, ModuleItemV2, SubmoduleV2, WorldLink } from '@/services/worldbuildingApi';
import type { ComplexityLevel } from '@/components/common/ComplexitySwitcher';
import type { EntityRefsResult } from '../../hooks/useEntityRefs';
import { POLITICS_CAPABILITIES, type PoliticsCapabilities } from '../types';
import type { EntityTypeDef, ModuleConfig, StatusDef } from '../../shared/moduleConfig';
import { kindDefsOf } from '../../shared/moduleConfig';
import type {
  AggregatedEdgeView,
  AtlasNodeView,
  ChronicleAnchorView,
  ChronicleLane,
  ChronicleSpan,
  ChronicleTreatyBand,
  FigureDetailView,
  FocusDetailView,
  IndependentForceView,
  OrganizationDetailView,
  PolityDetailView,
  PoliticsEdgeView,
  PoliticsFilterState,
  RosterIndependentRow,
  RosterPolityRow,
  RosterTreatyRow,
  TreatyDetailView,
} from './politicsTypes';
import {
  CHRONICLE_HISTORY_LINK_TYPES,
  CONTAINMENT_LINK_TYPES,
  ECONOMY_BASE_LINK_TYPES,
  FIGURE_KIND,
  LEGACY_TREATY_LINK_TYPE,
  ORGANIZATION_KIND,
  POLITICS_BUILTIN_KINDS,
  POLITICS_LINK_TYPES,
  POLITICS_MODULE,
  POLITICS_RELATION_LAYERS,
  POLITY_KIND,
  SIGNATORY_LINK_TYPE,
  TENURE_LINK_TYPES,
  TREATY_KIND,
  atlasRingOf,
  atlasSizeTier,
  attachmentOf,
  chronicleEntriesOf,
  cleanText,
  coreFiguresOf,
  demographicsOf,
  economyBaseOf,
  figuresOf,
  figureIdentityOf,
  governmentOf,
  isLegacyTreatyLink,
  isTerminalStatus,
  legacyTreatyEdges,
  normalizeScope,
  orgDoctrineOf,
  orgStructureOf,
  organizationsOf,
  politiesOf,
  politicsRefOf,
  projectSignatories,
  readFigureMeta,
  readOrganizationMeta,
  readPolityMeta,
  readPoliticsMeta,
  readTreatyMeta,
  resolveOrganizationScope,
  tenureBandsOf,
  toPoliticsEntity,
  treatiesOf,
  treatyAmendmentsOf,
  treatyStatusOf,
  treatyTermsOf,
  weightOf,
  type ChronicleEntry,
  type FigureEntity,
  type FigureTenureBand,
  type OrganizationEntity,
  type PolityEntity,
  type PoliticsEntity,
  type PoliticsScope,
  type PoliticsTimeSpan,
  type TreatyEntity,
  type TreatyPartyView,
  type TreatyRibbonView,
} from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (meta: unknown, key: string): string | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'string' && value ? value : undefined;
};

const readNumber = (meta: unknown, key: string): number | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

/** WorldLink.time 允许 null 端点（后端自由 JSON）；归一化成 PoliticsTimeSpan 或 undefined */
const timeSpanOf = (time: WorldLink['time']): PoliticsTimeSpan | undefined => {
  if (!time) return undefined;
  const start = time.start ?? undefined;
  const end = time.end ?? undefined;
  return start || end ? { start: start ?? undefined, end: end ?? undefined } : undefined;
};

/** 同模块内某 ref 是否指向给定 id（kind 由调用方另行判断） */
const sameEntity = (ref: EntityRef, id: string): boolean =>
  ref.module === POLITICS_MODULE && ref.id === id;

export interface SelectorInput {
  submodules: SubmoduleV2[];
  items: ModuleItemV2[];
  links: WorldLink[];
  config: ModuleConfig;
  levels: ModuleConfig['levels'];
  statuses: StatusDef[];
  refs: EntityRefsResult;
  complexity: ComplexityLevel;
}

/* ------------------------------------------------------------------ *
 * 基础拆解
 * ------------------------------------------------------------------ */

export const politicsCapabilitiesOf = (level: ComplexityLevel): PoliticsCapabilities =>
  POLITICS_CAPABILITIES[level];

/** 全部政治实体（自定义 kind 一并返回，由调用方按形态归类） */
export const buildEntities = (submodules: SubmoduleV2[]): PoliticsEntity[] =>
  submodules.map(toPoliticsEntity);

export interface PoliticIndex {
  entities: PoliticsEntity[];
  byId: Map<string, PoliticsEntity>;
  polities: PolityEntity[];
  organizations: OrganizationEntity[];
  figures: FigureEntity[];
  treaties: TreatyEntity[];
  /** 自定义 kind 实体（附着层由 config 决定） */
  customs: PoliticsEntity[];
  /** 自定义 kind 中附着层为 satellite / independent 的部分：参与「势力」形态（§7.1.2/§7.1.5） */
  customForces: PoliticsEntity[];
  customKindIds: string[];
}

export const buildIndex = (
  entities: PoliticsEntity[],
  kindDefs: EntityTypeDef[] = []
): PoliticIndex => {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const customKindIds = [
    ...new Set(
      entities
        .map((entity) => entity.kind)
        .filter((kind) => ![POLITY_KIND, ORGANIZATION_KIND, FIGURE_KIND, TREATY_KIND].includes(kind))
    ),
  ];
  const kindDefById = new Map(kindDefs.map((def) => [def.id, def]));
  const customs = entities.filter((entity) => customKindIds.includes(entity.kind));
  const customForces = customs.filter((entity) => {
    const def = kindDefById.get(entity.kind);
    // 未登记的 kind 无法判断附着层：按「势力」呈现，避免实体在三个主视图里彻底消失
    return def ? attachmentOf(def) !== 'edge' : true;
  });
  return {
    entities,
    byId,
    polities: politiesOf(entities),
    organizations: organizationsOf(entities),
    figures: figuresOf(entities),
    treaties: treatiesOf(entities),
    customs,
    customForces,
    customKindIds,
  };
};

/** 单实体出 / 入链分组（同时判对端，避免把无关关联误计入入链） */
export const splitForRef = (
  links: WorldLink[],
  ref: EntityRef
): { outgoing: WorldLink[]; incoming: WorldLink[] } => {
  const outgoing: WorldLink[] = [];
  const incoming: WorldLink[] = [];
  for (const link of links) {
    // 废弃条约边由展示层转换为 signatory_of（§3.8.1）：不再作为一般关联计数，避免重复计入
    if (link.link_type === LEGACY_TREATY_LINK_TYPE) continue;
    if (
      link.source.module === ref.module &&
      link.source.kind === ref.kind &&
      link.source.id === ref.id
    ) {
      outgoing.push(link);
    } else if (
      link.target.module === ref.module &&
      link.target.kind === ref.kind &&
      link.target.id === ref.id
    ) {
      incoming.push(link);
    }
  }
  return { outgoing, incoming };
};

export const countForRef = (links: WorldLink[], ref: EntityRef): { out: number; in: number } => {
  const grouped = splitForRef(links, ref);
  return { out: grouped.outgoing.length, in: grouped.incoming.length };
};

/* ------------------------------------------------------------------ *
 * 归属：组织 -> 政权
 * ------------------------------------------------------------------ */

export interface OwnershipIndex {
  /** polityId -> 卫星组织（scope = intra_polity 且上溯到该政权） */
  satellitesOfPolity: Map<string, OrganizationEntity[]>;
  /** organizationId -> 直接上级政权 id 列表 */
  politiesOfOrganization: Map<string, string[]>;
  /** organizationId -> 直接上级组织 id 列表 */
  orgParentsOf: Map<string, string[]>;
  /** organizationId -> scope（按边推导，尊重显式 independent） */
  scopeOf: Map<string, PoliticsScope>;
  /** cross_polity 组织 -> 吸附政权 id 列表 */
  anchorsOf: Map<string, string[]>;
  /** 上溯不到任何政权的组织：不得在版图 / 名录里静默消失（§9） */
  unattachedOf: OrganizationEntity[];
}

const pushInto = (map: Map<string, string[]>, key: string, value: string) => {
  const bucket = map.get(key);
  if (bucket) {
    if (!bucket.includes(value)) bucket.push(value);
  } else {
    map.set(key, [value]);
  }
};

export const buildOwnership = (
  links: WorldLink[],
  polities: PolityEntity[],
  organizations: OrganizationEntity[]
): OwnershipIndex => {
  const polityIds = new Set(polities.map((item) => item.id));
  const orgIds = new Set(organizations.map((item) => item.id));
  const politiesOfOrganization = new Map<string, string[]>();
  const orgParentsOf = new Map<string, string[]>();

  for (const link of links) {
    if (link.source.module !== POLITICS_MODULE || !orgIds.has(link.source.id)) continue;
    const isSubordinate = link.link_type === POLITICS_LINK_TYPES.subordinateTo;
    const isMember = link.link_type === POLITICS_LINK_TYPES.memberOf;
    if (!isSubordinate && !isMember) continue;
    if (link.target.kind === POLITY_KIND && polityIds.has(link.target.id)) {
      pushInto(politiesOfOrganization, link.source.id, link.target.id);
    } else if (
      isSubordinate &&
      link.target.kind === ORGANIZATION_KIND &&
      orgIds.has(link.target.id)
    ) {
      pushInto(orgParentsOf, link.source.id, link.target.id);
    }
  }

  const scopeOf = new Map<string, PoliticsScope>();
  const anchorsOf = new Map<string, string[]>();
  const satellitesOfPolity = new Map<string, OrganizationEntity[]>();
  const unattachedOf: OrganizationEntity[] = [];

  for (const org of organizations) {
    const declared = normalizeScope((org.meta as { scope?: unknown }).scope);
    // 唯一实现：selectors 与写入路径（recalcScope）共用同一推导，不再有两套口径
    const resolved = resolveOrganizationScope(links, org.id, declared);
    scopeOf.set(org.id, resolved.scope);
    if (resolved.anchors.length > 1) anchorsOf.set(org.id, resolved.anchors);
    if (resolved.unattached) {
      unattachedOf.push(org);
      continue;
    }
    if (resolved.scope === 'intra_polity' && resolved.anchors.length === 1) {
      const bucket = satellitesOfPolity.get(resolved.anchors[0]);
      if (bucket) bucket.push(org);
      else satellitesOfPolity.set(resolved.anchors[0], [org]);
    }
  }
  for (const [, list] of satellitesOfPolity) {
    list.sort(
      (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'zh-Hans-CN')
    );
  }
  unattachedOf.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  return {
    satellitesOfPolity,
    politiesOfOrganization,
    orgParentsOf,
    scopeOf,
    anchorsOf,
    unattachedOf,
  };
};

/* ------------------------------------------------------------------ *
 * 条约缎带
 * ------------------------------------------------------------------ */

export const buildRibbons = (
  treaties: TreatyEntity[],
  links: WorldLink[],
  statuses: StatusDef[],
  refs: EntityRefsResult
): TreatyRibbonView[] => {
  const projected = projectSignatories(links, refs.resolveName);
  return treaties.map((treaty) => {
    const parties = projected.get(treaty.id) ?? [];
    const partyIds = parties
      .filter((party) => party.ref.module === POLITICS_MODULE)
      .map((party) => party.ref.id);
    return {
      treaty,
      parties,
      anchorA: partyIds[0] ?? '',
      anchorB: partyIds.length > 1 ? partyIds[1] : undefined,
      line: 'double' as const,
      color: 'green' as const,
      status: treatyStatusOf(treaty, statuses),
    };
  });
};

/** 某政权 / 组织作为缔约方的缎带 */
export const ribbonsOfEntity = (
  ribbons: TreatyRibbonView[],
  entityId: string
): TreatyRibbonView[] =>
  ribbons.filter((ribbon) => ribbon.parties.some((party) => party.ref.id === entityId));

/* ------------------------------------------------------------------ *
 * 版图
 * ------------------------------------------------------------------ */

/** 某政权核心人物：leads / member_of 出链指向该政权的人物 */
export const figuresOfPolity = (
  figures: FigureEntity[],
  links: WorldLink[],
  polityId: string
): FigureEntity[] =>
  figures.filter((figure) =>
    links.some(
      (link) =>
        TENURE_LINK_TYPES.includes(link.link_type) &&
        sameEntity(link.source, figure.id) &&
        link.target.module === POLITICS_MODULE &&
        link.target.id === polityId
    )
  );

/**
 * 任职边子集（figure -> 政权 / 组织）：一次过滤后复用。
 * 否则 figuresOfPolity / tenureBandsTo 会在每个政权、每个人物上重扫全表，
 * 200 政权规模退化成 O(P·F·L)（§11.2 要求派生结果缓存、避免重复全表扫描）。
 */
const tenureLinksOf = (links: WorldLink[]): WorldLink[] =>
  links.filter(
    (link) =>
      TENURE_LINK_TYPES.includes(link.link_type) &&
      link.source.module === POLITICS_MODULE &&
      link.target.module === POLITICS_MODULE
  );

/** 某人物的任职带中，指向给定实体的那些（编辑任期即编辑边） */
export const tenureBandsTo = (
  links: WorldLink[],
  figureId: string,
  targetId: string
): FigureTenureBand[] =>
  tenureBandsOf(links, figureId).filter((band) => {
    const link = links.find((candidate) => candidate.id === band.edgeId);
    return !!link && link.target.id === targetId;
  });

/** 没有任何任职边的人物：不属于任何政权 / 组织，名录的人物分组不会包含它（§9 不静默丢失）。 */
export const buildUnattachedFigures = (
  figures: FigureEntity[],
  links: WorldLink[]
): FigureEntity[] => {
  const attached = new Set<string>();
  for (const link of links) {
    if (!TENURE_LINK_TYPES.includes(link.link_type)) continue;
    if (link.source.module !== POLITICS_MODULE) continue;
    attached.add(link.source.id);
  }
  return figures
    .filter((figure) => !attached.has(figure.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
};

export const buildAtlasNodes = (
  input: SelectorInput,
  index: PoliticIndex,
  ownership: OwnershipIndex,
  ribbons: TreatyRibbonView[]
): AtlasNodeView[] => {
  const weights = index.polities.map((polity) =>
    weightOf((polity.meta as { level?: string }).level, input.levels ?? [])
  );
  const tenureLinks = tenureLinksOf(input.links);
  return index.polities
    .map((polity) => {
      const weight = weightOf((polity.meta as { level?: string }).level, input.levels ?? []);
      const figures = figuresOfPolity(index.figures, tenureLinks, polity.id);
      const bands = figures.flatMap((figure) => tenureBandsTo(tenureLinks, figure.id, polity.id));
      return {
        polity,
        weight,
        sizeTier: atlasSizeTier(weight, weights),
        ring: atlasRingOf(weight, weights),
        satellites: ownership.satellitesOfPolity.get(polity.id) ?? [],
        coreFigures: coreFiguresOf(figures, tenureLinks, 5),
        figures,
        tenureBands: bands,
        ribbons: ribbonsOfEntity(ribbons, polity.id),
        relationCount: countForRef(input.links, politicsRefOf(polity.id, polity.kind)),
        terminal: isTerminalStatus(
          (polity.meta as { status?: string }).status,
          input.statuses ?? []
        ),
      } satisfies AtlasNodeView;
    })
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.polity.order_index - b.polity.order_index ||
        a.polity.name.localeCompare(b.polity.name, 'zh-Hans-CN')
    );
};

/**
 * 独立势力带（§2.2 第 2 层 / §4.2.3）：跨国势力、显式独立势力，以及**上溯不到政权**的组织。
 *
 * 后两类过去既不进卫星簇也不进势力带，实体会在版图与名录里静默消失（§9 不允许）。
 * 自定义 kind 中附着层为 satellite / independent 的实体同样按势力呈现（§7.1.2/§7.1.5）。
 */
export const buildIndependentForces = (
  index: PoliticIndex,
  ownership: OwnershipIndex,
  links: WorldLink[]
): IndependentForceView[] => {
  const unattachedIds = new Set(ownership.unattachedOf.map((org) => org.id));
  const memberCounts = new Map<string, number>();
  for (const link of links) {
    if (link.link_type !== POLITICS_LINK_TYPES.memberOf) continue;
    if (link.source.module !== POLITICS_MODULE) continue;
    memberCounts.set(link.source.id, (memberCounts.get(link.source.id) ?? 0) + 1);
  }

  const forces: IndependentForceView[] = [];
  for (const org of index.organizations) {
    const scope = ownership.scopeOf.get(org.id) ?? 'independent';
    const unattached = unattachedIds.has(org.id);
    if (!unattached && scope !== 'cross_polity' && scope !== 'independent') continue;
    forces.push({
      entity: org,
      scope: unattached ? 'independent' : scope,
      anchors: ownership.anchorsOf.get(org.id) ?? [],
      unattached,
      memberCount: memberCounts.get(org.id) ?? 0,
    });
  }
  for (const custom of index.customForces) {
    const declared = normalizeScope((custom.meta as { scope?: unknown }).scope);
    const resolved = resolveOrganizationScope(links, custom.id, declared);
    if (resolved.scope === 'intra_polity' && !resolved.unattached) continue;
    forces.push({
      entity: custom,
      scope: resolved.scope,
      anchors: resolved.anchors,
      unattached: resolved.unattached,
      memberCount: memberCounts.get(custom.id) ?? 0,
    });
  }
  return forces.sort(
    (a, b) =>
      Number(a.scope === 'independent') - Number(b.scope === 'independent') ||
      Number(a.unattached ?? false) - Number(b.unattached ?? false) ||
      a.entity.name.localeCompare(b.entity.name, 'zh-Hans-CN')
  );
};

/* ------------------------------------------------------------------ *
 * 关系边（条约缎带单独图层，§4.7.2）
 * ------------------------------------------------------------------ */

const RELATION_TYPE_IDS: string[] = POLITICS_RELATION_LAYERS.map((layer) => layer.id as string);

export const buildEdgeViews = (
  input: SelectorInput,
  index: PoliticIndex
): PoliticsEdgeView[] => {
  const treatyIds = new Set(index.treaties.map((treaty) => treaty.id));
  const edges: PoliticsEdgeView[] = [];
  for (const link of input.links) {
    if (isLegacyTreatyLink(link)) continue;
    if (link.link_type === SIGNATORY_LINK_TYPE) continue;
    if (!RELATION_TYPE_IDS.includes(link.link_type)) continue;
    if (link.source.module !== POLITICS_MODULE || link.target.module !== POLITICS_MODULE) continue;
    // §2.1 补充规则 4：条约永不参与政权排序，也不画一般关系边
    if (treatyIds.has(link.source.id) || treatyIds.has(link.target.id)) continue;
    const layer = POLITICS_RELATION_LAYERS.find((candidate) => candidate.id === link.link_type);
    const meta = isRecord(link.meta) ? link.meta : {};
    edges.push({
      link,
      linkType: link.link_type,
      label: link.label || layer?.label || link.link_type,
      from: link.source,
      to: link.target,
      directed: link.directed,
      lineStyle: layer?.lineStyle ?? 'solid',
      color: layer?.color ?? 'neutral',
      icon: layer?.icon ?? 'link',
      strength: readNumber(meta, 'strength'),
      note: link.note ?? undefined,
      time: timeSpanOf(link.time),
      dangling: !index.byId.has(link.source.id) || !index.byId.has(link.target.id),
    });
  }
  return edges;
};

/** §11.3 边聚合：同一对 (from, to, linkType) 合并为一条 */
export const aggregateEdges = (edges: PoliticsEdgeView[]): AggregatedEdgeView[] => {
  const map = new Map<string, AggregatedEdgeView>();
  for (const edge of edges) {
    const key = `${edge.linkType}|${edge.from.kind}:${edge.from.id}|${edge.to.kind}:${edge.to.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.memberIds.push(edge.link.id);
      if (edge.strength !== undefined) existing.strength = edge.strength;
      continue;
    }
    map.set(key, {
      key,
      linkType: edge.linkType,
      label: edge.label,
      from: edge.from,
      to: edge.to,
      directed: edge.directed,
      lineStyle: edge.lineStyle,
      color: edge.color,
      icon: edge.icon,
      memberIds: [edge.link.id],
      strength: edge.strength,
      dangling: edge.dangling,
    });
  }
  return [...map.values()];
};

/* ------------------------------------------------------------------ *
 * 名录
 * ------------------------------------------------------------------ */

export const buildRosterPolities = (
  input: SelectorInput,
  index: PoliticIndex,
  ownership: OwnershipIndex,
  ribbons: TreatyRibbonView[]
): RosterPolityRow[] => {
  const tenureLinks = tenureLinksOf(input.links);
  const linkById = new Map(input.links.map((link) => [link.id, link]));
  return index.polities
    .map((polity) => {
      const organizations = ownership.satellitesOfPolity.get(polity.id) ?? [];
      const figures = figuresOfPolity(index.figures, tenureLinks, polity.id);
      const figureRows = figures.map((entity) => {
        const bands = tenureBandsOf(tenureLinks, entity.id);
        const relevant =
          bands.find((band) => linkById.get(band.edgeId)?.target.id === polity.id) ?? bands[0];
        return {
          entity,
          office: relevant?.officeTitle ?? '',
          start: relevant?.start,
          end: relevant?.end,
          isPrimary: relevant?.isPrimary ?? false,
        };
      });
      return {
        polity,
        weight: weightOf((polity.meta as { level?: string }).level, input.levels ?? []),
        organizations,
        figures: figureRows,
        counts: countForRef(input.links, politicsRefOf(polity.id, polity.kind)),
        satelliteCount: organizations.length,
        figureCount: figures.length,
        treatyCount: ribbonsOfEntity(ribbons, polity.id).length,
        terminal: isTerminalStatus(
          (polity.meta as { status?: string }).status,
          input.statuses ?? []
        ),
        legacy: (polity.meta as { legacy?: boolean }).legacy === true,
      } satisfies RosterPolityRow;
    })
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.polity.order_index - b.polity.order_index ||
        a.polity.name.localeCompare(b.polity.name, 'zh-Hans-CN')
    );
};

export const buildRosterIndependents = (
  index: PoliticIndex,
  ownership: OwnershipIndex,
  links: WorldLink[]
): RosterIndependentRow[] =>
  buildIndependentForces(index, ownership, links).map((force) => ({
    entity: force.entity as OrganizationEntity,
    scope: force.scope,
    unattached: force.unattached,
    memberCount: force.memberCount,
    counts: countForRef(links, politicsRefOf(force.entity.id, force.entity.kind)),
  }));

export const buildRosterTreaties = (
  input: SelectorInput,
  ribbons: TreatyRibbonView[]
): RosterTreatyRow[] =>
  ribbons.map((ribbon) => ({
    treaty: ribbon.treaty,
    status: ribbon.status,
    parties: ribbon.parties,
    termCount: treatyTermsOf(input.items, ribbon.treaty.id).length,
    amendmentCount: treatyAmendmentsOf(input.items, ribbon.treaty.id).length,
    counts: countForRef(input.links, politicsRefOf(ribbon.treaty.id, ribbon.treaty.kind)),
  }));

/* ------------------------------------------------------------------ *
 * 沿革
 * ------------------------------------------------------------------ */

/** 历史关联的入链（history.* -> 政权 / 组织 / 人物） */
export const historyAnchorsOf = (
  input: SelectorInput,
  entityId: string,
  refs: EntityRefsResult
): ChronicleAnchorView[] => {
  const anchors: ChronicleAnchorView[] = [];
  for (const link of input.links) {
    if (!CHRONICLE_HISTORY_LINK_TYPES.includes(link.link_type)) continue;
    if (!sameEntity(link.target, entityId)) continue;
    anchors.push({
      id: link.id,
      label: refs.resolveName(link.source),
      time: timeSpanOf(link.time) ?? {},
      source: 'history',
      linkType: link.link_type,
      ref: link.source,
    });
  }
  return anchors;
};

/** 沿革锚点双来源：items.chronicle 的政治侧条目 + history.* 入链（§4.5.2） */
export const chronicleAnchorsOf = (
  input: SelectorInput,
  entityId: string,
  refs: EntityRefsResult
): ChronicleAnchorView[] => {
  const entries: ChronicleEntry[] = chronicleEntriesOf(input.items, entityId);
  const own: ChronicleAnchorView[] = entries.map((entry) => ({
    id: entry.id,
    label: entry.title,
    time: entry.time ?? {},
    source: 'chronicle',
    kindId: entry.kindId,
  }));
  const merged = [...own, ...historyAnchorsOf(input, entityId, refs)];
  return merged.sort(
    (a, b) =>
      (a.time.start ?? '').localeCompare(b.time.start ?? '') ||
      a.label.localeCompare(b.label, 'zh-Hans-CN')
  );
};

export const buildChronicleLanes = (
  input: SelectorInput,
  index: PoliticIndex,
  refs: EntityRefsResult
): ChronicleLane[] => {
  const laneEntities: PoliticsEntity[] = [...index.polities, ...index.organizations];
  return laneEntities
    .map((entity) => {
      const meta = entity.meta as { time?: PoliticsTimeSpan; status?: string; level?: string };
      return {
        entity,
        weight: weightOf(meta.level, input.levels ?? []),
        start: meta.time?.start,
        end: meta.time?.end,
        terminal: isTerminalStatus(meta.status, input.statuses ?? []),
        anchors: chronicleAnchorsOf(input, entity.id, refs),
        isOrganization: entity.kind === ORGANIZATION_KIND,
      } satisfies ChronicleLane;
    })
    .sort(
      (a, b) =>
        Number(a.isOrganization) - Number(b.isOrganization) ||
        b.weight - a.weight ||
        a.entity.name.localeCompare(b.entity.name, 'zh-Hans-CN')
    );
};

export const buildChronicleTreatyBands = (
  index: PoliticIndex,
  statuses: StatusDef[]
): ChronicleTreatyBand[] =>
  index.treaties
    .map((treaty) => {
      const meta = readTreatyMeta(treaty.meta);
      return {
        treaty,
        status: treatyStatusOf(treaty, statuses),
        start: meta.effectiveAt ?? meta.time?.start,
        end: meta.expiresAt ?? meta.time?.end,
      } satisfies ChronicleTreatyBand;
    })
    .sort((a, b) => (a.start ?? '~').localeCompare(b.start ?? '~'));

const parseStamp = (value?: string): number | undefined => {
  if (!value) return undefined;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? stamp : undefined;
};

/**
 * 沿革时间范围：只统计可解析端点。
 * 自定义写法（如「约三百年前」）无法比较，一律当「无时间」处理，不伪造刻度。
 */
export const chronicleRangeOf = (
  lanes: ChronicleLane[],
  bands: ChronicleTreatyBand[]
): { start?: string; end?: string } | undefined => {
  const stamps: number[] = [];
  const collect = (value?: string) => {
    const stamp = parseStamp(value);
    if (stamp !== undefined) stamps.push(stamp);
  };
  for (const lane of lanes) {
    collect(lane.start);
    collect(lane.end);
    for (const anchor of lane.anchors) {
      collect(anchor.time.start);
      collect(anchor.time.end);
    }
  }
  for (const band of bands) {
    collect(band.start);
    collect(band.end);
  }
  if (stamps.length === 0) return undefined;
  return {
    start: new Date(Math.min(...stamps)).toISOString(),
    end: new Date(Math.max(...stamps)).toISOString(),
  };
};

/** 沿革时间刻度：可解析端点去重排序，最多 24 个 */
export const chronicleSpansOf = (
  lanes: ChronicleLane[],
  bands: ChronicleTreatyBand[]
): ChronicleSpan[] => {
  const points = new Set<number>();
  const push = (value?: string) => {
    const stamp = parseStamp(value);
    if (stamp !== undefined) points.add(stamp);
  };
  for (const lane of lanes) {
    push(lane.start);
    push(lane.end);
    for (const anchor of lane.anchors) {
      push(anchor.time.start);
      push(anchor.time.end);
    }
  }
  for (const band of bands) {
    push(band.start);
    push(band.end);
  }
  return [...points]
    .sort((a, b) => a - b)
    .slice(0, 24)
    .map((stamp) => {
      const year = new Date(stamp).getFullYear();
      return { key: new Date(stamp).toISOString(), label: `${year}`, year };
    });
};

/* ------------------------------------------------------------------ *
 * 筛选
 * ------------------------------------------------------------------ */

/** 检索上下文：命中别名、关联类型与对端名称需要 world 级 links / items（§5.5.4） */
export interface FilterContext {
  links?: WorldLink[];
  refs?: EntityRefsResult;
  items?: ModuleItemV2[];
}

export const matchesFilter = (
  entity: PoliticsEntity,
  filter: PoliticsFilterState,
  context: FilterContext = {}
): boolean => {
  if (filter.kind !== 'all' && entity.kind !== filter.kind) return false;
  const meta = entity.meta as Record<string, unknown>;
  if (filter.level && meta.level !== filter.level) return false;
  if (filter.status && meta.status !== filter.status) return false;
  const keyword = filter.search.trim().toLowerCase();
  if (!keyword) return true;
  const customFields = isRecord(meta.customFields) ? meta.customFields : {};
  const customText = Object.values(customFields)
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  const tags = Array.isArray(meta.tags)
    ? meta.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const time = isRecord(meta.time) ? meta.time : {};
  const readMetaText = (key: string): string =>
    typeof meta[key] === 'string' ? (meta[key] as string) : '';
  const parts: string[] = [
    entity.name,
    entity.description ?? '',
    entity.kind,
    readMetaText('note'),
    readMetaText('level'),
    readMetaText('status'),
    // §5.5.4：政体 / 首府 / 组织类型 / 政治身份 / 条约类型等 kind 专属字段
    readMetaText('governmentFormLabel'),
    readMetaText('governmentFormId'),
    readMetaText('capitalLabel'),
    readMetaText('orgSubtypeId'),
    readMetaText('baseLabel'),
    readMetaText('identityLabel'),
    readMetaText('primaryOfficeLabel'),
    readMetaText('courtRank'),
    readMetaText('factionLabel'),
    readMetaText('treatyTypeId'),
    readMetaText('breachState'),
    tags.join('\n'),
    customText,
    [time.start, time.end, time.display]
      .filter((value): value is string => typeof value === 'string')
      .join(' '),
  ];

  // 人物：命中绑定的全局 Character 名称与政治别名（items.figure_identity，§3.3/§5.5.4）
  if (context.items) {
    const identity = figureIdentityOf(context.items, entity.id);
    if (identity.aliases && identity.aliases.length > 0) parts.push(identity.aliases.join('\n'));
  }
  if (context.refs && entity.kind === FIGURE_KIND) {
    const characterId = typeof meta.characterId === 'string' ? meta.characterId : '';
    if (characterId) {
      parts.push(
        context.refs.resolveName({ module: 'character', kind: 'character', id: characterId })
      );
    }
  }

  // 关联类型与对端名称：按「同盟 / 附庸于 / 签署 / 涉及 <实体名>」等也能搜到（§5.5.4）
  if (context.links) {
    for (const link of context.links) {
      const outgoing = sameEntity(link.source, entity.id);
      const incoming = !outgoing && sameEntity(link.target, entity.id);
      if (!outgoing && !incoming) continue;
      parts.push(link.link_type);
      if (context.refs) {
        parts.push(context.refs.resolveName(outgoing ? link.target : link.source));
      }
    }
  }

  return parts.join('\n').toLowerCase().includes(keyword);
};

export const filterPolities = (
  polities: PolityEntity[],
  filter: PoliticsFilterState,
  context: FilterContext = {}
): PolityEntity[] => polities.filter((polity) => matchesFilter(polity, filter, context));

/** 待转换的旧条约边（两端都是政权 / 组织，无法投影为缎带）：条约簿据此提示「N 条待转换」（§3.8.1）。 */
export const pendingLegacyTreatyEdges = (links: WorldLink[]): WorldLink[] =>
  legacyTreatyEdges(links);

/* ------------------------------------------------------------------ *
 * 详情分段
 * ------------------------------------------------------------------ */

const compactRefs = (
  links: WorldLink[],
  entityId: string,
  linkType: string,
  direction: 'in' | 'out',
  refs: EntityRefsResult
): { ref: EntityRef; label: string; link: WorldLink }[] =>
  links
    .filter((link) => {
      if (link.link_type !== linkType) return false;
      return direction === 'in'
        ? sameEntity(link.target, entityId)
        : sameEntity(link.source, entityId);
    })
    .map((link) => {
      const ref = direction === 'in' ? link.source : link.target;
      return { ref, label: refs.resolveName(ref), link };
    });

export const buildPolityDetail = (
  input: SelectorInput,
  index: PoliticIndex,
  ownership: OwnershipIndex,
  ribbons: TreatyRibbonView[],
  polity: PolityEntity
): PolityDetailView => {
  const { links, items, refs } = input;
  const organizations = ownership.satellitesOfPolity.get(polity.id) ?? [];
  const tenureLinks = tenureLinksOf(links);
  const figures = figuresOfPolity(index.figures, tenureLinks, polity.id);
  const tenureBands = figures.flatMap((figure) => tenureBandsTo(tenureLinks, figure.id, polity.id));
  const entityRibbons = ribbonsOfEntity(ribbons, polity.id);
  const meta = readPolityMeta(polity.meta);
  // 「政体」的唯一真源是 meta.governmentFormLabel（表单与名录写的就是它）；
  // items.government 只作旧数据兜底读取，避免详情与表单各读一套、永远显示为空。
  const government = governmentOf(items, polity.id);
  if (meta.governmentFormLabel) government.formLabel = meta.governmentFormLabel;

  const races = links
    .filter(
      (link) =>
        link.link_type === POLITICS_LINK_TYPES.includesRace && sameEntity(link.source, polity.id)
    )
    .map((link) => ({
      ref: link.target,
      label: refs.resolveName(link.target),
      share: readNumber(link.meta, 'share'),
      note: readString(link.meta, 'note'),
    }));

  const systems = links
    .filter(
      (link) => link.link_type === 'systems.practiced_by' && sameEntity(link.target, polity.id)
    )
    .map((link) => ({ ref: link.source, label: refs.resolveName(link.source) }));

  const economyLinks = ECONOMY_BASE_LINK_TYPES.map((def) => ({
    id: def.id,
    label: def.label,
    refs: links
      .filter((link) => link.link_type === def.id && sameEntity(link.target, polity.id))
      .map((link) => link.source),
  }));

  const historyEvents = CHRONICLE_HISTORY_LINK_TYPES.flatMap((linkType) =>
    compactRefs(links, polity.id, linkType, 'in', refs).map((entry) => ({
      ref: entry.ref,
      label: entry.label,
      linkType,
      time: timeSpanOf(entry.link.time),
    }))
  );

  const territories = compactRefs(
    links,
    polity.id,
    POLITICS_LINK_TYPES.controlsRegion,
    'out',
    refs
  ).map((entry) => entry.ref);
  const capital = links.find(
    (link) =>
      link.link_type === POLITICS_LINK_TYPES.capitalAt && sameEntity(link.source, polity.id)
  );

  return {
    meta: readPolityMeta(polity.meta),
    government,
    demographics: demographicsOf(items, polity.id),
    economyBase: economyBaseOf(items, polity.id),
    chronicle: chronicleEntriesOf(items, polity.id),
    organizations,
    figures,
    tenureBands,
    treaties: entityRibbons.map((ribbon) => ({ ribbon, parties: ribbon.parties })),
    territories,
    capital: capital?.target,
    races,
    systems,
    economyLinks,
    historyEvents,
    counts: countForRef(links, politicsRefOf(polity.id, polity.kind)),
  };
};

export const buildOrganizationDetail = (
  input: SelectorInput,
  index: PoliticIndex,
  ownership: OwnershipIndex,
  ribbons: TreatyRibbonView[],
  organization: OrganizationEntity
): OrganizationDetailView => {
  const { links, items, refs } = input;
  const meta = readOrganizationMeta(organization.meta);
  const parents = links
    .filter(
      (link) =>
        CONTAINMENT_LINK_TYPES.includes(link.link_type) &&
        sameEntity(link.source, organization.id)
    )
    .map((link) => ({
      ref: link.target,
      label: refs.resolveName(link.target),
      linkType: link.link_type,
    }));
  const children = index.organizations.filter(
    (candidate) => (candidate.parent_id ?? null) === organization.id
  );
  const members = index.figures.filter((figure) =>
    links.some(
      (link) =>
        TENURE_LINK_TYPES.includes(link.link_type) &&
        sameEntity(link.source, figure.id) &&
        sameEntity(link.target, organization.id)
    )
  );
  const tenureBands = members.flatMap((figure) =>
    tenureBandsTo(links, figure.id, organization.id)
  );
  const entityRibbons = ribbonsOfEntity(ribbons, organization.id);
  return {
    meta,
    doctrine: orgDoctrineOf(items, organization.id),
    structure: orgStructureOf(items, organization.id),
    chronicle: chronicleEntriesOf(items, organization.id),
    scope: ownership.scopeOf.get(organization.id) ?? normalizeScope(meta.scope),
    parents,
    children,
    members,
    tenureBands,
    treaties: entityRibbons.map((ribbon) => ({ ribbon, parties: ribbon.parties })),
    counts: countForRef(links, politicsRefOf(organization.id, organization.kind)),
  };
};

export const buildFigureDetail = (
  input: SelectorInput,
  figure: FigureEntity
): FigureDetailView => {
  const { links, items, refs } = input;
  const meta = readFigureMeta(figure.meta);
  const bands = tenureBandsOf(links, figure.id);
  const offices = bands.map((band) => {
    const link = links.find((candidate) => candidate.id === band.edgeId);
    const ref = link?.target;
    return { band, ref, label: ref ? refs.resolveName(ref) : '（关联已失效）' };
  });
  const character = meta.characterId
    ? refs.lookup({ module: 'character', kind: 'character', id: meta.characterId })
    : undefined;
  return {
    meta,
    identity: figureIdentityOf(items, figure.id),
    character,
    bands,
    offices,
    counts: countForRef(links, politicsRefOf(figure.id, figure.kind)),
  };
};

export const buildTreatyDetail = (
  input: SelectorInput,
  ribbons: TreatyRibbonView[],
  treaty: TreatyEntity
): TreatyDetailView => {
  const { items, statuses } = input;
  const ribbon = ribbons.find((candidate) => candidate.treaty.id === treaty.id);
  const parties: TreatyPartyView[] = ribbon?.parties ?? [];
  return {
    meta: readTreatyMeta(treaty.meta),
    status: treatyStatusOf(treaty, statuses),
    parties,
    terms: treatyTermsOf(items, treaty.id),
    amendments: treatyAmendmentsOf(items, treaty.id),
    singleParty: parties.length === 1,
    counts: countForRef(input.links, politicsRefOf(treaty.id, treaty.kind)),
  };
};

export const buildFocusDetail = (
  entity: PoliticsEntity | undefined,
  input: SelectorInput,
  index: PoliticIndex,
  ownership: OwnershipIndex,
  ribbons: TreatyRibbonView[]
): FocusDetailView | undefined => {
  if (!entity) return undefined;
  if (entity.kind === POLITY_KIND) {
    return {
      kind: 'polity',
      view: buildPolityDetail(input, index, ownership, ribbons, entity as PolityEntity),
    };
  }
  if (entity.kind === ORGANIZATION_KIND) {
    return {
      kind: 'organization',
      view: buildOrganizationDetail(
        input,
        index,
        ownership,
        ribbons,
        entity as OrganizationEntity
      ),
    };
  }
  if (entity.kind === FIGURE_KIND) {
    return { kind: 'figure', view: buildFigureDetail(input, entity as FigureEntity) };
  }
  if (entity.kind === TREATY_KIND) {
    return { kind: 'treaty', view: buildTreatyDetail(input, ribbons, entity as TreatyEntity) };
  }
  // 自定义 kind 按其**声明的附着层**分派（§7.1.2/§7.1.5）：
  // satellite / independent -> 组织式面板；edge -> 只读的通用面板，绝不冒充条约面板。
  const custom = entity as unknown as PoliticsEntity;
  const kindDef = kindDefsOf(input.config, POLITICS_BUILTIN_KINDS).find(
    (def) => def.id === custom.kind
  );
  const attachment = kindDef ? attachmentOf(kindDef) : 'edge';
  if (attachment !== 'edge' || ownership.scopeOf.has(custom.id)) {
    return {
      kind: 'organization',
      view: buildOrganizationDetail(input, index, ownership, ribbons, custom as OrganizationEntity),
    };
  }
  return {
    kind: 'unknown',
    view: {
      meta: readPoliticsMeta(custom.meta),
      counts: countForRef(input.links, politicsRefOf(custom.id, custom.kind)),
    },
  };
};

/* ------------------------------------------------------------------ *
 * 表单校验（§5.7 阻断级规则）
 * ------------------------------------------------------------------ */

/** 政权必填名称与等级；组织必填名称与 scope；人物必填 characterId；条约必填名称 */
export const validatePoliticsForm = (
  kind: string,
  values: { name?: string; level?: string; characterId?: string; scope?: string }
): string | null => {
  if (!cleanText(values.name)) return '名称不能为空';
  if (kind === POLITY_KIND && !cleanText(values.level)) return '政权必须选择等级';
  if (kind === ORGANIZATION_KIND && !values.scope) return '组织必须选择归属范围';
  if (kind === FIGURE_KIND && !cleanText(values.characterId)) return '人物必须绑定全局角色';
  return null;
};
