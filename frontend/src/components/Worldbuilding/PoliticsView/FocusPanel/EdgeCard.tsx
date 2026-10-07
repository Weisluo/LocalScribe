/**
 * 边卡 EdgeCard（Phase 4 P4-T8；politics_ui_design §5.3/§5.4/§6.9）
 *
 * 点击关系边 / 任职带后的卡片：两端、关联类型、时间、备注、强度（沙盘）。
 * 时间与备注行内可改（politics.updateLink）；删除二次确认并列出影响范围，
 * 删除后给 5 秒撤销 toast（§5.4 第 5 条），跨实体删除不进撤销栈。
 */

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { EntityBadge } from '@/components/common/EntityBadge';
import { InlineReference } from '@/components/common/InlineReference';
import { useWorld } from '@/components/Worldbuilding/hooks';
import { moduleLabel, sameRef } from '@/components/Worldbuilding/types';
import type { UsePoliticsResult } from '../hooks';
import { chipClass, fieldClass, labelClass } from '../tone';
import { POLITICS_LINK_TYPES, TENURE_LINK_TYPES } from '../types';
import { linkTypeLabel } from './linkLabels';
import { InfoRow } from './sectionParts';
import { timeSpanOf } from './sectionUtils';

export interface EdgeCardProps {
  politics: UsePoliticsResult;
  link: WorldLink;
  /** 打开边卡时所在的实体：决定类型文案的正 / 反向与对端显示 */
  perspective: EntityRef;
  onClose: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
}

const readStrength = (link: WorldLink): number | undefined => {
  const raw = link.meta?.strength;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
};

/**
 * 撤销前的方向合法性复核：契约 §4.3 的「人物 -> 政权 / 组织」任职边有向且不可反转，
 * 其余类型至少要求两端都是政治实体。不合法就报告，绝不写入翻转后的边。
 */
const undoDirectionIssue = (link: WorldLink): string | null => {
  const { source, target } = link;
  if (TENURE_LINK_TYPES.includes(link.link_type)) {
    if (source.kind !== 'figure' || target.kind === 'figure') {
      return '任职边只能是「人物 -> 政权 / 组织」方向，反转后的边无法重建';
    }
  }
  if (link.link_type === POLITICS_LINK_TYPES.signatoryOf) {
    if (source.kind === 'treaty' || target.kind !== 'treaty') {
      return '缔约边只能是「政权 / 组织 -> 条约」方向，反转后的边无法重建';
    }
  }
  if (source.module !== 'politics' || target.module !== 'politics') {
    return '该边一端已不在政治模块内，无法按原方向重建';
  }
  return null;
};

