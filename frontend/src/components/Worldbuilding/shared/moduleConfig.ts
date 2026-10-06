/**
 * ModuleConfig 解析、合并与 kind 校验（Phase 3 P3-T8；契约 §2.7）
 *
 * 口径：
 * - 后端 config 是自由 JSON，前端只做浅层解析，未知键一律保留（降档/未识别字段不丢数据）。
 * - 自定义 kind 必须 `custom_` 前缀 + 声明 parentKind，深度受模块上限约束（races<=2、systems<=3）。
 * - meta 合并同样保留未知字段，删除字段只删本次显式置 undefined 的键。
 */

import type { ComplexityLevel, EntityRef } from '@/services/worldbuildingApi';

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'entityRef'
  | 'image';

export type CustomFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[];

export interface CustomFieldDef {
  /** 存储键（meta.customFields[id] 或 item.content[id]） */
  id: string;
  label: string;
  type: CustomFieldType;
  placeholder?: string;
  /** select 选项；单选或多选共用 */
  options?: string[];
  /** 字段组名，详情页按组渲染 */
  group?: string;
}

export interface EntityTypeDef {
  /** 等于 kind */
  id: string;
  label: string;
  /** Lucide 图标名（kebab-case），禁止 emoji */
  icon?: string;
  color?: string;
  description?: string;
  /** 自定义 kind 必须声明 */
  parentKind?: string;
  defaultFields?: CustomFieldDef[];
}

export interface LevelDef {
  id: string;
  label: string;
  description?: string;
}

export interface StatusDef {
  id: string;
  label: string;
  color?: string;
  description?: string;
}

export interface CustomLinkTypeDef {
  id: string;
  label: string;
  reverseLabel?: string;
  directed?: boolean;
  icon?: string;
  color?: string;
  source?: EntityRef[];
  target?: EntityRef[];
}

export interface RelationKindDef {
  id: string;
  label: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'double';
}

/** 契约 §2.7 ModuleConfig；未知键通过索引签名保留 */
export interface ModuleConfig {
  defaultComplexity?: ComplexityLevel;
  displayMode?: string;
  entityTypes?: EntityTypeDef[];
  levels?: LevelDef[];
  statuses?: StatusDef[];
  fieldSchema?: Record<string, CustomFieldDef[]>;
  linkTypes?: CustomLinkTypeDef[];
  terminology?: Record<string, string>;
  palette?: { accent?: string; surface?: string };
  /** races：血缘树语义分色（叠加在 races.related_to 上） */
  relationKinds?: RelationKindDef[];
  /** races：图鉴卡片字段顺序 */
  cardFields?: string[];
  /** races：纹章代表色板，第一项为默认色 */
  emblemPalette?: string[];
  /** systems：阶位术语（阶位 / 境界 / 等级） */
  tierTerm?: string;
  /** systems：新建阶位步长 */
  rankStep?: number;
  /** systems：kind -> 图标/颜色覆盖 */
  nodeStyles?: Record<string, { icon?: string; color?: string }>;
  /** systems：代价节点表单字段顺序 */
  costFields?: string[];
  [key: string]: unknown;
}

export const CUSTOM_KIND_PREFIX = 'custom_';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** 后端 config 可能是 null / 非对象；统一归一化成对象，保留未知键 */
export const parseModuleConfig = (raw: unknown): ModuleConfig =>
  isRecord(raw) ? { ...(raw as ModuleConfig) } : {};

/** 浅合并：patch 里的 undefined 不覆盖原值（表单未提交的键保持不动） */
export const mergeModuleConfig = (
  base: ModuleConfig,
  patch: ModuleConfig
): ModuleConfig => {
  const next: ModuleConfig = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
};

/**
 * 配置里的 kind 定义 + 内置兜底：内置顺序在前，配置只覆盖展示信息
 * （icon/color/label/description），id 与 parentKind 以内置结构为准；自定义 kind 追加在后。
 */
export const kindDefsOf = (
  config: ModuleConfig,
  builtins: EntityTypeDef[]
): EntityTypeDef[] => {
  const configured = asArray<EntityTypeDef>(config.entityTypes).filter((def) => !!def?.id);
  const merged = builtins.map((builtin) => {
    const override = configured.find((def) => def.id === builtin.id);
    return override
      ? { ...builtin, ...override, id: builtin.id, parentKind: builtin.parentKind }
      : builtin;
  });
  for (const def of configured) {
    if (!merged.some((item) => item.id === def.id)) merged.push(def);
  }
  return merged;
};

export const kindDefOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[]
): EntityTypeDef | undefined =>
  kindDefsOf(config, builtins).find((def) => def.id === kind);

export const kindLabelOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[],
  fallback?: string
): string => kindDefOf(config, kind, builtins)?.label ?? fallback ?? kind;

export const kindIconOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[],
  fallback: string
): string =>
  config.nodeStyles?.[kind]?.icon ??
  kindDefOf(config, kind, builtins)?.icon ??
  fallback;

export const kindColorOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[],
  fallback: string
): string =>
  config.nodeStyles?.[kind]?.color ??
  kindDefOf(config, kind, builtins)?.color ??
  fallback;

