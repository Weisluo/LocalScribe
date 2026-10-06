/**
 * 体系模块配置与视觉常量（Phase 3 P3-T5/T8；systems_ui_design §3.4/§4.4/§7）
 *
 * 不预置任何体系/阶位内容：只有模块骨架默认配置（类型、术语、步长、节点样式、典籍字段）。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  kindDefsOf,
  mergeModuleConfig,
  validateEntityType,
  type EntityTypeDef,
  type ModuleConfig,
} from '../shared/moduleConfig';
import {
  DEFAULT_RANK_STEP,
  SYSTEM_CODEX_ITEMS,
  SYSTEM_KINDS,
  SYSTEMS_MAX_DEPTH,
  type CodexItemDef,
} from './types';

export const SYSTEMS_DEFAULT_COMPLEXITY: ComplexityLevel = 'sketch';

export const SYSTEMS_DISPLAY_MODES = ['stair', 'codex'] as const;
export type SystemsDisplayMode = (typeof SYSTEMS_DISPLAY_MODES)[number];

export const SYSTEMS_TERM_DEFAULTS: Record<string, string> = {
  system: '体系',
  tier: '阶位',
  ability: '能力',
  rule: '规则',
  cost: '代价',
  stair: '阶梯',
  codex: '典籍',
  breakthrough: '突破条件',
  newSystem: '新建体系',
  newTier: '添加阶位',
  emptyTitle: '还没有体系',
};

/** systems_ui_design §4.4 节点样式默认值（Lucide 名） */
export const DEFAULT_NODE_STYLES: Record<string, { icon?: string; color?: string }> = {
  system: { icon: 'layers', color: 'violet' },
  tier: { icon: 'chevrons-up', color: 'violet' },
  ability: { icon: 'gift', color: 'purple' },
  rule: { icon: 'scroll-text', color: 'violet' },
  cost: { icon: 'flame', color: 'orange' },
};

export const DEFAULT_COST_FIELDS = ['resource', 'time', 'reputation'];

/** 模块默认配置：骨架，不含任何体系内容 */
export const SYSTEMS_CONFIG_DEFAULTS: ModuleConfig = {
  defaultComplexity: SYSTEMS_DEFAULT_COMPLEXITY,
  displayMode: 'stair',
  entityTypes: SYSTEM_KINDS,
  tierTerm: SYSTEMS_TERM_DEFAULTS.tier,
  rankStep: DEFAULT_RANK_STEP,
  nodeStyles: DEFAULT_NODE_STYLES,
  costFields: DEFAULT_COST_FIELDS,
  statuses: [],
  levels: [],
  fieldSchema: {},
};

export const resolveSystemsConfig = (config: ModuleConfig): ModuleConfig =>
  mergeModuleConfig(SYSTEMS_CONFIG_DEFAULTS, config);

export const systemsKindDefs = (config: ModuleConfig): EntityTypeDef[] =>
  kindDefsOf(resolveSystemsConfig(config), SYSTEM_KINDS);

export const systemCodexItems = (): CodexItemDef[] => SYSTEM_CODEX_ITEMS;

/** 阶位术语：模块 config.tierTerm 优先 */
export const tierTermOf = (config: ModuleConfig): string =>
  config.tierTerm || SYSTEMS_TERM_DEFAULTS.tier;

export const rankStepOf = (config: ModuleConfig): number => {
  const step = config.rankStep;
  return typeof step === 'number' && step > 0 ? step : DEFAULT_RANK_STEP;
};

export const nodeStyleOf = (
  config: ModuleConfig,
  kind: string
): { icon?: string; color?: string } => ({
  ...(DEFAULT_NODE_STYLES[kind] ?? {}),
  ...(config.nodeStyles?.[kind] ?? {}),
});

/** 自定义体系 kind 校验：custom_ 前缀 + parentKind=system + 深度 <= 3 */
export const validateSystemKind = (
  config: ModuleConfig,
  def: EntityTypeDef
): string | null =>
  validateEntityType(resolveSystemsConfig(config), def, {
    builtins: SYSTEM_KINDS,
    maxDepth: SYSTEMS_MAX_DEPTH,
  });
