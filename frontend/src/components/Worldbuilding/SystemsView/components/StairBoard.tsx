/**
 * StairBoard（Phase 3 P3-T5；systems_ui_design §2.2/§4.1/§4.4/§5.1/§8/§11）
 *
 * 中栏阶梯：tier 按 meta.rank 归一化后纵向排列，视觉顺序恒为「高阶在上」，
 * advances_to 实线箭头向上、requires 虚线锁、countered_by 双线盾牌，
 * 全部为简单 CSS，不引入图形库。
 * - 非虚拟路径：DOM 升序 + column-reverse（测试断言 data-tier-rank 为 10,20,30）。
 * - 虚拟路径：useVirtualGrid 的 paddingTop / paddingBottom 按「索引 0 在最上方」计算行号，
 *   所以把降序数组喂给 hook，DOM 首项即最高 rank，正常流向即可；两条路径视觉一致。
 * 超过 SYSTEM_NODE_LIMIT 个节点时交给 useVirtualGrid 只挂载视口内节点（§11）。
 * 速写档只渲染 rank + 名称，隐藏 chip、连线与连线标签（§8）。
 */

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowUp, ChevronsUp, Lock, Shield } from 'lucide-react';

import type { LinkTypeDef } from '@/services/worldbuildingApi';
import { EmptyState } from '../../shared/EmptyState';
import { statusDefsOf, type ModuleConfig, type StatusDef } from '../../shared/moduleConfig';
import type { EntityRefsResult } from '../../hooks';
import { useVirtualGrid } from '../../shared/useVirtualList';
import type { WorldLinkCountMap } from '../../shared/useLinkCountMap';
import { SYSTEM_NODE_LIMIT, STAIR_LINK_TYPES, type StairEdge, type StairModel, type SystemEntity, type SystemNode } from '../types';
import { TierBulkInput } from './TierBulkInput';
import { TierNode } from './TierNode';
import { colorDot, linkLabelOf, type StairIndex } from './systemsSupport';

/** 阶梯行的估高（视口裁剪用；阶梯卡片高度随 chip 数量浮动，取经验值） */
const TIER_ROW_HEIGHT = 176;

const LINE_CLASS: Record<string, string> = {
  advances_to: 'h-6 w-0.5 bg-violet-500',
  requires: 'h-6 w-0 border-l-2 border-dashed border-amber-500',
  countered_by: 'h-6 w-0 border-l-4 border-double border-rose-500',
};

const CONNECTOR_ICON: Record<string, typeof ArrowUp> = {
  advances_to: ArrowUp,
  requires: Lock,
  countered_by: Shield,
};

interface StairConnectorProps {
  from: SystemNode;
  to: SystemNode;
  edges: StairEdge[];
  linkTypes: Map<string, LinkTypeDef>;
}

