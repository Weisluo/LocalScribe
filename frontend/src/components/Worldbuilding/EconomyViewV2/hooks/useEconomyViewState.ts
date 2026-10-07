/**
 * 经济视图状态（Phase 5 P5-T8；economy_ui_design §4.2/§4.3/§5.5/§8.5/§11.4）
 *
 * 只存在于前端：档位、布局、分组、选中 / 悬停、筛选、图层、时间窗、折叠提示、检查器开合、播放态。
 * 一律不写世界数据；档位与布局存本地偏好，URL query 覆盖（replaceState，URL 不可写时静默跳过）。
 *
 * URL query 分两类（§5.4「可分享 / 刷新恢复」）：
 * - **偏好**：档位 / 布局 —— 本地偏好，跨世界沿用；
 * - **内容相关**：分组、选中、筛选、时间窗 —— **带作用域**（`economyScope` = 所属模块 id），
 *   切世界 / 切模块后作用域不匹配的一组参数整组忽略（否则新世界会读回上一个世界的状态）。
 *
 * 档位是「受控」的：真正的档位值来自 common 的 ComplexityProvider（useComplexity().level），
 * 本 hook 只负责把 URL / 本地偏好 / ModuleConfig.defaultComplexity 的优先级算出来，
 * 并通过 setComplexity 回写全局 provider（不落库，WorldbuildingView 只把它存本地 state）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  ECONOMY_TERM_DEFAULTS,
  EMPTY_ECONOMY_FILTER,
  defaultLayerState,
  resolveEconomyLayout,
} from '../config';
import type {
  EconomyFilterState,
  EconomyFoldCounts,
  EconomyFoldedNotice,
  EconomyGroupBy,
  EconomyLayerState,
  EconomyLayoutMode,
  EconomyTimeWindow,
} from '../types';

/** URL query 键（可分享 / 刷新恢复；§5.4） */
export const ECONOMY_URL_KEYS = {
  complexity: 'economyComplexity',
  layout: 'economyLayout',
  group: 'economyGroup',
  selected: 'economyPick',
  stages: 'economyStages',
  kinds: 'economyKinds',
  levels: 'economyLevels',
  statuses: 'economyStatuses',
  search: 'economySearch',
  windowStart: 'economyWindowStart',
  windowEnd: 'economyWindowEnd',
  /** 作用域：上面这组内容相关参数属于哪个经济模块（F7：跨世界 / 跨模块泄漏） */
  scope: 'economyScope',
} as const;

/**
 * 带作用域的 URL 键：初始化时只认作用域匹配的那一组。
 * 档位 / 布局不在其中：它们是跨世界沿用的本地偏好（§8.5）。
 */
export const ECONOMY_SCOPED_URL_KEYS = [
  ECONOMY_URL_KEYS.group,
  ECONOMY_URL_KEYS.selected,
  ECONOMY_URL_KEYS.stages,
  ECONOMY_URL_KEYS.kinds,
  ECONOMY_URL_KEYS.levels,
  ECONOMY_URL_KEYS.statuses,
  ECONOMY_URL_KEYS.search,
  ECONOMY_URL_KEYS.windowStart,
  ECONOMY_URL_KEYS.windowEnd,
] as const;

/** 本地偏好（§8.5：档位与布局存本地偏好，不进世界数据） */
export const ECONOMY_STORAGE_KEYS = {
  complexity: 'localscribe.economyView.complexity',
  layout: 'localscribe.economyView.layout',
} as const;

const LEVELS: ComplexityLevel[] = ['sketch', 'structure', 'sandbox'];

const normalizeLevel = (value: string | null | undefined): ComplexityLevel | null =>
  value === 'sketch' || value === 'structure' || value === 'sandbox' ? value : null;

const urlParams = (): URLSearchParams =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

const readUrl = (key: string): string | null => urlParams().get(key);

/**
 * 作用域是否匹配（纯函数，便于离线断言）：URL 里的 `economyScope` 必须等于当前模块作用域。
 * 没有作用域键（旧链接，或上一个世界留下的参数）一律视为不匹配 —— 宁可丢状态，也不读错世界。
 */
export const economyUrlScopeMatches = (search: string, scope?: string | null): boolean =>
  !!scope && new URLSearchParams(search).get(ECONOMY_URL_KEYS.scope) === scope;

/** 读带作用域的 URL 参数：作用域不匹配一律当没有（那组参数由 URL 同步在挂载后清掉） */
const readScopedUrl = (key: string, scope?: string | null): string | null => {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  if (!economyUrlScopeMatches(search, scope)) return null;
  return new URLSearchParams(search).get(key);
};

const readStorage = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // 隐私模式 / 存储禁用：静默跳过，状态仍在内存里
  }
};

