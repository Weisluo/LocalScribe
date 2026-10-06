/**
 * 血缘边元数据 EdgeMetaModal（Phase 3 P3-T3；races_ui_design §4.3/§5.2、§7「关系语义」）
 *
 * 只编辑 races.related_to 的语义字段：relationKind（血缘 / 渊源 / 敌对 + 自定义）、备注、起止时间。
 * 保存走 useUpdateWorldLink(worldId)：保留原有 meta，只覆盖 meta.relationKind；
 * 边的端点由 LinkPanel 增删（改端点请删除后重建，契约 §2.5）。
 */

import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/Modals/Modal';
import { useUpdateWorldLink } from '@/components/Worldbuilding/hooks';
import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { type ModuleConfig } from '../../shared/moduleConfig';
import { raceRelationKinds, relationKindOfEdge } from '../types';
import { toneColor } from '../components/toneColor';

const FIELD_CLASS =
  'w-full rounded-md border border-border/50 bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

export interface EdgeMetaModalProps {
  open: boolean;
  worldId: string;
  link: WorldLink | null;
  config: ModuleConfig;
  resolveName: (ref?: EntityRef | null) => string;
  onClose: () => void;
}

export const EdgeMetaModal = ({
  open,
  worldId,
  link,
  config,
  resolveName,
  onClose,
}: EdgeMetaModalProps) => {
  const updateLink = useUpdateWorldLink(worldId);
  const relationKinds = raceRelationKinds(config);
  const [relationKind, setRelationKind] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current && link) {
      setRelationKind(relationKindOfEdge(link, relationKinds));
      setNote(link.note ?? '');
      setStart(link.time?.start ?? '');
      setEnd(link.time?.end ?? '');
      setError(null);
    }
    wasOpen.current = open;
  }, [open, link, relationKinds]);

  const handleSave = async () => {
    if (!link) return;
    const hasTime = !!start.trim() || !!end.trim();
    setError(null);
    try {
      await updateLink.mutateAsync({
        linkId: link.id,
        data: {
          note: note.trim() || null,
          time: hasTime
            ? { start: start.trim() || null, end: end.trim() || null }
            : null,
          // 保留原有 meta，只改关系语义（§4.3）
          meta: { ...(link.meta ?? {}), relationKind: relationKind || undefined },
        },
      });
      onClose();
    } catch {
      setError('保存失败，请重试');
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="编辑跨族关系" size="md">
      <div className="space-y-3" data-testid="edge-meta-form">
        <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
          {link ? `${resolveName(link.source)} — ${resolveName(link.target)}` : '未选择关联'}
        </div>

        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-foreground">关系语义</span>
          <select
            value={relationKind}
            onChange={(event) => setRelationKind(event.target.value)}
            aria-label="关系语义"
            className={FIELD_CLASS}
          >
            {relationKinds.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-1" data-testid="edge-style-preview">
          {relationKinds.map((def) => (
            <span
              key={def.id}
              className="flex items-center gap-1 rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: toneColor(def.color) }}
                aria-hidden="true"
              />
              {def.label}
              <span className="text-muted-foreground/70">{def.lineStyle ?? 'dashed'}</span>
            </span>
          ))}
        </div>

        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-foreground">备注</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            aria-label="备注"
            className={FIELD_CLASS}
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1 space-y-0.5">
            <span className="text-[11px] font-medium text-foreground">起始</span>
            <input
              type="text"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              aria-label="起始"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex-1 space-y-0.5">
            <span className="text-[11px] font-medium text-foreground">结束</span>
            <input
              type="text"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              aria-label="结束"
              className={FIELD_CLASS}
            />
          </label>
        </div>

        {error && <div className="text-[11px] text-destructive">{error}</div>}

        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={updateLink.isPending || !link}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
};
