/**
 * ModuleConfig 解析、合并与 kind 校验（Phase 3 P3-T8；契约 §2.7）
 *
 * 口径：
 * - 后端 config 是自由 JSON，前端只做浅层解析，未知键一律保留（降档/未识别字段不丢数据）。
 * - 自定义 kind 必须 `custom_` 前缀 + 声明 parentKind，深度受模块上限约束（races<=2、systems<=3）。
 * - meta 合并同样保留未知字段，删除字段只删本次显式置 undefined 的键。
 * - Phase 6 P6-T4/T5：自定义字段补 required / defaultValue / visibleComplexity / entityRefFilter /
 *   archived / order，并给出排序、复杂度可见性、归档恢复的纯函数；自定义关联类型补
 *   source / target 端点范围与校验（只落 module.config，不入后端注册表）。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'entityRef'
  | 'image';

/** 契约 §2.7 的八种字段类型（顺序即界面顺序；P6-T4） */
export const CUSTOM_FIELD_TYPES: CustomFieldType[] = [
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'date',
  'entityRef',
  'image',
];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: '单行文本',
  textarea: '多行文本',
  number: '数字',
  select: '单选',
  multiselect: '多选',
  date: '日期',
  entityRef: '实体引用',
  image: '图片',
};

/** 可见复杂度分档（契约 §2.6）：速写 -> 结构 -> 沙盘 逐档放开 */
export const COMPLEXITY_LEVELS: ComplexityLevel[] = ['sketch', 'structure', 'sandbox'];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  sketch: '速写',
  structure: '结构',
  sandbox: '沙盘',
};

/** 复杂度序号：sketch=0、structure=1、sandbox=2；未知值按 0 处理，不抛错 */
export const complexityRank = (level: ComplexityLevel | undefined | null): number => {
  const index = COMPLEXITY_LEVELS.indexOf((level ?? 'sketch') as ComplexityLevel);
  return index < 0 ? 0 : index;
};

export type CustomFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[];

/** entityRef 字段的取值范围（契约 §2.7 entityRefFilter）；只过滤选择器，不产生关联 */
export interface EntityRefFilter {
  module?: string;
  kind?: string;
}

export interface CustomFieldDef {
  /** 存储键（meta.customFields[id] 或 item.content[id]） */
  id: string;
  label: string;
  type: CustomFieldType;
  /** 必填（契约 §2.7；仅表单校验，不改动已有数据） */
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  /** select / multiselect 选项；单选或多选共用 */
  options?: string[];
  /** 该字段自哪一档复杂度起可见（缺省 = 速写起可见） */
  visibleComplexity?: ComplexityLevel;
  /** 字段组名，详情页按组渲染 */
  group?: string;
  /** 界面排序；缺省按数组下标 */
  order?: number;
  /** entityRef 字段的候选范围 */
  entityRefFilter?: EntityRefFilter;
  /** 归档（软删除）：数据保留，界面不再渲染，可恢复 */
  archived?: boolean;
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
  /**
   * 权重（契约 §2.7）：数值越大权重越高，可选，未设置按 0 处理。
   * 目前只有政治模块消费它：PoliticsView 的 weightOf / sortLevelsByRank 用它决定版图节点尺寸档、
   * 布局环与沿革泳道高度；其余模块（races / systems / history / economy）的配置面板会原样读写
   * 该字段，但渲染不读。因此新建等级时必须给一个递增值，否则各等级同权重、版图被画平。
   */
  rank?: number;
  /**
   * 等级展示色。当前只有配置面板写入（政治的表单可填），渲染侧尚未取用；
   * 保留该字段供画布配色演进，删除需先确认没有模块开始读取它。
   */
  color?: string;
}

export interface StatusDef {
  id: string;
  label: string;
  color?: string;
  description?: string;
  /**
   * 终端状态：政治模块消费（画布降为幽灵节点、沿革与名录保留可读，契约 §2.7）；
   * 其余模块忽略该字段。省略即视为非终端。
   */
  isTerminal?: boolean;
}

/** 自定义关联的端点范围（契约 §2.7）：只声明 module，可选收窄到 kind */
export interface CustomLinkEndpoint {
  module?: string;
  kind?: string;
}

