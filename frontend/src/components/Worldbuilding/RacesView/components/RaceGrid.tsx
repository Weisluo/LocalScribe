/**
 * 图鉴网格 RaceGrid（Phase 3 P3-T3；races_ui_design §4.1/§11）
 *
 * 响应式列数（1/2/3/4，卡片最小宽 260px）由父级按视口宽度算好传入；
 * 卡片数超过 RACE_CARD_VIRTUAL_LIMIT（200）时启用视口裁剪，避免长列表全量挂载。
 * containerRef 挂在滚动容器上（overflow-y-auto），布局切换时用 scrollTopRef 恢复滚动位置。
 */

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { motion } from 'framer-motion';

import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { shortRefId } from '../../hooks';
import type { ModuleConfig } from '../../shared/moduleConfig';
import { viewStagger } from '../../shared/motion';
import { useVirtualGrid } from '../../shared/useVirtualList';
import { RACES_MODULE, RACE_CARD_VIRTUAL_LIMIT, type RaceNode } from '../types';
import { RaceCard } from './RaceCard';

const CARD_ITEM_HEIGHT = 200;
const CARD_GAP = 16;

export interface RaceGridProps {
  nodes: RaceNode[];
  config: ModuleConfig;
  /** 世界级关联列表（批量一次，父级已取）：只用于卡片「居住地」 */
  links: WorldLink[];
  /** 由父级按视口宽度推导的列数，需与响应式类一致 */
  columns: number;
  sketch: boolean;
  selectedId?: string | null;
  resolveName: (ref?: EntityRef | null) => string;
  countOf: (ref?: EntityRef | null) => number;
  subraceCountOf: (nodeId: string) => number;
  onOpen: (nodeId: string) => void;
  /** 布局切换时保存/恢复滚动位置 */
  scrollTopRef: MutableRefObject<number>;
  /** 需要滚动到的卡片（highlightRef 命中时） */
  scrollToId?: string | null;
}

export const RaceGrid = ({
  nodes,
  config,
  links,
  columns,
  sketch,
  selectedId,
  resolveName,
  countOf,
  subraceCountOf,
  onOpen,
  scrollTopRef,
  scrollToId,
}: RaceGridProps) => {
  const containerElRef = useRef<HTMLElement | null>(null);
  const { containerRef, enabled, items, paddingTop, paddingBottom } = useVirtualGrid(nodes, {
    itemHeight: CARD_ITEM_HEIGHT,
    columns,
    gap: CARD_GAP,
    threshold: RACE_CARD_VIRTUAL_LIMIT,
  });

  const attachContainer = useCallback(
    (node: HTMLElement | null) => {
      containerElRef.current = node;
      containerRef(node);
    },
    [containerRef]
  );

  // 挂载时恢复滚动位置（布局切换回来不跳顶）
  useEffect(() => {
    const node = containerElRef.current;
    if (node && scrollTopRef.current > 0) node.scrollTop = scrollTopRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时恢复一次
  }, []);

  // 最新的筛选后列表：滚动定位按下标换算时读它，避免把 nodes 整个放进依赖里
  // （否则数据刷新 / 后台取数时会把已经滚远的视口又拽回目标卡）
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // highlightRef 命中：把目标卡滚进视口
  useEffect(() => {
    if (!scrollToId) return;
    const container = containerElRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-race-id="${scrollToId}"]`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest' });
      return;
    }
    // 窗口化裁剪时目标卡可能没挂载：用与 useVirtualGrid 同一套 itemHeight / gap / columns
    // 从它在筛选后列表里的下标换算行偏移，改 scrollTop 让窗口下一轮把它包含进来
    // （j/k、Enter、highlightRef 跳转在 > 200 张卡时靠这条，否则静默不动）
    const index = nodesRef.current.findIndex((node) => node.id === scrollToId);
    if (index < 0) return;
    const row = Math.floor(index / Math.max(1, columns));
    container.scrollTop = row * (CARD_ITEM_HEIGHT + CARD_GAP);
  }, [scrollToId, nodes.length, columns]);

  /** node id -> 最早的 races.inhabits 目标名（父级预解析，逐卡不再遍历关联） */
  const habitatNames = useMemo(() => {
    const map = new Map<string, string>();
    // §4.1 取「最早」的聚居地：先按关联创建时间升序（同一时间按 id 稳定排序）再逐 source 取第一条
    const inhabits = links
      .filter(
        (link) => link.link_type === 'races.inhabits' && link.source.module === RACES_MODULE
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const seen = new Set<string>();
    for (const link of inhabits) {
      if (seen.has(link.source.id)) continue;
      seen.add(link.source.id);
      const name = resolveName(link.target);
      // 目标解析不到时 resolveName 给的是 id 短号：不写入，交给 meta.habitatText 兜底
      if (name === shortRefId(link.target.id)) continue;
      map.set(link.source.id, name);
    }
    return map;
  }, [links, resolveName]);

  return (
    <div
      ref={attachContainer}
      data-testid="races-grid"
      data-virtualized={enabled ? 'true' : 'false'}
      onScroll={(event) => {
        scrollTopRef.current = event.currentTarget.scrollTop;
      }}
      className="h-full overflow-y-auto overflow-x-hidden"
    >
      {enabled && <div style={{ height: paddingTop }} aria-hidden="true" />}
      <motion.div
        variants={viewStagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {items.map((node) => (
          <RaceCard
            key={node.id}
            node={node}
            config={config}
            habitatName={habitatNames.get(node.id)}
            subraceCount={subraceCountOf(node.id)}
            linkCount={countOf(node.ref)}
            selected={node.id === selectedId}
            sketch={sketch}
            onOpen={onOpen}
          />
        ))}
      </motion.div>
      {enabled && <div style={{ height: paddingBottom }} aria-hidden="true" />}
    </div>
  );
};
