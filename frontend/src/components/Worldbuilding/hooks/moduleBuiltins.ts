/**
 * 各模块的内置（推荐）kind（Phase 6 P6-T1 设置面板「模块」页）
 *
 * 与模块视图同源：全部从各模块 config.ts 的出厂配置读取，禁止在这里另造一套。
 * 内置 kind 不可删除，是 ModuleConfigPanel / SubmoduleManager 的 parentKind 解析基准；
 * 用户自定义 kind 一律走 config.entityTypes，不写进这里。
 */

import type { EntityTypeDef } from '../shared/moduleConfig';
import { RACES_CONFIG_DEFAULTS } from '../RacesView/config';
import { SYSTEMS_CONFIG_DEFAULTS } from '../SystemsView/config';
import { POLITICS_CONFIG_DEFAULTS } from '../PoliticsView/config';
import { ECONOMY_RECOMMENDED_KINDS } from '../EconomyView/config';

/** 历史模块的模块语法（时代到事件的两层结构），只提供结构，不携带任何设定内容 */
export const HISTORY_BUILTINS: EntityTypeDef[] = [
  { id: 'era', label: '时代', icon: 'hourglass', color: 'amber' },
  { id: 'event', label: '事件', icon: 'scroll-text', color: 'amber' },
];

/** 模块内置 kind；map / special 本轮未接入，返回空数组 */
export const builtinsOf = (moduleType: string): EntityTypeDef[] => {
  switch (moduleType) {
    case 'history':
      return HISTORY_BUILTINS;
    case 'races':
      return RACES_CONFIG_DEFAULTS.entityTypes ?? [];
    case 'systems':
      return SYSTEMS_CONFIG_DEFAULTS.entityTypes ?? [];
    case 'politics':
      return POLITICS_CONFIG_DEFAULTS.entityTypes ?? [];
    case 'economy':
      return ECONOMY_RECOMMENDED_KINDS;
    default:
      return [];
  }
};

/**
 * 各模块允许的最大层级。
 *
 * 自定义 kind 必须声明 parentKind（moduleConfig.validateEntityType），所以任何
 * 「平铺内置 kind」的模块至少需要 2 层，否则世界设置入口的「类型」页 100% 报
 * 「层级超过上限（最多 1 层）」——而模块自己的入口用的却是真上限（政治 = 3）。
 * politics 与 PoliticsView/types.ts 的 POLITICS_MAX_ORG_DEPTH 保持一致。
 */
export const MAX_MODULE_DEPTH: Record<string, number> = {
  history: 2,
  races: 2,
  systems: 3,
  politics: 3,
  economy: 2,
};

/** 未单独声明的模块（map / special 尚未接入内置 kind）的层级下限 */
export const DEFAULT_MODULE_DEPTH = 2;
