/**
 * NodeFormModal（Phase 3 P3-T5/T6；systems_ui_design §3.2/§3.3/§5.1/§8）
 *
 * 一个弹窗承担两种实体：
 * - mode='tier'：阶位字段（名称、rank、分支、突破条件、状态）；速写档只留名称与 rank（§8）。
 * - mode='member'：可复用节点字段（名称、kind、摘要、可复用开关、量级、代价提示），
 *   cost 节点的字段顺序读 config.costFields；从阶位入口新建能力时默认勾选「同时建立赋予关联」，
 *   保存时把 grantFromTierId 交给数据层自动建 systems.grants（§5.1.3）。
 *   kind 只在新建时可选（编辑态固定，改了会让 WorldLink 端点与计数失效）；非能力 kind
 *   不承诺「关联到本阶位」——契约 §4 里 systems.grants 只能指向 ability。
 */

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Loader2, Save } from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';
import { statusDefsOf, type EntityTypeDef, type ModuleConfig } from '../../shared/moduleConfig';
import { ABILITY_KIND, SYSTEM_KIND, TIER_KIND, type SystemNode } from '../types';
import type { MemberFormValues, TierFormValues } from '../hooks/useSystems';

const FIELD_CLASS =
  'w-full rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-foreground transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

/** costFields 的常用键展示名（含义仍由用户定义，不做数值口径） */
const COST_FIELD_LABELS: Record<string, string> = {
  resource: '资源',
  time: '时间',
  reputation: '声誉',
  money: '金钱',
  lifespan: '寿命',
};

/** SystemsView 的窗口快捷键（index.tsx）：弹窗打开时不让这些键穿透到背后的阶梯 */
const VIEW_SHORTCUT_KEYS = ['/', 'j', 'k', 'v', 'n', 'Enter'];

export interface NodeFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'tier' | 'member';
  config: ModuleConfig;
  kinds: EntityTypeDef[];
  tierTerm: string;
  /** 新建 tier 的默认 rank（通常是 nextRankOf） */
  defaultRank: number;
  /** 速写档：阶位只留名称与 rank（§8） */
  sketch: boolean;
  /** 编辑目标；缺省为新建 */
  editing?: SystemNode | null;
  /** 新建 member 的默认 kind（幽灵 chip 入口） */
  presetKind?: string;
  /** 新建 member 时自动建立 grants 的来源阶位 */
  grantFromTierId?: string;
  onSubmitTier: (values: TierFormValues, editingId?: string) => Promise<unknown>;
  onSubmitMember: (
    values: MemberFormValues,
    grantFromTierId: string | undefined,
    editingId?: string
  ) => Promise<unknown>;
  isSubmitting?: boolean;
}

