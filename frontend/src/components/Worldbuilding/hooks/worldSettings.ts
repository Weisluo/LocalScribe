/**
 * 世界级配置与列表的纯函数（Phase 6 P6-T1/T2/T6/T8）
 *
 * 契约依据：worldview_configuration_system §3（世界级配置）、§5.1（设置面板分页）、§7（备份）；
 * worldbuilding_ui_design §2.2（头部）/ §2.6（复杂度）/ §3.1-§3.3（列表、空白创建、设置）。
 *
 * 本文件不依赖 React，便于 SSR harness 直测：
 * - World.settings 存 palette/accent/texture/radius/terminology/calendar/complexity/defaultModule，
 *   未知键必须原样保留（§7「未知字段保留不丢弃」），因此所有解析都返回「规范化字段 + 原始键」；
 * - 复杂度三档只认 sketch/structure/sandbox（契约 §2.6），越界值退回默认速写；
 * - 术语只影响显示，键是稳定标识（module_type / kind / 通用称谓），值才是世界内称呼。
 */

import type {
  ComplexityLevel,
  EntityRef,
  World,
  WorldCreatePayload,
  WorldModuleV2,
} from '@/services/worldbuildingApi';
import type { EntityTypeDef } from '../shared/moduleConfig';

/** 七个固定模块（契约 §2.2；顺序即标签栏顺序） */
export const WORLD_MODULE_TYPES = [
  'map',
  'history',
  'politics',
  'economy',
  'races',
  'systems',
  'special',
] as const;

export type WorldModuleType = (typeof WORLD_MODULE_TYPES)[number];

/** 复杂度三档（契约 §2.6）：越界值一律退回 sketch，不猜第四个档 */
export const WORLD_COMPLEXITY_VALUES: ComplexityLevel[] = ['sketch', 'structure', 'sandbox'];

export const WORLD_COMPLEXITY_OPTIONS: {
  id: ComplexityLevel;
  label: string;
  hint: string;
}[] = [
  { id: 'sketch', label: '速写', hint: '只写字与最短字段，不显示关联面板与数值' },
  { id: 'structure', label: '结构', hint: '完整字段、关联面板与列表分组' },
  { id: 'sandbox', label: '沙盘', hint: '全部能力：时间维度、数值与统计' },
];

/** 新世界默认速写（ui_design §2.6「首次进入新世界默认速写」） */
export const WORLD_DEFAULT_COMPLEXITY: ComplexityLevel = 'sketch';

/** 进入世界默认落在历史模块（viewview_configuration_system §3.5） */
export const WORLD_DEFAULT_MODULE = 'history';

export const isWorldComplexity = (value: unknown): value is ComplexityLevel =>
  typeof value === 'string' && (WORLD_COMPLEXITY_VALUES as string[]).includes(value);

/** 归一化复杂度：未知/缺失 -> 速写（不写副作用，读多写少） */
export const normalizeWorldComplexity = (value: unknown): ComplexityLevel =>
  isWorldComplexity(value) ? value : 'sketch';

// ---------- 视觉基调（契约 §2.8） ----------

export type WorldPalette = 'parchment' | 'ink' | 'slate' | 'custom';
export type WorldTexture = 'none' | 'paper' | 'grid' | 'starfield';
export type WorldRadius = 'sm' | 'md' | 'lg';

export interface WorldPaletteOption {
  id: WorldPalette;
  label: string;
  /** 预览卡用色（light 值；外观页在暗色下用另一套 class 表达） */
  accent: string;
  surface: string;
  foreground: string;
}

/** 羊皮纸 / 墨色 / 青灰 / 自定义（worldview_configuration_system §3.2） */
export const WORLD_PALETTES: WorldPaletteOption[] = [
  { id: 'parchment', label: '羊皮纸', accent: '#B45309', surface: '#FDF6E3', foreground: '#3F2E1B' },
  { id: 'ink', label: '墨色', accent: '#334155', surface: '#F8FAFC', foreground: '#0F172A' },
  { id: 'slate', label: '青灰', accent: '#0E7490', surface: '#F1F5F9', foreground: '#1E293B' },
  { id: 'custom', label: '自定义', accent: '#7C3AED', surface: '#FAF5FF', foreground: '#2E1065' },
];