/** 相邻阶位之间的连线：视觉顺序恒为「高阶在上」，故 advances_to 恒指向上 */
const StairConnector = ({ from, to, edges, linkTypes }: StairConnectorProps) => {
  if (edges.length === 0) {
    // 该段没有连线时仍保留轨道高度，保证 2px 竖向轨道连续（§4.4）
    return <div className="h-5" aria-hidden="true" />;
  }
  return (
    <div className="flex flex-col gap-1 py-1">
      {edges.map((edge) => {
        const Icon = CONNECTOR_ICON[edge.type] ?? ArrowUp;
        const source = edge.sourceId === from.id ? from : to;
        const target = edge.sourceId === from.id ? to : from;
        return (
          <div
            key={edge.link.id}
            className="flex items-center gap-2 pl-4"
            data-testid="stair-connector"
            data-link-type={edge.link.link_type}
          >
            <span aria-hidden="true" className={LINE_CLASS[edge.type] ?? LINE_CLASS.advances_to} />
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm"
              title={`${source.name} -> ${target.name}`}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {linkLabelOf(edge.link, linkTypes)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export interface StairBoardProps {
  system: SystemEntity;
  stair: StairModel;
  /** 由 index 统一构好的赋予 / 代价 / 复用索引，避免各组件重复遍历 edges */
  stairIndex: StairIndex;
  config: ModuleConfig;
  refs: EntityRefsResult;
  linkTypes: Map<string, LinkTypeDef>;
  counts: WorldLinkCountMap;
  selectedNodeId: string | null;
  highlightNodeId?: string | null;
  tierTerm: string;
  rankStep: number;
  sketch: boolean;
  /** 结构档能力：chip / 幽灵 chip / 连线编辑（§8） */
  canEdit: boolean;
  /** 阶梯管理（增删改名调序）：三档都必需（§8 必填含「有序等级列表」） */
  canManageTier: boolean;
  isSaving: boolean;
  /** 外层滚动容器（阶梯与典籍共用，用于视口裁剪与滚动锚点） */
  scrollRootRef?: RefObject<HTMLDivElement | null>;
  onSelectNode: (nodeId: string) => void;
  onAddMember: (tierId: string, kind: string) => void;
  onEditTier: (tier: SystemNode) => void;
  onDeleteNode: (node: SystemNode) => void;
  /** 视觉方向：up = 提高 rank，down = 降低 rank */
  onMoveTier: (tierId: string, direction: 'up' | 'down') => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onCreateEdge: (
    sourceId: string,
    targetId: string,
    type: 'systems.advances_to' | 'systems.requires'
  ) => Promise<boolean>;
  onBulkCreate: (names: string[]) => Promise<unknown>;
}

export const StairBoard = ({
  system,
  stair,
  stairIndex,
  config,
  refs,
  linkTypes,
  counts,
  selectedNodeId,
  highlightNodeId,
  tierTerm,
  rankStep,
  sketch,
  canEdit,
  canManageTier,
  isSaving,
  scrollRootRef,
  onSelectNode,
  onAddMember,
  onEditTier,
  onDeleteNode,
  onMoveTier,
  onReorder,
  onCreateEdge,
  onBulkCreate,
}: StairBoardProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** 已滚动到的高亮目标：stair.tiers 变化不该把用户拽回高亮节点 */
  const handledHighlightRef = useRef<string | null>(null);

  // 视觉顺序恒为「高阶在上」：非虚拟路径靠 column-reverse 反转升序 DOM；
  // 虚拟路径的 paddingTop / paddingBottom 必须对应真实滚动位置（useVirtualGrid 以
  // 索引 0 在最上方计算行号），所以先转成降序再喂给 hook，DOM 首项即最高 rank。
  const orderedTiers = useMemo(
    () => (stair.tiers.length > SYSTEM_NODE_LIMIT ? [...stair.tiers].reverse() : stair.tiers),
    [stair.tiers]
  );

  // 视口裁剪：阈值即降级阈值（> 300 节点只挂载视口内节点）
  const virtual = useVirtualGrid(orderedTiers, {
    itemHeight: TIER_ROW_HEIGHT,
    threshold: SYSTEM_NODE_LIMIT,
    overscan: 2,
  });
  const attachContainer = virtual.containerRef;
  useEffect(() => {
    attachContainer(scrollRootRef?.current ?? null);
  }, [attachContainer, scrollRootRef, stair.tiers.length]);

  const virtualized = virtual.enabled;
  /** DOM 顺序：非虚拟 = stair.tiers 升序（配合 column-reverse），虚拟 = 降序数组本身 */
  const domOrder = virtualized ? orderedTiers : stair.tiers;
  const visible = virtualized ? virtual.items : stair.tiers;
  const globalStart = virtualized ? virtual.startIndex : 0;

  const statuses = useMemo<StatusDef[]>(() => statusDefsOf(config), [config]);

  // 相邻阶位之间的内部连线（advances_to / requires / countered_by）
  const connectors = useMemo(() => {
    const map = new Map<string, StairEdge[]>();
    for (const edge of stair.edges) {
      if (!STAIR_LINK_TYPES.includes(edge.type)) continue;
      const key = `${edge.sourceId}|${edge.targetId}`;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(edge);
      } else {
        map.set(key, [edge]);
      }
    }
    return map;
  }, [stair.edges]);

  const edgesBetween = (from: SystemNode, to: SystemNode): StairEdge[] => [
    ...(connectors.get(`${from.id}|${to.id}`) ?? []),
    ...(connectors.get(`${to.id}|${from.id}`) ?? []),
  ];

  // highlightRef 跳转：滚动到目标阶位（减少动效偏好时不做平滑滚动）
  useEffect(() => {
    if (!highlightNodeId) {
      handledHighlightRef.current = null;
      return;
    }
    // 同一次跳转只处理一次：stair.tiers 变化不应把用户拽回高亮节点
    if (handledHighlightRef.current === highlightNodeId) return;
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-tier-id="${highlightNodeId}"]`
    );
    if (node) {
      handledHighlightRef.current = highlightNodeId;
      node.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    // 视口裁剪下目标可能未挂载：按视觉行号（高阶在上，与 stair.tiers 序号相反）估算偏移；
    // 外层滚动容器 / 目标下标取不到时直接跳过，不抛错（非虚拟路径总会走上面的分支）
    const root = scrollRootRef?.current;
    const list = listRef.current;
    const index = stair.tiers.findIndex((tier) => tier.id === highlightNodeId);
    if (!root || !list || index < 0) return;
    handledHighlightRef.current = highlightNodeId;
    const listTop =
      list.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    const rowTop = listTop + (stair.tiers.length - 1 - index) * TIER_ROW_HEIGHT;
    root.scrollTo({
      top: Math.max(0, rowTop + TIER_ROW_HEIGHT / 2 - root.clientHeight / 2),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [highlightNodeId, scrollRootRef, stair.tiers]);

  if (stair.tiers.length === 0) {
    return (
      <div data-testid="stair-board" data-system-id={system.id} className="space-y-4 p-4">
        <EmptyState
          compact
          icon={ChevronsUp}
          title={`添加第一个${tierTerm}`}
          description="每行一个阶位，按行序自动补 rank；也可以先保存，稍后再加。"
        />
        {canManageTier && (
          <TierBulkInput
            onSubmit={onBulkCreate}
            rankStep={rankStep}
            tierTerm={tierTerm}
            isSubmitting={isSaving}
          />
        )}
      </div>
    );
  }

  const rankOf = (nodeId: string): number => stair.ranks.get(nodeId) ?? 0;

  const nodes: ReactNode[] = [];
  visible.forEach((tier, offset) => {
    const domIndex = globalStart + offset;
    // position 恒为「stair.tiers 中的升序序号」：虚拟路径的 domOrder 是降序数组，需要换算，
    // 否则上移 / 下移的越界禁用会反过来
    const position = virtualized ? stair.tiers.length - 1 - domIndex : domIndex;
    // 视口裁剪时首个挂载项上方可能还有未挂载的阶位，连线仍按视觉前一项取
    const previous = domIndex > 0 ? domOrder[domIndex - 1] : undefined;
    if (previous) {
      // 速写档只显示 rank 与名称（§8）：不画连线与标签，仅保留行间距
      nodes.push(
        sketch ? (
          <div key={`connector-${tier.id}`} className="h-5" aria-hidden="true" />
        ) : (
          <StairConnector
            key={`connector-${tier.id}`}
            from={previous}
            to={tier}
            edges={edgesBetween(previous, tier)}
            linkTypes={linkTypes}
          />
        )
      );
    }
    const status = statuses.find((def) => def.id === tier.tierMeta.status);
    nodes.push(
      <TierNode
        key={tier.id}
        tier={tier}
        rank={rankOf(tier.id)}
        position={position}
        total={stair.tiers.length}
        tierTerm={tierTerm}
        config={config}
        refs={refs}
        counts={counts}
        granted={stairIndex.granted.get(tier.id) ?? []}
        costs={stairIndex.costs.get(tier.id) ?? []}
        externalCosts={stairIndex.externalCosts.get(tier.id) ?? []}
        grantCounts={stairIndex.grantCounts}
        statusLabel={status?.label}
        statusColor={status?.color ? colorDot(status.color).className : undefined}
        selected={selectedNodeId === tier.id}
        sketch={sketch}
        canEdit={canEdit}
        canManageTier={canManageTier}
        candidates={stair.tiers.filter((item) => item.id !== tier.id)}
        rankOf={rankOf}
        dragging={draggingId === tier.id}
        onSelect={() => onSelectNode(tier.id)}
        onSelectNode={onSelectNode}
        onAddMember={onAddMember}
        onEdit={() => onEditTier(tier)}
        onDelete={() => onDeleteNode(tier)}
        onMove={(direction) => onMoveTier(tier.id, direction)}
        onCreateEdge={onCreateEdge}
        onDragStart={() => setDraggingId(tier.id)}
        onDragOver={() => undefined}
        onDrop={() => {
          if (draggingId && draggingId !== tier.id) onReorder(draggingId, tier.id);
          setDraggingId(null);
        }}
      />
    );
  });

  return (
    <div
      data-testid="stair-board"
      data-system-id={system.id}
      className="p-4"
      onDragEnd={() => setDraggingId(null)}
    >
      <div ref={listRef} className="relative">
        {/* 竖向轨道：阶梯的层级语义靠这条轨道 + 阶位卡片尺寸差维持，不拉平成同构卡片 */}
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-4 top-3 w-0.5 bg-gradient-to-b from-violet-500/40 via-border/60 to-border/20"
        />
        {/*
          视觉顺序恒为高阶在上：非虚拟路径 DOM 升序 + column-reverse；
          虚拟路径的 domOrder 已是降序（见上方 orderedTiers），正常流向即可，
          paddingTop / paddingBottom 仍按「行号越大越靠下」占位，对应真实滚动位置。
        */}
        <div className={virtualized ? 'flex flex-col' : 'flex flex-col-reverse'}>
          {virtualized && (
            <div style={{ height: virtual.paddingTop }} aria-hidden="true" />
          )}
          {nodes}
          {virtualized && (
            <div style={{ height: virtual.paddingBottom }} aria-hidden="true" />
          )}
        </div>
      </div>
      {canManageTier && (
        <div className="mt-4">
          <TierBulkInput
            onSubmit={onBulkCreate}
            rankStep={rankStep}
            tierTerm={tierTerm}
            isSubmitting={isSaving}
          />
        </div>
      )}
    </div>
  );
};
