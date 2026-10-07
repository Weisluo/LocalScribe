/**
 * 时间轴派生与播放（Phase 5 P5-T13；economy_ui_design §4.6.3、§11.3）
 *
 * 口径：
 * - `useTimeline(timeline, window)` 只做**纯计算**：把 `EconomyTimeline` 派生成刻度、时代带、周期带、
 *   事件标记与窗口百分比，不写任何数据、不发请求；
 * - 四类时间源叠加（§4.6.3）：实体存在期与 `WorldLink.time` 由节点 / 边自己携带（时间刷只看它们是否落在
 *   窗口内），`EconomyMetricSample.t` 影响「此段无记录」判定，`EconomyCyclePhase` 与
 *   `economy.era_context` 的时代带 / 事件标记来自 `timeline.cycles` 与 `timeline.markers`；
 * - **无锚点不画刻度**：解析不出锚点（`anchored = false`）时 `ticks = []`，由 `TimeBrush` 提示「时间未锚定」，
 *   绝不把「约三百年前」这类自由文本摆在 50% 冒充中段；
 * - 无锚点的周期 / 标记不参与绘制，只计入 `unanchored`；
 * - `window` 百分比只在 `anchored` 时可计算；窗口两端可以不存在（= 全时段）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { EconomyTimeWindow, EconomyTimeline } from '../types';
import { anchorOf, inWindow, type TimeWindowInput } from '../graph/guards';

/** 拖动节流间隔（§11.3：时间刷拖动 16ms 节流） */
export const DRAG_THROTTLE_MS = 16;
/** 播放节拍与每拍前进比例（窗口匀速前进） */
export const PLAYBACK_INTERVAL_MS = 400;
export const PLAYBACK_STEP_RATIO = 0.05;

export interface TimelineScale {
  start: number;
  end: number;
}

export interface TimelineTick {
  anchor: number;
  label: string;
  percent: number;
}

export interface TimelineBandPhase {
  id: string;
  label: string;
  left: number;
  width: number;
}

export interface TimelineBand {
  id: string;
  label: string;
  kind: 'era' | 'cycle';
  left: number;
  width: number;
  start?: number;
  end?: number;
  phases: TimelineBandPhase[];
}

export interface TimelineEventMark {
  id: string;
  label: string;
  source: string;
  anchor: number;
  percent: number;
}

export interface TimelineWindowPercent {
  left: number;
  width: number;
  startAnchor?: number;
  endAnchor?: number;
}

export interface TimelineView {
  /** 有可解析锚点才是 true；false 时 ticks 为空、不画刻度 */
  anchored: boolean;
  scale: TimelineScale | null;
  ticks: TimelineTick[];
  eras: TimelineBand[];
  cycles: TimelineBand[];
  events: TimelineEventMark[];
  window: TimelineWindowPercent;
  /** 窗口不是全时段、且窗口内没有任何可锚定记录 */
  emptyWindow: boolean;
  /** 无锚点（解析不出时间）的周期 / 标记 / 采样数量 */
  unanchored: number;
  /** 窗口内的可锚定记录数（时代带 + 周期带 + 事件） */
  recordsInWindow: number;
  label: { start: string; end: string };
  /** 时间轴边界锚点（双击吸附用） */
  boundaries: number[];
}

export const formatAnchor = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
};

export const percentIn = (scale: TimelineScale | null, anchor?: number): number | undefined => {
  if (!scale || anchor === undefined) return undefined;
  const span = scale.end - scale.start;
  if (span <= 0) return 50;
  return Math.min(100, Math.max(0, ((anchor - scale.start) / span) * 100));
};

/** 区间 -> 百分比；端点缺失时向可见范围延伸（开区间，与 chronicleSupport.spanPercent 同口径） */
const bandPercent = (
  scale: TimelineScale | null,
  start?: number,
  end?: number
): { left: number; width: number } => {
  const left = percentIn(scale, start) ?? 0;
  const right = percentIn(scale, end) ?? 100;
  const safeRight = right <= left ? Math.min(100, left + 2) : right;
  return { left, width: Math.max(1, safeRight - left) };
};

/** 刻度步长取整（1 / 2 / 2.5 / 5 × 10^n），避免出现 310.83 这类刻度 */
const niceStep = (span: number, target: number): number => {
  const raw = span / Math.max(1, target);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10].map((multiple) => multiple * power);
  return candidates.find((candidate) => candidate >= raw) ?? 10 * power;
};

const buildTicks = (scale: TimelineScale): TimelineTick[] => {
  const span = scale.end - scale.start;
  if (span <= 0) return [];
  let step = niceStep(span, 6);
  while (span / step > 12) step *= 2;
  const ticks: TimelineTick[] = [];
  const first = Math.ceil(scale.start / step) * step;
  for (let value = first; value <= scale.end + step / 1000; value += step) {
    ticks.push({
      anchor: value,
      label: formatAnchor(value),
      percent: percentIn(scale, value) ?? 0,
    });
    if (ticks.length > 24) break;
  }
  return ticks;
};

