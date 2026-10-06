/**
 * 政治模块配置与视觉常量（Phase 4 P4-T1；politics_ui_design §3.7/§4.1/§4.7/§7.5）
 *
 * 空白世界原则：这里只有模块骨架的默认配置（四 kind、红金色板、线型表、默认视图），
 * 不预置任何等级、状态、政体、组织子类型、条约类型、派系或示例数据。
 * levels / statuses / fieldSchema / linkTypes / terminology 全部为空，由用户自建。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  kindDefsOf,
  validateEntityType,
  type EntityTypeDef,
  type ModuleConfig,
} from '../shared/moduleConfig';
import {
  POLITICS_BUILTIN_KINDS,
  POLITICS_ITEM_GROUP_LABELS,
  POLITICS_MAX_ORG_DEPTH,
  POLITICS_MODULE,
  POLITICS_RELATION_LAYERS,
  type PoliticsItemGroup,
  type PoliticsLinkType,
} from './types';

export const POLITICS_DEFAULT_COMPLEXITY: ComplexityLevel = 'sketch';

/** §3.7 displayMode：默认打开权力版图 */
export const POLITICS_DISPLAY_MODE = 'atlas';

export const POLITICS_VIEWS = ['atlas', 'roster', 'chronicle'] as const;
export type PoliticsViewId = (typeof POLITICS_VIEWS)[number];

export const POLITICS_VIEW_LABELS: Record<PoliticsViewId, string> = {
  atlas: '版图',
  roster: '名录',
  chronicle: '沿革',
};

export const POLITICS_VIEW_ICONS: Record<PoliticsViewId, string> = {
  atlas: 'layout-dashboard',
  roster: 'list-tree',
  chronicle: 'git-commit-horizontal',
};

/** §7.5 术语默认值；terminology 仅在 config 中登记可替换键，不预填用户世界用词。 */
export const POLITICS_TERM_DEFAULTS: Record<string, string> = {
  all: '全部',
  polity: '政权',
  organization: '组织',
  figure: '人物',
  treaty: '条约',
  atlas: '权力版图',
  roster: '名录',
  chronicle: '沿革',
  treatyBook: '条约簿',
  independentLane: '独立势力',
  newPolity: '新建政权',
  newOrganization: '添加组织',
  newFigure: '关联人物',
  newTreaty: '发起条约',
  emptyTitle: '政治模块还是空白',
};

/** §4.1 领域色板：红金体系，light / dark 两套值。 */
export interface PoliticsPalette {
  accent: { light: string; dark: string };
  surface: { light: string; dark: string };
  polity: { light: string; dark: string };
  organization: { light: string; dark: string };
  figure: { light: string; dark: string };
  treaty: { light: string; dark: string };
}

export const POLITICS_PALETTE: PoliticsPalette = {
  accent: { light: '#b45309', dark: '#f59e0b' },
  surface: { light: '#fdf6ec', dark: '#2a1c0d' },
  polity: { light: '#a16207', dark: '#e0b84c' },
  organization: { light: '#b91c1c', dark: '#f87171' },
  figure: { light: '#475569', dark: '#94a3b8' },
  treaty: { light: '#15803d', dark: '#4ade80' },
};

/** 契约 §6.5 领域色名 -> 模块内 Tailwind 类（不新增契约外颜色语义）。 */
export const POLITICS_TONE_CLASSES: Record<string, string> = {
  gold: 'text-amber-700 dark:text-amber-300 border-amber-500/40',
  red: 'text-red-700 dark:text-red-300 border-red-500/40',
  slate: 'text-slate-700 dark:text-slate-300 border-slate-500/40',
  green: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  emerald: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  blue: 'text-blue-700 dark:text-blue-300 border-blue-500/40',
  pink: 'text-pink-700 dark:text-pink-300 border-pink-500/40',
  amber: 'text-amber-700 dark:text-amber-300 border-amber-500/40',
  teal: 'text-teal-700 dark:text-teal-300 border-teal-500/40',
  violet: 'text-violet-700 dark:text-violet-300 border-violet-500/40',
  neutral: 'text-muted-foreground border-border/60',
};

/** §4.1 线型与箭头规范（画布边层用；颜色随契约 LinkTypeDef，线型按语义固定）。 */
export interface PoliticsLineStyle {
  id: PoliticsLinkType;
  label: string;
  lineStyle: 'solid' | 'dashed' | 'double';
  directed: boolean;
  icon: string;
  color: string;
}

export const POLITICS_LINE_STYLES: PoliticsLineStyle[] = POLITICS_RELATION_LAYERS.map(
  (layer) => ({
    id: layer.id,
    label: layer.label,
    lineStyle: layer.lineStyle,
    directed: layer.directed,
    icon: layer.icon,
    color: layer.color,
  })
);