export const EdgeCard = ({
  politics,
  link,
  perspective,
  onClose,
  onNavigateToEntity,
}: EdgeCardProps) => {
  const [note, setNote] = useState(link.note ?? '');
  const [start, setStart] = useState(link.time?.start ?? '');
  const [end, setEnd] = useState(link.time?.end ?? '');
  const [strength, setStrength] = useState<string>(
    readStrength(link) === undefined ? '' : String(readStrength(link))
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const outgoing = sameRef(link.source, perspective);
  const other = outgoing ? link.source : link.target;
  const typeLabel = linkTypeLabel(link, perspective, outgoing);
  const strengthEnabled = politics.capabilities.relationStrength;
  // 行内引用的角色解析需要 projectId：与 useEntityRefs 同一 queryKey，不额外请求
  const projectId = useWorld(politics.worldId, { includeItems: true }).data?.project_id;

  const handleSave = async () => {
    setBusy(true);
    try {
      const hasTime = !!start.trim() || !!end.trim();
      const nextStrength = strength.trim() === '' ? undefined : Number(strength);
      await politics.updateLink(link.id, {
        // 空备注必须显式发 null：axios 会丢掉 undefined 的键，后端就会保留旧值
        note: note.trim() || null,
        time: hasTime ? { start: start.trim() || undefined, end: end.trim() || undefined } : null,
        meta: strengthEnabled
          ? { ...(link.meta ?? {}), strength: Number.isFinite(nextStrength) ? nextStrength : undefined }
          : undefined,
      });
      toast.success('关联已更新');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联更新失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await politics.deleteLink(link.id);
      toast('已删除关联', {
        description: `${typeLabel}：${politics.refs.resolveName(link.source)}${
          link.directed ? ' 指向 ' : ' 与 '
        }${politics.refs.resolveName(link.target)}`,
        duration: 5000,
        action: {
          label: '撤销',
          onClick: () => {
            // 撤销必须按原始端点和原始载荷重建：曾经用 counterpart 当 target 重建，
            // 入链（如 polity -> polity 的 vassal_of、figure -> polity 的 leads）会被写反。
            const issue = undoDirectionIssue(link);
            if (issue) {
              toast.error('无法撤销：原方向不再合法', { description: issue });
              return;
            }
            void politics
              .createLinks(
                [
                  {
                    linkType: link.link_type,
                    target: outgoing ? link.target : link.source,
                    label: link.label ?? undefined,
                    note: link.note ?? undefined,
                    time: timeSpanOf(link.time),
                    meta: link.meta ?? undefined,
                  },
                ],
                outgoing ? link.source : link.target
              )
              .then(() => toast.success('已恢复关联'))
              .catch(() => toast.error('撤销失败'));
          },
        },
      });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3 shadow-sm"
      data-testid="politics-edge-card"
    >
      <div className="flex items-center gap-1.5">
        <span className={`${chipClass} border-border/60 text-foreground`}>{typeLabel}</span>
        <span className="text-xs text-muted-foreground">{moduleLabel(other.module)}</span>
        <span className="ml-auto text-xs text-muted-foreground">{link.link_type}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <EntityBadge
          entityRef={link.source}
          name={politics.refs.resolveName(link.source)}
          invalid={politics.refs.isInvalid(link.source)}
          onClick={onNavigateToEntity}
        />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <EntityBadge
          entityRef={link.target}
          name={politics.refs.resolveName(link.target)}
          invalid={politics.refs.isInvalid(link.target)}
          onClick={onNavigateToEntity}
        />
      </div>

      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <span className={labelClass}>备注（输入 @ 可插入行内引用）</span>
          <InlineReference
            value={note}
            onChange={setNote}
            worldId={politics.worldId}
            projectId={projectId ?? undefined}
            placeholder="可选（支持 @ 行内引用）"
            onNavigate={onNavigateToEntity}
          />
        </div>
        <div className="flex gap-2">
          <label className="flex-1 space-y-0.5">
            <span className={labelClass}>起始</span>
            <input
              type="text"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              placeholder="可选"
              aria-label="关联起始时间"
              className={fieldClass}
            />
          </label>
          <label className="flex-1 space-y-0.5">
            <span className={labelClass}>结束</span>
            <input
              type="text"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              placeholder="可选"
              aria-label="关联结束时间"
              className={fieldClass}
            />
          </label>
        </div>
        {strengthEnabled ? (
          <label className="block space-y-0.5">
            <span className={labelClass}>强度（沙盘）</span>
            <input
              type="number"
              value={strength}
              onChange={(event) => setStrength(event.target.value)}
              placeholder="可选数值"
              aria-label="关联强度"
              className={fieldClass}
            />
          </label>
        ) : null}
      </div>

      {confirming ? (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <div className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            删除会同时从两端详情与画布移除该关联；若为最后一条缔约边，条约将退化为单缔约方旌旗。
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <InfoRow label="关联">{typeLabel}</InfoRow>
            <InfoRow label="范围">
              {politics.refs.resolveName(link.source)}
              {link.directed ? ' 指向 ' : ' 与 '}
              {politics.refs.resolveName(link.target)}
            </InfoRow>
            <InfoRow label="时间">
              {[link.time?.start, link.time?.end].filter(Boolean).join(' ~ ') || '未标注'}
            </InfoRow>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 motion-reduce:transition-none"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              确认删除
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            收起
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            删除
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      )}
    </div>
  );
};

export default EdgeCard;
