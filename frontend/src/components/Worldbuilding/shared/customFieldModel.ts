/**
 * 自定义字段的纯数据操作（Phase 3 P3-T8；契约 §2.7 fieldSchema）
 *
 * 与渲染分离，便于单测与在非组件模块中复用；所有写回都保留未知键。
 * entityRef 字段值为 `module:kind:id` 字符串，与行内引用 token 同构。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import type { CustomFieldDef, CustomFieldValue } from './moduleConfig';

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
