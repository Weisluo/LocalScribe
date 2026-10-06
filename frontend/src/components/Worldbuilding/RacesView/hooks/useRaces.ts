/**
 * 种族数据层（Phase 3 P3-T2）
 *
 * - 读取：世界详情内的 races 模块 submodules/items + 世界级 links（批量，不逐卡请求）
 * - 写入：submodule/item 通用 CRUD；meta 合并保留未知字段；层级只用 parent_id
 * - 血缘：parent_id 实线由 submodule 树给出，races.related_to 由 links 给出（对称单条）
 * - 复杂度：sketch 只读写最小路径（名称 + 一句话 + 代表色），structure 起启用血缘与完整字段
 */

import { useCallback, useMemo } from 'react';

import { useComplexity } from '@/components/common/ComplexitySwitcher';
import type { ModuleItemV2, SubmoduleV2 } from '@/services/worldbuildingApi';
import {
  useEntityRefs,
  useWorld,
  useWorldLinks,
  type EntityRefsResult,
} from '../../hooks';
import { mergeMeta, type ModuleConfig } from '../../shared/moduleConfig';
import { useModuleConfig, useModuleTerms, type ModuleTerms } from '../../shared/useModuleConfig';
import { useModuleEntities } from '../../shared/useModuleEntities';
import { useWorldLinkCountMap, type WorldLinkCountMap } from '../../shared/useLinkCountMap';
import { resolveRacesConfig, racesKindDefs } from '../config';
import {
  RACE_KIND,
  SUBRACE_KIND,
  atlasContentOf,
  buildLineage,
  canReparent,
  flattenRaceTree,
  raceRefOf,
  type LineageModel,
  type RaceMeta,
  type RaceNode,
} from '../types';

export interface RaceFormValues {
  name: string;
  kind?: string;
  tagline?: string;
  traits?: string[];
  emblemIcon?: string;
  emblemColor?: string;
  habitatText?: string;
  originText?: string;
  status?: string;
  description?: string;
}

const clean = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** 表单 -> meta patch（未填字段不写入，避免覆盖已有值） */
export const metaFromRaceForm = (values: RaceFormValues): Record<string, unknown> => {
  const meta: Record<string, unknown> = {};
  if (values.tagline !== undefined) meta.tagline = clean(values.tagline);
  if (values.traits !== undefined) {
    const traits = values.traits.map((item) => item.trim()).filter(Boolean);
    meta.traits = traits.length > 0 ? traits : undefined;
  }
  if (values.habitatText !== undefined) meta.habitatText = clean(values.habitatText);
  if (values.originText !== undefined) meta.originText = clean(values.originText);
  if (values.status !== undefined) meta.status = clean(values.status);
  if (values.emblemIcon !== undefined || values.emblemColor !== undefined) {
    meta.emblem = {
      icon: clean(values.emblemIcon),
      color: clean(values.emblemColor),
    };
  }
  return meta;
};

