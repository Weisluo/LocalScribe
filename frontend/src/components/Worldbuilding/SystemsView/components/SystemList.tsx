/**
 * SystemList（Phase 3 P3-T5；systems_ui_design §4.1/§5.3/§9）
 *
 * 左栏体系列表：名称、阶位数量、可选体系色点、关联计数徽章；
 * 顶部搜索框（查询由 index 统一 200ms 防抖，覆盖体系名 / 一句话 / 阶位名 / 节点名），
 * `+ 新建体系` 固定在底部。数据由 index 过滤后传入（含「筛选无结果」分支）。
 *
 * 视觉对齐 ui_style_alignment：搜索框 §4.5、列表行 §4.8（实体层 violet）、入口按钮 §4.2。
 * 列表行不做交错入场（§5：列表行只保留 hover 反馈）。
 */

import type { Ref } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Plus, Search, SearchX, X } from 'lucide-react';

import { EmptyState } from '../../shared/EmptyState';
import type { WorldLinkCountMap } from '../../shared/useLinkCountMap';
import type { SystemEntity } from '../types';
import { colorDot } from './systemsSupport';

export interface SystemListProps {
  /** 已按搜索词过滤的体系 */
  systems: SystemEntity[];
  selectedSystemId: string | null;
  onSelect: (systemId: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  counts: WorldLinkCountMap;
  /** 模块内的体系总数：区分「还没有体系」与「筛选无结果」 */
  totalCount: number;
  canEdit: boolean;
  onCreate: () => void;
  /** 阶位术语（模块配置可覆盖） */
  tierTerm: string;
  className?: string;
}

export const SystemList = ({
  systems,
  selectedSystemId,
  onSelect,
  query,
  onQueryChange,
  searchInputRef,
  counts,
  totalCount,
  canEdit,
  onCreate,
  tierTerm,
  className = '',
}: SystemListProps) => (
  <div
    className={`flex min-h-0 flex-col gap-3 p-3 ${className}`}
    data-testid="system-list"
  >
    <div className="relative group shrink-0">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
        aria-hidden="true"
      />
      <input
        ref={searchInputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="搜索体系 / 一句话 / 阶位 / 节点"
        aria-label="搜索体系"
        className="w-full rounded-xl border border-border/40 bg-muted/30 py-2 pl-10 pr-9 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      <AnimatePresence>
        {query && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            aria-label="清空搜索"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>

    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      {systems.length === 0 ? (
        query ? (
          <EmptyState
            compact
            icon={SearchX}
            title="没有匹配的体系"
            description="换个关键词，或清空筛选后重新查看。"
            actions={[
              { label: '清空筛选', onClick: () => onQueryChange(''), variant: 'secondary' },
            ]}
          />
        ) : (
          <EmptyState
            compact
            icon={Layers}
            title={totalCount === 0 ? '还没有体系' : '暂无体系'}
            actions={canEdit ? [{ label: '新建体系', onClick: onCreate }] : undefined}
          />
        )
      ) : (
        systems.map((system) => {
          const selected = system.id === selectedSystemId;
          const dot = system.meta.color ? colorDot(system.meta.color) : null;
          return (
            <button
              key={system.id}
              type="button"
              data-testid="system-row"
              data-system-id={system.id}
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(system.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 motion-reduce:transition-none ${
                selected
                  ? 'border-violet-500/40 bg-violet-500/10 shadow-sm'
                  : 'border-transparent hover:border-border/50 hover:bg-accent/10'
              }`}
            >
              {dot && (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${dot.className}`}
                  style={dot.style}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {system.name}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {system.tiers.length} {tierTerm}
              </span>
              <span
                className="shrink-0 rounded-full border border-border/50 bg-background/60 px-1.5 text-[10px] text-muted-foreground"
                title="关联计数"
              >
                {counts.countOf(system.ref)}
              </span>
            </button>
          );
        })
      )}
    </div>

    <motion.button
      type="button"
      onClick={onCreate}
      disabled={!canEdit}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="mt-auto flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />+ 新建体系
    </motion.button>
  </div>
);
