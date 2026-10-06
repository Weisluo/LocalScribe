/**
 * 版图布局与视觉映射（Phase 4 P4-T3..T7；politics_ui_design §4.1/§4.2/§4.7/§11.3）
 *
 * 纯函数，不依赖 React 与请求：
 * - computeAtlasLayout：rank -> 布局环 -> 世界坐标盒子（含 folded 聚合块与独立势力带）；
 * - 线型 / 领域色 -> Tailwind 类（SVG 用 stroke-* / fill-*，light / dark 两套）；
 * - 有向边反向展示取契约 §4.3 的 reverseLabel（linkTypeLabelFor，唯一标签来源）；
 * - toEdgeItems：单条边与 §11.3 聚合边统一成一种渲染形态，组件内不再分叉。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import { ATLAS_NODE_WIDTH } from '../config';
import type {
  AggregatedEdgeView,
  AtlasNodeView,
  IndependentForceView,
  PoliticsEdgeView,
} from '../hooks/politicsTypes';
import { linkTypeLabelFor, type AtlasSizeTier } from '../types';

/* ------------------------------------------------------------------ *
 * 尺寸与阈值（§4.1 尺寸表 / §11.3 降级阈值）
 * ------------------------------------------------------------------ */

/** 政权卡高度（宽由 ATLAS_NODE_WIDTH 决定；高度只用于布局与命中，不约束内容自适应） */
export const TIER_HEIGHT: Record<AtlasSizeTier, number> = {
  high: 236,
  mid: 168,
  low: 104,
};

/** 布局环：环 0 为中心，环间距足够放下大卡 */
const RING_BASE = 340;
const RING_GAP = 360;
const SLOT_GAP = 48;
/** 无名次（所有 weight 相同 / 等级没有 rank）时的网格排布：列数有界，绝不排成一条长行 */
const WRAP_COLUMNS = 6;
const WRAP_GAP = 56;

export const FOLD_BLOCK_WIDTH = 208;
export const FOLD_BLOCK_HEIGHT = 88;

/**
 * 环容量（卡片宽度约束）：环上相邻槽位的弧距必须 >= 卡宽 + 间距，
 * 否则同环卡片互相压字（实测 n=20 / 宽 240 时中心距只有 106px）。
 * 半径按周长反算：radius = n · (卡宽 + 间距) / 2π；floor 只是「不要挤在一起」的下限，
 * 卡数多时半径必须真的变大（否则 10 张大卡会硬塞在半径 414 的小圆上）。
 */
const ringRadius = (slots: RingSlot[], fallback: number): number => {
  if (slots.length <= 1) return fallback;
  const perim = slots.reduce((sum, slot) => sum + slot.width + SLOT_GAP, 0);
  return Math.max(fallback, perim / (Math.PI * 2));
};

/**
 * 环容量（卡片数量约束）：半径受 RING_BASE / RING_GAP 限制，弧距不可能无限增长，
 * 因此每环能放的卡数也要有上限（重卡更少）。超过上限就把多出来的槽位分到下一环。
 */
const ringCapacity = (width: number): number => {
  const circumference = 2 * Math.PI * RING_BASE;
  return Math.max(3, Math.floor(circumference / (width + SLOT_GAP)));
};

/**
 * 世界尺度过大的兜底阈值（世界坐标像素）：内容包围盒超过它时
 * 说明「画得下但不值得画」，上限由 fitView 放开缩放下限来兜住（见 fitView）。
 */
export const ATLAS_WORLD_LIMIT = 9000;

/** 画布最多铺开的卡片数（节点 + 聚合块）：超过就从最低 rank 层继续折叠 */
const ATLAS_CARD_DRAW_LIMIT = 60;
/** 环与已放卡片冲突时每次外扩的步长（世界坐标像素） */
const RING_CLEARANCE = 120;
/** 超过这个卡片数就不铺同心环，改用「有界列数的分簇网格」（见 computeAtlasLayout 规则 2） */
const RING_LAYOUT_CARD_LIMIT = 27;

export const FORCE_ITEM_WIDTH = 208;
export const FORCE_ITEM_HEIGHT = 62;
export const FORCE_LANE_PADDING = 16;
export const FORCE_LANE_GAP = 16;

