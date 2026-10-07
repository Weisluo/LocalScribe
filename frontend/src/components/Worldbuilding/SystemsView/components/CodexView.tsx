/**
 * CodexView（Phase 3 P3-T6；systems_ui_design §4.3/§5.3/§8/§12）
 *
 * 典籍阅读视图：一阶一卷，按 rank 排列为响应式卡片网格（1/2/3 列）。
 * 卷内顺序为 突破条件 -> 赋予（能力 / 规则）-> 代价 -> 关联摘要；长文在卷内展开。
 * 这里不做任何连线编辑（§4.3）；只保证可读与可打印的排版基础，不做专用打印导出（§12）。
 *
 * 视觉对齐 ui_style_alignment：卷册卡片 §4.8、局部空态 §4.9、领域色 violet（§6，实体层）。
 * 卷册网格不做交错入场（§5：阶梯 / 典籍列表不加交错），只保留 hover 抬升。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Flame, Gift, ScrollText } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { kindLabel } from '../../types';
import { viewSpring } from '../../shared/motion';
import { useWorldLinks } from '../../hooks';
import type { CodexVolume, SystemEntity, SystemNode } from '../types';

const CN_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const volumeTitle = (index: number): string => `第${CN_NUMERALS[index] ?? index + 1}卷`;

export interface CodexViewProps {
  worldId: string;
  system: SystemEntity;
  /** 由 useSystems().codexOf(systemId) 产出的卷册（已按 rank 排列） */
  volumes: CodexVolume[];
  tierTerm: string;
  /** 长文读取：codexContent(tierId, 'tier.breakthrough') */
  codexContent: (nodeId: string, itemName: string) => Record<string, unknown>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  highlightNodeId?: string | null;
}

export const CodexView = ({
  worldId,
  system,
  volumes,
  tierTerm,
  codexContent,
  selectedNodeId,
  onSelectNode,
  highlightNodeId,
}: CodexViewProps) => {
  const linksQuery = useWorldLinks(worldId);
  const worldLinks = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  // highlightRef 跳转：滚动到对应卷册（减少动效偏好时不做平滑滚动）
  useEffect(() => {
    if (!highlightNodeId) return;
    const card = rootRef.current?.querySelector<HTMLElement>(
      `[data-tier-id="${highlightNodeId}"]`
    );
    if (!card) return;
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [highlightNodeId]);

  /** 卷内关联摘要：按对端 kind 计数（角色 1 · 事件 2），派生自世界级 links，不额外请求 */
  const summaries = useMemo(() => {
    const byTier = new Map<string, Map<string, number>>();
    for (const link of worldLinks) {
      const pairs: [string, EntityRef][] = [];
      if (link.source.module === 'systems') pairs.push([link.source.id, link.target]);
      if (link.target.module === 'systems') pairs.push([link.target.id, link.source]);
      for (const [tierId, counterpart] of pairs) {
        const bucket = byTier.get(tierId) ?? new Map<string, number>();
        const label = kindLabel(counterpart.kind);
        bucket.set(label, (bucket.get(label) ?? 0) + 1);
        byTier.set(tierId, bucket);
      }
    }
    const rendered = new Map<string, string>();
    for (const [tierId, bucket] of byTier) {
      rendered.set(
        tierId,
        [...bucket.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([label, count]) => `${label} ${count}`)
          .join(' · ')
      );
    }
    return rendered;
  }, [worldLinks]);

  const nodeChip = (node: SystemNode, tone: 'default' | 'dashed') => (
    <button
      key={node.id}
      type="button"
      onClick={() => onSelectNode(node.id)}
      title={node.nodeMeta.summary ?? node.name}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border ${
        tone === 'dashed' ? 'border-dashed border-border/60 text-muted-foreground' : 'border-border/50 bg-muted/20 text-foreground'
      } px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:text-primary`}
    >
      <span className="truncate">{node.name}</span>
    </button>
  );

  return (
    <div className="p-4" data-testid="codex-view" ref={rootRef}>
      <div className="mb-4 flex items-center gap-3">
        <ScrollText className="h-4 w-4 text-violet-500" aria-hidden="true" />
        <h2 className="text-base font-semibold tracking-tight text-foreground">{system.name} · 典籍</h2>
        <span className="text-xs text-muted-foreground">
          共 {volumes.length} 卷（按 rank 排列）
        </span>
      </div>

      {volumes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/40 px-4 py-10 text-center text-sm text-muted-foreground">
          还没有{tierTerm}，先在阶梯视图补齐骨架。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {volumes.map((volume, index) => {
            const expanded = !collapsed[volume.tier.id];
            const condition = codexContent(volume.tier.id, 'tier.breakthrough').condition;
            const longText =
              typeof condition === 'string' && condition.trim()
                ? condition
                : volume.tier.tierMeta.breakthrough ?? '';
            const summary = summaries.get(volume.tier.id) ?? '';
            const selected = selectedNodeId === volume.tier.id;

            return (
              <motion.article
                key={volume.tier.id}
                data-testid="codex-volume"
                data-rank={volume.rank}
                data-tier-id={volume.tier.id}
                whileHover={{ y: -3 }}
                transition={viewSpring}
                className={`flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm transition-all duration-300 motion-reduce:transition-none ${
                  selected
                    ? 'border-violet-500/70 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/30'
                    : highlightNodeId === volume.tier.id
                      ? 'border-violet-500 shadow-lg shadow-violet-500/10'
                      : 'border-border/50 hover:border-violet-500/30 hover:shadow-lg'
                }`}
              >
                <header className="flex items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectNode(volume.tier.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        {volumeTitle(index)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                        {volume.tier.name}
                      </h3>
                      <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">
                        r{volume.rank}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? '收起长文' : '展开长文'}
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [volume.tier.id]: expanded }))
                    }
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </header>

                {volume.tier.tierMeta.branch && (
                  <div className="text-xs text-muted-foreground">
                    分支 {volume.tier.tierMeta.branch}
                  </div>
                )}

                {longText && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      突破条件
                    </div>
                    <p
                      className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
                        expanded ? '' : 'line-clamp-2'
                      }`}
                      data-testid="codex-breakthrough"
                    >
                      {longText}
                    </p>
                  </div>
                )}

                {volume.abilities.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                      能力
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {volume.abilities.map((node) => nodeChip(node, 'default'))}
                    </div>
                  </div>
                )}

                {volume.rules.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                      规则
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {volume.rules.map((node) => nodeChip(node, 'default'))}
                    </div>
                  </div>
                )}

                {volume.costs.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      代价
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {volume.costs.map((node) => (
                        <span key={node.id} className="inline-flex items-center gap-1">
                          {nodeChip(node, 'dashed')}
                          {node.nodeMeta.costHint && (
                            <span className="text-xs text-muted-foreground">
                              · {node.nodeMeta.costHint}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="mt-auto border-t border-border/30 pt-2 text-xs text-muted-foreground"
                  data-testid="codex-summary"
                >
                  关联 {summary || '暂无'} · 计数 {volume.linkCount}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
