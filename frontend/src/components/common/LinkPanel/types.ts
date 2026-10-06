/**
 * LinkPanel 类型（Phase 2 P2-T4，接口冻结见 phase2_interface_freeze.md §3.4）
 *
 * 冻结签名不得改名改形；如需变更先改冻结记录并同步 Lead。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import type { ComplexityLevel } from '@/components/common/ComplexitySwitcher';

export interface LinkPanelProps {
  worldId: string;
  entity: EntityRef;
  /** 缺省读 useComplexity() */
  complexity?: ComplexityLevel;
  onNavigate?: (ref: EntityRef) => void;
  /** 默认「关联」 */
  title?: string;
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * §11.3（politics_ui_design）：单选实体出入链超过 200 条时分组折叠，
 * 每组先渲染前 20 条 + 「显示全部（N）」。
 *
 * 阈值放在共用件这一侧，避免 common 反向依赖具体模块视图；
 * PoliticsView/types 仍再导出同名符号（测试与政治侧代码引用不变）。
 */
export const LINKPANEL_FOLD_LIMIT = 200;

export const shouldFoldLinkPanel = (linkCount: number): boolean =>
  linkCount > LINKPANEL_FOLD_LIMIT;
