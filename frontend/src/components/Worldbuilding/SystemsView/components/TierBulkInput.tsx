/**
 * TierBulkInput（Phase 3 P3-T5；systems_ui_design §5.1.2/§9/§10）
 *
 * 多行录入阶位：每行一个阶位，rank = 序号 × rankStep（第 1 行 = 步长本身）；
 * 行首尾空白自动裁剪，空行跳过。三行即可得到一条有序阶梯，之后可改名或拖拽调序。
 *
 * 视觉对齐 ui_style_alignment：子面板 §4.9、输入框 §4.5、主按钮 §4.3。
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
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
      className={`space-y-3 rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm ${className}`}
      data-testid="tier-bulk-input"
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ListPlus className="h-4 w-4 text-primary" aria-hidden="true" />
        快速录入{tierTerm}
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        aria-label={`每行一个${tierTerm}`}
        placeholder={`每行一个${tierTerm}\n第一阶\n第二阶\n第三阶`}
        className="w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          rank = 序号 × {rankStep}（第 1 行 = {rankStep}）；行首尾空白裁剪，空行跳过。
        </p>
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={lines.length === 0 || pending}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ListPlus className="h-4 w-4" aria-hidden="true" />
          )}
          批量创建
        </motion.button>
      </div>
    </div>
  );
};
