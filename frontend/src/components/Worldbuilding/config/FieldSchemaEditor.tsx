/**
 * FieldSchemaEditor（Phase 6 P6-T4；契约 §2.7 / §4.3、worldbuilding_ui_design §4.3）
 *
 * 按 kind 分组的自定义字段编辑器：支持契约的八种字段类型
 * （text / textarea / number / select / multiselect / date / entityRef / image）与属性
 * 标签、必填、默认值、占位提示、选项、可见复杂度、字段组、排序。
 *
 * 口径：
 * - 删除是归档：archiveField 只把字段标记 archived: true，已填数据保留在
 *   meta.customFields / item.content，界面不再渲染，可随时恢复（设计 §4.3）；
 * - entityRef 字段只保存 EntityRef，不创建 WorldLink 记录（契约 §2.7 / §4.3）；
 * - 草稿显式保存：所有编辑只改本地字段表，点「保存」才调用 onSave（浅合并 + PUT）；
 * - 未知键（含旧字段的额外属性）一律原样保留，不因编辑丢失。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Check,
  Plus,
  Save,
  X,
} from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';
import {
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  activeFieldsOf,
  archiveField,
  formatFieldDefaultValue,
  kindDefsOf,
  nextFieldOrder,
  parseFieldDefaultValue,
  restoreField,
  sortFields,
  toFieldId,
  updateField,
  type CustomFieldDef,
  type CustomFieldType,
  type EntityTypeDef,
  type ModuleConfig,
} from '../shared/moduleConfig';

/** 契约 §2.7 的八种字段类型（导出便于验收断言；拷贝一份避免调用方改动共享常量） */
export const FIELD_TYPE_IDS: CustomFieldType[] = [...CUSTOM_FIELD_TYPES];

export const FIELD_TYPE_LABELS = CUSTOM_FIELD_TYPE_LABELS;

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

const INLINE_FIELD_CLASS =
  'bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

export interface FieldSchemaEditorProps {
  open: boolean;
  onClose: () => void;
  moduleId: string;
  builtins: EntityTypeDef[];
  /** 解析后的模块配置（草稿初值） */
  config: ModuleConfig;
  /** 保存补丁（由 useModuleConfig().save 承担浅合并 + PUT /modules/{id}） */
  onSave: (patch: ModuleConfig) => Promise<void>;
  /** 初始选中的 kind */
  initialKind?: string;
}

/** 该 kind 的字段定义：显式定义优先，空数组回退内置 defaultFields（与 customFieldsOf 同口径） */
export const fieldsForKind = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[]
): CustomFieldDef[] => {
  const explicit = config.fieldSchema?.[kind];
  if (Array.isArray(explicit) && explicit.length > 0) {
    return [...explicit].filter((field) => !!field?.id);
  }
  return builtins.find((def) => def.id === kind)?.defaultFields ?? [];
};

