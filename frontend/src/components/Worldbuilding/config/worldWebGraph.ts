/**
 * WorldWeb（Phase 6 P6-T8；cross_module_link_design §5.4、worldbuilding_ui_design §5.5）
 *
 * 世界脉络：只读的全局关联总览。
 * - 节点 = 各模块可全局寻址的实体（submodule；item 不参与全局寻址，契约 §4.1），
 *   外加被保留边引用的外站端点（角色 / 地图 / 特殊未接入时的对端）。
 * - 边按 registry 的 color / line_style 着色与分线型；节点按模块着色、按关联数定大小。
 * - 筛选：模块、kind、关联类型、时间范围；默认隐藏孤立节点。
 * - 实体数超过 WEB_NODE_LIMIT（800）时降级为「模块矩阵 + 推荐关联列表」，只读不可编辑。
 *
 * 布局是纯函数（无随机数）：同一输入永远得到同一坐标，便于 SSR 断言与快照。
 */


import type { EntityRef } from '@/services/worldbuildingApi';
import type { WorldModuleV2 } from '../types';
import { MODULE_TYPES, kindLabel, moduleLabel, refKey } from '../types';

/** 超过该节点数不再渲染画布，降级为矩阵（契约 §5.4「建议 800 节点」） */
export const WEB_NODE_LIMIT = 800;

/** 画布坐标系（与容器实际像素解耦，靠 viewBox 缩放） */
export const WEB_CANVAS = { width: 1280, height: 760, padding: 48 } as const;

export const MODULE_HEX: Record<string, string> = {
  history: '#D97706',
  politics: '#DC2626',
  economy: '#16A34A',
  races: '#0D9488',
  systems: '#7C3AED',
  character: '#475569',
  map: '#2563EB',
  special: '#737373',
};

export const DEFAULT_NODE_HEX = '#737373';

/** 关联类型色名（contract §4 表格的「颜色」列）-> SVG 用 hex */
export const LINK_COLOR_HEX: Record<string, string> = {
  amber: '#D97706',
  red: '#DC2626',
  gold: '#CA8A04',
  green: '#16A34A',
  cyan: '#0891B2',
  teal: '#0D9488',
  violet: '#7C3AED',
  purple: '#9333EA',
  rose: '#E11D48',
  slate: '#475569',
  blue: '#2563EB',
  orange: '#EA580C',
  lime: '#65A30D',
  emerald: '#10B981',
  neutral: '#737373',
};

export interface WebNode {
  ref: EntityRef;
  name: string;
  kind: string;
  module: string;
  /** 与世界内全部关联的出入总数（用 WorldLinkCountMap，整批聚合，不逐点请求） */
  linkCount: number;
  /** 世界内没有任何关联 */
  isolated: boolean;
  /** 是否不是本世界的实体（角色 / 其它世界的端点），只因为被保留边引用而出现 */
  external: boolean;
}

export interface WebEdge {
  id: string;
  sourceKey: string;
  targetKey: string;
  linkType: string;
  label: string;
  lineStyle: string;
  time?: { start?: string | null; end?: string | null } | null;
}

export interface WebGraph {
  nodes: WebNode[];
  edges: WebEdge[];
}

export interface WebFilters {
  modules: string[];
  kind: string;
  linkType: string;
  timeStart: string;
  timeEnd: string;
  hideIsolated: boolean;
}

export const EMPTY_WEB_FILTERS: WebFilters = {
  modules: [],
  kind: '',
  linkType: '',
  timeStart: '',
  timeEnd: '',
  hideIsolated: true,
};

export interface WebDegradeState {
  degraded: boolean;
  reason: string | null;
}

/** 降级判定：只看节点数，800 以内正常渲染（边界 800 不降级、801 降级） */
export const webDegradeStateOf = (nodeCount: number): WebDegradeState =>
  nodeCount > WEB_NODE_LIMIT
    ? {
        degraded: true,
        reason: `实体 ${nodeCount} 个，超过 ${WEB_NODE_LIMIT} 节点上限：已降级为模块矩阵 + 推荐关联（只读）`,
      }
    : { degraded: false, reason: null };

export interface BuildWebGraphOptions {
  /** 关联计数（refKey -> 总数）；缺省时按 links 现场统计 */
  countOfRef?: (ref: EntityRef) => number;
}

