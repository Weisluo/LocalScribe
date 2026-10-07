/**
 * CustomFieldRenderer（Phase 3 P3-T8；契约 §2.7 fieldSchema）
 *
 * 渲染 ModuleConfig.fieldSchema 定义的自定义字段（text / textarea / number / select /
 * multiselect / date / entityRef / image）。写回一律经 writeCustomField，保留未在本 schema 中声明的旧键。
 * entityRef 字段值为 `module:kind:id` 字符串，与行内引用 token 同构；渲染走 EntityBadge。
 * 纯数据操作在 ./customFieldModel，本文件只负责渲染。
 *
 * Phase 6 P6-T4 补充：
 * - multiselect 与 CustomFieldDef.options: string[] 对齐，值为字符串数组，空值归一为 []；
 * - 传入 complexity 时按 field.visibleComplexity 过滤（fieldVisibleAt），缺省不过滤，兼容旧调用方。
 */

import { EntityBadge } from '@/components/common/EntityBadge';
import { useComplexity } from '@/components/common/ComplexitySwitcher';
import type { ComplexityLevel, EntityRef } from '@/services/worldbuildingApi';
import { fieldVisibleAt, type CustomFieldDef, type CustomFieldValue } from './moduleConfig';
import {
  groupCustomFields,
  missingRequiredFields,
  parseEntityRefValue,
  readCustomField,
  type CustomFieldValues,
} from './customFieldModel';

export type { CustomFieldValues };

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

/** 字段名（必填带 * 标记）：只读与可编辑两条分支共用 */
const FieldLabel = ({ field }: { field: CustomFieldDef }) => (
  <>
    {field.label}
    {field.required ? (
      <span className="text-destructive" aria-hidden="true">
        {' '}
        *
      </span>
    ) : null}
  </>
);

const toText = (value: CustomFieldValue): string =>
  value === null || value === undefined ? '' : String(value);

/** multiselect 取值归一化：null / '' / 单值 -> 字符串数组（与 options: string[] 一致） */
export const toMultiValue = (value: CustomFieldValue): string[] => {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item !== '');
  }
  return [String(value)];
};

export interface CustomFieldRendererProps {
  fields: CustomFieldDef[];
  values?: CustomFieldValues | null;
  onChange?: (fieldId: string, value: CustomFieldValue) => void;
  readOnly?: boolean;
  /** 只读模式下，空值是否也渲染幽灵占位（默认渲染为「未填写」） */
  showEmpty?: boolean;
  onNavigateToEntity?: (ref: EntityRef) => void;
  resolveEntityName?: (ref: EntityRef) => string;
  invalidEntity?: (ref: EntityRef) => boolean;
  className?: string;
  /**
   * 当前复杂度：提供时按 field.visibleComplexity 过滤（fieldVisibleAt）。
   * 缺省不过滤，保持既有调用方的行为不变。
   */
  complexity?: ComplexityLevel;
}

