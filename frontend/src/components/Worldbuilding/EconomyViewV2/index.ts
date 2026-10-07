/**
 * EconomyViewV2 汇总导出（Phase 5 P5-T8/P5-T9/P5-T15）
 *
 * 导出名固定为 `EconomyViewV2`（WorldbuildingView 按 feature flag 选择新旧经济视图）。
 * 同时导出 query key 工厂与视图状态 hook，便于离线 harness 预置缓存与单测。
 */

export { EconomyViewV2 } from './EconomyView';
export { default } from './EconomyView';
export * from './types';
export {
  ECONOMY_ITEM_NAMES,
  chipRefId,
  economyKeys,
  economyLayerDefaults,
  economyRefOf,
  metricSamplesOf,
  useEconomyData,
} from './hooks/useEconomyData';
export type { UseEconomyDataExtra, UseEconomyDataOptions } from './hooks/useEconomyData';
export { ECONOMY_URL_KEYS, newEconomyId, useEconomyViewState } from './hooks/useEconomyViewState';
export type {
  UseEconomyViewStateOptions,
  UseEconomyViewStateResult,
} from './hooks/useEconomyViewState';
