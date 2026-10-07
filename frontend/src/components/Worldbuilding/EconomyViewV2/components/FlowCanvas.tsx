/**
 * 线路图画布 FlowCanvas（Phase 5 P5-T10；economy_ui_design §4.5.1/§4.5.2/§4.6.2/§5.6）
 *
 * 结构档的主视图：SVG 画布 + 阶段 / 类型泳道 + 图例 + 空态。只读展示，所有写操作都经 props 回调：
 * - 默认泳道由 `graph/layout.buildLaneLayout` 给出（阶段泳道；通货 / 制度合并成底部横切轨），
 *   切换「网络图」时用 `buildNetworkLayout`（自研环形，不引入图形库）；
 * - `role="application"` + `aria-label`；节点可聚焦，Tab / Shift+Tab 按同序（泳道顺序）移动焦点，
 *   方向键移动选中、Enter 打开、Esc 清空选择（§5.6）；账册视图是等价的键盘路径；
 * - 沙盘档只在**绘制**上叠加规模 / 流量 / 盈余：不改数据、不改筛选结果（§4.6.2）；
 * - 渲染档由 `graph/guards.renderModeOf` 统一判定：300 以内 `svg`（完整标签），
 *   300-800 `simplified`（只画选中 / hover 的标签），> 800 `matrix`（矩阵由外壳渲染，本组件不参与）；
 *   这里不做 canvas 渲染优化（economy_ui_design §11.1 的分层 canvas 仍是 P6 事项）；
 * - `degraded=true` 时整块退化为一句说明 + 「打开账册矩阵」（矩阵由外壳渲染）；
 * - 顶部工具条的 4 个控件由 `FlowCanvasProps` 的可选回调驱动：回调存在时才渲染该控件，
 *   4 个都不存在时整条工具条不渲染（外壳自带同名控件时不出现点不动的重复工具条）。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Network, PenLine, Plus, Route, Search, Table, TriangleAlert, X } from 'lucide-react';

import {
  ECONOMY_CANVAS_MIN_HEIGHT,
  ECONOMY_CANVAS_WIDTH,
  ECONOMY_LANE_HEADER,
  ECONOMY_LANE_PADDING,
  SURPLUS_TONE_KEY,
  buildLaneLayout,
  buildNetworkLayout,
  clampEdgeWidth,
  defaultNodeSize,
  edgeWidthFromIntensity,
  formatScaleLabel,
  hasActiveFilter,
  layerVisible,
  matchesEconomyFilter,
} from '../graph/layout';
import { renderModeOf } from '../graph/guards';
import {
  ECONOMY_LAYERS,
  ECONOMY_LINK_LABELS,
  ECONOMY_LAYOUT_LABELS,
  SURPLUS_LABELS,
} from '../config';
import type {
  EconomyEdge,
  EconomyLayerId,
  EconomyLayoutMode,
  EconomyNode,
  FlowCanvasProps,
} from '../types';
import { GraphEdge } from './GraphEdge';
import { GraphNode } from './GraphNode';

/** 画布工具条可选控件的线型图例（线型严格遵循契约注册表：solid / dashed / dotted / double） */
const LINE_STYLE_SAMPLES: { id: string; label: string; dash?: string }[] = [
  { id: 'solid', label: 'solid', dash: undefined },
  { id: 'dashed', label: 'dashed', dash: '7 5' },
  { id: 'dotted', label: 'dotted', dash: '2 4' },
  { id: 'double', label: 'double', dash: undefined },
];

