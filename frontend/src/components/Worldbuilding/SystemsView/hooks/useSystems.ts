/**
 * 体系数据层（Phase 3 P3-T5/T6）
 *
 * - 读取：世界详情内的 systems 模块 submodules/items + 世界级 links（批量）
 * - 归属与复用分离：节点 parent_id 指向 system；grant / cost 用 WorldLink 表达复用
 * - 阶梯：按 meta.rank 归一化排序；advances_to / requires 保存前做环路检测
 * - config：tierTerm / rankStep / nodeStyles / costFields 由 ModuleConfigPanel 显式保存
 */

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useComplexity } from '@/components/common/ComplexitySwitcher';
import type { ModuleItemV2, SubmoduleV2 } from '@/services/worldbuildingApi';
import {
  useCreateWorldLink,
  useDeleteWorldLink,
  useEntityRefs,
  useWorld,
  useWorldLinks,
  type EntityRefsResult,
} from '../../hooks';
import { mergeMeta, type ModuleConfig } from '../../shared/moduleConfig';
import { useModuleConfig, useModuleTerms, type ModuleTerms } from '../../shared/useModuleConfig';
import { useModuleEntities } from '../../shared/useModuleEntities';
import { useWorldLinkCountMap, type WorldLinkCountMap } from '../../shared/useLinkCountMap';
import { rankStepOf, resolveSystemsConfig, systemsKindDefs, tierTermOf } from '../config';
import {
  ABILITY_KIND,
  SYSTEM_KIND,
  TIER_KIND,
  buildCodexVolumes,
  buildStair,
  codexContentOf,
  grantSourcesOf,
  nextRankOf,
  normalizeTierRanks,
  sortTiersByRank,
  systemRefOf,
  toSystemNode,
  wouldCreateStairCycle,
  type CodexVolume,
  type StairModel,
  type SystemEntity,
  type SystemNode,
} from '../types';

export interface SystemFormValues {
  name: string;
  tagline?: string;
  categoryLabel?: string;
  icon?: string;
  color?: string;
  rankDirection?: 'ascending' | 'descending';
  description?: string;
}

export interface TierFormValues {
  name: string;
  rank?: number;
  branch?: string;
  breakthrough?: string;
  status?: string;
}

export interface MemberFormValues {
  name: string;
  kind: string;
  summary?: string;
  reusable?: boolean;
  magnitude?: string;
  costHint?: string;
}

export interface NodeEditPatch {
  name?: string;
  description?: string;
  kind?: string;
  meta?: Record<string, unknown>;
}

const clean = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const metaFromSystemForm = (values: SystemFormValues): Record<string, unknown> => {
  const meta: Record<string, unknown> = {};
  if (values.tagline !== undefined) meta.tagline = clean(values.tagline);
  if (values.categoryLabel !== undefined) meta.categoryLabel = clean(values.categoryLabel);
  if (values.icon !== undefined) meta.icon = clean(values.icon);
  if (values.color !== undefined) meta.color = clean(values.color);
  if (values.rankDirection !== undefined) meta.rankDirection = values.rankDirection;
  return meta;
};

export const metaFromTierForm = (values: TierFormValues): Record<string, unknown> => {
  const meta: Record<string, unknown> = {};
  if (values.rank !== undefined) meta.rank = values.rank;
  if (values.branch !== undefined) meta.branch = clean(values.branch);
  if (values.breakthrough !== undefined) meta.breakthrough = clean(values.breakthrough);
  if (values.status !== undefined) meta.status = clean(values.status);
  return meta;
};

export const metaFromMemberForm = (values: MemberFormValues): Record<string, unknown> => {
  const meta: Record<string, unknown> = { nodeType: values.kind };
  if (values.summary !== undefined) meta.summary = clean(values.summary);
  if (values.reusable !== undefined) meta.reusable = values.reusable;
  if (values.magnitude !== undefined) meta.magnitude = clean(values.magnitude);
  if (values.costHint !== undefined) meta.costHint = clean(values.costHint);
  return meta;
};

