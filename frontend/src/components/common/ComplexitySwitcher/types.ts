/**
 * 复杂度三档（契约 §2.6 / §5.5）
 *
 * sketch / structure / sandbox 只控制披露程度，不删除数据：降档隐藏，升档恢复。
 * 能力矩阵是共用件与模块共同依赖的唯一口径，禁止在组件内各自判断档位。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';

export type { ComplexityLevel };

export const COMPLEXITY_LEVELS: ComplexityLevel[] = ['sketch', 'structure', 'sandbox'];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  sketch: '速写',
  structure: '结构',
  sandbox: '沙盘',
};

export const COMPLEXITY_DESCRIPTIONS: Record<ComplexityLevel, string> = {
  sketch: '3-5 个字段即可完成设定，只保留关联计数与行内引用',
  structure: '启用分类、字段组、关联面板与关系视图',
  sandbox: '启用数值、流量、时间维度与全局关联总览',
};

/** 契约 §5.5 的关联能力矩阵 */
export interface ComplexityCapabilities {
  /** 列表卡片/节点的关联计数徽章（三档都可见） */
  linkCounts: boolean;
  /** 行内引用 token（三档都可用） */
  inlineReference: boolean;
  /** 完整关联面板：出/入链分组 */
  linkPanel: boolean;
  /** 通用实体选择器（完整流程） */
  linkPicker: boolean;
  /** 简化添加关联：默认 core.related_to，标签可后改 */
  simpleLinkAdd: boolean;
  /** 关联时间维度（time.start/end） */
  linkTimeline: boolean;
  /** 强度/流量等 meta 字段 */
  linkMeta: boolean;
  /** 模块关系画布 */
  canvas: boolean;
  /** 世界脉络（全局只读关系图） */
  worldWeb: boolean;
}

export const COMPLEXITY_CAPABILITIES: Record<ComplexityLevel, ComplexityCapabilities> = {
  sketch: {
    linkCounts: true,
    inlineReference: true,
    linkPanel: false,
    linkPicker: false,
    simpleLinkAdd: true,
    linkTimeline: false,
    linkMeta: false,
    canvas: false,
    worldWeb: false,
  },
  structure: {
    linkCounts: true,
    inlineReference: true,
    linkPanel: true,
    linkPicker: true,
    simpleLinkAdd: true,
    linkTimeline: false,
    linkMeta: false,
    canvas: true,
    worldWeb: false,
  },
  sandbox: {
    linkCounts: true,
    inlineReference: true,
    linkPanel: true,
    linkPicker: true,
    simpleLinkAdd: true,
    linkTimeline: true,
    linkMeta: true,
    canvas: true,
    worldWeb: true,
  },
};

export const normalizeComplexity = (value?: string | null): ComplexityLevel =>
  value === 'structure' || value === 'sandbox' ? value : 'sketch';
