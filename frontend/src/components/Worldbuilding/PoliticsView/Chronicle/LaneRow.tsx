/**
 * 沿革泳道行（Phase 4 P4-T10；politics_ui_design §4.5.1/§4.5.2/§4.5.4）
 *
 * 泳道高度随 lane.weight（= LevelDef.rank）；terminal 泳道降饱和但保留可读性。
 * 泳道区间由 meta.time 决定；锚点双来源合并（政治侧沿革 + 历史入链），
 * 历史锚点带 flag 类图标与「历史」文字标签，点击跳历史事件详情。
 */

import { ArrowRight, ChevronDown, ChevronRight, CircleDot, Flag } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { lucideIcon } from '../../shared/lucideIcon';
import type { ChronicleLane, UsePoliticsResult } from '../hooks';
import { TERMINAL_NODE_CLASS, chipClass, toneSurfaceClass, toneTextClass } from '../tone';
import {
  NO_TIME_LABEL,
  anchorIconOf,
  anchorSourceLabel,
  anchorTimeLabel,
  anchorToneOf,
  laneHeightOf,
  levelLabelOf,
  placeAnchors,
  spanPercent,
  statusLabelOf,
  type SuccessionMark,
  type TenureOverlayBand,
  type TimeScale,
} from './chronicleSupport';

export interface LaneRowProps {
  politics: UsePoliticsResult;
  lane: ChronicleLane;
  scale: TimeScale | null;
  focused: boolean;
  expanded: boolean;
  historyOverlay: boolean;
  /** 核心人物任职带叠加（§4.5.4） */
  tenureBands: TenureOverlayBand[];
  /** 继承箭头（沙盘档） */
  successions: SuccessionMark[];
  onToggleAnchors: () => void;
  onOpen: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
}

