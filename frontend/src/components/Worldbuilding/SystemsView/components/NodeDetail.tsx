/**
 * NodeDetail（Phase 3 P3-T6；systems_ui_design §4.2/§5.1.5/§6.2/§8/§9）
 *
 * 右栏 / 窄屏底部抽屉：字段顺序为 rank / 分支 / 状态 -> 突破条件 -> 赋予 -> 前置 ->
 * 进阶 -> 代价 -> 境界达成者 -> LinkPanel；空字段不显示标题。
 * ability / rule / cost 节点改为显示自身摘要、复用标记、长文与「由该节点赋予」的阶位列表。
 * 速写档只保留名称与摘要（§8）：关联行、成员字段与长文全部隐藏，LinkPanel 仍保留。
 * 未选中时显示体系概况；编辑 / 删除入口与删除确认（列出引用该节点的 grants / costs）都在这里。
 */

import { useMemo, useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ChevronsUp,
  Flame,
  Gift,
  Info,
  Layers,
  Link2,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react';

import { LinkPanel } from '@/components/common/LinkPanel';
import type { EntityRef, LinkTypeDef, WorldLink } from '@/services/worldbuildingApi';
import { useInView } from '../../shared/useVirtualList';
import { statusDefsOf, type EntityTypeDef, type ModuleConfig } from '../../shared/moduleConfig';
import { useWorldLinks, type EntityRefsResult } from '../../hooks';
import { moduleLabel } from '../../types';
import type { WorldLinkCountMap } from '../../shared/useLinkCountMap';
import { COST_KIND, isTierNode, type StairModel, type SystemEntity, type SystemNode } from '../types';
import { ChipRow } from './ChipRow';
import { NodeDeleteModal } from '../modals/NodeDeleteModal';
import { colorDot, type StairIndex } from './systemsSupport';

const LONG_TEXT_FIELDS: { id: string; label: string }[] = [
  { id: 'summary', label: '摘要' },
  { id: 'body', label: '正文' },
  { id: 'condition', label: '条件' },
  { id: 'examples', label: '示例' },
];

/** item 长文（node.detail / tier.breakthrough）按 §3.3 建议字段平铺 */
const LongText = ({ content }: { content: Record<string, unknown> }) => {
  const entries = LONG_TEXT_FIELDS.map((field) => ({
    label: field.label,
    value: content[field.id],
  })).filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === 'string' && entry.value.trim().length > 0
  );

  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.label} className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {entry.label}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.value}</p>
        </div>
      ))}
    </div>
  );
};

interface AttainersProps {
  links: WorldLink[];
  refs: EntityRefsResult;
  onNavigate?: (ref: EntityRef) => void;
}

