/**
 * 体系视图共用小工具（Phase 3 P3-T5/T6；systems_ui_design §4.4/§5.2/§6.2）
 *
 * - lucideIcon / colorDot：把 nodeStyles 里的 Lucide 名与颜色 token 统一解析成图标与色点，
 *   全模块只用 Lucide，禁止 emoji；未知名字返回 undefined，由调用方回退默认值。
 * - linkLabelOf：关联行标签，出链用 label、入链用 reverse_label（契约 §2.5）。
 * - buildStairIndex：把阶梯边按阶位归并出「赋予 / 代价 / 站外代价 / 复用计数」，
 *   供阶位卡片、节点详情共用，避免各组件各自遍历 edges。
 */

import type { CSSProperties } from 'react';

import type { LinkTypeDef, WorldLink } from '@/services/worldbuildingApi';
import { COST_KIND, isTierNode, type StairEdge, type StairModel, type SystemNode } from '../types';

// Lucide 解析统一收敛到 shared/lucideIcon：lucide-react 的导出多为带 render 的 forwardRef 对象，
// 只判函数会永远失败；未知名字返回 undefined，由调用方回退默认图标。
export { lucideIcon } from '../../shared/lucideIcon';

/** systems_ui_design §4.4：领域强调色 violet 系，另有 kind 自带的 token */
const COLOR_CLASSES: Record<string, string> = {
  violet: 'bg-violet-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  slate: 'bg-slate-500',
  neutral: 'bg-neutral-500',
};

export interface ColorDot {
  className: string;
  style?: CSSProperties;
}

/** 颜色 token 或 hex -> 色点样式；未知 token 回退 violet */
export const colorDot = (color?: string): ColorDot => {
  const value = color?.trim();
  if (value && /^(#|rgb|hsl)/i.test(value)) {
    return { className: '', style: { backgroundColor: value } };
  }
  if (value && COLOR_CLASSES[value]) return { className: COLOR_CLASSES[value] };
  return { className: COLOR_CLASSES.violet };
};

/** 关联标签：出链 label，入链 reverse_label（缺省回退 link_type id） */
export const linkLabelOf = (
  link: WorldLink,
  linkTypes: Map<string, LinkTypeDef>,
  direction: 'out' | 'in' = 'out'
): string => {
  const definition = linkTypes.get(link.link_type);
  if (direction === 'out') return link.label || definition?.label || link.link_type;
  return (
    link.reverse_label || definition?.reverse_label || definition?.label || link.link_type
  );
};

export interface StairIndex {
  /** 阶位 -> 由它赋予的能力 / 规则节点（systems.grants） */
  granted: Map<string, SystemNode[]>;
  /** 阶位 -> 代价节点（systems.costs 指向体系内节点，或 grants 指向 cost kind） */
  costs: Map<string, SystemNode[]>;
  /** 阶位 -> 指向体系外的 costs 边（经济资源等，经济未接入时只显示文本） */
  externalCosts: Map<string, StairEdge[]>;
  /** 节点被 grants / costs 引用的次数：> 1 即命中复用标记（§4.2） */
  grantCounts: Map<string, number>;
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    map.set(key, [value]);
  }
};

/** 阶梯边 -> 按阶位归并的索引（只在 stair 变化时重算） */
export const buildStairIndex = (stair: StairModel): StairIndex => {
  const members = new Map(stair.members.map((node) => [node.id, node]));
  const granted = new Map<string, SystemNode[]>();
  const costs = new Map<string, SystemNode[]>();
  const externalCosts = new Map<string, StairEdge[]>();
  const grantCounts = new Map<string, number>();

  for (const edge of stair.edges) {
    if (edge.type !== 'grants' && edge.type !== 'costs') continue;
    grantCounts.set(edge.targetId, (grantCounts.get(edge.targetId) ?? 0) + 1);

    const target = members.get(edge.targetId);
    if (!target) {
      // 站外目标（如 economy.resource）：经济未接入时只作文本 chip
      if (edge.type === 'costs') push(externalCosts, edge.sourceId, edge);
      continue;
    }
    if (target.kind === COST_KIND || edge.type === 'costs') {
      const bucket = costs.get(edge.sourceId) ?? [];
      // 同一节点可能同时有 grants / costs 两条边，chip 只出现一次
      if (!bucket.some((node) => node.id === target.id)) {
        bucket.push(target);
        costs.set(edge.sourceId, bucket);
      }
    } else if (!isTierNode(target)) {
      const bucket = granted.get(edge.sourceId) ?? [];
      if (!bucket.some((node) => node.id === target.id)) {
        bucket.push(target);
        granted.set(edge.sourceId, bucket);
      }
    }
  }

  return { granted, costs, externalCosts, grantCounts };
};
