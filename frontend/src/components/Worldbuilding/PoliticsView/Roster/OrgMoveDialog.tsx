/**
 * 组织改归属确认框（Phase 4 P4-T9；politics_ui_design §4.4.5/§5.4）
 *
 * 拖拽改归属边属于结构性写入：写前必须说清会影响的 scope 与统计。
 * 用统一 Modal（不用原生 confirm），确认后才删旧 subordinate_to 边、建新边并 recalcScope。
 */

import { Modal } from '@/components/Modals/Modal';

export interface OrgMoveDialogProps {
  open: boolean;
  orgName: string;
  fromPolityName?: string;
  toPolityName: string;
  /** 影响说明：归属边变化、scope 重算规则、统计前后对比（由 Roster 结算） */
  lines: string[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const OrgMoveDialog = ({
  open,
  orgName,
  fromPolityName,
  toPolityName,
  lines,
  pending,
  onCancel,
  onConfirm,
}: OrgMoveDialogProps) => (
  <Modal isOpen={open} onClose={onCancel} title="改变组织归属" size="sm">
    <div className="space-y-2 text-xs text-foreground" data-testid="org-move-dialog">
      <p className="leading-relaxed">
        把「{orgName}」从「{fromPolityName ?? '无政权归属'}」移到「{toPolityName}」。
      </p>
      <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent/30 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? '写入中...' : '确认移动'}
        </button>
      </div>
    </div>
  </Modal>
);

export default OrgMoveDialog;
