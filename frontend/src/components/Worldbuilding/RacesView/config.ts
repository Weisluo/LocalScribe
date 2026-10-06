/**
 * 种族模块配置与视觉常量（Phase 3 P3-T2/T8；races_ui_design §3.4/§4.4/§7）
 *
 * 不预置任何种族内容：这里只有模块骨架的默认配置（类型、语义分色、色板、卡片字段顺序）。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  kindDefsOf,
  mergeModuleConfig,
  validateEntityType,
  type EntityTypeDef,
  type ModuleConfig,
} from '../shared/moduleConfig';
import { toneColor } from './components/toneColor';
import {
  DEFAULT_RACE_RELATION_KINDS,
  RACE_ATLAS_ITEMS,
  RACE_KIND,
  RACE_KINDS,
  RACES_MAX_DEPTH,
  type RaceNode,
} from './types';

export const RACES_DEFAULT_COMPLEXITY: ComplexityLevel = 'sketch';

export const RACES_DISPLAY_MODES = ['atlas', 'lineage'] as const;
export type RacesDisplayMode = (typeof RACES_DISPLAY_MODES)[number];

export const RACES_TERM_DEFAULTS: Record<string, string> = {
  race: '种族',
  subrace: '亚种',
  atlas: '图鉴',
  lineage: '血缘树',
  newRace: '新建种族',
  newSubrace: '添加支系',
  emptyTitle: '还没有种族条目',
};

/**
 * races_ui_design §4.4 领域色板：取 4 个中间调 teal（深色主题下不刺眼、浅色主题下也能压住白底），
 * 避免把暗色主题专用的浅 teal（如 #5eead4）混进两套主题共用的纹章底色。
 */
export const EMBLEM_PALETTE: string[] = ['#0f766e', '#0d9488', '#115e59', '#14b8a6'];

export const EMBLEM_FALLBACK_ICON = 'book-marked';

export const RACE_CARD_FIELD_LABELS: Record<string, string> = {
  tagline: '一句话特征',
  habitat: '居住地',
  traits: '特征标签',
  linkCount: '关联计数',
};

export const DEFAULT_RACE_CARD_FIELDS = ['tagline', 'habitat', 'traits', 'linkCount'];

/** 模块默认配置：仅为骨架，不含任何种族/亚种内容 */
export const RACES_CONFIG_DEFAULTS: ModuleConfig = {
  defaultComplexity: RACES_DEFAULT_COMPLEXITY,
  displayMode: 'atlas',
  entityTypes: RACE_KINDS,
  relationKinds: DEFAULT_RACE_RELATION_KINDS,
  emblemPalette: EMBLEM_PALETTE,
  cardFields: DEFAULT_RACE_CARD_FIELDS,
  statuses: [],
  levels: [],
  fieldSchema: {},
};

/** 缺省值 + 后端 config（未知键保留） */
export const resolveRacesConfig = (config: ModuleConfig): ModuleConfig =>
  mergeModuleConfig(RACES_CONFIG_DEFAULTS, config);

export const racesKindDefs = (config: ModuleConfig): EntityTypeDef[] =>
  kindDefsOf(resolveRacesConfig(config), RACE_KINDS);

export const raceAtlasItems = () => RACE_ATLAS_ITEMS;

export const emblemPaletteOf = (config: ModuleConfig): string[] => {
  const palette = config.emblemPalette;
  return Array.isArray(palette) && palette.length > 0 ? palette : EMBLEM_PALETTE;
};

export const cardFieldsOf = (config: ModuleConfig): string[] => {
  const fields = config.cardFields;
  return Array.isArray(fields) && fields.length > 0
    ? fields.filter((field) => typeof field === 'string')
    : DEFAULT_RACE_CARD_FIELDS;
};

/** 6 位 hex：可以直接作为 CSS 颜色使用 */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * 纹章颜色：meta.emblem.color -> 色板第一项 -> 节点 color -> 领域默认。
 * 旧后端的 node.color 是编码而不是 CSS（era:ochre、type:currency:global，见
 * backend/app/models/worldbuilding.py），直接塞进 backgroundColor 无效，这里折算成领域色。
 */
export const emblemColorOf = (node: RaceNode, config: ModuleConfig): string => {
  const raw = node.meta.emblem?.color ?? node.color;
  if (!raw) return emblemPaletteOf(config)[0];
  if (HEX_COLOR.test(raw) || emblemPaletteOf(config).includes(raw)) return raw;
  return toneColor(raw);
};

export const emblemIconOf = (node: RaceNode): string =>
  node.meta.emblem?.icon ?? node.icon ?? EMBLEM_FALLBACK_ICON;

/** 缺图时用名称首字生成字母章（不用 emoji） */
export const emblemLetter = (name: string): string =>
  (name.trim()[0] ?? '?').toUpperCase();

/** 自定义族裔 kind 校验：custom_ 前缀 + parentKind + 深度 <= 2 */
export const validateRaceKind = (
  config: ModuleConfig,
  def: EntityTypeDef
): string | null =>
  validateEntityType(resolveRacesConfig(config), def, {
    builtins: RACE_KINDS,
    maxDepth: RACES_MAX_DEPTH,
  });

/** 可挂支系的父级 kind（第一层） */
export const raceRootKindIds = (config: ModuleConfig): string[] =>
  racesKindDefs(config)
    .filter((def) => !def.parentKind || def.id === RACE_KIND)
    .map((def) => def.id);
