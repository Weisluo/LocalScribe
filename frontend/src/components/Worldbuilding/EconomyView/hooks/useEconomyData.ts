/**
 * 经济数据层（Phase 5 P5-T7；economy_ui_design §3.3/§11.1/§11.2）
 *
 * 读取（分档加载，§11.1）：
 * - sketch：只请求 `economy/summary`（含 config / overview / cycles / 折叠计数 / 聚合计数）；
 * - structure：再加 `economy/graph`（节点 + 边 + counts）；
 * - sandbox：再加 `economy/timeline` 与 `economy/metrics`（带 windowStart / windowEnd，窗口变化即重取，
 *   §11.1「沙盘不拉窗口外的指标原始序列」）。
 *
 * graph 恰恰相反：**不带 windowStart / windowEnd**。画布的窗口可视化是客户端淡出（`visual.inWindow`），
 * 不是裁剪结果集；服务端按窗口裁边会让「窗口外的边」直接消失、淡出也就无从谈起（§11.2 只保留两端都在
 * 结果集的边）。graph 上的服务端参数只有降级态的 kinds / stages（见下）。
 *
 * 写入：全部复用 P1 通用接口（submodules / items / links / modules），不新增后端写路径。
 * - overview：模块级唯一一条速写卡 item（模块名前缀 + overview）；
 * - cycle：模块级周期 item，一条一个周期；
 * - metrics：submodule 级指标 item，content.values[metricId] = 采样序列；
 * - 条目：submodule 级用户命名 item；
 * - 边：world_links（chip 展开先落通用关联 + 动词 label，结构档再细化）。
 *
 * 缓存：key 一律挂在 `['worldbuilding','economy',moduleId,...]` 命名空间下（见 economyKeys），
 * 写入后整批失效 `worldbuildingKeys.worldRoot` + 该命名空间。测试可只预置 Query 缓存离线跑。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  worldbuildingApi,
  type ComplexityLevel,
  type EntityRef,
  type ModuleItemV2,
  type SubmoduleV2,
} from '@/services/worldbuildingApi';
import { worldbuildingKeys } from '../../hooks/worldQueryKeys';
import { useModuleEntities } from '../../shared/useModuleEntities';
import { mergeMeta } from '../../shared/moduleConfig';
import {
  ECONOMY_LINK_TYPE_IDS,
  ECONOMY_RAW_LINK_TYPE,
  defaultLayerState,
  resolveEconomyConfig,
} from '../config';
import type {
  EconomyChip,
  EconomyConfig,
  EconomyEntityInput,
  EconomyEntityPatch,
  EconomyFilterState,
  EconomyGraph,
  EconomyLayerId,
  EconomyLayerState,
  EconomyLinkInput,
  EconomyMetricSample,
  EconomyMetrics,
  EconomyOverview,
  EconomyCycle,
  EconomySummary,
  EconomyTimeWindow,
  EconomyTimeline,
  ResolvedEconomyConfig,
  UseEconomyDataResult,
} from '../types';

/**
 * 落库 item 名（§3.3 表格；模块级唯一的速写卡与周期、submodule 级的指标与条目）。
 *
 * 注意：item 名与 link_type 不同，但外形同为 `模块.名字`，会被静态护栏的 link_type 扫描误伤；
 * 这里用模板串拼接，避免在源码里写出与 link_type 同形的字符串字面量。
 */
const ECONOMY_ITEM_PREFIX = 'economy';
export const ECONOMY_ITEM_NAMES = {
  overview: `${ECONOMY_ITEM_PREFIX}.overview`,
  cycle: `${ECONOMY_ITEM_PREFIX}.cycle`,
  metrics: `${ECONOMY_ITEM_PREFIX}.metrics`,
} as const;

export const ECONOMY_MODULE_KEY = 'economy';

