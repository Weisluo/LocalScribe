/**
 * 自定义字段的纯数据操作（Phase 3 P3-T8；契约 §2.7 fieldSchema）
 *
 * 与渲染分离，便于单测与在非组件模块中复用；所有写回都保留未知键。
 * entityRef 字段值为 `module:kind:id` 字符串，与行内引用 token 同构。
 */

import type { ComplexityLevel, EntityRef } from '@/services/worldbuildingApi';
import { fieldVisibleAt, type CustomFieldDef, type CustomFieldValue } from './moduleConfig';

export type CustomFieldValues = Record<string, CustomFieldValue>;

/** `module:kind:id` -> EntityRef */
export const parseEntityRefValue = (raw: unknown): EntityRef | undefined => {
  if (typeof raw !== 'string') return undefined;
  const parts = raw.split(':');
  if (parts.length < 3) return undefined;
  const [module, kind, ...rest] = parts;
  const id = rest.join(':');
  if (!module || !kind || !id) return undefined;
  return { module, kind, id };
};

export const formatEntityRefValue = (ref: EntityRef): string =>
  `${ref.module}:${ref.kind}:${ref.id}`;

export const readCustomField = (
  values: CustomFieldValues | null | undefined,
  fieldId: string
): CustomFieldValue => values?.[fieldId];

/** 写入单个字段；未知键与其它字段值原样保留 */
export const writeCustomField = (
  values: CustomFieldValues | null | undefined,
  fieldId: string,
  next: CustomFieldValue
): CustomFieldValues => ({ ...(values ?? {}), [fieldId]: next });

/** 按 group 归并字段，保持 schema 顺序 */
export const groupCustomFields = (
  fields: CustomFieldDef[]
): { group: string | undefined; fields: CustomFieldDef[] }[] => {
  const groups: { group: string | undefined; fields: CustomFieldDef[] }[] = [];
  for (const field of fields) {
    const bucket = groups.find((item) => item.group === field.group);
    if (bucket) {
      bucket.fields.push(field);
    } else {
      groups.push({ group: field.group, fields: [field] });
    }
  }
  return groups;
};

/** 空值判定：'' / 空白串 / 空数组 / null / undefined 都算未填写 */
export const isCustomFieldEmpty = (value: CustomFieldValue): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

/**
 * 必填校验（P6-T4 的 field.required 的执行口）：返回「必填但为空」的字段展示名。
 *
 * 复杂度同口径：被当前档位隐藏的字段不参与校验（降档只隐藏数据、不要求补填）。
 * 无缺失返回空数组，调用方直接 `if (missing.length)` 即可阻断提交。
 */
export const missingRequiredFields = (
  fields: CustomFieldDef[],
  values: CustomFieldValues | null | undefined,
  complexity?: ComplexityLevel | null
): string[] => {
  const visible = complexity ? fields.filter((field) => fieldVisibleAt(field, complexity)) : fields;
  return visible
    .filter((field) => field.required && isCustomFieldEmpty(readCustomField(values, field.id)))
    .map((field) => field.label || field.id);
};
