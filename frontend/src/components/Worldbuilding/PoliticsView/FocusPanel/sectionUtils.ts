/**
 * 聚焦详情的纯工具函数（Phase 4 P4-T8；politics_ui_design §4.3）
 *
 * 与渲染分离：锚点 id、时间范围文案、时间归一化都不依赖 React，
 * 放在单独文件里也避免 fast-refresh 因「同文件既有组件又有函数」失效。
 */

/** 分段锚点的 DOM id：同一实体唯一，避免多个固定面板之间互相命中 */
export const sectionDomId = (entityId: string, key: string): string =>
  `focus-${entityId}-${key}`;

/** 时间范围文案：两端都可缺省 */
export const timeRangeText = (start?: string | null, end?: string | null): string => {
  const from = start?.trim();
  const to = end?.trim();
  if (from && to) return `${from} ~ ${to}`;
  if (from) return `${from} 起`;
  if (to) return `至 ${to}`;
  return '';
};

/**
 * 契约 LinkTimeRange（端点 string | null）-> PoliticsTimeSpan（端点 string | undefined）：
 * 两者语义相同但可空性不同，行内改时间、撤销删除等回写路径都要先归一化。
 */
export const timeSpanOf = (
  time?: { start?: string | null; end?: string | null } | null
): { start?: string; end?: string } | undefined => {
  const start = time?.start ?? undefined;
  const end = time?.end ?? undefined;
  return start || end ? { start, end } : undefined;
};