/** 从世界详情的模块树与关联列表构造节点/边 */
export const buildWebGraph = (
  modules: WorldModuleV2[],
  links: {
    id: string;
    source: EntityRef;
    target: EntityRef;
    link_type: string;
    label?: string | null;
    time?: { start?: string | null; end?: string | null } | null;
  }[],
  options: BuildWebGraphOptions = {}
): WebGraph => {
  const nodes = new Map<string, WebNode>();
  const edges: WebEdge[] = [];

  for (const module of modules) {
    for (const submodule of module.submodules ?? []) {
      const ref: EntityRef = {
        module: module.module_type,
        kind: submodule.kind ?? 'custom',
        id: submodule.id,
      };
      const key = refKey(ref);
      if (nodes.has(key)) continue;
      nodes.set(key, {
        ref,
        name: submodule.name,
        kind: ref.kind,
        module: ref.module,
        linkCount: 0,
        isolated: true,
        external: false,
      });
    }
  }

  const ensureNode = (ref: EntityRef): WebNode => {
    const key = refKey(ref);
    const existing = nodes.get(key);
    if (existing) return existing;
    const created: WebNode = {
      ref,
      name: `${kindLabel(ref.kind)}·${ref.id.slice(0, 8)}`,
      kind: ref.kind,
      module: ref.module,
      linkCount: 0,
      isolated: true,
      external: true,
    };
    nodes.set(key, created);
    return created;
  };

  for (const link of links) {
    const sourceKey = refKey(link.source);
    const targetKey = refKey(link.target);
    ensureNode(link.source);
    ensureNode(link.target);
    edges.push({
      id: link.id,
      sourceKey,
      targetKey,
      linkType: link.link_type,
      label: link.label || link.link_type,
      // 线型由 registry 决定；调用方拿到 registry 后再覆盖（buildWebGraph 不依赖 registry）
      lineStyle: 'solid',
      time: link.time ?? null,
    });
  }

  // 关联数按「边」统计：同一条边两端各算一次，自环只算一次
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.sourceKey, (degree.get(edge.sourceKey) ?? 0) + 1);
    if (edge.targetKey !== edge.sourceKey) {
      degree.set(edge.targetKey, (degree.get(edge.targetKey) ?? 0) + 1);
    }
  }

  const allNodes = Array.from(nodes.values());
  for (const node of allNodes) {
    const key = refKey(node.ref);
    node.linkCount =
      options.countOfRef?.(node.ref) ?? degree.get(key) ?? 0;
    node.isolated = node.linkCount === 0;
  }

  return { nodes: allNodes, edges };
};

/** 从字符串里取第一个整数（可带负号）作为时间锚点；取不到返回 null，不做猜测 */
export const parseTimeAnchor = (value?: string | null): number | null => {
  if (!value) return null;
  const matched = /-?\d+/.exec(String(value));
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

/** 关联时间窗是否与筛选窗相交；任一侧缺锚点时不参与时间筛选（保留该边） */
export const edgeInTimeWindow = (
  time: { start?: string | null; end?: string | null } | null | undefined,
  start?: string,
  end?: string
): boolean => {
  const windowStart = parseTimeAnchor(start);
  const windowEnd = parseTimeAnchor(end);
  if (windowStart === null && windowEnd === null) return true;
  if (!time) return false;
  const edgeStart = parseTimeAnchor(time.start) ?? parseTimeAnchor(time.end);
  const edgeEnd = parseTimeAnchor(time.end) ?? parseTimeAnchor(time.start);
  if (edgeStart === null && edgeEnd === null) return false;
  const from = windowStart ?? -Infinity;
  const to = windowEnd ?? Infinity;
  return (edgeEnd ?? edgeStart ?? 0) >= from && (edgeStart ?? edgeEnd ?? 0) <= to;
};

/**
 * 筛选：边要求两端都过「模块 + kind」结构筛选；节点取「结构筛选通过」且
 * （被保留的边触及 或 显式勾选了显示孤立节点）。
 * 外站节点（角色 / 未接入模块的对端）只有在被保留的边引用时才进入输出，
 * 否则筛选后会残留孤儿节点（P5 复核缺陷 #6 的同口径修法）。
 * hideIsolated 的语义是「隐藏当前视图里没有可见关联的节点」，因此默认视图只保留
 * 参与可见关系的节点，不会留下孤立圆点。
 */
export const filterWebGraph = (graph: WebGraph, filters: WebFilters): WebGraph => {
  const moduleFilter = new Set(filters.modules);
  const structurallyVisible = (node: WebNode) => {
    if (moduleFilter.size > 0 && !moduleFilter.has(node.module)) return false;
    if (filters.kind && node.kind !== filters.kind) return false;
    return true;
  };

  const byKey = new Map(graph.nodes.map((node) => [refKey(node.ref), node]));
  const edges = graph.edges.filter((edge) => {
    if (filters.linkType && edge.linkType !== filters.linkType) return false;
    if (!edgeInTimeWindow(edge.time, filters.timeStart, filters.timeEnd)) return false;
    const source = byKey.get(edge.sourceKey);
    const target = byKey.get(edge.targetKey);
    if (!source || !target) return false;
    return structurallyVisible(source) && structurallyVisible(target);
  });

  const touched = new Set<string>();
  for (const edge of edges) {
    touched.add(edge.sourceKey);
    touched.add(edge.targetKey);
  }

  const nodes: WebNode[] = [];
  for (const node of graph.nodes) {
    if (!structurallyVisible(node)) continue;
    const key = refKey(node.ref);
    if (node.external) {
      if (touched.has(key)) nodes.push(node);
      continue;
    }
    if (filters.hideIsolated && !touched.has(key)) continue;
    nodes.push(node);
  }
  return { nodes, edges };
};

export interface WebLayoutPoint {
  x: number;
  y: number;
}

interface LayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  /** 边理想长度 */
  linkDistance?: number;
}