const listOf = (raw: string | null): string[] =>
  (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const readInitialFilters = (scope?: string | null): EconomyFilterState => ({
  stages: listOf(readScopedUrl(ECONOMY_URL_KEYS.stages, scope)),
  kinds: listOf(readScopedUrl(ECONOMY_URL_KEYS.kinds, scope)),
  levels: listOf(readScopedUrl(ECONOMY_URL_KEYS.levels, scope)),
  statuses: listOf(readScopedUrl(ECONOMY_URL_KEYS.statuses, scope)),
  linkCount: {},
  search: readScopedUrl(ECONOMY_URL_KEYS.search, scope) ?? '',
});

const readInitialWindow = (scope?: string | null): EconomyTimeWindow => ({
  start: readScopedUrl(ECONOMY_URL_KEYS.windowStart, scope) ?? undefined,
  end: readScopedUrl(ECONOMY_URL_KEYS.windowEnd, scope) ?? undefined,
});

export interface UseEconomyViewStateOptions {
  /** 当前档位（来自 useComplexity().level，受控） */
  complexity: ComplexityLevel;
  /** 档位回写（useComplexity().setLevel） */
  setComplexity: (next: ComplexityLevel) => void;
  /** 模块配置的默认档（EconomyModuleConfig.defaultComplexity），优先级低于 URL / 本地偏好 */
  defaultComplexity?: ComplexityLevel;
  /** 模块配置的默认布局（displayMode） */
  defaultLayout?: string | null;
  /** config.layers 推出的图层默认值；不传则用出厂骨架 defaultLayerState() */
  layerDefaults?: EconomyLayerState;
  /**
   * URL 作用域（当前经济模块 id）：`economyStages / economyPick / economyWindowStart` 这组参数
   * 只在作用域一致时生效；切世界 / 切模块后不匹配的一组参数忽略并被清掉（F7）。
   */
  scope?: string;
}

export interface UseEconomyViewStateResult {
  complexity: ComplexityLevel;
  setComplexity: (next: ComplexityLevel) => void;

  layout: EconomyLayoutMode;
  setLayout: (next: EconomyLayoutMode) => void;
  groupBy: EconomyGroupBy;
  setGroupBy: (next: EconomyGroupBy) => void;

  selectedId: string | null;
  setSelectedId: (next: string | null) => void;
  clearSelection: () => void;
  hoveredId: string | null;
  setHoveredId: (next: string | null) => void;

  filters: EconomyFilterState;
  setFilters: (next: EconomyFilterState) => void;
  /** 搜索输入框的即时值 */
  search: string;
  setSearch: (next: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;

  layers: EconomyLayerState;
  setLayers: (next: EconomyLayerState) => void;
  resetLayers: () => void;

  timeWindow: EconomyTimeWindow;
  setTimeWindow: (next: EconomyTimeWindow) => void;
  resetTimeWindow: () => void;

  /** 降档常驻折叠条（用户手动关闭前一直在） */
  foldedNotice: EconomyFoldedNotice | null;
  dismissFoldedNotice: () => void;
  /** 升档 3 秒提示（§8.5：不弹模态、不打扰） */
  expandedNotice: string | null;
  notifyFolded: (direction: 'up' | 'down', counts: Partial<EconomyFoldCounts>) => void;

  inspectorOpen: boolean;
  setInspectorOpen: (next: boolean) => void;
  toggleInspector: () => void;

  playing: boolean;
  setPlaying: (next: boolean) => void;

  /** F 键：重挂画布使其回到默认适配（FlowCanvas props 已冻结，没有 pan/zoom 句柄） */
  fitNonce: number;
  requestFit: () => void;
}

const foldedText = (
  direction: 'up' | 'down',
  counts: Partial<EconomyFoldCounts>
): string => {
  const links = counts.links ?? 0;
  const metrics = counts.metrics ?? 0;
  const fields = counts.fields ?? 0;
  if (direction === 'up') {
    const total = links + metrics + fields;
    return total > 0 ? `已展开 ${total} 项` : '已展开';
  }
  const parts: string[] = [];
  if (links > 0) parts.push(`${links} 条${ECONOMY_TERM_DEFAULTS.flowWord}`);
  if (metrics > 0) parts.push(`${metrics} 个数值`);
  if (fields > 0) parts.push(`${fields} 个字段`);
  if (parts.length === 0) return '没有折叠的内容（数据未删除）';
  return `已折叠 ${parts.join('、')}（数据未删除）`;
};

export const useEconomyViewState = ({
  complexity,
  setComplexity,
  defaultComplexity,
  defaultLayout,
  layerDefaults,
  scope,
}: UseEconomyViewStateOptions): UseEconomyViewStateResult => {
  /* ---------------- 布局 ---------------- */
  const [layout, setLayoutState] = useState<EconomyLayoutMode>(() =>
    resolveEconomyLayout(readUrl(ECONOMY_URL_KEYS.layout) ?? readStorage(ECONOMY_STORAGE_KEYS.layout))
  );
  const layoutSeeded = useRef(false);
  useEffect(() => {
    if (layoutSeeded.current) return;
    if (defaultLayout === undefined) return;
    layoutSeeded.current = true;
    // URL / 本地偏好已明确指定时以它们为准（§8.5）
    if (readUrl(ECONOMY_URL_KEYS.layout) || readStorage(ECONOMY_STORAGE_KEYS.layout)) return;
    setLayoutState(resolveEconomyLayout(defaultLayout));
  }, [defaultLayout]);

  const setLayout = useCallback((next: EconomyLayoutMode) => {
    setLayoutState(next);
    writeStorage(ECONOMY_STORAGE_KEYS.layout, next);
  }, []);

  /* ---------------- 档位（受控 + 一次性播种） ---------------- */
  const levelSeeded = useRef(false);
  useEffect(() => {
    if (levelSeeded.current) return;
    const fromUrl = normalizeLevel(readUrl(ECONOMY_URL_KEYS.complexity));
    const fromStorage = normalizeLevel(readStorage(ECONOMY_STORAGE_KEYS.complexity));
    if (!fromUrl && !fromStorage && defaultComplexity === undefined) return;
    levelSeeded.current = true;
    const next = fromUrl ?? fromStorage ?? defaultComplexity;
    if (next && next !== complexity) setComplexity(next);
  }, [complexity, defaultComplexity, setComplexity]);

  const handleComplexity = useCallback(
    (next: ComplexityLevel) => {
      setComplexity(next);
      writeStorage(ECONOMY_STORAGE_KEYS.complexity, next);
    },
    [setComplexity]
  );

  /* ---------------- 分组 / 选中 / 筛选 ---------------- */
  const [groupBy, setGroupByState] = useState<EconomyGroupBy>(() =>
    readScopedUrl(ECONOMY_URL_KEYS.group, scope) === 'kind' ? 'kind' : 'stage'
  );
  const setGroupBy = useCallback((next: EconomyGroupBy) => setGroupByState(next), []);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => readScopedUrl(ECONOMY_URL_KEYS.selected, scope) ?? null
  );
  const clearSelection = useCallback(() => setSelectedId(null), []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [filters, setFilters] = useState<EconomyFilterState>(() => readInitialFilters(scope));
  const [search, setSearch] = useState(
    () => readScopedUrl(ECONOMY_URL_KEYS.search, scope) ?? ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => readScopedUrl(ECONOMY_URL_KEYS.search, scope) ?? ''
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setFilters((prev) => (prev.search === debouncedSearch ? prev : { ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  const resetFilters = useCallback(() => {
    setFilters({ ...EMPTY_ECONOMY_FILTER });
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const activeFilterCount = useMemo(
    () =>
      filters.stages.length +
      filters.kinds.length +
      filters.levels.length +
      filters.statuses.length +
      (filters.search.trim() ? 1 : 0) +
      (filters.hasMetrics ? 1 : 0) +
      (filters.linkCount?.min !== undefined || filters.linkCount?.max !== undefined ? 1 : 0),
    [filters]
  );

  /* ---------------- 图层 / 时间窗 ---------------- */
  const [layers, setLayersState] = useState<EconomyLayerState>(
    () => layerDefaults ?? defaultLayerState(complexity)
  );
  const layersTouched = useRef(false);
  const setLayers = useCallback((next: EconomyLayerState) => {
    layersTouched.current = true;
    setLayersState(next);
  }, []);
  // 模块配置异步到达后补种图层默认值；用户已手动开关过就不再覆盖（就地 morph，不丢用户选择）
  useEffect(() => {
    if (layersTouched.current || !layerDefaults) return;
    setLayersState((prev) =>
      JSON.stringify(prev) === JSON.stringify(layerDefaults) ? prev : { ...layerDefaults }
    );
  }, [layerDefaults]);
  const resetLayers = useCallback(
    () => setLayersState(layerDefaults ?? defaultLayerState(complexity)),
    [complexity, layerDefaults]
  );

  const [timeWindow, setTimeWindowState] = useState<EconomyTimeWindow>(() =>
    readInitialWindow(scope)
  );
  const setTimeWindow = useCallback((next: EconomyTimeWindow) => setTimeWindowState(next), []);
  const resetTimeWindow = useCallback(() => setTimeWindowState({}), []);

  /**
   * 作用域变化（切世界 / 切模块）：内存状态清空，URL 那组参数由下面的同步 effect 抹掉。
   *
   * 切世界时 WorldbuildingView 只 `setActiveTab('map')`、不清 URL；重新挂载时作用域不匹配的一组参数
   * 已被 `readScopedUrl` 忽略，这个 effect 再清掉「同一个实例里作用域变了」的残留状态，
   * 保证新世界不会继续用上一个世界的筛选 / 选中 / 时间窗。
   */
  const scopeRef = useRef(scope);
  useEffect(() => {
    if (scopeRef.current === scope) return;
    scopeRef.current = scope;
    setGroupByState('stage');
    setSelectedId(null);
    setFilters({ ...EMPTY_ECONOMY_FILTER });
    setSearch('');
    setDebouncedSearch('');
    setTimeWindowState({});
  }, [scope]);

  /* ---------------- 折叠提示（§4.3/§8.5） ---------------- */
  const [foldedNotice, setFoldedNotice] = useState<EconomyFoldedNotice | null>(null);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);
  const expandedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissFoldedNotice = useCallback(() => setFoldedNotice(null), []);

  const notifyFolded = useCallback((direction: 'up' | 'down', counts: Partial<EconomyFoldCounts>) => {
    const text = foldedText(direction, counts);
    if (direction === 'up') {
      setFoldedNotice(null);
      setExpandedNotice(text);
      if (expandedTimer.current) clearTimeout(expandedTimer.current);
      expandedTimer.current = setTimeout(() => setExpandedNotice(null), 3000);
      return;
    }
    setExpandedNotice(null);
    setFoldedNotice({
      links: counts.links ?? 0,
      metrics: counts.metrics ?? 0,
      fields: counts.fields ?? 0,
      direction,
      text,
    });
  }, []);

  useEffect(
    () => () => {
      if (expandedTimer.current) clearTimeout(expandedTimer.current);
    },
    []
  );

  /* ---------------- 检查器 / 播放态 / 适配 ---------------- */
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const toggleInspector = useCallback(() => setInspectorOpen((prev) => !prev), []);

  const [playing, setPlaying] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const requestFit = useCallback(() => setFitNonce((prev) => prev + 1), []);

  /* ---------------- URL 同步（replaceState；§5.4） ---------------- */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const put = (key: string, value: string | null | undefined) => {
        if (value) params.set(key, value);
        else params.delete(key);
      };
      put(ECONOMY_URL_KEYS.complexity, complexity);
      put(ECONOMY_URL_KEYS.layout, layout);
      // 作用域键跟着一起写：这组内容相关参数只对当前模块有效（F7）
      put(ECONOMY_URL_KEYS.scope, scope);
      put(ECONOMY_URL_KEYS.group, groupBy === 'kind' ? 'kind' : null);
      put(ECONOMY_URL_KEYS.selected, selectedId);
      put(ECONOMY_URL_KEYS.stages, filters.stages.join(',') || null);
      put(ECONOMY_URL_KEYS.kinds, filters.kinds.join(',') || null);
      put(ECONOMY_URL_KEYS.levels, filters.levels.join(',') || null);
      put(ECONOMY_URL_KEYS.statuses, filters.statuses.join(',') || null);
      put(ECONOMY_URL_KEYS.search, debouncedSearch || null);
      put(ECONOMY_URL_KEYS.windowStart, timeWindow.start);
      put(ECONOMY_URL_KEYS.windowEnd, timeWindow.end);
      const query = params.toString();
      const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', next);
    } catch {
      // URL 不可写（about:blank / 沙箱）：忽略，状态仍在内存里
    }
  }, [
    complexity,
    debouncedSearch,
    filters.kinds,
    filters.levels,
    filters.stages,
    filters.statuses,
    groupBy,
    layout,
    scope,
    selectedId,
    timeWindow.end,
    timeWindow.start,
  ]);

  return {
    complexity,
    setComplexity: handleComplexity,
    layout,
    setLayout,
    groupBy,
    setGroupBy,
    selectedId,
    setSelectedId,
    clearSelection,
    hoveredId,
    setHoveredId,
    filters,
    setFilters,
    search,
    setSearch,
    resetFilters,
    activeFilterCount,
    layers,
    setLayers,
    resetLayers,
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
  };
};

/** 档位顺序（键盘 1/2/3 与 ComplexitySwitcher 共用） */
export const ECONOMY_COMPLEXITY_ORDER = LEVELS;

/**
 * chip / 局部新对象的稳定 id 生成。
 * 速写 chip 展开时会把 chip.id 透传为新实体 id（§3.2：chip 与实体同一个 id），
 * 因此必须优先用 crypto.randomUUID（非安全上下文回退随机串）。
 */
export const newEconomyId = (): string => {
  try {
    const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  } catch {
    // 非安全上下文：回退
  }
  return `eco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};
