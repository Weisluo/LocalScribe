/**
 * ChipList（Phase 5 P5-T9；economy_ui_design §4.4 规则 2/§7.3）
 *
 * 速写关键词 chip 的输入与展示：
 * - Enter / 逗号 / 顿号分词，自动去重；每类建议不超过 6 个，超出只提示不拦截；
 * - chip 是「货签」：点击即「展开为脉络」（同一个 id 变成站点，§4.4 chip 的三种命运）；
 * - 删除只删除关键词，不删除已展开的实体（收起 ≠ 删除）。
 *
 * 术语门：本组件只出现在速写档，文案一律用 term() 的日常词，不出现「实体 / 关联 / 流量 / 指标」。
 */

import { useState, type KeyboardEvent } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';

import { ECONOMY_CHIP_SUGGESTION_MAX, sketchFieldKind } from '../config';
import { newEconomyId } from '../hooks/useEconomyViewState';
import type { ChipListProps, EconomyChip } from '../types';

/** 分词：Enter / 逗号 / 顿号 / 分号都算分隔符 */
const splitTokens = (raw: string): string[] =>
  raw
    .split(/[,，、;；]/)
    .map((token) => token.trim())
    .filter(Boolean);

export const ChipList = ({
  field,
  chips,
  canWrite,
  suggestions,
  onChange,
  onPromote,
  onExpandAll,
  term,
}: ChipListProps) => {
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const limit = field.maxItems ?? (field.type === 'chips' ? ECONOMY_CHIP_SUGGESTION_MAX : undefined);
  const chipKind = field.chipKind ?? sketchFieldKind(field.id) ?? 'custom';

  const commit = (raw?: string) => {
    const tokens = splitTokens(raw ?? draft);
    if (tokens.length === 0) {
      setDraft('');
      return;
    }
    const next = [...chips];
    let duplicated = 0;
    for (const token of tokens) {
      if (next.some((chip) => chip.label.trim().toLowerCase() === token.toLowerCase())) {
        duplicated += 1;
        continue;
      }
      next.push({ id: newEconomyId(), label: token, kind: chipKind });
    }
    if (next.length !== chips.length) onChange(next);
    setDraft('');
    if (limit && next.length > limit) {
      setHint(`建议每类不超过 ${limit} 个，超出的仍然保留`);
    } else if (duplicated > 0) {
      setHint(`已自动去掉 ${duplicated} 个重复项`);
    } else {
      setHint(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，' || event.key === '、') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && draft === '' && chips.length > 0 && canWrite) {
      onChange(chips.slice(0, -1));
    }
  };

  const quickAdd = suggestions?.filter(
    (item) => !chips.some((chip) => chip.label === item)
  ).slice(0, ECONOMY_CHIP_SUGGESTION_MAX);

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={`economy-chips-${field.id}`}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-foreground transition-all duration-200"
        >
          <button
            type="button"
            data-testid={`economy-chip-${chip.id}`}
            onClick={() => onPromote(chip)}
            title={term('promoChip', '展开为脉络')}
            className="inline-flex items-center gap-1 rounded-full px-0.5 transition-colors duration-200 hover:text-green-700 motion-reduce:transition-none dark:hover:text-green-300"
          >
            {chip.label}
            {chip.entityRef ? (
              <span className="text-xs text-muted-foreground">已展开</span>
            ) : null}
          </button>
          {canWrite ? (
            <button
              type="button"
              aria-label={`删除 ${chip.label}`}
              onClick={() => onChange(chips.filter((item) => item.id !== chip.id))}
              className="rounded-full p-0.5 text-muted-foreground transition-colors duration-200 hover:text-destructive"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}

      {canWrite ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit()}
            placeholder={chips.length > 0 ? '再写一个…' : '写一个…'}
            aria-label={`${field.label}：写一个`}
            data-testid={`economy-chip-input-${field.id}`}
            className="w-28 rounded-xl border border-border/40 bg-muted/30 px-3 py-1 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="button"
            data-testid={`economy-chip-add-${field.id}`}
            onClick={() => commit()}
            className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            写一个
          </button>
        </>
      ) : null}

      {canWrite && chips.length > 1 ? (
        <button
          type="button"
          onClick={onExpandAll}
          data-testid={`economy-chip-expand-all-${field.id}`}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/10 motion-reduce:transition-none"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {term('expandWord', '展开')}全部
        </button>
      ) : null}

      {quickAdd && quickAdd.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          建议：
          {quickAdd.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => commit(item)}
              className="rounded-full border border-border/40 px-2.5 py-0.5 transition-all duration-200 hover:border-border/70 hover:bg-accent/5 hover:text-foreground motion-reduce:transition-none"
            >
              {item}
            </button>
          ))}
        </span>
      ) : null}

      {hint ? <span className="text-xs text-amber-600 dark:text-amber-400">{hint}</span> : null}
    </div>
  );
};

export type { EconomyChip };
export default ChipList;