/** 纹章字段级合并：表单只提交 icon/color，保留 motif 等既有键（未知键不丢） */
export const mergeEmblemMeta = (
  previous: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> => ({
  ...(previous && typeof previous === 'object'
    ? (previous as Record<string, unknown>)
    : {}),
  ...patch,
});

export interface UseRacesResult {
  moduleId: string;
  /** 解析后的配置（默认值 + 后端 config） */
  config: ModuleConfig;
  /** 后端原始 config（配置面板的编辑基底） */
  rawConfig: ModuleConfig;
  terms: ModuleTerms;
  kinds: ReturnType<typeof racesKindDefs>;
  refs: EntityRefsResult;
  counts: WorldLinkCountMap;
  /** 全部节点（含子级） */
  nodes: RaceNode[];
  roots: RaceNode[];
  byId: Map<string, RaceNode>;
  lineage: LineageModel;
  subracesOf: (nodeId: string) => RaceNode[];
  itemsOf: (nodeId: string) => ModuleItemV2[];
  atlasOf: (nodeId: string, itemName: string) => Record<string, unknown>;
  /** 该节点的关联总数（出链 + 入链，来自世界级批量计数） */
  linksOfNode: (nodeId: string) => number;
  createRace: (
    values: RaceFormValues,
    customFields?: Record<string, unknown>
  ) => Promise<SubmoduleV2>;
  createSubrace: (
    parentId: string,
    values: RaceFormValues,
    customFields?: Record<string, unknown>
  ) => Promise<SubmoduleV2>;
  updateRace: (
    nodeId: string,
    values: RaceFormValues,
    customFields?: Record<string, unknown>
  ) => Promise<unknown>;
  updateRaceMeta: (nodeId: string, patch: Record<string, unknown>) => Promise<unknown>;
  /** 换父级；拒绝自指与后代成环，返回是否成功 */
  moveSubrace: (nodeId: string, parentId: string | null) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<void>;
  saveAtlasItem: (
    submoduleId: string,
    itemName: string,
    content: Record<string, unknown>
  ) => Promise<unknown>;
  canEdit: boolean;
  /** structure / sandbox 才加载血缘布局 */
  canUseLineage: boolean;
  isSaving: boolean;
  isLoading: boolean;
  isError: boolean;
}

export const useRaces = (worldId?: string, moduleId?: string): UseRacesResult => {
  const { level, capabilities } = useComplexity();
  const { config: rawConfig } = useModuleConfig(worldId, moduleId);
  const config = useMemo(() => resolveRacesConfig(rawConfig), [rawConfig]);
  const terms = useModuleTerms(config, worldId);

  const entities = useModuleEntities(worldId, moduleId);
  const worldQuery = useWorld(worldId);
  const refs = useEntityRefs(worldId, worldQuery.data?.project_id ?? undefined);
  const linksQuery = useWorldLinks(worldId);
  const counts = useWorldLinkCountMap(worldId);

  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);

  const lineage = useMemo(
    () => buildLineage(entities.submodules, links, config),
    [entities.submodules, links, config]
  );

  const nodes = useMemo(() => flattenRaceTree(lineage.roots), [lineage]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const createRace = useCallback(
    async (values: RaceFormValues, customFields?: Record<string, unknown>) => {
      const meta = mergeMeta(undefined, {
        ...metaFromRaceForm(values),
        ...(customFields && Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      return entities.createSubmodule({
        name: values.name.trim(),
        kind: values.kind ?? RACE_KIND,
        parentId: null,
        description: clean(values.description) ?? null,
        meta,
        orderIndex: entities.nextOrderIndex(null),
      });
    },
    [entities]
  );

  const createSubrace = useCallback(
    async (parentId: string, values: RaceFormValues, customFields?: Record<string, unknown>) => {
      const meta = mergeMeta(undefined, {
        ...metaFromRaceForm(values),
        ...(customFields && Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      return entities.createSubmodule({
        name: values.name.trim(),
        kind: SUBRACE_KIND,
        parentId,
        description: clean(values.description) ?? null,
        meta,
        orderIndex: entities.nextOrderIndex(parentId),
      });
    },
    [entities]
  );

  /**
   * 编辑：表单字段与自定义字段**合成一次 PUT**（Phase 3 修复）。
   * 早先分两次写，第二次用同一渲染周期的旧 meta 做基底，
   * 会把第一次写入的字段回滚掉（后端 PUT 是整体替换 meta）。
   */
  const updateRace = useCallback(
    async (
      nodeId: string,
      values: RaceFormValues,
      customFields?: Record<string, unknown>
    ) => {
      const node = byId.get(nodeId);
      if (!node) return undefined;
      const patch: Record<string, unknown> = { ...metaFromRaceForm(values) };
      if (customFields && Object.keys(customFields).length > 0) {
        patch.customFields = customFields;
      }
      // 表单只提交 icon/color，纹章要按字段合并，避免 motif 等既有键被整体覆盖
      if (patch.emblem) {
        patch.emblem = mergeEmblemMeta(node.meta.emblem, patch.emblem as Record<string, unknown>);
      }
      return entities.updateSubmodule(nodeId, {
        name: values.name.trim() || node.name,
        description:
          values.description === undefined ? undefined : clean(values.description) ?? null,
        meta: mergeMeta(node.meta.raw, patch),
      });
    },
    [byId, entities]
  );

  const updateRaceMeta = useCallback(
    async (nodeId: string, patch: Record<string, unknown>) => {
      const node = byId.get(nodeId);
      if (!node) return undefined;
      return entities.updateSubmodule(nodeId, {
        meta: mergeMeta(node.meta.raw, patch),
      });
    },
    [byId, entities]
  );

  const moveSubrace = useCallback(
    async (nodeId: string, parentId: string | null) => {
      if (!canReparent(nodes, nodeId, parentId)) return false;
      await entities.updateSubmodule(nodeId, { parentId });
      return true;
    },
    [entities, nodes]
  );

  return {
    moduleId: moduleId ?? '',
    config,
    rawConfig,
    terms,
    kinds: racesKindDefs(config),
    refs,
    counts,
    nodes,
    roots: lineage.roots,
    byId,
    lineage,
    subracesOf: (nodeId) => byId.get(nodeId)?.children ?? [],
    itemsOf: (nodeId) => entities.itemsOf(nodeId),
    atlasOf: (nodeId, itemName) => atlasContentOf(entities.items, nodeId, itemName),
    linksOfNode: (nodeId) => {
      const node = byId.get(nodeId);
      return node ? counts.countOf(raceRefOf(node.id, node.kind)) : 0;
    },
    createRace,
    createSubrace,
    updateRace,
    updateRaceMeta,
    moveSubrace,
    deleteNode: (nodeId) => entities.deleteSubmodule(nodeId),
    saveAtlasItem: (submoduleId, itemName, content) => {
      const existing = entities.itemByName(submoduleId, itemName);
      const merged = { ...(existing?.content ?? {}), ...content };
      return entities.saveItem({ submoduleId, name: itemName, content: merged });
    },
    canEdit: level !== 'sketch',
    canUseLineage: capabilities.canvas,
    isSaving: entities.isSaving,
    isLoading: entities.isLoading,
    isError: entities.isError,
  };
};

export type { LineageModel, RaceMeta, RaceNode };