export const LaneRow = ({
  politics,
  lane,
  scale,
  focused,
  expanded,
  historyOverlay,
  tenureBands,
  successions,
  onToggleAnchors,
  onOpen,
  onNavigateToEntity,
}: LaneRowProps) => {
  const anchors = historyOverlay
    ? lane.anchors
    : lane.anchors.filter((anchor) => anchor.source === 'chronicle');
  const { placed, hiddenCount, unplaced } = placeAnchors(anchors, scale);
  const overlayBands = scale ? tenureBands.slice(0, 4) : [];
  const height =
    laneHeightOf(lane.weight, lane.isOrganization) + overlayBands.length * 5 + (overlayBands.length > 0 ? 6 : 0);
  const segment = spanPercent(scale, lane.start, lane.end);
  const terminal = lane.terminal;
  const levelLabel = levelLabelOf(politics.levels, lane.entity.meta.level);
  const statusLabel = statusLabelOf(politics.statuses, lane.entity.meta.status);
  const rangeLabel =
    lane.start || lane.end
      ? `${lane.start ?? '起始未知'} – ${lane.end ?? '长期有效'}`
      : NO_TIME_LABEL;

  return (
    <>
      <div
        data-testid="chronicle-lane"
        data-entity-id={lane.entity.id}
        className={`flex items-stretch border-b border-border/20 ${
          focused ? 'bg-primary/5' : 'hover:bg-accent/10'
        }`}
      >
        <div className="flex w-52 shrink-0 items-center gap-1.5 pr-2">
          <button
            type="button"
            onClick={onOpen}
            title={`${lane.entity.name}（点击打开详情）`}
            className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground hover:text-primary"
          >
            {lane.entity.name}
          </button>
          <span className={`shrink-0 text-[9px] ${toneTextClass(lane.isOrganization ? 'red' : 'gold')}`}>
            {lane.isOrganization ? '组织' : levelLabel}
          </span>
          <span className="shrink-0 truncate text-[9px] text-muted-foreground">{statusLabel}</span>
          {lane.terminal && (
            <span className="shrink-0 rounded-full border border-border/60 px-1 text-[9px] text-muted-foreground">
              已终结
            </span>
          )}
          <button
            type="button"
            onClick={onToggleAnchors}
            aria-expanded={expanded}
            aria-label={`${lane.entity.name} 的沿革锚点（${anchors.length}）`}
            className="flex shrink-0 items-center gap-0.5 rounded px-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {anchors.length}
          </button>
          {tenureBands.length > 0 && (
            <span
              className="shrink-0 text-[9px] text-slate-600 dark:text-slate-300"
              title="已叠加核心人物任职带"
            >
              任职 {tenureBands.length}
            </span>
          )}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* 基准线 */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-border/40" aria-hidden="true" />
          {lane.isOrganization ? (
            <div
              className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-red-600/70 dark:bg-red-300/70 ${
                terminal ? TERMINAL_NODE_CLASS : ''
              }`}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              title={`存续期 ${rangeLabel}`}
            />
          ) : (
            <div
              className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-sm border ${
                terminal ? `${TERMINAL_NODE_CLASS} border-border/60 bg-muted/50` : 'border-amber-600/50 bg-amber-500/25 dark:bg-amber-300/20'
              }`}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              title={`存续期 ${rangeLabel}（${statusLabel}）`}
            >
              {segment.width > 12 && (
                <span className="block truncate px-1 text-[9px] leading-3 text-foreground">
                  {statusLabel}
                </span>
              )}
            </div>
          )}

          {scale &&
            placed
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = lucideIcon(anchorIconOf(item.anchor)) ?? CircleDot;
                const clickable = !!item.anchor.ref;
                return (
                  <button
                    key={item.anchor.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => item.anchor.ref && onNavigateToEntity(item.anchor.ref)}
                    aria-label={`${anchorSourceLabel(item.anchor)}：${item.anchor.label}（${anchorTimeLabel(item.anchor.time)}）`}
                    title={`${anchorSourceLabel(item.anchor)}：${item.anchor.label} · ${anchorTimeLabel(item.anchor.time)}${
                      clickable ? '（点击跳转）' : ''
                    }`}
                    style={{ left: `${item.percent}%` }}
                    className={`absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card ${toneTextClass(
                      anchorToneOf(item.anchor)
                    )} ${clickable ? 'hover:scale-110' : 'cursor-default'}`}
                  >
                    <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                );
              })}

          {/* 核心人物任职带（可选叠加，§4.5.4）：细带排在存续条下方 */}
          {overlayBands.map((band, index) => {
            const seg = spanPercent(scale, band.start, band.end);
            return (
              <div
                key={`${band.figureId}:${index}`}
                title={`${band.figureName} · ${band.office || '任职'} · ${band.start ?? '未知'} – ${
                  band.end ?? '在任'
                }`}
                className={`absolute h-[3px] rounded-full ${
                  band.isPrimary
                    ? 'bg-slate-600/70 dark:bg-slate-300/70'
                    : 'bg-slate-400/60 dark:bg-slate-500/60'
                }`}
                style={{
                  left: `${seg.left}%`,
                  width: `${seg.width}%`,
                  top: `calc(50% + ${8 + index * 5}px)`,
                }}
              />
            );
          })}

          {/* 继承边（politics.succeeds）：任职交接处画短箭头，沙盘档才画 */}
          {successions.map((mark) => (
            <span
              key={`${mark.label}:${mark.percent}`}
              role="img"
              aria-label={mark.label}
              title={mark.label}
              className="absolute -translate-x-1/2 text-red-600 dark:text-red-300"
              style={{
                left: `${mark.percent}%`,
                top: `calc(50% + ${8 + overlayBands.length * 5}px)`,
              }}
            >
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </span>
          ))}

          {!scale && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {anchors.length > 0
                ? `${NO_TIME_LABEL}：${anchors.length} 个锚点都不可解析，未画在轴上（展开看清单）`
                : NO_TIME_LABEL}
            </span>
          )}
          {/* 没有可解析时间的锚点不摆到 50% 冒充中段事件：单独成列说明（§4.5.2） */}
          {scale && unplaced.length > 0 && (
            <span
              className="absolute right-1 top-1 rounded-full border border-dashed border-border/60 px-1 text-[9px] text-muted-foreground"
              data-testid="chronicle-unplaced-anchors"
              title={unplaced.map((anchor) => `${anchor.label}（${anchorTimeLabel(anchor.time)}）`).join('、')}
            >
              {NO_TIME_LABEL} {unplaced.length}
            </span>
          )}
          {scale && hiddenCount > 0 && (
            <span className="absolute right-1 top-1 text-[9px] text-muted-foreground">
              另有 {hiddenCount} 个锚点已叠放
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center gap-1 py-1 pl-52 pr-2">
          {anchors.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">
              还没有沿革锚点：可在政权详情的沿革段添加，或从历史模块建立关联。
            </span>
          ) : (
            anchors.map((anchor) => {
              const Icon = lucideIcon(anchorIconOf(anchor));
              const clickable = !!anchor.ref;
              return (
                <button
                  key={`${lane.entity.id}:${anchor.id}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => anchor.ref && onNavigateToEntity(anchor.ref)}
                  title={`${anchor.label} · ${anchorTimeLabel(anchor.time)}${
                    clickable ? '（点击跳转）' : ''
                  }`}
                  className={`${chipClass} ${toneTextClass(anchorToneOf(anchor))} ${toneSurfaceClass(
                    anchorToneOf(anchor)
                  )}`}
                >
                  {Icon ? (
                    <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                  ) : (
                    <CircleDot className="h-2.5 w-2.5" aria-hidden="true" />
                  )}
                  <span className="font-medium">{anchorSourceLabel(anchor)}</span>
                  <span className="max-w-[10rem] truncate">{anchor.label}</span>
                  <span className="opacity-70">{anchorTimeLabel(anchor.time)}</span>
                </button>
              );
            })
          )}
          {lane.anchors.some((anchor) => anchor.source === 'history') &&
            politics.capabilities.historyOverlay && (
              <span className="flex items-center gap-1 text-[9px] text-amber-700 dark:text-amber-300">
                <Flag className="h-2.5 w-2.5" aria-hidden="true" />
                历史事件可点击跳转
              </span>
            )}
        </div>
      )}
    </>
  );
};

export default LaneRow;
