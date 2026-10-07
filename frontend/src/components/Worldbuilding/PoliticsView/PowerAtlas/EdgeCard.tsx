/**
 * 关系边卡与失效引用清理 EdgeCard（Phase 4 P4-T6；politics_ui_design §4.7.4/§4.7.5、契约 §5.1）
 *
 * - 悬停摘要：两端 / 类型 / 时间 / 备注（聚合边显示成员数）；
 * - 边卡：时间与备注可就地编辑，沙盘档加强度（写回 WorldLink.time / note / meta，保留 meta 其他键）；
 * - 失效引用（§3.8.7）：状态文字 + 警示 chip + 单条清理与一键清理，删除只针对失效边；
 * - 反向展示用契约 §4.3 的 reverseLabel（edgeLabelFor），不新造关联类型。
 */

import { AlertTriangle, ExternalLink, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { EntityRef } from '@/services/worldbuildingApi';
import type { EntityRefsResult } from '../../hooks';
import type { PoliticsEdgeView, PoliticsTimeSpan, UsePoliticsResult } from '../hooks/politicsTypes';
import { edgeLabelFor, type AtlasEdgeItem } from './atlasLayout';
import { fieldClass, labelClass, sectionTitleClass } from '../tone';
import { useDismissOnEscape } from './atlasHooks';

const formatSpan = (time?: PoliticsTimeSpan): string => {
  if (!time) return '未标注';
  const start = time.start || '?';
  const end = time.end || '今';
  return `${start} - ${end}`;
};

const kindBadgeOf = (ref: EntityRef): string => ref.kind || ref.module;

/* ------------------------------------------------------------------ *
 * 悬停摘要
 * ------------------------------------------------------------------ */

export interface EdgeHoverSummaryProps {
  item: AtlasEdgeItem;
  refs: EntityRefsResult;
  perspectiveId: string | null;
}

export const EdgeHoverSummary = ({ item, refs, perspectiveId }: EdgeHoverSummaryProps) => {
  const label = edgeLabelFor(
    item.label,
    item.linkType,
    item.directed,
    item.from.id,
    item.to.id,
    perspectiveId
  );
  return (
    <div
      data-testid="atlas-edge-hover"
      className="pointer-events-none absolute bottom-2 left-2 z-30 max-w-xs space-y-0.5 rounded-xl border border-border/50 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
    >
      <div className="text-sm font-medium text-foreground">
        {refs.resolveName(item.from)} 至 {refs.resolveName(item.to)}
      </div>
      <div className="text-foreground">
        类型 {label}
        {item.directed && <span className="ml-1 text-muted-foreground">（有向）</span>}
      </div>
      {item.single ? (
        <>
          <div className="text-muted-foreground">时间 {formatSpan(item.single.time)}</div>
          {item.single.note && <div className="text-muted-foreground">备注 {item.single.note}</div>}
        </>
      ) : (
        <div className="text-muted-foreground">聚合 {item.memberIds.length} 条，点击展开边卡</div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 边卡
 * ------------------------------------------------------------------ */

export interface EdgeCardProps {
  item: AtlasEdgeItem;
  /** 聚合边的成员（单条边时只有自身） */
  members: PoliticsEdgeView[];
  refs: EntityRefsResult;
  perspectiveId: string | null;
  showStrength: boolean;
  canEdit: boolean;
  /** 两端都是回填迁移的旧数据：只读展示，不给保存 / 删除入口（§8） */
  legacy?: boolean;
  isSaving: boolean;
  onSelectMember: (member: PoliticsEdgeView) => void;
  onUpdateLink: UsePoliticsResult['updateLink'];
  onDeleteLink: UsePoliticsResult['deleteLink'];
  onFocusEntity: (entityId: string) => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onClose: () => void;
}

export const EdgeCard = ({
  item,
  members,
  refs,
  perspectiveId,
  showStrength,
  canEdit,
  legacy = false,
  isSaving,
  onSelectMember,
  onUpdateLink,
  onDeleteLink,
  onFocusEntity,
  onNavigateToEntity,
  onClose,
}: EdgeCardProps) => {
  useDismissOnEscape(true, onClose);
  const [start, setStart] = useState(item.single?.time?.start ?? '');
  const [end, setEnd] = useState(item.single?.time?.end ?? '');
  const [note, setNote] = useState(item.single?.note ?? '');
  const [strength, setStrength] = useState(
    item.strength !== undefined ? String(item.strength) : ''
  );
  /** 切换聚合成员时同步表单，避免编辑到上一条 */
  useEffect(() => {
    setStart(item.single?.time?.start ?? '');
    setEnd(item.single?.time?.end ?? '');
    setNote(item.single?.note ?? '');
    setStrength(item.strength !== undefined ? String(item.strength) : '');
  }, [item.key, item.single, item.strength]);

  const label = edgeLabelFor(
    item.label,
    item.linkType,
    item.directed,
    item.from.id,
    item.to.id,
    perspectiveId
  );
  const linkId = item.single?.link.id;
  const existingMeta = item.single?.link.meta ?? {};

  const save = async () => {
    if (!linkId) return;
    const parsedStrength = strength.trim() === '' ? undefined : Number(strength);
    await onUpdateLink(linkId, {
      note: note.trim() || undefined,
      time: start.trim() || end.trim() ? { start: start.trim() || undefined, end: end.trim() || undefined } : null,
      meta:
        showStrength && parsedStrength !== undefined && Number.isFinite(parsedStrength)
          ? { ...existingMeta, strength: parsedStrength }
          : existingMeta,
    });
  };

  /** 删除（含失效引用清理）后收起边卡，避免停留在已删除的边上 */
  const remove = async () => {
    if (!linkId) return;
    await onDeleteLink(linkId);
    onClose();
  };

  const counterpart = (ref: EntityRef) => {
    const isPolitics = ref.module === 'politics';
    return (
      <div key={`${ref.kind}:${ref.id}`} className="flex items-center gap-1 text-xs">
        <span className="min-w-0 flex-1 truncate text-foreground">{refs.resolveName(ref)}</span>
        <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {kindBadgeOf(ref)}
        </span>
        {isPolitics && (
          <button
            type="button"
            aria-label={`聚焦 ${refs.resolveName(ref)}`}
            onClick={() => onFocusEntity(ref.id)}
            className="rounded-lg px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary motion-reduce:transition-none"
          >
            聚焦
          </button>
        )}
        <button
          type="button"
          aria-label={`跳转到 ${refs.resolveName(ref)}`}
          onClick={() => onNavigateToEntity(ref)}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary motion-reduce:transition-none"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label={`关系边卡 ${label}`}
      data-testid="atlas-edge-card"
      className="absolute bottom-2 right-2 z-40 w-80 space-y-2 rounded-2xl border border-border/50 bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5">
        <span className={sectionTitleClass}>关系 · {label}</span>
        <span className="text-[10px] text-muted-foreground">{item.linkType}</span>
        {legacy && (
          <span
            className="rounded-full border border-dashed border-slate-500/50 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300"
            data-testid="atlas-legacy-badge"
            title="回填迁移写入的旧数据：只读"
          >
            旧数据
          </span>
        )}
        <button
          type="button"
          aria-label="关闭边卡"
          onClick={onClose}
          className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1 border-t border-border/30 pt-2">
        {counterpart(item.from)}
        {item.directed && <div className="pl-2 text-xs text-muted-foreground">方向：上为源，下为目标</div>}
        {counterpart(item.to)}
      </div>

      {item.dangling && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive"
          data-testid="atlas-dangling-notice"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          失效引用：目标实体已不存在
          {canEdit && !legacy && linkId && (
            <button
              type="button"
              onClick={() => void remove()}
              className="ml-auto rounded-lg border border-destructive/40 px-2 py-0.5 text-xs"
            >
              清理
            </button>
          )}
        </div>
      )}

      {members.length > 1 && (
        <div className="space-y-1 border-t border-border/30 pt-2">
          <div className={labelClass}>聚合 {members.length} 条同类边</div>
          <div className="max-h-28 space-y-0.5 overflow-y-auto">
            {members.map((member) => (
              <button
                key={member.link.id}
                type="button"
                onClick={() => onSelectMember(member)}
                className={`flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-accent/20 motion-reduce:transition-none ${
                  member.link.id === linkId ? 'text-primary' : 'text-foreground'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {refs.resolveName(member.from)} 至 {refs.resolveName(member.to)}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatSpan(member.time)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {item.single ? (
        <div className="space-y-2 border-t border-border/30 pt-2">
          <div className="flex items-center gap-1.5">
            <label className="flex-1 space-y-0.5">
              <span className={labelClass}>起始</span>
              <input
                value={start}
                aria-label="关系起始时间"
                placeholder="如 1200-01-01"
                onChange={(event) => setStart(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex-1 space-y-0.5">
              <span className={labelClass}>结束</span>
              <input
                value={end}
                aria-label="关系结束时间"
                placeholder="留空表示至今"
                onChange={(event) => setEnd(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block space-y-0.5">
            <span className={labelClass}>备注</span>
            <textarea
              value={note}
              aria-label="关系备注"
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              className={fieldClass}
            />
          </label>
          {showStrength && (
            <label className="block space-y-0.5">
              <span className={labelClass}>强度（沙盘档映射线宽）</span>
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={strength}
                aria-label="关系强度"
                onChange={(event) => setStrength(event.target.value)}
                className={fieldClass}
              />
            </label>
          )}
          {canEdit && !legacy ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void save()}
                className="rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                aria-label="删除这条关系"
                onClick={() => void remove()}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                删除
              </button>
            </div>
          ) : legacy ? (
            <div className={labelClass} data-testid="atlas-legacy-readonly">
              旧数据（回填迁移）：只能查看，编辑请先在数据清洗后重存。
            </div>
          ) : null}
        </div>
      ) : (
        <div className={labelClass}>选择一条成员边后可编辑时间、备注与强度。</div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 失效引用清单（§3.8.7 一键清理）
 * ------------------------------------------------------------------ */

export interface DanglingEdgeChipsProps {
  items: AtlasEdgeItem[];
  refs: EntityRefsResult;
  canEdit: boolean;
  onSelect: (item: AtlasEdgeItem) => void;
  onDeleteAll: () => void;
}

export const DanglingEdgeChips = ({
  items,
  refs,
  canEdit,
  onSelect,
  onDeleteAll,
}: DanglingEdgeChipsProps) => {
  if (items.length === 0) return null;
  return (
    <div
      data-testid="atlas-dangling-chips"
      className="absolute left-1/2 top-2 z-30 flex max-w-md -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-dashed border-destructive/50 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
    >
      <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
      <span className="text-destructive">失效引用 {items.length}</span>
      {items.slice(0, 4).map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item)}
          className="rounded-full border border-destructive/40 px-2.5 py-1 text-destructive transition-colors hover:bg-destructive/10 motion-reduce:transition-none"
        >
          {item.label} · {refs.resolveName(item.from)}
        </button>
      ))}
      {items.length > 4 && <span className="text-muted-foreground">等 {items.length} 条</span>}
      {canEdit && (
        <button
          type="button"
          onClick={onDeleteAll}
          className="ml-auto rounded-lg border border-destructive/40 px-2.5 py-1 text-destructive transition-colors hover:bg-destructive/10 motion-reduce:transition-none"
        >
          一键清理
        </button>
      )}
    </div>
  );
};

export default EdgeCard;