export const WORLD_TEXTURES: { id: WorldTexture; label: string }[] = [
  { id: 'none', label: '无' },
  { id: 'paper', label: '纸张' },
  { id: 'grid', label: '网格' },
  { id: 'starfield', label: '星野' },
];

export const WORLD_RADII: { id: WorldRadius; label: string; className: string }[] = [
  { id: 'sm', label: '小', className: 'rounded' },
  { id: 'md', label: '中', className: 'rounded-lg' },
  { id: 'lg', label: '大', className: 'rounded-2xl' },
];

export const DEFAULT_WORLD_TONE: { palette: WorldPalette; accent: string; texture: WorldTexture; radius: WorldRadius } = {
  palette: 'parchment',
  accent: '#B45309',
  texture: 'none',
  radius: 'md',
};

export interface WorldToneModel {
  palette: WorldPalette;
  accent: string;
  texture: WorldTexture;
  radius: WorldRadius;
  /** 未知键原样保留（保存时浅合并回后端 JSON） */
  raw: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const paletteOptionOf = (palette: WorldPalette): WorldPaletteOption =>
  WORLD_PALETTES.find((item) => item.id === palette) ?? WORLD_PALETTES[0];

/** tone 解析：非法值退回默认，未知键保留 */
export const parseWorldTone = (value: unknown): WorldToneModel => {
  const raw = isRecord(value) ? value : {};
  const paletteRaw = raw.palette;
  const palette = WORLD_PALETTES.some((item) => item.id === paletteRaw)
    ? (paletteRaw as WorldPalette)
    : DEFAULT_WORLD_TONE.palette;
  const texture = WORLD_TEXTURES.some((item) => item.id === raw.texture)
    ? (raw.texture as WorldTexture)
    : DEFAULT_WORLD_TONE.texture;
  const radius = WORLD_RADII.some((item) => item.id === raw.radius)
    ? (raw.radius as WorldRadius)
    : DEFAULT_WORLD_TONE.radius;
  const accent =
    typeof raw.accent === 'string' && raw.accent.trim() ? raw.accent.trim() : paletteOptionOf(palette).accent;
  return { palette, accent, texture, radius, raw };
};

// ---------- 术语（worldview_configuration_system §3.3） ----------

/**
 * 默认术语表：键是稳定标识（module_type / kind / 通用称谓），值是默认显示名。
 * 仅用于展示与「恢复默认」，不写入任何数据。
 */
export const DEFAULT_WORLD_TERMINOLOGY: Record<string, string> = {
  map: '地图',
  history: '历史',
  politics: '政治',
  economy: '经济',
  races: '种族',
  systems: '体系',
  special: '特殊',
  era: '时代',
  event: '事件',
  polity: '政权',
  organization: '组织',
  figure: '人物',
  treaty: '条约',
  race: '种族',
  subrace: '亚种',
  system: '体系',
  tier: '境界',
};

export interface TerminologyAudit {
  /** 生效条目：值为非空字符串（已 trim） */
  entries: Record<string, string>;
  /** 键存在但值为空 -> 显示回退默认并给提示 */
  empty: string[];
  /** 值等于另一个默认术语的默认名 -> 同名冲突，给提示但不改用户填写 */
  conflicts: string[];
}

/** 术语审计：空值回退、同名冲突提示（worldview_configuration_system §3.3 / §6.3） */
export const auditTerminology = (
  value: unknown,
  defaults: Record<string, string> = DEFAULT_WORLD_TERMINOLOGY
): TerminologyAudit => {
  const entries: Record<string, string> = {};
  const empty: string[] = [];
  const conflicts: string[] = [];
  if (!isRecord(value)) return { entries, empty, conflicts };

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'string') {
      empty.push(key);
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      empty.push(key);
      continue;
    }
    entries[key] = trimmed;
    // 冲突：世界内称呼撞上了**另一个**术语的默认名（例如把 政治 叫成「经济」）。
    // 等于自己的默认名不算冲突（race / races 的默认名都是「种族」）。
    const clash =
      trimmed !== defaults[key] &&
      Object.entries(defaults).some(([otherKey, name]) => otherKey !== key && name === trimmed);
    if (clash) conflicts.push(key);
  }
  return { entries, empty, conflicts: [...new Set(conflicts)].sort() };
};

