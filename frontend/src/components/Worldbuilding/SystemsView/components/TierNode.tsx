/**
 * TierNode（Phase 3 P3-T5；systems_ui_design §4.1/§4.2/§4.4/§5.1/§5.2）
 *
 * 阶梯上的一个阶位卡片：rank、名称、分支 / 状态徽章、关联计数，
 * 以及挂载在它上面的能力 / 规则 / 代价 chip（复用标记来自 grants 计数）。
 * 结构档额外提供幽灵 chip（添加能力 / 规则 / 代价）、连线入口（+ 进阶 / + 前置）、
 * 编辑 / 删除与拖拽调序按钮；速写档只显示 rank 与名称（§8）。
 */

import { useState, useMemo } from 'react';
import type { DragEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Flame,
  GripVertical,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import type { ModuleConfig } from '../../shared/moduleConfig';
import { kindLabelOf } from '../../shared/moduleConfig';
import { viewSpring } from '../../shared/motion';
import type { EntityRefsResult } from '../../hooks';
import type { WorldLinkCountMap } from '../../shared/useLinkCountMap';
import { nodeStyleOf } from '../config';
import {
  ABILITY_KIND,
  COST_KIND,
  RULE_KIND,
  SYSTEM_KINDS,
  type StairEdge,
  type SystemNode,
} from '../types';
import { lucideIcon } from './systemsSupport';

const CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary';

export interface TierNodeProps {
  tier: SystemNode;
  /** 归一化后的 rank（唯一决定阶梯顺序） */
  rank: number;
  /** 在 stair.tiers 中的序号（0 起）与总数：用于禁用越界的上移 / 下移 */
  position: number;
  total: number;
  tierTerm: string;
  config: ModuleConfig;
  refs: EntityRefsResult;
  counts: WorldLinkCountMap;
  granted: SystemNode[];
  costs: SystemNode[];
  externalCosts: StairEdge[];
  grantCounts: Map<string, number>;
  statusLabel?: string;
  statusColor?: string;
  selected: boolean;
  sketch: boolean;
  /** 结构档能力：chip、幽灵 chip、连线编辑（§8） */
  canEdit: boolean;
  /** 阶梯管理（新建 / 改名 / 调序 / 删除）：三档都必需（§8 必填含「有序等级列表」） */
  canManageTier: boolean;
  /** 可选为连线对端的其它阶位（已排除自身） */
  candidates: SystemNode[];
  rankOf: (nodeId: string) => number;
  dragging: boolean;
  onSelect: () => void;
  onSelectNode: (nodeId: string) => void;
  onAddMember: (tierId: string, kind: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** 视觉方向：up = 提高 rank（阶梯上移），down = 降低 rank */
  onMove: (direction: 'up' | 'down') => void;
  onCreateEdge: (
    sourceId: string,
    targetId: string,
    type: 'systems.advances_to' | 'systems.requires'
  ) => Promise<boolean>;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}

interface MemberChipProps {
  node: SystemNode;
  config: ModuleConfig;
  grantCounts: Map<string, number>;
  onSelectNode: (nodeId: string) => void;
}

/** 挂在阶位上的可复用节点 chip（能力 / 规则 / 代价） */
const MemberChip = ({ node, config, grantCounts, onSelectNode }: MemberChipProps) => {
  const style = nodeStyleOf(config, node.kind);
  const Icon = lucideIcon(style.icon) ?? Plus;
  const reusable = (grantCounts.get(node.id) ?? 0) > 1;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelectNode(node.id);
      }}
      title={node.nodeMeta.summary ?? node.name}
      data-testid="member-chip"
      data-node-id={node.id}
      className={CHIP_CLASS}
    >
      <Icon className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{node.name}</span>
      {reusable && (
        <span
          className="rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 text-[10px] text-violet-700 dark:text-violet-300"
          title="同一节点被多个阶位引用"
          data-testid="reuse-badge"
        >
          复用
        </span>
      )}
    </button>
  );
};

