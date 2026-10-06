/**
 * ModuleConfigPanel（Phase 3 P3-T8；契约 §2.7、races_ui_design §7、systems_ui_design §7）
 *
 * 草稿显式保存：所有编辑只改本地 draft，点「保存」才写回 module.config；校验失败不生效。
 * 覆盖通用键（entityTypes / fieldSchema / statuses / levels / terminology / defaultComplexity /
 * displayMode）与模块专属键（races: relationKinds、emblemPalette、cardFields；
 * systems: tierTerm、rankStep、nodeStyles、costFields）。
 * 未知键不参与编辑但也不会被删除（保存是浅合并补丁）。
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Check,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';
import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  CUSTOM_KIND_PREFIX,
  kindDefsOf,
  toKindId,
  validateEntityType,
  type CustomFieldDef,
  type CustomFieldType,
  type EntityTypeDef,
  type LevelDef,
  type ModuleConfig,
  type RelationKindDef,
  type StatusDef,
} from './moduleConfig';
import { lucideIcon } from './lucideIcon';

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'textarea',
  'number',
  'select',
  'date',
  'entityRef',
  'image',
];

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: '单行文本',
  textarea: '多行文本',
  number: '数字',
  select: '选项',
  date: '日期',
  entityRef: '实体引用',
  image: '图片',
};

/** 由名称生成字段 id（ASCII 字母数字下划线，保留中文标签） */
const toFieldId = (label: string, taken: string[]): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';
  let candidate = base;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
};

const asDefs = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** 稳定深比较：只用于判断某个键相对初始基线是否被用户改过 */
const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ModuleConfigPanelProps {
  open: boolean;
  onClose: () => void;
  /** 解析后的配置（默认值 + 后端 config），作为草稿初值 */
  config: ModuleConfig;
  /** 后端原始 config（可选，仅用于兼容调用方；保存仍是浅合并补丁） */
  rawConfig?: ModuleConfig;
  /** 保存补丁（由 useModuleConfig().save 承担浅合并与 PUT） */
  onSave: (patch: ModuleConfig) => Promise<void>;
  /** 内置 kind：不可删除，作为 parentKind 解析基准 */
  builtins: EntityTypeDef[];
  /** 该模块允许的最大层级（races=2、systems=3） */
  maxDepth: number;
  /** 模块专属配置段；不传时按 config 里出现的键自动识别 */
  moduleType?: 'races' | 'systems' | string;
  /** 额外自定义区（可选；模块专属键已由 moduleType / 自动识别覆盖） */
  extra?: ReactNode;
  title?: string;
}

type PanelTab = 'types' | 'fields' | 'statuses' | 'terms' | 'module';