/** 术语查询：命中则用世界内称呼，否则回退默认（只影响显示） */
export const termFor = (
  terminology: Record<string, string> | null | undefined,
  key: string,
  fallback?: string
): string => {
  const value = terminology?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback ?? DEFAULT_WORLD_TERMINOLOGY[key] ?? key;
};

/** 恢复默认：返回一份「删掉用户覆盖」的术语草稿（空对象 = 全默认） */
export const resetTerminology = (): Record<string, string> => ({});

// ---------- 历法（worldview_configuration_system §3.4） ----------

export interface WorldCalendarModel {
  eraName: string;
  epochLabel: string;
  timeFormat: string;
  unified: boolean;
  /** 未知键原样保留 */
  raw: Record<string, unknown>;
}

export const DEFAULT_WORLD_CALENDAR: Omit<WorldCalendarModel, 'raw'> = {
  eraName: '',
  epochLabel: '',
  timeFormat: '',
  unified: false,
};

/** 历法是展示/排序配置；自然语言时间原文存储，这里只做字段归一 */
export const parseWorldCalendar = (value: unknown): WorldCalendarModel => {
  const raw = isRecord(value) ? value : {};
  const text = (input: unknown): string => (typeof input === 'string' ? input : '');
  return {
    eraName: text(raw.eraName),
    epochLabel: text(raw.epochLabel),
    timeFormat: text(raw.timeFormat),
    unified: raw.unified === true,
    raw,
  };
};

// ---------- World.settings 整体 ----------

export interface WorldSettingsModel {
  terminology: Record<string, string>;
  calendar: WorldCalendarModel;
  complexity: ComplexityLevel;
  defaultModule: string;
  /** 原始 settings（含未知键） */
  raw: Record<string, unknown>;
}

/** settings 解析：规范化四个受管键，未知键原样保留 */
export const parseWorldSettings = (value: unknown): WorldSettingsModel => {
  const raw = isRecord(value) ? value : {};
  return {
    terminology: auditTerminology(raw.terminology).entries,
    calendar: parseWorldCalendar(raw.calendar),
    complexity: normalizeWorldComplexity(raw.complexity),
    defaultModule:
      typeof raw.defaultModule === 'string' && raw.defaultModule.trim()
        ? raw.defaultModule.trim()
        : WORLD_DEFAULT_MODULE,
    raw,
  };
};

