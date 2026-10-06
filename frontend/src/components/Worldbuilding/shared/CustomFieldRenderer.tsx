/**
 * CustomFieldRenderer（Phase 3 P3-T8；契约 §2.7 fieldSchema）
 *
 * 渲染 ModuleConfig.fieldSchema 定义的自定义字段（text / textarea / number / select /
 * date / entityRef / image）。写回一律经 writeCustomField，保留未在本 schema 中声明的旧键。
 * entityRef 字段值为 `module:kind:id` 字符串，与行内引用 token 同构；渲染走 EntityBadge。
 * 纯数据操作在 ./customFieldModel，本文件只负责渲染。
 */

import { EntityBadge } from '@/components/common/EntityBadge';
import type { EntityRef } from '@/services/worldbuildingApi';
import type { CustomFieldDef, CustomFieldValue } from './moduleConfig';
import {
  groupCustomFields,
  parseEntityRefValue,
  readCustomField,
  type CustomFieldValues,
} from './customFieldModel';

export type { CustomFieldValues };

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

const toText = (value: CustomFieldValue): string =>
  value === null || value === undefined ? '' : String(value);

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
}: CustomFieldRendererProps) => {
  if (fields.length === 0) return null;

  const renderReadOnly = (field: CustomFieldDef) => {
    const value = readCustomField(values, field.id);
    const empty = value === null || value === undefined || value === '';
    if (empty && !showEmpty) return null;
    return (
      <div key={field.id} className="space-y-0.5" data-field-id={field.id}>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          {field.label}
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
    return (
      <label key={field.id} className="block space-y-0.5" data-field-id={field.id}>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          {field.label}
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
      {groupCustomFields(fields).map((group, index) => (
        <div key={group.group ?? `group-${index}`} className="space-y-2">
          {group.group && (
            <div className="text-[11px] font-medium text-foreground">{group.group}</div>
          )}
          {group.fields.map((field) =>
            readOnly ? renderReadOnly(field) : renderEditable(field)
          )}
        </div>
      ))}
    </div>
  );
};