export const NodeFormModal = ({
  open,
  onClose,
  mode,
  config,
  kinds,
  tierTerm,
  defaultRank,
  sketch,
  editing,
  presetKind,
  grantFromTierId,
  onSubmitTier,
  onSubmitMember,
  isSubmitting = false,
}: NodeFormModalProps) => {
  // 可复用节点 kind：排除 system（体系本身）与 tier（阶位必须有 rank，不能当成员建）
  const memberKinds = kinds.filter((def) => def.id !== SYSTEM_KIND && def.id !== TIER_KIND);
  const statuses = statusDefsOf(config);

  const [name, setName] = useState('');
  const [rank, setRank] = useState(defaultRank);
  const [branch, setBranch] = useState('');
  const [breakthrough, setBreakthrough] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState(presetKind ?? memberKinds[0]?.id ?? 'ability');
  const [summary, setSummary] = useState('');
  const [reusable, setReusable] = useState(true);
  const [magnitude, setMagnitude] = useState('');
  const [costHint, setCostHint] = useState('');
  const [linkGrant, setLinkGrant] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setRank(editing?.tierMeta.rank ?? defaultRank);
    setBranch(editing?.tierMeta.branch ?? '');
    setBreakthrough(editing?.tierMeta.breakthrough ?? '');
    setStatus(editing?.tierMeta.status ?? '');
    setKind(editing?.kind ?? presetKind ?? memberKinds[0]?.id ?? 'ability');
    setSummary(editing?.nodeMeta.summary ?? '');
    setReusable(editing?.nodeMeta.reusable ?? true);
    setMagnitude(editing?.nodeMeta.magnitude ?? '');
    setCostHint(editing?.nodeMeta.costHint ?? '');
    setLinkGrant(true);
    setError(null);
    // memberKinds 由 kinds 派生；打开时重置一次即可。
    // 依赖用 editing?.id：世界查询每次 refetch 都会换对象引用，用对象会让正在填写的内容被重置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, presetKind, defaultRank]);

  const isTierMode = mode === 'tier';
  const kindLabel = kinds.find((def) => def.id === kind)?.label ?? kind;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(isTierMode ? `${tierTerm}名称不能为空` : '节点名称不能为空');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isTierMode) {
        await onSubmitTier(
          {
            name: name.trim(),
            rank: Number.isFinite(rank) && rank > 0 ? rank : defaultRank,
            branch: branch.trim(),
            breakthrough: breakthrough.trim(),
            status,
          },
          editing?.id
        );
      } else {
        await onSubmitMember(
          {
            name: name.trim(),
            kind,
            summary: summary.trim(),
            reusable,
            magnitude: magnitude.trim(),
            costHint: costHint.trim(),
          },
          // 「赋予」只能指向能力节点：非能力 kind 一律不自动建 grants，避免必然失败的写入
          !editing && grantFromTierId && linkGrant && kind === ABILITY_KIND
            ? grantFromTierId
            : undefined,
          editing?.id
        );
      }
      onClose();
    } catch (error) {
      // 保存失败：就地显示原因并保留表单（数据层另有 toast，这里兜住 rejection）
      setError(
        error instanceof Error && error.message
          ? `保存失败：${error.message}`
          : '保存失败，请稍后重试'
      );
    } finally {
      setSaving(false);
    }
  };

  const pending = saving || isSubmitting;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={
        isTierMode
          ? `${editing ? '编辑' : '新建'}${tierTerm}`
          : `${editing ? '编辑' : '新建'}节点`
      }
    >
      <div
        className="space-y-3"
        data-testid="node-form"
        // 阻止 / j k v n Enter 穿透到 SystemsView 的窗口快捷键；Esc 与 Tab 放行给 Modal 自身
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (VIEW_SHORTCUT_KEYS.includes(event.key)) event.stopPropagation();
        }}
      >
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {error}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-foreground">
            {isTierMode ? `${tierTerm}名称` : '节点名称'}{' '}
            <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={isTierMode ? `${tierTerm}名称` : '节点名称'}
            autoFocus
            className={FIELD_CLASS}
          />
        </label>

        {isTierMode ? (
          <>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                rank（阶梯顺序唯一依据）
              </span>
              <input
                type="number"
                value={rank}
                onChange={(event) => setRank(Number(event.target.value))}
                aria-label="rank"
                className={FIELD_CLASS}
              />
            </label>

            {!sketch && (
              <>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    分支（主线留空）
                  </span>
                  <input
                    type="text"
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    aria-label="分支"
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    突破条件（简述，长文写进典籍 item）
                  </span>
                  <textarea
                    value={breakthrough}
                    onChange={(event) => setBreakthrough(event.target.value)}
                    rows={3}
                    aria-label="突破条件"
                    className={FIELD_CLASS}
                  />
                </label>

                {statuses.length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                      状态（来自模块配置 StatusDef）
                    </span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      aria-label="状态"
                      className={FIELD_CLASS}
                    >
                      <option value="">未设置</option>
                      {statuses.map((def) => (
                        <option key={def.id} value={def.id}>
                          {def.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {editing ? (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  节点类型
                </span>
                {/* 编辑态不允许改 kind：WorldLink 端点 kind 在创建时记录，改了会让关联计数落到旧 key */}
                <div
                  className={`${FIELD_CLASS} bg-muted/20 text-muted-foreground`}
                  data-testid="member-kind-readonly"
                >
                  {kindLabel}（{kind}）
                </div>
                <p className="text-[10px] text-muted-foreground">
                  类型创建后固定，不可修改（改类型会让该节点已有连接的端点类型失效）。
                </p>
              </div>
            ) : (
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  节点类型
                </span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  aria-label="节点类型"
                  className={FIELD_CLASS}
                >
                  {memberKinds.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.label}（{def.id}）
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                摘要
              </span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={2}
                aria-label="摘要"
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  checked={reusable}
                  onChange={(event) => setReusable(event.target.checked)}
                  aria-label="可复用"
                />
                可复用（同一节点可被多个{tierTerm}引用）
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                量级（文本描述，不做数值系统）
              </span>
              <input
                type="text"
                value={magnitude}
                onChange={(event) => setMagnitude(event.target.value)}
                aria-label="量级"
                className={FIELD_CLASS}
              />
            </label>

            {kind === 'cost' && (
              <>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    代价提示（资源 / 时间 / 声誉等文本）
                  </span>
                  <input
                    type="text"
                    value={costHint}
                    onChange={(event) => setCostHint(event.target.value)}
                    aria-label="代价提示"
                    className={FIELD_CLASS}
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">
                  表单字段顺序：{config.costFields && config.costFields.length > 0
                    ? config.costFields
                        .map((field) => COST_FIELD_LABELS[field] ?? field)
                        .join(' -> ')
                    : '资源 -> 时间 -> 声誉'}
                </p>
              </>
            )}

            {!editing && grantFromTierId && (
              kind === ABILITY_KIND ? (
                <label className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-[11px] text-foreground">
                  <input
                    type="checkbox"
                    checked={linkGrant}
                    onChange={(event) => setLinkGrant(event.target.checked)}
                    aria-label="同时建立赋予关联"
                  />
                  同时建立赋予关联（systems.grants）
                </label>
              ) : (
                // 非能力 kind 不做「自动关联到本阶位」的承诺：契约 §4 里 grants 只能指向 ability
                <p className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground">
                  只新建节点，不会自动关联到{tierTerm}：「赋予」只能指向能力节点；
                  需要关联时请在{tierTerm}详情或关联面板手动补充。
                </p>
              )
            )}
          </>
        )}

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
            onClick={() => void handleSubmit()}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
};