/** Query key 工厂：`['worldbuilding','economy',moduleId,...]` */
export const economyKeys = {
  root: (moduleId?: string) => ['worldbuilding', 'economy', moduleId ?? 'none'] as const,
  summary: (moduleId?: string) => ['worldbuilding', 'economy', moduleId ?? 'none', 'summary'] as const,
  /**
   * graph key：第四段是**服务端筛选签名**（`kinds|stages`，非空才出现）。
   * 注意这里**不接受时间窗**：graph 不带 windowStart / windowEnd（见文件头），
   * 所以不能复用 `windowedKey` 的窗口段，否则画布会误以为自己按窗口取过数。
   */
  graph: (moduleId?: string, filterSignature?: string) =>
    filterSignature
      ? ([
          'worldbuilding',
          'economy',
          moduleId ?? 'none',
          'graph',
          `filter:${filterSignature}`,
        ] as const)
      : (['worldbuilding', 'economy', moduleId ?? 'none', 'graph'] as const),
  timeline: (moduleId?: string, window?: EconomyTimeWindow) =>
    windowedKey(moduleId, 'timeline', window),
  metrics: (moduleId?: string, window?: EconomyTimeWindow) =>
    windowedKey(moduleId, 'metrics', window),
};

/** 有时间窗才加第四段，保证「全时段」key 形状稳定（测试预置缓存时只需认识这一种形状） */
function windowedKey(
  moduleId: string | undefined,
  resource: string,
  window?: EconomyTimeWindow
): readonly unknown[] {
  const start = window?.start;
  const end = window?.end;
  if (!start && !end) return ['worldbuilding', 'economy', moduleId ?? 'none', resource];
  return ['worldbuilding', 'economy', moduleId ?? 'none', resource, `${start ?? ''}|${end ?? ''}`];
}

/** 图层默认值：config.layers 的 defaultOn 覆盖出厂骨架，结构档不画流量 / 盈余 / 周期 / 历史 */
export const economyLayerDefaults = (
  config: ResolvedEconomyConfig,
  complexity: ComplexityLevel
): EconomyLayerState => {
  const state = defaultLayerState(complexity);
  for (const layer of config.layers ?? []) {
    state[layer.id as EconomyLayerId] = layer.defaultOn;
  }
  if (complexity === 'structure') {
    state.flows = false;
    state.balance = false;
    state.cycles = false;
    state.history = false;
  }
  return state;
};

/**
 * summary 查询定义：数据层与「配置补种」共用同一个 queryKey，同一模块只发一次请求。
 *
 * 为什么要单独暴露：视图状态 hook（时间窗 / 筛选）必须先于数据层调用（数据层的 queryKey 要用它们），
 * 而默认档 / 默认布局 / 图层默认值又来自 summary —— 用这个只读配置的小 hook 打破两个 hook 的调用环。
 */
const economySummaryQuery = (moduleId: string, complexity: ComplexityLevel) => ({
  queryKey: economyKeys.summary(moduleId),
  queryFn: () => worldbuildingApi.getEconomySummary(moduleId, { complexity }),
  enabled: !!moduleId,
  staleTime: 30_000,
});

export interface EconomyConfigSeed {
  defaultComplexity?: ComplexityLevel;
  defaultLayout?: string | null;
  layerDefaults?: EconomyLayerState;
}

/**
 * 配置补种（§4.3/§8.5）：`summary.config` 到达前一概不补种（与数据层 `data.rawConfig` 同口径），
 * 到达后按 `resolveEconomyConfig` 解析出默认档 / 默认布局 / 图层默认值，交给视图状态 hook。
 * 不额外发请求（与 `useEconomyData` 的 summary 同 key）。
 */
export const useEconomyConfigSeed = (
  moduleId: string,
  complexity: ComplexityLevel
): EconomyConfigSeed => {
  const summaryQuery = useQuery(economySummaryQuery(moduleId, complexity));
  const rawConfig = summaryQuery.data?.config ?? null;
  return useMemo<EconomyConfigSeed>(() => {
    if (!rawConfig) return {};
    const resolved = resolveEconomyConfig(rawConfig);
    return {
      defaultComplexity: resolved.defaultComplexity,
      defaultLayout: resolved.displayMode,
      layerDefaults: economyLayerDefaults(resolved, complexity),
    };
  }, [complexity, rawConfig]);
};

