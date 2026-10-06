/**
 * 沿革视图（Phase 4 P4-T10；politics_ui_design §4.5/§8/§9.2/§11.1）
 *
 * 主泳道是政权（高度随 level.rank，terminal 变灰仍可读）；组织泳道是细线；
 * 锚点双来源合并：items.chronicle（政治侧）+ history.milestone_of / occurs_at / involves 入链，
 * 历史事件用 flag 类图标 + 「历史」文字标签，点击跳历史详情。
 * 条约有效期缎带是独立分区：色块必带状态文字（TREATY_STATUS_LABELS），点击打开条约详情。
 * 历史模块为空时只显示政治侧锚点，不报错、不伪造事件（§4.5.2）。
 */

import { useMemo, useState } from 'react';
import { Flag, PenLine, SearchX, SlidersHorizontal } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EmptyState } from '../../shared/EmptyState';
import {
  matchesFilter,
  type ChronicleTreatyBand,
  type PoliticsFilterState,
  type UsePoliticsResult,
} from '../hooks';
import { EDGE_STATUS_CLASS, fieldClass, toneTextClass } from '../tone';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_LINK_TYPES,
  POLITY_KIND,
  TENURE_LINK_TYPES,
  TREATY_STATUS_LABELS,
} from '../types';
import { LaneRow } from './LaneRow';
import {
  bandRangeLabel,
  buildScale,
  laneOverlapsRange,
  percentOf,
  spanPercent,
  treatyBandToneClass,
  treatyStatusTextClass,
  type SuccessionMark,
  type TenureOverlayBand,
} from './chronicleSupport';

export interface ChronicleProps {
  politics: UsePoliticsResult;
  filter: PoliticsFilterState;
  focusedId: string | null;
  onOpen: (entityId: string) => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onOpenTreatyBook: () => void;
  /** 条约有效期缎带点击：打开条约详情（§4.5.3） */
  onOpenTreaty: (entityId: string) => void;
  /** 空态「清除筛选」入口：筛选状态在壳里（§9.2） */
  onResetFilter: () => void;
  /** 空态「去历史模块」入口（§9.2） */
  onOpenHistory: (ref: EntityRef) => void;
  /** 沿革「新建条约」入口（沙盘档） */
  onCreateTreaty: () => void;
}

