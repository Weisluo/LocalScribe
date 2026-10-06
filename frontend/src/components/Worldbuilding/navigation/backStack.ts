/**
 * 世界视图导航返回栈（Phase 2 P2-T7，接口见 phase2_interface_freeze.md §5）
 *
 * 纯函数、无 React/DOM 依赖，便于单测：视图在「进入实体」前把当前列表状态
 * 压栈，返回时按快照恢复滚动位置、展开态与被选中项；恢复失败由调用方
 * 退化为默认列表态（phase2 §8「导航栈」）。
 */

import type { EntityRef } from '@/services/worldbuildingApi';

/** 进入实体前的列表快照 */
export interface ListSnapshot {
  /** 当时的模块 tab（TabType 的字符串形态，栈本身不依赖视图枚举） */
  tab: string;
  scrollTop: number;
  /** 已展开的子模块 id */
  expandedIds: string[];
  /** 当时被选中的实体 */
  selectedRef?: EntityRef;
}

export interface NavFrame {
  ref: EntityRef;
  label: string;
  /** 进入该实体之前的状态，返回时用于恢复 */
  snapshot: ListSnapshot;
}

/** 栈帧只读，禁止在视图里就地改写 */
export interface BackStackState {
  frames: readonly NavFrame[];
}

export interface BreadcrumbItem {
  label: string;
  ref?: EntityRef;
}

export const EMPTY_BACK_STACK: BackStackState = { frames: [] };

/** 新建空栈 */
export const createBackStack = (): BackStackState => EMPTY_BACK_STACK;

/** 清空全部帧（保留调用点对称性） */
export const clearStack = (stack: BackStackState): BackStackState =>
  stack.frames.length === 0 ? stack : EMPTY_BACK_STACK;

/** 重置为空栈（与 createBackStack 同义，供视图切换项目时调用） */
export const resetStack = (): BackStackState => EMPTY_BACK_STACK;

/** 返回栈深度上限：超出时丢弃最老的帧，避免反复进入实体导致无界增长 */
export const MAX_BACK_STACK_DEPTH = 8;

export const pushFrame = (stack: BackStackState, frame: NavFrame): BackStackState => {
  const frames = [...stack.frames, frame];
  return {
    frames:
      frames.length > MAX_BACK_STACK_DEPTH
        ? frames.slice(frames.length - MAX_BACK_STACK_DEPTH)
        : frames,
  };
};

export const peekFrame = (stack: BackStackState): NavFrame | undefined =>
  stack.frames[stack.frames.length - 1];

export const depthOf = (stack: BackStackState): number => stack.frames.length;

export const isAtRoot = (stack: BackStackState): boolean => stack.frames.length === 0;

export interface PopResult {
  stack: BackStackState;
  /** 被退出的帧；为空表示已在根，调用方不改变任何状态 */
  popped?: NavFrame;
}

/** 退出一帧；返回被退出帧的快照供调用方恢复 */
export const popFrame = (stack: BackStackState): PopResult => {
  if (stack.frames.length === 0) {
    return { stack, popped: undefined };
  }
  const popped = stack.frames[stack.frames.length - 1];
  return { stack: { frames: stack.frames.slice(0, -1) }, popped };
};

export interface PopToResult {
  stack: BackStackState;
  /** 被退出的最浅一帧（frames[depth]），即用户点击面包屑时离开的视图 */
  exited?: NavFrame;
}

/** 面包屑跳转：保留 depth 帧，其余整体退出 */
export const popToDepth = (stack: BackStackState, depth: number): PopToResult => {
  const keep = Math.max(0, Math.min(depth, stack.frames.length));
  if (keep >= stack.frames.length) {
    return { stack, exited: undefined };
  }
  return {
    stack: { frames: stack.frames.slice(0, keep) },
    exited: stack.frames[keep],
  };
};

/** 面包屑：根 + 每一帧（根无 ref，点击即回到列表） */
export const toBreadcrumbs = (
  stack: BackStackState,
  rootLabel: string
): BreadcrumbItem[] => [
  { label: rootLabel },
  ...stack.frames.map((frame) => ({ label: frame.label, ref: frame.ref })),
];