/** 缩放范围与 LOD 阈值（§11.1.2：拉远只画政权节点与主干边） */
export const ATLAS_MIN_SCALE = 0.25;
export const ATLAS_MAX_SCALE = 2;
export const ATLAS_LOD_SCALE = 0.7;
export const ATLAS_VIEW_PADDING = 56;

export type AtlasLod = 'far' | 'near';

export const clampScale = (value: number): number =>
  Math.min(ATLAS_MAX_SCALE, Math.max(ATLAS_MIN_SCALE, value));

export const lodOf = (scale: number): AtlasLod => (scale < ATLAS_LOD_SCALE ? 'far' : 'near');

/* ------------------------------------------------------------------ *
 * 世界坐标盒子与布局
 * ------------------------------------------------------------------ */

export interface AtlasBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasView {
  tx: number;
  ty: number;
  k: number;
}

export interface AtlasPlacedNode {
  node: AtlasNodeView;
  box: AtlasBox;
}

/** folded 档：低 rank 节点按环折叠成聚合块（§11.3） */
export interface AtlasFoldBlock {
  id: string;
  ring: number;
  count: number;
  memberIds: string[];
  box: AtlasBox;
}

export interface AtlasForceItem {
  force: IndependentForceView;
  box: AtlasBox;
}

export interface AtlasLayout {
  nodes: AtlasPlacedNode[];
  foldedBlocks: AtlasFoldBlock[];
  forceItems: AtlasForceItem[];
  laneBand: AtlasBox | null;
  /** 实体 id -> 盒子（含折叠成员与独立势力，缎带与边层据此定位） */
  boxes: Map<string, AtlasBox>;
  /** 世界坐标内容包围盒（适应视图用） */
  bounds: AtlasBox;
  /** 本次布局是否真的折叠了低 rank 节点 */
  folded: boolean;
}

interface RingSlot {
  key: string;
  width: number;
  height: number;
  node?: AtlasNodeView;
  block?: AtlasFoldBlock;
}

/** 一次布局要画的环：既可以是同心圆环，也可以是「无名次」时的网格行 */
interface RingPlan {
  key: string;
  /** 参与 stagger 的层号（同一 rank 层拆成多环时取同一个值，避免起始角漂移） */
  angleBase: number;
  gridRow?: { width: number; height: number };
  slots: RingSlot[];
}

const emptyBounds = (): AtlasBox => ({ x: -240, y: -120, width: 480, height: 240 });

const nodeSlotOf = (node: AtlasNodeView): RingSlot => ({
  key: node.polity.id,
  width: ATLAS_NODE_WIDTH[node.sizeTier],
  height: TIER_HEIGHT[node.sizeTier],
  node,
});

/**
 * 版图布局（纯函数）。
 *
 * 放置规则（按优先级）：
 * 1. 名次分层：ring = rank 层号，rank 越高越靠中心（中心横排 + 同心环）；
 * 2. 无名次兜底：全部 weight 相同（等级没有 rank / 没有等级）时不用环，
 *    改用列数有界的网格（最多 WRAP_COLUMNS 列），否则 120 个政权会排成一条
 *    8600px 长行，缩到下限也看不见内容；网格仍是 rank 稳定 + 稳定次级排序；
 * 3. 卡片较多（> RING_LAYOUT_CARD_LIMIT）时不再铺同心环：环半径必须按卡数线性增长
 *    （60 张卡能铺到 8000px 宽），改为「按 rank 分层的分簇网格」，整体尺寸有界；
 * 4. 环容量：单环卡片数按环容量切分（ringCapacity），半径按卡片总宽反算（ringRadius），
 *    再用逐块外扩的无重叠检查兜底（RING_CLEARANCE），同环 / 相邻环卡片都不再互相压字；
 * 5. 折叠：foldLow 时从最低 rank 层往上折，直到「绘制卡片数 <= ATLAS_CARD_DRAW_LIMIT」
 *    且没有整层远超环容量（§11.3 只给了政权 / 边阈值，这里是画布自身的绘制上限）；
 *    只剩一层时不再折（折了就是空画布），此时靠环容量拆分保证不重叠；
 *    用户点「展开聚合块」（expanded=true）时不再折叠。
 */