/** 境界达成者：character.attained 入链的角色字母头像行（懒加载，§6.3） */
const Attainers = ({ links, refs, onNavigate }: AttainersProps) => {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-1.5" data-testid="attainers">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        境界达成者
        <span className="ml-1 rounded-full bg-muted/40 px-1.5 text-[10px]">{links.length}</span>
      </span>
      {inView &&
        links.map((link) => {
          const name = refs.resolveName(link.source);
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => onNavigate?.(link.source)}
              title={`${name} · ${moduleLabel(link.source.module)}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-[10px] text-foreground transition-colors hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
            >
              {name.slice(0, 1)}
            </button>
          );
        })}
    </div>
  );
};

export interface NodeDetailProps {
  worldId: string;
  system: SystemEntity;
  /** null = 未选中，展示体系概况 */
  node: SystemNode | null;
  stair: StairModel;
  stairIndex: StairIndex;
  config: ModuleConfig;
  kinds: EntityTypeDef[];
  refs: EntityRefsResult;
  linkTypes: Map<string, LinkTypeDef>;
  counts: WorldLinkCountMap;
  codexContent: (nodeId: string, itemName: string) => Record<string, unknown>;
  tierTerm: string;
  sketch: boolean;
  /** 结构档能力：节点编辑 / 删除 / 添加 chip（§8） */
  canEdit: boolean;
  canManageTier: boolean;
  onNavigate: (ref: EntityRef) => void;
  onEdit: (node: SystemNode) => void;
  onDeleteNode: (node: SystemNode) => Promise<void> | void;
  onDeleteLinks: (linkIds: string[]) => Promise<void> | void;
  onAddMember: (tierId: string, kind: string) => void;
  onEditSystem?: () => void;
  /** 节点被 grants / costs 引用的上游（复用提示） */
  grantSourcesOf: (nodeId: string) => SystemNode[];
  /** 外部（阶梯节点卡片）请求删除：命中当前节点时打开删除确认 */
  deleteRequestId?: string | null;
  onDeleteRequestHandled?: () => void;
}

export const NodeDetail = ({
  worldId,
  system,
  node,
  stair,
  stairIndex,
  config,
  kinds,
  refs,
  linkTypes,
  counts,
  codexContent,
  tierTerm,
  sketch,
  canEdit,
  canManageTier,
  onNavigate,
  onEdit,
  onDeleteNode,
  onDeleteLinks,
  onAddMember,
  onEditSystem,
  grantSourcesOf,
  deleteRequestId,
  onDeleteRequestHandled,
}: NodeDetailProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const linksQuery = useWorldLinks(worldId);
  const worldLinks = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const statuses = useMemo(() => statusDefsOf(config), [config]);

  // 阶梯卡片上的「删除」：确认弹窗仍由本组件持有（§5.1.5）
  useEffect(() => {
    if (!deleteRequestId || !node || deleteRequestId !== node.id) return;
    setDeleteOpen(true);
    onDeleteRequestHandled?.();
  }, [deleteRequestId, node, onDeleteRequestHandled]);

  const references = useMemo(() => {
    if (!node) return [];
    const byId = new Map(
      [system.node, ...stair.tiers, ...stair.members].map((item) => [item.id, item])
    );
    return stair.edges
      .filter(
        (edge) =>
          edge.targetId === node.id && (edge.type === 'grants' || edge.type === 'costs')
      )
      .map((edge) => ({
        linkId: edge.link.id,
        type: edge.type,
        name: byId.get(edge.sourceId)?.name ?? refs.resolveName(edge.link.source),
      }));
  }, [node, refs, stair.edges, stair.members, stair.tiers, system.node]);

  // 未选中：体系概况（tagline / 类型 / 阶位数 / 节点数）
  if (!node) {
    return (
      <div className="space-y-4 p-4" data-testid="node-detail">
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10">
              <Layers className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-foreground">{system.name}</h2>
              {system.meta.tagline && (
                <p className="mt-0.5 text-xs text-muted-foreground">{system.meta.tagline}</p>
              )}
            </div>
            {onEditSystem && (
              <button
                type="button"
                aria-label="编辑体系信息"
                onClick={onEditSystem}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {system.meta.categoryLabel && (
              <div className="flex items-center gap-1">
                <dt>类型</dt>
                <dd className="text-foreground">{system.meta.categoryLabel}</dd>
              </div>
            )}
            <div className="flex items-center gap-1">
              <dt>{tierTerm}数</dt>
              <dd className="text-foreground">{system.tiers.length}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>节点数</dt>
              <dd className="text-foreground">
                {system.tiers.length + system.members.length}
              </dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>关联</dt>
              <dd className="text-foreground">{counts.countOf(system.ref)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          在阶梯上选中一个{tierTerm}或节点即可查看详情；未建{tierTerm}时先用多行录入补齐骨架。
        </div>

        <LinkPanel worldId={worldId} entity={system.ref} onNavigate={onNavigate} />
      </div>
    );
  }

  const isTier = isTierNode(node);
  const rank = stair.ranks.get(node.id) ?? node.tierMeta.rank;
  const status = statuses.find((def) => def.id === node.tierMeta.status);
  const statusColor = status?.color ? colorDot(status.color) : null;
  const linkCount = counts.countOf(node.ref);
  const kindLabel = kinds.find((def) => def.id === node.kind)?.label ?? node.kind;

  const outLinks = (type: string): WorldLink[] =>
    stair.edges
      .filter((edge) => edge.type === type && edge.sourceId === node.id)
      .map((edge) => edge.link);

  const grantLinksAll = outLinks('grants');
  const requireLinks = outLinks('requires');
  const advanceLinks = outLinks('advances_to');
  const costLinks = outLinks('costs');
  const memberIds = new Set(stair.members.map((item) => item.id));
  const kindOfMember = (id: string): string | undefined =>
    stair.members.find((item) => item.id === id)?.kind;
  // grants 的契约目标只有 ability。历史/导入数据里指向 cost kind 的 grants 行归到「代价」，
  // 否则同一个节点会在阶梯/典籍里显示为代价、在详情里却挂在「赋予」下（口径不一致）
  const costMemberLinks = grantLinksAll.filter(
    (link) => kindOfMember(link.target.id) === COST_KIND
  );
  const grantLinks = grantLinksAll.filter(
    (link) => kindOfMember(link.target.id) !== COST_KIND
  );
  const internalCostLinks = [
    ...costLinks.filter((link) => memberIds.has(link.target.id)),
    ...costMemberLinks,
  ];
  const externalCostLinks = costLinks.filter((link) => !memberIds.has(link.target.id));

  const attainers = worldLinks.filter(
    (link) => link.link_type === 'character.attained' && link.target.id === node.id
  );

  const breakthroughCondition = codexContent(node.id, 'tier.breakthrough').condition;
  const reusable = (stairIndex.grantCounts.get(node.id) ?? 0) > 1;
  const sources = grantSourcesOf(node.id);
  const detail = codexContent(node.id, 'node.detail');

  return (
    <div className="space-y-4 p-4" data-testid="node-detail">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-foreground">{node.name}</h2>
              <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                {kindLabel}
              </span>
              {!isTier && reusable && (
                <span
                  className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-700 dark:text-violet-300"
                  data-testid="reuse-marker"
                >
                  复用
                </span>
              )}
              <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Link2 className="mr-0.5 inline h-2.5 w-2.5" aria-hidden="true" />
                {linkCount}
              </span>
            </div>
            {isTier && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">rank {rank}</span>
                {node.tierMeta.branch && <span>· {node.tierMeta.branch}</span>}
                {status && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusColor?.className ?? 'bg-violet-500'}`}
                      style={statusColor?.style}
                      aria-hidden="true"
                    />
                    {status.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {(canEdit || (isTier && canManageTier)) && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="编辑节点"
                onClick={() => onEdit(node)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="删除节点"
                onClick={() => setDeleteOpen(true)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {isTier ? (
        <>
          {(node.tierMeta.breakthrough || breakthroughCondition) && (
            <div className="space-y-1.5" data-testid="detail-breakthrough">
              <div className="text-xs font-medium text-muted-foreground">突破条件</div>
              {node.tierMeta.breakthrough && (
                <p className="text-sm leading-relaxed text-foreground">{node.tierMeta.breakthrough}</p>
              )}
              {typeof breakthroughCondition === 'string' && breakthroughCondition.trim() && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/90">
                  {breakthroughCondition}
                </p>
              )}
            </div>
          )}

          {/* 速写档只留名称与摘要（§8）：赋予 / 前置 / 进阶 / 代价行及其幽灵入口一并隐藏 */}
          {!sketch && (
            <ChipRow
              title="赋予"
              icon={Gift}
              testId="detail-grants"
              links={grantLinks}
              linkTypes={linkTypes}
              refs={refs}
              source={node.ref}
              onNavigate={onNavigate}
              onAdd={canEdit ? () => onAddMember(node.id, 'ability') : undefined}
              addLabel="添加能力"
            />
          )}

          {!sketch && (
            <ChipRow
              title="前置"
              icon={Lock}
              testId="detail-requires"
              links={requireLinks}
              linkTypes={linkTypes}
              refs={refs}
              source={node.ref}
              onNavigate={onNavigate}
            />
          )}

          {!sketch && (
            <ChipRow
              title="进阶"
              icon={ArrowUpRight}
              testId="detail-advances"
              links={advanceLinks}
              linkTypes={linkTypes}
              refs={refs}
              source={node.ref}
              onNavigate={onNavigate}
            />
          )}

          {!sketch && (
            <ChipRow
              title="代价"
              icon={Flame}
              testId="detail-costs"
              links={internalCostLinks}
              linkTypes={linkTypes}
              refs={refs}
              source={node.ref}
              onNavigate={onNavigate}
              onAdd={canEdit ? () => onAddMember(node.id, 'cost') : undefined}
              addLabel="添加代价"
            />
          )}

          {!sketch && externalCostLinks.length > 0 && (
            <div className="space-y-1.5" data-testid="detail-external-costs">
              <div className="text-xs font-medium text-muted-foreground">
                代价（体系外）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {externalCostLinks.map((link) => (
                  <span
                    key={link.id}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Flame className="h-3 w-3 text-orange-500" aria-hidden="true" />
                    {refs.resolveName(link.target)} · {moduleLabel(link.target.module)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {attainers.length > 0 && (
            <Attainers links={attainers} refs={refs} onNavigate={onNavigate} />
          )}
        </>
      ) : (
        <>
          {node.nodeMeta.summary && (
            <p className="text-sm leading-relaxed text-foreground">{node.nodeMeta.summary}</p>
          )}
          {!sketch && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {node.nodeMeta.magnitude && (
                <span>
                  量级 <span className="text-foreground">{node.nodeMeta.magnitude}</span>
                </span>
              )}
              {node.nodeMeta.costHint && (
                <span>
                  代价 <span className="text-foreground">{node.nodeMeta.costHint}</span>
                </span>
              )}
              <span>
                可复用 <span className="text-foreground">{node.nodeMeta.reusable ? '是' : '否'}</span>
              </span>
            </div>
          )}

          {!sketch && Object.keys(detail).length > 0 && (
            <div className="space-y-1.5" data-testid="detail-longtext">
              <div className="text-xs font-medium text-muted-foreground">长文</div>
              <LongText content={detail} />
            </div>
          )}

          {!sketch && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                由该节点赋予的{tierTerm}
              </div>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground/80">暂无</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((source) => (
                    <span
                      key={source.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-foreground"
                    >
                      <ChevronsUp className="h-3 w-3 text-violet-500" aria-hidden="true" />
                      {source.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <LinkPanel worldId={worldId} entity={node.ref} onNavigate={onNavigate} />

      <NodeDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        node={node}
        references={references}
        onDeleteLinksOnly={async () => {
          await onDeleteLinks(references.map((item) => item.linkId));
          setDeleteOpen(false);
        }}
        onDeleteNode={async () => {
          await onDeleteNode(node);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
};
