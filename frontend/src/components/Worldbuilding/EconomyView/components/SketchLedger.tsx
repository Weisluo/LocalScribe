/**
 * SketchLedger（Phase 5 P5-T9；economy_ui_design §4.4/§8.2/§9/§10.1）
 *
 * 速写档唯一的可见组件：经济速写卡（扉页）。
 * - 3-5 个字段槽（form / currency / resources / industries / distribution，可改名调序）；
 * - 行首竖线、行尾 chip、chips 等权按字段分组；
 * - 完成提示「记下 3 项即可成立。当前已写 N 项。」；
 * - 折叠条「另有 N 条往来、M 个数值已折叠」+ 「展开为脉络 / 就这样，先记着」；
 * - 卡片底部「连一句往来」内联面板（选两个关键词 + 选一个动词），落一条 core.related_to。
 *
 * 术语门（§4.4/§8.1）：本组件在速写档渲染，文案一律走 term() 的日常词，
 * 不出现「实体 / 关联 / 流量 / 指标 / 周期 / 节点」。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Link2, PenLine } from 'lucide-react';

import { ECONOMY_VERBS } from '../config';
import { ChipList } from './ChipList';
import type {
  EconomyChip,
  EconomyOverview,
  EconomySketchFieldDef,
  EconomyVerbLinkRow,
  SketchLedgerProps,
} from '../types';

/** 字段 id -> 人话提问（配置可改名，但问题只认 id；未知 id 回落为字段名） */
const FIELD_QUESTIONS: Record<string, string> = {
  form: '这个世界靠什么换东西？',
  currency: '大家用什么当钱？',
  resources: '出产什么？',
  industries: '靠什么营生？',
  distribution: '谁分得多，谁分得少？',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const SketchLedger = ({
  config,
  overview,
  fold,
  counts,
  verbLinksOf,
  canWrite,
  isSaving,
  onSaveOverview,
  onPromoteChip,
  onExpandAllChips,
  onOpenStructure,
  onCreateVerbLink,
  term,
}: SketchLedgerProps) => {
  const fields = useMemo(() => config.sketchFields ?? [], [config.sketchFields]);
  const emptyOverview = useMemo<EconomyOverview>(() => ({ resources: [], industries: [] }), []);
  const data = overview ?? emptyOverview;

  const [form, setForm] = useState(data.form ?? '');
  const [distribution, setDistribution] = useState(data.distribution ?? '');
  const [extraDrafts, setExtraDrafts] = useState<Record<string, string>>({});
  const [kept, setKept] = useState(false);
  const [verbOpen, setVerbOpen] = useState(false);
  const [verbSource, setVerbSource] = useState('');
  const [verbTarget, setVerbTarget] = useState('');
  const [verbName, setVerbName] = useState(ECONOMY_VERBS[0]?.verb ?? '');
  const seeded = useRef(false);

  // 数据异步到达后只播种一次，之后不再回灌，避免打断正在输入的内容
  useEffect(() => {
    if (seeded.current || !overview) return;
    seeded.current = true;
    setForm(overview.form ?? '');
    setDistribution(overview.distribution ?? '');
  }, [overview]);

  const patch = (next: Partial<EconomyOverview>) => {
    void onSaveOverview({ ...data, ...next });
  };

  const chipsOf = (field: EconomySketchFieldDef): EconomyChip[] => {
    if (field.type !== 'chips') return [];
    if (field.id === 'currency') return data.currency ? [data.currency] : [];
    if (field.id === 'resources') return data.resources ?? [];
    if (field.id === 'industries') return data.industries ?? [];
    const extra = asRecord(data)[field.id];
    return Array.isArray(extra) ? (extra as EconomyChip[]) : [];
  };

  const setChips = (field: EconomySketchFieldDef, chips: EconomyChip[]) => {
    if (field.id === 'currency') {
      patch({ currency: chips[0] ?? null });
      return;
    }
    if (field.id === 'resources') {
      patch({ resources: chips });
      return;
    }
    if (field.id === 'industries') {
      patch({ industries: chips });
      return;
    }
    patch({ [field.id]: chips } as unknown as Partial<EconomyOverview>);
  };

  /** 文本槽位的读写：form / distribution 有专属字段，其余（用户改名的槽位）原样存在 overview 上 */
  const textValueOf = (field: EconomySketchFieldDef): string => {
    if (field.id === 'form') return form;
    if (field.id === 'distribution') return distribution;
    return extraDrafts[field.id] ?? String(asRecord(data)[field.id] ?? '');
  };

  const setTextDraft = (field: EconomySketchFieldDef, value: string) => {
    if (field.id === 'form') setForm(value);
    else if (field.id === 'distribution') setDistribution(value);
    else setExtraDrafts((prev) => ({ ...prev, [field.id]: value }));
  };

  const commitText = (field: EconomySketchFieldDef, value: string) => {
    if (field.id === 'form') patch({ form: value.trim() });
    else if (field.id === 'distribution') patch({ distribution: value.trim() });
    else patch({ [field.id]: value.trim() } as unknown as Partial<EconomyOverview>);
  };

  const allChips = useMemo(() => {
    const collected: EconomyChip[] = [];
    for (const field of fields) {
      if (field.type !== 'chips') continue;
      if (field.id === 'currency') {
        if (data.currency) collected.push(data.currency);
      } else if (field.id === 'resources') {
        collected.push(...(data.resources ?? []));
      } else if (field.id === 'industries') {
        collected.push(...(data.industries ?? []));
      } else {
        const extra = asRecord(data)[field.id];
        if (Array.isArray(extra)) collected.push(...(extra as EconomyChip[]));
      }
    }
    return collected;
  }, [data, fields]);

  const verbRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: EconomyVerbLinkRow[] = [];
    for (const chip of allChips) {
      for (const row of verbLinksOf(chip)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push(row);
      }
    }
    return rows;
  }, [allChips, verbLinksOf]);

  const filled = [
    form.trim(),
    data.currency?.label?.trim(),
    (data.resources ?? []).length > 0 ? '1' : '',
    (data.industries ?? []).length > 0 ? '1' : '',
    distribution.trim(),
  ].filter(Boolean).length;

  const foldedParts = [
    fold.links > 0 ? `${fold.links} 条${term('flowWord', '往来')}` : '',
    fold.metrics > 0 ? `${fold.metrics} 个数值` : '',
    fold.fields > 0 ? `${fold.fields} 个字段` : '',
  ].filter(Boolean);

  const verb = ECONOMY_VERBS.find((item) => item.verb === verbName) ?? ECONOMY_VERBS[0];
  const sourceChip = allChips.find((chip) => chip.id === verbSource);
  const targetChip = allChips.find((chip) => chip.id === verbTarget);
  const canLink = !!sourceChip && !!targetChip && sourceChip.id !== targetChip.id && !!verb;

  return (
    <section
      data-testid="economy-sketch"
      className="mx-auto w-full max-w-3xl rounded-lg border border-border/70 bg-card/60 p-3 shadow-sm"
    >
      <header className="flex items-center gap-2 border-b border-border/50 pb-2">
        <PenLine className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
        <h2 className="text-xs font-semibold text-foreground">
          {term('overviewTitle', '经济速写卡')}
        </h2>
        <span className="ml-auto font-mono text-[10px] tracking-wide text-muted-foreground">
          页 01
        </span>
        {isSaving ? <span className="text-[10px] text-muted-foreground">保存中…</span> : null}
      </header>

      <div className="mt-2 space-y-2.5">
        {fields.map((field) => (
          <div
            key={field.id}
            data-testid={`economy-sketch-field-${field.id}`}
            className="border-l-2 border-green-500/40 pl-2"
          >
            <p className="text-[10px] text-muted-foreground">
              {FIELD_QUESTIONS[field.id] ?? field.label}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-[11px] text-foreground">{field.label}</span>

              {field.type === 'chips' ? (
                <ChipList
                  field={field}
                  chips={chipsOf(field)}
                  canWrite={canWrite}
                  suggestions={field.options}
                  onChange={(next) => setChips(field, next)}
                  onPromote={(chip) => onPromoteChip(chip, field.id)}
                  onExpandAll={() => void onExpandAllChips(field, chipsOf(field))}
                  term={term}
                />
              ) : (
                <>
                  <input
                    type="text"
                    list={
                      field.type === 'select' ? `economy-sketch-options-${field.id}` : undefined
                    }
                    value={textValueOf(field)}
                    disabled={!canWrite}
                    onChange={(event) => setTextDraft(field, event.target.value)}
                    onBlur={(event) => commitText(field, event.target.value)}
                    aria-label={field.label}
                    placeholder="自填…"
                    className="w-56 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/60"
                  />
                  {field.type === 'select' ? (
                    <datalist id={`economy-sketch-options-${field.id}`}>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {verbRows.length > 0 ? (
        <div className="mt-2 border-t border-border/40 pt-1.5" data-testid="economy-sketch-verb-rows">
          <p className="text-[10px] text-muted-foreground">
            已连 {verbRows.length} 条{term('flowWord', '往来')}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {verbRows.map((row) => (
              <li key={row.id} className="flex items-center gap-1 text-[11px] text-foreground">
                <span>{row.fromLabel}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span className="rounded-sm border border-border/50 px-1 text-[10px] text-muted-foreground">
                  {row.verbLabel}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span>{row.toLabel}</span>
                {row.raw ? (
                  <button
                    type="button"
                    onClick={row.refine}
                    className="ml-1 rounded-sm border border-border/50 px-1 text-[10px] text-cyan-700 transition-colors hover:bg-cyan-500/10 motion-reduce:transition-none dark:text-cyan-300"
                  >
                    细化
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canWrite ? (
        <div className="mt-2 border-t border-border/40 pt-1.5">
          <button
            type="button"
            data-testid="economy-verb-link"
            onClick={() => setVerbOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            <Link2 className="h-3 w-3" aria-hidden="true" />
            {term('verbLink', '连一句往来')}
          </button>

          {verbOpen ? (
            <div
              data-testid="economy-verb-panel"
              className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-border/50 bg-background/60 p-1.5"
            >
              {allChips.length < 2 ? (
                <span className="text-[11px] text-muted-foreground">
                  先写两个关键词，就能把它们连起来。
                </span>
              ) : (
                <>
                  <select
                    aria-label="从哪一个"
                    value={verbSource}
                    onChange={(event) => setVerbSource(event.target.value)}
                    className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
                  >
                    <option value="">从哪一个…</option>
                    {allChips.map((chip) => (
                      <option key={chip.id} value={chip.id}>
                        {chip.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="怎么来往"
                    value={verbName}
                    onChange={(event) => setVerbName(event.target.value)}
                    className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
                  >
                    {ECONOMY_VERBS.map((item) => (
                      <option key={item.verb} value={item.verb}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="连到哪一个"
                    value={verbTarget}
                    onChange={(event) => setVerbTarget(event.target.value)}
                    className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px]"
                  >
                    <option value="">连到哪一个…</option>
                    {allChips.map((chip) => (
                      <option key={chip.id} value={chip.id}>
                        {chip.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!canLink}
                    onClick={() => {
                      if (!sourceChip || !targetChip || !verb) return;
                      void onCreateVerbLink(sourceChip, verb, targetChip);
                      setVerbOpen(false);
                      setVerbSource('');
                      setVerbTarget('');
                    }}
                    className="rounded-md bg-green-600 px-2 py-0.5 text-[11px] text-white transition-colors hover:bg-green-700 disabled:opacity-40 motion-reduce:transition-none"
                  >
                    连上
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-2 border-t border-border/50 pt-1.5">
        <p className="text-[11px] text-foreground" data-testid="economy-sketch-progress">
          记下 3 项即可成立。当前已写 {filled} 项。
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {foldedParts.length > 0
            ? `另有 ${foldedParts.join('、')}已折叠：升到结构可看${term('flowWord', '往来')}，升到沙盘可看数值。`
            : `没有折叠的${term('flowWord', '往来')}${counts.links > 0 ? `（已连 ${counts.links} 条）` : ''}。`}
        </p>
        {kept ? (
          <p className="mt-1 text-[10px] text-muted-foreground" data-testid="economy-sketch-kept">
            就这样先记着；数据一直都在，随时可以展开。
          </p>
        ) : (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              data-testid="economy-open-structure"
              onClick={onOpenStructure}
              className="rounded-md bg-green-600 px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-green-700 motion-reduce:transition-none"
            >
              {term('promoChip', '展开为脉络')}
            </button>
            <button
              type="button"
              data-testid="economy-keep-sketch"
              onClick={() => setKept(true)}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
            >
              {term('keepSketch', '就这样，先记着')}
            </button>
          </div>
        )}
      </footer>
    </section>
  );
};

export default SketchLedger;
