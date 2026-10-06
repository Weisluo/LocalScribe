/**
 * 人物详情（Phase 4 P4-T8；politics_ui_design §4.3/§6.4/§6.5/§6.6）
 *
 * 身份卡 / 任职带 / 关联（关联区由 index.tsx 统一挂 common/LinkPanel）。
 * 身份卡第一行是全局角色档案入口：姓名、种族与体系摘要全部实时解析，政治侧不复制
 * 姓名 / 头像 / 种族 / 生平（§6.6.1）；未绑定时给警示与重新绑定入口，不阻塞其他内容。
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import type { FigureDetailView, UsePoliticsResult } from '../hooks';
import { politicsRefOf, type FigureEntity } from '../types';
import { chipClass } from '../tone';
import { EdgeCard } from './EdgeCard';
import { EmptyHint, InfoRow, LinkChip, NoteRow, SectionBlock } from './sectionParts';
import { sectionDomId, timeRangeText } from './sectionUtils';

/** 角色侧的种族 / 体系佐证关联（§6.4.3、§6.5.2）：只读取名称做摘要，不改角色数据 */
const CHARACTER_SUMMARY_LINKS: { id: string; label: string; tone: string }[] = [
  { id: 'character.belongs_to_race', label: '种族', tone: 'teal' },
  { id: 'character.practices_system', label: '体系', tone: 'violet' },
  { id: 'character.attained', label: '境界', tone: 'violet' },
];

export interface FigurePanelProps {
  politics: UsePoliticsResult;
  entity: FigureEntity;
  detail: FigureDetailView;
  worldId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  onEdit: () => void;
  onOverlay: (close: (() => void) | null) => void;
}