export const CustomFieldRenderer = ({
  fields,
  values,
  onChange,
  readOnly = false,
  showEmpty = false,
  onNavigateToEntity,
  resolveEntityName,
  invalidEntity,
  className = '',
  /**
   * 当前复杂度：优先用显式 prop，否则读世界容器提供的 ComplexitySwitcher 上下文
   * （无 Provider 时 useComplexity 退化为 sketch，共用件仍可独立渲染）。
   * visibleComplexity 因此一定生效——它此前只写不读，字段在速写档照样显示。
   */
  /**
   * 当前复杂度：优先用显式 prop，否则读世界容器提供的 ComplexitySwitcher 上下文
   * （无 Provider 时 useComplexity 退化为 sketch，共用件仍可独立渲染）。
   * visibleComplexity 因此一定生效——它此前只写不读，字段在速写档照样显示。
   */
  complexity,
}: CustomFieldRendererProps) => {
  const complexityContext = useComplexity();
  const effectiveComplexity = complexity ?? complexityContext.level;
  const visibleFields = fields.filter((field) => fieldVisibleAt(field, effectiveComplexity));
  const missingRequired = readOnly ? [] : missingRequiredFields(visibleFields, values);
  if (visibleFields.length === 0) return null;

  const renderReadOnly = (field: CustomFieldDef) => {
    const value = readCustomField(values, field.id);
    if (field.type === 'multiselect') {
      const selected = toMultiValue(value);
      if (selected.length === 0 && !showEmpty) return null;
      return (
        <div key={field.id} className="space-y-0.5" data-field-id={field.id}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            <FieldLabel field={field} />
          </div>
          {selected.length === 0 ? (
            <div className="text-xs text-muted-foreground/60">未填写</div>
          ) : (
            <div className="flex flex-wrap gap-1" data-testid="custom-field-multiselect-value">
              {selected.map((option) => (
                <span
                  key={option}
                  className="rounded-full border border-border/50 px-1.5 py-0.5 text-xs text-foreground"
                >
                  {option}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    const empty = value === null || value === undefined || value === '';
    if (empty && !showEmpty) return null;
    return (
      <div key={field.id} className="space-y-0.5" data-field-id={field.id}>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          <FieldLabel field={field} />
        </div>
        {empty ? (
          <div className="text-xs text-muted-foreground/60">未填写</div>
        ) : field.type === 'entityRef' ? (
          (() => {
            const ref = parseEntityRefValue(value);
            if (!ref) return <div className="text-xs text-foreground">{toText(value)}</div>;
            return (
              <EntityBadge
                entityRef={ref}
                name={resolveEntityName?.(ref)}
                invalid={invalidEntity?.(ref)}
                onClick={onNavigateToEntity}
              />
            );
          })()
        ) : field.type === 'image' ? (
          <img
            src={toText(value)}
            alt={field.label}
            loading="lazy"
            className="max-h-40 rounded-md border border-border/50 object-cover"
          />
        ) : (
          <div className="whitespace-pre-wrap text-xs text-foreground">{toText(value)}</div>
        )}
      </div>
    );
  };

  const renderEditable = (field: CustomFieldDef) => {
    const value = readCustomField(values, field.id);
    const emit = (next: CustomFieldValue) => onChange?.(field.id, next);
    if (field.type === 'multiselect') {
      const selected = toMultiValue(value);
      const options = field.options ?? [];
      return (
        <div key={field.id} className="block space-y-0.5" data-field-id={field.id}>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            <FieldLabel field={field} />
          </span>
          <div className="flex flex-wrap gap-2" data-testid="custom-field-multiselect">
            {options.map((option) => (
              <span key={option} className="flex items-center gap-1 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  aria-label={option}
                  onChange={(event) =>
                    emit(
                      event.target.checked
                        ? [...selected, option]
                        : selected.filter((item) => item !== option)
                    )
                  }
                  className="h-3 w-3"
                />
                <span>{option}</span>
              </span>
            ))}
            {options.length === 0 && (
              <span className="text-xs text-muted-foreground/60">
                该字段尚未定义选项（在字段编辑器里填写选项）
              </span>
            )}
          </div>
        </div>
      );
    }
    return (
      <label key={field.id} className="block space-y-0.5" data-field-id={field.id}>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          <FieldLabel field={field} />
        </span>
        {field.type === 'textarea' ? (
          <textarea
            value={toText(value)}
            onChange={(event) => emit(event.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={FIELD_CLASS}
          />
        ) : field.type === 'select' ? (
          <select
            value={toText(value)}
            onChange={(event) => emit(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">未选择</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === 'number' ? (
          <input
            type="number"
            value={toText(value)}
            onChange={(event) =>
              emit(event.target.value === '' ? undefined : Number(event.target.value))
            }
            placeholder={field.placeholder}
            className={FIELD_CLASS}
          />
        ) : (
          <input
            type={field.type === 'date' ? 'date' : 'text'}
            value={toText(value)}
            onChange={(event) => emit(event.target.value)}
            placeholder={
              field.type === 'entityRef'
                ? field.placeholder ?? 'module:kind:id'
                : field.placeholder
            }
            className={FIELD_CLASS}
          />
        )}
      </label>
    );
  };

  return (
    <div className={`space-y-2 ${className}`} data-testid="custom-fields">
      {groupCustomFields(visibleFields).map((group, index) => (
        <div key={group.group ?? `group-${index}`} className="space-y-2">
          {group.group && (
            <div className="text-[11px] font-medium text-foreground">{group.group}</div>
          )}
          {group.fields.map((field) =>
            readOnly ? renderReadOnly(field) : renderEditable(field)
          )}
        </div>
      ))}
      {missingRequired.length > 0 && (
        <p className="text-[10px] text-destructive" data-testid="custom-field-required-hint">
          必填未填写：{missingRequired.join('、')}
        </p>
      )}
    </div>
  );
};