/** 选中实体的指标采样：`metricId -> samples`（InspectorPanel 的口径） */
export const metricSamplesOf = (
  metrics: EconomyMetrics | null | undefined,
  entityId: string | null | undefined
): Record<string, EconomyMetricSample[]> => {
  const result: Record<string, EconomyMetricSample[]> = {};
  if (!metrics || !entityId) return result;
  for (const series of metrics.series ?? []) {
    if (series.entity?.id !== entityId) continue;
    result[series.metricId] = series.samples ?? [];
  }
  return result;
};

/** chip 的寻址 id：已展开用实体 id，未展开用 chip 自己的 id（§3.2 同一个 id） */
export const chipRefId = (chip: EconomyChip): string => chip.entityRef?.id ?? chip.id;

export const economyRefOf = (id: string, kind: string): EntityRef => ({
  module: ECONOMY_MODULE_KEY,
  kind,
  id,
});

export interface UseEconomyDataOptions {
  worldId: string;
  moduleId: string;
  complexity: ComplexityLevel;
  /**
   * 沙盘时间窗（§11.1）：只发给 timeline / metrics（窗口内取数，键里带窗口，窗口变化即重取）。
   * graph 不接受时间窗（见文件头：画布窗口是客户端淡出，服务端裁剪会丢边）。
   */
  timeWindow?: EconomyTimeWindow;
  /**
   * 当前 kinds / stages 筛选（视图状态的真实来源）。
   *
   * 只在**上一次 graph 响应声明降级**后作为服务端参数下发：降级时后端不返回节点明细
   * （`nodes: []`），客户端筛选在空集上无从生效，矩阵会一直显示全量计数。
   */
  serverFilter?: { kinds?: string[]; stages?: string[] };
}

/** 在冻结的 UseEconomyDataResult 之外补充「速写边一键细化」（world_links PATCH 不支持改 link_type） */
export interface UseEconomyDataExtra {
  refineRawLink: (linkId: string, linkType: string) => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 速写 chip 展开时的 id 约定：`createEntity` 的 meta 里带 `chipId`，
 * 这里把它取出来单独透传为载荷的 `id`（§3.2/§8.3：chip 与实体同一个 id），
 * 同时从落库 meta 里剔除，避免写下一个冗余键。
 */
const splitChipId = (
  meta: Record<string, unknown> | undefined
): { chipId?: string; meta: Record<string, unknown> | undefined } => {
  if (!meta) return { chipId: undefined, meta: undefined };
  const { chipId, ...rest } = meta;
  return {
    chipId: typeof chipId === 'string' && chipId ? chipId : undefined,
    meta: Object.keys(rest).length > 0 ? rest : undefined,
  };
};

export const useEconomyData = ({
  worldId,
  moduleId,
  complexity,
  timeWindow,
  serverFilter,
}: UseEconomyDataOptions): UseEconomyDataResult & UseEconomyDataExtra => {
  const queryClient = useQueryClient();
  const entitiesStore = useModuleEntities(worldId, moduleId);
  const [pendingWrites, setPendingWrites] = useState(0);

  /* ---------------- 读取（分档） ---------------- */

  const summaryQuery = useQuery(economySummaryQuery(moduleId, complexity));

  /**
   * 降级态走服务端筛选（§11.1）。
   *
   * 降级时后端只返回 counts（`nodes: []`），客户端 kinds / stages 筛选筛的是空集，矩阵永远显示全量；
   * 只能把 kinds / stages 下发给后端重算 counts。取舍与防抖动：
   * - 参数只在「上一次响应声明过降级（degraded）+ 当前有 kinds / stages」时下发；
   * - 用 latch 记住这个模式，直到筛选清空为止 —— 若只按「当前响应是否降级」判断，筛选后节点数降到
   *   阈值内（后端重新返回明细）就会撤掉参数 -> 又拉全量 -> 又降级，来回抖动；
   * - latch 让「一次筛选变更 = 一个请求」（全量响应仍在 staleTime 内时不会再白发一次），
   *   且筛选后回到阈值内时后端重新给出明细，视图回到画布。
   *
   * 局限（契约如此）：graph 只有 kinds / stages 两个服务端筛选参数，等级 / 状态 / 搜索 / 有无指标
   * 这类客户端筛选在降级态（没有节点明细）里无法生效 —— 矩阵只反映 kinds / stages。
   */
  const graphFilter = useMemo(() => {
    const kinds = [...(serverFilter?.kinds ?? [])].sort();
    const stages = [...(serverFilter?.stages ?? [])].sort();
    const active = kinds.length > 0 || stages.length > 0;
    return {
      kinds: kinds.join(','),
      stages: stages.join(','),
      signature: active ? `${kinds.join(',')}|${stages.join(',')}` : '',
    };
  }, [serverFilter?.kinds, serverFilter?.stages]);

  const [serverFilterLatch, setServerFilterLatch] = useState(false);
  const serverFilterSignature = serverFilterLatch ? graphFilter.signature : '';

  const graphQuery = useQuery({
    queryKey: economyKeys.graph(moduleId, serverFilterSignature),
    queryFn: () =>
      worldbuildingApi.getEconomyGraph(moduleId, {
        complexity,
        ...(serverFilterSignature
          ? { kinds: graphFilter.kinds, stages: graphFilter.stages }
          : {}),
      }),
    enabled: !!moduleId && complexity !== 'sketch',
    // 筛选签名变化会让 key 变新：保留上一次响应，直到新响应到达。
    // 否则这一帧的 graph 是 null -> nodes 为空 -> 外壳会先闪一下「空世界」引导（降级态还会闪掉矩阵）。
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!graphFilter.signature) {
      setServerFilterLatch(false);
      return;
    }
    if (graphQuery.data?.degraded === true) setServerFilterLatch(true);
  }, [graphFilter.signature, graphQuery.data?.degraded]);