export const computeAtlasLayout = (
  nodes: AtlasNodeView[],
  forces: IndependentForceView[],
  options: {
    foldLow: boolean;
    expanded: boolean;
    /** 参与折叠判定的全量等级权重（未筛选）；缺省用可见节点自身权重 */
    allWeights?: number[];
    /** 显式指定无名次（筛选后只剩一种 rank 时由调用方判定） */
    wrapUniform?: boolean;
  }
): AtlasLayout => {
  const boxes = new Map<string, AtlasBox>();
  const placed: AtlasPlacedNode[] = [];
  const foldedBlocks: AtlasFoldBlock[] = [];
  const foldMembers = new Set<string>();

  const weights = options.allWeights && options.allWeights.length > 0
    ? options.allWeights
    : nodes.map((node) => node.weight);
  // 无名次判定：等级定义里一个 rank 都没有（WorldbuildingView 的共享配置面板会造出这种等级，
  // 政治内联创建器也写过 rank: 0），或所有 weight 相同 —— 两种情况都不能按 rank 分环
  const wrapUniform = options.wrapUniform ?? new Set(weights).size <= 1;

  // 折叠判定：从最低 rank 层（ring 最大）往上折，直到
  // 「同层卡片数 <= 该层环容量」且「绘制卡片数 <= ATLAS_CARD_DRAW_LIMIT」；
  // 只有一层时不再折（折了就是空画布），这时靠环容量拆分 + 网格兜底保证不重叠
  const foldNodes = new Set<string>();
  if (options.foldLow && !options.expanded) {
    const tiersDesc = [...new Set(nodes.map((node) => node.ring))].sort((a, b) => b - a);
    const countByRing = (predicate: (node: AtlasNodeView) => boolean): Map<number, number> => {
      const counts = new Map<number, number>();
      for (const node of nodes) {
        if (!predicate(node)) continue;
        counts.set(node.ring, (counts.get(node.ring) ?? 0) + 1);
      }
      return counts;
    };
    const fitted = (): boolean => {
      const drawn = nodes.filter((node) => !foldNodes.has(node.polity.id));
      if (drawn.length === 0) return true;
      const blocks = countByRing((node) => foldNodes.has(node.polity.id)).size;
      if (drawn.length + blocks > ATLAS_CARD_DRAW_LIMIT) return false;
      const totalByRing = countByRing(() => true);
      const counts = countByRing((node) => !foldNodes.has(node.polity.id));
      for (const [ring, count] of counts) {
        const widest = Math.max(
          ...nodes
            .filter((node) => node.ring === ring)
            .map((node) => ATLAS_NODE_WIDTH[node.sizeTier])
        );
        const capacity = ringCapacity(widest);
        // 单层略超容量：靠环容量拆成多环（半径外扩）解决，不需要折叠；
        // 只有整层远大于容量（超过两环）才值得折成聚合块，否则 200 个政权分 2 层时会被折成空画布
        if (count > capacity && (totalByRing.get(ring) ?? 0) > capacity * 2) return false;
      }
      return true;
    };
    if (tiersDesc.length > 1) {
      for (const ring of tiersDesc) {
        if (fitted()) break;
        const remaining = nodes.filter((node) => !foldNodes.has(node.polity.id)).length;
        if (remaining === 0) break;
        for (const node of nodes) {
          if (node.ring === ring) foldNodes.add(node.polity.id);
        }
      }
    }
  }

  const slotsByRing = new Map<number, RingSlot[]>();
  const pushSlot = (ring: number, slot: RingSlot) => {
    const bucket = slotsByRing.get(ring);
    if (bucket) bucket.push(slot);
    else slotsByRing.set(ring, [slot]);
  };

  for (const node of nodes) {
    if (foldNodes.has(node.polity.id)) continue;
    if (wrapUniform) continue; // 无名次：统一在有界网格里排布（见下）
    pushSlot(node.ring, nodeSlotOf(node));
  }

  // 折叠块：按 rank 层聚合成一个块，占据该层在布局里的位置
  if (foldNodes.size > 0) {
    const byRing = new Map<number, AtlasNodeView[]>();
    for (const node of nodes) {
      if (!foldNodes.has(node.polity.id)) continue;
      const bucket = byRing.get(node.ring);
      if (bucket) bucket.push(node);
      else byRing.set(node.ring, [node]);
    }
    for (const [ring, members] of [...byRing.entries()].sort((a, b) => a[0] - b[0])) {
      const block: AtlasFoldBlock = {
        id: `fold-${ring}`,
        ring,
        count: members.length,
        memberIds: members.map((member) => member.polity.id),
        box: { x: 0, y: 0, width: FOLD_BLOCK_WIDTH, height: FOLD_BLOCK_HEIGHT },
      };
      foldedBlocks.push(block);
      for (const member of members) foldMembers.add(member.polity.id);
      pushSlot(ring, {
        key: block.id,
        width: block.box.width,
        height: block.box.height,
        block,
      });
    }
  }

  if (wrapUniform) {
    // 无名次：把所有卡片重排成有界网格（行内居中），不按 rank 分环
    const all = nodes
      .filter((node) => !foldMembers.has(node.polity.id))
      .map(nodeSlotOf)
      .sort((a, b) => a.key.localeCompare(b.key));
    for (let index = 0; index < all.length; index += 1) {
      pushSlot(Math.floor(index / WRAP_COLUMNS), all[index]);
    }
  }

  /**
   * 卡片较多时不再铺同心环：环半径必须按卡数线性增长（60 张卡能铺到 8000px 宽），
   * 改成「按 rank 分层的分簇网格」——rank 越高越靠上、越靠中间，层内按列换行，整体有界。
   * 层内的稳定次级排序沿用调用方给的 atlasNodes 顺序（weight -> order_index -> 名称）。
   */
  const clusterPlans = (): RingPlan[] => {
    const plans: RingPlan[] = [];
    const ringsAsc = [...slotsByRing.keys()].sort((a, b) => a - b);
    for (const ring of ringsAsc) {
      const slots = (slotsByRing.get(ring) ?? []).sort((a, b) => a.key.localeCompare(b.key));
      for (let offset = 0; offset < slots.length; offset += WRAP_COLUMNS) {
        const row = slots.slice(offset, offset + WRAP_COLUMNS);
        const width = row.reduce((sum, slot) => sum + slot.width, 0) + WRAP_GAP * (row.length - 1);
        const height = Math.max(...row.map((slot) => slot.height));
        plans.push({
          key: `cluster-${ring}-${offset}`,
          angleBase: ring,
          gridRow: { width, height },
          slots: row,
        });
      }
    }
    return plans;
  };

  const totalSlots = [...slotsByRing.values()].reduce((sum, list) => sum + list.length, 0);
  const useClusters = !wrapUniform && totalSlots > RING_LAYOUT_CARD_LIMIT;

  const ringPlans: RingPlan[] = [];
  if (useClusters) {
    ringPlans.push(...clusterPlans());
  }
  for (const ring of [...slotsByRing.keys()].sort((a, b) => a - b)) {
    if (useClusters) break;
    const slots = (slotsByRing.get(ring) ?? []).sort((a, b) => a.key.localeCompare(b.key));
    if (slots.length === 0) continue;
    if (wrapUniform) {
      const width =
        slots.reduce((sum, slot) => sum + slot.width, 0) + WRAP_GAP * Math.max(0, slots.length - 1);
      const height = Math.max(...slots.map((slot) => slot.height));
      ringPlans.push({ key: `grid-${ring}`, angleBase: 0, gridRow: { width, height }, slots });
      continue;
    }
    // 环容量：超过上限的槽位顺延到下一个环（半径随之增大）
    const capacity = ringCapacity(Math.max(...slots.map((slot) => slot.width)));
    for (let offset = 0; offset < slots.length; offset += capacity) {
      ringPlans.push({
        key: `${ring}-${offset}`,
        angleBase: ring,
        slots: slots.slice(offset, offset + capacity),
      });
    }
  }

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  const track = (box: AtlasBox) => {
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    if (!hasContent) {
      minX = box.x;
      minY = box.y;
      maxX = right;
      maxY = bottom;
      hasContent = true;
      return;
    }
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  };

  const place = (slot: RingSlot, box: AtlasBox) => {
    if (slot.node) {
      placed.push({ node: slot.node, box });
      boxes.set(slot.node.polity.id, box);
      // 卫星组织不单独占位：缎带若以卫星组织为缔约方，吸附到所属政权卡边缘
      for (const satellite of slot.node.satellites) boxes.set(satellite.id, box);
    }
    if (slot.block) {
      slot.block.box = box;
      for (const memberId of slot.block.memberIds) boxes.set(memberId, box);
    }
    track(box);
  };

  // 放置：网格行（无名次兜底）横向居中、逐行下移；环按容量切分后同心排布。
  // 半径必须按「本环卡数 × 卡宽」反算，并且中心横排这一块占掉的是「矩形」而不是圆：
  // 后续环的起始半径要加上中心块半宽，否则第二环会直接压在中心横排上（实测 11 对重叠）。
  let gridCursorY = 0;
  let nextRadiusFloor = 0;
  for (const plan of ringPlans) {
    if (plan.gridRow) {
      let cursor = -plan.gridRow.width / 2;
      for (const slot of plan.slots) {
        place(slot, { x: cursor, y: gridCursorY, width: slot.width, height: slot.height });
        cursor += slot.width + WRAP_GAP;
      }
      gridCursorY += plan.gridRow.height + WRAP_GAP;
      continue;
    }
    const rankRadius = plan.angleBase === 0 ? 0 : RING_BASE + (plan.angleBase - 1) * RING_GAP;
    const maxHeight = Math.max(...plan.slots.map((slot) => slot.height));
    // 中心环（rank 最高且是第一环）：横向排开一整块，后续环从它外侧起算
    if (rankRadius === 0 && nextRadiusFloor === 0) {
      const total =
        plan.slots.reduce((sum, slot) => sum + slot.width, 0) +
        SLOT_GAP * Math.max(0, plan.slots.length - 1);
      let cursor = -total / 2;
      for (const slot of plan.slots) {
        place(slot, { x: cursor, y: -slot.height / 2, width: slot.width, height: slot.height });
        cursor += slot.width + SLOT_GAP;
      }
      nextRadiusFloor = total / 2 + maxHeight + SLOT_GAP;
      continue;
    }
    const ringRadiusValue = ringRadius(plan.slots, Math.max(rankRadius, nextRadiusFloor));
    const start = -Math.PI / 2 + plan.angleBase * 0.35;
    const step = (Math.PI * 2) / plan.slots.length;
    const ringBoxes = (radius: number): AtlasBox[] =>
      plan.slots.map((slot, index) => {
        const angle = start + step * index;
        return {
          x: Math.cos(angle) * radius - slot.width / 2,
          y: Math.sin(angle) * radius - slot.height / 2,
          width: slot.width,
          height: slot.height,
        };
      });
    // 上限保证：环上卡片是矩形，半径不能只按切向估算。这里逐块外扩，直到与已放卡片无交叠。
    let boxesForRing = ringBoxes(ringRadiusValue);
    let radiusCursor = ringRadiusValue;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (!boxesForRing.some((box) => placed.some((other) => boxesIntersect(box, other.box)))) break;
      radiusCursor += RING_CLEARANCE;
      boxesForRing = ringBoxes(radiusCursor);
    }
    plan.slots.forEach((slot, index) => {
      place(slot, boxesForRing[index]);
    });
    // 下一环从本环外侧起算（只是起始估计，上面还会按实际交叠继续外扩）
    nextRadiusFloor = radiusCursor + maxHeight / 2 + TIER_HEIGHT.high / 2 + RING_BASE * 0.25;
  }

  // 独立 / 跨国势力带：横排在画布下方（§4.2 第 3 层）
  const forceItems: AtlasForceItem[] = [];
  let laneBand: AtlasBox | null = null;
  if (forces.length > 0) {
    const laneY = (hasContent ? maxY : 0) + 56;
    const laneX = hasContent ? minX : 0;
    forces.forEach((force, index) => {
      const box: AtlasBox = {
        x: laneX + index * (FORCE_ITEM_WIDTH + FORCE_LANE_GAP),
        y: laneY + FORCE_LANE_PADDING,
        width: FORCE_ITEM_WIDTH,
        height: FORCE_ITEM_HEIGHT,
      };
      forceItems.push({ force, box });
      boxes.set(force.entity.id, box);
    });
    laneBand = {
      x: laneX - FORCE_LANE_PADDING,
      y: laneY,
      width:
        forces.length * FORCE_ITEM_WIDTH +
        (forces.length - 1) * FORCE_LANE_GAP +
        FORCE_LANE_PADDING * 2,
      height: FORCE_ITEM_HEIGHT + FORCE_LANE_PADDING * 2,
    };
    track(laneBand);
  }

  const bounds: AtlasBox = hasContent
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : emptyBounds();

  return {
    nodes: placed,
    foldedBlocks,
    forceItems,
    laneBand,
    boxes,
    bounds,
    folded: foldedBlocks.length > 0,
  };
};

