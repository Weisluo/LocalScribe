/**
 * 聚焦详情面板（Phase 4 P4-T8；politics_ui_design §4.3/§4.8/§6）
 *
 * 面板只消费 politics 数据层：按 detailOf 分派到四类分段结构，底部统一挂 common/LinkPanel
 * （不新建政治专属 LinkPanel）；固定后可继续浏览画布，最多 3 个（§5.5.2）。
 * 内部浮层（边卡）开关回传给抽屉，保证 Esc 先收浮层再关面板（§5.1.4）。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { SearchX } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { LinkPanel } from '@/components/common/LinkPanel';
import { InlineReference } from '@/components/common/InlineReference';
import { kindDefOf, levelLabelOf, statusLabelOf } from '../../shared/moduleConfig';
import type {
  FigureEntity,
  OrganizationEntity,
  PoliticsEntity,
  PolityEntity,
  TreatyEntity,
  UsePoliticsResult,
} from '../hooks';
import {
  POLITICS_BUILTIN_KINDS,
  isTerminalStatus,
  politicsRefOf,
} from '../types';
import { DeleteEntityModal } from '../modals/DeleteEntityModal';
import { FocusDrawer } from './FocusDrawer';
import { PolitySections } from './PolitySections';
import { OrganizationPanel } from './OrganizationPanel';
import { FigurePanel } from './FigurePanel';
import { TreatyPanel } from './TreatyPanel';
import { sectionDomId } from './sectionUtils';
import { InfoRow, SectionBlock } from './sectionParts';

export interface FocusPanelProps {
  politics: UsePoliticsResult;
  worldId: string;
  entity: PoliticsEntity;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onOpenTreatyBook: () => void;
  onOpenFocus: (entityId: string) => void;
  onDelete: (entityId: string) => Promise<void>;
  onEdit: (entity: PoliticsEntity) => void;
  /** 段内空态的「清除筛选」入口：筛选状态在壳里（§9.2） */
  onResetFilter: () => void;
}

