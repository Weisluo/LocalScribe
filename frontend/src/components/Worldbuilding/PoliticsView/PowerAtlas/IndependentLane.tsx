/**
 * 独立 / 跨国势力带 IndependentLane（Phase 4 P4-T5；politics_ui_design §2.2 第 2 层、§4.2.3/§4.9）
 *
 * - scope=independent / cross_polity 的组织横排在画布下方，不依附任何政权卡；
 * - 跨国组织显示吸附的政权数与成员数，独立组织显示成员数；
 * - 带内提供「+ 新建」入口（创建组织），中屏默认折叠（§4.9）。
 */

import { ChevronDown, ChevronUp, Shield, ShieldHalf } from 'lucide-react';
import { useState } from 'react';

import { SCOPE_LABELS } from '../types';
import type { AtlasBox, AtlasForceItem } from './atlasLayout';
import { useMediaQuery } from './atlasHooks';

export interface IndependentLaneProps {
  band: AtlasBox;
  items: AtlasForceItem[];
  dimmed: boolean;
  /** 回填迁移写入 meta.legacy 的旧势力 id：标「旧数据」（§8） */
  legacyIds?: Set<string>;
  onOpen: (organizationId: string) => void;
  onCreate: () => void;
}

export const IndependentLane = ({
  band,
  items,
  dimmed,
  legacyIds,
  onOpen,
  onCreate,
}: IndependentLaneProps) => {
  const medium = useMediaQuery('(max-width: 1439px)');
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? medium;

  return (
    <div data-testid="atlas-independent-lane">
      <div
        className="absolute flex items-center gap-1.5 text-xs leading-tight"
        style={{ left: band.x, top: band.y - 26 }}
      >
        <ShieldHalf className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <span className="whitespace-nowrap font-medium text-foreground">独立势力 / 跨国组织</span>
        <span className="shrink-0 text-muted-foreground">{items.length}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开独立势力带' : '折叠独立势力带'}
          onClick={() => setCollapsedOverride(!collapsed)}
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="新建独立 / 跨国组织"
          onClick={onCreate}
          className="shrink-0 whitespace-nowrap rounded-lg border border-dashed border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
        >
          + 新建
        </button>
      </div>

      {!collapsed && (
        <div
          className={`absolute rounded-lg border border-dashed border-red-500/30 bg-red-500/5 ${
            dimmed ? 'opacity-60' : ''
          }`}
          style={{ left: band.x, top: band.y, width: band.width, height: band.height }}
          aria-label="独立势力带"
        />
      )}

      {!collapsed &&
        items.map(({ force, box }) => (
          <button
            key={force.entity.id}
            type="button"
            data-testid="atlas-independent-item"
            data-atlas-interactive="true"
            data-organization-id={force.entity.id}
            data-unattached={force.unattached ? 'true' : undefined}
            data-legacy={legacyIds?.has(force.entity.id) ? 'true' : 'false'}
            aria-label={
              force.unattached
                ? `打开未归属势力 ${force.entity.name}`
                : `打开${SCOPE_LABELS[force.scope]}势力 ${force.entity.name}`
            }
            onClick={() => onOpen(force.entity.id)}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            className={`absolute flex flex-col justify-center gap-0.5 rounded-xl border bg-card/95 px-2.5 text-left shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg motion-reduce:transition-none ${
              force.unattached ? 'border-dashed border-amber-500/50' : 'border-red-500/40'
            } ${dimmed ? 'opacity-60' : ''}`}
          >
            <span className="flex items-center gap-1 text-xs font-medium leading-tight text-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
              <span className="min-w-0 truncate">{force.entity.name}</span>
              {force.unattached ? (
                <span className="shrink-0 rounded-full border border-amber-500/50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                  未归属
                </span>
              ) : null}
              {/* 旧数据只标不改：势力项本来没有编辑入口，标记只是让用户知道来源 */}
              {legacyIds?.has(force.entity.id) && (
                <span
                  className="shrink-0 rounded-full border border-dashed border-slate-500/50 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300"
                  data-testid="atlas-legacy-badge"
                  title="回填迁移写入的旧数据：只读"
                >
                  旧数据
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-1 text-xs leading-tight text-muted-foreground">
              <span>{force.unattached ? '未归属' : SCOPE_LABELS[force.scope]}</span>
              {force.scope === 'cross_polity' && (
                <span>· 吸附 {force.anchors.length} 个政权</span>
              )}
              <span>· 成员 {force.memberCount}</span>
            </span>
          </button>
        ))}

      {!collapsed && items.length === 0 && (
        <div
          className="absolute flex items-center text-xs leading-tight text-muted-foreground/70"
          style={{ left: band.x + 12, top: band.y + 36 }}
        >
          暂无独立 / 跨国势力，可用上方「+ 新建」添加。
        </div>
      )}
    </div>
  );
};

export default IndependentLane;