/**
 * 内容包围盒 -> 视口变换（适应视图 / 首次挂载）。
 *
 * 这里刻意不受 clampScale 下限约束：内容再大也要能缩到看得见（否则 fitView
 * 被夹到 0.25 时内容会跑到视口外，只剩空白）。用户滚轮 / 按钮缩放仍走 clampScale。
 */
export const fitView = (
  bounds: AtlasBox,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = ATLAS_VIEW_PADDING
): AtlasView => {
  const usableWidth = Math.max(1, viewportWidth - padding * 2);
  const usableHeight = Math.max(1, viewportHeight - padding * 2);
  const k = Math.min(
    1,
    usableWidth / Math.max(1, bounds.width),
    usableHeight / Math.max(1, bounds.height)
  );
  return {
    k,
    tx: viewportWidth / 2 - (bounds.x + bounds.width / 2) * k,
    ty: viewportHeight / 2 - (bounds.y + bounds.height / 2) * k,
  };
};

export const boxesIntersect = (a: AtlasBox, b: AtlasBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** 盒子中心朝目标方向的边界锚点（边与缎带贴到卡片边缘，不压在卡片下） */
export const boxAnchor = (
  box: AtlasBox,
  targetX: number,
  targetY: number
): { x: number; y: number } => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : box.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
};