export const FocusPanel = ({
  politics,
  worldId,
  entity,
  pinned,
  onTogglePin,
  onClose,
  onNavigateToEntity,
  onOpenTreatyBook,
  onOpenFocus,
  onDelete,
  onEdit,
  onResetFilter,
}: FocusPanelProps) => {
  /** 边卡等内部浮层的关闭动作：抽屉的 Esc 分层读它 */
  const [overlayClose, setOverlayClose] = useState<(() => void) | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const overlayCloseRef = useRef<(() => void) | null>(null);
  overlayCloseRef.current = overlayClose;
  const handleOverlay = useCallback((close: (() => void) | null) => {
    setOverlayClose(() => close);
  }, []);
  /** 稳定的回调：避免抽屉的捕获监听每次渲染都重挂 */
  const handleCloseOverlay = useCallback(() => {
    overlayCloseRef.current?.();
  }, []);

  const detail = politics.detailOf(entity.id);
  const entityRef = politicsRefOf(entity.id, entity.kind);
  const kindDef = kindDefOf(politics.config, entity.kind, POLITICS_BUILTIN_KINDS);
  const counts = politics.countsOf(entityRef);
  const meta = detail?.view.meta;

  // 人物标题用实时解析的角色名（§6.6.1）；未绑定时退回政治记录名以便识别
  const title =
    detail?.kind === 'figure'
      ? detail.view.character?.name ?? entity.name
      : entity.name;

  // 六段锚点只在结构档成立：速写档（fullDetail=false）没有机构 / 人物 / 关系 / 条约 / 沿革分段
  const anchors = useMemo(
    () =>
      detail?.kind === 'polity' && politics.capabilities.fullDetail
        ? [
            { id: sectionDomId(entity.id, 'overview'), label: '概览' },
            { id: sectionDomId(entity.id, 'organizations'), label: '机构' },
            { id: sectionDomId(entity.id, 'figures'), label: '人物' },
            { id: sectionDomId(entity.id, 'relations'), label: '关系' },
            { id: sectionDomId(entity.id, 'treaties'), label: '条约' },
            { id: sectionDomId(entity.id, 'chronicle'), label: '沿革' },
          ]
        : undefined,
    [detail?.kind, entity.id, politics.capabilities.fullDetail]
  );

  return (
    <>
      <FocusDrawer
        kind={detail?.kind ?? entity.kind}
        title={title}
        icon={kindDef?.icon}
        tone={kindDef?.color}
        levelLabel={levelLabelOf(politics.config, meta?.level)}
        statusLabel={statusLabelOf(politics.config, meta?.status)}
        terminal={isTerminalStatus(meta?.status, politics.statuses)}
        counts={counts}
        pinned={pinned}
        onTogglePin={onTogglePin}
        onClose={onClose}
        anchors={anchors}
        onEdit={() => onEdit(entity)}
        onDelete={() => setDeleteOpen(true)}
        overlayOpen={overlayClose !== null}
        onCloseOverlay={handleCloseOverlay}
      >
        {detail === undefined ? (
          <div className="space-y-3 px-5 py-8 text-center" data-testid="focus-missing">
            <SearchX className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <div className="text-sm font-medium text-foreground">该实体不在当前筛选结果中</div>
            <p className="text-xs text-muted-foreground">
              它可能已被删除，或被层级 / 等级 / 状态筛选排除。
            </p>
            <button
              type="button"
              onClick={onResetFilter}
              className="rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
            >
              清除筛选
            </button>
          </div>
        ) : (
          <>
            {detail.kind === 'polity' ? (
              <PolitySections
                politics={politics}
                entity={entity as PolityEntity}
                detail={detail.view}
                worldId={worldId}
                onNavigateToEntity={onNavigateToEntity}
                onOpenFocus={onOpenFocus}
                onOpenTreatyBook={onOpenTreatyBook}
                onEdit={() => onEdit(entity)}
                onOverlay={handleOverlay}
              />
            ) : null}
            {detail.kind === 'organization' ? (
              <OrganizationPanel
                politics={politics}
                entity={entity as OrganizationEntity}
                detail={detail.view}
                worldId={worldId}
                onNavigateToEntity={onNavigateToEntity}
                onOpenFocus={onOpenFocus}
                onEdit={() => onEdit(entity)}
                onOverlay={handleOverlay}
              />
            ) : null}
            {detail.kind === 'figure' ? (
              <FigurePanel
                politics={politics}
                entity={entity as FigureEntity}
                detail={detail.view}
                worldId={worldId}
                onNavigateToEntity={onNavigateToEntity}
                onEdit={() => onEdit(entity)}
                onOverlay={handleOverlay}
              />
            ) : null}
            {detail.kind === 'treaty' ? (
              <TreatyPanel
                politics={politics}
                entity={entity as TreatyEntity}
                detail={detail.view}
                worldId={worldId}
                onNavigateToEntity={onNavigateToEntity}
                onEdit={() => onEdit(entity)}
              />
            ) : null}
            {/*
              未归入四形态的实体（未登记 custom kind / 旧 generic 数据）：
              只读基础面板 + 统一的 common/LinkPanel，绝不冒充条约面板（§3.6/§7.1.2）。
            */}
            {detail.kind === 'unknown' ? (
              <SectionBlock id={sectionDomId(entity.id, 'overview')} title="概览">
                <InfoRow label="类型">
                  <span className="text-muted-foreground">
                    {kindDef?.label ?? entity.kind}（未归入政权 / 组织 / 人物 / 条约形态，只读）
                  </span>
                </InfoRow>
                {entity.description ? (
                  <InfoRow label="描述">
                    <InlineReference
                      value={entity.description}
                      readOnly
                      worldId={worldId}
                      onNavigate={onNavigateToEntity}
                      placeholder="未填写"
                    />
                  </InfoRow>
                ) : null}
                <InfoRow label="等级">
                  {meta?.level ? (
                    levelLabelOf(politics.config, meta.level)
                  ) : (
                    <span className="text-muted-foreground">未标注</span>
                  )}
                </InfoRow>
                <InfoRow label="状态">
                  {meta?.status ? (
                    statusLabelOf(politics.config, meta.status)
                  ) : (
                    <span className="text-muted-foreground">未标注</span>
                  )}
                </InfoRow>
                <InfoRow label="时间">
                  <span className="text-muted-foreground">
                    {[meta?.time?.start, meta?.time?.end].filter(Boolean).join(' ~ ') || '未标注'}
                  </span>
                </InfoRow>
                {meta?.note ? (
                  <InfoRow label="备注">
                    <InlineReference
                      value={meta.note}
                      readOnly
                      worldId={worldId}
                      onNavigate={onNavigateToEntity}
                      placeholder="未填写"
                    />
                  </InfoRow>
                ) : null}
                <div className="pt-1 text-xs text-muted-foreground">
                  关联 出 {detail.view.counts.out} / 入 {detail.view.counts.in}：该类型的字段面板尚未开放。
                </div>
              </SectionBlock>
            ) : null}
          </>
        )}

        {/* 四类详情底部的统一关联区（契约 §5.1 / 设计 §4.8），不新建政治专属面板 */}
        <div className="border-t border-border/30 px-5 py-4">
          <LinkPanel
            worldId={worldId}
            entity={entityRef}
            complexity={politics.complexity}
            onNavigate={onNavigateToEntity}
            title="关联"
          />
        </div>
      </FocusDrawer>

      <DeleteEntityModal
        open={deleteOpen}
        politics={politics}
        entity={entity}
        onClose={() => setDeleteOpen(false)}
        onConfirmDelete={onDelete}
      />
    </>
  );
};

export default FocusPanel;
