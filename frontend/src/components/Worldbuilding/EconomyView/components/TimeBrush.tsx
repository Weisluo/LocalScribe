/**
 * 时间刷 TimeBrush（Phase 5 P5-T13；economy_ui_design §4.6.1 / §4.6.3 / §4.7.1）
 *
 * 一条世界内时间轴，四类时间源叠加，视觉层级从低到高：
 * 时代底带 < 周期带（含相位） < 事件标记 < 当前刷选窗口。
 *
 * 交互（§4.6.3）：
 * - 两个手柄拖动过滤（16ms 节流）；
 * - 双击时代 / 周期边界吸附（`[` `]` 微调，Shift 反向，即收窄）；
 * - Shift + 在轨道上拖动平移整个窗口；
 * - 空格播放（窗口匀速前进，到轴末端回到起点循环；`prefers-reduced-motion` 下禁用自动播放）；
 * - 窗口内没有任何可锚定记录时提示「此段无记录」，**不显示 0**；
 * - 无锚点（自由文本时间解析不出数字）时**不画刻度**并提示「时间未锚定」，不猜时间。
 *
 * 播放定时器在本组件内部（外壳只翻转 `playing`）；外壳不要再渲染第二个 TimeBrush。
 */

import { MoveHorizontal, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import {
  formatAnchor,
  throttleWindowChange,
  usePrefersReducedMotion,
  useTimeline,
  useTimelinePlayback,
} from '../hooks/useTimeline';
import type { EconomyTimeWindow, TimeBrushProps } from '../types';

interface DragState {
  mode: 'start' | 'end' | 'pan';
  originPercent: number;
  originLeft: number;
  originWidth: number;
}

export const TimeBrush = ({
  timeline,
  window: timeWindow,
  playing,
  onChange,
  onTogglePlay,
  onReset,
}: TimeBrushProps) => {
  const view = useTimeline(timeline, timeWindow);
  const reducedMotion = usePrefersReducedMotion();
  useTimelinePlayback({
    playing,
    reducedMotion,
    scale: view.scale,
    window: timeWindow,
    onChange,
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const throttled = useMemo(
    () => throttleWindowChange((next) => onChangeRef.current(next)),
    []
  );
  useEffect(() => () => throttled.cancel(), [throttled]);

  const percentFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  const anchorFromPercent = (percent: number): number => {
    const scale = view.scale;
    if (!scale) return 0;
    return scale.start + ((scale.end - scale.start) * percent) / 100;
  };

  /** 把手柄移动到某个锚点：另一端保持不动，绝不产生反向窗口 */
  const windowForAnchor = (mode: 'start' | 'end', anchor: number): EconomyTimeWindow => {
    const scale = view.scale;
    if (!scale) return timeWindow;
    const start = view.window.startAnchor ?? scale.start;
    const end = view.window.endAnchor ?? scale.end;
    if (mode === 'start') {
      return { start: formatAnchor(Math.min(anchor, end)), end: formatAnchor(end) };
    }
    return { start: formatAnchor(start), end: formatAnchor(Math.max(anchor, start)) };
  };

  /** 平移：保持窗口宽度，整体不越出时间轴 */
  const panWindow = (percent: number): EconomyTimeWindow => {
    const scale = view.scale;
    if (!scale || !drag) return timeWindow;
    const span = scale.end - scale.start;
    const delta = ((percent - drag.originPercent) / 100) * span;
    const width = Math.max((drag.originWidth / 100) * span, span / 1000);
    const originStart = scale.start + (drag.originLeft / 100) * span;
    let nextStart = originStart + delta;
    if (nextStart < scale.start) nextStart = scale.start;
    if (nextStart + width > scale.end) nextStart = scale.end - width;
    return {
      start: formatAnchor(nextStart),
      end: formatAnchor(Math.min(scale.end, nextStart + width)),
    };
  };

  const beginDrag = (
    mode: DragState['mode'],
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (!view.scale) return;
    event.preventDefault();
    event.stopPropagation();
    rootRef.current?.setPointerCapture?.(event.pointerId);
    setDrag({
      mode,
      originPercent: percentFromClientX(event.clientX),
      originLeft: view.window.left,
      originWidth: view.window.width,
    });
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view.scale) return;
    if (!event.shiftKey) return;
    beginDrag('pan', event);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !view.scale) return;
    const percent = percentFromClientX(event.clientX);
    if (drag.mode === 'pan') {
      throttled.push(panWindow(percent));
      return;
    }
    throttled.push(windowForAnchor(drag.mode, anchorFromPercent(percent)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    throttled.flush();
    setDrag(null);
    rootRef.current?.releasePointerCapture?.(event.pointerId);
  };

  /** 双击轨道：吸附到最近的时代 / 周期边界，移动更近的那个手柄 */
  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const scale = view.scale;
    if (!scale) return;
    const clicked = anchorFromPercent(percentFromClientX(event.clientX));
    const snap =
      view.boundaries.length > 0
        ? view.boundaries.reduce(
            (best, candidate) =>
              Math.abs(candidate - clicked) < Math.abs(best - clicked) ? candidate : best,
            view.boundaries[0]
          )
        : clicked;
    const start = view.window.startAnchor ?? scale.start;
    const end = view.window.endAnchor ?? scale.end;
    const mode = Math.abs(snap - start) <= Math.abs(snap - end) ? 'start' : 'end';
    onChange(windowForAnchor(mode, snap));
  };

  const nudge = (key: '[' | ']', shrink: boolean) => {
    const scale = view.scale;
    if (!scale) return;
    const step = Math.max((scale.end - scale.start) * 0.02, 0.01);
    const start = view.window.startAnchor ?? scale.start;
    const end = view.window.endAnchor ?? scale.end;
    if (key === '[') {
      const delta = shrink ? step : -step;
      const next = Math.min(Math.max(scale.start, start + delta), end);
      onChange({ start: formatAnchor(next), end: formatAnchor(end) });
      return;
    }
    const delta = shrink ? -step : step;
    const next = Math.max(Math.min(scale.end, end + delta), start);
    onChange({ start: formatAnchor(start), end: formatAnchor(next) });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ') {
      event.preventDefault();
      if (!reducedMotion) onTogglePlay();
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      nudge(event.key, event.shiftKey);
      return;
    }
    if (event.key === 'Escape' && drag) setDrag(null);
  };

  /** 两个 role="slider" 手柄的键盘操作：Left / Right 按 2% 步长，Home / End 到时间轴两端 */
  const onHandleKeyDown =
    (mode: 'start' | 'end') => (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const scale = view.scale;
      if (!scale) return;
      const step = Math.max((scale.end - scale.start) * 0.02, 0.01);
      const current =
        (mode === 'start' ? view.window.startAnchor : view.window.endAnchor) ??
        (mode === 'start' ? scale.start : scale.end);
      let next: number;
      if (event.key === 'ArrowLeft') next = current - step;
      else if (event.key === 'ArrowRight') next = current + step;
      else if (event.key === 'Home') next = scale.start;
      else if (event.key === 'End') next = scale.end;
      else return;
      event.preventDefault();
      event.stopPropagation();
      onChange(windowForAnchor(mode, Math.max(scale.start, Math.min(scale.end, next))));
    };

  const startText = timeWindow.start?.trim() || view.label.start || '起点';
  const endText = timeWindow.end?.trim() || view.label.end || '终点';
  const windowText =
    timeWindow.start || timeWindow.end
      ? `${startText} – ${endText}`
      : view.label.start
        ? `全时段 ${view.label.start} – ${view.label.end}`
        : '全时段';

  return (
    <div
      data-testid="economy-timebrush"
      ref={rootRef}
      role="group"
      aria-label="时间刷"
      className="border-t border-border/60 bg-card/50 px-2 py-1.5"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <MoveHorizontal
          className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400"
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium text-foreground">时间刷</span>
        <span className="text-[10px] tabular-nums text-muted-foreground" data-testid="economy-window-label">
          {windowText}
        </span>
        <button
          type="button"
          data-testid="economy-timebrush-play"
          aria-pressed={playing}
          disabled={reducedMotion}
          title={reducedMotion ? '系统偏好减少动效：已停用自动播放' : '播放（空格）'}
          onClick={onTogglePlay}
          className="ml-auto flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent/30 disabled:opacity-50 motion-reduce:transition-none"
        >
          {playing ? (
            <Pause className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Play className="h-3 w-3" aria-hidden="true" />
          )}
          {playing ? '暂停' : '播放'}
        </button>
        <button
          type="button"
          data-testid="economy-timebrush-reset"
          onClick={onReset}
          className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          复位
        </button>
      </div>

      {!timeline ? (
        <p className="mt-1 text-[11px] text-muted-foreground" data-testid="economy-timebrush-empty">
          还没有时间记录：先加一个周期，或给实体写上时间。
        </p>
      ) : !view.anchored ? (
        <p className="mt-1 text-[11px] text-muted-foreground" data-testid="economy-timebrush-unanchored">
          时间未锚定：现有时间写法无法比较，不画刻度。可写成「312 年」这样的前缀数字，或补 timeOrder 锚点。
          {view.unanchored > 0 ? `（未锚定 ${view.unanchored} 项）` : ''}
        </p>
      ) : (
        <>
          <div
            ref={trackRef}
            tabIndex={0}
            role="group"
            aria-label="时间窗口轨道"
            className="relative mt-1 h-12 select-none rounded border border-border/50 bg-background/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
            onPointerDown={onTrackPointerDown}
            onDoubleClick={onDoubleClick}
          >
            {view.eras.map((era) => (
              <div
                key={`era-${era.id}`}
                title={era.label}
                className="pointer-events-none absolute bottom-0 h-2 border-t border-dashed border-cyan-500/50 bg-cyan-400/10"
                style={{ left: `${era.left}%`, width: `${era.width}%` }}
              />
            ))}
            {view.cycles.map((cycle) => (
              <div
                key={`cycle-${cycle.id}`}
                title={cycle.label}
                className="pointer-events-none absolute top-0 h-4 overflow-hidden rounded-sm border border-cyan-600/40 bg-cyan-400/20"
                style={{ left: `${cycle.left}%`, width: `${cycle.width}%` }}
              >
                {cycle.phases.map((phase) => (
                  <span
                    key={phase.id}
                    title={phase.label}
                    className="absolute top-0 h-full border-r border-cyan-700/40 bg-cyan-500/20"
                    style={{ left: `${phase.left}%`, width: `${phase.width}%` }}
                  />
                ))}
                <span className="relative block truncate px-1 text-[9px] leading-4 text-cyan-900 dark:text-cyan-100">
                  {cycle.label}
                </span>
              </div>
            ))}
            {view.events.map((event) => (
              <span
                key={`event-${event.id}`}
                title={`${event.label}（${event.source}）`}
                className="pointer-events-none absolute top-0 h-full w-px bg-green-600/80"
                style={{ left: `${event.percent}%` }}
              />
            ))}

            <div
              className="pointer-events-none absolute bottom-0 top-0 border-x border-cyan-600/60 bg-cyan-400/10"
              style={{ left: `${view.window.left}%`, width: `${view.window.width}%` }}
            />

            <div
              data-testid="economy-window-start"
              role="slider"
              tabIndex={0}
              aria-label="窗口起点"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(view.window.left)}
              aria-valuetext={startText}
              className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm border border-cyan-600/70 bg-cyan-500/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
              style={{ left: `${view.window.left}%` }}
              onPointerDown={(event) => beginDrag('start', event)}
              onKeyDown={onHandleKeyDown('start')}
            />
            <div
              data-testid="economy-window-end"
              role="slider"
              tabIndex={0}
              aria-label="窗口终点"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(view.window.left + view.window.width))}
              aria-valuetext={endText}
              className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm border border-cyan-600/70 bg-cyan-500/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
              style={{ left: `${Math.min(100, view.window.left + view.window.width)}%` }}
              onPointerDown={(event) => beginDrag('end', event)}
              onKeyDown={onHandleKeyDown('end')}
            />
          </div>

          <div className="relative mt-0.5 h-4">
            {view.ticks.map((tick) => (
              <span
                key={`tick-${tick.anchor}`}
                className="absolute -translate-x-1/2 text-[9px] tabular-nums text-muted-foreground"
                style={{ left: `${tick.percent}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              拖动两端过滤节点 / 边 / 指标；双击吸附边界；Shift + 拖动平移；[ ] 微调；空格播放
            </span>
            {view.unanchored > 0 && (
              <span className="text-[10px] text-muted-foreground" data-testid="economy-timebrush-unanchored-items">
                时间未锚定 {view.unanchored} 项：排在同段末尾并标注
              </span>
            )}
          </div>

          {view.emptyWindow && (
            <p className="mt-0.5 text-[11px] text-muted-foreground" data-testid="economy-empty-window">
              此段无记录：窗口内没有任何时代、周期或事件，不显示 0。可放宽窗口或复位到全时段。
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default TimeBrush;