export const FieldSchemaEditorPanel = ({
  open,
  onClose,
  moduleId,
  builtins,
  config,
  onSave,
  initialKind,
}: FieldSchemaEditorProps) => {
  const kinds = useMemo(() => kindDefsOf(config, builtins), [config, builtins]);
  const [activeKind, setActiveKind] = useState(initialKind ?? kinds[0]?.id ?? '');
  const [schema, setSchema] = useState<Record<string, CustomFieldDef[]>>(
    () => config.fieldSchema ?? {}
  );
  /** 打开时每种 kind 的字段表（保存时用于差分，避免把未编辑的 kind 一起提交） */
  const [baseline, setBaseline] = useState<Record<string, CustomFieldDef[]>>(
    () => config.fieldSchema ?? {}
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  /**
   * 逗号列表输入框的原文草稿（键 = `${field.id}:options` / `:default`）。
   * 不能直接用数组 join 回写：`a,` split 后会被 filter 掉空项，React 回写抹掉刚输入的逗号，
   * 继续输入的字符就粘成了 `ab`，只能靠粘贴录入。
   */
  const [listText, setListText] = useState<Record<string, string>>({});
  const wasOpen = useRef(false);

  // 只在打开时初始化草稿：父组件每次渲染产生的新对象不应把编辑中的草稿重置掉
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSchema(config.fieldSchema ?? {});
      setBaseline(config.fieldSchema ?? {});
      setActiveKind(initialKind ?? kinds[0]?.id ?? '');
      setListText({});
      setError(null);
    }
    wasOpen.current = open;
  }, [open, initialKind, kinds, config.fieldSchema]);

  const resolvedKind = kinds.some((def) => def.id === activeKind)
    ? activeKind
    : kinds[0]?.id ?? '';

  const fields = useMemo(
    () => fieldsForKind({ ...config, fieldSchema: schema }, resolvedKind, builtins),
    [config, schema, resolvedKind, builtins]
  );
  const visible = activeFieldsOf(fields);
  const archived = sortFields(fields.filter((field) => field.archived));

  const [newField, setNewField] = useState({
    label: '',
    type: 'text' as CustomFieldType,
    group: '',
    placeholder: '',
    options: '',
    visibleComplexity: 'sketch' as string,
  });

  const setFields = (kindId: string, next: CustomFieldDef[]) =>
    setSchema((prev) => ({ ...prev, [kindId]: next }));

  const patchField = (id: string, patch: Partial<CustomFieldDef>) =>
    setFields(resolvedKind, updateField(fields, id, patch));

  const addField = () => {
    const label = newField.label.trim();
    if (!label) {
      setError('字段名称不能为空');
      return;
    }
    const id = toFieldId(label, fields.map((field) => field.id));
    const def: CustomFieldDef = {
      id,
      label,
      type: newField.type,
      order: nextFieldOrder(fields),
      required: false,
      group: newField.group.trim() || undefined,
      placeholder: newField.placeholder.trim() || undefined,
      visibleComplexity: newField.visibleComplexity as CustomFieldDef['visibleComplexity'],
      options:
        newField.type === 'select' || newField.type === 'multiselect'
          ? newField.options
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      entityRefFilter: newField.type === 'entityRef' ? { module: undefined } : undefined,
    };
    setFields(resolvedKind, [...fields, def]);
    setNewField({
      label: '',
      type: 'text',
      group: '',
      placeholder: '',
      options: '',
      visibleComplexity: 'sketch',
    });
    setError(null);
  };

  const removeField = (id: string) => {
    setFields(resolvedKind, archiveField(fields, id));
    setError(null);
  };

  const handleSave = async () => {
    // 校验：id 唯一 + 名称非空（归档字段同样要在 schema 里保持可识别）
    for (const [kind, list] of Object.entries(schema)) {
      const ids = list.map((field) => field.id);
      if (new Set(ids).size !== ids.length) {
        setError(`${kind} 的字段 id 存在重复`);
        return;
      }
      const unnamed = list.find((field) => !field.id || !field.label);
      if (unnamed) {
        setError(`${kind} 存在缺少 id 或名称的字段`);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      // 只提交有变化的 kind，并且提交整个 fieldSchema（save 是浅合并，对象键需完整）
      const next: Record<string, CustomFieldDef[]> = { ...(config.fieldSchema ?? {}) };
      for (const kind of Object.keys(schema)) {
        if (JSON.stringify(schema[kind]) !== JSON.stringify(baseline[kind] ?? null)) {
          next[kind] = schema[kind];
        }
      }
      await onSave({ fieldSchema: next });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="field-schema-editor" data-module-id={moduleId}>
      <div className="flex flex-wrap items-center gap-1">
        {kinds.map((def) => (
          <button
            key={def.id}
            type="button"
            aria-pressed={resolvedKind === def.id}
            onClick={() => setActiveKind(def.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
              resolvedKind === def.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
            }`}
            data-testid="field-kind-tab"
            data-kind-id={def.id}
          >
            {def.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
          data-testid="field-editor-error"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1" data-testid="field-list">
        {visible.length === 0 && (
          <p className="text-[11px] text-muted-foreground">该类型暂无自定义字段。</p>
        )}
        {visible.map((field) => (
          <div
            key={field.id}
            className="space-y-1 rounded-md border border-border/40 p-2"
            data-testid="field-row"
            data-field-id={field.id}
            data-field-type={field.type}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={field.label}
                onChange={(event) => patchField(field.id, { label: event.target.value })}
                aria-label={`字段名称 ${field.label}`}
                className={`${INLINE_FIELD_CLASS} w-32`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{field.id}</span>
              <select
                value={field.type}
                onChange={(event) =>
                  patchField(field.id, { type: event.target.value as CustomFieldType })
                }
                aria-label={`字段类型 ${field.label}`}
                className={`${INLINE_FIELD_CLASS} w-28`}
              >
                {FIELD_TYPE_IDS.map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!field.required}
                  onChange={(event) => patchField(field.id, { required: event.target.checked })}
                  aria-label={`必填 ${field.label}`}
                  className="h-3 w-3"
                />
                必填
              </label>
              <input
                type="number"
                value={field.order ?? ''}
                onChange={(event) =>
                  patchField(field.id, {
                    order: event.target.value === '' ? undefined : Number(event.target.value),
                  })
                }
                aria-label={`排序 ${field.label}`}
                placeholder="排序"
                className={`${INLINE_FIELD_CLASS} w-16`}
              />
              <button
                type="button"
                aria-label={`归档字段 ${field.label}`}
                onClick={() => removeField(field.id)}
                className="ml-auto flex items-center gap-1 rounded p-0.5 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                data-testid="field-archive"
              >
                <Archive className="h-3.5 w-3.5" />
                归档
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={field.placeholder ?? ''}
                onChange={(event) => patchField(field.id, { placeholder: event.target.value })}
                aria-label={`占位提示 ${field.label}`}
                placeholder="占位提示"
                className={`${INLINE_FIELD_CLASS} w-40`}
              />
              <input
                type="text"
                value={field.group ?? ''}
                onChange={(event) => patchField(field.id, { group: event.target.value })}
                aria-label={`字段组 ${field.label}`}
                placeholder="字段组"
                className={`${INLINE_FIELD_CLASS} w-28`}
              />
              <select
                value={field.visibleComplexity ?? 'sketch'}
                onChange={(event) =>
                  patchField(field.id, {
                    visibleComplexity: event.target
                      .value as CustomFieldDef['visibleComplexity'],
                  })
                }
                aria-label={`可见复杂度 ${field.label}`}
                className={`${INLINE_FIELD_CLASS} w-24`}
              >
                {COMPLEXITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {COMPLEXITY_LABELS[level]}起
                  </option>
                ))}
              </select>
              {(field.type === 'select' || field.type === 'multiselect') && (
                <input
                  type="text"
                  value={listText[`${field.id}:options`] ?? (field.options ?? []).join(', ')}
                  onChange={(event) => {
                    const text = event.target.value;
                    setListText((prev) => ({ ...prev, [`${field.id}:options`]: text }));
                    patchField(field.id, {
                      options: text
                        .split(/[,，]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    });
                  }}
                  aria-label={`选项 ${field.label}`}
                  placeholder="选项（逗号分隔）"
                  className={`${INLINE_FIELD_CLASS} w-48`}
                />
              )}
              <input
                type="text"
                value={listText[`${field.id}:default`] ?? formatFieldDefaultValue(field.defaultValue)}
                onChange={(event) => {
                  const text = event.target.value;
                  setListText((prev) => ({ ...prev, [`${field.id}:default`]: text }));
                  patchField(field.id, {
                    defaultValue: parseFieldDefaultValue(field.type, text),
                  });
                }}
                aria-label={`默认值 ${field.label}`}
                placeholder="默认值"
                className={`${INLINE_FIELD_CLASS} w-40`}
              />
              {field.type === 'entityRef' && (
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    value={field.entityRefFilter?.module ?? ''}
                    onChange={(event) =>
                      patchField(field.id, {
                        entityRefFilter: {
                          ...(field.entityRefFilter ?? {}),
                          module: event.target.value || undefined,
                        },
                      })
                    }
                    aria-label={`实体引用模块 ${field.label}`}
                    placeholder="候选模块"
                    className={`${INLINE_FIELD_CLASS} w-24`}
                  />
                  <input
                    type="text"
                    value={field.entityRefFilter?.kind ?? ''}
                    onChange={(event) =>
                      patchField(field.id, {
                        entityRefFilter: {
                          ...(field.entityRefFilter ?? {}),
                          kind: event.target.value || undefined,
                        },
                      })
                    }
                    aria-label={`实体引用 kind ${field.label}`}
                    placeholder="候选 kind"
                    className={`${INLINE_FIELD_CLASS} w-24`}
                  />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="space-y-1 rounded-md border border-border/40 p-2" data-testid="field-archived">
          <div className="text-[11px] font-medium text-foreground">已归档字段（数据保留）</div>
          {archived.map((field) => (
            <div key={field.id} className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">{field.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{field.id}</span>
              <button
                type="button"
                aria-label={`恢复字段 ${field.label}`}
                onClick={() => setFields(resolvedKind, restoreField(fields, field.id))}
                className="ml-auto flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-accent/30"
              >
                <ArchiveRestore className="h-3 w-3" />
                恢复
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 rounded-md border border-border/40 p-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-foreground">新增字段</div>
          <button
            type="button"
            onClick={() => setShowOptions((prev) => !prev)}
            className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showOptions ? '收起高级属性' : '展开高级属性'}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newField.label}
            onChange={(event) => setNewField((prev) => ({ ...prev, label: event.target.value }))}
            placeholder="字段名称"
            aria-label="新字段名称"
            className={FIELD_CLASS}
          />
          <select
            value={newField.type}
            onChange={(event) =>
              setNewField((prev) => ({ ...prev, type: event.target.value as CustomFieldType }))
            }
            aria-label="新字段类型"
            className={FIELD_CLASS}
          >
            {FIELD_TYPE_IDS.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        {showOptions && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={newField.placeholder}
                onChange={(event) =>
                  setNewField((prev) => ({ ...prev, placeholder: event.target.value }))
                }
                placeholder="占位提示（可选）"
                aria-label="新字段占位提示"
                className={FIELD_CLASS}
              />
              <input
                type="text"
                value={newField.group}
                onChange={(event) =>
                  setNewField((prev) => ({ ...prev, group: event.target.value }))
                }
                placeholder="字段组（可选）"
                aria-label="新字段组"
                className={FIELD_CLASS}
              />
              <select
                value={newField.visibleComplexity}
                onChange={(event) =>
                  setNewField((prev) => ({ ...prev, visibleComplexity: event.target.value }))
                }
                aria-label="新字段可见复杂度"
                className={FIELD_CLASS}
              >
                {COMPLEXITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {COMPLEXITY_LABELS[level]}起可见
                  </option>
                ))}
              </select>
            </div>
            {(newField.type === 'select' || newField.type === 'multiselect') && (
              <input
                type="text"
                value={newField.options}
                onChange={(event) =>
                  setNewField((prev) => ({ ...prev, options: event.target.value }))
                }
                placeholder="选项（逗号分隔）"
                aria-label="新字段选项"
                className={FIELD_CLASS}
              />
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            归档不删数据；实体引用字段只保存 EntityRef，不创建关联；需要时间与备注时请用关联面板。
          </p>
          <button
            type="button"
            onClick={addField}
            className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
            data-testid="field-add"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          取消
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          data-testid="field-schema-save"
        >
          {saving ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          保存字段
        </button>
      </div>
    </div>
  );
};

export const FieldSchemaEditor = (props: FieldSchemaEditorProps) => (
  <Modal isOpen={props.open} onClose={props.onClose} title="自定义字段" size="lg">
    <FieldSchemaEditorPanel {...props} />
  </Modal>
);