export interface UseSystemsResult {
  moduleId: string;
  config: ModuleConfig;
  rawConfig: ModuleConfig;
  terms: ModuleTerms;
  kinds: ReturnType<typeof systemsKindDefs>;
  tierTerm: string;
  rankStep: number;
  refs: EntityRefsResult;
  counts: WorldLinkCountMap;
  nodes: SystemNode[];
  systems: SystemEntity[];
  byId: Map<string, SystemNode>;
  systemById: (systemId: string) => SystemEntity | undefined;
  stairOf: (systemId: string) => StairModel;
  codexOf: (systemId: string) => CodexVolume[];
  itemsOf: (nodeId: string) => ModuleItemV2[];
  codexContent: (nodeId: string, itemName: string) => Record<string, unknown>;
  linksOfNode: (nodeId: string) => number;
  /** 通过 grants / costs 引用该节点的上游（复用提示） */
  grantSourcesOf: (nodeId: string) => SystemNode[];
  createSystem: (
    values: SystemFormValues,
    customFields?: Record<string, unknown>
  ) => Promise<SubmoduleV2>;
  updateSystem: (
    systemId: string,
    values: SystemFormValues,
    customFields?: Record<string, unknown>
  ) => Promise<unknown>;
  createTier: (systemId: string, values: TierFormValues) => Promise<SubmoduleV2>;
  /** 多行录入：每行一个阶位，rank 依次叠加在现有阶梯之后 */
  bulkCreateTiers: (systemId: string, names: string[]) => Promise<SubmoduleV2[]>;
  createMember: (
    systemId: string,
    values: MemberFormValues,
    grantFromTierId?: string
  ) => Promise<SubmoduleV2>;
  updateNode: (nodeId: string, patch: NodeEditPatch) => Promise<unknown>;
  updateTierMeta: (nodeId: string, patch: Record<string, unknown>) => Promise<unknown>;
  /** 上下移动阶位：只改 rank，不改归属。up = 提高 rank（与显示顺序无关） */
  moveTier: (systemId: string, tierId: string, direction: 'up' | 'down') => Promise<boolean>;
  /** 移动到指定位置（拖拽调序用；一次重排，无需反复单步移动） */
  moveTierTo: (systemId: string, tierId: string, targetIndex: number) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<void>;
  /** 建立体系内部连线；advances_to / requires 做环路与重复边校验 */
  createStairEdge: (
    systemId: string,
    sourceId: string,
    targetId: string,
    linkType: 'systems.advances_to' | 'systems.requires' | 'systems.grants',
    /** 刚创建、尚未进入 byId 的节点显式给出 kind，避免用到过期快照 */
    endpointKinds?: { sourceKind?: string; targetKind?: string }
  ) => Promise<{ ok: boolean; reason?: string }>;
  deleteLink: (linkId: string) => Promise<void>;
  saveCodexItem: (
    submoduleId: string,
    itemName: string,
    content: Record<string, unknown>
  ) => Promise<unknown>;
  canEdit: boolean;
  isSaving: boolean;
  isLoading: boolean;
  isError: boolean;
}

