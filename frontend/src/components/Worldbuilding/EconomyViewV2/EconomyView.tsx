/**
 * 经济主视图 EconomyViewV2（Phase 5 P5-T8/P5-T9；economy_ui_design §4.2/§4.3/§5.6/§8.4/§9/§11.4）
 *
 * 结构（§4.2）：
 * - 顶栏：标题 + ComplexitySwitcher + 搜索 + 世界脉络入口占位 + 配置入口占位；
 * - 左轨：阶段轨道与筛选（只在 structure / sandbox 出现）；
 * - 主体：随档位 morph（sketch = 速写卡；structure = 线路图 / 账册 / 分栏；sandbox = 沙盘叠加）；
 * - 右轨：检查器（sketch 折叠为可展开抽屉，默认关闭）；
 * - 降档常驻折叠条 + 升档 3 秒提示（§8.5）。
 *
 * 键盘（§5.6）：1/2/3 切档、L 画布/账册互切、F 适应、方向键移动选中、Enter 打开检查器、
 * Delete 删除（含确认）、[ ] 时间窗微调（沙盘）、Esc 清空选择；空格只翻转外壳的播放态，
 * 沙盘叠加层自带播放定时器、键位尚未穿透（见 phase5_economy.md §7.2，P6 处理）；
 * 画布（FlowCanvas）与共用切换器先 `preventDefault` 的按键不再由外壳重复处理。
 *
 * 视图状态只在前端（useEconomyViewState），数据只走 useEconomyData / P1 通用接口。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Coins,
  Columns2,
  Compass,
  LayoutList,
  List,
  Network,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plus,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import {
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  ComplexitySwitcher,
  useComplexity,
} from '@/components/common/ComplexitySwitcher';
import type { ComplexityLevel, EntityRef } from '@/services/worldbuildingApi';
import { useEntityRefs } from '../hooks/useEntityRefs';
import { useModuleTerms } from '../shared/useModuleConfig';
import { DegradeLedgerMatrix } from './components/DegradeLedgerMatrix';
import { EconomyEmptyState } from './components/EmptyState';
import { FlowCanvas } from './components/FlowCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { LedgerList } from './components/LedgerList';
import { SandboxOverlay } from './components/SandboxOverlay';
import { SketchLedger } from './components/SketchLedger';
import {
  COMPLEXITY_RANK,
  anchorOf,
  degradeStateOf,
  filterEdges,
  filterNodes,
  formatAnchor,
  recommendationsOf,
} from './graph/guards';
import { buildVisualModel } from './graph/normalize';
import { PromoteChipModal } from './modals/PromoteChipModal';
import {
  ECONOMY_LINK_LABELS,
  ECONOMY_LAYOUTS,
  ECONOMY_LAYOUT_LABELS,
  ECONOMY_METRIC_SUGGESTIONS,
  ECONOMY_RAW_LINK_TYPE,
  ECONOMY_RECOMMENDED_KINDS,
  ECONOMY_TERM_DEFAULTS,
  ECONOMY_VERBS,
} from './config';
import {
  chipRefId,
  economyRefOf,
  metricSamplesOf,
  useEconomyConfigSeed,
  useEconomyData,
} from './hooks/useEconomyData';
import { newEconomyId, useEconomyViewState } from './hooks/useEconomyViewState';
import type {
  EconomyChip,
  EconomyEdge,
  EconomyEmptyScene,
  EconomyLayoutMode,
  EconomyOverview,
  EconomySketchFieldDef,
  EconomyStatBucket,
  EconomySurplus,
  EconomyVerbLink,
  EconomyVerbLinkRow,
  EconomyViewV2Props,
} from './types';

/* ---------------- 纯函数小工具 ---------------- */

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** 速写卡某槽位上的关键词（与 SketchLedger 同口径；这里用于折叠计数与一键展开） */
const chipsOfOverview = (
  overview: EconomyOverview | null | undefined,
  field: EconomySketchFieldDef
): EconomyChip[] => {
  if (!overview || field.type !== 'chips') return [];
  if (field.id === 'currency') return overview.currency ? [overview.currency] : [];
  if (field.id === 'resources') return overview.resources ?? [];
  if (field.id === 'industries') return overview.industries ?? [];
  const extra = asRecord(overview)[field.id];
  return Array.isArray(extra) ? (extra as EconomyChip[]) : [];
};

/** 把 chip 的 entityRef 回填到速写卡（chip 与实体同一个 id，§3.2/§8.2） */
const withChipEntityRef = (
  overview: EconomyOverview,
  field: EconomySketchFieldDef,
  chipId: string,
  ref: EntityRef
): EconomyOverview => {
  const stamp = (chip: EconomyChip) => (chip.id === chipId ? { ...chip, entityRef: ref } : chip);
  if (field.id === 'currency') {
    return { ...overview, currency: overview.currency ? stamp(overview.currency) : null };
  }
  if (field.id === 'resources') return { ...overview, resources: (overview.resources ?? []).map(stamp) };
  if (field.id === 'industries') {
    return { ...overview, industries: (overview.industries ?? []).map(stamp) };
  }
  const extra = asRecord(overview)[field.id];
  return {
    ...overview,
    [field.id]: Array.isArray(extra) ? (extra as EconomyChip[]).map(stamp) : extra,
  } as unknown as EconomyOverview;
};

const labelOfLink = (edge: EconomyEdge): string =>
  edge.label ?? ECONOMY_LINK_LABELS[edge.linkType]?.label ?? edge.linkType;

const LAYOUT_ICONS: Record<EconomyLayoutMode, typeof Route> = {
  lanes: Route,
  network: Network,
  ledger: List,
  split: Columns2,
};

const EMPTY_OVERVIEW: EconomyOverview = { resources: [], industries: [] };