export const boxCenter = (box: AtlasBox): { x: number; y: number } => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/* ------------------------------------------------------------------ *
 * 线型 / 色名 -> Tailwind 类（§4.1；SVG 无法用 text-*，单独给 stroke/fill）
 *
 * 色名不是封闭集合：契约 LinkTypeDef.color 允许任意领域色名，ModuleConfig.linkTypes
 * 还允许用户自填。未登记色名统一退回 neutral 线色，并且箭头 marker 也退回 neutral，
 * 绝不引用不存在的 marker id（否则有向边会「有线无箭头」）。
 * ------------------------------------------------------------------ */

const TONE_STROKE: Record<string, string> = {
  emerald: 'stroke-emerald-600 dark:stroke-emerald-400',
  green: 'stroke-emerald-600 dark:stroke-emerald-400',
  teal: 'stroke-teal-600 dark:stroke-teal-400',
  cyan: 'stroke-cyan-600 dark:stroke-cyan-400',
  lime: 'stroke-lime-600 dark:stroke-lime-400',
  red: 'stroke-red-600 dark:stroke-red-400',
  rose: 'stroke-rose-600 dark:stroke-rose-400',
  amber: 'stroke-amber-600 dark:stroke-amber-400',
  gold: 'stroke-amber-600 dark:stroke-amber-400',
  orange: 'stroke-orange-600 dark:stroke-orange-400',
  yellow: 'stroke-yellow-600 dark:stroke-yellow-400',
  blue: 'stroke-blue-600 dark:stroke-blue-400',
  pink: 'stroke-pink-600 dark:stroke-pink-400',
  violet: 'stroke-violet-600 dark:stroke-violet-400',
  purple: 'stroke-purple-600 dark:stroke-purple-400',
  slate: 'stroke-slate-500 dark:stroke-slate-400',
  neutral: 'stroke-slate-500 dark:stroke-slate-400',
};

