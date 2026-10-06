/**
 * 政治实体创建 / 编辑弹层（Phase 4 P4-T11；politics_ui_design §5.2/§5.3/§5.4/§5.7/§9.3）
 *
 * 一个组件覆盖四种 kind 的创建与编辑：
 * - 政权：名称 + 等级（必填，可内联新建等级：label + rank + color）+ 一位统治者（可跳过）；
 * - 组织：名称 + scope（必填，政权卡入口默认 intra_polity）+ 上级（保存时建 subordinate_to）；
 * - 人物：先选全局 Character（可只填名称快速新建角色），再填政治身份、职位与任期、是否主要；
 * - 条约：缔约方多选 + 名称（必填）+ 类型 + 生效 / 到期，保存时写多条 signatory_of。
 * 空白世界不预置任何等级 / 状态 / 政体 / 名称；校验按 §5.7 阻断级规则拦在提交前。
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Modal } from '@/components/Modals/Modal';
import { characterApi } from '@/services/characterApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import { refKey, sameRef } from '@/components/Worldbuilding/types';
import { useWorld } from '@/components/Worldbuilding/hooks';
import { CustomFieldRenderer } from '../../shared/CustomFieldRenderer';
import {
  customFieldsOf,
  kindDefOf,
  type CustomFieldValue,
  type LevelDef,
  type StatusDef,
} from '../../shared/moduleConfig';
import { writeCustomField } from '../../shared/customFieldModel';
import { useModuleConfig } from '../../shared/useModuleConfig';
import type { UsePoliticsResult } from '../hooks';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_BUILTIN_KINDS,
  POLITICS_LINK_TYPES,
  POLITICS_MODULE,
  POLITY_KIND,
  POLITICS_SCOPES,
  SCOPE_LABELS,
  SIGNATORY_LINK_TYPE,
  TREATY_KIND,
  cleanText,
  politicsRefOf,
  type PoliticsEntity,
  type PoliticsScope,
} from '../types';
import { fieldClass, labelClass } from '../tone';
import {
  emptyFormState,
  formStateOf,
  slugId,
  toFigureValues,
  toOrganizationValues,
  toPolityValues,
  toTimeSpan,
  toTreatyValues,
  validateForm,
  warningOf,
  type PoliticsFormState,
} from './politicsFormState';

export interface PoliticsFormModalProps {
  open: boolean;
  kind: string;
  editing?: PoliticsEntity;
  politics: UsePoliticsResult;
  onClose: () => void;
  onSaved: (entityId: string) => void;
}

type PickerRole = 'ruler' | 'character' | 'parent' | 'office' | 'parties';

const Field = ({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="block space-y-0.5">
    <span className={labelClass}>
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
    {children}
    {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
  </label>
);

const dedupeRefs = (refs: { module: string; kind: string; id: string }[]) => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = refKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const PoliticsFormModal = ({
  open,
  kind,
  editing,
  politics,
  onClose,
  onSaved,
}: PoliticsFormModalProps) => {
  const { save: saveConfig } = useModuleConfig(politics.worldId, politics.moduleId);
  const worldQuery = useWorld(politics.worldId, { includeItems: true });
  const projectId = worldQuery.data?.project_id;
  const queryClient = useQueryClient();

  const [form, setForm] = useState<PoliticsFormState>(emptyFormState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<PickerRole | null>(null);
  const [showLevelCreate, setShowLevelCreate] = useState(false);
  const [showStatusCreate, setShowStatusCreate] = useState(false);
  const [levelDraft, setLevelDraft] = useState({ label: '', rank: '', color: '' });
  const [statusDraft, setStatusDraft] = useState({ label: '', color: '', isTerminal: false });
  const [quickCharacterOpen, setQuickCharacterOpen] = useState(false);
  const [quickCharacterName, setQuickCharacterName] = useState('');
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  /** 新建时其余字段折叠：最短路径只留必填与统治者（§5.2/§10.3） */
  const [showMore, setShowMore] = useState(false);
  const wasOpen = useRef(false);

  const kindLabel = kindDefOf(politics.config, kind, POLITICS_BUILTIN_KINDS)?.label ?? kind;
  const customFields = customFieldsOf(politics.config, kind, POLITICS_BUILTIN_KINDS);
  const isBuiltinKind =
    kind === POLITY_KIND || kind === ORGANIZATION_KIND || kind === FIGURE_KIND || kind === TREATY_KIND;

  /**
   * 关联选择器嵌在表单 Modal 里：两层 Modal 都在 window 上监听 Esc，
   * 这里在捕获阶段先消费 Esc 只关选择器，避免连表单一起关掉。
   */
  useEffect(() => {
    if (picker === null) return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      setPicker(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [picker]);

  /* 编辑态回填：边信息（统治者 / 归属 / 缔约方）来自 politics.links，不在表单里复制 */
  useEffect(() => {
    if (open && !wasOpen.current) {
      const base = editing ? formStateOf(editing) : emptyFormState();
      if (editing) {
        if (editing.kind === POLITY_KIND) {
          // 统治者 = figure -> polity 的 leads 边；figure 自身再经 meta.characterId 关联全局角色
          const lead = politics.links.find(
            (link) =>
              link.link_type === POLITICS_LINK_TYPES.leads &&
              link.source.module === POLITICS_MODULE &&
              link.source.kind === FIGURE_KIND &&
              link.target.module === POLITICS_MODULE &&
              link.target.id === editing.id
          );
          if (lead) {
            const rulerFigure = politics.byId.get(lead.source.id);
            const characterId = (rulerFigure?.meta as { characterId?: string } | undefined)
              ?.characterId;
            base.rulerCharacterId = characterId ?? '';
            base.rulerOfficeTitle =
              typeof lead.meta?.officeTitle === 'string' ? lead.meta.officeTitle : '';
            base.rulerStart = lead.time?.start ?? '';
            base.rulerEnd = lead.time?.end ?? '';
            base.rulerIsPrimary = lead.meta?.isPrimary !== false;
          }
        }
        if (editing.kind === ORGANIZATION_KIND) {
          const parent = politics.links.find(
            (link) =>
              link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
              link.source.module === 'politics' &&
              link.source.id === editing.id
          );
          base.parentRef = parent?.target ?? null;
        }
        if (editing.kind === TREATY_KIND) {
          base.parties = politics.links
            .filter(
              (link) =>
                link.link_type === SIGNATORY_LINK_TYPE &&
                link.target.module === 'politics' &&
                link.target.id === editing.id
            )
            .map((link) => link.source);
        }
      }
      setForm(base);
      setError(null);
      setLevelDraft({ label: '', rank: '', color: '' });
      setStatusDraft({ label: '', color: '', isTerminal: false });
      setShowLevelCreate(false);
      setShowStatusCreate(false);
      setQuickCharacterOpen(false);
      setQuickCharacterName('');
      setShowMore(false);
    }
    wasOpen.current = open;
  }, [open, editing, politics]);

  const patch = (next: Partial<PoliticsFormState>) => setForm((prev) => ({ ...prev, ...next }));

  const selectedCharacter = form.characterId
    ? politics.refs.lookup({ module: 'character', kind: 'character', id: form.characterId })
    : undefined;

  const rulerLabel = form.rulerCharacterId
    ? politics.refs.lookup({ module: 'character', kind: 'character', id: form.rulerCharacterId })
        ?.name ?? '已选角色'
    : '';

  const warning = useMemo(() => warningOf(kind, form), [kind, form]);

  /* ---------------- 内联新建等级 / 状态（不预置任何名称） ---------------- */

  const handleAddLevel = async () => {
    const label = levelDraft.label.trim();
    if (!label) {
      setError('等级名称不能为空');
      return;
    }
    // rank 是版图尺寸 / 布局环的唯一变量（§2.1）：留空按下一个档位补齐，填了非法值直接报错，
    // 不能像旧实现那样静默写成 0（会让所有政权退化成同一档）。
    const ranks = politics.levels
      .map((def) => def.rank)
      .filter((rank): rank is number => typeof rank === 'number' && Number.isFinite(rank));
    const nextRank = ranks.length > 0 ? Math.max(...ranks) + 10 : 10;
    const raw = levelDraft.rank.trim();
    const parsed = raw === '' ? nextRank : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('等级权重（rank）必须是大于 0 的数字');
      return;
    }
    const def: LevelDef = {
      id: slugId(label, politics.levels.map((item) => item.id), 'lvl'),
      label,
      rank: parsed,
      color: cleanText(levelDraft.color),
    };
    try {
      await saveConfig({ levels: [...politics.levels, def] });
      patch({ level: def.id });
      setLevelDraft({ label: '', rank: '', color: '' });
      setShowLevelCreate(false);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '等级保存失败');
    }
  };

  const handleAddStatus = async () => {
    const label = statusDraft.label.trim();
    if (!label) {
      setError('状态名称不能为空');
      return;
    }
    const def: StatusDef = {
      id: slugId(label, politics.statuses.map((item) => item.id), 'st'),
      label,
      color: cleanText(statusDraft.color),
      isTerminal: statusDraft.isTerminal || undefined,
    };
    try {
      await saveConfig({ statuses: [...politics.statuses, def] });
      patch({ status: def.id });
      setStatusDraft({ label: '', color: '', isTerminal: false });
      setShowStatusCreate(false);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '状态保存失败');
    }
  };

  /* ---------------- 全局角色：选择 / 快速新建 ---------------- */

  const handleQuickCreateCharacter = async () => {
    const name = quickCharacterName.trim();
    if (!name) {
      toast.error('角色名称不能为空');
      return;
    }
    if (!projectId) {
      toast.error('尚未取到项目信息，请稍后重试');
      return;
    }
    setCreatingCharacter(true);
    try {
      const created = await characterApi.createCharacter(projectId, { name });
      await queryClient.invalidateQueries({ queryKey: ['characters-simple', projectId] });
      setForm((prev) => ({
        ...prev,
        characterId: created.id,
        // 政治记录名沿用角色名，避免同一名称重复输入；详情始终显示解析后的角色名
        name: prev.name.trim() ? prev.name : name,
      }));
      setQuickCharacterOpen(false);
      setQuickCharacterName('');
      toast.success('已新建全局角色，其余属性在角色模块补充');
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : '角色创建失败');
    } finally {
      setCreatingCharacter(false);
    }
  };

  /* ---------------- 关联选择器 ---------------- */

  const handlePickerConfirm = (selection: EntityPickerSelection) => {
    const first = selection.targets[0];
    if (picker === 'ruler' && first) patch({ rulerCharacterId: first.id });
    if (picker === 'character' && first) {
      patch({
        characterId: first.id,
        name: form.name.trim() ? form.name : politics.refs.resolveName(first),
      });
    }
    if (picker === 'parent') patch({ parentRef: first ?? null });
    if (picker === 'office') patch({ officeRef: first ?? null });
    if (picker === 'parties') patch({ parties: dedupeRefs([...form.parties, ...selection.targets]) });
    setPicker(null);
  };

  /* ---------------- 保存 ---------------- */

  const displayName = (): string =>
    form.name.trim() ||
    (kind === FIGURE_KIND && selectedCharacter ? selectedCharacter.name : '');

  const handleCreate = async (): Promise<string> => {
    const name = displayName();
    if (kind === POLITY_KIND) {
      const result = await politics.createPolity({ ...toPolityValues(form), name });
      if (result.failedLinks.length > 0) toast.error('统治者关联写入失败');
      return result.entity.id;
    }
    if (kind === ORGANIZATION_KIND) {
      const result = await politics.createOrganization({ ...toOrganizationValues(form), name });
      if (result.failedLinks.length > 0) toast.error('归属关联写入失败');
      return result.entity.id;
    }
    if (kind === FIGURE_KIND) {
      const result = await politics.createFigure({ ...toFigureValues(form), name });
      if (result.failedLinks.length > 0) toast.error('任职关联写入失败');
      return result.entity.id;
    }
    const result = await politics.createTreaty({ ...toTreatyValues(form), name });
    if (result.failedLinks.length > 0) toast.error('缔约关联写入失败');
    return result.entity.id;
  };

  /**
   * 编辑：通用字段与 kind 专属 meta 必须**一次 PUT**（第二次 PUT 会用渲染期旧快照整包覆盖 meta，
   * 把同一次保存里写的等级 / 状态 / 时间 / 备注 / 自定义字段回滚掉），边按差异补写。
   */
  const handleUpdate = async (): Promise<string> => {
    const entityId = editing!.id;
    const name = displayName();
    const metaPatch: Record<string, unknown> = {};
    if (kind === POLITY_KIND) {
      metaPatch.governmentFormLabel = cleanText(form.governmentFormLabel);
    }
    if (kind === ORGANIZATION_KIND) {
      metaPatch.scope = form.scope;
      metaPatch.orgSubtypeId = cleanText(form.orgSubtypeId);
      metaPatch.baseLabel = cleanText(form.baseLabel);
    }
    if (kind === FIGURE_KIND) {
      metaPatch.characterId = form.characterId;
      metaPatch.identityLabel = cleanText(form.identityLabel);
      metaPatch.courtRank = cleanText(form.courtRank);
      metaPatch.factionLabel = cleanText(form.factionLabel);
    }
    if (kind === TREATY_KIND) {
      metaPatch.treatyTypeId = cleanText(form.treatyTypeId);
      metaPatch.effectiveAt = cleanText(form.effectiveAt);
      metaPatch.expiresAt = cleanText(form.expiresAt);
      metaPatch.breachState = cleanText(form.breachState);
      metaPatch.visibility = cleanText(form.visibility);
      metaPatch.summary = cleanText(form.summary);
    }

    await politics.updateEntity(
      entityId,
      {
        name,
        description: form.description,
        level: form.level,
        status: form.status,
        time: toTimeSpan(form.timeStart, form.timeEnd) ?? null,
        note: form.note,
        customFields: form.customFields,
      },
      metaPatch
    );

    // 统治者：figure -> polity 的 leads 边；同一人物时职位 / 任期 / 主要 的修改也会落边（§5.2）
    if (kind === POLITY_KIND) {
      const result = await politics.setRuler(entityId, {
        characterId: form.rulerCharacterId,
        officeTitle: form.rulerOfficeTitle,
        start: form.rulerStart,
        end: form.rulerEnd,
        isPrimary: form.rulerIsPrimary,
      });
      if (result.failedLinks.length > 0) throw new Error('统治者关联写入失败');
    }

    if (kind === ORGANIZATION_KIND) {
      const currentParents = politics.links.filter(
        (link) =>
          link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
          link.source.module === POLITICS_MODULE &&
          link.source.id === entityId
      );
      const nextParent = form.parentRef ?? null;
      const unchanged =
        !!nextParent &&
        currentParents.length === 1 &&
        sameRef(currentParents[0].target, nextParent);
      // 成环 / 超过三层由 changeOrganizationParent 统一阻断（§5.7/§7.1.3）
      if (!unchanged) await politics.changeOrganizationParent(entityId, nextParent);
    }

    if (kind === FIGURE_KIND && form.officeRef) {
      // 任职边：只在本次编辑里显式选了目标时补写，避免误重复；失败必须让用户看到
      const result = await politics.createLinks(
        [
          {
            linkType: form.officeLinkType || POLITICS_LINK_TYPES.memberOf,
            target: form.officeRef,
            time: toTimeSpan(form.officeStart, form.officeEnd),
            meta: {
              officeTitle: cleanText(form.officeTitle),
              isPrimary: form.officeIsPrimary,
            },
          },
        ],
        politicsRefOf(entityId, kind)
      );
      if (result.failed > 0) throw new Error('任职关联写入失败');
    }

    if (kind === TREATY_KIND) {
      const treatyRef = politicsRefOf(entityId, kind);
      const currentLinks = politics.links.filter(
        (link) =>
          link.link_type === SIGNATORY_LINK_TYPE &&
          link.target.module === POLITICS_MODULE &&
          link.target.id === entityId
      );
      const added = form.parties.filter(
        (party) => !currentLinks.some((link) => sameRef(link.source, party))
      );
      const removed = currentLinks.filter(
        (link) => !form.parties.some((party) => sameRef(party, link.source))
      );
      for (const link of removed) await politics.deleteLink(link.id);
      for (const party of added) {
        // signatory_of 是缔约唯一规范边（§3.8.1）
        const result = await politics.createLinks(
          [{ linkType: SIGNATORY_LINK_TYPE, target: treatyRef }],
          party
        );
        if (result.failed > 0) throw new Error('缔约关联写入失败');
      }
    }

    return entityId;
  };

  const handleSubmit = async () => {
    // 自定义 kind 的创建入口不在本表单：类型与字段在模块配置里定义（§7.1），这里只保证可编辑
    if (!isBuiltinKind && !editing) {
      setError('自定义类型请在模块配置中定义后，从该类型的入口创建');
      return;
    }
    const reason = validateForm(kind, form, selectedCharacter?.name);
    if (reason) {
      setError(reason);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const entityId = editing ? await handleUpdate() : await handleCreate();
      toast.success(editing ? `已保存${kindLabel}` : `已创建${kindLabel}`);
      onSaved(entityId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- 分段渲染 ---------------- */

  const levelStatusFields = (withLevel: boolean, withStatus: boolean) => (
    <div className="flex gap-2">
      {withLevel ? (
        <div className="flex-1 space-y-1">
          <Field label="等级" required hint="rank 决定版图尺寸与布局环">
            <div className="flex gap-1.5">
              <select
                value={form.level}
                onChange={(event) => patch({ level: event.target.value })}
                aria-label="等级"
                className={fieldClass}
              >
                <option value="">未选择</option>
                {politics.levels.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}
                    {typeof def.rank === 'number' ? `（rank ${def.rank}）` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowLevelCreate((prev) => !prev)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                新建等级
              </button>
            </div>
          </Field>
          {politics.levels.length === 0 && !showLevelCreate ? (
            <p className="text-[10px] text-muted-foreground">还没有等级定义，先内联新建一个</p>
          ) : null}
          {showLevelCreate ? (
            <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
              <input
                type="text"
                value={levelDraft.label}
                onChange={(event) =>
                  setLevelDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="等级名（含义由你定义）"
                aria-label="新等级名称"
                className={fieldClass}
              />
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={levelDraft.rank}
                  onChange={(event) =>
                    setLevelDraft((prev) => ({ ...prev, rank: event.target.value }))
                  }
                  placeholder="rank"
                  aria-label="新等级 rank"
                  className={fieldClass}
                />
                <input
                  type="text"
                  value={levelDraft.color}
                  onChange={(event) =>
                    setLevelDraft((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色 token 或 hex（可选）"
                  aria-label="新等级颜色"
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={() => void handleAddLevel()}
                  className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  保存等级
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {withStatus ? (
        <div className="flex-1 space-y-1">
          <Field label="状态">
            <div className="flex gap-1.5">
              <select
                value={form.status}
                onChange={(event) => patch({ status: event.target.value })}
                aria-label="状态"
                className={fieldClass}
              >
                <option value="">未标注</option>
                {politics.statuses.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}
                    {def.isTerminal ? '（终端）' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowStatusCreate((prev) => !prev)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                新建状态
              </button>
            </div>
          </Field>
          {showStatusCreate ? (
            <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
              <input
                type="text"
                value={statusDraft.label}
                onChange={(event) =>
                  setStatusDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="状态名（含义由你定义）"
                aria-label="新状态名称"
                className={fieldClass}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={statusDraft.color}
                  onChange={(event) =>
                    setStatusDraft((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色（可选）"
                  aria-label="新状态颜色"
                  className={fieldClass}
                />
                <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={statusDraft.isTerminal}
                    onChange={(event) =>
                      setStatusDraft((prev) => ({ ...prev, isTerminal: event.target.checked }))
                    }
                  />
                  终端状态
                </label>
                <button
                  type="button"
                  onClick={() => void handleAddStatus()}
                  className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  保存状态
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderPolityFields = () => (
    <>
      <Field label="名称" required>
        <input
          type="text"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="政权名称"
          aria-label="政权名称"
          className={fieldClass}
        />
      </Field>
      {levelStatusFields(true, true)}

      <div className="space-y-1 rounded-md border border-border/50 p-2">
        <div className="text-[10px] font-medium text-foreground">统治者（可跳过）</div>
        <div className="flex items-center gap-1.5">
          {form.rulerCharacterId ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{rulerLabel}</span>
          ) : (
            <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">未选择全局角色</span>
          )}
          <button
            type="button"
            onClick={() => setPicker('ruler')}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            选择角色
          </button>
          <button
            type="button"
            onClick={() => setQuickCharacterOpen((prev) => !prev)}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            快速新建角色
          </button>
        </div>
        {quickCharacterOpen ? (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={quickCharacterName}
              onChange={(event) => setQuickCharacterName(event.target.value)}
              placeholder="只填名称即可"
              aria-label="快速新建角色名称"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => void handleQuickCreateCharacter()}
              disabled={creatingCharacter}
              className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {creatingCharacter ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              创建
            </button>
          </div>
        ) : null}
        {form.rulerCharacterId ? (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={form.rulerOfficeTitle}
              onChange={(event) => patch({ rulerOfficeTitle: event.target.value })}
              placeholder="职位 / 头衔"
              aria-label="统治者职位"
              className={fieldClass}
            />
            <input
              type="text"
              value={form.rulerStart}
              onChange={(event) => patch({ rulerStart: event.target.value })}
              placeholder="起始"
              aria-label="统治者起始"
              className={fieldClass}
            />
            <input
              type="text"
              value={form.rulerEnd}
              onChange={(event) => patch({ rulerEnd: event.target.value })}
              placeholder="结束"
              aria-label="统治者结束"
              className={fieldClass}
            />
            <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={form.rulerIsPrimary}
                onChange={(event) => patch({ rulerIsPrimary: event.target.checked })}
              />
              主要
            </label>
          </div>
        ) : null}
      </div>

      <Field label="政体" hint="其余字段创建后随时补充（§5.2 最短路径）">
        <input
          type="text"
          value={form.governmentFormLabel}
          onChange={(event) => patch({ governmentFormLabel: event.target.value })}
          placeholder="由你书写的政体标签"
          aria-label="政体"
          className={fieldClass}
        />
      </Field>
      <Field label="存续时间">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={form.timeStart}
            onChange={(event) => patch({ timeStart: event.target.value })}
            placeholder="起始"
            aria-label="政权起始"
            className={fieldClass}
          />
          <input
            type="text"
            value={form.timeEnd}
            onChange={(event) => patch({ timeEnd: event.target.value })}
            placeholder="结束"
            aria-label="政权结束"
            className={fieldClass}
          />
        </div>
      </Field>
    </>
  );

  const renderOrganizationFields = () => (
    <>
      <Field label="名称" required>
        <input
          type="text"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="组织名称"
          aria-label="组织名称"
          className={fieldClass}
        />
      </Field>
      <Field label="归属范围" required hint="政权卡入口默认「政权内」，独立势力入口改选「独立」">
        <select
          value={form.scope}
          onChange={(event) => patch({ scope: event.target.value as PoliticsScope })}
          aria-label="归属范围"
          className={fieldClass}
        >
          {POLITICS_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="上级" hint="保存时写 politics.subordinate_to，仅 organization 建树">
        <div className="flex items-center gap-1.5">
          {form.parentRef ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
              {politics.refs.resolveName(form.parentRef)}
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
              未选择政权或上级组织
            </span>
          )}
          <button
            type="button"
            onClick={() => setPicker('parent')}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            选择上级
          </button>
          {form.parentRef ? (
            <button
              type="button"
              onClick={() => patch({ parentRef: null })}
              className="shrink-0 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              清除
            </button>
          ) : null}
        </div>
      </Field>
      {levelStatusFields(true, true)}
      <div className="flex gap-1.5">
        <Field label="子类型" hint="可现场输入">
          <input
            type="text"
            value={form.orgSubtypeId}
            onChange={(event) => patch({ orgSubtypeId: event.target.value })}
            placeholder="如 军团 / 教团（由你书写）"
            aria-label="组织子类型"
            className={fieldClass}
          />
        </Field>
        <Field label="驻地">
          <input
            type="text"
            value={form.baseLabel}
            onChange={(event) => patch({ baseLabel: event.target.value })}
            placeholder="可选"
            aria-label="组织驻地"
            className={fieldClass}
          />
        </Field>
      </div>
      <Field label="存续时间">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={form.timeStart}
            onChange={(event) => patch({ timeStart: event.target.value })}
            placeholder="起始"
            aria-label="组织起始"
            className={fieldClass}
          />
          <input
            type="text"
            value={form.timeEnd}
            onChange={(event) => patch({ timeEnd: event.target.value })}
            placeholder="结束"
            aria-label="组织结束"
            className={fieldClass}
          />
        </div>
      </Field>
    </>
  );

  const renderFigureFields = () => (
    <>
      <Field label="全局角色" required hint="政治侧只存 characterId，姓名 / 头像 / 种族实时解析">
        <div className="flex items-center gap-1.5">
          {form.characterId ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
              {selectedCharacter?.name ?? '已选角色'}
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">未选择角色</span>
          )}
          <button
            type="button"
            onClick={() => setPicker('character')}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            选择角色
          </button>
          <button
            type="button"
            onClick={() => setQuickCharacterOpen((prev) => !prev)}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            快速新建角色
          </button>
        </div>
      </Field>
      {quickCharacterOpen ? (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={quickCharacterName}
            onChange={(event) => setQuickCharacterName(event.target.value)}
            placeholder="只填名称即可（种族 / 生平留到角色模块）"
            aria-label="快速新建角色名称"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => void handleQuickCreateCharacter()}
            disabled={creatingCharacter}
            className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creatingCharacter ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            创建
          </button>
        </div>
      ) : null}

      <Field label="政治显示名" hint="仅用于名录检索；详情始终显示解析后的角色名">
        <input
          type="text"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="留空则沿用角色名"
          aria-label="政治显示名"
          className={fieldClass}
        />
      </Field>

      <div className="flex gap-1.5">
        <Field label="政治身份">
          <input
            type="text"
            value={form.identityLabel}
            onChange={(event) => patch({ identityLabel: event.target.value })}
            placeholder="如 摄政 / 边将（由你书写）"
            aria-label="政治身份"
            className={fieldClass}
          />
        </Field>
        <Field label="朝位 / 头衔">
          <input
            type="text"
            value={form.courtRank}
            onChange={(event) => patch({ courtRank: event.target.value })}
            placeholder="可选"
            aria-label="朝位"
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="派系标注">
        <input
          type="text"
          value={form.factionLabel}
          onChange={(event) => patch({ factionLabel: event.target.value })}
          placeholder="可选（派系由你定义，模块不预置）"
          aria-label="派系"
          className={fieldClass}
        />
      </Field>

      <div className="space-y-1 rounded-md border border-border/50 p-2">
        <div className="text-[10px] font-medium text-foreground">任职（保存时写任职边）</div>
        <div className="flex items-center gap-1.5">
          {form.officeRef ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
              {politics.refs.resolveName(form.officeRef)}
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
              {editing ? '不选则不新增任职边（在详情里改现有任职）' : '未选择政权 / 组织'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setPicker('office')}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            选择任职目标
          </button>
        </div>
        {form.officeRef ? (
          <div className="space-y-1">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={form.officeTitle}
                onChange={(event) => patch({ officeTitle: event.target.value })}
                placeholder="职位"
                aria-label="职位"
                className={fieldClass}
              />
              <select
                value={form.officeLinkType}
                onChange={(event) => patch({ officeLinkType: event.target.value })}
                aria-label="任职边类型"
                className={fieldClass}
              >
                <option value={POLITICS_LINK_TYPES.leads}>领导（leads）</option>
                <option value={POLITICS_LINK_TYPES.memberOf}>隶属（member_of）</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={form.officeStart}
                onChange={(event) => patch({ officeStart: event.target.value })}
                placeholder="起始"
                aria-label="任职起始"
                className={fieldClass}
              />
              <input
                type="text"
                value={form.officeEnd}
                onChange={(event) => patch({ officeEnd: event.target.value })}
                placeholder="结束"
                aria-label="任职结束"
                className={fieldClass}
              />
              <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.officeIsPrimary}
                  onChange={(event) => patch({ officeIsPrimary: event.target.checked })}
                />
                主要
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  const renderTreatyFields = () => (
    <>
      <Field label="缔约方" hint="保存时每方写一条 politics.signatory_of；≥ 2 才画缎带">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {form.parties.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">未选择缔约方</span>
            ) : (
              form.parties.map((party) => (
                <span
                  key={refKey(party)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-foreground"
                >
                  {politics.refs.resolveName(party)}
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        parties: form.parties.filter((item) => !sameRef(item, party)),
                      })
                    }
                    aria-label={`移除缔约方 ${politics.refs.resolveName(party)}`}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setPicker('parties')}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            添加缔约方
          </button>
        </div>
      </Field>
      <Field label="名称" required>
        <input
          type="text"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="条约名称"
          aria-label="条约名称"
          className={fieldClass}
        />
      </Field>
      <div className="flex gap-1.5">
        <Field label="类型" hint="用户自定义标签">
          <input
            type="text"
            value={form.treatyTypeId}
            onChange={(event) => patch({ treatyTypeId: event.target.value })}
            placeholder="由你书写"
            aria-label="条约类型"
            className={fieldClass}
          />
        </Field>
      </div>
      {levelStatusFields(false, true)}
      <Field label="生效 / 到期">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={form.effectiveAt}
            onChange={(event) => patch({ effectiveAt: event.target.value })}
            placeholder="生效"
            aria-label="生效时间"
            className={fieldClass}
          />
          <input
            type="text"
            value={form.expiresAt}
            onChange={(event) => patch({ expiresAt: event.target.value })}
            placeholder="到期"
            aria-label="到期时间"
            className={fieldClass}
          />
        </div>
      </Field>
      <Field label="摘要">
        <textarea
          value={form.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          rows={2}
          placeholder="可选；条款创建后在详情里补充"
          aria-label="条约摘要"
          className={fieldClass}
        />
      </Field>
    </>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`${editing ? '编辑' : '新建'}${kindLabel}`}
      size="lg"
    >
      <div className="space-y-2.5" data-testid="politics-form-modal" data-kind={kind}>
        {error ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
            data-testid="politics-form-error"
          >
            {error}
          </div>
        ) : null}
        {warning ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            {warning}
          </div>
        ) : null}

        {kind === POLITY_KIND ? renderPolityFields() : null}
        {kind === ORGANIZATION_KIND ? renderOrganizationFields() : null}
        {kind === FIGURE_KIND ? renderFigureFields() : null}
        {kind === TREATY_KIND ? renderTreatyFields() : null}
        {!isBuiltinKind ? (
          <>
            <Field label="名称" required>
              <input
                type="text"
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder={`${kindLabel}名称`}
                aria-label="名称"
                className={fieldClass}
              />
            </Field>
            {levelStatusFields(true, true)}
            <Field label="存续时间">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={form.timeStart}
                  onChange={(event) => patch({ timeStart: event.target.value })}
                  placeholder="起始"
                  aria-label="起始"
                  className={fieldClass}
                />
                <input
                  type="text"
                  value={form.timeEnd}
                  onChange={(event) => patch({ timeEnd: event.target.value })}
                  placeholder="结束"
                  aria-label="结束"
                  className={fieldClass}
                />
              </div>
            </Field>
            <p className="text-[10px] text-muted-foreground">
              自定义 kind 继承其附着层的形态，不复制新的分段（§7.1.5）
            </p>
          </>
        ) : null}

        {!editing ? (
          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            className="text-left text-[10px] text-primary transition-colors hover:underline"
          >
            {showMore ? '收起更多字段' : '更多字段：描述 / 备注 / 自定义字段（创建后补充）'}
          </button>
        ) : null}

        {editing || showMore ? (
          <>
            <Field label="描述">
              <textarea
                value={form.description}
                onChange={(event) => patch({ description: event.target.value })}
                rows={2}
                placeholder="可选"
                aria-label="描述"
                className={fieldClass}
              />
            </Field>
            <Field label="备注">
              <input
                type="text"
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
                placeholder="可选；支持 @ 行内引用（在详情面板维护）"
                aria-label="备注"
                className={fieldClass}
              />
            </Field>

            {customFields.length > 0 ? (
              <div className="rounded-md border border-border/50 p-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-foreground">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  自定义字段（来自模块配置）
                </div>
                <CustomFieldRenderer
                  fields={customFields}
                  values={form.customFields}
                  onChange={(fieldId, value: CustomFieldValue) =>
                    patch({ customFields: writeCustomField(form.customFields, fieldId, value) })
                  }
                />
              </div>
            ) : null}
          </>
        ) : null}

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
            disabled={submitting}
            data-testid="politics-form-submit"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {editing ? '保存' : kind === POLITY_KIND ? '创建并聚焦' : '创建'}
          </button>
        </div>
      </div>

      <EntityPicker
        open={picker !== null}
        worldId={politics.worldId}
        source={
          editing
            ? politicsRefOf(editing.id, editing.kind)
            : politicsRefOf('new', kind || POLITY_KIND)
        }
        presetModule={
          picker === 'ruler' || picker === 'character' ? 'character' : 'politics'
        }
        kindFilter={
          picker === 'ruler' || picker === 'character' ? ['character'] : ['polity', 'organization']
        }
        multi={picker === 'parties'}
        simpleMode={picker === 'ruler' || picker === 'character'}
        onClose={() => setPicker(null)}
        onConfirm={handlePickerConfirm}
        isSubmitting={submitting}
      />
    </Modal>
  );
};

export default PoliticsFormModal;
