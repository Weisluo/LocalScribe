/**
 * PromoteChipModal（Phase 5 P5-T9；economy_ui_design §4.4）
 *
 * 速写 chip 展开时只问一句「它是什么？」：
 * - 默认 kind 由 chip 所属字段决定（资源 -> resource、产业 -> industry、货币 -> currency）；
 * - 不弹大表单，其余字段在结构档后补；
 * - 展开后 chip 与实体是同一个 id、meta.stub=true（由外壳写入）。
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { ECONOMY_RECOMMENDED_KINDS, sketchFieldKind } from '../config';
import type { PromoteChipModalProps } from '../types';

export const PromoteChipModal = ({
  open,
  chip,
  field,
  kinds,
  onClose,
  onConfirm,
}: PromoteChipModalProps) => {
  const fallbackKind = chip?.kind ?? field?.chipKind ?? sketchFieldKind(field?.id ?? '') ?? 'custom';
  const [kind, setKind] = useState(fallbackKind);
  const [busy, setBusy] = useState(false);
  const kindRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (open) setKind(fallbackKind);
  }, [open, fallbackKind]);

  // 打开时焦点落到首个可交互元素（类型选择），关闭 / 卸载时焦点还原给打开弹层的元素
  // （Esc 关闭由外壳处理，这里只负责焦点，不改 DOM 结构）
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    kindRef.current?.focus();
    return () => {
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  if (!open || !chip) return null;

  // 模块还没登记任何类型时，只在该字段对应的推荐骨架上选（用户点过才写入 config，不预置内容）
  const candidateKinds =
    kinds.length > 0
      ? kinds
      : ECONOMY_RECOMMENDED_KINDS.filter(
          (def) => !field?.chipKind || def.id === field.chipKind || def.id === fallbackKind
        );

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(kind);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="它是什么"
      data-testid="economy-promote-modal"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg">
        <h2 className="text-xs font-semibold text-foreground">它是什么？</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          「{chip.label}」仍然留在速写卡上，只是多出一个可以走动的站点；同一个 id，随时可以收回来。
        </p>

        <label className="mt-3 block text-[11px] text-muted-foreground">
          {field?.label ?? '关键词'}的类型
          <select
            ref={kindRef}
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            data-testid="economy-promote-kind"
            className="mt-1 w-full rounded-md border border-border/60 bg-background px-1.5 py-1 text-[11px] text-foreground"
          >
            {candidateKinds.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            先不展开
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            data-testid="economy-promote-chip"
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-green-700 disabled:opacity-50 motion-reduce:transition-none"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? '展开中…' : '展开'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoteChipModal;