const TONE_FILL: Record<string, string> = {
  emerald: 'fill-emerald-600 dark:fill-emerald-400',
  green: 'fill-emerald-600 dark:fill-emerald-400',
  teal: 'fill-teal-600 dark:fill-teal-400',
  cyan: 'fill-cyan-600 dark:fill-cyan-400',
  lime: 'fill-lime-600 dark:fill-lime-400',
  red: 'fill-red-600 dark:fill-red-400',
  rose: 'fill-rose-600 dark:fill-rose-400',
  amber: 'fill-amber-600 dark:fill-amber-400',
  gold: 'fill-amber-600 dark:fill-amber-400',
  orange: 'fill-orange-600 dark:fill-orange-400',
  yellow: 'fill-yellow-600 dark:fill-yellow-400',
  blue: 'fill-blue-600 dark:fill-blue-400',
  pink: 'fill-pink-600 dark:fill-pink-400',
  violet: 'fill-violet-600 dark:fill-violet-400',
  purple: 'fill-purple-600 dark:fill-purple-400',
  slate: 'fill-slate-500 dark:fill-slate-400',
  neutral: 'fill-slate-500 dark:fill-slate-400',
};

export const strokeClassOf = (tone?: string): string =>
  TONE_STROKE[tone ?? 'neutral'] ?? TONE_STROKE.neutral;