/** 设置页保存：浅合并补丁到原始 settings，未编辑的未知键不会被抹掉 */
export const mergeWorldSettings = (
  raw: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> => ({ ...(isRecord(raw) ? raw : {}), ...patch });

/** 复杂度切换的 PUT 载荷（P2 遗留：复杂度必须落库，而非会话内） */
export const buildComplexityPatch = (
  world: Pick<World, 'settings'> | null | undefined,
  level: ComplexityLevel
): { settings: Record<string, unknown> } => ({
  settings: mergeWorldSettings(world?.settings, { complexity: normalizeWorldComplexity(level) }),
});

// ---------- 世界列表与切换（ui_design §3.1） ----------

/**
 * 按更新时间倒序；时间相同时按 id 稳定排序（不依赖服务端返回顺序）。
 * 不用名称参与比较：中文名称的 localeCompare 结果依赖运行时 ICU，跨环境不稳定。
 */
export const sortWorlds = (worlds: World[]): World[] =>
  [...worlds].sort((a, b) => {
    const updated = (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
    if (updated !== 0) return updated;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });

/** 默认选中第一个世界；当前世界被删除后回退到列表首位 */
export const pickCurrentWorldId = (
  worlds: World[],
  currentId?: string | null
): string | null => {
  const sorted = sortWorlds(worlds);
  if (!sorted.length) return null;
  if (currentId && sorted.some((world) => world.id === currentId)) return currentId;
  return sorted[0].id;
};

/**
 * 收敛当前世界：优先记忆值，其次列表首位。
 *
 * `pendingId` 是「刚创建 / 刚恢复为新世界、列表还没刷新回来」的目标世界：
 * 只要它还挂着就直接选它，否则收敛会用陈旧列表把选择覆盖回 sorted[0]，
 * 新建 / 恢复出来的世界永远选不中（P6 复审修复）。
 * 调用方在列表里看到它之后清掉 pending，收敛回到正常记忆逻辑。
 */
export const resolveCurrentWorldId = (
  worlds: World[],
  currentId?: string | null,
  pendingId?: string | null
): string | null => {
  if (pendingId) return pendingId;
  return pickCurrentWorldId(worlds, currentId);
};

/** 当前世界记忆的 localStorage 作用域：按项目隔离，切项目不串世界 */
export const currentWorldStorageKey = (projectId?: string | null): string =>
  `localscribe.worldbuilding.currentWorld.${projectId ?? 'default'}`;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const defaultStorage = (): StorageLike | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readCurrentWorldId = (
  projectId?: string | null,
  storage: StorageLike | null = defaultStorage()
): string | null => {
  try {
    // 删除世界时写的是空串（表示「无记忆」），读回来必须归一成 null，
    // 否则空串会被当成有效 id 参与收敛判定
    return storage?.getItem(currentWorldStorageKey(projectId)) || null;
  } catch {
    return null;
  }
};

export const writeCurrentWorldId = (
  projectId: string | null | undefined,
  worldId: string | null,
  storage: StorageLike | null = defaultStorage()
): void => {
  try {
    storage?.setItem(currentWorldStorageKey(projectId), worldId ?? '');
  } catch {
    // 隐私模式 / SSR：记忆失败不影响本次会话
  }
};

/** 列表项：/worlds 列表只有 module_count / link_count，实体数仅在拿到详情时才有 */
export interface WorldListItem {
  id: string;
  name: string;
  description: string;
  coverImage: string | null;
  moduleCount: number;
  linkCount: number;
  /** 未知时为 null（列表接口不返回实体数） */
  entityCount: number | null;
  updatedAt: string;
  updatedLabel: string;
}

export const formatWorldDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const worldListItemOf = (world: World, entityCount?: number | null): WorldListItem => ({
  id: world.id,
  name: world.name,
  description: (world.description ?? '').trim(),
  coverImage: world.cover_image ?? null,
  moduleCount: world.module_count ?? 0,
  linkCount: world.link_count ?? 0,
  entityCount: typeof entityCount === 'number' ? entityCount : null,
  updatedAt: world.updated_at ?? '',
  updatedLabel: formatWorldDate(world.updated_at),
});

// ---------- 空白创建（ui_design §3.2） ----------

export interface WorldCreateInput {
  name: string;
  description?: string;
  coverImage?: string;
  palette?: WorldPalette;
  accent?: string;
  texture?: WorldTexture;
  radius?: WorldRadius;
  complexity?: ComplexityLevel;
  defaultModule?: string;
}

/**
 * 空白创建载荷：只带名称/描述/基调/默认复杂度与默认模块。
 * 不携带任何预设内容、类型选择器或模板标识（§3.2「新世界为空」）。
 */
export const buildWorldCreatePayload = (
  input: WorldCreateInput,
  projectId?: string | null
): WorldCreatePayload => {
  const palette = input.palette ?? DEFAULT_WORLD_TONE.palette;
  const tone = {
    palette,
    accent: input.accent?.trim() || paletteOptionOf(palette).accent,
    texture: input.texture ?? DEFAULT_WORLD_TONE.texture,
    radius: input.radius ?? DEFAULT_WORLD_TONE.radius,
  };
  const settings: Record<string, unknown> = {
    complexity: normalizeWorldComplexity(input.complexity ?? WORLD_DEFAULT_COMPLEXITY),
    defaultModule: input.defaultModule?.trim() || WORLD_DEFAULT_MODULE,
  };
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    cover_image: input.coverImage?.trim() || null,
    project_id: projectId ?? null,
    tone,
    settings,
  };
};

// ---------- 设置面板「模块」页（worldview_configuration_system §5.1） ----------

export interface WorldModuleRow {
  moduleType: WorldModuleType;
  moduleId: string | null;
  label: string;
  /** kind 数（模块配置 entityTypes，缺省为内置推荐） */
  kindCount: number;
  /** 字段数（fieldSchema 全部 kind 的字段和） */
  fieldCount: number;
  /** 是否已自定义（config 里有 entityTypes / fieldSchema / levels / statuses / linkTypes 任一非空） */
  customised: boolean;
  submoduleCount: number;
  itemCount: number;
}

const configRecordOf = (module?: WorldModuleV2 | null): Record<string, unknown> =>
  isRecord(module?.config) ? (module?.config as Record<string, unknown>) : {};

const countFields = (config: Record<string, unknown>): number => {
  const schema = isRecord(config.fieldSchema) ? config.fieldSchema : {};
  let total = 0;
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total;
};

/** 七个模块一行：kind 数 / 字段数 / 是否自定义（模块页统计，缺模块也要占行） */
export const worldModuleRows = (
  modules: WorldModuleV2[] | null | undefined,
  builtinsOf: (moduleType: string) => EntityTypeDef[] = () => []
): WorldModuleRow[] =>
  WORLD_MODULE_TYPES.map((moduleType) => {
    const module = (modules ?? []).find((item) => item.module_type === moduleType) ?? null;
    const config = configRecordOf(module);
    const entityTypes = Array.isArray(config.entityTypes) ? config.entityTypes : [];
    const builtins = builtinsOf(moduleType);
    const levels = Array.isArray(config.levels) ? config.levels.length : 0;
    const statuses = Array.isArray(config.statuses) ? config.statuses.length : 0;
    const linkTypes = Array.isArray(config.linkTypes) ? config.linkTypes.length : 0;
    const fieldCount = countFields(config);
    return {
      moduleType,
      moduleId: module?.id ?? null,
      label: module?.name ?? moduleType,
      kindCount: entityTypes.length || builtins.length,
      fieldCount,
      customised: entityTypes.length > 0 || fieldCount > 0 || levels > 0 || statuses > 0 || linkTypes > 0,
      submoduleCount: module?.submodule_count ?? 0,
      itemCount: module?.item_count ?? 0,
    };
  });

// ---------- 世界脉络入口决策（ui_design §5.5） ----------

/** 节点上限与 config/WorldWeb.tsx 的 WEB_NODE_LIMIT 必须一致（phase6.spec 有静态护栏） */
export const WORLD_WEB_NODE_LIMIT = 800;

export interface WebEntryDecision {
  visible: boolean;
  reason: string;
}

/**
 * 入口可见性（ui_design §5.5 / Lead 冻结口径）：
 * - sandbox：入口默认可见；
 * - structure：入口可见，由用户点击（本地 state）手动开启；
 * - sketch：不提供入口（只读图依赖关联数据）。
 */
export const webEntryDecision = (complexity: ComplexityLevel): WebEntryDecision => {
  if (complexity === 'sandbox') return { visible: true, reason: '沙盘档默认可见' };
  if (complexity === 'structure') return { visible: true, reason: '结构档需手动点击开启' };
  return { visible: false, reason: '速写档不提供世界脉络' };
};


// ---------- 失效引用（T7 缺口：目标已删除） ----------

export interface BrokenRefNotice {
  ref: EntityRef;
  label: string;
  /** 触发跳转的来源模块（查看来源用） */
  fromModule: string | null;
}

/** 目标实体不在当前世界详情里即视为失效引用（删除后仍留痕） */
export const brokenRefNotice = (
  ref: EntityRef,
  index: Map<string, string>,
  fromModule?: string | null
): BrokenRefNotice | null => {
  const known = index.get(ref.id);
  if (known) return null;
  return { ref, label: `${ref.kind}·${ref.id.slice(0, 8)}`, fromModule: fromModule ?? null };
};