/**
 * 确定性力导向布局：模块锚点成环 + 模块内黄金角螺旋播种，
 * 再跑「边弹簧 + 锚点重力 + 网格分桶斥力」若干轮。
 * 斥力用均匀网格只比较邻域，避免 O(n²)（800 节点仍可交互）。
 */
export const layoutWebGraph = (
  nodes: WebNode[],
  edges: WebEdge[],
  options: LayoutOptions = {}
): Map<string, WebLayoutPoint> => {
  const width = options.width ?? WEB_CANVAS.width;
  const height = options.height ?? WEB_CANVAS.height;
  const iterations = options.iterations ?? 120;
  const linkDistance = options.linkDistance ?? 110;
  const padding = WEB_CANVAS.padding;
  const centerX = width / 2;
  const centerY = height / 2;
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;
  if (nodes.length === 1) {
    positions.set(refKey(nodes[0].ref), { x: centerX, y: centerY });
    return positions;
  }

  const moduleOrder = MODULE_TYPES.filter((module) =>
    nodes.some((node) => node.module === module)
  );
  const groupCount = Math.max(1, moduleOrder.length);
  const orbit = Math.min(width, height) * 0.32;
  const anchors = new Map<string, WebLayoutPoint>();
  moduleOrder.forEach((module, index) => {
    const angle = (index / groupCount) * Math.PI * 2 - Math.PI / 2;
    anchors.set(module, {
      x: centerX + Math.cos(angle) * orbit,
      y: centerY + Math.sin(angle) * orbit,
    });
  });

  const groupIndex = new Map<string, number>();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const node of nodes) {
    const index = groupIndex.get(node.module) ?? 0;
    groupIndex.set(node.module, index + 1);
    const anchor = anchors.get(node.module) ?? { x: centerX, y: centerY };
    const radius = 10 * Math.sqrt(index + 1) * 2.2;
    const angle = index * golden;
    positions.set(refKey(node.ref), {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    });
  }

  const springEdges = edges
    .map((edge) => ({ source: edge.sourceKey, target: edge.targetKey }))
    .filter((edge) => positions.has(edge.source) && positions.has(edge.target));

  const cellSize = Math.max(48, linkDistance);
  const parentOf = new Map(nodes.map((node) => [refKey(node.ref), node.module]));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const alpha = 1 - iteration / iterations;

    // 斥力：均匀网格分桶，只与邻域比
    const buckets = new Map<string, string[]>();
    for (const node of nodes) {
      const key = refKey(node.ref);
      const point = positions.get(key);
      if (!point) continue;
      const cell = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
      const bucket = buckets.get(cell);
      if (bucket) bucket.push(key);
      else buckets.set(cell, [key]);
    }
    for (const node of nodes) {
      const key = refKey(node.ref);
      const point = positions.get(key);
      if (!point) continue;
      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const bucket = buckets.get(`${cellX + dx}:${cellY + dy}`);
          if (!bucket) continue;
          for (const otherKey of bucket) {
            if (otherKey === key) continue;
            const other = positions.get(otherKey);
            if (!other) continue;
            let vx = point.x - other.x;
            let vy = point.y - other.y;
            let distance = Math.hypot(vx, vy);
            if (distance < 0.001) {
              vx = (key < otherKey ? 1 : -1) * 0.01;
              vy = 0.01;
              distance = Math.hypot(vx, vy);
            }
            if (distance > cellSize * 1.5) continue;
            const force = (cellSize * cellSize) / (distance * distance) / 90;
            point.x += (vx / distance) * force * alpha;
            point.y += (vy / distance) * force * alpha;
          }
        }
      }
    }

    // 边弹簧
    for (const edge of springEdges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const vx = target.x - source.x;
      const vy = target.y - source.y;
      const distance = Math.max(0.01, Math.hypot(vx, vy));
      const force = (distance - linkDistance) / distance / 2;
      const offsetX = vx * force * alpha * 0.35;
      const offsetY = vy * force * alpha * 0.35;
      source.x += offsetX;
      source.y += offsetY;
      target.x -= offsetX;
      target.y -= offsetY;
    }

    // 锚点重力 + 边界收敛
    for (const node of nodes) {
      const key = refKey(node.ref);
      const point = positions.get(key);
      if (!point) continue;
      const anchor = anchors.get(parentOf.get(key) ?? '') ?? { x: centerX, y: centerY };
      point.x += (anchor.x - point.x) * 0.02 * alpha;
      point.y += (anchor.y - point.y) * 0.02 * alpha;
      point.x = Math.min(width - padding, Math.max(padding, point.x));
      point.y = Math.min(height - padding, Math.max(padding, point.y));
    }
  }

  return positions;
};

