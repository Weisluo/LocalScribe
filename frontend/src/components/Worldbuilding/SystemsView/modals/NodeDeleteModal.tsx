/**
 * NodeDeleteModal（Phase 3 P3-T6；systems_ui_design §5.1.5/§5.2）
 *
 * 删除节点前先列出通过 systems.grants / systems.costs 引用它的阶位，
 * 让人可以选择「仅删关联（保留节点）」或「仅删除节点」；不做静默级联。
 */

import { AlertTriangle, Loader2, Trash2, Unlink } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { Modal } from '@/components/Modals/Modal';
import type { SystemNode } from '../types';

/** SystemsView 的窗口快捷键（index.tsx）：删除确认打开时不让这些键穿透到背后的阶梯 */
const VIEW_SHORTCUT_KEYS = ['/', 'j', 'k', 'v', 'n', 'Enter'];

export interface NodeDeleteReference {
  linkId: string;
  /** grants / costs */
  type: string;
  /** 引用方名称（阶位或体系） */
  name: string;
}

export interface NodeDeleteModalProps {
  open: boolean;
  onClose: () => void;
  node: SystemNode | null;
  references: NodeDeleteReference[];
  onDeleteLinksOnly: () => void | Promise<void>;
  onDeleteNode: () => void | Promise<void>;
}

export const NodeDeleteModal = ({
  open,
  onClose,
  node,
  references,
  onDeleteLinksOnly,
  onDeleteNode,
}: NodeDeleteModalProps) => {
  const [busy, setBusy] = useState<'links' | 'node' | null>(null);

  const run = async (action: 'links' | 'node') => {
    setBusy(action);
    try {
      if (action === 'links') {
        await onDeleteLinksOnly();
      } else {
        await onDeleteNode();
      }
    } catch {
      // 失败提示由数据层统一 toast，弹窗保持打开便于重试
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="删除节点" size="sm">
      <div
        className="space-y-3"
        data-testid="node-delete-form"
        // 阻止 / j k v n Enter 穿透到 SystemsView 的窗口快捷键；Esc 与 Tab 放行给 Modal 自身
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (VIEW_SHORTCUT_KEYS.includes(event.key)) event.stopPropagation();
        }}
      >
        <p className="text-xs text-foreground">
          确认删除「{node?.name ?? ''}」？
        </p>

        {references.length > 0 ? (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              该节点被以下对象通过 grants / costs 引用：
            </div>
            <ul className="space-y-0.5" data-testid="node-delete-references">
              {references.map((reference) => (
                <li
                  key={reference.linkId}
                  className="text-[11px] text-foreground"
                  data-reference-type={reference.type}
                >
                  {reference.name}
                  <span className="ml-1 text-muted-foreground">（{reference.type}）</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            当前没有 grants / costs 引用该节点。
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </button>
          {references.length > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('links')}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/30 disabled:opacity-50"
            >
              {busy === 'links' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              仅删关联
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('node')}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy === 'node' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            仅删除节点
          </button>
        </div>
      </div>
    </Modal>
  );
};