/**
 * 播放推进：窗口匀速前进，走到轴末端后回到起点循环（不产生负宽度窗口）。
 * 纯函数，供播放定时器与验收直接断言。
 */
export const advanceWindow = (
  scale: TimelineScale,
  window: EconomyTimeWindow,
  ratio = PLAYBACK_STEP_RATIO
): EconomyTimeWindow => {
  const span = scale.end - scale.start;
  if (span <= 0) return { start: formatAnchor(scale.start), end: formatAnchor(scale.end) };
  const step = Math.max(span * ratio, span / 1000);
  const start = anchorOf(window.start) ?? scale.start;
  const end = anchorOf(window.end) ?? scale.end;
  const width = Math.max(Math.min(end - start, span), step);

  let nextStart = start + step;
  let nextEnd = nextStart + width;
  if (nextEnd > scale.end) {
    nextStart = scale.start;
    nextEnd = scale.start + width;
  }
  return { start: formatAnchor(nextStart), end: formatAnchor(Math.min(nextEnd, scale.end)) };
};

/** 拖动节流：16ms 内只保留最后一次；`flush` 在 pointerup 时补齐，`cancel` 在卸载时清理 */
export const throttleWindowChange = (
  onChange: (next: EconomyTimeWindow) => void,
  intervalMs = DRAG_THROTTLE_MS
): { push: (next: EconomyTimeWindow) => void; flush: () => void; cancel: () => void } => {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: EconomyTimeWindow | null = null;

  const fire = () => {
    last = Date.now();
    timer = null;
    const next = pending;
    pending = null;
    if (next) onChange(next);
  };

  return {
    push(next) {
      pending = next;
      const now = Date.now();
      const elapsed = now - last;
      if (elapsed >= intervalMs) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        fire();
        return;
      }
      if (!timer) timer = setTimeout(fire, intervalMs - elapsed);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      fire();
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
};

/** 系统是否偏好减少动效（无 matchMedia 时视为不限制） */
export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return reduced;
};

/**
 * 播放定时器：窗口按 `advanceWindow` 匀速前进。
 * `prefers-reduced-motion` 下**不自动播放**（返回的 ref 由 TimeBrush 用来禁用播放按钮）。
 */