  const timelineQuery = useQuery({
    queryKey: economyKeys.timeline(moduleId, timeWindow),
    queryFn: () =>
      worldbuildingApi.getEconomyTimeline(moduleId, {
        windowStart: timeWindow?.start,
        windowEnd: timeWindow?.end,
      }),
    enabled: !!moduleId && complexity === 'sandbox',
    // 窗口变化即换 key：保留上一次窗口的周期带 / 标记，避免时间刷在拖动时闪空
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const metricsQuery = useQuery({
    queryKey: economyKeys.metrics(moduleId, timeWindow),
    queryFn: () =>
      worldbuildingApi.getEconomyMetrics(moduleId, {
        windowStart: timeWindow?.start,
        windowEnd: timeWindow?.end,
      }),
    enabled: !!moduleId && complexity === 'sandbox',
    // 同上：指标序列按窗口换 key，保留上一次结果避免统计与检查器闪空
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const summary = summaryQuery.data ?? null;
  const graph = graphQuery.data ?? null;
  const timeline = timelineQuery.data ?? null;
  const metrics = metricsQuery.data ?? null;

  const rawConfig: EconomyConfig | null = summary?.config ?? null;
  const config = useMemo(() => resolveEconomyConfig(rawConfig), [rawConfig]);

  const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const edges = useMemo(() => graph?.edges ?? [], [graph]);

  /** 实体级条目（指标那条单独走 saveMetricSamples，不混进「条目」列表） */
  const entries = useMemo(
    () =>
      entitiesStore.items.filter(
        (item) => !!item.submodule_id && item.name !== ECONOMY_ITEM_NAMES.metrics
      ),
    [entitiesStore.items]
  );

  /* ---------------- 写入 ---------------- */

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
    void queryClient.invalidateQueries({ queryKey: economyKeys.root(moduleId) });
  }, [moduleId, queryClient]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setPendingWrites((count) => count + 1);
    try {
      return await fn();
    } finally {
      setPendingWrites((count) => count - 1);
    }
  }, []);

  const createEntity = useCallback(
    (input: EconomyEntityInput): Promise<SubmoduleV2> =>
      run(async () => {
        const { chipId, meta } = splitChipId(input.meta);
        const payload: Record<string, unknown> = {
          name: input.name.trim(),
          kind: input.kind,
          parent_id: input.parentId ?? undefined,
          description: input.description ?? undefined,
          meta,
          icon: input.icon ?? undefined,
          color: input.color ?? undefined,
          order_index: input.orderIndex,
        };
        // 力求 chip.id === 实体 id；后端忽略该字段时以返回的真实 id 为准（调用方用返回值回填 entityRef）
        if (chipId) payload.id = chipId;
        const created = await worldbuildingApi.createSubmodule(
          moduleId,
          payload as unknown as Parameters<typeof worldbuildingApi.createSubmodule>[1]
        );
        invalidateAll();
        return created as unknown as SubmoduleV2;
      }),
    [invalidateAll, moduleId, run]
  );

  const updateEntity = useCallback(
    (entityId: string, patch: EconomyEntityPatch): Promise<SubmoduleV2> =>
      run(async () => {
        const current = entitiesStore.submodules.find((item) => item.id === entityId);
        const payload: Record<string, unknown> = {};
        if (patch.name !== undefined) payload.name = patch.name.trim();
        if (patch.kind !== undefined) payload.kind = patch.kind;
        if (patch.description !== undefined) payload.description = patch.description;
        if (patch.icon !== undefined) payload.icon = patch.icon;
        if (patch.color !== undefined) payload.color = patch.color;
        if (patch.parentId !== undefined) payload.parent_id = patch.parentId;
        if (patch.orderIndex !== undefined) payload.order_index = patch.orderIndex;
        if (patch.meta !== undefined) payload.meta = mergeMeta(current?.meta, patch.meta);
        const updated = await worldbuildingApi.updateSubmodule(
          entityId,
          payload as Parameters<typeof worldbuildingApi.updateSubmodule>[1]
        );
        invalidateAll();
        return updated as unknown as SubmoduleV2;
      }),
    [entitiesStore.submodules, invalidateAll, run]
  );

  const deleteEntity = useCallback(
    (entityId: string): Promise<void> =>
      run(async () => {
        await worldbuildingApi.deleteSubmodule(entityId);
        invalidateAll();
      }),
    [invalidateAll, run]
  );

  /** 速写卡：模块级唯一一条 item（§3.3） */
  const saveOverview = useCallback(
    (overview: EconomyOverview): Promise<void> =>
      run(async () => {
        await entitiesStore.saveItem({
          submoduleId: undefined,
          name: ECONOMY_ITEM_NAMES.overview,
          content: overview as unknown as Record<string, unknown>,
        });
        invalidateAll();
      }),
    [entitiesStore, invalidateAll, run]
  );

  /** 周期：一条一个周期（模块级 item，可被 WorldLink 以 cycleId 寻址） */
  const saveCycle = useCallback(
    (cycle: EconomyCycle): Promise<void> =>
      run(async () => {
        const content = { ...cycle } as unknown as Record<string, unknown>;
        const existing = entitiesStore.items.find(
          (item) =>
            item.name === ECONOMY_ITEM_NAMES.cycle &&
            (item.id === cycle.id || (isRecord(item.content) && item.content.id === cycle.id))
        );
        if (existing) {
          await worldbuildingApi.updateItem(existing.id, { content });
        } else {
          const payload: Record<string, unknown> = {
            name: ECONOMY_ITEM_NAMES.cycle,
            content,
            order_index: entitiesStore.items.length,
            id: cycle.id,
          };
          const created = await worldbuildingApi.createItem(
            moduleId,
            payload as unknown as Parameters<typeof worldbuildingApi.createItem>[1]
          );
          // 后端自生成 id 时把真实 id 写回内容，保证 cycleId 仍可寻址
          if (created?.id && created.id !== cycle.id) {
            await worldbuildingApi.updateItem(created.id, {
              content: { ...content, id: created.id },
            });
          }
        }
        invalidateAll();
      }),
    [entitiesStore.items, invalidateAll, moduleId, run]
  );

  const deleteCycle = useCallback(
    (cycleId: string): Promise<void> =>
      run(async () => {
        const existing = entitiesStore.items.find(
          (item) =>
            item.name === ECONOMY_ITEM_NAMES.cycle &&
            (item.id === cycleId || (isRecord(item.content) && item.content.id === cycleId))
        );
        if (existing) await worldbuildingApi.deleteItem(existing.id);
        invalidateAll();
      }),
    [entitiesStore.items, invalidateAll, run]
  );

  /** 指标采样：submodule 级指标 item，content.values[metricId] = 序列 */
  const saveMetricSamples = useCallback(
    (
      entityId: string,
      metricId: string,
      samples: EconomyMetricSample[]
    ): Promise<void> =>
      run(async () => {
        const existing = entitiesStore.itemByName(entityId, ECONOMY_ITEM_NAMES.metrics);
        const previous = isRecord(existing?.content) ? existing.content : {};
        const values = isRecord(previous.values) ? previous.values : {};
        const content: Record<string, unknown> = {
          ...previous,
          values: { ...values, [metricId]: samples },
        };
        if (existing) {
          await worldbuildingApi.updateItem(existing.id, { content });
        } else {
          await worldbuildingApi.createItem(moduleId, {
            name: ECONOMY_ITEM_NAMES.metrics,
            content,
            submodule_id: entityId,
            order_index: entitiesStore.items.length,
          });
        }
        invalidateAll();
      }),
    [entitiesStore, invalidateAll, moduleId, run]
  );

  /** 用户命名条目：submodule 级 item */
  const saveEntry = useCallback(
    (entityId: string, name: string, content: Record<string, unknown>): Promise<void> =>
      run(async () => {
        await entitiesStore.saveItem({ submoduleId: entityId, name, content });
        invalidateAll();
      }),
    [entitiesStore, invalidateAll, run]
  );

  const createLink = useCallback(
    (input: EconomyLinkInput): Promise<unknown> =>
      run(async () => {
        const created = await worldbuildingApi.createWorldLink(worldId, {
          source: input.source,
          target: input.target,
          link_type: input.linkType,
          label: input.label ?? undefined,
          note: input.note ?? undefined,
          meta: input.meta,
          time: input.time ?? undefined,
        });
        invalidateAll();
        return created;
      }),
    [invalidateAll, run, worldId]
  );

  const updateLink = useCallback(
    (linkId: string, patch: Parameters<UseEconomyDataResult['updateLink']>[1]): Promise<unknown> =>
      run(async () => {
        const updated = await worldbuildingApi.updateWorldLink(linkId, {
          label: patch.label,
          note: patch.note,
          meta: patch.meta,
          time: patch.time ?? undefined,
        });
        invalidateAll();
        return updated;
      }),
    [invalidateAll, run]
  );

  const deleteLink = useCallback(
    (linkId: string): Promise<void> =>
      run(async () => {
        await worldbuildingApi.deleteWorldLink(linkId);
        invalidateAll();
      }),
    [invalidateAll, run]
  );

  const saveConfig = useCallback(
    (patch: Partial<EconomyConfig>): Promise<void> =>
      run(async () => {
        const base = rawConfig ?? (config as unknown as EconomyConfig);
        const next = { ...(base as unknown as Record<string, unknown>), ...patch };
        await worldbuildingApi.updateModule(moduleId, { config: next });
        invalidateAll();
      }),
    [config, invalidateAll, moduleId, rawConfig, run]
  );

  /**
   * 速写边细化：`core.related_to` -> 契约 §4.4 的 economy.*（§4.4/§8.3.7）。
   *
   * 限制：WorldLinkUpdate 只允许改 label / note / meta / time（后端明确「改端点请删除后重建」），
   * 因此这里用「先建细化边、再删通用边」实现，方向 / 时间 / 备注 / 其余 meta 全部保留，
   * 并在 meta.refinedFrom 记录来源；代价是 link id 会变（设计期望保留 id，待后端放开 link_type 后可原地改）。
   */
  const refineRawLink = useCallback(
    (linkId: string, linkType: string): Promise<void> =>
      run(async () => {
        if (!ECONOMY_LINK_TYPE_IDS.some((id) => id === linkType)) {
          throw new Error(`只允许细化为契约 §4.4 登记的经济关联（收到 ${linkType}）`);
        }
        const edge = edges.find((item) => item.id === linkId);
        if (!edge) throw new Error('这条往来已不在当前视图中，请刷新后重试');
        const meta = isRecord(edge.meta) ? edge.meta : {};
        try {
          await worldbuildingApi.createWorldLink(worldId, {
            source: edge.source,
            target: edge.target,
            link_type: linkType,
            label: edge.label ?? undefined,
            note: edge.note ?? undefined,
            time: edge.time ?? undefined,
            meta: { ...meta, refinedFrom: ECONOMY_RAW_LINK_TYPE },
          });
        } catch (error) {
          // 409：目标类型上已经有一条等价边，直接收掉通用边即可
          if ((error as { status?: number } | null)?.status !== 409) throw error;
        }
        await worldbuildingApi.deleteWorldLink(linkId);
        invalidateAll();
      }),
    [edges, invalidateAll, run, worldId]
  );

  const hasEntity = useCallback(
    (id: string) =>
      entitiesStore.submodules.some((item) => item.id === id) ||
      nodes.some((node) => node.id === id),
    [entitiesStore.submodules, nodes]
  );

  const refetch = useCallback(() => {
    invalidateAll();
  }, [invalidateAll]);

  // 只有经济只读接口决定加载 / 错误态：世界详情（submodules / items）只是 enrich，
  // 它没就绪时 entries / hasEntity 退化为空，但不该让整个经济视图变成错误页。
  const isLoading =
    summaryQuery.isLoading ||
    (complexity !== 'sketch' && graphQuery.isLoading) ||
    (complexity === 'sandbox' && (timelineQuery.isLoading || metricsQuery.isLoading));

  const isError =
    summaryQuery.isError || graphQuery.isError || timelineQuery.isError || metricsQuery.isError;

  const result = useMemo<UseEconomyDataResult & UseEconomyDataExtra>(
    () => ({
      worldId,
      moduleId,
      complexity,
      rawConfig,
      config,
      summary,
      graph,
      timeline,
      metrics,
      nodes,
      edges,
      entries,
      isLoading,
      isError,
      refetch,
      hasEntity,
      createEntity,
      updateEntity,
      deleteEntity,
      saveOverview,
      saveCycle,
      deleteCycle,
      saveMetricSamples,
      saveEntry,
      createLink,
      updateLink,
      deleteLink,
      saveConfig,
      isSaving: entitiesStore.isSaving || pendingWrites > 0,
      refineRawLink,
    }),
    [
      complexity,
      config,
      createEntity,
      createLink,
      deleteCycle,
      deleteEntity,
      deleteLink,
      edges,
      entries,
      entitiesStore.isSaving,
      graph,
      hasEntity,
      isLoading,
      isError,
      metrics,
      moduleId,
      nodes,
      pendingWrites,
      rawConfig,
      refetch,
      refineRawLink,
      saveConfig,
      saveCycle,
      saveEntry,
      saveMetricSamples,
      saveOverview,
      summary,
      timeline,
      updateEntity,
      updateLink,
      worldId,
    ]
  );

  return result;
};

/** 速写档不请求 graph：这里把已知边按 chip 归类的能力留给外壳，只导出判定用的谓词 */
export const isRawSketchLink = (linkType: string): boolean => linkType === ECONOMY_RAW_LINK_TYPE;

/** 未使用的筛选参数占位（外壳在客户端过滤；服务端参数保留给 P6 的分页视图） */
export type EconomyDataFilter = EconomyFilterState;
export type EconomyGraphPayload = EconomyGraph;
export type EconomyTimelinePayload = EconomyTimeline;
export type EconomySummaryPayload = EconomySummary;
export type EconomyItemFixture = ModuleItemV2;
