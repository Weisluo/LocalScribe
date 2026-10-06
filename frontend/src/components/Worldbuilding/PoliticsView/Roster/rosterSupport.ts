/**
 * 名录视图纯函数（Phase 4 P4-T9；politics_ui_design §4.4/§9.2/§11.1）
 *
 * 只放格式化、时间平移与筛选判定等无副作用逻辑；实体聚合结果一律消费 politics.roster*
 * （§11.2：世界级 lists 一次取回、客户端聚合，组件内不再自行聚合）。
 */

import { ROSTER_ROW_HEIGHT } from '../config';
import { refKey } from '../../types';
import type { PoliticsFilterState, UsePoliticsResult } from '../hooks';
import type { LevelDef, StatusDef } from '../../shared/moduleConfig';
import { politicsRefOf, type PoliticsTimeSpan } from '../types';

/** §4.4 行高：政权 56 / 组织 40 / 人物 32 / 条约 36 */
export const rosterRowHeight = (kind: string): number => ROSTER_ROW_HEIGHT[kind] ?? 32;

/** 未填写 / 未标注的统一文案（§9.2：空值给文字，不给占位色块） */
export const NO_TIME_LABEL = '未填写时间';
export const UNSET_LABEL = '未标注';
export const ORPHAN_LABEL = '—';

const MS_PER_DAY = 86_400_000;

/** 可解析端点才展示为日期；自定义写法（如「约三百年前」）原样保留，不伪造刻度 */
export const shortStamp = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
};

/** <input type="date"> 需要 yyyy-MM-dd；写不出的自定义写法回退空值（不覆盖原值） */
export const dateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const stamp = Date.parse(trimmed);
  if (!Number.isFinite(stamp)) return '';
  return new Date(stamp).toISOString().slice(0, 10);
};

/** 存续区间文案：起止都给、只给一端、或完全没有端点 */
export const formatTimeSpan = (time?: PoliticsTimeSpan | null): string => {
  const start = shortStamp(time?.start);
  const end = shortStamp(time?.end);
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} 起`;
  if (end) return `至 ${end}`;
  const display = time?.display?.trim();
  return display || NO_TIME_LABEL;
};

/** 时间平移：只平移可解析端点，端点缺失或者无法解析时原样保留（§4.4 批量平移） */
export const shiftTimeSpan = (
  time: PoliticsTimeSpan | undefined,
  days: number
): { time?: PoliticsTimeSpan; changed: boolean; skipped: number } => {
  if (!time) return { time, changed: false, skipped: 0 };
  let skipped = 0;
  const shift = (value?: string): string | undefined => {
    if (!value) return value;
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp)) {
      skipped += 1;
      return value;
    }
    return new Date(stamp + days * MS_PER_DAY).toISOString();
  };
  const next: PoliticsTimeSpan = {
    ...time,
    start: shift(time.start),
    end: shift(time.end),
  };
  const changed = next.start !== time.start || next.end !== time.end;
  return { time: next, changed, skipped };
};

export const levelLabelOf = (levels: LevelDef[] | undefined, id?: string | null): string => {
  if (!id) return UNSET_LABEL;
  return levels?.find((def) => def.id === id)?.label ?? id;
};

export const statusDefOf = (
  statuses: StatusDef[] | undefined,
  id?: string | null
): StatusDef | undefined => (id ? statuses?.find((def) => def.id === id) : undefined);

export const statusLabelOf = (statuses: StatusDef[] | undefined, id?: string | null): string =>
  statusDefOf(statuses, id)?.label ?? id ?? UNSET_LABEL;

/** 更新时间：行内只给到分钟，避免长 ISO 串撑破行高 */
export const formatUpdatedAt = (value?: string | null): string => {
  if (!value) return ORPHAN_LABEL;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

/**
 * 虚拟滚动用平均行高：名录是异质行（56/40/32/36/区块头），
 * shared/useVirtualList 用固定 itemHeight，这里取加权平均并保证总高度守恒（§11.1.5）。
 */
export const averageRowHeight = (heights: number[]): number => {
  if (heights.length === 0) return rosterRowHeight('polity');
  const total = heights.reduce((sum, value) => sum + value, 0);
  return Math.max(1, Math.round(total / heights.length));
};

/** 目录级筛选：kind 由区块单独判定，行内只校验等级 / 状态 / 搜索（沿用 selectors.matchesFilter） */
export const withoutKind = (filter: PoliticsFilterState): PoliticsFilterState => ({
  ...filter,
  kind: 'all',
});

export const hasActiveFilter = (filter: PoliticsFilterState): boolean =>
  filter.kind !== 'all' ||
  !!filter.level ||
  !!filter.status ||
  !!filter.search.trim();

/** 关联计数：直接读 politics.counts（世界级批量聚合结果，O(1)，不逐行重算） */
export const countsOfEntity = (
  politics: UsePoliticsResult,
  id: string,
  kind: string
): { out: number; in: number } => {
  const entry = politics.counts.get(refKey(politicsRefOf(id, kind)));
  return { out: entry?.outgoing ?? 0, in: entry?.incoming ?? 0 };
};