export interface WebMatrixRow {
  module: string;
  nodes: number;
  isolated: number;
  edges: number;
}

/** 降级视图的数据源：按模块统计节点/孤立/参与关联数（一条边计入它两端的每个模块一次） */
export const webModuleMatrix = (graph: WebGraph): WebMatrixRow[] => {
  const rows = new Map<string, WebMatrixRow>();
  const rowOf = (module: string): WebMatrixRow => {
    const existing = rows.get(module);
    if (existing) return existing;
    const created: WebMatrixRow = { module, nodes: 0, isolated: 0, edges: 0 };
    rows.set(module, created);
    return created;
  };
  for (const node of graph.nodes) {
    const row = rowOf(node.module);
    row.nodes += 1;
    if (node.isolated) row.isolated += 1;
  }
  const byKey = new Map(graph.nodes.map((node) => [refKey(node.ref), node]));
  for (const edge of graph.edges) {
    const modules = new Set<string>();
    const source = byKey.get(edge.sourceKey);
    const target = byKey.get(edge.targetKey);
    if (source) modules.add(source.module);
    if (target) modules.add(target.module);
    for (const module of modules) rowOf(module).edges += 1;
  }
  return Array.from(rows.values()).sort((a, b) => b.nodes - a.nodes);
};

export interface WebRecommendation {
  a: WebNode;
  b: WebNode;
  reason: string;
}

/** 每个「模块|kind」桶里参与配对的节点上限（按关联数取前 K） */
export const RECOMMEND_BUCKET_LIMIT = 30;
/** 候选生成硬上限：`limit` 只截断输出，不截断生成，降级世界会因此 O(n²) 爆炸 */
export const RECOMMEND_CANDIDATE_LIMIT = 2000;

/**
 * 推荐关联：同模块、同 kind、尚未直连的一对节点，按双方关联数之和倒序。
 * 只给建议，不写数据（图只读，契约 §5.4）。
 *
 * 生成量必须封顶：降级视图（>800 节点）正是节点最多的场景，一个 3000 节点的
 * 「模块|kind」桶会产生约 450 万对候选，排序前主线程就冻住了。
 */
export const recommendWebLinks = (
  graph: WebGraph,
  limit = 6
): WebRecommendation[] => {
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(`${edge.sourceKey}->${edge.targetKey}`);
    connected.add(`${edge.targetKey}->${edge.sourceKey}`);
  }
  const candidates: WebRecommendation[] = [];
  const byModuleKind = new Map<string, WebNode[]>();
  for (const node of graph.nodes) {
    if (node.external) continue;
    const key = `${node.module}|${node.kind}`;
    const bucket = byModuleKind.get(key);
    if (bucket) bucket.push(node);
    else byModuleKind.set(key, [node]);
  }
  for (const bucket of byModuleKind.values()) {
    if (candidates.length >= RECOMMEND_CANDIDATE_LIMIT) break;
    if (bucket.length < 2) continue;
    const sorted = [...bucket]
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, RECOMMEND_BUCKET_LIMIT);
    let stop = false;
    for (let i = 0; i < sorted.length && !stop; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        const aKey = refKey(a.ref);
        const bKey = refKey(b.ref);
        if (connected.has(`${aKey}->${bKey}`)) continue;
        if (candidates.length >= RECOMMEND_CANDIDATE_LIMIT) {
          stop = true;
          break;
        }
        candidates.push({
          a,
          b,
          reason: `同属${moduleLabel(a.module)}的${kindLabel(a.kind)}，尚未建立关联`,
        });
      }
    }
  }
  return candidates
    .sort((left, right) => {
      const leftScore = left.a.linkCount + left.b.linkCount;
      const rightScore = right.a.linkCount + right.b.linkCount;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return refKey(left.a.ref).localeCompare(refKey(right.a.ref));
    })
    .slice(0, limit);
};

/** kind 候选（按出现次数倒序），供筛选下拉 */
export const webKindOptions = (graph: WebGraph): string[] => {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([kind]) => kind);
};

export const nodeRadius = (linkCount: number): number => 7 + Math.min(13, linkCount * 1.6);

export const edgeDash = (lineStyle: string): string | undefined => {
  if (lineStyle === 'dashed') return '7 5';
  if (lineStyle === 'double') return '2 3';
  return undefined;
};

