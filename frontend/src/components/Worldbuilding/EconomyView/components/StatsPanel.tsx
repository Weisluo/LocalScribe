/**
 * 统计面板 StatsPanel（Phase 5 P5-T12；economy_ui_design §4.6.4、§4.6.5、§8.4）
 *
 * 口径：
 * - **只统计已填数据，不做推断**：没有记录时显示「—」而不是 0 假象；
 * - 总流量按 `stats.flowRecorded` 判定（窗口内是否真的记录过流量值）：false 显示「—」，
 *   true 时哪怕是 0 也照实显示（如「0 袋」），保留单位与「存在多单位」提示；
 * - 图层关闭不影响统计（仍按全量），面板标注「含已隐藏图层」；
 * - 多单位**不换算**：总流量只作量级参考，同时给出单位列表与「存在多单位」提示；
 * - 点击任一统计项进入对应筛选结果：点「赤字 N」只保留赤字节点（走 `onApplySurplus`），
 *   点实体 / 关联 / 总流量则传 `null` 清除盈余筛选。
 */

import { Download, Sigma } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatNumber } from '../graph/normalize';
import type { EconomySurplus, StatsPanelProps } from '../types';

interface StatRow {
  testid: string;
  label: string;
  value: string;
  title?: string;
  /** 有 onClick 才是可点的筛选项（其余是只读读数） */
  onClick?: () => void;
  onClickLabel?: string;
}

const Row = ({ row }: { row: StatRow }): ReactNode => {
  const body = (
    <>
      <span className="text-muted-foreground">{row.label}</span>
      <span className="tabular-nums text-foreground">{row.value}</span>
    </>
  );
  if (!row.onClick) {
    return (
      <div data-testid={row.testid} className="flex items-baseline justify-between gap-2 text-sm">
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={row.testid}
      title={row.title ?? row.onClickLabel}
      aria-label={`${row.label} ${row.value}`}
      onClick={row.onClick}
      className="flex w-full items-baseline justify-between gap-2 rounded-lg px-1.5 py-0.5 text-left text-sm transition-colors duration-200 hover:bg-accent/5 motion-reduce:transition-none"
    >
      {body}
    </button>
  );
};

export const StatsPanel = ({
  stats,
  counts,
  timeline,
  multiUnit,
  onApplySurplus,
  onExportWindow,
}: StatsPanelProps) => {
  const nodeCount = counts?.nodes ?? stats.entities;
  const linkCount = counts?.edges ?? stats.links;
  const hasData = nodeCount > 0 || linkCount > 0;
  const showMultiUnit = multiUnit || stats.multiUnit;
  const unitText = stats.flowUnits.length > 0 ? stats.flowUnits.join(' / ') : '';
  /** 由 normalize 判定：窗口内是否真的记录过流量值（0 也算记录过）；false 显示「—」而不是 0 */
  const flowRecorded = stats.flowRecorded;
  const unanchoredCount = timeline?.unanchored?.length ?? 0;
  const axisStart = timeline?.range?.start?.trim();
  const axisEnd = timeline?.range?.end?.trim();
  const windowText =
    stats.timeWindow.start || stats.timeWindow.end
      ? `${stats.timeWindow.start ?? '起点'} – ${stats.timeWindow.end ?? '终点'}`
      : '全时段';

  const applySurplus = (state: EconomySurplus | null): void => onApplySurplus(state);

  const rows: StatRow[] = [
    {
      testid: 'economy-stat-entities',
      label: '实体',
      value: hasData ? String(nodeCount) : '—',
      title: '点击清除盈余筛选，回到全部实体',
      onClick: () => applySurplus(null),
    },
    {
      testid: 'economy-stat-links',
      label: '关联',
      value: hasData ? String(linkCount) : '—',
      title: '点击清除盈余筛选，回到全部关联',
      onClick: () => applySurplus(null),
    },
    {
      testid: 'economy-stat-flow',
      label: '总流量',
      value: flowRecorded ? `${formatNumber(stats.totalFlow)}${unitText ? ` ${unitText}` : ''}` : '—',
      title: showMultiUnit ? '多单位不换算：此处只作量级参考' : '点击清除盈余筛选',
      onClick: () => applySurplus(null),
    },
    {
      testid: 'economy-stat-surplus',
      label: '盈余',
      value: hasData ? String(stats.surplus.surplus) : '—',
      title: '只保留盈余节点',
      onClick: () => applySurplus('surplus'),
    },
    {
      testid: 'economy-stat-balanced',
      label: '平衡',
      value: hasData ? String(stats.surplus.balanced) : '—',
      title: '只保留平衡节点',
      onClick: () => applySurplus('balanced'),
    },
    {
      testid: 'economy-stat-deficit',
      label: '赤字',
      value: hasData ? String(stats.surplus.deficit) : '—',
      title: '只保留赤字节点',
      onClick: () => applySurplus('deficit'),
    },
    {
      testid: 'economy-stat-coverage',
      label: '指标覆盖',
      value: hasData ? `${Math.round(stats.metricCoverage * 100)}%` : '—',
    },
    {
      testid: 'economy-stat-window',
      label: '时间窗口',
      value: windowText,
      title: axisStart || axisEnd ? `时间轴 ${axisStart ?? '起点'} – ${axisEnd ?? '终点'}` : '时间轴未锚定',
    },
  ];

  return (
    <div
      data-testid="economy-stats"
      className="min-w-[220px] rounded-2xl border border-border/50 bg-card/40 px-4 py-3.5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <Sigma className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">统计</span>
        {stats.hiddenLayersPresent && (
          <span
            data-testid="economy-stat-hidden-layers"
            className="ml-auto text-[10px] text-muted-foreground"
            title="有图层被关闭，但统计仍按全量计算"
          >
            含已隐藏图层
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-1">
        {rows.map((row) => (
          <Row key={row.testid} row={row} />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {showMultiUnit && (
          <span
            data-testid="economy-stat-multiunit"
            className="rounded-full border border-border/40 px-2.5 py-0.5 text-[10px] text-muted-foreground"
            title="多单位不换算，各单位分别标注"
          >
            存在多单位
          </span>
        )}
        {stats.surplus.unknown > 0 && (
          <span data-testid="economy-stat-unknown" className="text-[10px] text-muted-foreground">
            未知 {stats.surplus.unknown}
          </span>
        )}
        {unanchoredCount > 0 && (
          <span data-testid="economy-stat-unanchored" className="text-[10px] text-muted-foreground">
            时间未锚定 {unanchoredCount}
          </span>
        )}
      </div>

      <button
        type="button"
        data-testid="economy-export-window"
        onClick={onExportWindow}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 motion-reduce:transition-none"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        导出当前窗口 CSV
      </button>
    </div>
  );
};

export default StatsPanel;