export interface CustomLinkTypeDef {
  id: string;
  label: string;
  reverseLabel?: string;
  directed?: boolean;
  icon?: string;
  color?: string;
  source?: CustomLinkEndpoint;
  target?: CustomLinkEndpoint;
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

// ---- 自定义字段（P6-T4：排序 / 复杂度可见性 / 归档恢复）----

/**
 * 字段是否在该复杂度可见：visibleComplexity 缺省 = 速写起可见；
 * 复杂度只控制披露程度，降档隐藏数据、不删数据（契约 §2.6）。
 */
export const fieldVisibleAt = (
  field: CustomFieldDef,
  complexity: ComplexityLevel | undefined | null
): boolean => complexityRank(complexity) >= complexityRank(field.visibleComplexity);

/** 稳定排序：显式 order 优先，未设 order 的字段按原下标参与比较 */
export const sortFields = (fields: CustomFieldDef[]): CustomFieldDef[] =>
  fields
    .map((field, index) => ({ field, index }))
    .sort(
      (left, right) =>
        (left.field.order ?? left.index) - (right.field.order ?? right.index) ||
        left.index - right.index
    )
    .map((entry) => entry.field);

/** 当前生效的字段（排除归档），已排序 */
export const activeFieldsOf = (fields: CustomFieldDef[]): CustomFieldDef[] =>
  sortFields(fields.filter((field) => !field.archived));

/** 新建字段的默认 order：现存最大 order + 10（不写死前端默认值，只保证递增） */
export const nextFieldOrder = (fields: CustomFieldDef[]): number =>
  fields.reduce(
    (max, field) => (typeof field.order === 'number' && field.order > max ? field.order : max),
    0
  ) + 10;

/**
 * 局部更新字段：跳过 undefined 的键，保留未提及的键与未知键（改名不动数据）。
 * 需要清空某个键时显式传 null / ''，不要传 undefined。
 */
export const updateField = (
  fields: CustomFieldDef[],
  id: string,
  patch: Partial<CustomFieldDef>
): CustomFieldDef[] => {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<CustomFieldDef>;
  return fields.map((field) => (field.id === id ? { ...field, ...defined } : field));
};

/** 归档字段（软删除）：数据保留，仅标记不再展示 */
export const archiveField = (fields: CustomFieldDef[], id: string): CustomFieldDef[] =>
  fields.map((field) => (field.id === id ? { ...field, archived: true } : field));

/** 恢复归档字段 */
export const restoreField = (fields: CustomFieldDef[], id: string): CustomFieldDef[] =>
  fields.map((field) => (field.id === id ? { ...field, archived: false } : field));

/** 由标签生成字段 id（ASCII 字母数字下划线，中文标签回退 field/序号） */
export const toFieldId = (label: string, taken: string[] = []): string => {
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

/** 表单文本 -> 默认值（按类型解析；空串表示不设默认值） */
export const parseFieldDefaultValue = (
  type: CustomFieldType,
  raw: string
): unknown => {
  const text = raw.trim();
  if (!text) return undefined;
  if (type === 'number') {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === 'multiselect') {
    return text
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return text;
};

/** 默认值 -> 表单文本（与 parseFieldDefaultValue 互逆，用于编辑回填） */
export const formatFieldDefaultValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
};

// ---- 自定义关联类型（P6-T5 契约 §2.7 / §4）----

/** 自定义关联回退目标：删除自定义类型后既有链接转为核心 related_to（契约 §4.1） */
export const LINK_TYPE_FALLBACK_ID = 'core.related_to';

export const CUSTOM_LINK_TYPE_PREFIX = 'custom_';

/** 由标签生成自定义关联类型 id（纯 ASCII；与后端注册表 id 不冲突） */
export const toLinkTypeId = (label: string, taken: string[] = []): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'link';
  let candidate = `${CUSTOM_LINK_TYPE_PREFIX}${base}`;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${CUSTOM_LINK_TYPE_PREFIX}${base}_${index}`;
    index += 1;
  }
  return candidate;
};

export interface ValidateCustomLinkTypeOptions {
  /** 已有条目（含核心覆盖项）；用于 id 唯一性校验 */
  existing?: CustomLinkTypeDef[];
  /** 正在编辑的 id：不参与重复判定 */
  editingId?: string;
  /** 核心注册表 id：命中即视为「核心类型覆盖」，只允许改名改色 */
  coreIds?: string[];
}

/** 校验自定义关联类型；返回中文错误信息，通过返回 null */
export const validateCustomLinkType = (
  def: CustomLinkTypeDef,
  options: ValidateCustomLinkTypeOptions = {}
): string | null => {
  const id = (def.id ?? '').trim();
  if (!id) return '关联类型 id 不能为空';
  if (!(def.label ?? '').trim()) return '关联类型标签不能为空';
  if (options.coreIds?.includes(id)) {
    // 核心类型只能改名 / 改色 / 改图标，不新增注册表条目
    return null;
  }
  if (!(def.source?.module ?? '').trim()) return '必须声明源模块';
  if (!(def.target?.module ?? '').trim()) return '必须声明目标模块';
  if (typeof def.directed !== 'boolean') return '关联方向必须是布尔值';
  const clash = (options.existing ?? []).some(
    (item) =>
      item.id !== options.editingId && item.id.trim().toLowerCase() === id.toLowerCase()
  );
  if (clash) return `关联类型 id ${id} 已存在`;
  return null;
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