export const statusDefsOf = (
  config: ModuleConfig,
  builtins: StatusDef[] = []
): StatusDef[] => {
  const configured = asArray<StatusDef>(config.statuses);
  const merged = [...configured.filter((def) => !!def?.id)];
  for (const def of builtins) {
    if (!merged.some((item) => item.id === def.id)) merged.push(def);
  }
  return merged;
};

export const statusLabelOf = (
  config: ModuleConfig,
  status: string | undefined | null,
  builtins: StatusDef[] = []
): string | undefined =>
  status
    ? statusDefsOf(config, builtins).find((def) => def.id === status)?.label ?? status
    : undefined;

export const levelDefsOf = (
  config: ModuleConfig,
  builtins: LevelDef[] = []
): LevelDef[] => {
  const configured = asArray<LevelDef>(config.levels);
  const merged = [...configured.filter((def) => !!def?.id)];
  for (const def of builtins) {
    if (!merged.some((item) => item.id === def.id)) merged.push(def);
  }
  return merged;
};

export const levelLabelOf = (
  config: ModuleConfig,
  level: string | undefined | null,
  builtins: LevelDef[] = []
): string | undefined =>
  level
    ? levelDefsOf(config, builtins).find((def) => def.id === level)?.label ?? level
    : undefined;

/** 某 kind 的自定义字段定义（config.fieldSchema[kind]） */
export const customFieldsOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[] = []
): CustomFieldDef[] => {
  const explicit = config.fieldSchema?.[kind];
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.filter((field) => !!field?.id);
  }
  return kindDefOf(config, kind, builtins)?.defaultFields ?? [];
};

export const parentKindOf = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[]
): string | undefined =>
  kindDefOf(config, kind, builtins)?.parentKind ?? undefined;

/** kind 在层级中的深度（1 起）；环路时提前退出，不抛错 */
export const kindDepth = (
  config: ModuleConfig,
  kind: string,
  builtins: EntityTypeDef[]
): number => {
  let depth = 1;
  let cursor = parentKindOf(config, kind, builtins);
  const visited = new Set<string>([kind]);
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    depth += 1;
    cursor = parentKindOf(config, cursor, builtins);
    if (depth > 16) break;
  }
  return depth;
};

export interface ValidateEntityTypeOptions {
  /** 内置 kind 定义：不可新增覆盖，且作为 parentKind 解析基准 */
  builtins: EntityTypeDef[];
  /** 该模块允许的最大层级（races=2、systems=3） */
  maxDepth: number;
}

/** 校验自定义 kind 定义；返回中文错误信息，通过返回 null */
export const validateEntityType = (
  config: ModuleConfig,
  def: EntityTypeDef,
  options: ValidateEntityTypeOptions
): string | null => {
  const id = (def.id ?? '').trim();
  if (!id) return '类型 id 不能为空';
  if (!(def.label ?? '').trim()) return '类型名称不能为空';
  if (options.builtins.some((builtin) => builtin.id === id)) {
    return `${id} 是内置类型，不能新增或覆盖`;
  }
  if (!id.startsWith(CUSTOM_KIND_PREFIX)) {
    return `自定义类型 id 必须以 ${CUSTOM_KIND_PREFIX} 开头`;
  }
  if (!def.parentKind) return '自定义类型必须声明 parentKind';

  const resolved: ModuleConfig = {
    ...config,
    entityTypes: [
      ...asArray<EntityTypeDef>(config.entityTypes).filter((item) => item?.id !== id),
      def,
    ],
  };

  if (!kindDefOf(resolved, def.parentKind, options.builtins)) {
    return `parentKind ${def.parentKind} 不存在`;
  }
  if (kindDepth(resolved, id, options.builtins) > options.maxDepth) {
    return `层级超过上限（最多 ${options.maxDepth} 层）`;
  }
  return null;
};

/** 由展示名生成 `custom_` kind id（仅 ASCII 字母数字下划线，空则回退序号） */
export const toKindId = (label: string, taken: string[] = []): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'type';
  let candidate = `${CUSTOM_KIND_PREFIX}${base}`;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${CUSTOM_KIND_PREFIX}${base}_${index}`;
    index += 1;
  }
  return candidate;
};

/** 术语：模块级 config.terminology 覆盖世界级 settings.terminology */
export const terminologyOf = (
  config: ModuleConfig,
  worldTerminology?: Record<string, string> | null
): Record<string, string> => ({
  ...(worldTerminology ?? {}),
  ...(isRecord(config.terminology) ? (config.terminology as Record<string, string>) : {}),
});

export const termOf = (
  config: ModuleConfig,
  key: string,
  fallback: string,
  worldTerminology?: Record<string, string> | null
): string => terminologyOf(config, worldTerminology)[key] || fallback;

/** meta 合并：保留未知字段；值为 undefined 的键被删除 */
export const mergeMeta = (
  previous: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> => {
  const base = isRecord(previous) ? { ...previous } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete base[key];
      continue;
    }
    base[key] = value;
  }
  return base;
};

export const readMetaString = (meta: unknown, key: string): string | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'string' && value ? value : undefined;
};

export const readMetaNumber = (meta: unknown, key: string): number | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const readMetaBoolean = (meta: unknown, key: string): boolean | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const readMetaStringArray = (meta: unknown, key: string): string[] => {
  if (!isRecord(meta)) return [];
  const value = meta[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
};

export const readMetaRecord = (
  meta: unknown,
  key: string
): Record<string, unknown> | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return isRecord(value) ? value : undefined;
};