export const fillClassOf = (tone?: string): string => TONE_FILL[tone ?? 'neutral'] ?? TONE_FILL.neutral;

/** 已登记线色（有独立 marker 的色名）；其余色名用 arrowMarkerId 归一化到 neutral */
export const MARKER_TONES: string[] = Object.keys(TONE_FILL);

/** 色名 -> 实际建了 marker 的色名：未登记的色名一律用 neutral marker */
export const markerToneOf = (tone?: string): string =>
  tone && MARKER_TONES.includes(tone) ? tone : 'neutral';

/** 实际要用到的 marker：已用色名去重 + 总是带上 neutral 兜底 */
export const markerTonesFor = (tones: Iterable<string | undefined>): string[] => {
  const used = new Set<string>(['neutral']);
  for (const tone of tones) used.add(markerToneOf(tone));
  return [...used].sort();
};

export const arrowMarkerId = (tone: string): string => `atlas-arrow-${markerToneOf(tone)}`;

export const dashArrayOf = (lineStyle: 'solid' | 'dashed' | 'double'): string | undefined =>
  lineStyle === 'dashed' ? '7 5' : undefined;

/** 强度 -> 线宽（仅沙盘档使用，§8.4） */
export const edgeWidthOf = (strength?: number): number => {
  if (strength === undefined) return 1.6;
  return 1.6 + Math.min(4, Math.max(0, strength - 1)) * 0.6;
};

/* ------------------------------------------------------------------ *
 * 有向边反向标签（契约 §4.3 的 reverseLabel）
 * ------------------------------------------------------------------ */

/**
 * 站在 perspectiveId 视角看到的边标签（§4.7.3）：
 * 有向边且视角是目标端时用 types.ts 的 linkTypeLabelFor(linkType, false)。
 * 标签唯一来源是契约注册表，这里不再维护本地反向表（本地表会漏登记新类型）。
 */
export const edgeLabelFor = (
  label: string,
  linkType: string,
  directed: boolean,
  fromId: string,
  toId: string,
  perspectiveId: string | null
): string => {
  if (!directed || !perspectiveId || perspectiveId !== toId || perspectiveId === fromId) {
    return label;
  }
  return linkTypeLabelFor(linkType, false) || label;
};

/* ------------------------------------------------------------------ *
 * 边渲染单元（单条 / 聚合统一形态）
 * ------------------------------------------------------------------ */

export interface AtlasEdgeItem {
  key: string;
  linkType: string;
  label: string;
  color: string;
  icon: string;
  lineStyle: 'solid' | 'dashed' | 'double';
  directed: boolean;
  from: EntityRef;
  to: EntityRef;
  strength?: number;
  memberIds: string[];
  dangling: boolean;
  /** 只有一条成员边时可直接编辑时间 / 备注 / 强度 */
  single?: PoliticsEdgeView;
}

export const toEdgeItems = (
  edges: PoliticsEdgeView[],
  aggregatedEdges: AggregatedEdgeView[],
  aggregate: boolean
): AtlasEdgeItem[] => {
  if (!aggregate) {
    return edges.map((edge) => ({
      key: edge.link.id,
      linkType: edge.linkType,
      label: edge.label,
      color: edge.color,
      icon: edge.icon,
      lineStyle: edge.lineStyle,
      directed: edge.directed,
      from: edge.from,
      to: edge.to,
      strength: edge.strength,
      memberIds: [edge.link.id],
      dangling: edge.dangling,
      single: edge,
    }));
  }
  const byId = new Map(edges.map((edge) => [edge.link.id, edge]));
  return aggregatedEdges.map((edge) => ({
    key: edge.key,
    linkType: edge.linkType,
    label: edge.label,
    color: edge.color,
    icon: edge.icon,
    lineStyle: edge.lineStyle,
    directed: edge.directed,
    from: edge.from,
    to: edge.to,
    strength: edge.strength,
    memberIds: edge.memberIds,
    dangling: edge.dangling,
    single: edge.memberIds.length === 1 ? byId.get(edge.memberIds[0]) : undefined,
  }));
};
