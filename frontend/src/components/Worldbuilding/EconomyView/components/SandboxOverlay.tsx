/**
 * 沙盘叠加 SandboxOverlay（Phase 5 P5-T12；economy_ui_design §4.6.1、§4.6.4、§4.7.3）
 *
 * 结构：图层栏（LayerRail）+ 统计（StatsPanel）在顶部，`children`（外壳传入的 FlowCanvas 或分栏）居中，
 * 时间刷从底部滑入（200ms；`prefers-reduced-motion` 直接显示）。
 *
 * 口径：
 * - 播放态由本组件持有（`SandboxOverlayProps` 没有 playing），播放定时器在 TimeBrush 内部；
 *   外壳**只渲染本组件**，不要再在外部渲染第二个 TimeBrush；
 * - CSV 导出按钮在 StatsPanel 上（`data-testid="economy-export-window"`），本文件额外导出
 *   `buildWindowCsv` / `downloadCsv` / `exportWindowCsv` 三个纯 helper，外壳可以直接复用：
 *   前端拼 CSV + `URL.createObjectURL` 下载，**不经后端**、不发请求。
 */

import { useEffect, useState } from 'react';

import { anchorOf, inWindow } from '../graph/guards';
import type {
  EconomyEdge,
  EconomyMetricDef,
  EconomyMetrics,
  EconomyNode,
  EconomyTimeWindow,
  EconomyVisualModel,
  SandboxOverlayProps,
} from '../types';
import { usePrefersReducedMotion } from '../hooks/useTimeline';
import LayerRail from './LayerRail';
import StatsPanel from './StatsPanel';
import TimeBrush from './TimeBrush';

// ---------------------------------------------------------------------------
// CSV（当前窗口导出；纯前端，不经后端）
// ---------------------------------------------------------------------------

export interface EconomyCsvInput {
  nodes: readonly EconomyNode[];
  edges: readonly EconomyEdge[];
  metrics?: EconomyMetrics | null;
  /** 有 visual 时按 `inWindow` 过滤，并附上归一结果（规模档 / 盈余 / 边上标注） */
  visual?: EconomyVisualModel | null;
  /** 指标定义：补中文名与单位（缺省用 metricId） */
  metricDefs?: readonly EconomyMetricDef[];
  window?: EconomyTimeWindow | null;
}

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** 行 -> CSV 文本（内部用；引号 / 逗号 / 换行转义，Excel 友好） */
const toCsv = (rows: readonly (readonly unknown[])[]): string =>
  rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

const surplusLabel = (value: string | undefined): string =>
  value === 'surplus' ? '盈余' : value === 'balanced' ? '平衡' : value === 'deficit' ? '赤字' : '未知';

