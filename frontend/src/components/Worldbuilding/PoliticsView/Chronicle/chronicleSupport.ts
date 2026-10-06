/**
 * 沿革视图纯函数与刻度（Phase 4 P4-T10；politics_ui_design §4.5/§11.1）
 *
 * 时间刻度只在端点可解析时绘制：chart 用 chronicleRange 归一化到百分比，
 * 自定义写法（如「约三百年前」）一律当「未填写时间」，不伪造刻度（§4.5.2）。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import type { ChronicleAnchorView, ChronicleTreatyBand } from '../hooks';
import type { LevelDef, StatusDef } from '../../shared/moduleConfig';
import type { PoliticsTimeSpan, TreatyStatus } from '../types';

/** 空值文案：沿革里「没有时间」与「没有等级 / 状态」都要给文字，不给占位色块 */
export const NO_TIME_LABEL = '未填写时间';
export const UNSET_LABEL = '未标注';

export const levelLabelOf = (levels: LevelDef[] | undefined, id?: string | null): string => {
  if (!id) return UNSET_LABEL;
  return levels?.find((def) => def.id === id)?.label ?? id;
};

export const statusLabelOf = (
  statuses: StatusDef[] | undefined,
  id?: string | null
): string => {
  if (!id) return UNSET_LABEL;
  return statuses?.find((def) => def.id === id)?.label ?? id;
};

/** 可比较的时间窗口（毫秒） */
export interface TimeScale {
  start: number;
  end: number;
}

export interface AnchorPlacement {
  anchor: ChronicleAnchorView;
  percent: number;
  /** 与前一锚点过近时收起为「+N」，避免标签互相压字 */
  hidden: boolean;
}

export const buildScale = (range?: { start?: string; end?: string }): TimeScale | null => {
  const start = range?.start ? Date.parse(range.start) : Number.NaN;
  const end = range?.end ? Date.parse(range.end) : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
};

export const percentOf = (scale: TimeScale | null, value?: string): number | undefined => {
  if (!scale || !value) return undefined;
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return undefined;
  const span = scale.end - scale.start;
  if (span <= 0) return 50;
  return Math.min(100, Math.max(0, ((stamp - scale.start) / span) * 100));
};

/** 区间 -> 百分比定位；端点缺失时向可见范围延伸（开区间） */
export const spanPercent = (
  scale: TimeScale | null,
  start?: string,
  end?: string
): { left: number; width: number } => {
  if (!scale) return { left: 0, width: 100 };
  const left = percentOf(scale, start) ?? 0;
  const right = percentOf(scale, end) ?? 100;
  const safeRight = right <= left ? Math.min(100, left + 2) : right;
  return { left, width: Math.max(1, safeRight - left) };
};

export const hasEndpoints = (start?: string, end?: string): boolean => !!start || !!end;

/**
 * 泳道高度随 level.rank（§4.5.1）；组织泳道固定细高，便于和政权泳道区分。
 * rank 无定义时为最小高度，不因为空等级体系把泳道压成 0。
 */
export const laneHeightOf = (weight: number, isOrganization: boolean): number => {
  if (isOrganization) return 30;
  const clamped = Math.min(Math.max(weight, 0), 10);
  return 48 + clamped * 4;
};

/** 锚点图标：一律 Lucide 名，历史侧按契约 §4.2（flag / map-pin / users） */
export const anchorIconOf = (anchor: ChronicleAnchorView): string => {
  if (anchor.source === 'chronicle') return 'milestone';
  if (anchor.linkType === 'history.occurs_at') return 'map-pin';
  if (anchor.linkType === 'history.involves') return 'users';
  return 'flag';
};

/** 锚点色调：历史侧 amber / blue，政治侧 slate（§4.2 + §6 领域色） */
export const anchorToneOf = (anchor: ChronicleAnchorView): string => {
  if (anchor.source === 'chronicle') return 'slate';
  if (anchor.linkType === 'history.occurs_at') return 'blue';
  return 'amber';
};

/** 来源文字标签：颜色不单独承载语义，chip 上始终带「历史 / 沿革」字样 */
export const anchorSourceLabel = (anchor: ChronicleAnchorView): string =>
  anchor.source === 'history' ? '历史' : '沿革';

export const anchorRef = (anchor: ChronicleAnchorView): EntityRef | undefined => anchor.ref;