/**
 * 速写档的深浅开关。
 *
 * common/ComplexitySwitcher 的 sr-only 描述里写死了「关联面板 / 关联计数」等术语，与 §4.4 术语门
 * （速写档界面文案不出现「实体 / 关联 / 流量 / 指标 / 周期 / 节点」）冲突，而 common 不允许改；
 * 因此速写档就近实现同形控件（同样的 radiogroup + 方向键语义与三段文案），结构 / 沙盘仍用共用件。
 */
const SKETCH_LEVEL_TITLES: Record<ComplexityLevel, string> = {
  sketch: '3-5 行就够',
  structure: '展开成脉络图与账册',
  sandbox: '再加上数字与时间',
};

const SKETCH_LEVEL_ICONS: Record<ComplexityLevel, typeof Route> = {
  sketch: PenLine,
  structure: LayoutList,
  sandbox: Network,
};

const SketchComplexitySwitch = ({
  value,
  onChange,
}: {
  value: ComplexityLevel;
  onChange: (next: ComplexityLevel) => void;
}) => (
  <div
    role="radiogroup"
    aria-label="深浅"
    className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 p-0.5"
  >
    {COMPLEXITY_LEVELS.map((item) => {
      const Icon = SKETCH_LEVEL_ICONS[item];
      const active = item === value;
      return (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={active}
          tabIndex={active ? 0 : -1}
          title={SKETCH_LEVEL_TITLES[item]}
          onClick={() => onChange(item)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none ${
            active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium">{COMPLEXITY_LABELS[item]}</span>
        </button>
      );
    })}
  </div>
);

/* ---------------- 主视图 ---------------- */

export const EconomyViewV2 = ({
  worldId,
  moduleId,
  onNavigateToEntity,
  highlightRef,
}: EconomyViewV2Props) => {
  const { level, setLevel } = useComplexity();
  const refs = useEntityRefs(worldId);
  const configSeed = useEconomyConfigSeed(moduleId, level);

  /**
   * 调用顺序：配置补种 -> 视图状态 -> 数据层。
   *
   * 数据层的 queryKey 要用视图状态的时间窗（§11.1）与降级筛选（降级态走服务端筛选），
   * 所以视图状态必须先调用；而视图状态的默认档 / 默认布局 / 图层默认值来自 summary 配置，
   * 由 `useEconomyConfigSeed` 单独读取（同一个 queryKey，不额外请求）打破这个环。
   */
  const state = useEconomyViewState({
    complexity: level,
    setComplexity: setLevel,
    defaultComplexity: configSeed.defaultComplexity,
    defaultLayout: configSeed.defaultLayout,
    layerDefaults: configSeed.layerDefaults,
    scope: moduleId,
  });

  const data = useEconomyData({
    worldId,
    moduleId,
    complexity: level,
    timeWindow: state.timeWindow,
    serverFilter: { kinds: state.filters.kinds, stages: state.filters.stages },
  });
  const config = data.config;
  const terms = useModuleTerms(config, worldId);

  const term = useCallback(
    (key: string, fallback: string) => terms.term(key, ECONOMY_TERM_DEFAULTS[key] ?? fallback),
    [terms]
  );

  const {
    layout,
    setLayout,
    groupBy,
    setGroupBy,
    selectedId,
    setSelectedId,
    clearSelection,
    filters,
    setFilters,
    search,
    setSearch,
    resetFilters,
    activeFilterCount,
    layers,
    setLayers,
    timeWindow,
    setTimeWindow,
    resetTimeWindow,
    foldedNotice,
    dismissFoldedNotice,
    expandedNotice,
    notifyFolded,
    inspectorOpen,
    setInspectorOpen,
    toggleInspector,
    playing,
    setPlaying,
    fitNonce,
    requestFit,
    setComplexity: setComplexityState,
  } = state;

  const summary = data.summary;
  const nodes = data.nodes;
  const edges = data.edges;
  const fold = summary?.fold ?? { links: 0, metrics: 0, fields: 0 };

  const [promote, setPromote] = useState<{ chip: EconomyChip; field: EconomySketchFieldDef } | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createKind, setCreateKind] = useState('');
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [surplusFilter, setSurplusFilter] = useState<EconomySurplus | null>(null);
  const lastCanvasLayout = useRef<EconomyLayoutMode>('lanes');

  const refApi = useMemo(
    () => ({ resolveName: refs.resolveName, isInvalid: refs.isInvalid }),
    [refs.isInvalid, refs.resolveName]
  );

  /* ---------------- 派生：筛选 -> 视觉模型 -> 渲染数据 ---------------- */

  const baseNodes = useMemo(() => filterNodes(nodes, filters), [filters, nodes]);
  const baseEdges = useMemo(() => filterEdges(edges, nodes, filters), [edges, filters, nodes]);

  const visual = useMemo(
    () =>
      buildVisualModel({
        nodes: baseNodes,
        edges: baseEdges,
        layers,
        window: timeWindow,
        defaultFlowUnit: config.defaultFlowUnit ?? null,
        config,
        summary,
        timeline: data.timeline,
        metrics: data.metrics,
        complexity: level,
      }),
    [
      baseEdges,
      baseNodes,
      config,
      data.metrics,
      data.timeline,
      layers,
      level,
      summary,
      timeWindow,
    ]
  );

  // 统计面板点「赤字 2」进入对应筛选：只影响展示，不写回数据
  const filteredNodes = useMemo(
    () =>
      surplusFilter
        ? baseNodes.filter((node) => visual.nodeSurplus[node.id] === surplusFilter)
        : baseNodes,
    [baseNodes, surplusFilter, visual]
  );
  const filteredEdges = useMemo(() => {
    if (!surplusFilter) return baseEdges;
    const visible = new Set(filteredNodes.map((node) => node.id));
    return baseEdges.filter((edge) => visible.has(edge.source.id) && visible.has(edge.target.id));
  }, [baseEdges, filteredNodes, surplusFilter]);

  /**
   * 降级判定：**以后端 `graph.degraded` 为准**（降级时后端只返回 counts，`nodes: []`，
   * 按前端节点数判定永远是 false，降级视图不可达）；前端节点数越界（本地筛选后）只是补充。
   * 原因文案优先用后端 `degradeReason`，真实节点数取 `counts.nodes`。
   */
  const degrade = useMemo(
    () =>
      degradeStateOf({
        nodeCount: filteredNodes.length,
        nodeLimit: data.graph?.nodeLimit ?? null,
        serverDegraded: data.graph?.degraded === true,
        serverReason: data.graph?.degradeReason ?? null,
        serverNodeCount: data.graph?.counts?.nodes ?? null,
      }),
    [data.graph, filteredNodes.length]
  );
  const recommendations = useMemo(
    () => (degrade.degraded ? recommendationsOf(filteredNodes, filteredEdges, config) : []),
    [config, degrade.degraded, filteredEdges, filteredNodes]
  );

  const stageBuckets: EconomyStatBucket[] = useMemo(
    () =>
      summary?.stages && summary.stages.length > 0
        ? summary.stages
        : config.stages.map((stage) => ({
            id: stage.id,
            label: stage.label,
            count: 0,
            stage: stage.id,
          })),
    [config.stages, summary]
  );
  const kindBuckets: EconomyStatBucket[] = useMemo(
    () =>
      summary?.kinds && summary.kinds.length > 0
        ? summary.kinds
        : config.entityTypes.map((def) => ({
            id: def.id,
            label: def.label,
            count: 0,
            icon: def.icon ?? null,
            color: def.color ?? null,
          })),
    [config.entityTypes, summary]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId]
  );
  const pendingNode = useMemo(
    () => (deletePending ? nodes.find((node) => node.id === deletePending) ?? null : null),
    [deletePending, nodes]
  );

  const overview = summary?.overview ?? null;
  const sketchChipCount = useMemo(
    () =>
      (config.sketchFields ?? []).reduce(
        (total, field) => total + chipsOfOverview(overview, field).length,
        0
      ),
    [config.sketchFields, overview]
  );

  /* ---------------- 档位切换：升档提示 / 降档折叠条（§4.3/§8.5） ---------------- */

  const changeComplexity = useCallback(
    (next: ComplexityLevel) => {
      if (next === level) return;
      const up = COMPLEXITY_RANK[next] > COMPLEXITY_RANK[level];
      setComplexityState(next);
      notifyFolded(up ? 'up' : 'down', {
        links: fold.links,
        metrics: fold.metrics,
        fields: fold.fields,
      });
    },
    [fold.fields, fold.links, fold.metrics, level, notifyFolded, setComplexityState]
  );

  /** 折叠条的「展开为脉络」：往上走一档（当前是速写就进结构，否则进沙盘） */
  const bumpComplexity = useCallback(() => {
    changeComplexity(level === 'sketch' ? 'structure' : 'sandbox');
  }, [changeComplexity, level]);

  // 记住最后一次画布布局（顶栏、画布工具条、L 键都写同一份 layout state）
  useEffect(() => {
    if (layout !== 'ledger') lastCanvasLayout.current = layout;
  }, [layout]);

  /** L 键：画布与账册互切；切回时恢复上一次的画布布局（不以顶栏 / 画布工具条为第二份状态） */
  const toggleCanvasLedger = useCallback(() => {
    if (layout === 'ledger') {
      setLayout(lastCanvasLayout.current);
      return;
    }
    setLayout('ledger');
  }, [layout, setLayout]);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (filteredNodes.length === 0) return;
      const index = filteredNodes.findIndex((node) => node.id === selectedId);
      const next =
        index < 0
          ? direction > 0
            ? filteredNodes[0]
            : filteredNodes[filteredNodes.length - 1]
          : filteredNodes[(index + direction + filteredNodes.length) % filteredNodes.length];
      setSelectedId(next.id);
      setInspectorOpen(true);
    },
    [filteredNodes, selectedId, setInspectorOpen, setSelectedId]
  );

  /**
   * 时间窗微调（§5.6 标注「（沙盘）」）：只在 sandbox 档生效，与空格播放同一门禁。
   *
   * 解析复用 `guards.anchorOf`（前导数字，与窗口过滤同口径，不再是 `/ -?\d+ /` 那种丢小数、
   * 丢自由文本的本地正则）；新锚点用 `guards.formatAnchor` 保留两位小数，避免 310.2–310.8
   * 被 `String(baseStart + 1)` 塌成 "311"–"311"（丢精度、窗口变零宽）。
   * 只填一端的开区间语义保持原样：那一端仍然留空，不因为微调而被补成同一锚点。
   */
  const shiftWindow = useCallback(
    (direction: 1 | -1) => {
      if (level !== 'sandbox') return;
      const range = data.timeline?.range ?? summary?.timeRange ?? null;
      const start = anchorOf(timeWindow.start) ?? anchorOf(range?.start);
      const end = anchorOf(timeWindow.end) ?? anchorOf(range?.end);
      if (start === undefined && end === undefined) return;
      setTimeWindow({
        start: start === undefined ? undefined : formatAnchor(start + direction),
        end: end === undefined ? undefined : formatAnchor(end + direction),
      });
    },
    [
      data.timeline?.range,
      level,
      setTimeWindow,
      summary?.timeRange,
      timeWindow.end,
      timeWindow.start,
    ]
  );

  /**
   * 「导出当前窗口 CSV」：文件名带窗口，内容也必须按窗口过滤（复用 buildVisualModel 的
   * `visual.inWindow`，与画布淡出 / SandboxOverlay 的 `buildWindowCsv` 同一口径；
   * 无锚点的条目恒在集合里，保持可见，不会因为无法比较而被导出漏掉）。
   * 窗口内没有内容时明确告知，不下载一个只有表头的文件。
   */
  const exportWindow = useCallback(() => {
    const cell = (value: unknown) => {
      const text = value === undefined || value === null ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const windowed = Boolean(timeWindow.start || timeWindow.end);
    const exportNodes = windowed
      ? filteredNodes.filter((node) => visual.inWindow.has(node.id))
      : filteredNodes;
    const exportEdges = windowed
      ? filteredEdges.filter((edge) => visual.inWindow.has(edge.id))
      : filteredEdges;
    if (windowed && exportNodes.length === 0 && exportEdges.length === 0) {
      toast.info('当前时间窗内没有可导出的内容：放宽时间窗或清除筛选后重试');
      return;
    }
    const lines = [
      ['类别', '名称', '类型 / 关联', '阶段 / 方向', '等级', '状态', '规模', '单位', '出链', '入链', '备注']
        .map(cell)
        .join(','),
    ];
    for (const node of exportNodes) {
      lines.push(
        [
          '实体',
          node.name,
          node.kind,
          node.stage,
          node.level ?? '',
          node.status ?? '',
          node.scale ?? '',
          node.unit ?? '',
          node.counts?.outgoing ?? 0,
          node.counts?.incoming ?? 0,
          node.description ?? '',
        ]
          .map(cell)
          .join(',')
      );
    }
    for (const edge of exportEdges) {
      lines.push(
        [
          '往来',
          refs.resolveName(edge.source),
          labelOfLink(edge),
          `${refs.resolveName(edge.source)} 到 ${refs.resolveName(edge.target)}`,
          '',
          '',
          edge.flow ?? '',
          edge.unit ?? '',
          '',
          '',
          edge.note ?? '',
        ]
          .map(cell)
          .join(',')
      );
    }
    const blob = new Blob(['\ufeff', `${lines.join('\n')}\n`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `economy-window-${timeWindow.start ?? 'all'}-${timeWindow.end ?? 'all'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [
    filteredEdges,
    filteredNodes,
    refs,
    timeWindow.end,
    timeWindow.start,
    visual.inWindow,
  ]);

  /* ---------------- chip 展开 / 一键展开（P5-T9） ---------------- */

  /**
   * 计划 §6：推荐 kind 骨架只在用户真正用到时写进 `config.entityTypes`，不入库预置。
   * 自建 kind（custom_*）没有可推断的 parentKind，这里不猜——那是 P6 类型配置面板的事。
   */
  const rememberKind = useCallback(
    async (kind: string) => {
      const skeleton = ECONOMY_RECOMMENDED_KINDS.find((item) => item.id === kind);
      if (!skeleton) return;
      if (config.entityTypes.some((def) => def.id === kind)) return;
      try {
        // 生成的 OpenAPI 类型把 entityTypes 声明为「自由字典数组」（后端 List[Dict[str, Any]]），
        // 这里写的是视图层 EntityTypeDef，键形状一致，只需显式收窄类型
        await data.saveConfig({
          entityTypes: [...config.entityTypes, { ...skeleton }] as unknown as Array<
            Record<string, unknown>
          >,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '类型骨架没存上');
      }
    },
    [config.entityTypes, data]
  );

  const promoteChip = useCallback(
    async (chip: EconomyChip, field: EconomySketchFieldDef, kindOverride?: string) => {
      if (chip.entityRef) return;
      const current = overview ?? EMPTY_OVERVIEW;
      const kind = kindOverride ?? chip.kind ?? field.chipKind ?? 'custom';
      try {
        // meta.chipId 让数据层尝试用 chip 自己的 id 建实体（§3.2：chip 与实体同一个 id）
        const created = await data.createEntity({
          name: chip.label,
          kind,
          meta: { stub: true, chipId: chip.id },
          orderIndex: nodes.length,
        });
        await rememberKind(kind);
        await data.saveOverview(
          withChipEntityRef(current, field, chip.id, economyRefOf(created.id, kind))
        );
        toast.success(`「${chip.label}」已展开`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '展开失败');
      }
    },
    [data, nodes.length, overview, rememberKind]
  );

  const expandAllChips = useCallback(async () => {
    for (const field of config.sketchFields ?? []) {
      for (const chip of chipsOfOverview(overview, field)) {
        if (chip.entityRef) continue;
        await promoteChip(chip, field, chip.kind ?? field.chipKind);
      }
    }
  }, [config.sketchFields, overview, promoteChip]);

  const createVerbLink = useCallback(
    async (source: EconomyChip, verb: EconomyVerbLink, target: EconomyChip) => {
      try {
        // 速写档先说人话：先落 core.related_to + 动词 label，结构档一键细化（契约 §5.5 / §4.4）
        await data.createLink({
          linkType: ECONOMY_RAW_LINK_TYPE,
          source: economyRefOf(chipRefId(source), source.kind || 'custom'),
          target: economyRefOf(chipRefId(target), target.kind || 'custom'),
          label: verb.label,
          meta: { sketchVerb: verb.verb, refineTo: verb.linkType },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '这条往来没连上');
      }
    },
    [data]
  );

  const verbLinksOf = useCallback(
    (chip: EconomyChip): EconomyVerbLinkRow[] => {
      const id = chipRefId(chip);
      const rows: EconomyVerbLinkRow[] = [];
      for (const edge of edges) {
        const outgoing = edge.source.id === id;
        const incoming = edge.target.id === id;
        if (!outgoing && !incoming) continue;
        const otherRef = outgoing ? edge.target : edge.source;
        const otherLabel = refs.resolveName(otherRef) || otherRef.id;
        const label = labelOfLink(edge);
        rows.push({
          id: edge.id,
          verbLabel: label,
          linkType: edge.linkType,
          fromLabel: outgoing ? chip.label : otherLabel,
          toLabel: outgoing ? otherLabel : chip.label,
          raw: edge.linkType === ECONOMY_RAW_LINK_TYPE,
          refine: () => {
            const verb = ECONOMY_VERBS.find((item) => item.label === label);
            if (!verb) {
              toast.error('这条往来没有可细化的标准关联');
              return;
            }
            void data.refineRawLink(edge.id, verb.linkType).catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : '细化失败');
            });
          },
        });
      }
      return rows;
    },
    [data, edges, refs]
  );

  /* ---------------- 空状态 / 引导动作 ---------------- */

  const addMetricSkeleton = useCallback(async () => {
    if (config.metrics.length > 0) return;
    try {
      await data.saveConfig({ metrics: ECONOMY_METRIC_SUGGESTIONS });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '指标骨架没加上');
    }
  }, [config.metrics.length, data]);

  const addCycle = useCallback(async () => {
    try {
      await data.saveCycle({ id: newEconomyId(), name: '新周期', phases: [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '时间分段没加上');
    }
  }, [data]);

  const emptyScene: EconomyEmptyScene | null = useMemo(() => {
    if (level === 'sketch') return null;
    if (activeFilterCount > 0 && filteredNodes.length === 0) return 'no-filter-result';
    if (nodes.length === 0) return sketchChipCount > 0 ? 'chips-unexpanded' : 'all-empty';
    return null;
  }, [activeFilterCount, filteredNodes.length, level, nodes.length, sketchChipCount]);

  const hint = useMemo(() => {
    if (level === 'sketch' || nodes.length === 0) return null;
    if (edges.length === 0) {
      return {
        text: '这些实体还没往来',
        action: '连一句往来',
        onClick: () => changeComplexity('sketch'),
      };
    }
    if (level === 'sandbox' && (summary?.totals?.metricCoverage?.entitiesWithMetrics ?? 0) === 0) {
      return { text: '还没有数字记录', action: '添加指标骨架', onClick: () => void addMetricSkeleton() };
    }
    if (level === 'sandbox' && (data.timeline?.cycles ?? []).length === 0) {
      return { text: '还没有时间分段', action: '添加一个周期', onClick: () => void addCycle() };
    }
    return null;
  }, [addCycle, addMetricSkeleton, changeComplexity, data.timeline?.cycles, edges.length, level, nodes.length, summary?.totals?.metricCoverage?.entitiesWithMetrics]);

  /* ---------------- 高亮 / 删除 / 新建 ---------------- */

  const consumedHighlight = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightRef || highlightRef.module !== 'economy') return;
    if (!nodes.some((node) => node.id === highlightRef.id)) return;
    const key = `${highlightRef.kind}:${highlightRef.id}`;
    if (consumedHighlight.current === key) return;
    consumedHighlight.current = key;
    setSelectedId(highlightRef.id);
    setInspectorOpen(true);
  }, [highlightRef, nodes, setInspectorOpen, setSelectedId]);

  const confirmDelete = useCallback(async () => {
    if (!deletePending) return;
    const target = deletePending;
    setDeletePending(null);
    try {
      await data.deleteEntity(target);
      if (selectedId === target) {
        clearSelection();
        setInspectorOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  }, [clearSelection, data, deletePending, selectedId, setInspectorOpen]);

  const submitCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name) return;
    const kind = createKind || config.entityTypes[0]?.id || ECONOMY_RECOMMENDED_KINDS[0].id;
    try {
      await data.createEntity({ name, kind, meta: {} });
      await rememberKind(kind);
      setCreateName('');
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败');
    }
  }, [config.entityTypes, createKind, createName, data, rememberKind]);

  /* ---------------- 键盘（§5.6；输入态一律让位） ---------------- */
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      /**
       * 已有人处理过的事件不再处理：画布（FlowCanvas）与 common/ComplexitySwitcher 都在自己的
       * `onKeyDown` 里 `preventDefault()` 并自行处理方向键 / Esc；外壳这个 window 监听是冒泡末端，
       * 不检查就会把画布的方向键选中覆盖成 `moveSelection(±1)`，在切换器上按方向键还会同时切档、
       * 改选中并弹出检查器（一次按键三处生效）。
       */
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      const key = event.key;
      if (key === '1' || key === '2' || key === '3') {
        const next = COMPLEXITY_LEVELS[Number(key) - 1];
        if (next) changeComplexity(next);
        return;
      }
      if (key === 'l' || key === 'L') {
        toggleCanvasLedger();
        return;
      }
      if (key === 'f' || key === 'F') {
        requestFit();
        return;
      }
      if (key === 'Escape') {
        if (promote) {
          setPromote(null);
          return;
        }
        if (deletePending) {
          setDeletePending(null);
          return;
        }
        if (createOpen) {
          setCreateOpen(false);
          return;
        }
        if (document.querySelector('[role="dialog"]')) return;
        if (selectedId) clearSelection();
        else if (inspectorOpen) setInspectorOpen(false);
        return;
      }
      if (key === 'Delete') {
        if (selectedId) setDeletePending(selectedId);
        return;
      }
      if (key === '[') {
        if (level !== 'sandbox') return;
        shiftWindow(-1);
        return;
      }
      if (key === ']') {
        if (level !== 'sandbox') return;
        shiftWindow(1);
        return;
      }
      if (key === ' ') {
        if (level !== 'sandbox') return;
        event.preventDefault();
        setPlaying(!playing);
        return;
      }
      if (key === 'Enter') {
        if (selectedId) setInspectorOpen(true);
        return;
      }
      if (key === 'ArrowDown' || key === 'ArrowRight') {
        moveSelection(1);
        return;
      }
      if (key === 'ArrowUp' || key === 'ArrowLeft') {
        moveSelection(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    changeComplexity,
    clearSelection,
    createOpen,
    deletePending,
    inspectorOpen,
    level,
    moveSelection,
    playing,
    promote,
    requestFit,
    selectedId,
    setInspectorOpen,
    setPlaying,
    shiftWindow,
    toggleCanvasLedger,
  ]);

  /* ---------------- 主体渲染 ---------------- */

  const title =
    level === 'sketch'
      ? term('overviewTitle', '经济速写卡')
      : layout === 'ledger'
        ? term('ledgerTitle', '经济账册')
        : level === 'sandbox'
          ? term('sandboxTitle', '沙盘')
          : term('canvasTitle', '经济脉络图');

  const canWrite = !data.isError;
  const anyLoading = data.isLoading && !summary;

  /** 「F 适应」：FlowCanvas 的 props 已冻结，没有 pan/zoom 句柄，用重挂载回到默认适配 */
  const canvasKey = `economy-canvas-${fitNonce}`;

  /** 放宽窗口时顺手撤掉「只看盈余」的展示筛选，避免空状态里看不出原因 */
  const widenWindow = useCallback(() => {
    resetTimeWindow();
    setSurplusFilter(null);
  }, [resetTimeWindow]);

  const renderCanvas = () => (
    <FlowCanvas
      key={canvasKey}
      nodes={filteredNodes}
      edges={filteredEdges}
      layout={layout}
      groupBy={groupBy}
      filters={filters}
      layers={layers}
      selectedId={selectedId}
      visual={visual}
      sandbox={level === 'sandbox'}
      degraded={degrade.degraded}
      kindDefs={config.entityTypes}
      refs={refApi}
      onSelect={setSelectedId}
      onOpenEntity={(nodeId) => {
        setSelectedId(nodeId);
        setInspectorOpen(true);
      }}
      onNavigateToEntity={onNavigateToEntity}
      onClearSelection={clearSelection}
      onOpenLedger={() => setLayout('ledger')}
      onAddEntity={() => setCreateOpen(true)}
      // 画布工具条与顶栏共用同一份视图状态，避免出现两个不同步的布局 / 分组 / 搜索值
      onLayoutChange={setLayout}
      onGroupByChange={setGroupBy}
      onSearchChange={setSearch}
      onResetFilter={resetFilters}
    />
  );

  const renderLedger = () => (
    <LedgerList
      nodes={filteredNodes}
      edges={filteredEdges}
      stages={stageBuckets}
      kinds={kindBuckets}
      levels={config.levels}
      statuses={config.statuses}
      filters={filters}
      groupBy={groupBy}
      selectedId={selectedId}
      visual={visual}
      sandbox={level === 'sandbox'}
      refs={refApi}
      onFiltersChange={setFilters}
      onGroupByChange={setGroupBy}
      onSelect={setSelectedId}
      onOpenEntity={(nodeId) => {
        setSelectedId(nodeId);
        setInspectorOpen(true);
      }}
      onResetFilter={resetFilters}
    />
  );

  const renderBody = () => {
    if (data.isError) {
      return (
        <div className="flex flex-col items-start gap-2 p-4 text-xs text-destructive" data-testid="economy-error">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            经济数据加载失败
          </span>
          <button
            type="button"
            onClick={() => data.refetch()}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            重试
          </button>
        </div>
      );
    }

    if (anyLoading) {
      return (
        <div className="space-y-2 p-3" data-testid="economy-loading">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg border border-border/50 bg-muted/30 motion-reduce:animate-none"
            />
          ))}
        </div>
      );
    }

    if (level === 'sketch') {
      return (
        <SketchLedger
          config={config}
          overview={overview}
          fold={fold}
          counts={{
            entities: summary?.totals?.entities ?? nodes.length,
            links: summary?.totals?.links ?? edges.length,
          }}
          verbLinksOf={verbLinksOf}
          canWrite={canWrite}
          isSaving={data.isSaving}
          onSaveOverview={data.saveOverview}
          onPromoteChip={(chip, fieldId) => {
            const field = (config.sketchFields ?? []).find((item) => item.id === fieldId);
            if (field) setPromote({ chip, field });
          }}
          onExpandAllChips={(field, chips) => {
            void (async () => {
              for (const chip of chips) {
                if (chip.entityRef) continue;
                await promoteChip(chip, field, chip.kind ?? field.chipKind);
              }
            })();
          }}
          onOpenStructure={() => changeComplexity('structure')}
          onCreateVerbLink={createVerbLink}
          term={term}
        />
      );
    }

    /**
     * 降级分支必须排在空状态之前：后端降级时 `nodes: []`（只有 counts），
     * `emptyScene` 会把它读成「空世界 / chips 未展开」并显示引导，而真实原因是超出阈值。
     */
    if (degrade.degraded) {
      return (
        <DegradeLedgerMatrix
          nodes={filteredNodes}
          edges={filteredEdges}
          counts={data.graph?.counts ?? null}
          reason={degrade.reason}
          nodeLimit={degrade.nodeLimit}
          kinds={kindBuckets}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpenEntity={(nodeId) => {
            setSelectedId(nodeId);
            setInspectorOpen(true);
          }}
          onNavigateToEntity={onNavigateToEntity}
          recommendations={recommendations}
        />
      );
    }

    if (emptyScene) {
      return (
        <div
          data-testid="economy-empty"
          className="flex h-full items-center justify-center p-4"
        >
          <EconomyEmptyState
            scene={emptyScene}
            onCreateEntity={() => setCreateOpen(true)}
            onWriteSketch={() => changeComplexity('sketch')}
            onDrawCanvas={() => changeComplexity('structure')}
            onExpandChips={() => void expandAllChips()}
            onAddMetric={() => void addMetricSkeleton()}
            onAddCycle={() => void addCycle()}
            onClearFilter={resetFilters}
            onWidenWindow={widenWindow}
            term={term}
          />
        </div>
      );
    }

    if (layout === 'ledger') return renderLedger();

    const canvas = <div className="h-full min-h-0">{renderCanvas()}</div>;
    const split = (
      <div className="flex h-full min-h-0 gap-2">
        <div className="min-h-0 flex-1">{renderCanvas()}</div>
        <div className="min-h-0 flex-1 border-l border-border/40 pl-2">{renderLedger()}</div>
      </div>
    );
    const body = layout === 'split' ? split : canvas;

    if (level !== 'sandbox') return body;

    return (
      <SandboxOverlay
        complexity={level}
        layers={config.layers}
        layerState={layers}
        onLayerChange={setLayers}
        visual={visual}
        counts={data.graph?.counts ?? null}
        timeline={data.timeline}
        window={timeWindow}
        onWindowChange={setTimeWindow}
        onResetWindow={resetTimeWindow}
        onExportWindow={exportWindow}
        onApplySurplus={(next) => setSurplusFilter(next)}
      >
        {body}
      </SandboxOverlay>
    );
  };

  return (    <div
      data-testid="economy-view"
      data-complexity={level}
      data-layout={layout}
      className="relative flex h-full min-h-0 flex-col gap-2"
    >
      <header data-testid="economy-header" className="flex flex-wrap items-center gap-2">
        <Coins className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {level === 'sketch' ? (
          <SketchComplexitySwitch value={level} onChange={changeComplexity} />
        ) : (
          <ComplexitySwitcher value={level} onChange={changeComplexity} />
        )}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              level === 'sketch'
                ? '搜索名称'
                : '搜索名称 / 类型 / 阶段（支持 kind:market 集市）'
            }
            aria-label="搜索经济内容"
            data-testid="economy-search"
            className="w-52 rounded-md border border-border/60 bg-background py-1 pl-7 pr-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/60"
          />
        </div>

        <span className="text-[10px] text-muted-foreground">
          {COMPLEXITY_LABELS[level]}档
          {summary && fold.links + fold.metrics + fold.fields > 0
            ? ` · 已折叠 ${fold.links} 条${term('flowWord', '往来')}与 ${fold.metrics} 个数值（数据未删除）`
            : ''}
        </span>

        {level !== 'sketch' ? (
          <>
            <div role="tablist" aria-label="布局" className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5">
              {ECONOMY_LAYOUTS.map((id) => {
                const Icon = LAYOUT_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={layout === id}
                    data-testid={`economy-layout-tab-${id}`}
                    onClick={() => setLayout(id)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                      layout === id
                        ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {ECONOMY_LAYOUT_LABELS[id]}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="economy-new-entity"
                onClick={() => setCreateOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-green-700 motion-reduce:transition-none"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {term('newEntity', '添加实体')}
              </button>
              <button
                type="button"
                disabled
                title="世界脉络在 P6 接入（契约 §5.4）"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground opacity-60"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                世界脉络
              </button>
              <button
                type="button"
                disabled
                title="模块配置面板在 P6 接入（契约 §2.7）"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground opacity-60"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                配置
              </button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void data.refetch()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              刷新
            </button>
          </div>
        )}

        <button
          type="button"
          data-testid="economy-inspector-toggle"
          aria-pressed={inspectorOpen}
          onClick={toggleInspector}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
        >
          {inspectorOpen ? (
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {level === 'sketch' ? '批注栏' : '检查器'}
        </button>
      </header>

      {createOpen ? (
        <form
          data-testid="economy-new-entity-form"
          className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 p-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <input
            type="text"
            autoFocus
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="名称（只强制名称，其余可后补）"
            aria-label="新实体名称"
            className="w-56 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
          />
          <select
            value={createKind || config.entityTypes[0]?.id || ECONOMY_RECOMMENDED_KINDS[0].id}
            onChange={(event) => setCreateKind(event.target.value)}
            aria-label="类型"
            className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
          >
            {(config.entityTypes.length > 0 ? config.entityTypes : ECONOMY_RECOMMENDED_KINDS).map(
              (def) => (
                <option key={def.id} value={def.id}>
                  {def.label}
                </option>
              )
            )}
          </select>
          <button
            type="submit"
            className="rounded-md bg-green-600 px-2.5 py-0.5 text-[11px] text-white transition-colors hover:bg-green-700 motion-reduce:transition-none"
          >
            添加
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            取消
          </button>
        </form>
      ) : null}

      {expandedNotice ? (
        <div
          className="rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-800 dark:text-green-200"
          data-testid="economy-expand-notice"
          role="status"
        >
          {expandedNotice}
        </div>
      ) : null}

      {foldedNotice ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200"
          data-testid="economy-fold-notice"
          role="status"
        >
          <span>{foldedNotice.text}</span>
          <button
            type="button"
            onClick={bumpComplexity}
            className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            {term('promoChip', '展开为脉络')}
          </button>
          <button
            type="button"
            onClick={dismissFoldedNotice}
            aria-label="关闭折叠提示"
            className="ml-auto rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-2">
        {level !== 'sketch' ? (
          <aside
            className="w-40 shrink-0 space-y-2 overflow-y-auto border-r border-border/40 pr-2"
            aria-label="阶段轨道与筛选"
          >
            <div data-testid="economy-stage-filter" className="space-y-0.5">
              <p className="text-[10px] tracking-wide text-muted-foreground">阶段轨道</p>
              {stageBuckets.map((stage) => {
                const active = filters.stages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        stages: active
                          ? filters.stages.filter((item) => item !== stage.id)
                          : [...filters.stages, stage.id],
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-sm px-1.5 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                      active
                        ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{stage.label}</span>
                    <span className="text-[9px] text-muted-foreground">{stage.count}</span>
                  </button>
                );
              })}
            </div>

            <div data-testid="economy-kind-filter" className="space-y-0.5">
              <p className="text-[10px] tracking-wide text-muted-foreground">
                {term('kindWord', '类型')}
              </p>
              {kindBuckets.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">还没有类型</p>
              ) : (
                kindBuckets.map((kind) => {
                  const active = filters.kinds.includes(kind.id);
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          kinds: active
                            ? filters.kinds.filter((item) => item !== kind.id)
                            : [...filters.kinds, kind.id],
                        })
                      }
                      className={`flex w-full items-center justify-between rounded-sm px-1.5 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                        active
                          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{kind.label}</span>
                      <span className="text-[9px] text-muted-foreground">{kind.count}</span>
                    </button>
                  );
                })
              )}
            </div>

            {config.levels.length > 0 ? (
              <label className="block text-[10px] text-muted-foreground">
                等级
                <select
                  value={filters.levels[0] ?? ''}
                  onChange={(event) =>
                    setFilters({ ...filters, levels: event.target.value ? [event.target.value] : [] })
                  }
                  className="mt-0.5 w-full rounded-md border border-border/60 bg-background px-1 py-0.5 text-[11px] text-foreground"
                >
                  <option value="">全部</option>
                  {config.levels.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {config.statuses.length > 0 ? (
              <label className="block text-[10px] text-muted-foreground">
                状态
                <select
                  value={filters.statuses[0] ?? ''}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      statuses: event.target.value ? [event.target.value] : [],
                    })
                  }
                  className="mt-0.5 w-full rounded-md border border-border/60 bg-background px-1 py-0.5 text-[11px] text-foreground"
                >
                  <option value="">全部</option>
                  {config.statuses.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {level === 'sandbox' ? (
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filters.hasMetrics === true}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      hasMetrics: event.target.checked ? true : undefined,
                    })
                  }
                />
                只看有指标的
              </label>
            ) : null}

            {surplusFilter ? (
              <button
                type="button"
                onClick={() => setSurplusFilter(null)}
                className="w-full rounded-sm border border-border/50 px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
              >
                只看{surplusFilter === 'surplus' ? '盈余' : surplusFilter === 'deficit' ? '赤字' : '平衡'}：清除
              </button>
            ) : null}

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="flex w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                清除筛选
              </button>
            ) : null}
          </aside>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {hint ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground"
              data-testid="economy-hint"
            >
              <span>{hint.text}</span>
              <button
                type="button"
                onClick={hint.onClick}
                className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
              >
                {hint.action}
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
        </div>

        {inspectorOpen ? (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-border/40 pl-2">
            {selectedNode ? (
              <InspectorPanel
                worldId={worldId}
                complexity={level}
                node={selectedNode}
                edges={edges}
                levels={config.levels}
                statuses={config.statuses}
                fieldSchema={config.fieldSchema ?? {}}
                metrics={config.metrics}
                metricSamples={metricSamplesOf(data.metrics, selectedNode.id)}
                entries={data.entries}
                kindDefs={config.entityTypes}
                canWrite={canWrite}
                refs={refApi}
                onNavigateToEntity={onNavigateToEntity}
                onClose={() => setInspectorOpen(false)}
                onUpdateMeta={async (nodeId, patch) => {
                  await data.updateEntity(nodeId, { meta: patch });
                }}
                onUpdateName={async (nodeId, name) => {
                  await data.updateEntity(nodeId, { name });
                }}
                onSaveMetrics={data.saveMetricSamples}
                onSaveEntry={data.saveEntry}
                onDeleteEntity={async (nodeId) => {
                  await data.deleteEntity(nodeId);
                  clearSelection();
                }}
                onLinkChanged={() => data.refetch()}
                onNavigateToHistory={onNavigateToEntity}
              />
            ) : (
              <p className="p-2 text-[11px] text-muted-foreground">
                选中一个{level === 'sketch' ? '关键词' : term('entityWord', '实体')}后，这里显示它的概览、字段与
                {level === 'sketch' ? '往来' : term('linkWord', '关联')}。
              </p>
            )}
          </aside>
        ) : null}
      </div>

      {deletePending ? (
        <div
          data-testid="economy-delete-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="删除确认"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg">
            <h2 className="text-xs font-semibold text-foreground">
              删除「{pendingNode?.name ?? '这一项'}」？
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              它参与的{term('linkWord', '关联')}会一并删除（级联）；其余数据不受影响。
            </p>
            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setDeletePending(null)}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-md bg-destructive px-2.5 py-1 text-[11px] text-destructive-foreground transition-colors hover:bg-destructive/90 motion-reduce:transition-none"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PromoteChipModal
        open={promote !== null}
        chip={promote?.chip ?? null}
        field={promote?.field ?? null}
        kinds={config.entityTypes}
        onClose={() => setPromote(null)}
        onConfirm={async (kind) => {
          const current = promote;
          if (!current) return;
          setPromote(null);
          await promoteChip(current.chip, current.field, kind);
        }}
      />

      <span className="sr-only" aria-live="polite">
        {expandedNotice ?? foldedNotice?.text ?? ''}
      </span>
    </div>
  );
};

export default EconomyViewV2;