export const useTimelinePlayback = (options: {
  playing: boolean;
  reducedMotion: boolean;
  scale: TimelineScale | null;
  window: EconomyTimeWindow;
  onChange: (next: EconomyTimeWindow) => void;
}): void => {
  const { playing, reducedMotion, scale } = options;
  const onChangeRef = useRef(options.onChange);
  // 当前窗口用 ref 传递，避免每帧重建定时器
  const startRef = useRef(options.window.start);
  const endRef = useRef(options.window.end);
  startRef.current = options.window.start;
  endRef.current = options.window.end;

  useEffect(() => {
    onChangeRef.current = options.onChange;
  }, [options.onChange]);

  useEffect(() => {
    if (!playing || reducedMotion || !scale || scale.end <= scale.start) return;
    const timer = setInterval(() => {
      onChangeRef.current(advanceWindow(scale, { start: startRef.current, end: endRef.current }));
    }, PLAYBACK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, reducedMotion, scale]);
};

/**
 * `useTimeline(timeline, window)`：纯计算的派生视图。
 * 无窗口（两端都缺省）时窗口为 0-100% 全时段。
 */
export const useTimeline = (
  timeline: EconomyTimeline | null,
  window: EconomyTimeWindow
): TimelineView =>
  useMemo(() => {
    const windowInput: TimeWindowInput = { start: window.start, end: window.end };
    const rangeStart = anchorOf(timeline?.range?.start);
    const rangeEnd = anchorOf(timeline?.range?.end);

    const cycleAnchors: number[] = [];
    for (const cycle of timeline?.cycles ?? []) {
      const start = anchorOf(cycle.start);
      const end = anchorOf(cycle.end);
      if (start !== undefined) cycleAnchors.push(start);
      if (end !== undefined) cycleAnchors.push(end);
      for (const phase of cycle.phases ?? []) {
        const phaseStart = anchorOf(phase.start);
        const phaseEnd = anchorOf(phase.end);
        if (phaseStart !== undefined) cycleAnchors.push(phaseStart);
        if (phaseEnd !== undefined) cycleAnchors.push(phaseEnd);
      }
    }

    const markerAnchors: number[] = [];
    for (const marker of timeline?.markers ?? []) {
      const at = anchorOf(marker.at, marker.order);
      const start = anchorOf(marker.start ?? marker.at, marker.order);
      const end = anchorOf(marker.end ?? marker.at, marker.order);
      if (at !== undefined) markerAnchors.push(at);
      if (start !== undefined) markerAnchors.push(start);
      if (end !== undefined) markerAnchors.push(end);
    }

    let scale: TimelineScale | null = null;
    if (rangeStart !== undefined && rangeEnd !== undefined && rangeEnd > rangeStart) {
      scale = { start: rangeStart, end: rangeEnd };
    } else {
      const all = [...cycleAnchors, ...markerAnchors];
      if (all.length >= 2) {
        scale = { start: Math.min(...all), end: Math.max(...all) };
      } else if (all.length === 1) {
        scale = { start: all[0] - 1, end: all[0] + 1 };
      }
    }

    const anchored = scale !== null;
    const ticks = scale ? buildTicks(scale) : [];

    const unanchoredRefs: number[] = [];
    const eras: TimelineBand[] = [];
    const events: TimelineEventMark[] = [];
    /** 双击吸附边界：时代 / 周期 / 相位的起止锚点 */
    const boundaries: number[] = [];
    for (const marker of timeline?.markers ?? []) {
      const hasSpan = Boolean(marker.start || marker.end);
      const at = anchorOf(marker.at, marker.order);
      if (hasSpan) {
        const start = anchorOf(marker.start ?? marker.at, marker.order);
        const end = anchorOf(marker.end ?? marker.at, marker.order);
        if (start === undefined && end === undefined) {
          unanchoredRefs.push(1);
          continue;
        }
        if (start !== undefined) boundaries.push(start);
        if (end !== undefined) boundaries.push(end);
        const box = bandPercent(scale, start, end);
        eras.push({
          id: `${marker.ref?.module ?? 'ref'}:${marker.ref?.id ?? marker.label}`,
          label: marker.label,
          kind: 'era',
          left: box.left,
          width: box.width,
          start,
          end,
          phases: [],
        });
        continue;
      }
      if (at === undefined) {
        unanchoredRefs.push(1);
        continue;
      }
      events.push({
        id: `${marker.ref?.module ?? 'ref'}:${marker.ref?.id ?? marker.label}`,
        label: marker.label,
        source: marker.source,
        anchor: at,
        percent: percentIn(scale, at) ?? 0,
      });
    }

    const cycles: TimelineBand[] = [];
    for (const cycle of timeline?.cycles ?? []) {
      const start = anchorOf(cycle.start);
      const end = anchorOf(cycle.end);
      if (start === undefined && end === undefined) {
        unanchoredRefs.push(1);
        continue;
      }
      if (start !== undefined) boundaries.push(start);
      if (end !== undefined) boundaries.push(end);
      const box = bandPercent(scale, start, end);
      const phases: TimelineBandPhase[] = [];
      for (const [index, phase] of (cycle.phases ?? []).entries()) {
        const phaseStart = anchorOf(phase.start);
        const phaseEnd = anchorOf(phase.end);
        if (phaseStart === undefined && phaseEnd === undefined) {
          unanchoredRefs.push(1);
          continue;
        }
        if (phaseStart !== undefined) boundaries.push(phaseStart);
        if (phaseEnd !== undefined) boundaries.push(phaseEnd);
        const phaseBox = bandPercent(scale, phaseStart, phaseEnd);
        phases.push({
          id: `${cycle.cycleId}:${phase.id ?? index}`,
          label: phase.label,
          left: phaseBox.left,
          width: phaseBox.width,
        });
      }
      cycles.push({
        id: cycle.cycleId,
        label: cycle.label,
        kind: 'cycle',
        left: box.left,
        width: box.width,
        start,
        end,
        phases,
      });
    }

    const windowStart = anchorOf(window.start);
    const windowEnd = anchorOf(window.end);
    const leftPercent = windowStart !== undefined ? (percentIn(scale, windowStart) ?? 0) : 0;
    const rightPercent = windowEnd !== undefined ? (percentIn(scale, windowEnd) ?? 100) : 100;
    const left = Math.min(leftPercent, rightPercent);
    const right = Math.max(leftPercent, rightPercent);

    let recordsInWindow = 0;
    for (const band of [...eras, ...cycles]) {
      if (inWindow(band.start, band.end, windowInput)) recordsInWindow += 1;
    }
    for (const event of events) {
      if (inWindow(event.anchor, event.anchor, windowInput)) recordsInWindow += 1;
    }

    const fullWindow = window.start === undefined && window.end === undefined;

    return {
      anchored,
      scale,
      ticks,
      eras,
      cycles,
      events,
      window: {
        left,
        width: Math.max(1, right - left),
        startAnchor: windowStart,
        endAnchor: windowEnd,
      },
      emptyWindow: !fullWindow && recordsInWindow === 0,
      unanchored: unanchoredRefs.length,
      recordsInWindow,
      label: {
        start: timeline?.range?.start?.trim() || (scale ? formatAnchor(scale.start) : ''),
        end: timeline?.range?.end?.trim() || (scale ? formatAnchor(scale.end) : ''),
      },
      boundaries: [...new Set(boundaries)].sort((a, b) => a - b),
    };
  }, [timeline, window.start, window.end]);