export const ModuleConfigPanel = ({
  open,
  onClose,
  config,
  rawConfig,
  onSave,
  builtins,
  maxDepth,
  moduleType,
  extra,
  title = '模块配置',
}: ModuleConfigPanelProps) => {
  const [draft, setDraft] = useState<ModuleConfig>({});
  const [tab, setTab] = useState<PanelTab>('types');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);
  /** 打开面板时的配置基线：保存时只提交与它不同的键（见 buildPatch） */
  const baselineRef = useRef<ModuleConfig>({});
  /** 后端真实存着的 config：对象键（fieldSchema/terminology/nodeStyles）要基于它做增量，避免丢掉未编辑的子键 */
  const storedRef = useRef<ModuleConfig>({});

  // 只在打开时初始化草稿：避免父组件每次渲染产生的新对象把草稿重置掉
  useEffect(() => {
    if (open && !wasOpen.current) {
      // rawConfig 仅在调用方显式传入时覆盖同名键（通常与 config 同源）
      const initial = { ...config, ...(rawConfig ?? {}) };
      baselineRef.current = initial;
      storedRef.current = rawConfig ?? {};
      setDraft(initial);
      setError(null);
      setNotice(null);
      setTab('types');
    }
    wasOpen.current = open;
  }, [open, config, rawConfig]);

  const kinds = useMemo(() => kindDefsOf(draft, builtins), [draft, builtins]);
  const builtinIds = useMemo(() => builtins.map((def) => def.id), [builtins]);
  const builtinIdSet = useMemo(() => new Set(builtinIds), [builtinIds]);

  // 模块专属键自动识别：调用方即使不传 moduleType，races/systems 的键也能编辑并落库
  const hasRacesKeys =
    moduleType === 'races' ||
    (!moduleType && (config.relationKinds !== undefined || config.emblemPalette !== undefined));
  const hasSystemsKeys =
    moduleType === 'systems' ||
    (!moduleType &&
      (config.tierTerm !== undefined ||
        config.rankStep !== undefined ||
        config.nodeStyles !== undefined));
  const showModuleTab = hasRacesKeys || hasSystemsKeys;

  const patchDraft = (patch: ModuleConfig) => setDraft((prev) => ({ ...prev, ...patch }));

  // ---- 类型 ----

  const [newKind, setNewKind] = useState({
    label: '',
    parentKind: builtins.find((def) => !def.parentKind)?.id ?? builtins[0]?.id ?? '',
    icon: '',
    color: '',
  });

  const addKind = () => {
    const label = newKind.label.trim();
    if (!label) {
      setError('类型名称不能为空');
      return;
    }
    const id = toKindId(label, kinds.map((def) => def.id));
    const def: EntityTypeDef = {
      id,
      label,
      parentKind: newKind.parentKind || undefined,
      icon: newKind.icon.trim() || undefined,
      color: newKind.color.trim() || undefined,
    };
    const reason = validateEntityType(draft, def, { builtins, maxDepth });
    if (reason) {
      setError(reason);
      return;
    }
    patchDraft({ entityTypes: [...asDefs<EntityTypeDef>(draft.entityTypes), def] });
    setNewKind((prev) => ({ ...prev, label: '', icon: '', color: '' }));
    setError(null);
  };

  const removeKind = (id: string) => {
    // 只摘掉类型定义：fieldSchema[id] 的字段定义保留，重新添加同 id 类型后继续生效
    patchDraft({
      entityTypes: asDefs<EntityTypeDef>(draft.entityTypes).filter((def) => def.id !== id),
    });
    setNotice(
      `已移除类型 ${id}：已有实体仍保留原 kind 与 meta，详情页会按未知类型回退展示；字段定义仍保留，重新添加同 id 的类型后会再次生效。`
    );
  };

  // ---- 字段 ----

  const [fieldKind, setFieldKind] = useState(builtins[0]?.id ?? '');
  const [newField, setNewField] = useState({
    label: '',
    type: 'text' as CustomFieldType,
    options: '',
    group: '',
  });

  const activeFieldKind = kinds.some((def) => def.id === fieldKind)
    ? fieldKind
    : kinds[0]?.id ?? '';

  // 语义必须与 customFieldsOf 一致：空数组不算显式定义，回退内置 defaultFields
  const fieldsOfKind = (kindId: string): CustomFieldDef[] => {
    const explicit = draft.fieldSchema?.[kindId];
    if (Array.isArray(explicit) && explicit.length > 0) return explicit;
    return builtins.find((def) => def.id === kindId)?.defaultFields ?? [];
  };

  const setFieldsOfKind = (kindId: string, fields: CustomFieldDef[]) =>
    patchDraft({ fieldSchema: { ...(draft.fieldSchema ?? {}), [kindId]: fields } });

  const addField = () => {
    const label = newField.label.trim();
    if (!label) {
      setError('字段名称不能为空');
      return;
    }
    const current = fieldsOfKind(activeFieldKind);
    const id = toFieldId(label, current.map((field) => field.id));
    const def: CustomFieldDef = {
      id,
      label,
      type: newField.type,
      options:
        newField.type === 'select'
          ? newField.options
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      group: newField.group.trim() || undefined,
    };
    setFieldsOfKind(activeFieldKind, [...current, def]);
    setNewField({ label: '', type: 'text', options: '', group: '' });
    setError(null);
  };

  const removeField = (kindId: string, fieldId: string) => {
    setFieldsOfKind(
      kindId,
      fieldsOfKind(kindId).filter((field) => field.id !== fieldId)
    );
    setNotice(
      `字段 ${fieldId} 已从 schema 移除：已填数据仍保存在 meta.customFields / item.content，详情页不再渲染该字段。`
    );
  };

  // ---- 状态与等级 ----

  const [newStatus, setNewStatus] = useState({ label: '', color: '' });
  const [newLevel, setNewLevel] = useState({ label: '' });

  const addStatus = () => {
    const label = newStatus.label.trim();
    if (!label) return;
    const id = toFieldId(label, asDefs<StatusDef>(draft.statuses).map((item) => item.id));
    patchDraft({
      statuses: [
        ...asDefs<StatusDef>(draft.statuses),
        { id, label, color: newStatus.color.trim() || undefined },
      ],
    });
    setNewStatus({ label: '', color: '' });
  };

  const addLevel = () => {
    const label = newLevel.label.trim();
    if (!label) return;
    const id = toFieldId(label, asDefs<LevelDef>(draft.levels).map((item) => item.id));
    patchDraft({ levels: [...asDefs<LevelDef>(draft.levels), { id, label }] });
    setNewLevel({ label: '' });
  };

  // ---- 术语 ----

  const [newTerm, setNewTerm] = useState({ key: '', value: '' });

  const addTerm = () => {
    const key = newTerm.key.trim();
    const value = newTerm.value.trim();
    if (!key || !value) return;
    patchDraft({ terminology: { ...(draft.terminology ?? {}), [key]: value } });
    setNewTerm({ key: '', value: '' });
  };

  // ---- 模块专属 ----

  const [newRelationKind, setNewRelationKind] = useState({
    id: '',
    label: '',
    color: '',
    lineStyle: 'dashed' as RelationKindDef['lineStyle'],
  });

  const addRelationKind = () => {
    const label = newRelationKind.label.trim();
    if (!label) return;
    const id =
      newRelationKind.id.trim() ||
      toFieldId(label, asDefs<RelationKindDef>(draft.relationKinds).map((item) => item.id));
    const def: RelationKindDef = {
      id,
      label,
      color: newRelationKind.color.trim() || undefined,
      lineStyle: newRelationKind.lineStyle ?? 'dashed',
    };
    patchDraft({
      relationKinds: [...asDefs<RelationKindDef>(draft.relationKinds), def],
    });
    setNewRelationKind({ id: '', label: '', color: '', lineStyle: 'dashed' });
  };

  // ---- 保存 ----

  /**
   * 只提交相对打开时基线有变化的键：调用方传进来的 config 是「解析后配置」（已叠加前端默认值），
   * 全量提交会把 EMBLEM_PALETTE / DEFAULT_NODE_STYLES / cardFields 等预设冻结进 module.config，
   * 之后前端默认值再改就不生效了。save 是把补丁浅合并回后端原始 config，未改动的键保持原样。
   * 对象键（fieldSchema / terminology / nodeStyles）按子键差分，只提交新增或有改动的子键；
   * 子键被删除时整份提交（浅合并没有别的办法删掉旧子键）。
   */
  const buildPatch = (source: ModuleConfig, baseline: ModuleConfig): ModuleConfig => {
    const built: ModuleConfig = {
      entityTypes: asDefs<EntityTypeDef>(source.entityTypes),
      fieldSchema: source.fieldSchema ?? {},
      statuses: asDefs<StatusDef>(source.statuses),
      levels: asDefs<LevelDef>(source.levels),
      terminology: source.terminology ?? {},
      defaultComplexity: source.defaultComplexity,
      displayMode: source.displayMode,
    };
    if (hasRacesKeys) {
      built.relationKinds = asDefs<RelationKindDef>(source.relationKinds);
      built.emblemPalette = asDefs<string>(source.emblemPalette);
      built.cardFields = asDefs<string>(source.cardFields);
    }
    if (hasSystemsKeys) {
      built.tierTerm = source.tierTerm;
      built.rankStep = source.rankStep;
      built.nodeStyles = source.nodeStyles ?? {};
      built.costFields = asDefs<string>(source.costFields);
    }

    const patch: ModuleConfig = {};
    for (const [key, value] of Object.entries(built)) {
      // undefined 经浅合并会被跳过，没必要写进补丁
      if (value === undefined) continue;
      const base = baseline[key];
      if (isRecord(value)) {
        const draftRecord = value;
        const baseRecord = isRecord(base) ? base : {};
        // 注意：save 是把补丁**浅合并**到后端原始 config（mergeModuleConfig 只做顶层合并），
        // 所以对象键必须提交「完整的目标对象」——只提交改动子键会把未编辑的同级子键整片抹掉。
        const storedRecord = isRecord(storedRef.current[key]) ? storedRef.current[key] : {};
        const changed: Record<string, unknown> = {};
        for (const [subKey, subValue] of Object.entries(draftRecord)) {
          if (!sameJson(subValue, baseRecord[subKey])) changed[subKey] = subValue;
        }
        // 用户显式删掉的子键：基线里有、草稿里没有
        const removedKeys = Object.keys(baseRecord).filter((subKey) => !(subKey in draftRecord));
        if (Object.keys(changed).length > 0 || removedKeys.length > 0) {
          const next: Record<string, unknown> = { ...storedRecord, ...changed };
          for (const subKey of removedKeys) delete next[subKey];
          patch[key] = next;
        }
        continue;
      }
      if (!sameJson(value, base)) patch[key] = value;
    }
    return patch;
  };

  const validateDraft = (source: ModuleConfig): string | null => {
    const customKinds = asDefs<EntityTypeDef>(source.entityTypes).filter(
      (def) => !builtinIdSet.has(def.id)
    );
    for (const def of customKinds) {
      const reason = validateEntityType(source, def, { builtins, maxDepth });
      if (reason) return `${def.label || def.id}：${reason}`;
    }
    const ids = asDefs<EntityTypeDef>(source.entityTypes).map((def) => def.id);
    if (new Set(ids).size !== ids.length) return '类型 id 存在重复';
    for (const [kind, fields] of Object.entries(source.fieldSchema ?? {})) {
      const fieldIds = fields.map((field) => field.id);
      if (new Set(fieldIds).size !== fieldIds.length) {
        return `${kind} 的字段 id 存在重复`;
      }
      if (fields.some((field) => !field.id || !field.label)) {
        return `${kind} 存在缺少 id 或名称的字段`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const reason = validateDraft(draft);
    if (reason) {
      setError(reason);
      setNotice('校验失败，配置未保存。');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(buildPatch(draft, baselineRef.current));
      onClose();
    } catch (saveError) {
      // save 失败（网络 / 后端校验）时面板保持打开，把原因显示在错误框里
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'types', label: '类型' },
    { id: 'fields', label: '字段' },
    { id: 'statuses', label: '状态与等级' },
    { id: 'terms', label: '术语与视图' },
    ...(showModuleTab ? [{ id: 'module' as PanelTab, label: '模块专属' }] : []),
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-3" data-testid="module-config-panel">
        <div role="tablist" aria-label="配置分区" className="flex flex-wrap gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                tab === item.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
            data-testid="config-error"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
            {notice}
          </div>
        )}

        {tab === 'types' && (
          <div className="space-y-2" data-testid="config-types">
            <div className="space-y-1">
              {kinds.map((def) => {
                const builtin = builtinIdSet.has(def.id);
                const Icon = lucideIcon(def.icon);
                return (
                  <div
                    key={def.id}
                    className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                    data-testid="config-kind-row"
                    data-kind-id={def.id}
                  >
                    {Icon ? (
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-border/60"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-[11px] font-medium text-foreground">{def.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{def.id}</span>
                    {def.parentKind && (
                      <span className="text-[10px] text-muted-foreground">
                        父级 {def.parentKind}
                      </span>
                    )}
                    {builtin ? (
                      <span className="ml-auto rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground">
                        内置
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`删除类型 ${def.label}`}
                        onClick={() => removeKind(def.id)}
                        className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5 rounded-md border border-border/40 p-2">
              <div className="text-[11px] font-medium text-foreground">新增自定义类型</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKind.label}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="类型名称"
                  aria-label="类型名称"
                  className={FIELD_CLASS}
                />
                <select
                  value={newKind.parentKind}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, parentKind: event.target.value }))
                  }
                  aria-label="父级类型"
                  className={FIELD_CLASS}
                >
                  {kinds.map((def) => (
                    <option key={def.id} value={def.id}>
                      父级：{def.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKind.icon}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, icon: event.target.value }))
                  }
                  placeholder="Lucide 图标名，如 book-marked"
                  aria-label="图标名"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newKind.color}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色 token 或 hex"
                  aria-label="颜色"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addKind}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                自定义类型 id 自动生成为 {CUSTOM_KIND_PREFIX}*，必须声明父级；最多 {maxDepth} 层。
              </p>
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="space-y-2" data-testid="config-fields">
            <select
              value={activeFieldKind}
              onChange={(event) => setFieldKind(event.target.value)}
              aria-label="选择类型"
              className={FIELD_CLASS}
            >
              {kinds.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.label}（{def.id}）
                </option>
              ))}
            </select>

            <div className="space-y-1">
              {fieldsOfKind(activeFieldKind).map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                  data-testid="config-field-row"
                  data-field-id={field.id}
                >
                  <span className="text-[11px] font-medium text-foreground">{field.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{field.id}</span>
                  <span className="rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground">
                    {FIELD_TYPE_LABELS[field.type] ?? field.type}
                  </span>
                  {field.group && (
                    <span className="text-[10px] text-muted-foreground">组 {field.group}</span>
                  )}
                  <button
                    type="button"
                    aria-label={`删除字段 ${field.label}`}
                    onClick={() => removeField(activeFieldKind, field.id)}
                    className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {fieldsOfKind(activeFieldKind).length === 0 && (
                <p className="text-[11px] text-muted-foreground">该类型暂无自定义字段</p>
              )}
            </div>

            <div className="space-y-1.5 rounded-md border border-border/40 p-2">
              <div className="text-[11px] font-medium text-foreground">新增字段</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newField.label}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="字段名称"
                  aria-label="字段名称"
                  className={FIELD_CLASS}
                />
                <select
                  value={newField.type}
                  onChange={(event) =>
                    setNewField((prev) => ({
                      ...prev,
                      type: event.target.value as CustomFieldType,
                    }))
                  }
                  aria-label="字段类型"
                  className={FIELD_CLASS}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newField.options}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, options: event.target.value }))
                  }
                  placeholder="选项（逗号分隔，仅选项类型用）"
                  aria-label="字段选项"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newField.group}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, group: event.target.value }))
                  }
                  placeholder="字段组（可选）"
                  aria-label="字段组"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addField}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                删除字段只影响渲染；已填数据保留在 meta.customFields 或 item.content 中。
              </p>
            </div>
          </div>
        )}

        {tab === 'statuses' && (
          <div className="space-y-3" data-testid="config-statuses">
            <div className="space-y-1">
              {asDefs<StatusDef>(draft.statuses).map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                >
                  <span className="text-[11px]">{status.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{status.id}</span>
                  <button
                    type="button"
                    aria-label={`删除状态 ${status.label}`}
                    onClick={() =>
                      patchDraft({
                        statuses: asDefs<StatusDef>(draft.statuses).filter(
                          (item) => item.id !== status.id
                        ),
                      })
                    }
                    className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStatus.label}
                  onChange={(event) =>
                    setNewStatus((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="状态名，如 存续"
                  aria-label="状态名"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newStatus.color}
                  onChange={(event) =>
                    setNewStatus((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色（可选）"
                  aria-label="状态颜色"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addStatus}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  状态
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {asDefs<LevelDef>(draft.levels).map((level) => (
                <div
                  key={level.id}
                  className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                >
                  <span className="text-[11px]">{level.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{level.id}</span>
                  <button
                    type="button"
                    aria-label={`删除等级 ${level.label}`}
                    onClick={() =>
                      patchDraft({
                        levels: asDefs<LevelDef>(draft.levels).filter(
                          (item) => item.id !== level.id
                        ),
                      })
                    }
                    className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLevel.label}
                  onChange={(event) =>
                    setNewLevel((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="等级名（含义由用户定义）"
                  aria-label="等级名"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addLevel}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  等级
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'terms' && (
          <div className="space-y-3" data-testid="config-terms">
            <div className="flex gap-2">
              <label className="flex-1 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  默认复杂度
                </span>
                <select
                  value={draft.defaultComplexity ?? 'sketch'}
                  onChange={(event) =>
                    patchDraft({ defaultComplexity: event.target.value as ComplexityLevel })
                  }
                  className={FIELD_CLASS}
                >
                  <option value="sketch">速写</option>
                  <option value="structure">结构</option>
                  <option value="sandbox">沙盘</option>
                </select>
              </label>
              <label className="flex-1 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  默认视图
                </span>
                <input
                  type="text"
                  value={draft.displayMode ?? ''}
                  onChange={(event) => patchDraft({ displayMode: event.target.value })}
                  placeholder="如 atlas / stair"
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="space-y-1">
              {Object.entries(draft.terminology ?? {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{key}</span>
                  <input
                    type="text"
                    value={value}
                    aria-label={`术语 ${key}`}
                    onChange={(event) =>
                      patchDraft({
                        terminology: { ...(draft.terminology ?? {}), [key]: event.target.value },
                      })
                    }
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    aria-label={`删除术语 ${key}`}
                    onClick={() => {
                      const next = { ...(draft.terminology ?? {}) };
                      delete next[key];
                      patchDraft({ terminology: next });
                    }}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTerm.key}
                  onChange={(event) =>
                    setNewTerm((prev) => ({ ...prev, key: event.target.value }))
                  }
                  placeholder="键，如 race"
                  aria-label="术语键"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newTerm.value}
                  onChange={(event) =>
                    setNewTerm((prev) => ({ ...prev, value: event.target.value }))
                  }
                  placeholder="展示名，如 族裔"
                  aria-label="术语值"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addTerm}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  术语
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'module' && hasRacesKeys && (
          <div className="space-y-3" data-testid="config-races">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">血缘语义分色</div>
              {asDefs<RelationKindDef>(draft.relationKinds).map((kind) => (
                <div
                  key={kind.id}
                  className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1"
                  data-testid="config-relation-kind"
                >
                  <span className="text-[11px]">{kind.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{kind.id}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {kind.lineStyle ?? 'dashed'}
                  </span>
                  <button
                    type="button"
                    aria-label={`删除关系语义 ${kind.label}`}
                    onClick={() =>
                      patchDraft({
                        relationKinds: asDefs<RelationKindDef>(draft.relationKinds).filter(
                          (item) => item.id !== kind.id
                        ),
                      })
                    }
                    className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRelationKind.label}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="语义名，如 宿敌"
                  aria-label="关系语义名"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newRelationKind.color}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色"
                  aria-label="关系语义颜色"
                  className={FIELD_CLASS}
                />
                <select
                  value={newRelationKind.lineStyle}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({
                      ...prev,
                      lineStyle: event.target.value as RelationKindDef['lineStyle'],
                    }))
                  }
                  aria-label="线型"
                  className={FIELD_CLASS}
                >
                  <option value="solid">实线</option>
                  <option value="dashed">虚线</option>
                  <option value="double">双线</option>
                </select>
                <button
                  type="button"
                  onClick={addRelationKind}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">纹章色板</div>
              <div className="flex flex-wrap items-center gap-1">
                {asDefs<string>(draft.emblemPalette).map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="flex items-center gap-1 rounded-md border border-border/40 px-1.5 py-0.5"
                  >
                    <span
                      className="h-3 w-3 rounded-sm border border-border/60"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={color}
                      aria-label={`色板颜色 ${index + 1}`}
                      onChange={(event) =>
                        patchDraft({
                          emblemPalette: asDefs<string>(draft.emblemPalette).map(
                            (item, position) =>
                              position === index ? event.target.value : item
                          ),
                        })
                      }
                      className={`${FIELD_CLASS} w-24`}
                    />
                    <button
                      type="button"
                      aria-label={`删除色板颜色 ${color}`}
                      onClick={() =>
                        patchDraft({
                          emblemPalette: asDefs<string>(draft.emblemPalette).filter(
                            (_, position) => position !== index
                          ),
                        })
                      }
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    patchDraft({
                      emblemPalette: [...asDefs<string>(draft.emblemPalette), '#0f766e'],
                    })
                  }
                  className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-accent/30"
                >
                  <Plus className="h-3 w-3" />
                  颜色
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'module' && hasSystemsKeys && (
          <div className="space-y-3" data-testid="config-systems">
            <div className="flex gap-2">
              <label className="flex-1 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  阶位术语
                </span>
                <input
                  type="text"
                  value={draft.tierTerm ?? ''}
                  onChange={(event) => patchDraft({ tierTerm: event.target.value })}
                  placeholder="阶位 / 境界 / 等级"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex-1 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  新建步长
                </span>
                <input
                  type="number"
                  value={draft.rankStep ?? 10}
                  onChange={(event) =>
                    patchDraft({ rankStep: Number(event.target.value) || 10 })
                  }
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">节点样式（kind 对应图标与颜色）</div>
              {kinds.map((def) => {
                const kind = def.id;
                const style = draft.nodeStyles?.[kind];
                return (
                  <div key={kind} className="flex items-center gap-2">
                    <span className="w-24 font-mono text-[10px] text-muted-foreground">
                      {kind}
                    </span>
                    <input
                      type="text"
                      value={style?.icon ?? ''}
                      aria-label={`${kind} 图标`}
                      onChange={(event) =>
                        patchDraft({
                          nodeStyles: {
                            ...(draft.nodeStyles ?? {}),
                            [kind]: {
                              ...(draft.nodeStyles?.[kind] ?? {}),
                              icon: event.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Lucide 图标名"
                      className={FIELD_CLASS}
                    />
                    <input
                      type="text"
                      value={style?.color ?? ''}
                      aria-label={`${kind} 颜色`}
                      onChange={(event) =>
                        patchDraft({
                          nodeStyles: {
                            ...(draft.nodeStyles ?? {}),
                            [kind]: {
                              ...(draft.nodeStyles?.[kind] ?? {}),
                              color: event.target.value,
                            },
                          },
                        })
                      }
                      placeholder="颜色"
                      className={FIELD_CLASS}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                代价表单字段顺序（逗号分隔）
              </span>
              <input
                type="text"
                value={asDefs<string>(draft.costFields).join(', ')}
                aria-label="代价字段顺序"
                onChange={(event) =>
                  patchDraft({
                    costFields: event.target.value
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                className={FIELD_CLASS}
              />
            </div>
          </div>
        )}

        {extra}

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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            保存配置
          </button>
        </div>
      </div>
    </Modal>
  );
};