/** 条约缎带的固定线型：宽双线 + 绿色（§4.1）。 */
export const TREATY_RIBBON_STYLE = {
  lineStyle: 'double' as const,
  color: 'green',
  icon: 'pen-line',
};

/** §4.1 尺寸表：rank 档 -> 政权节点宽度与详情默认宽度。 */
export const ATLAS_NODE_WIDTH: Record<'high' | 'mid' | 'low', number> = {
  high: 360,
  mid: 240,
  low: 160,
};

export const ATLAS_NODE_MIN_WIDTH: Record<'high' | 'mid' | 'low', number> = {
  high: 320,
  mid: 200,
  low: 140,
};

export const ATLAS_NODE_MAX_WIDTH: Record<'high' | 'mid' | 'low', number> = {
  high: 420,
  mid: 280,
  low: 180,
};

/** §4.3 详情面板默认宽度（政权 / 组织 / 人物 / 条约） */
export const FOCUS_PANEL_WIDTH: Record<string, number> = {
  polity: 520,
  organization: 420,
  figure: 380,
  treaty: 480,
};

/** §4.4 名录行高（政权 / 组织 / 人物 / 条约） */
export const ROSTER_ROW_HEIGHT: Record<string, number> = {
  polity: 56,
  organization: 40,
  figure: 32,
  treaty: 36,
};

/** §2.2 头像条默认最多 5 个 + 溢出计数 */
export const FIGURE_STRIP_MAX = 5;
/** 中屏 1024-1439px 头像条最多 3 个（§4.9） */
export const FIGURE_STRIP_MAX_MEDIUM = 3;

/** 缎带中点条款浮层尺寸（§4.6.3） */
export const TREATY_FLOAT_WIDTH = 320;

/** 模块默认配置：仅为骨架，不含任何世界观内容（§3.7）。 */
export const POLITICS_CONFIG_DEFAULTS: ModuleConfig = {
  defaultComplexity: POLITICS_DEFAULT_COMPLEXITY,
  displayMode: POLITICS_DISPLAY_MODE,
  entityTypes: POLITICS_BUILTIN_KINDS,
  levels: [],
  statuses: [],
  fieldSchema: {},
  linkTypes: [],
  terminology: {},
  palette: {
    accent: POLITICS_PALETTE.accent.light,
    surface: POLITICS_PALETTE.surface.light,
  },
};

/** 缺省值 + 后端 config（未知键保留） */
export const resolvePoliticsConfig = (config: ModuleConfig): ModuleConfig => {
  const next: ModuleConfig = { ...POLITICS_CONFIG_DEFAULTS };
  for (const [key, value] of Object.entries(config ?? {})) {
    if (value === undefined) continue;
    next[key] = value;
  }
  // 空数组也视为「用户清空」，但内置四 kind 必须始终可用（否则版图无从渲染）
  if (!Array.isArray(next.entityTypes) || next.entityTypes.length === 0) {
    next.entityTypes = POLITICS_BUILTIN_KINDS;
  }
  return next;
};

export const politicsKindDefs = (config: ModuleConfig): EntityTypeDef[] =>
  kindDefsOf(resolvePoliticsConfig(config), POLITICS_BUILTIN_KINDS);

export const politicsKindDef = (
  config: ModuleConfig,
  kind: string
): EntityTypeDef | undefined => politicsKindDefs(config).find((def) => def.id === kind);

/**
 * 自定义 kind 校验：custom_ 前缀 + parentKind + 组织树深度上限。
 * 政治只允许三种附着层，禁止新增平级主视图（§7.1.2）。
 */
export const validatePoliticsKind = (
  config: ModuleConfig,
  def: EntityTypeDef
): string | null => {
  const attachment = (def as { attachment?: unknown }).attachment;
  if (
    attachment !== undefined &&
    attachment !== 'satellite' &&
    attachment !== 'independent' &&
    attachment !== 'edge'
  ) {
    return '自定义类型必须声明附着层：satellite / independent / edge';
  }
  return validateEntityType(resolvePoliticsConfig(config), def, {
    builtins: POLITICS_BUILTIN_KINDS,
    maxDepth: POLITICS_MAX_ORG_DEPTH,
  });
};

/** items 字段组展示名（内置组；custom 组按自定义字段渲染，不进 fieldSchema） */
export const itemGroupLabel = (group: PoliticsItemGroup): string =>
  POLITICS_ITEM_GROUP_LABELS[group] ?? group;

/** 模块默认视图：displayMode 只接受三主视图之一（次级条约簿不是主视图）。 */
export const resolvePoliticsView = (displayMode: unknown): PoliticsViewId =>
  displayMode === 'roster' || displayMode === 'chronicle' ? displayMode : POLITICS_VIEWS[0];

export { POLITICS_MODULE };