export const FigurePanel = ({
  politics,
  entity,
  detail,
  worldId,
  onNavigateToEntity,
  onEdit,
  onOverlay,
}: FigurePanelProps) => {
  const figureRef = politicsRefOf(entity.id, entity.kind);
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  const characterId = detail.meta.characterId;
  const characterRef: EntityRef | null = characterId
    ? { module: 'character', kind: 'character', id: characterId }
    : null;

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

  const summaries =
    characterRef === null
      ? []
      : politics.links
          .filter(
            (link) =>
              link.source.module === 'character' &&
              link.source.id === characterRef.id &&
              CHARACTER_SUMMARY_LINKS.some((def) => def.id === link.link_type)
          )
          .map((link) => ({
            link,
            def: CHARACTER_SUMMARY_LINKS.find((item) => item.id === link.link_type),
          }));

  const handleCharacterConfirm = async (selection: EntityPickerSelection) => {
    const target = selection.targets[0];
    if (!target) return;
    try {
      await politics.updateMetaMerged(entity.id, { characterId: target.id });
      setCharacterPickerOpen(false);
      toast.success('已绑定全局角色');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '角色绑定失败');
    }
  };

  const identity = detail.identity;
  /** §8.1：速写档保留身份卡概览与计数，任职带明细降级为提示 */
  const full = politics.capabilities.fullDetail;
  const canWrite = politics.canWriteEntities;

  return (
    <div data-testid="figure-panel">
      <SectionBlock
        id={sectionDomId(entity.id, 'identity')}
        title="身份卡"
        actions={
          <button
            type="button"
            onClick={onEdit}
            className="text-[10px] text-primary transition-colors hover:underline"
          >
            编辑
          </button>
        }
      >
        {detail.character ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <button
                type="button"
                onClick={() => characterRef && onNavigateToEntity(characterRef)}
                className="min-w-0 truncate text-xs font-medium text-foreground transition-colors hover:text-primary"
              >
                {detail.character.name}
              </button>
              <span className={`${chipClass} border-border/60 text-muted-foreground`}>
                {detail.character.moduleName}
              </span>
              <button
                type="button"
                onClick={() => characterRef && onNavigateToEntity(characterRef)}
                data-testid="figure-open-character"
                className="ml-auto text-[10px] text-primary transition-colors hover:underline"
              >
                打开角色档案
              </button>
            </div>
            {summaries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {summaries.map(({ link, def }) => (
                  <LinkChip
                    key={link.id}
                    label={`${def?.label ?? '关联'} ${politics.refs.resolveName(link.target)}`}
                    tone={def?.tone}
                    onClick={() => onNavigateToEntity(link.target)}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                种族 / 体系摘要在角色模块维护，政治侧只读取名称
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              该政治人物尚未绑定全局角色
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCharacterPickerOpen(true)}
                className="rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
              >
                绑定角色
              </button>
              <span className="text-[10px] text-muted-foreground">
                其余政治身份与任职仍可正常维护
              </span>
            </div>
          </div>
        )}

        <InfoRow label="政治身份">
          <div className="flex flex-wrap items-center gap-1.5">
            {detail.meta.identityLabel ? (
              <span className={`${chipClass} border-border/60 text-foreground`}>
                {detail.meta.identityLabel}
              </span>
            ) : null}
            {detail.meta.courtRank ? (
              <span className="text-muted-foreground">朝位 {detail.meta.courtRank}</span>
            ) : null}
            {detail.meta.factionLabel ? (
              <span className="text-muted-foreground">派系 {detail.meta.factionLabel}</span>
            ) : null}
            {!detail.meta.identityLabel && !detail.meta.courtRank && !detail.meta.factionLabel ? (
              <EmptyHint text="还没有政治身份标注" actionLabel="补充" onAction={onEdit} />
            ) : null}
          </div>
        </InfoRow>

        {identity.aliases && identity.aliases.length > 0 ? (
          <InfoRow label="政治别名">
            <div className="flex flex-wrap items-center gap-1.5">
              {identity.aliases.map((alias) => (
                <span key={alias} className={`${chipClass} border-border/60 text-muted-foreground`}>
                  {alias}
                </span>
              ))}
            </div>
          </InfoRow>
        ) : null}

        {identity.publicStanding ? (
          <InfoRow label="公开立场">{identity.publicStanding}</InfoRow>
        ) : null}
        {identity.factionNote ? (
          <InfoRow label="派系说明">{identity.factionNote}</InfoRow>
        ) : null}
        {identity.privateNote ? (
          <InfoRow label="私下备注">{identity.privateNote}</InfoRow>
        ) : null}
        <NoteRow
          worldId={worldId}
          label="备注"
          value={detail.meta.note}
          onNavigate={onNavigateToEntity}
        />
      </SectionBlock>

      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'tenure')}
          title="任职带"
          count={detail.offices.length}
          actions={
            canWrite ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-[10px] text-primary transition-colors hover:underline"
              >
                添加任职
              </button>
            ) : null
          }
        >
        {detail.offices.length === 0 ? (
          <EmptyHint
            text="还没有任职（任职即 leads / member_of 边）"
            actionLabel={canWrite ? '添加任职' : undefined}
            onAction={canWrite ? onEdit : undefined}
            icon={Users}
          />
        ) : (
          <div className="space-y-1">
            {detail.offices.map((office) => (
              <div key={office.band.edgeId} className="space-y-1">
                <button
                  type="button"
                  onClick={() => openEdgeCard(office.band.edgeId)}
                  className="flex w-full flex-wrap items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent/30"
                >
                  <span className="text-[11px] text-foreground">
                    {office.band.officeTitle || '职位未标注'}
                  </span>
                  {office.ref ? (
                    <span className="text-[10px] text-muted-foreground">{office.label}</span>
                  ) : (
                    <span className="text-[10px] text-destructive">{office.label}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {timeRangeText(office.band.start, office.band.end)}
                  </span>
                  {office.band.isPrimary ? (
                    <span className={`${chipClass} border-primary/40 text-primary`}>主要</span>
                  ) : null}
                  <span className="ml-auto text-[10px] text-primary">编辑边</span>
                </button>
                {editingEdgeId === office.band.edgeId && editingEdge ? (
                  <EdgeCard
                    politics={politics}
                    link={editingEdge}
                    perspective={figureRef}
                    onClose={closeEdgeCard}
                    onNavigateToEntity={onNavigateToEntity}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
        {detail.offices.length > 0 ? (
          <div className="flex items-center gap-1 px-1 pt-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            任职区间与职位存在边上，编辑边即编辑任期（§3.8.2）
          </div>
        ) : null}
      </SectionBlock>
      ) : (
        <SectionBlock id={sectionDomId(entity.id, 'tenure')} title="任职带">
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            <div>任职 {detail.offices.length} 条</div>
            <div>速写档只显示任职计数：职位与任期明细在结构档及以上开放（升级到结构档）。</div>
          </div>
        </SectionBlock>
      )}

      <EntityPicker
        open={characterPickerOpen}
        worldId={worldId}
        source={figureRef}
        presetModule="character"
        kindFilter={['character']}
        simpleMode
        onClose={() => setCharacterPickerOpen(false)}
        onConfirm={(selection) => void handleCharacterConfirm(selection)}
      />
    </div>
  );
};

export default FigurePanel;