export const TierNode = ({
  tier,
  rank,
  position,
  total,
  tierTerm,
  config,
  refs,
  counts,
  granted,
  costs,
  externalCosts,
  grantCounts,
  statusLabel,
  statusColor,
  selected,
  sketch,
  canEdit,
  canManageTier,
  candidates,
  rankOf,
  dragging,
  onSelect,
  onSelectNode,
  onAddMember,
  onEdit,
  onDelete,
  onMove,
  onCreateEdge,
  onDragStart,
  onDragOver,
  onDrop,
}: TierNodeProps) => {
  const [edgeType, setEdgeType] = useState<
    'systems.advances_to' | 'systems.requires' | null
  >(null);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);

  const linkCount = counts.countOf(tier.ref);

  const closePicker = () => {
    setEdgeType(null);
    setTargetId('');
  };

  const submitEdge = async () => {
    if (!edgeType || !targetId) return;
    setBusy(true);
    try {
      // 环路 / 重复边由数据层拦截并 toast；失败时保持选择器不变（systems_ui_design §5.2）
      const ok = await onCreateEdge(tier.id, targetId, edgeType);
      if (ok) closePicker();
    } catch {
      // 兜住 rejection（点击处是 void 调用），连线失败由数据层统一提示
    } finally {
      setBusy(false);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tier.id);
    onDragStart();
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canManageTier) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDragOver();
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    onDrop();
  };

  const chipGroups: { kind: string; label: string; nodes: SystemNode[] }[] = useMemo(() => {
    const seen: string[] = [];
    for (const node of granted) {
      if (!seen.includes(node.kind)) seen.push(node.kind);
    }
    return seen.map((kind) => ({
      kind,
      label: kindLabelOf(config, kind, SYSTEM_KINDS, kind),
      nodes: granted.filter((node) => node.kind === kind),
    }));
  }, [config, granted]);

  return (
    /* 外层 motion.div 只负责 hover 抬升：framer-motion 的 onDragStart 是手势签名，
       不能和 article 的原生 HTML5 拖拽回调共用同一个元素 */
    <motion.div whileHover={{ y: -3 }} transition={viewSpring} className="group">
      <article
        data-testid="tier-node"
        data-tier-rank={rank}
        data-tier-id={tier.id}
        data-position={position}
        aria-current={selected ? 'true' : undefined}
        draggable={canManageTier}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={onSelect}
        className={`relative rounded-xl border bg-card/50 p-4 shadow-sm transition-all duration-300 motion-reduce:transition-none ${
          selected
            ? 'border-violet-500/70 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/30'
            : 'border-border/50 hover:border-violet-500/30 hover:shadow-lg'
        } ${dragging ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          {canManageTier && (
            <span
              className="mt-0.5 cursor-grab text-muted-foreground/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              title="拖拽调整阶位顺序"
              aria-hidden="true"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                r{rank}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                }}
                className="min-w-0 truncate text-left text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
              >
                {tier.name}
              </button>
              <span className="text-xs text-muted-foreground">{tierTerm}</span>
              {tier.tierMeta.branch && (
                <span
                  className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                  data-testid="tier-branch"
                >
                  分支 {tier.tierMeta.branch}
                </span>
              )}
              {statusLabel && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground"
                  data-testid="tier-status"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${statusColor ?? 'bg-violet-500'}`}
                    aria-hidden="true"
                  />
                  {statusLabel}
                </span>
              )}
            </div>

            {!sketch && tier.tierMeta.breakthrough && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                突破条件：{tier.tierMeta.breakthrough}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
              title="关联计数"
            >
              <Link2 className="mr-0.5 inline h-2.5 w-2.5" aria-hidden="true" />
              {linkCount}
            </span>
            {canManageTier && (
              <>
                <button
                  type="button"
                  aria-label={`上移 ${tier.name}`}
                  title="上移（提高 rank）"
                  disabled={position >= total - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove('up');
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`下移 ${tier.name}`}
                  title="下移（降低 rank）"
                  disabled={position <= 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove('down');
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`编辑 ${tier.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit();
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`删除 ${tier.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        {!sketch && (
          <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
            {chipGroups.map((group) =>
              group.nodes.length === 0 ? null : (
                <div key={group.kind} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground/80">
                    {group.label}
                  </span>
                  {group.nodes.map((node) => (
                    <MemberChip
                      key={node.id}
                      node={node}
                      config={config}
                      grantCounts={grantCounts}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </div>
              )
            )}

            {costs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-10 shrink-0 text-xs text-muted-foreground/80">代价</span>
                {costs.map((node) => (
                  <MemberChip
                    key={node.id}
                    node={node}
                    config={config}
                    grantCounts={grantCounts}
                    onSelectNode={onSelectNode}
                  />
                ))}
              </div>
            )}

            {externalCosts.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-1.5"
                data-testid="external-cost-chips"
              >
                <span className="w-10 shrink-0 text-xs text-muted-foreground/80" />
                {/*
                  systems.costs 指向经济资源 / 商品：经济未接入时没有 kind 定义与跳转入口，
                  按 systems_ui_design §4.2 降级为纯文本 chip。
                */}
                {externalCosts.map((edge) => (
                  <span
                    key={edge.link.id}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2 py-0.5 text-xs text-muted-foreground"
                    title={edge.link.note ?? edge.link.link_type}
                  >
                    <Flame className="h-3 w-3 text-orange-500" aria-hidden="true" />
                    {refs.resolveName(edge.link.target)}
                  </span>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                {/*
                  「赋予」只能指向能力节点（契约 §4：systems.grants 目标仅 ability），
                  所以只有能力按钮会带「自动建立关联」的语义；规则 / 代价仍可在此新建，
                  但不在本阶位自动连线（数据层也会拒绝非法 grants），提示写在 title 上。
                */}
                {[
                  {
                    kind: ABILITY_KIND,
                    label: '添加能力',
                    hint: `新建能力并自动建立「赋予」关联到本${tierTerm}`,
                  },
                  {
                    kind: RULE_KIND,
                    label: '添加规则',
                    hint: `只新建规则节点，不自动关联到本${tierTerm}（「赋予」只能指向能力节点）`,
                  },
                  {
                    kind: COST_KIND,
                    label: '添加代价',
                    hint: `只新建代价节点，不自动关联到本${tierTerm}（可在关联面板手动补充）`,
                  },
                ].map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    title={item.hint}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddMember(tier.id, item.kind);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
                <span className="mx-1 h-3 w-px bg-border/60" aria-hidden="true" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEdgeType(
                      edgeType === 'systems.advances_to' ? null : 'systems.advances_to'
                    );
                    setTargetId('');
                  }}
                  title="建立进阶（systems.advances_to）"
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-violet-500/50 px-2 py-0.5 text-xs text-violet-700 transition-colors hover:bg-violet-500/10 dark:text-violet-300"
                >
                  <ArrowUp className="h-3 w-3" aria-hidden="true" />+ 进阶
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEdgeType(edgeType === 'systems.requires' ? null : 'systems.requires');
                    setTargetId('');
                  }}
                  title="建立前置（systems.requires）"
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />+ 前置
                </button>
              </div>
            )}

            {edgeType && (
              <div
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-2"
                data-testid="stair-edge-picker"
              >
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  aria-label={edgeType === 'systems.advances_to' ? '进阶目标阶位' : '前置目标阶位'}
                  className="min-w-0 flex-1 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-xs focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">选择{tierTerm}</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}（r{rankOf(candidate.id)}）
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!targetId || busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void submitEdge();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  {edgeType === 'systems.advances_to' ? '建立进阶' : '建立前置'}
                </button>
                <button
                  type="button"
                  aria-label="取消连线"
                  onClick={(event) => {
                    event.stopPropagation();
                    closePicker();
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    </motion.div>
  );
};