/** 锚点时间文案 */
export const anchorTimeLabel = (time: PoliticsTimeSpan): string => {
  const start = time.start?.trim();
  const end = time.end?.trim();
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `至 ${end}`;
  return time.display?.trim() || '未填写时间';
};

/**
 * 锚点沿时间轴排布（minGap 为百分比）。
 *
 * 「不伪造刻度」的落地：没有可解析时间（没填时间 / 自定义写法如「约三百年前」）的锚点
 * 不放进时间轴，percent 返回 undefined，由调用方放进「无时间」清单；绝不把它摆在 50% 的位置
 * 冒充中段事件。hiddenCount 只统计「有时间但挨得太近」的锚点，未定位数量另给 unplaced。
 */
export const placeAnchors = (
  anchors: ChronicleAnchorView[],
  scale: TimeScale | null,
  minGap = 7
): { placed: AnchorPlacement[]; hiddenCount: number; unplaced: ChronicleAnchorView[] } => {
  const unplaced = anchors.filter(
    (anchor) => percentOf(scale, anchor.time.start ?? anchor.time.end) === undefined
  );
  if (!scale) {
    return { placed: [], hiddenCount: 0, unplaced };
  }
  const ordered = anchors
    .map((anchor) => ({ anchor, percent: percentOf(scale, anchor.time.start ?? anchor.time.end) }))
    .filter((item): item is { anchor: ChronicleAnchorView; percent: number } => item.percent !== undefined)
    .map((item) => ({ ...item, hidden: false }))
    .sort((a, b) => a.percent - b.percent);
  let last = Number.NEGATIVE_INFINITY;
  let hiddenCount = 0;
  for (const item of ordered) {
    if (item.percent - last < minGap) {
      item.hidden = true;
      hiddenCount += 1;
    } else {
      last = item.percent;
    }
  }
  return { placed: ordered, hiddenCount, unplaced };
};

/** 泳道时间区间与筛选窗口是否有交集；无端点视为「未填写时间」，不参与过滤 */
export const laneOverlapsRange = (
  lane: { start?: string; end?: string },
  rangeStart: string,
  rangeEnd: string
): boolean => {
  const from = rangeStart ? Date.parse(rangeStart) : Number.NaN;
  const to = rangeEnd ? Date.parse(rangeEnd) : Number.NaN;
  if (!Number.isFinite(from) && !Number.isFinite(to)) return true;
  const start = lane.start ? Date.parse(lane.start) : Number.NaN;
  const end = lane.end ? Date.parse(lane.end) : Number.NaN;
  if (!Number.isFinite(start) && !Number.isFinite(end)) return true;
  const laneStart = Number.isFinite(start) ? start : end;
  const laneEnd = Number.isFinite(end) ? end : start;
  if (Number.isFinite(from) && laneEnd < from) return false;
  if (Number.isFinite(to) && laneStart > to) return false;
  return true;
};

/** 条约状态色只做辅助，文字标签同时出现（§4.6.5） */
export const treatyStatusTextClass = (status: TreatyStatus): string => {
  if (status === 'active') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'suspended') return 'text-destructive';
  return 'text-muted-foreground';
};

/** 缎带底色：生效中绿色、失效灰、违约红、未标注中性 */
export const treatyBandToneClass = (status: TreatyStatus): string => {
  if (status === 'active') return 'bg-emerald-500/30 border-emerald-600/60 dark:bg-emerald-400/25';
  if (status === 'suspended') return 'bg-red-500/30 border-red-600/60 dark:bg-red-400/25';
  if (status === 'expired') return 'bg-slate-500/20 border-slate-500/50 dark:bg-slate-400/20';
  return 'bg-muted/40 border-border/60';
};

/** 核心人物任职带（§4.5.4，可选叠加开关） */
export interface TenureOverlayBand {
  figureId: string;
  figureName: string;
  office: string;
  isPrimary: boolean;
  start?: string;
  end?: string;
}

/** 继承标记：任职交接处的短箭头（politics.succeeds，沙盘档，§4.5.4） */
export interface SuccessionMark {
  percent: number;
  label: string;
}

/** 时间范围文案（左列展示） */
export const bandRangeLabel = (band: ChronicleTreatyBand): string => {
  const start = band.start?.trim() || '起始未知';
  const end = band.end?.trim() || '长期有效';
  return `${start} – ${end}`;
};
