/**
 * 组织详情三段（Phase 4 P4-T8；politics_ui_design §4.3/§6.3/§6.5/§9.2）
 *
 * 概览 / 成员 / 关联（关联区由 index.tsx 统一挂 common/LinkPanel，保持四类详情一致）。
 * scope 由归属边推导（§3.8.3）：无归属时给「归入政权 / 保留为独立势力」两个入口；
 * 改归属与标记独立都给 5 秒撤销 toast（§5.4 第 5 条）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, Shield, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import type { OrganizationDetailView, UsePoliticsResult } from '../hooks';
import {
  ORGANIZATION_KIND,
  POLITICS_LINK_TYPES,
  POLITICS_MAX_ORG_DEPTH,
  SCOPE_LABELS,
  normalizeScope,
  orgDescendantIds,
  orgEdgeDepthOf,
  orgSubtreeHeight,
  politicsRefOf,
  type FigureEntity,
  type OrganizationEntity,
  type PoliticsScope,
} from '../types';
import { chipClass } from '../tone';
import { EdgeCard } from './EdgeCard';
import { linkTypeLabel } from './linkLabels';
import { EmptyHint, InfoRow, LinkChip, NoteRow, SectionBlock } from './sectionParts';
import { sectionDomId, timeRangeText } from './sectionUtils';

export interface OrganizationPanelProps {
  politics: UsePoliticsResult;
  entity: OrganizationEntity;
  detail: OrganizationDetailView;
  worldId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  onOpenFocus: (entityId: string) => void;
  onEdit: () => void;
  onOverlay: (close: (() => void) | null) => void;
}

export const OrganizationPanel = ({
  politics,
  entity,
  detail,
  worldId,
  onNavigateToEntity,
  onOpenFocus,
  onEdit,
  onOverlay,
}: OrganizationPanelProps) => {
  const orgRef = politicsRefOf(entity.id, entity.kind);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  /** 撤销回调要读最新的 links / byId，闭包里的 politics 会过期 */
  const latest = useRef(politics);
  latest.current = politics;

  const figureName = (figure: FigureEntity): string => {
    const character = figure.meta.characterId
      ? politics.refs.lookup({ module: 'character', kind: 'character', id: figure.meta.characterId })
      : undefined;
    return character?.name ?? figure.name;
  };

  const openEdgeCard = (edgeId: string) => {
    setEditingEdgeId(edgeId);
    onOverlay(() => setEditingEdgeId(null));
  };
  const closeEdgeCard = () => {
    setEditingEdgeId(null);
    onOverlay(null);
  };

  useEffect(() => () => onOverlay(null), [onOverlay]);

  const editingEdge = editingEdgeId
    ? politics.links.find((link) => link.id === editingEdgeId)
    : undefined;

  const crossPolityParents = detail.parents.filter((parent) => parent.ref.kind === 'polity');

  /**
   * 上级候选的成环 / 层级过滤（§5.7/§7.1.3）：
   * 排除自己、自己的后代（会成环）与现有上级；再按「上级深度 + 当前子树高度 <= 3」筛掉超限目标。
   * 后端写入路径同样拒绝，这里只做前置说明与禁用提示（UX）。
   */
  const parentPicker = useMemo(() => {
    const descendants = orgDescendantIds(politics.links, entity.id);
    const blocked = new Set<string>([entity.id, ...descendants]);
    const subtreeHeight = orgSubtreeHeight(politics.links, entity.id);
    const depthExcluded = new Set<string>();
    for (const candidate of politics.organizations) {
      if (candidate.id === entity.id || blocked.has(candidate.id)) continue;
      if (orgEdgeDepthOf(politics.links, candidate.id) + subtreeHeight > POLITICS_MAX_ORG_DEPTH) {
        depthExcluded.add(candidate.id);
      }
    }
    return {
      descendants,
      subtreeHeight,
      depthExcluded,
      excludeRefs: [
        politicsRefOf(entity.id, entity.kind),
        ...detail.parents.map((parent) => parent.ref),
        ...[...blocked]
          .filter((id) => id !== entity.id)
          .map((id) => politicsRefOf(id, ORGANIZATION_KIND)),
        ...[...depthExcluded].map((id) => politicsRefOf(id, ORGANIZATION_KIND)),
      ],
    };
  }, [detail.parents, entity.id, entity.kind, politics.links, politics.organizations]);

  /** §8.1：速写档只保留概览 + 计数，成员分工整段降级为提示 */
  const full = politics.capabilities.fullDetail;
  const canWrite = politics.canWriteEntities;

  /** 归入政权 / 上级组织：写 subordinate_to，并按 §3.8.3 重算 scope */
  const handleParentConfirm = async (selection: EntityPickerSelection) => {
    const targets = selection.targets;
    if (targets.length === 0) return;
    const previousScope = detail.scope;
    try {
      await politics.createLinks(
        targets.map((target) => ({
          linkType: POLITICS_LINK_TYPES.subordinateTo,
          target,
        })),
        orgRef
      );
      await politics.recalcScope(entity.id);
      if (previousScope === 'independent') {
        // 从独立势力改为下属时，显式清掉 meta 里的独立标记（§3.8.3 标签优先于推导）
        await politics.updateMetaMerged(entity.id, { scope: 'intra_polity' });
      }
      setParentPickerOpen(false);
      toast('已写入归属边', {
        duration: 5000,
        action: {
          label: '撤销',
          onClick: () => {
            const created = latest.current
              .linksOf(orgRef)
              .filter(
                (link) =>
                  link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
                  targets.some((target) => target.id === link.target.id)
              );
            void Promise.all(created.map((link) => latest.current.deleteLink(link.id)))
              .then(() => latest.current.updateMetaMerged(entity.id, { scope: previousScope }))
              .then(() => toast.success('已恢复归属'))
              .catch(() => toast.error('撤销失败'));
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '归属写入失败');
    }
  };

  /** 保留为独立势力：只改 meta.scope，不动归属边（scope 标签优先于推导，§3.8.3） */
  const handleMarkIndependent = async () => {
    const previousScope = detail.scope;
    try {
      await politics.updateMetaMerged(entity.id, { scope: 'independent' });
      toast('已标记为独立势力', {
        description: '它已从政权卫星簇移到独立势力带；归属边保留，改回「政权内」即可回归。',
        duration: 5000,
        action: {
          label: '撤销',
          onClick: () => {
            void latest.current
              .updateMetaMerged(entity.id, { scope: previousScope })
              .then(() => toast.success('已恢复归属范围'))
              .catch(() => toast.error('撤销失败'));
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '独立标记失败');
    }
  };

  const scope: PoliticsScope = detail.scope;

  return (
    <div data-testid="organization-panel">
      <SectionBlock
        id={sectionDomId(entity.id, 'overview')}
        title="概览"
        actions={
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-primary transition-colors hover:underline"
          >
            编辑
          </button>
        }
      >
        <InfoRow label="范围">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${chipClass} border-border/60 text-foreground`}>
              {SCOPE_LABELS[normalizeScope(scope)]}
            </span>
            {entity.meta.orgSubtypeId ? (
              <span className="text-muted-foreground">子类型 {entity.meta.orgSubtypeId}</span>
            ) : null}
            {entity.meta.baseLabel ? (
              <span className="text-muted-foreground">驻地 {entity.meta.baseLabel}</span>
            ) : null}
          </div>
        </InfoRow>

        <InfoRow
          label="上级"
          action={
            canWrite ? (
              <button
                type="button"
                onClick={() => setParentPickerOpen(true)}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                {detail.parents.length > 0 ? '改归属' : '归入政权'}
              </button>
            ) : null
          }
        >
          {detail.parents.length === 0 ? (
            <div className="space-y-1">
              <EmptyHint
                text="该组织不属于任何政权"
                actionLabel={canWrite ? '归入政权' : undefined}
                onAction={canWrite ? () => setParentPickerOpen(true) : undefined}
                icon={Shield}
              />
              <EmptyHint
                text="也可以保留为独立势力带上的组织"
                actionLabel={canWrite ? '保留为独立势力' : undefined}
                onAction={canWrite ? () => void handleMarkIndependent() : undefined}
              />
            </div>
          ) : (
            <div className="space-y-0.5">
              {detail.parents.map((parent) => (
                <div key={`${parent.ref.module}-${parent.ref.id}`} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {linkTypeLabel(
                      { link_type: parent.linkType, source: orgRef },
                      orgRef,
                      true
                    )}
                  </span>
                  <LinkChip
                    label={parent.label}
                    tone={parent.ref.kind === 'polity' ? 'gold' : 'red'}
                    onClick={() => onNavigateToEntity(parent.ref)}
                  />
                </div>
              ))}
              {canWrite && detail.parents.length > 0 ? (
                <EmptyHint
                  text="要保留在独立势力带，可标记为独立势力"
                  actionLabel="保留为独立势力"
                  onAction={() => void handleMarkIndependent()}
                />
              ) : null}
            </div>
          )}
          {parentPickerOpen ? (
            <div className="mt-1 text-xs text-muted-foreground">
              已排除自身、自己的下级与现有上级（会成环）；组织树上限 {POLITICS_MAX_ORG_DEPTH} 层，
              挂载后会超过上限的目标不可选（当前子树高度 {parentPicker.subtreeHeight}）。
            </div>
          ) : null}
        </InfoRow>

        {/* 跨国组织额外显示关联政权（§4.3） */}
        {scope === 'cross_polity' ? (
          <InfoRow label="关联政权">
            {crossPolityParents.length === 0 ? (
              <EmptyHint text="跨政权网络尚未挂到具体政权" />
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {crossPolityParents.map((parent) => (
                  <LinkChip
                    key={`${parent.ref.module}-${parent.ref.id}`}
                    label={parent.label}
                    tone="gold"
                    onClick={() => onNavigateToEntity(parent.ref)}
                  />
                ))}
              </div>
            )}
          </InfoRow>
        ) : null}

        <InfoRow label="下辖">
          {detail.children.length === 0 ? (
            <EmptyHint text="暂无下辖组织（组织树最多 3 层）" />
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {detail.children.map((child) => (
                <LinkChip
                  key={child.id}
                  label={child.name}
                  tone="red"
                  onClick={() => onOpenFocus(child.id)}
                />
              ))}
            </div>
          )}
        </InfoRow>

        <InfoRow label="条约">
          {detail.treaties.length === 0 ? (
            <EmptyHint text="还没有缔约记录" />
          ) : (
            <div className="space-y-0.5">
              {detail.treaties.map(({ ribbon }) => (
                <div key={ribbon.treaty.id} className="flex items-center gap-1.5">
                  <Network className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <LinkChip
                    label={ribbon.treaty.name}
                    tone="green"
                    onClick={() => onOpenFocus(ribbon.treaty.id)}
                  />
                  <span className="text-xs text-muted-foreground">
                    缔约方 {ribbon.parties.length}
                  </span>
                </div>
              ))}
            </div>
          )}
        </InfoRow>

        {detail.doctrine.creed ||
        detail.doctrine.recruitment ||
        detail.doctrine.discipline ||
        detail.doctrine.resourceNote ? (
          <InfoRow label="宗旨">
            <div className="space-y-0.5">
              {detail.doctrine.creed ? <div>信条：{detail.doctrine.creed}</div> : null}
              {detail.doctrine.recruitment ? (
                <div className="text-muted-foreground">招募：{detail.doctrine.recruitment}</div>
              ) : null}
              {detail.doctrine.discipline ? (
                <div className="text-muted-foreground">纪律：{detail.doctrine.discipline}</div>
              ) : null}
              {detail.doctrine.resourceNote ? (
                <div className="text-muted-foreground">资源：{detail.doctrine.resourceNote}</div>
              ) : null}
            </div>
          </InfoRow>
        ) : null}

        <NoteRow
          worldId={worldId}
          label="备注"
          value={detail.meta.note}
          onNavigate={onNavigateToEntity}
        />
      </SectionBlock>

      {/* §8.1：速写档只给概览与计数，成员分工整段降级为提示（不是空白区） */}
      {!full ? (
        <SectionBlock id={sectionDomId(entity.id, 'members')} title="成员">
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>成员 {detail.members.length} 人 · 任职带 {detail.tenureBands.length} 条</div>
            <div>速写档只显示成员计数：任职分工与编辑在结构档及以上开放（升级到结构档）。</div>
          </div>
        </SectionBlock>
      ) : (
      <SectionBlock
        id={sectionDomId(entity.id, 'members')}
        title="成员"
        count={detail.members.length}
        actions={
          canWrite ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-medium text-primary transition-colors hover:underline"
            >
              编辑
            </button>
          ) : null
        }
      >
        {detail.members.length === 0 ? (
          <EmptyHint
            text="还没有成员任职（在人物表单里挂 member_of / leads 边）"
            icon={UserRound}
          />
        ) : (
          <div className="space-y-0.5">
            {detail.members.map((figure) => {
              const bands = detail.tenureBands.filter((band) => band.figureId === figure.id);
              return (
                <div key={figure.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent/20">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50">
                      <UserRound className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenFocus(figure.id)}
                      className="min-w-0 truncate text-sm text-foreground transition-colors hover:text-primary"
                    >
                      {figureName(figure)}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {bands.map((band) => band.officeTitle).filter(Boolean).join(' / ') ||
                        figure.meta.identityLabel ||
                        '职位未标注'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeRangeText(bands[0]?.start, bands[0]?.end)}
                    </span>
                    {bands.some((band) => band.isPrimary) ? (
                      <span className={`${chipClass} border-primary/40 text-primary`}>主要</span>
                    ) : null}
                    {bands[0] ? (
                      <button
                        type="button"
                        onClick={() => openEdgeCard(bands[0].edgeId)}
                        className="ml-auto shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
                      >
                        编辑任职
                      </button>
                    ) : null}
                  </div>
                  {editingEdgeId && bands.some((band) => band.edgeId === editingEdgeId) && editingEdge ? (
                    <EdgeCard
                      politics={politics}
                      link={editingEdge}
                      perspective={orgRef}
                      onClose={closeEdgeCard}
                      onNavigateToEntity={onNavigateToEntity}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionBlock>
      )}

      <EntityPicker
        open={parentPickerOpen}
        worldId={worldId}
        source={orgRef}
        presetModule="politics"
        kindFilter={['polity', 'organization']}
        excludeRefs={parentPicker.excludeRefs}
        onClose={() => setParentPickerOpen(false)}
        onConfirm={(selection) => void handleParentConfirm(selection)}
      />
    </div>
  );
};

export default OrganizationPanel;