/** 当前窗口 CSV：节点 / 关联 / 指标三段；缺失值留空，绝不补 0（§4.6.2） */
export const buildWindowCsv = (input: EconomyCsvInput): string => {
  const visual = input.visual ?? null;
  const windowed = Boolean(input.window?.start || input.window?.end);
  const windowInput = { start: input.window?.start, end: input.window?.end };
  const inVisualWindow = (id: string): boolean => (visual ? visual.inWindow.has(id) : true);

  const nodes = windowed ? input.nodes.filter((node) => inVisualWindow(node.id)) : input.nodes;
  const edges = windowed ? input.edges.filter((edge) => inVisualWindow(edge.id)) : input.edges;
  /** 端点名称从全量结果集解析：节点行可能被窗口过滤掉，边行仍要能看懂 */
  const nameOf = new Map(input.nodes.map((node) => [node.id, node.name]));

  const rows: unknown[][] = [];
  rows.push(['节点']);
  rows.push(['id', '名称', '类型', '阶段', '等级', '状态', '规模', '单位', '关联数', '盈余', '规模档']);
  for (const node of nodes) {
    rows.push([
      node.id,
      node.name,
      node.kind,
      node.stage,
      node.level ?? '',
      node.status ?? '',
      node.scale ?? '',
      node.unit ?? '',
      node.counts?.total ?? '',
      surplusLabel(visual?.nodeSurplus[node.id]),
      visual?.nodeSize[node.id] ?? '',
    ]);
  }

  rows.push([]);
  rows.push(['关联']);
  rows.push([
    'id',
    '关联类型',
    '来源id',
    '来源',
    '目标id',
    '目标',
    '流量',
    '单位',
    '强度',
    '盈余',
    '边上标注',
    '起始',
    '结束',
    '备注',
  ]);
  for (const edge of edges) {
    rows.push([
      edge.id,
      edge.linkType,
      edge.source.id,
      nameOf.get(edge.source.id) ?? '',
      edge.target.id,
      nameOf.get(edge.target.id) ?? '',
      edge.flow ?? '',
      edge.unit ?? '',
      edge.intensity ?? '',
      surplusLabel(visual?.edgeSurplus[edge.id]),
      visual?.edgeLabel[edge.id] ?? '',
      edge.time?.start ?? '',
      edge.time?.end ?? '',
      edge.note ?? '',
    ]);
  }

  const metricRows: unknown[][] = [];
  for (const entry of input.metrics?.series ?? []) {
    const def = input.metricDefs?.find((candidate) => candidate.id === entry.metricId);
    for (const sample of entry.samples ?? []) {
      const anchor = anchorOf(sample.t, sample.timeOrder);
      if (windowed && anchor !== undefined && !inWindow(anchor, anchor, windowInput)) continue;
      metricRows.push([
        entry.entity?.id ?? '',
        def?.label ?? entry.metricId,
        entry.metricId,
        sample.t,
        anchor ?? '',
        Array.isArray(sample.value) ? sample.value.join(' - ') : sample.value,
        def?.unit ?? '',
        sample.note ?? '',
      ]);
    }
  }
  if (metricRows.length > 0) {
    rows.push([]);
    rows.push(['指标']);
    rows.push(['实体id', '指标', '指标id', '时间', '时间锚点', '值', '单位', '备注']);
    for (const row of metricRows) rows.push(row);
  }

  return `\uFEFF${toCsv(rows)}`;
};

/** 触发浏览器下载（无 document / URL 能力时静默跳过，方便离线与测试环境） */
export const downloadCsv = (filename: string, csv: string): void => {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const exportWindowCsv = (input: EconomyCsvInput, filename = 'economy-window.csv'): void =>
  downloadCsv(filename, buildWindowCsv(input));

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

export const SandboxOverlay = ({
  complexity,
  layers,
  layerState,
  onLayerChange,
  visual,
  counts,
  timeline,
  window: timeWindow,
  onWindowChange,
  onResetWindow,
  onExportWindow,
  onApplySurplus,
  children,
}: SandboxOverlayProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setShown(true);
      return;
    }
    const timer = setTimeout(() => setShown(true), 16);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <div
      data-testid="economy-sandbox"
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-start gap-3 px-0.5">
        <div className="min-w-0 flex-1 rounded-2xl border border-border/50 bg-card/40 px-4 py-3.5 shadow-sm backdrop-blur-sm">
          <LayerRail
            layers={layers}
            value={layerState}
            complexity={complexity}
            onChange={onLayerChange}
          />
          {visual.unanchored.size > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              时间未锚定 {visual.unanchored.size} 项：排在同段末尾并标注，不猜时间
            </p>
          )}
        </div>
        <StatsPanel
          stats={visual.stats}
          counts={counts}
          timeline={timeline}
          multiUnit={visual.multiUnit}
          onApplySurplus={onApplySurplus}
          onExportWindow={onExportWindow}
        />
      </div>

      <div className="relative min-h-0 flex-1">{children}</div>

      <div
        data-testid="economy-timebrush-slot"
        className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <TimeBrush
          timeline={timeline}
          window={timeWindow}
          playing={playing}
          onChange={onWindowChange}
          onTogglePlay={() => setPlaying((value) => !value)}
          onReset={onResetWindow}
        />
      </div>
    </div>
  );
};

export default SandboxOverlay;