export const useSystems = (worldId?: string, moduleId?: string): UseSystemsResult => {
  const { level } = useComplexity();
  const { config: rawConfig } = useModuleConfig(worldId, moduleId);
  const config = useMemo(() => resolveSystemsConfig(rawConfig), [rawConfig]);
  const terms = useModuleTerms(config, worldId);

  const entities = useModuleEntities(worldId, moduleId);
  const worldQuery = useWorld(worldId);
  const refs = useEntityRefs(worldId, worldQuery.data?.project_id ?? undefined);
  const linksQuery = useWorldLinks(worldId);
  const counts = useWorldLinkCountMap(worldId);
  const createWorldLink = useCreateWorldLink(worldId);
  const deleteWorldLink = useDeleteWorldLink(worldId);

  const step = rankStepOf(config);

  const nodes = useMemo<SystemNode[]>(
    () =>
      [...entities.submodules]
        .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id))
        .map(toSystemNode),
    [entities.submodules]
  );

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);

  const systems = useMemo<SystemEntity[]>(
    () =>
      nodes
        .filter((node) => node.kind === SYSTEM_KIND && !node.parentId)
        .map((node) => {
          const stair = buildStair(nodes, links, node.id, step, node.systemMeta.rankDirection);
          return {
            id: node.id,
            name: node.name,
            meta: node.systemMeta,
            node,
            ref: systemRefOf(node.id, node.kind),
            tiers: stair.tiers,
            members: stair.members,
            nodeCount: stair.nodeCount,
            degraded: stair.degraded,
          };
        }),
    [nodes, links, step]
  );

  const stairOf = useCallback(
    (systemId: string) =>
      buildStair(
        nodes,
        links,
        systemId,
        step,
        byId.get(systemId)?.systemMeta.rankDirection ?? 'ascending'
      ),
    [byId, links, nodes, step]
  );

  const codexOf = useCallback(
    (systemId: string) =>
      buildCodexVolumes(stairOf(systemId), (nodeId) => {
        const node = byId.get(nodeId);
        return node ? counts.countOf(systemRefOf(node.id, node.kind)) : 0;
      }),
    [byId, counts, stairOf]
  );

  const createSystem = useCallback(
    async (values: SystemFormValues, customFields?: Record<string, unknown>) =>
      entities.createSubmodule({
        name: values.name.trim(),
        kind: SYSTEM_KIND,
        parentId: null,
        description: clean(values.description) ?? null,
        meta: mergeMeta(undefined, {
          ...metaFromSystemForm(values),
          ...(customFields && Object.keys(customFields).length > 0 ? { customFields } : {}),
        }),
        orderIndex: entities.nextOrderIndex(null),
      }),
    [entities]
  );

  const updateSystem = useCallback(
    async (
      systemId: string,
      values: SystemFormValues,
      customFields?: Record<string, unknown>
    ) => {
      const node = byId.get(systemId);
      if (!node) return undefined;
      return entities.updateSubmodule(systemId, {
        name: values.name.trim() || node.name,
        description:
          values.description === undefined ? undefined : clean(values.description) ?? null,
        // 单次写入：edit 路径同样把自定义字段并进同一个 PUT（Phase 3 修复）
        meta: mergeMeta(node.systemMeta.raw, {
          ...metaFromSystemForm(values),
          ...(customFields && Object.keys(customFields).length > 0 ? { customFields } : {}),
        }),
      });
    },
    [byId, entities]
  );

  const createTier = useCallback(
    async (systemId: string, values: TierFormValues) => {
      const rank = values.rank ?? nextRankOf(stairOf(systemId).tiers, step);
      return entities.createSubmodule({
        name: values.name.trim(),
        kind: TIER_KIND,
        parentId: systemId,
        meta: mergeMeta(undefined, metaFromTierForm({ ...values, rank })),
        orderIndex: entities.nextOrderIndex(systemId),
      });
    },
    [entities, stairOf, step]
  );

  const bulkCreateTiers = useCallback(
    async (systemId: string, names: string[]) => {
      const existing = stairOf(systemId).tiers;
      const base =
        existing.length === 0
          ? 0
          : Math.max(...existing.map((tier) => tier.tierMeta.rank));
      const created: SubmoduleV2[] = [];
      let index = 0;
      for (const raw of names) {
        const name = raw.trim();
        if (!name) continue;
        index += 1;
        const orderIndex = entities.nextOrderIndex(systemId) + index - 1;
        created.push(
          await entities.createSubmodule({
            name,
            kind: TIER_KIND,
            parentId: systemId,
            meta: { rank: base + index * step },
            orderIndex,
          })
        );
      }
      return created;
    },
    [entities, stairOf, step]
  );

  const createStairEdge = useCallback(
    async (
      systemId: string,
      sourceId: string,
      targetId: string,
      linkType: 'systems.advances_to' | 'systems.requires' | 'systems.grants',
      endpointKinds?: { sourceKind?: string; targetKind?: string }
    ): Promise<{ ok: boolean; reason?: string }> => {
      if (sourceId === targetId) return { ok: false, reason: '不能连接到自身' };
      const stair = stairOf(systemId);
      const shortType = linkType.slice('systems.'.length);
      if (
        stair.edges.some(
          (edge) =>
            edge.type === shortType &&
            edge.sourceId === sourceId &&
            edge.targetId === targetId
        )
      ) {
        return { ok: false, reason: '该连线已存在' };
      }
      const cascadeTypes = ['advances_to', 'requires'];
      if (cascadeTypes.includes(shortType)) {
        const sameKindEdges = stair.edges.filter((edge) => cascadeTypes.includes(edge.type));
        if (wouldCreateStairCycle(sameKindEdges, sourceId, targetId)) {
          return { ok: false, reason: '会形成环路，已阻止保存' };
        }
      }
      // 新建节点还没进 byId 时由调用方显式给出 kind，否则会误判「节点不存在」而静默丢边
      const sourceKind = endpointKinds?.sourceKind ?? byId.get(sourceId)?.kind;
      const targetKind = endpointKinds?.targetKind ?? byId.get(targetId)?.kind;
      if (!sourceKind || !targetKind) return { ok: false, reason: '节点不存在' };
      // 契约 §4：systems.grants 的目标只能是 ability（规则/代价另有归属），提前拦截避免 400
      if (linkType === 'systems.grants' && targetKind !== ABILITY_KIND) {
        return { ok: false, reason: '「赋予」只能指向能力节点' };
      }
      await createWorldLink.mutateAsync({
        source: systemRefOf(sourceId, sourceKind),
        target: systemRefOf(targetId, targetKind),
        link_type: linkType,
      });
      return { ok: true };
    },
    [byId, createWorldLink, stairOf]
  );

  const createMember = useCallback(
    async (systemId: string, values: MemberFormValues, grantFromTierId?: string) => {
      const created = await entities.createSubmodule({
        name: values.name.trim(),
        kind: values.kind,
        parentId: systemId,
        meta: mergeMeta(undefined, metaFromMemberForm(values)),
        orderIndex: entities.nextOrderIndex(systemId),
      });
      if (grantFromTierId) {
        // 建节点的同时自动建 grants（systems_ui_design §5.1.3）；目标 kind 用返回值，不用旧快照
        const result = await createStairEdge(systemId, grantFromTierId, created.id, 'systems.grants', {
          targetKind: values.kind,
        });
        if (!result.ok && values.kind !== ABILITY_KIND) {
          toast.info(`${values.kind} 节点已创建；「赋予」只连能力节点，可在关联面板手动补充关联。`);
        } else if (!result.ok && result.reason) {
          toast.error(result.reason);
        }
      }
      return created;
    },
    [createStairEdge, entities]
  );

  const updateNode = useCallback(
    async (nodeId: string, patch: NodeEditPatch) => {
      const node = byId.get(nodeId);
      if (!node) return undefined;
      return entities.updateSubmodule(nodeId, {
        name: patch.name === undefined ? undefined : patch.name.trim() || node.name,
        description: patch.description,
        kind: patch.kind,
        meta: patch.meta ? mergeMeta(node.submodule.meta, patch.meta) : undefined,
      });
    },
    [byId, entities]
  );

  /**
   * 把阶位移动到指定位置（rank 升序索引）并归一化写回。
   * 上移/下移与拖拽共用：拖拽可以直接给目标索引，不必反复调用单步移动
   * （单步实现依赖当次渲染快照，连续调用会在同一快照上重复计算）。
   */
  const moveTierTo = useCallback(
    async (systemId: string, tierId: string, targetIndex: number): Promise<boolean> => {
      const stair = stairOf(systemId);
      const normalized = normalizeTierRanks(stair.tiers, step);
      const order = sortTiersByRank(stair.tiers, normalized, 'ascending');
      const from = order.findIndex((tier) => tier.id === tierId);
      if (from < 0) return false;
      const to = Math.max(0, Math.min(order.length - 1, targetIndex));
      if (to === from) return false;

      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      // 归一化写回：按位置重排 rank（步长耗尽或重复 rank 时自动修正）
      for (let position = 0; position < next.length; position += 1) {
        const tier = next[position];
        const rank = (position + 1) * step;
        if (tier.tierMeta.rank === rank) continue;
        await entities.updateSubmodule(tier.id, {
          meta: { ...(tier.submodule.meta ?? {}), rank },
        });
      }
      return true;
    },
    [entities, stairOf, step]
  );

  /**
   * 上移/下移：语义按**视觉/rank**定义（up = 提高 rank，即阶梯上移），
   * 与体系的 rankDirection 显示顺序无关，避免降序体系里按钮反向。
   */
  const moveTier = useCallback(
    async (systemId: string, tierId: string, direction: 'up' | 'down') => {
      const stair = stairOf(systemId);
      const normalized = normalizeTierRanks(stair.tiers, step);
      const ascending = sortTiersByRank(stair.tiers, normalized, 'ascending');
      const index = ascending.findIndex((tier) => tier.id === tierId);
      if (index < 0) return false;
      return moveTierTo(systemId, tierId, direction === 'up' ? index + 1 : index - 1);
    },
    [moveTierTo, stairOf, step]
  );

  return {
    moduleId: moduleId ?? '',
    config,
    rawConfig,
    terms,
    kinds: systemsKindDefs(config),
    tierTerm: tierTermOf(config),
    rankStep: step,
    refs,
    counts,
    nodes,
    systems,
    byId,
    systemById: (systemId) => systems.find((item) => item.id === systemId),
    stairOf,
    codexOf,
    itemsOf: (nodeId) => entities.itemsOf(nodeId),
    codexContent: (nodeId, itemName) => codexContentOf(entities.items, nodeId, itemName),
    linksOfNode: (nodeId) => {
      const node = byId.get(nodeId);
      return node ? counts.countOf(systemRefOf(node.id, node.kind)) : 0;
    },
    grantSourcesOf: (nodeId) => {
      const parentId = byId.get(nodeId)?.parentId;
      if (!parentId) return [];
      return grantSourcesOf(stairOf(parentId).edges, nodeId)
        .map((edge) => byId.get(edge.sourceId))
        .filter((node): node is SystemNode => !!node);
    },
    createSystem,
    updateSystem,
    createTier,
    bulkCreateTiers,
    createMember,
    updateNode,
    updateTierMeta: (nodeId, patch) => {
      const node = byId.get(nodeId);
      if (!node) return Promise.resolve(undefined);
      return entities.updateSubmodule(nodeId, {
        meta: mergeMeta(node.submodule.meta, patch),
      });
    },
    moveTier,
    moveTierTo,
    deleteNode: (nodeId) => entities.deleteSubmodule(nodeId),
    createStairEdge,
    deleteLink: (linkId) => deleteWorldLink.mutateAsync(linkId).then(() => undefined),
    saveCodexItem: (submoduleId, itemName, content) => {
      const existing = entities.itemByName(submoduleId, itemName);
      const merged = { ...(existing?.content ?? {}), ...content };
      return entities.saveItem({ submoduleId, name: itemName, content: merged });
    },
    canEdit: level !== 'sketch',
    isSaving: entities.isSaving,
    isLoading: entities.isLoading,
    isError: entities.isError,
  };
};

export type { CodexVolume, StairModel, SystemEntity, SystemNode };
