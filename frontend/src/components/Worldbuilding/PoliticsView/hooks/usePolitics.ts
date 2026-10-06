/**
 * 政治数据层（Phase 4 P4-T2；politics_ui_design §3.9/§4.2/§11.2）
 *
 * 读取：世界级 lists 一次取回（submodules / items / links 与 LinkPanel 共用 queryKey），
 *      全部聚合在客户端完成，禁止逐卡请求；派生结果由 useMemo 缓存。
 * 写入：submodule / item 通用 CRUD + world_links（唯一关系写入路径，D1）。
 *      meta 一律走 mergeMeta 合并，未知键不丢。
 * 关系：只写契约 §4 的 politics.* 类型；signatory_of 是缔约唯一规范边；
 *      figure.meta.characterId 不落 WorldLink。
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useComplexity } from '@/components/common/ComplexitySwitcher';
import type { EntityRef, SubmoduleV2, WorldLink } from '@/services/worldbuildingApi';
import {
  useCreateWorldLinks,
  useDeleteWorldLink,
  useEntityRefs,
  useUpdateWorldLink,
  useWorldLinks,
  worldbuildingKeys,
} from '../../hooks';
import { mergeMeta } from '../../shared/moduleConfig';
import type { ModuleConfig } from '../../shared/moduleConfig';
import { levelDefsOf, statusDefsOf } from '../../shared/moduleConfig';
import { useModuleConfig, useModuleTerms } from '../../shared/useModuleConfig';
import { useModuleEntities } from '../../shared/useModuleEntities';
import { useWorldLinkCountMap } from '../../shared/useLinkCountMap';
import { useWorld } from '../../hooks/useWorldData';
import { politicsKindDefs, resolvePoliticsConfig } from '../config';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_MAX_ORG_DEPTH,
  POLITY_KIND,
  POLITICS_LINK_TYPES,
  POLITICS_MODULE,
  SIGNATORY_LINK_TYPE,
  TREATY_KIND,
  atlasDegradeMode,
  cleanText,
  deriveScope,
  entityRefOf,
  normalizeScope,
  orgEdgeDepthOf,
  orgSubtreeHeight,
  politicsRefOf,
  readPolityMeta,
  resolveOrganizationScope,
  toPoliticsEntity,
  wouldCreateOrgLinkCycle,
  type FigureEntity,
  type FigureMeta,
  type PoliticsEntity,
  type PoliticsScope,
} from '../types';
import type {
  FigureFormValues,
  OrganizationFormValues,
  PolityFormValues,
  PoliticsEntityForm,
  PoliticsFilterState,
  PoliticsMutationResult,
  RulerInput,
  TreatyFormValues,
  UsePoliticsResult,
} from './politicsTypes';
import {
  aggregateEdges,
  buildAtlasNodes,
  buildChronicleLanes,
  buildChronicleTreatyBands,
  buildEdgeViews,
  buildEntities,
  buildFocusDetail,
  buildIndex,
  buildIndependentForces,
  buildOwnership,
  buildRibbons,
  buildRosterIndependents,
  buildRosterPolities,
  buildRosterTreaties,
  buildUnattachedFigures,
  chronicleRangeOf,
  chronicleSpansOf,
  countForRef,
  matchesFilter,
  politicsCapabilitiesOf,
  splitForRef,
  type SelectorInput,
} from './selectors';

const asRefList = (refs: (EntityRef | null | undefined)[]): EntityRef[] =>
  refs.filter((ref): ref is EntityRef => !!ref && !!ref.id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const timeOf = (start?: string, end?: string) => {
  const from = cleanText(start);
  const to = cleanText(end);
  return from || to ? { start: from, end: to } : null;
};

export const usePolitics = (worldId?: string, moduleId?: string): UsePoliticsResult => {
  const { level } = useComplexity();
  const queryClient = useQueryClient();
  const { config: rawConfig } = useModuleConfig(worldId, moduleId);
  const config = useMemo<ModuleConfig>(() => resolvePoliticsConfig(rawConfig), [rawConfig]);
  const terms = useModuleTerms(config, worldId);

  const entitiesStore = useModuleEntities(worldId, moduleId);
  const worldQuery = useWorld(worldId);
  const linksQuery = useWorldLinks(worldId);
  const countsMap = useWorldLinkCountMap(worldId);
  const refsResult = useEntityRefs(worldId, worldQuery.data?.project_id ?? undefined);

  const createLinksMutation = useCreateWorldLinks(worldId);
  const updateLinkMutation = useUpdateWorldLink(worldId);
  const deleteLinkMutation = useDeleteWorldLink(worldId);

  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  // levelDefsOf / statusDefsOf 已做「配置 + 内置兜底」合并；政治不预置内置，故未配置时为空数组
  const levels = useMemo(() => levelDefsOf(config), [config]);
  const statuses = useMemo(() => statusDefsOf(config), [config]);

  const entities = useMemo(() => buildEntities(entitiesStore.submodules), [entitiesStore.submodules]);
  const kindDefs = useMemo(() => politicsKindDefs(config), [config]);
  const index = useMemo(() => buildIndex(entities, kindDefs), [entities, kindDefs]);
  const ownership = useMemo(
    () => buildOwnership(links, index.polities, index.organizations),
    [links, index]
  );

  const selectorInput = useMemo<SelectorInput>(
    () => ({
      submodules: entitiesStore.submodules,
      items: entitiesStore.items,
      links,
      config,
      levels,
      statuses,
      refs: refsResult,
      complexity: level,
    }),
    [entitiesStore.submodules, entitiesStore.items, links, config, levels, statuses, refsResult, level]
  );

  const ribbons = useMemo(
    () => buildRibbons(index.treaties, links, statuses, refsResult),
    [index.treaties, links, statuses, refsResult]
  );
  const edgeViews = useMemo(() => buildEdgeViews(selectorInput, index), [selectorInput, index]);
  const aggregatedEdges = useMemo(() => aggregateEdges(edgeViews), [edgeViews]);
  const atlasMode = useMemo(
    () => atlasDegradeMode(index.polities.length, edgeViews.length),
    [index.polities.length, edgeViews.length]
  );
  // 矩阵档由 MatrixFallback 直接消费 index，不需要版图聚合：
  // 跳过它才不会在「已经决定降级」时仍付出 O(P·F·L) 的代价（§11.3）。
  const atlasNodes = useMemo(
    () => (atlasMode === 'matrix' ? [] : buildAtlasNodes(selectorInput, index, ownership, ribbons)),
    [atlasMode, selectorInput, index, ownership, ribbons]
  );
  const independentForces = useMemo(
    () => buildIndependentForces(index, ownership, links),
    [index, ownership, links]
  );
  const unattachedFigures = useMemo(
    () => buildUnattachedFigures(index.figures, links),
    [index.figures, links]
  );

  const rosterPolities = useMemo(
    () => buildRosterPolities(selectorInput, index, ownership, ribbons),
    [selectorInput, index, ownership, ribbons]
  );
  const rosterIndependents = useMemo(
    () => buildRosterIndependents(index, ownership, links),
    [index, ownership, links]
  );
  const rosterTreaties = useMemo(
    () => buildRosterTreaties(selectorInput, ribbons),
    [selectorInput, ribbons]
  );

  const chronicleLanes = useMemo(
    () => buildChronicleLanes(selectorInput, index, refsResult),
    [selectorInput, index, refsResult]
  );
  const chronicleTreatyBands = useMemo(
    () => buildChronicleTreatyBands(index, statuses),
    [index, statuses]
  );
  const chronicleRange = useMemo(
    () => chronicleRangeOf(chronicleLanes, chronicleTreatyBands),
    [chronicleLanes, chronicleTreatyBands]
  );
  const chronicleSpans = useMemo(
    () => chronicleSpansOf(chronicleLanes, chronicleTreatyBands),
    [chronicleLanes, chronicleTreatyBands]
  );

  /* ---------------- 写操作 ---------------- */

  const createEntity = useCallback(
    async (
      kind: string,
      form: PoliticsEntityForm,
      meta: Record<string, unknown>
    ): Promise<SubmoduleV2> =>
      entitiesStore.createSubmodule({
        name: form.name.trim(),
        kind,
        description: cleanText(form.description) ?? null,
        icon: cleanText(form.icon) ?? null,
        color: cleanText(form.color) ?? null,
        meta: mergeMeta(undefined, meta),
        orderIndex: form.orderIndex ?? entitiesStore.nextOrderIndex(null),
      }),
    [entitiesStore]
  );

  /** 批量建边；409（等价边已存在）计入 skipped，其余失败只累计不抛（已成功的部分也会刷新缓存） */
  const writeLinks = useCallback(
    async (
      source: EntityRef,
      items: { linkType: string; target: EntityRef; label?: string; note?: string; time?: { start?: string; end?: string } | null; meta?: Record<string, unknown> }[]
    ): Promise<{ created: number; skipped: number; failed: number }> => {
      const payload = items
        .filter((item) => item.target && item.target.id)
        .map((item) => ({
          world_id: worldId ?? '',
          source,
          target: item.target,
          link_type: item.linkType,
          label: item.label,
          note: item.note,
          time: item.time ?? undefined,
          meta: item.meta,
        }));
      if (payload.length === 0) return { created: 0, skipped: 0, failed: 0 };
      const result = await createLinksMutation.mutateAsync(payload);
      return { created: result.created.length, skipped: result.skipped.length, failed: result.failed.length };
    },
    [createLinksMutation, worldId]
  );

  /**
   * 取（必要时新建）某全局角色在本模块的政治人物投影。
   *
   * §3.8.2 / §6.6：统治者是 figure 实体（meta.characterId），任职只落在
   * `figure -> polity` 的 leads 边上。旧实现直接写 `polity -> character` 的 leads，
   * 契约不允许（registry：leads 源必须是 figure），后端必然 400。
   */
  const ensureFigureForCharacter = useCallback(
    async (characterId: string): Promise<FigureEntity> => {
      const existing = index.figures.find(
        (figure) => (figure.meta as FigureMeta).characterId === characterId
      );
      if (existing) return existing;
      const name =
        refsResult.resolveName({ module: 'character', kind: 'character', id: characterId }) ||
        '未命名人物';
      const created = await createEntity(
        FIGURE_KIND,
        { kind: FIGURE_KIND, name, orderIndex: entitiesStore.nextOrderIndex(null) },
        { characterId }
      );
      return toPoliticsEntity(created) as FigureEntity;
    },
    [createEntity, entitiesStore, index.figures, refsResult]
  );

  /**
   * 设置 / 更换 / 清除政权的统治者（§5.2）。
   * 同一人物时改职位与任期会更新既有 leads 边；换人时删旧边、建新边。
   */
  const setRuler = useCallback(
    async (polityId: string, ruler: RulerInput): Promise<PoliticsMutationResult> => {
      const entity = index.byId.get(polityId);
      if (!entity) throw new Error('政权不存在或已被删除');
      const current = links.find(
        (link) =>
          link.link_type === POLITICS_LINK_TYPES.leads &&
          link.source.module === POLITICS_MODULE &&
          link.source.kind === FIGURE_KIND &&
          link.target.module === POLITICS_MODULE &&
          link.target.id === polityId
      );
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      const asSubmodule = entity as unknown as SubmoduleV2;
      const characterId = cleanText(ruler.characterId);

      if (!characterId) {
        if (current) await deleteLinkMutation.mutateAsync(current.id);
        return { entity: asSubmodule, skippedLinks, failedLinks };
      }

      const figure = await ensureFigureForCharacter(characterId);
      const meta = {
        ...(isRecord(current?.meta) ? current.meta : {}),
        officeTitle: cleanText(ruler.officeTitle),
        isPrimary: ruler.isPrimary !== false,
      };
      const time = timeOf(ruler.start, ruler.end);

      if (current && current.source.id === figure.id) {
        await updateLinkMutation.mutateAsync({
          linkId: current.id,
          data: { time: time ?? undefined, meta },
        });
        return { entity: asSubmodule, skippedLinks, failedLinks };
      }
      if (current) await deleteLinkMutation.mutateAsync(current.id);
      const result = await writeLinks(entityRefOf(figure), [
        {
          linkType: POLITICS_LINK_TYPES.leads,
          target: politicsRefOf(polityId, POLITY_KIND),
          time,
          meta,
        },
      ]);
      if (result.skipped > 0) skippedLinks.push(POLITICS_LINK_TYPES.leads);
      if (result.failed > 0) failedLinks.push(POLITICS_LINK_TYPES.leads);
      return { entity: asSubmodule, skippedLinks, failedLinks };
    },
    [
      deleteLinkMutation,
      ensureFigureForCharacter,
      index.byId,
      links,
      updateLinkMutation,
      writeLinks,
    ]
  );

  /** 组织归属校验（§5.7/§7.1.3）：不得成环、不得超过三层。新建时 organizationId 传 null。 */
  const assertOrgParentAllowed = useCallback(
    (organizationId: string | null, parentRef: EntityRef): void => {
      if (parentRef.module !== POLITICS_MODULE) return;
      if (parentRef.kind !== ORGANIZATION_KIND) return;
      if (organizationId && wouldCreateOrgLinkCycle(links, organizationId, parentRef.id)) {
        throw new Error('上级不能是自己或自己的下级组织（组织树不得成环）');
      }
      const parentDepth = orgEdgeDepthOf(links, parentRef.id);
      const subtreeHeight = organizationId ? orgSubtreeHeight(links, organizationId) : 1;
      if (parentDepth + subtreeHeight > POLITICS_MAX_ORG_DEPTH) {
        throw new Error(`组织树最多 ${POLITICS_MAX_ORG_DEPTH} 层，当前挂载会超过上限`);
      }
    },
    [links]
  );

  const createPolity = useCallback(
    async (values: PolityFormValues): Promise<PoliticsMutationResult> => {
      const meta = {
        level: cleanText(values.level),
        status: cleanText(values.status),
        time: values.time,
        note: cleanText(values.note),
        tags: values.tags && values.tags.length > 0 ? values.tags : undefined,
        governmentFormLabel: cleanText(values.governmentFormLabel),
        capitalLabel: cleanText(values.capitalLabel),
        population: values.population,
        populationYear: cleanText(values.populationYear),
        customFields:
          values.customFields && Object.keys(values.customFields).length > 0
            ? values.customFields
            : undefined,
      };
      const entity = await createEntity(POLITY_KIND, values, meta);
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      if (values.rulerCharacterId) {
        // §5.2：统治者保存时写 figure -> polity 的 leads 边；任期与职位在边上
        const rulerFigure = await ensureFigureForCharacter(values.rulerCharacterId);
        const result = await writeLinks(entityRefOf(rulerFigure), [
          {
            linkType: POLITICS_LINK_TYPES.leads,
            target: entityRefOf(entity),
            time: timeOf(values.rulerStart, values.rulerEnd),
            meta: {
              officeTitle: cleanText(values.rulerOfficeTitle),
              isPrimary: values.rulerIsPrimary !== false,
            },
          },
        ]);
        if (result.skipped > 0) skippedLinks.push(POLITICS_LINK_TYPES.leads);
        if (result.failed > 0) failedLinks.push(POLITICS_LINK_TYPES.leads);
      }
      return { entity, skippedLinks, failedLinks };
    },
    [createEntity, ensureFigureForCharacter, writeLinks]
  );

  const createOrganization = useCallback(
    async (values: OrganizationFormValues): Promise<PoliticsMutationResult> => {
      const scope = normalizeScope(values.scope);
      const meta = {
        scope,
        level: cleanText(values.level),
        status: cleanText(values.status),
        time: values.time,
        note: cleanText(values.note),
        orgSubtypeId: cleanText(values.orgSubtypeId),
        baseLabel: cleanText(values.baseLabel),
        influenceNote: cleanText(values.influenceNote),
        customFields:
          values.customFields && Object.keys(values.customFields).length > 0
            ? values.customFields
            : undefined,
      };
      const entity = await createEntity(ORGANIZATION_KIND, values, meta);
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      if (values.parentRef) {
        // §3.8.3：组织归属只走 subordinate_to（目标为政权或上级组织）；
        // 挂上级组织前先校验成环与深度（§5.7/§7.1.3），避免写出不可见 / 成环的树
        assertOrgParentAllowed(null, values.parentRef);
        const linkType = POLITICS_LINK_TYPES.subordinateTo;
        const result = await writeLinks(entityRefOf(entity), [
          { linkType, target: values.parentRef },
        ]);
        if (result.skipped > 0) skippedLinks.push(linkType);
        if (result.failed > 0) failedLinks.push(linkType);
      }
      return { entity, skippedLinks, failedLinks };
    },
    [assertOrgParentAllowed, createEntity, writeLinks]
  );

  const createFigure = useCallback(
    async (values: FigureFormValues): Promise<PoliticsMutationResult> => {
      const meta = {
        characterId: values.characterId,
        identityLabel: cleanText(values.identityLabel),
        courtRank: cleanText(values.courtRank),
        factionLabel: cleanText(values.factionLabel),
        primaryOfficeLabel: cleanText(values.officeTitle),
        note: cleanText(values.note),
        time: values.time,
        customFields:
          values.customFields && Object.keys(values.customFields).length > 0
            ? values.customFields
            : undefined,
      };
      const entity = await createEntity(FIGURE_KIND, values, meta);
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      if (values.officeRef) {
        const linkType =
          values.officeLinkType ??
          (values.officeIsPrimary === false
            ? POLITICS_LINK_TYPES.memberOf
            : POLITICS_LINK_TYPES.leads);
        const result = await writeLinks(entityRefOf(entity), [
          {
            linkType,
            target: values.officeRef,
            time: timeOf(values.officeStart, values.officeEnd),
            meta: {
              officeTitle: cleanText(values.officeTitle),
              isPrimary: values.officeIsPrimary !== false,
            },
          },
        ]);
        if (result.skipped > 0) skippedLinks.push(linkType);
        if (result.failed > 0) failedLinks.push(linkType);
      }
      return { entity, skippedLinks, failedLinks };
    },
    [createEntity, writeLinks]
  );

  const createTreaty = useCallback(
    async (values: TreatyFormValues): Promise<PoliticsMutationResult> => {
      const meta = {
        status: cleanText(values.status),
        time: values.time,
        treatyTypeId: cleanText(values.treatyTypeId),
        effectiveAt: cleanText(values.effectiveAt) ?? values.time?.start,
        expiresAt: cleanText(values.expiresAt) ?? values.time?.end,
        breachState: cleanText(values.breachState),
        visibility: cleanText(values.visibility),
        summary: cleanText(values.summary),
        customFields:
          values.customFields && Object.keys(values.customFields).length > 0
            ? values.customFields
            : undefined,
      };
      const entity = await createEntity(TREATY_KIND, values, meta);
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      const parties = asRefList(values.parties);
      if (parties.length > 0) {
        // §3.8.1：signatory_of 是缔约唯一规范边（源 = 政权 / 组织，目标 = 条约）
        const result = await createLinksMutation.mutateAsync(
          parties.map((party) => ({
            world_id: worldId ?? '',
            source: party,
            target: entityRefOf(entity),
            link_type: SIGNATORY_LINK_TYPE,
            time: timeOf(values.effectiveAt, values.expiresAt) ?? undefined,
            directed: true,
          }))
        );
        if (result.skipped.length > 0) skippedLinks.push(SIGNATORY_LINK_TYPE);
        if (result.failed.length > 0) failedLinks.push(SIGNATORY_LINK_TYPE);
      }
      return { entity, skippedLinks, failedLinks };
    },
    [createEntity, createLinksMutation, worldId]
  );

  const updateMetaMerged = useCallback(
    async (entityId: string, patch: Record<string, unknown>, extraMeta?: Record<string, unknown>) => {
      const current = index.byId.get(entityId);
      const base = current?.meta as Record<string, unknown> | undefined;
      const merged = mergeMeta(base, { ...patch, ...(extraMeta ?? {}) });
      await entitiesStore.updateSubmodule(entityId, { meta: merged });
    },
    [entitiesStore, index.byId]
  );

  const updateEntity = useCallback<UsePoliticsResult['updateEntity']>(
    async (entityId, values, metaPatch) => {
      const patch: Record<string, unknown> = {};
      if (values.level !== undefined) patch.level = cleanText(values.level);
      if (values.status !== undefined) patch.status = cleanText(values.status);
      if (values.note !== undefined) patch.note = cleanText(values.note);
      if (values.time !== undefined) patch.time = values.time ?? undefined;
      if (values.customFields !== undefined) {
        patch.customFields =
          Object.keys(values.customFields).length > 0 ? values.customFields : undefined;
      }
      const submodulePatch: Parameters<typeof entitiesStore.updateSubmodule>[1] = {};
      if (values.name !== undefined) submodulePatch.name = values.name.trim();
      if (values.description !== undefined) {
        submodulePatch.description = cleanText(values.description) ?? null;
      }
      if (values.icon !== undefined) submodulePatch.icon = cleanText(values.icon) ?? null;
      if (values.color !== undefined) submodulePatch.color = cleanText(values.color) ?? null;
      if (values.parentId !== undefined) submodulePatch.parentId = values.parentId;
      // §4.4：名录政权行可拖拽调整 order_index，必须落到 submodule 而不是 meta
      if (values.orderIndex !== undefined) submodulePatch.orderIndex = values.orderIndex;
      // 通用字段与 kind 专属 meta 必须**一次 PUT**合并提交：后端 PUT 整包替换 meta，
      // 分两次写时第二次会用渲染期旧快照把第一次写的字段回滚（Phase 3 已踩过的坑）。
      const mergedPatch = { ...patch, ...(metaPatch ?? {}) };
      if (Object.keys(mergedPatch).length > 0) {
        const current = index.byId.get(entityId);
        submodulePatch.meta = mergeMeta(current?.meta, mergedPatch);
      }
      if (Object.keys(submodulePatch).length === 0) return;
      await entitiesStore.updateSubmodule(entityId, submodulePatch);
    },
    [entitiesStore, index.byId]
  );

  const updateMeta = useCallback(
    async (entityId: string, patch: Record<string, unknown>) => {
      await updateMetaMerged(entityId, patch);
    },
    [updateMetaMerged]
  );

  const recalcScope = useCallback(
    async (organizationId: string): Promise<PoliticsScope> => {
      // 注意：这里读的是当前渲染快照 links。归属边刚写完就调用会算到旧状态，
      // 因此改归属一律走 changeOrganizationParent（它按「写入后的边集合」重算）。
      const entity = index.byId.get(organizationId);
      const declared = normalizeScope((entity?.meta as { scope?: unknown } | undefined)?.scope);
      const next = deriveScope(organizationId, links, declared);
      const current = (entity?.meta as { scope?: unknown } | undefined)?.scope;
      if (next !== current) {
        await updateMetaMerged(organizationId, { scope: next });
      }
      return next;
    },
    [index.byId, links, updateMetaMerged]
  );

  /**
   * 改归属：校验成环与深度后，整体替换 subordinate_to 边并重算 scope（§3.8.3/§5.7）。
   * 先删后建，避免同时存在两条归属边导致 scope 推导漂移。
   */
  const changeOrganizationParent = useCallback(
    async (
      organizationId: string,
      parentRef: EntityRef | null
    ): Promise<PoliticsMutationResult> => {
      const entity = index.byId.get(organizationId);
      if (!entity) throw new Error('组织不存在或已被删除');
      if (parentRef) assertOrgParentAllowed(organizationId, parentRef);
      const current = links.filter(
        (link) =>
          link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
          link.source.module === POLITICS_MODULE &&
          link.source.id === organizationId
      );
      for (const link of current) await deleteLinkMutation.mutateAsync(link.id);
      const skippedLinks: string[] = [];
      const failedLinks: string[] = [];
      if (parentRef) {
        const result = await writeLinks(politicsRefOf(organizationId, ORGANIZATION_KIND), [
          { linkType: POLITICS_LINK_TYPES.subordinateTo, target: parentRef },
        ]);
        if (result.skipped > 0) skippedLinks.push(POLITICS_LINK_TYPES.subordinateTo);
        if (result.failed > 0) failedLinks.push(POLITICS_LINK_TYPES.subordinateTo);
      }
      // scope 必须按「写入后的边集合」重算：此刻 links 快照还没有新边，
      // 直接用 recalcScope 会算出旧归属（甚至未归属），把 meta.scope 写错。
      const declared = normalizeScope((entity.meta as { scope?: unknown }).scope);
      const projected = [
        ...links.filter(
          (link) =>
            !(
              link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
              link.source.module === POLITICS_MODULE &&
              link.source.id === organizationId
            )
        ),
        ...(parentRef
          ? [
              {
                id: '__pending_parent',
                world_id: worldId ?? '',
                source: politicsRefOf(organizationId, ORGANIZATION_KIND),
                target: parentRef,
                link_type: POLITICS_LINK_TYPES.subordinateTo,
                directed: true,
                label: null,
                note: null,
                meta: null,
                time: null,
              } as WorldLink,
            ]
          : []),
      ];
      const nextScope = resolveOrganizationScope(projected, organizationId, declared).scope;
      if (nextScope !== (entity.meta as { scope?: unknown }).scope) {
        await updateMetaMerged(organizationId, { scope: nextScope });
      }
      return { entity: entity as unknown as SubmoduleV2, skippedLinks, failedLinks };
    },
    [
      assertOrgParentAllowed,
      deleteLinkMutation,
      index.byId,
      links,
      updateMetaMerged,
      worldId,
      writeLinks,
    ]
  );

  const saveItem = useCallback(
    async (submoduleId: string, name: string, content: Record<string, unknown>) => {
      const existing = entitiesStore.itemByName(submoduleId, name);
      const merged = { ...(existing?.content ?? {}), ...content };
      await entitiesStore.saveItem({ submoduleId, name, content: merged });
    },
    [entitiesStore]
  );

  const deleteEntity = useCallback(
    async (entityId: string) => {
      await entitiesStore.deleteSubmodule(entityId);
    },
    [entitiesStore]
  );

  const detailOf = useCallback<UsePoliticsResult['detailOf']>(
    (entityId) => buildFocusDetail(entityId ? index.byId.get(entityId) : undefined, selectorInput, index, ownership, ribbons),
    [index, selectorInput, ownership, ribbons]
  );

  const countOf = useCallback(
    (ref?: EntityRef | null) => (ref ? countsMap.countOf(ref) : 0),
    [countsMap]
  );

  const countsOf = useCallback(
    (ref?: EntityRef | null) => (ref ? countForRef(links, ref) : { out: 0, in: 0 }),
    [links]
  );

  const linksOf = useCallback(
    (ref?: EntityRef | null) => (ref ? [...splitForRef(links, ref).outgoing, ...splitForRef(links, ref).incoming] : []),
    [links]
  );

  const splitOf = useCallback<UsePoliticsResult['splitOf']>(
    (ref) => (ref ? splitForRef(links, ref) : { outgoing: [], incoming: [] }),
    [links]
  );

  /**
   * 检索：把 world 级 links / items / refs 作为上下文传进去，
   * 这样别名、关联类型、对端名称、kind 专属字段都能命中（§5.5.4）。
   */
  const filterMatches = useCallback(
    (entity: PoliticsEntity, filterState: PoliticsFilterState) =>
      matchesFilter(entity, filterState, {
        links,
        refs: refsResult,
        items: entitiesStore.items,
      }),
    [entitiesStore.items, links, refsResult]
  );

  /** 失败态重试：失效整个世界级查询树（§7.3 要求错误态有行动按钮） */
  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
    void queryClient.invalidateQueries({ queryKey: ['worldbuilding'] });
  }, [queryClient]);

  return {
    worldId: worldId ?? '',
    moduleId: moduleId ?? '',
    config,
    rawConfig,
    terms,
    capabilities: politicsCapabilitiesOf(level),
    complexity: level,

    entities,
    byId: index.byId,
    polities: index.polities,
    organizations: index.organizations,
    figures: index.figures,
    treaties: index.treaties,
    submodules: entitiesStore.submodules,
    items: entitiesStore.items,
    links,
    refs: refsResult,
    counts: countsMap.counts,

    levels,
    statuses,

    atlasMode,
    atlasNodes,
    independentForces,
    unattachedFigures,
    edgeViews,
    aggregatedEdges,
    ribbons,

    rosterPolities,
    rosterIndependents,
    rosterTreaties,

    chronicleLanes,
    chronicleTreatyBands,
    chronicleSpans,
    chronicleRange,

    itemsOf: (submoduleId) => entitiesStore.itemsOf(submoduleId),
    itemByName: (submoduleId, name) => entitiesStore.itemByName(submoduleId, name),
    countOf,
    countsOf,
    linksOf,
    detailOf,
    splitOf,
    filterMatches,
    refetch,

    createPolity,
    createOrganization,
    createFigure,
    createTreaty,
    updateEntity,
    updateMeta,
    updateMetaMerged,
    setRuler,
    changeOrganizationParent,
    saveItem,
    deleteEntity,
    recalcScope,

    createLinks: async (items, source) => writeLinks(source, items),
    updateLink: async (linkId, patch) => {
      await updateLinkMutation.mutateAsync({ linkId, data: patch });
    },
    deleteLink: async (linkId) => {
      await deleteLinkMutation.mutateAsync(linkId);
    },

    // 复杂度档位只收敛「模块配置」编辑；实体写入在全部档位都可用（§8.2/§8.5.4：
    // 档位只改变可见细节，不改变数据语义，也不该让速写档无法建组织 / 人物 / 条约）。
    canEdit: level !== 'sketch',
    canWriteEntities: true,
    isSaving:
      entitiesStore.isSaving ||
      createLinksMutation.isPending ||
      updateLinkMutation.isPending ||
      deleteLinkMutation.isPending,
    isLoading: entitiesStore.isLoading || linksQuery.isLoading,
    isError: entitiesStore.isError || linksQuery.isError,
  };
};

export const politicsRef = politicsRefOf;
export const readPolity = readPolityMeta;