export const Chronicle = ({
  politics,
  filter,
  focusedId,
  onOpen,
  onNavigateToEntity,
  onOpenTreatyBook,
  onOpenTreaty,
  onResetFilter,
  onOpenHistory,
  onCreateTreaty,
}: ChronicleProps) => {
  const capabilities = politics.capabilities;
  const levels = politics.levels ?? [];
  const statuses = politics.statuses ?? [];

  /** 顶部筛选：等级 / 状态 / 时间范围 / 是否显示已灭亡（只影响可见泳道，不改数据） */
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showTerminal, setShowTerminal] = useState(true);
  // 三档能力变化时本地开关不重置：有效值 = 能力 && 本地开关（降档只隐藏，不丢用户选择，§8.5）
  const [historyOverlayOn, setHistoryOverlayOn] = useState(true);
  const [treatyBandsOn, setTreatyBandsOn] = useState(true);
  const [tenureOn, setTenureOn] = useState(false);
  const historyOverlay = capabilities.historyOverlay && historyOverlayOn;
  const showTenureBands = capabilities.tenureBands && tenureOn;
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());

  const laneFilter = useMemo<PoliticsFilterState>(
    () => ({
      kind: 'all',
      level: level || filter.level,
      status: status || filter.status,
      search: filter.search,
    }),
    [filter.level, filter.search, filter.status, level, status]
  );

  const scale = useMemo(() => buildScale(politics.chronicleRange), [politics.chronicleRange]);
  const spans = politics.chronicleSpans;

  const visibleLanes = useMemo(
    () =>
      politics.chronicleLanes.filter((lane) => {
        // 层级导航是过滤器：人物在沿革里没有独立泳道，选「人物」时保持泳道可见
        if (lane.isOrganization) {
          if (!capabilities.satellites) return false;
          if (
            filter.kind !== 'all' &&
            filter.kind !== ORGANIZATION_KIND &&
            filter.kind !== FIGURE_KIND
          ) {
            return false;
          }
        } else if (
          filter.kind !== 'all' &&
          filter.kind !== POLITY_KIND &&
          filter.kind !== FIGURE_KIND
        ) {
          return false;
        }
        if (!matchesFilter(lane.entity, laneFilter)) return false;
        if (!showTerminal && lane.terminal) return false;
        if (!laneOverlapsRange(lane, from, to)) return false;
        return true;
      }),
    [capabilities.satellites, from, laneFilter, politics.chronicleLanes, showTerminal, filter.kind, to]
  );

  const bands = useMemo<ChronicleTreatyBand[]>(
    () => (capabilities.chronicleTreaties && treatyBandsOn ? politics.chronicleTreatyBands : []),
    [capabilities.chronicleTreaties, politics.chronicleTreatyBands, treatyBandsOn]
  );

  const historyAnchorsExist = useMemo(
    () =>
      politics.chronicleLanes.some((lane) =>
        lane.anchors.some((anchor) => anchor.source === 'history')
      ),
    [politics.chronicleLanes]
  );
  const historyRef = useMemo(
    () => politics.refs.entries.find((entry) => entry.ref.module === 'history')?.ref,
    [politics.refs.entries]
  );

  /**
   * 核心人物任职带（§4.5.4 可选叠加）：遍历一次任职边得到 entity -> bands。
   * 选择器没有暴露「泳道级任职带」，这里只做一次 O(links) 结算，不逐泳道扫描。
   */
  const tenureByEntity = useMemo(() => {
    const map = new Map<string, TenureOverlayBand[]>();
    if (!showTenureBands) return map;
    for (const link of politics.links) {
      if (!TENURE_LINK_TYPES.includes(link.link_type)) continue;
      if (link.source.module !== 'politics' || link.target.module !== 'politics') continue;
      const figure = politics.byId.get(link.source.id);
      if (!figure) continue;
      const meta = (link.meta ?? {}) as Record<string, unknown>;
      const bucket = map.get(link.target.id) ?? [];
      bucket.push({
        figureId: figure.id,
        figureName: figure.name,
        office: typeof meta.officeTitle === 'string' ? meta.officeTitle : '',
        isPrimary: meta.isPrimary === true,
        start: link.time?.start ?? undefined,
        end: link.time?.end ?? undefined,
      });
      map.set(link.target.id, bucket);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) ||
          (a.start ?? '').localeCompare(b.start ?? '')
      );
    }
    return map;
  }, [politics.byId, politics.links, showTenureBands]);

  /** 继承边（politics.succeeds）落在同一泳道且两端都有任职带时，在交接处画短箭头（沙盘档） */
  const successionByEntity = useMemo(() => {
    const map = new Map<string, SuccessionMark[]>();
    if (!showTenureBands || !capabilities.timeline || !scale) return map;
    for (const link of politics.links) {
      if (link.link_type !== POLITICS_LINK_TYPES.succeeds) continue;
      if (link.source.module !== 'politics' || link.target.module !== 'politics') continue;
      for (const [entityId, bands] of tenureByEntity) {
        const successor = bands.find((band) => band.figureId === link.source.id);
        const predecessor = bands.find((band) => band.figureId === link.target.id);
        if (!successor || !predecessor) continue;
        const percent = percentOf(scale, successor.start ?? predecessor.end);
        if (percent === undefined) continue;
        const bucket = map.get(entityId) ?? [];
        bucket.push({
          percent,
          label: `${successor.figureName} 继承 ${predecessor.figureName}`,
        });
        map.set(entityId, bucket);
      }
    }
    return map;
  }, [capabilities.timeline, politics.links, scale, showTenureBands, tenureByEntity]);

  const localFilterActive =
    !!level ||
    !!status ||
    !!from ||
    !!to ||
    !showTerminal ||
    filter.kind !== 'all' ||
    !!filter.level ||
    !!filter.status ||
    !!filter.search.trim();

  const resetAll = () => {
    setLevel('');
    setStatus('');
    setFrom('');
    setTo('');
    // 恢复默认：默认显示已灭亡泳道（§2.1/§4.5.1），不是隐藏
    setShowTerminal(true);
    onResetFilter();
  };

  const toggleLane = (laneId: string) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  };

  const nothingVisible = visibleLanes.length === 0 && bands.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="politics-chronicle">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          等级
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            aria-label="沿革按等级筛选"
            disabled={levels.length === 0}
            className={`${fieldClass} w-24`}
          >
            <option value="">{levels.length === 0 ? '还没有等级定义' : '全部等级'}</option>
            {levels.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          状态
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="沿革按状态筛选"
            disabled={statuses.length === 0}
            className={`${fieldClass} w-24`}
          >
            <option value="">{statuses.length === 0 ? '还没有状态定义' : '全部状态'}</option>
            {statuses.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          时间范围
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="沿革时间范围起点"
            className={`${fieldClass} w-32`}
          />
          –
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="沿革时间范围终点"
            className={`${fieldClass} w-32`}
          />
        </label>

        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showTerminal}
            onChange={(event) => setShowTerminal(event.target.checked)}
          />
          显示已灭亡
        </label>

        {capabilities.historyOverlay && (
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={historyOverlay}
              onChange={(event) => setHistoryOverlayOn(event.target.checked)}
            />
            叠加历史里程碑
          </label>
        )}

        {capabilities.tenureBands && (
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={tenureOn}
              onChange={(event) => setTenureOn(event.target.checked)}
            />
            叠加核心人物任职带
            {capabilities.timeline && tenureOn ? '（含继承箭头）' : ''}
          </label>
        )}

        {capabilities.chronicleTreaties && (
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={treatyBandsOn}
              onChange={(event) => setTreatyBandsOn(event.target.checked)}
            />
            显示条约有效期
          </label>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenTreatyBook}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/30"
          >
            <PenLine className="h-3 w-3" aria-hidden="true" />
            条约簿
          </button>
          <button
            type="button"
            onClick={onCreateTreaty}
            disabled={!politics.canEdit}
            className="rounded-md border border-border px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/30 disabled:opacity-50"
          >
            新建条约
          </button>
          {localFilterActive && (
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              清除筛选
            </button>
          )}
        </div>
      </div>

      {capabilities.historyOverlay && !historyAnchorsExist && (
        <div
          data-testid="chronicle-history-empty"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground"
        >
          <Flag className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span>历史模块还没有可关联的事件：只显示政治侧沿革锚点，不报错也不伪造事件。</span>
          {visibleLanes[0] && (
            <button
              type="button"
              onClick={() => onOpen(visibleLanes[0].entity.id)}
              className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-accent/30"
            >
              添加政治沿革条目
            </button>
          )}
          {historyRef && (
            <button
              type="button"
              onClick={() => onOpenHistory(historyRef)}
              className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-accent/30"
            >
              去历史模块
            </button>
          )}
        </div>
      )}

      {nothingVisible ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <EmptyState
            compact
            icon={SearchX}
            title={localFilterActive ? '没有符合条件的政权泳道' : '暂无可绘制的沿革'}
            description={
              localFilterActive
                ? '清除筛选，或放宽等级 / 状态 / 时间范围。'
                : '政权与组织建立存续时间后，兴亡线会出现在这里。'
            }
            actions={
              localFilterActive
                ? [{ label: '清除筛选', onClick: resetAll, variant: 'secondary' }]
                : undefined
            }
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[760px]">
            <div className="flex items-center">
              <div className="w-52 shrink-0 px-2 text-[10px] text-muted-foreground">
                时间刻度 · {spans.length} 个可解析端点
              </div>
              <div className="relative h-7 min-w-0 flex-1 border-b border-border/50">
                {scale ? (
                  spans.map((span) => (
                    <div
                      key={span.key ?? span.label}
                      className="absolute top-0 -translate-x-1/2 text-[9px] text-muted-foreground"
                      style={{ left: `${percentOf(scale, span.key) ?? 0}%` }}
                    >
                      <span className="mx-auto block h-1.5 w-px bg-border" aria-hidden="true" />
                      {span.label}
                    </div>
                  ))
                ) : (
                  <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">
                    未填写时间：端点不可解析时不伪造刻度
                  </span>
                )}
              </div>
            </div>

            {visibleLanes.map((lane) => (
              <LaneRow
                key={lane.entity.id}
                politics={politics}
                lane={lane}
                scale={scale}
                focused={focusedId === lane.entity.id}
                expanded={expandedLanes.has(lane.entity.id)}
                historyOverlay={historyOverlay}
                tenureBands={tenureByEntity.get(lane.entity.id) ?? []}
                successions={successionByEntity.get(lane.entity.id) ?? []}
                onToggleAnchors={() => toggleLane(lane.entity.id)}
                onOpen={() => onOpen(lane.entity.id)}
                onNavigateToEntity={onNavigateToEntity}
              />
            ))}

            {bands.length > 0 && (
              <section data-testid="chronicle-treaty-bands" className="mt-1">
                <div className="flex items-center">
                  <div className="w-52 shrink-0 px-2 text-[10px] font-medium text-foreground">
                    条约有效期（{bands.length}）
                  </div>
                  <div className="min-w-0 flex-1 border-b border-border/40" />
                </div>
                {bands.map((band) => {
                  const segment = spanPercent(scale, band.start, band.end);
                  const label = TREATY_STATUS_LABELS[band.status];
                  return (
                    <div
                      key={band.treaty.id}
                      data-testid="chronicle-treaty-band"
                      className="flex items-center border-b border-border/20"
                    >
                      <div className="flex w-52 shrink-0 items-center gap-1.5 px-2">
                        <button
                          type="button"
                          onClick={() => onOpenTreaty(band.treaty.id)}
                          title={`${band.treaty.name}（点击打开条约详情）`}
                          className={`min-w-0 flex-1 truncate text-left text-[11px] hover:text-primary ${toneTextClass(
                            'green'
                          )}`}
                        >
                          {band.treaty.name}
                        </button>
                        <span className={`shrink-0 text-[9px] ${treatyStatusTextClass(band.status)}`}>
                          {label}
                        </span>
                      </div>
                      <div className="relative h-6 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenTreaty(band.treaty.id)}
                          aria-label={`条约 ${band.treaty.name}：有效期 ${bandRangeLabel(
                            band
                          )}，状态 ${label}`}
                          title={`${bandRangeLabel(band)} · ${label}`}
                          style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                          className={`absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded-sm border ${treatyBandToneClass(
                            band.status
                          )} ${EDGE_STATUS_CLASS[band.status] ?? ''}`}
                        >
                          <span className="truncate px-1 text-[9px] text-foreground">{label}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chronicle;
