/**
 * TierBulkInput（Phase 3 P3-T5；systems_ui_design §5.1.2/§9/§10）
 *
 * 多行录入阶位：每行一个阶位，rank = 序号 × rankStep（第 1 行 = 步长本身）；
 * 行首尾空白自动裁剪，空行跳过。三行即可得到一条有序阶梯，之后可改名或拖拽调序。
 */

import { useState } from 'react';
import { ListPlus, Loader2 } from 'lucide-react';

export interface TierBulkInputProps {
  /** 交给数据层 bulkCreateTiers：每行一个阶位名 */
  onSubmit: (names: string[]) => void | Promise<unknown>;
  rankStep: number;
  tierTerm: string;
  isSubmitting?: boolean;
  className?: string;
}

export const TierBulkInput = ({
  onSubmit,
  rankStep,
  tierTerm,
  isSubmitting = false,
  className = '',
}: TierBulkInputProps) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const handleSubmit = async () => {
    if (lines.length === 0 || busy) return;
    setBusy(true);
    try {
      await onSubmit(lines);
      setText('');
    } catch {
      // 失败提示由数据层统一 toast，输入内容保留便于重试
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || isSubmitting;

  return (
    <div
      className={`space-y-2 rounded-lg border border-border/50 bg-card/40 p-3 ${className}`}
      data-testid="tier-bulk-input"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <ListPlus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        快速录入{tierTerm}
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        aria-label={`每行一个${tierTerm}`}
        placeholder={`每行一个${tierTerm}\n第一阶\n第二阶\n第三阶`}
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          rank = 序号 × {rankStep}（第 1 行 = {rankStep}）；行首尾空白裁剪，空行跳过。
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={lines.length === 0 || pending}
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          批量创建
        </button>
      </div>
    </div>
  );
};