export const FlowCanvas = ({
  nodes,
  edges,
  layout,
  groupBy,
  filters,
  layers,
  selectedId,
  visual,
  sandbox,
  degraded,
  kindDefs,
  refs,
  onSelect,
  onOpenEntity,
  onNavigateToEntity,
  onClearSelection,
  onOpenLedger,
  onAddEntity,
  onLayoutChange,
  onGroupByChange,
  onSearchChange,
  onResetFilter,
}: FlowCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const mode: 'lanes' | 'network' = layout === 'network' ? 'network' : 'lanes';
  // 300 以上简化标签；> 800 时外壳改用账册矩阵，本组件不再挂载（renderModeOf 是唯一真源）
  const simplified = renderModeOf(nodes.length) !== 'svg';
  const flowOn = layerVisible(layers, 'flows');
  const balanceOn = layerVisible(layers, 'balance');

  /** 图层只影响绘制；筛选口径与账册完全一致（§5.5） */
  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (!layerVisible(layers, 'external') && node.external) return false;
        if (!layerVisible(layers, 'currency') && node.kind === 'currency') return false;
        if (!layerVisible(layers, 'institutions') && node.kind === 'institution') return false;
        return matchesEconomyFilter(node, filters);
      }),
    [nodes, layers, filters]
  );

  const nodeMap = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () => edges.filter((edge) => nodeMap.has(edge.source.id) && nodeMap.has(edge.target.id)),
    [edges, nodeMap]
  );

  const laneLayout = useMemo(
    () => (mode === 'lanes' ? buildLaneLayout(visibleNodes, { groupBy, kinds: kindDefs }) : null),
    [mode, visibleNodes, groupBy, kindDefs]
  );
  const networkLayout = useMemo(
    () => (mode === 'network' ? buildNetworkLayout(visibleNodes, visibleEdges) : null),
    [mode, visibleNodes, visibleEdges]
  );

  const positions = useMemo(
    () => (networkLayout ?? laneLayout)?.positions ?? {},
    [laneLayout, networkLayout]
  );
  const lanes = laneLayout?.lanes ?? [];
  const canvasSize = networkLayout
    ? { width: networkLayout.width, height: networkLayout.height }
    : {
        width: laneLayout?.width ?? ECONOMY_CANVAS_WIDTH,
        height: laneLayout?.height ?? ECONOMY_CANVAS_MIN_HEIGHT,
      };

  const invalidExternalCount = useMemo(
    () => visibleNodes.filter((node) => node.external && refs.isInvalid(node.ref)).length,
    [visibleNodes, refs]
  );

  const hiddenLayers = useMemo(
    () =>
      ECONOMY_LAYERS.filter((layer) => layers[layer.id as EconomyLayerId] === false).map(
        (layer) => layer.label
      ),
    [layers]
  );

  const filterActive = hasActiveFilter(filters);
  const empty = !degraded && visibleNodes.length === 0;
  const filteredOut = empty && nodes.length > 0;
  /**
   * 工具条只在有可交互控件时渲染（§4.5.1）：4 个可选回调都不传时整条不渲染，
   * 免得外壳已自带同名控件时出现一条点不动的重复工具条。
   */
  const hasToolbar = !!onLayoutChange || !!onGroupByChange || !!onSearchChange || !!onResetFilter;

  const openNode = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId) ?? nodes.find((item) => item.id === nodeId);
      if (node?.external) {
        onNavigateToEntity(node.ref);
        return;
      }
      onOpenEntity(nodeId);
    },
    [nodeMap, nodes, onNavigateToEntity, onOpenEntity]
  );

  /** 外站单击即跳转（§5.4），同时保留选中以便账册同步高亮 */
  const handleSelect = useCallback(
    (nodeId: string) => {
      onSelect(nodeId);
      const node = nodeMap.get(nodeId);
      if (node?.external) onNavigateToEntity(node.ref);
    },
    [nodeMap, onNavigateToEntity, onSelect]
  );

  const focusNode = useCallback((nodeId: string) => {
    const element = svgRef.current?.querySelector<SVGGElement>(`[data-node-id="${nodeId}"]`);
    element?.focus?.();
  }, []);

  const moveSelection = useCallback(
    (dx: number, dy: number) => {
      const candidates = visibleNodes
        .map((node) => ({ id: node.id, pos: positions[node.id] }))
        .filter((item): item is { id: string; pos: { x: number; y: number } } => !!item.pos);
      if (candidates.length === 0) return;
      const current = selectedId ? positions[selectedId] : undefined;
      if (!current) {
        onSelect(candidates[0].id);
        focusNode(candidates[0].id);
        return;
      }
      let best: { id: string; score: number } | null = null;
      for (const candidate of candidates) {
        if (candidate.id === selectedId) continue;
        const ddx = candidate.pos.x - current.x;
        const ddy = candidate.pos.y - current.y;
        const along = ddx * dx + ddy * dy;
        if (along <= 1) continue; // 只往按键方向找，不回头
        const lateral = Math.abs(ddx * dy - ddy * dx);
        const score = along + lateral * 3;
        if (!best || score < best.score) best = { id: candidate.id, score };
      }
      if (best) {
        onSelect(best.id);
        focusNode(best.id);
      }
    },
    [focusNode, onSelect, positions, selectedId, visibleNodes]
  );

  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClearSelection();
      return;
    }
    if (event.key === 'Enter' && selectedId) {
      event.preventDefault();
      openNode(selectedId);
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    moveSelection(direction[0], direction[1]);
  };

  const widthOf = (edge: EconomyEdge): number => {
    if (sandbox && flowOn && !visual.flowless) {
      const value = visual.edgeWidth[edge.id];
      if (typeof value === 'number' && Number.isFinite(value)) return clampEdgeWidth(value);
    }
    return edgeWidthFromIntensity(edge.intensity);
  };

  const surplusOf = (edge: EconomyEdge) =>
    sandbox && balanceOn ? visual.edgeSurplus[edge.id] ?? 'unknown' : 'unknown';

  const sizeOf = (node: EconomyNode) => {
    if (sandbox) {
      const value = visual.nodeSize[node.id];
      if (value) return value;
    }
    return defaultNodeSize(node);
  };

  const nodeSurplusOf = (node: EconomyNode) =>
    sandbox && balanceOn ? visual.nodeSurplus[node.id] ?? 'unknown' : 'unknown';

  const dimmedOf = (node: EconomyNode) =>
    sandbox && visual.inWindow.size > 0 && !visual.inWindow.has(node.id);

  return (
    <div
      data-testid="economy-canvas"
      data-layout={layout}
      data-mode={mode}
      data-group-by={groupBy}
      data-sandbox={sandbox ? 'true' : 'false'}
      data-degraded={degraded ? 'true' : 'false'}
      data-simplified={simplified ? 'true' : 'false'}
      className="relative flex h-full min-h-0 flex-col"
    >
      {hasToolbar && (
        <div
          role="group"
          aria-label="画布工具条"
          data-testid="economy-canvas-toolbar"
          className="flex flex-wrap items-center gap-1.5 border-b border-border/40 px-2 py-1.5"
        >
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            {groupBy === 'kind' ? '类型泳道' : '阶段泳道'}
          </span>

          {onLayoutChange && (
            <div
              role="group"
              aria-label="布局"
              className="flex items-center overflow-hidden rounded-md border border-border/50"
            >
              {(['lanes', 'network'] as EconomyLayoutMode[]).map((item) => {
                const active = (item === 'network' ? 'network' : 'lanes') === mode;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onLayoutChange(item)}
                    data-testid={`economy-canvas-layout-${item}`}
                    className={`flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent/30'
                    }`}
                  >
                    {item === 'network' ? (
                      <Network className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Route className="h-3 w-3" aria-hidden="true" />
                    )}
                    {ECONOMY_LAYOUT_LABELS[item]}
                  </button>
                );
              })}
            </div>
          )}

          {onGroupByChange && (
            <button
              type="button"
              onClick={() => onGroupByChange(groupBy === 'kind' ? 'stage' : 'kind')}
              data-testid="economy-canvas-groupby"
              className="rounded-md border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
            >
              按{groupBy === 'kind' ? '阶段' : '类型'}
            </button>
          )}

          {onSearchChange && (
            <label className="flex items-center gap-1 rounded-md border border-border/50 px-1.5 py-0.5">
              <Search className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={filters.search ?? ''}
                aria-label="搜索实体"
                placeholder="搜索 名称 / kind:market"
                data-testid="economy-canvas-search"
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-40 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </label>
          )}

          {filterActive && onResetFilter && (
            <button
              type="button"
              onClick={onResetFilter}
              data-testid="economy-canvas-reset"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10 motion-reduce:transition-none"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              清除筛选
            </button>
          )}

          {invalidExternalCount > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border border-dashed border-destructive/40 px-1.5 py-0.5 text-[10px] text-destructive"
              data-testid="economy-canvas-invalid-refs"
            >
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              外站引用失效 {invalidExternalCount}
            </span>
          )}

          <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
            {hiddenLayers.length > 0 && <span>已隐藏图层：{hiddenLayers.join(' / ')}</span>}
            <span data-testid="economy-canvas-counts">
              节点 {visibleNodes.length}/{nodes.length}
              {sandbox ? ' · 规模与流量叠加' : ''}
              {simplified ? ' · 简化标签' : ''}
            </span>
          </span>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {degraded ? (
          <div
            data-testid="economy-canvas-degraded"
            className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <Table className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              实体数超过画布上限，线路图不再铺开：已降级为账册矩阵（不做真实渲染优化）。
            </p>
            <button
              type="button"
              onClick={onOpenLedger}
              data-testid="economy-canvas-open-matrix"
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none"
            >
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
              打开账册矩阵
            </button>
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              role="application"
              aria-label="经济脉络图"
              tabIndex={0}
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              preserveAspectRatio="xMidYMid meet"
              onKeyDown={handleKeyDown}
              onPointerMove={(event) => {
                if (!simplified) return;
                const target = (event.target as Element | null)?.closest?.('[data-node-id]');
                const nextId = target?.getAttribute('data-node-id') ?? null;
                setHoverId((prev) => (prev === nextId ? prev : nextId));
              }}
              onPointerLeave={() => setHoverId(null)}
              className="h-full w-full select-none bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} className="fill-background" />

              {lanes.map((lane) => (
                <g
                  key={lane.id}
                  data-testid={`economy-lane-${lane.id}`}
                  data-lane-kind={lane.kind ?? ''}
                  data-crosscut={lane.crosscut ? 'true' : 'false'}
                  data-lane-count={lane.nodeIds.length}
                >
                  <rect
                    x={0}
                    y={lane.y}
                    width={lane.width}
                    height={lane.height}
                    className={lane.index % 2 === 0 ? 'fill-muted/20' : 'fill-muted/10'}
                  />
                  <line
                    x1={0}
                    y1={lane.y}
                    x2={lane.width}
                    y2={lane.y}
                    strokeWidth={1}
                    className="stroke-border/60"
                  />
                  {lane.crosscut && (
                    <line
                      x1={0}
                      y1={lane.y + lane.height / 2}
                      x2={lane.width}
                      y2={lane.y + lane.height / 2}
                      strokeWidth={1.5}
                      strokeDasharray="2 6"
                      className="stroke-cyan-600/40 dark:stroke-cyan-400/40"
                    />
                  )}
                  <text
                    x={ECONOMY_LANE_PADDING}
                    y={lane.y + ECONOMY_LANE_HEADER - 9}
                    fontSize={11}
                    letterSpacing="0.08em"
                    className="fill-muted-foreground"
                  >
                    {lane.label}
                  </text>
                  <text
                    x={ECONOMY_LANE_PADDING + lane.label.length * 13 + 4}
                    y={lane.y + ECONOMY_LANE_HEADER - 9}
                    fontSize={10}
                    className="fill-muted-foreground/70"
                  >
                    {lane.nodeIds.length}
                  </text>
                </g>
              ))}

              {mode === 'network' && (
                <text x={ECONOMY_LANE_PADDING} y={22} fontSize={11} className="fill-muted-foreground">
                  网络图：关联数最多的实体居中，其余按关联数分环
                </text>
              )}

              <g data-testid="economy-edge-layer">
                {visibleEdges.map((edge) => {
                  const from = positions[edge.source.id];
                  const to = positions[edge.target.id];
                  if (!from || !to) return null;
                  const meta = ECONOMY_LINK_LABELS[edge.linkType];
                  const surplus = surplusOf(edge);
                  const baseTone = meta?.color ?? 'slate';
                  const tone = surplus !== 'unknown' ? SURPLUS_TONE_KEY[surplus] : baseTone;
                  const showLabel = sandbox && flowOn;
                  return (
                    <GraphEdge
                      key={edge.id}
                      edge={edge}
                      from={from}
                      to={to}
                      width={widthOf(edge)}
                      surplus={surplus}
                      label={showLabel ? visual.edgeLabel[edge.id] ?? '' : ''}
                      lineStyle={meta?.lineStyle ?? 'dotted'}
                      color={tone}
                      dimmed={
                        sandbox &&
                        visual.inWindow.size > 0 &&
                        !(visual.inWindow.has(edge.source.id) && visual.inWindow.has(edge.target.id))
                      }
                      selected={selectedEdgeId === edge.id}
                      onSelect={(edgeId) => setSelectedEdgeId((prev) => (prev === edgeId ? null : edgeId))}
                    />
                  );
                })}
              </g>

              <g data-testid="economy-node-layer">
                {visibleNodes.map((node) => {
                  const position = positions[node.id];
                  if (!position) return null;
                  return (
                    <GraphNode
                      key={node.id}
                      node={node.name?.trim() ? node : { ...node, name: refs.resolveName(node.ref) }}
                      x={position.x}
                      y={position.y}
                      size={sizeOf(node)}
                      selected={selectedId === node.id}
                      sandbox={sandbox}
                      surplus={nodeSurplusOf(node)}
                      scaleLabel={sandbox ? formatScaleLabel(node.scale, node.unit) : ''}
                      external={node.external}
                      stub={node.stub}
                      dimmed={dimmedOf(node)}
                      kindDef={kindDefs.find((def) => def.id === node.kind)}
                      showLabel={!simplified || selectedId === node.id || hoverId === node.id}
                      onSelect={handleSelect}
                      onOpenEntity={openNode}
                    />
                  );
                })}
              </g>
            </svg>

            {empty && (
              <div
                data-testid="economy-canvas-empty"
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
              >
                {filteredOut ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      当前筛选下没有实体：放宽条件或清除筛选。
                    </p>
                    {onResetFilter && (
                      <button
                        type="button"
                        onClick={onResetFilter}
                        data-testid="economy-canvas-empty-reset"
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        清除筛选
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">还没有经济实体：先建一个，或先写速写卡。</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={onAddEntity}
                        data-testid="economy-canvas-add"
                        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        添加第一个实体
                      </button>
                      <button
                        type="button"
                        onClick={onOpenLedger}
                        data-testid="economy-canvas-sketch"
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
                      >
                        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                        先写速写卡
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div
        data-testid="economy-legend"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 px-2 py-1 text-[10px] text-muted-foreground"
      >
        <span className="flex items-center gap-1">
          <span className="inline-flex h-3 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
          </span>
          [外站] 跨模块只读，点击跳转对方模块
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full border border-dashed border-muted-foreground/70" />
          虚线光环 = stub 待补全
        </span>
        <span className="flex items-center gap-2">
          线型遵循契约注册表：
          {LINE_STYLE_SAMPLES.map((sample) => (
            <span key={sample.id} className="flex items-center gap-1">
              <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true">
                <path
                  d="M0 4 H24"
                  fill="none"
                  strokeWidth={sample.id === 'double' ? 1.2 : 1.6}
                  strokeDasharray={sample.dash}
                  className="stroke-muted-foreground"
                />
                {sample.id === 'double' && (
                  <path
                    d="M0 1.5 H24 M0 6.5 H24"
                    fill="none"
                    strokeWidth={1.2}
                    className="stroke-muted-foreground"
                  />
                )}
              </svg>
              {sample.label}
            </span>
          ))}
        </span>
        {sandbox && (
          <span className="flex flex-wrap items-center gap-2" data-testid="economy-legend-sandbox">
            <span>盈余 {SURPLUS_LABELS.surplus}</span>
            <span className="text-cyan-600 dark:text-cyan-400">平衡 {SURPLUS_LABELS.balanced}</span>
            <span className="text-amber-600 dark:text-amber-400">
              赤字 {SURPLUS_LABELS.deficit}（琥珀 + 斜纹）
            </span>
            <span>未知 {SURPLUS_LABELS.unknown}（空心环）</span>
            <span>线宽 = 流量，无流量时按强度</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default FlowCanvas;
