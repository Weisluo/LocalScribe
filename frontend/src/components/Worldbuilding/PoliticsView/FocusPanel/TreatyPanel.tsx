/**
 * 条约详情四段（Phase 4 P4-T8；politics_ui_design §4.3/§4.6/§5.3）
 *
 * 缔约方 / 条款 / 修订与履行 / 关联（关联区由 index.tsx 统一挂 common/LinkPanel）。
 * 缔约方来自 signatory_of 投影（不重复存边）；违约 / 中止显示 breachState 文本 + 警示描边，
 * 单缔约方给旌旗提示。颜色不单独承载语义，状态始终带文字（§4.6.5）。
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Flag, ScrollText } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import type { TreatyDetailView, UsePoliticsResult } from '../hooks';
import { TREATY_STATUS_LABELS, type TreatyEntity } from '../types';
import { chipClass } from '../tone';
import { EmptyHint, InfoRow, LinkChip, NoteRow, SectionBlock } from './sectionParts';
import { sectionDomId, timeRangeText } from './sectionUtils';

export interface TreatyPanelProps {
  politics: UsePoliticsResult;
  entity: TreatyEntity;
  detail: TreatyDetailView;
  worldId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  onEdit: () => void;
}

export const TreatyPanel = ({
  politics,
  entity,
  detail,
  worldId,
  onNavigateToEntity,
  onEdit,
}: TreatyPanelProps) => {
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const breached = !!detail.meta.breachState && detail.meta.breachState.trim().length > 0;
  /** §8.1：速写档保留概览（类型 / 生效 / 状态 / 缔约方计数），条款与修订降级为计数 + 提示 */
  const full = politics.capabilities.fullDetail;
  const canWrite = politics.canWriteEntities;

  return (
    <div data-testid="treaty-panel">
      <SectionBlock
        id={sectionDomId(entity.id, 'parties')}
        title="缔约方"
        count={detail.parties.length}
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
        <div className="space-y-0.5">
          <InfoRow label="类型">
            {detail.meta.treatyTypeId || <span className="text-muted-foreground">用户自定义</span>}
          </InfoRow>
          <InfoRow label="生效">
            {timeRangeText(detail.meta.effectiveAt, detail.meta.expiresAt) || (
              <span className="text-muted-foreground">未标注</span>
            )}
          </InfoRow>
          <InfoRow label="状态">
            <span className="text-foreground">{TREATY_STATUS_LABELS[detail.status]}</span>
            {detail.meta.visibility ? (
              <span className="text-muted-foreground"> · 可见性 {detail.meta.visibility}</span>
            ) : null}
          </InfoRow>
          {detail.meta.summary ? (
            <NoteRow
              worldId={worldId}
              label="摘要"
              value={detail.meta.summary}
              onNavigate={onNavigateToEntity}
            />
          ) : null}
        </div>

        <div className="mt-1 space-y-0.5 border-t border-border/30 pt-2">
          {detail.parties.length === 0 ? (
            <EmptyHint
              text="条约没有缔约方（≥ 2 才画缎带）"
              actionLabel={canWrite ? '添加缔约方' : undefined}
              onAction={canWrite ? onEdit : undefined}
            />
          ) : (
            detail.parties.map((party) => (
              <div
                key={`${party.ref.module}-${party.ref.kind}-${party.ref.id}`}
                className="flex flex-wrap items-center gap-1.5"
              >
                <ScrollText
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <LinkChip
                  label={party.label}
                  tone="green"
                  onClick={() => onNavigateToEntity(party.ref)}
                />
                {party.role ? (
                  <span className="text-xs text-muted-foreground">{party.role}</span>
                ) : null}
                {party.signedAt ? (
                  <span className="text-xs text-muted-foreground">{party.signedAt} 签署</span>
                ) : null}
              </div>
            ))
          )}
          {detail.singleParty ? (
            <div className="flex items-center gap-1.5 pt-1.5 text-xs text-muted-foreground">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              单缔约方：画布上以该节点旌旗呈现，不画缎带（§4.6.1）
            </div>
          ) : null}
          <NoteRow
            worldId={worldId}
            label="备注"
            value={detail.meta.note}
            onNavigate={onNavigateToEntity}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        id={sectionDomId(entity.id, 'terms')}
        title="条款"
        count={detail.terms.length}
        actions={
          canWrite && full ? (
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
        {!full ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>条款 {detail.terms.length} 条</div>
            <div>速写档只显示条款计数：条款明细在结构档及以上开放（升级到结构档）。</div>
          </div>
        ) : detail.terms.length === 0 ? (
          <EmptyHint text="还没有条款，创建后在缎带中点补充" icon={ScrollText} />
        ) : (
          <div className="space-y-1">
            {detail.terms.map((term) => {
              const expanded = expandedTermId === term.id;
              return (
                <div key={term.id} className="rounded-lg px-2 py-1 hover:bg-accent/20">
                  <button
                    type="button"
                    onClick={() => setExpandedTermId(expanded ? null : term.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="text-sm text-foreground">
                      {term.order}. {term.title}
                    </span>
                    {term.binding ? (
                      <span className={`${chipClass} border-border/60 text-foreground`}>强制</span>
                    ) : null}
                    {term.secret ? (
                      <span className={`${chipClass} border-border/60 text-muted-foreground`}>密约</span>
                    ) : null}
                  </button>
                  {!expanded && term.content ? (
                    <div className="pl-5 text-xs text-muted-foreground">{term.content}</div>
                  ) : null}
                  {expanded && term.content ? (
                    <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/10 p-2 text-xs leading-relaxed text-foreground">
                      {term.content}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        id={sectionDomId(entity.id, 'amendments')}
        title="修订与履行"
        count={detail.amendments.length}
      >
        <div
          className={`space-y-2 rounded-xl border p-3 ${
            breached ? 'border-destructive/60 bg-destructive/10' : 'border-border/50 bg-muted/10'
          }`}
        >
          <div className="flex items-start gap-1.5 text-sm">
            {breached ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            ) : null}
            <span className={breached ? 'text-destructive' : 'text-foreground'}>
              履行状态：{TREATY_STATUS_LABELS[detail.status]}
            </span>
          </div>
          {breached ? (
            <div className="text-xs text-destructive">违约 / 中止：{detail.meta.breachState}</div>
          ) : (
            <div className="text-xs text-muted-foreground">
              未标注违约；到期或终端状态由状态定义与 expiresAt 推导（§4.6.5）
            </div>
          )}
        </div>

        <div className="mt-2 space-y-1">
          {!full ? (
            <div className="text-sm text-muted-foreground">
              修订 {detail.amendments.length} 条 · 速写档只显示计数，明细在结构档及以上开放（升级到结构档）。
            </div>
          ) : detail.amendments.length === 0 ? (
            <EmptyHint text="还没有修订记录" />
          ) : (
            detail.amendments.map((amendment) => (
              <div key={amendment.id} className="flex items-start gap-1.5 px-2 py-1">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {timeRangeText(amendment.time?.start, amendment.time?.end) || '未标时间'}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-foreground">
                    {amendment.order}. {amendment.title}
                  </span>
                  {amendment.kindId ? (
                    <span className={`${chipClass} ml-1.5 border-border/60 text-muted-foreground`}>
                      {amendment.kindId}
                    </span>
                  ) : null}
                  {amendment.content ? (
                    <div className="text-xs text-muted-foreground">{amendment.content}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {politics.capabilities.timeline ? (
          <div className="mt-2 text-xs text-muted-foreground">
            沙盘档可叠加有效期缎带与时点快照（§5.6）
          </div>
        ) : null}
      </SectionBlock>
    </div>
  );
};

export default TreatyPanel;
