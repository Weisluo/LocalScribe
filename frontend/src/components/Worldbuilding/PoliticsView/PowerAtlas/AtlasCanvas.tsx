/**
 * 分层画布 AtlasCanvas（Phase 4 P4-T3..P4-T7；politics_ui_design §4.1/§4.2/§4.7/§8/§11.1/§11.3）
 *
 * 图层：领土层（地图未接入，整层隐藏）/ 条约缎带层 / 关系边层（SVG）/ 政权层 + 卫星簇 + 人物条（DOM）。
 * 交互：滚轮缩放、拖拽平移、Shift+拖拽框选、双击空白新建政权、双击节点聚焦；
 * 渲染：只画视口内节点与边；LOD 拉远只留政权节点与主干边，拉近才出卫星 / 人物条 / 全部边；
 * 能力：复杂度三档由 politics.capabilities 决定（§8）；prefers-reduced-motion 下动效改为直接切换。
 */

import { Layers, Maximize2, Minus, Network, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { matchesFilter } from '../hooks';
import type {
  AtlasNodeView,
  PoliticsFilterState,
  TreatyRibbonView,
  UsePoliticsResult,
} from '../hooks/politicsTypes';
import { POLITICS_LINE_STYLES } from '../config';
import { ORGANIZATION_KIND, POLITY_KIND, TENURE_LINK_TYPES, treatyTermsOf } from '../types';
import {
  ATLAS_WORLD_LIMIT,
  FORCE_ITEM_HEIGHT,
  FORCE_LANE_PADDING,
  boxesIntersect,
  clampScale,
  computeAtlasLayout,
  fitView,
  lodOf,
  toEdgeItems,
  type AtlasBox,
  type AtlasEdgeItem,
} from './atlasLayout';
import { EdgeCard, DanglingEdgeChips, EdgeHoverSummary } from './EdgeCard';
import { IndependentLane } from './IndependentLane';
import { PolityNode } from './PolityNode';
import { RelationEdgeLayer } from './RelationEdgeLayer';
import { RelationFilterPanel } from './RelationFilterPanel';
import { TreatyRibbonLayer, TreatyTermFloat } from './TreatyRibbonLayer';

export interface AtlasCanvasProps {
  politics: UsePoliticsResult;
  filter: PoliticsFilterState;
  focusedId: string | null;
  onFocus: (entityId: string) => void;
  onClearFocus: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  relationLayerOpen: boolean;
  onToggleRelationLayer: (next: boolean) => void;
  onOpenTreatyBook: () => void;
  onCreateKind: (kind: string) => void;
}

interface DragSession {
  mode: 'pan' | 'box';
  pointerId: number;
  startX: number;
  startY: number;
  originTx: number;
  originTy: number;
  /** 本次手势是否已经越过 4px 阈值（决定是拖拽还是点击） */
  moved: boolean;
  /** 是否已把指针捕获到容器（只有真拖拽才捕获，否则会吃掉子元素的 click） */
  captured: boolean;
  /** 移动阈值之后才允许平移：按在可交互元素上时先等阈值，避免吞掉点击 */
  deferPan: boolean;
}

/** 拖拽判定阈值（px）：小于它一律当点击处理 */
const DRAG_THRESHOLD = 4;

/**
 * 可交互元素（不参与平移 / 框选）：画布上的政权卡、聚合块、人物条、独立势力项、
 * 关系层复选框、浮层按钮，以及 SVG 边 / 缎带的命中区。
 * 这些元素上的按下必须留给它们自己的 click，否则（Chromium 下 setPointerCapture 后
 * click 目标会被重定向到容器）节点、复选框、边卡按钮全都点不动。
 */
const isInteractiveTarget = (target: EventTarget | null): boolean =>
  !!target &&
  typeof (target as Element).closest === 'function' &&
  !!(target as Element).closest(
    '[data-atlas-interactive], [data-atlas-node], [data-atlas-overlay="true"], [data-atlas-edge], [data-atlas-ribbon], button, a, input, label, select, textarea, [role="button"]'
  );

export const AtlasCanvas = ({
  politics,
  filter,
  focusedId,
  onFocus,
  onClearFocus,
  onNavigateToEntity,
  relationLayerOpen,
  onToggleRelationLayer,
  onOpenTreatyBook,
  onCreateKind,
}: AtlasCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  /** 一次手势结束后：按下点确实是空白画布（click 时据此判断是否算「点空白」） */
  const pressedOnBackgroundRef = useRef(false);
  const suppressClickRef = useRef(false);
  /** 框选矩形同时存 ref：窗口级 pointerup 兜底时读到的是最新值 */
  const marqueeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const fittedRef = useRef(false);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(() => new Set());
  const [expandedFolded, setExpandedFolded] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(POLITICS_LINE_STYLES.map((layer) => layer.id))
  );
  const [customEnabled, setCustomEnabled] = useState<Set<string>>(() => new Set());
  const [showRibbons, setShowRibbons] = useState(true);
  const [onlyRelated, setOnlyRelated] = useState(true);
  const [hoverEdge, setHoverEdge] = useState<AtlasEdgeItem | null>(null);
  const [activeEdge, setActiveEdge] = useState<AtlasEdgeItem | null>(null);
  const [activeRibbon, setActiveRibbon] = useState<{
    ribbon: TreatyRibbonView;
    anchor: { x: number; y: number };
  } | null>(null);

  /* ---------------- 尺寸 / 视口 ---------------- */

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /* ---------------- 可见节点（筛选：等级 / 状态 / 搜索 + 层级导航） ---------------- */

  const matchesKind = useCallback(
    (node: AtlasNodeView): boolean => {
      if (filter.kind === 'all' || filter.kind === POLITY_KIND) return true;
      if (filter.kind === ORGANIZATION_KIND) {
        return (
          node.satellites.length > 0 ||
          politics.independentForces.some((force) => force.anchors.includes(node.polity.id))
        );
      }
      if (filter.kind === 'figure') return node.figures.length > 0;
      if (filter.kind === 'treaty') return node.ribbons.length > 0;
      return true;
    },
    [filter.kind, politics.independentForces]
  );

  const visibleNodes = useMemo(() => {
    // 等级 / 状态 / 搜索由 matchesFilter 过滤；kind 维度另走 matchesKind，
    // 否则把层级导航切到「组织 / 人物 / 条约」时政权骨架会被整片滤掉（§2.3 过滤器保留各自权重形态）
    const entityFilter = { ...filter, kind: 'all' as const };
    return politics.atlasNodes.filter(
      (node) => matchesFilter(node.polity, entityFilter) && matchesKind(node)
    );
  }, [politics.atlasNodes, filter, matchesKind]);

  /* ---------------- 布局（rank -> 环 -> 世界坐标） ---------------- */

  const layout = useMemo(
    () =>
      computeAtlasLayout(visibleNodes, politics.independentForces, {
        foldLow: politics.atlasMode === 'folded',
        expanded: expandedFolded,
        // 无 rank 判定 / 折叠判定用全量政权权重：筛选不该改变「有没有名次」的结论
        allWeights: politics.atlasNodes.map((node) => node.weight),
      }),
    [visibleNodes, politics.independentForces, politics.atlasMode, expandedFolded, politics.atlasNodes]
  );

  /** 回填迁移写入 meta.legacy 的旧数据 id：画布上标「旧数据」并不给编辑入口（§8） */
  const legacyIds = useMemo(
    () =>
      new Set([
        ...politics.atlasNodes
          .filter((node) => node.polity.meta.legacy === true)
          .map((node) => node.polity.id),
        ...politics.independentForces
          .filter((force) => force.entity.meta.legacy === true)
          .map((force) => force.entity.id),
      ]),
    [politics.atlasNodes, politics.independentForces]
  );

  /**
   * 人物关系边落点（§4.7.4）：politics.marriage_tie / politics.succeeds 是「人物对人物」，
   * 人物没有自己的布局盒。规则：沿任职边（leads / member_of）把人物归到所属政权 / 组织，
   * 取第一个归属节点（按节点 id 稳定排序）的盒子中心作为锚点；溯不到归属的人物不画（记 dangling）。
   */
  const figureIds = useMemo(() => new Set(politics.figures.map((figure) => figure.id)), [politics.figures]);
  const links = politics.links;

  const figureAnchors = useMemo(() => {
    const ownerOf = new Map<string, string>();
    const otherEnd = (link: WorldLink, figureId: string): string | undefined =>
      link.source.id === figureId
        ? link.target.id
        : link.target.id === figureId
          ? link.source.id
          : undefined;
    for (const link of links) {
      if (!TENURE_LINK_TYPES.includes(link.link_type)) continue;
      if (link.source.module !== 'politics' || link.target.module !== 'politics') continue;
      const ends = new Set<string>();
      if (figureIds.has(link.source.id)) ends.add(link.source.id);
      if (figureIds.has(link.target.id)) ends.add(link.target.id);
      for (const figureId of ends) {
        const owner = otherEnd(link, figureId);
        if (!owner || !layout.boxes.has(owner)) continue;
        const current = ownerOf.get(figureId);
        if (current === undefined || owner.localeCompare(current) < 0) ownerOf.set(figureId, owner);
      }
    }
    const anchors = new Map<string, AtlasBox>();
    for (const [figureId, owner] of ownerOf) {
      const box = layout.boxes.get(owner);
      if (box) anchors.set(figureId, box);
    }
    return anchors;
  }, [figureIds, layout.boxes, links]);
  // ^ politics.links 单独取值：直接依赖 politics 对象会被 exhaustive-deps 判为缺依赖

  const boxFor = useCallback(
    (entityId: string): AtlasBox | undefined => layout.boxes.get(entityId) ?? figureAnchors.get(entityId),
    [figureAnchors, layout.boxes]
  );

  /** 至少一端是人物、另一端也是人物的关系边：渲染时单独加一点弧度，避免与同对节点的政权边重叠 */
  const figureEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of politics.edgeViews) {
      const fromFigure = figureIds.has(edge.from.id);
      const toFigure = figureIds.has(edge.to.id);
      if (fromFigure && toFigure) ids.add(edge.link.id);
    }
    return ids;
  }, [figureIds, politics.edgeViews]);

  const laneBand = useMemo<AtlasBox>(
    () =>
      layout.laneBand ?? {
        x: layout.bounds.x,
        y: layout.bounds.y + layout.bounds.height + 56,
        width: 480,
        height: FORCE_ITEM_HEIGHT + FORCE_LANE_PADDING * 2,
      },
    [layout]
  );

  const contentBounds = useMemo<AtlasBox>(() => {
    const minX = Math.min(layout.bounds.x, laneBand.x);
    const minY = Math.min(layout.bounds.y, laneBand.y);
    const maxX = Math.max(layout.bounds.x + layout.bounds.width, laneBand.x + laneBand.width);
    const maxY = Math.max(layout.bounds.y + layout.bounds.height, laneBand.y + laneBand.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [layout.bounds, laneBand]);

  const svgBounds = useMemo<AtlasBox>(
    () => ({
      x: contentBounds.x - 80,
      y: contentBounds.y - 80,
      width: contentBounds.width + 160,
      height: contentBounds.height + 160,
    }),
    [contentBounds]
  );

  useEffect(() => {
    if (fittedRef.current || size.width < 80 || size.height < 80) return;
    fittedRef.current = true;
    setView(fitView(contentBounds, size.width, size.height));
  }, [size, contentBounds]);

  const lod = lodOf(view.k);
  const capabilities = politics.capabilities;

  const focusIds = new Set<string>();
  if (focusedId) focusIds.add(focusedId);
  for (const id of markedIds) focusIds.add(id);
  const focusActive = focusIds.size > 0;

  /** 与聚焦 / 框选节点直接相连的节点（含缎带缔约方）：其余节点降噪到 20%（§4.2.6） */
  const relatedNodeIds = new Set<string>();
  if (focusActive) {
    for (const id of focusIds) relatedNodeIds.add(id);
    for (const item of politics.edgeViews) {
      if (focusIds.has(item.from.id)) relatedNodeIds.add(item.to.id);
      if (focusIds.has(item.to.id)) relatedNodeIds.add(item.from.id);
    }
    for (const ribbon of politics.ribbons) {
      if (ribbon.parties.some((party) => focusIds.has(party.ref.id))) {
        for (const party of ribbon.parties) relatedNodeIds.add(party.ref.id);
      }
    }
  }

  /* ---------------- 边 / 缎带（不自行聚合，直接用 selectors 结果） ---------------- */

  // §11.3：折叠档与拉远档画聚合边（主干），完整档 + 拉近才画全部边
  const aggregateEdges = politics.atlasMode === 'folded' || lod === 'far';
  const edgeItems = useMemo(
    () => toEdgeItems(politics.edgeViews, politics.aggregatedEdges, aggregateEdges),
    [politics.edgeViews, politics.aggregatedEdges, aggregateEdges]
  );

  const layerEnabled = capabilities.relationEdges && relationLayerOpen;

  const visibleEdges: AtlasEdgeItem[] = !layerEnabled
    ? []
    : edgeItems.filter((item) => {
        if (!enabledTypes.has(item.linkType) && !customEnabled.has(item.linkType)) return false;
        const related = focusIds.has(item.from.id) || focusIds.has(item.to.id);
        // 折叠档默认只显示与选中节点相关的边（§11.3）；「仅看与选中节点相关」在其他档位同样生效
        if (politics.atlasMode === 'folded' && focusActive && !related) return false;
        if (onlyRelated && focusActive && !related) return false;
        return true;
      });

  const ribbonsVisible: TreatyRibbonView[] =
    showRibbons && capabilities.treatyRibbons && lod !== 'far'
      ? politics.ribbons.filter(
          (ribbon) =>
            !(onlyRelated && focusActive) ||
            ribbon.parties.some((party) => focusIds.has(party.ref.id))
        )
      : [];

  const viewportWorld = useMemo<AtlasBox | null>(() => {
    if (size.width < 1 || size.height < 1) return null;
    const pad = 140 / view.k;
    return {
      x: -view.tx / view.k - pad,
      y: -view.ty / view.k - pad,
      width: size.width / view.k + pad * 2,
      height: size.height / view.k + pad * 2,
    };
  }, [size, view]);

  const inViewport = (box?: AtlasBox): boolean =>
    !viewportWorld || !box || boxesIntersect(box, viewportWorld);

  const drawnNodes = layout.nodes.filter((item) => inViewport(item.box));
  const drawnBlocks = layout.foldedBlocks.filter((block) => inViewport(block.box));
  const drawnEdges = visibleEdges.filter(
    (item) => inViewport(boxFor(item.from.id)) || inViewport(boxFor(item.to.id))
  );
  const drawnRibbons = ribbonsVisible.filter((ribbon) =>
    ribbon.parties.some((party) => inViewport(layout.boxes.get(party.ref.id)))
  );
  const showLane = capabilities.satellites && lod === 'near';
  const showSatellites = capabilities.satellites && lod === 'near';

  // 人物关系边（两端都是人物）也要能落点：落点由 figureAnchors 解析，
  // 完全落不到任何节点的边不再被静默丢掉，改为标 dangling（见 RelationEdgeLayer）
  const figureEdges = visibleEdges.filter((item) =>
    figureEdgeIds.has(item.single?.link.id ?? item.memberIds[0])
  );
  const drawnFigureEdges = figureEdges.filter(
    (item) => inViewport(boxFor(item.from.id)) || inViewport(boxFor(item.to.id))
  );

  const activeMembers = activeEdge
    ? activeEdge.single
      ? [activeEdge.single]
      : politics.edgeViews.filter((edge) => activeEdge.memberIds.includes(edge.link.id))
    : [];
  const danglingItems = [...visibleEdges, ...figureEdges].filter(
    (item, index, list) => item.dangling && list.findIndex((other) => other.key === item.key) === index
  );

  /* ---------------- 交互 ---------------- */

  const toLocal = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const zoomBy = (factor: number) => {
    setView((prev) => {
      const k = clampScale(prev.k * factor);
      const ratio = k / prev.k;
      const cx = size.width / 2;
      const cy = size.height / 2;
      return { k, tx: cx - (cx - prev.tx) * ratio, ty: cy - (cy - prev.ty) * ratio };
    });
  };

  // 滚轮缩放：React 的 wheel 是被动监听，这里用原生监听才能 preventDefault
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((prev) => {
        const k = clampScale(prev.k * Math.exp(-event.deltaY * 0.0015));
        const ratio = k / prev.k;
        return { k, tx: px - (px - prev.tx) * ratio, ty: py - (py - prev.ty) * ratio };
      });
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // 统一手势读取：手势状态只存 ref，原生 pointermove / pointerup 与 React 事件共用
  const endDrag = useCallback(
    (pointerId: number, boxRect?: { x: number; y: number; width: number; height: number }) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      dragRef.current = null;
      pressedOnBackgroundRef.current = drag.deferPan && !drag.moved;
      suppressClickRef.current = drag.moved;
      const node = containerRef.current;
      if (node && drag.captured && node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
      if (drag.mode === 'box' && boxRect) {
        const worldRect: AtlasBox = {
          x: (boxRect.x - view.tx) / view.k,
          y: (boxRect.y - view.ty) / view.k,
          width: boxRect.width / view.k,
          height: boxRect.height / view.k,
        };
        setMarkedIds(
          new Set(
            layout.nodes
              .filter((item) => boxesIntersect(item.box, worldRect))
              .map((item) => item.node.polity.id)
          )
        );
      }
      setMarquee(null);
      marqueeRef.current = null;
    },
    [layout.nodes, view.k, view.tx, view.ty]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;
    const local = toLocal(event);
    dragRef.current = {
      mode: event.shiftKey ? 'box' : 'pan',
      pointerId: event.pointerId,
      startX: local.x,
      startY: local.y,
      originTx: view.tx,
      originTy: view.ty,
      moved: false,
      captured: false,
      deferPan: true,
    };
    setMarquee(null);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const local = toLocal(event);
    const dx = local.x - drag.startX;
    const dy = local.y - drag.startY;
    if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      drag.moved = true;
      // 只在真的开始拖拽时才捕获指针：pointerdown 就捕获会让 click 目标变成容器，
      // 子元素（节点、复选框、边卡按钮）永远收不到 onClick
      if (!drag.captured) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.captured = true;
        } catch {
          // 指针已失效（例如触摸抬起）时不修正，后续 pointerup 仍会结束手势
        }
      }
    }
    if (drag.mode === 'pan') {
      if (!drag.moved) return; // 阈值内不动：把这次手势留给子元素的点击
      setView((prev) => ({ ...prev, tx: drag.originTx + dx, ty: drag.originTy + dy }));
      return;
    }
    const rect = {
      x: Math.min(drag.startX, local.x),
      y: Math.min(drag.startY, local.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    };
    marqueeRef.current = rect;
    setMarquee(rect);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    endDrag(event.pointerId, marquee ?? undefined);
  };

  // 捕获可能失败：手势期间仍然要在窗口级兜住 pointerup，否则拖拽会「粘住」
  useEffect(() => {
    const onWindowUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      endDrag(event.pointerId, marqueeRef.current ?? undefined);
    };
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    return () => {
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [endDrag]);

  // 拖拽后抑制这一次 click，避免平移结束顺带触发节点聚焦
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const onBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    // 双重判定：按下点确实是空白画布，且 click 目标就是容器（setPointerCapture 后
    // click 目标会被重定向到容器，所以只比 target 是不够的）
    if (!pressedOnBackgroundRef.current) return;
    pressedOnBackgroundRef.current = false;
    if (event.target !== event.currentTarget) return;
    if (markedIds.size > 0) {
      setMarkedIds(new Set());
      return;
    }
    if (focusedId) onClearFocus();
  };

  const onBackgroundDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onCreateKind(POLITY_KIND);
  };

  const toggleType = (linkType: string, next: boolean) =>
    setEnabledTypes((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(linkType);
      else copy.delete(linkType);
      return copy;
    });

  const toggleCustom = (linkType: string, next: boolean) =>
    setCustomEnabled((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(linkType);
      else copy.delete(linkType);
      return copy;
    });

  // 提示条只说真实状态：折叠块没折到东西时不再假称「已聚合」
  const hint = [
    `复杂度 ${politics.complexity === 'sketch' ? '速写' : politics.complexity === 'structure' ? '结构' : '沙盘'}`,
    lod === 'far' ? 'LOD 拉远：只画政权节点与主干边' : 'LOD 拉近：全部图层',
    layout.folded
      ? `折叠档：${layout.foldedBlocks.reduce((sum, block) => sum + block.count, 0)} 个低等级政权已聚合`
      : politics.atlasMode === 'folded'
        ? '折叠档：当前没有需要聚合的低等级政权'
        : '',
    layerEnabled ? '' : '关系层未开启（按 L 或点「关系层」）',
    `政权 ${visibleNodes.length}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const floatAnchor = activeRibbon
    ? {
        x: Math.max(8, Math.min(Math.max(8, size.width - 336), activeRibbon.anchor.x * view.k + view.tx)),
        y: Math.max(8, Math.min(Math.max(8, size.height - 260), activeRibbon.anchor.y * view.k + view.ty)),
      }
    : null;

  return (
    <div
      ref={containerRef}
      data-testid="atlas-canvas"
      data-lod={lod}
      data-atlas-mode={politics.atlasMode}
      data-atlas-folded={layout.folded ? 'true' : 'false'}
      data-atlas-oversize={contentBounds.width > ATLAS_WORLD_LIMIT || contentBounds.height > ATLAS_WORLD_LIMIT ? 'true' : 'false'}
      className="relative h-full min-h-0 w-full touch-none select-none overflow-hidden rounded-2xl border border-border/40 bg-[#fdf6ec] dark:bg-[#2a1c0d]/40"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onClick={onBackgroundClick}
      onDoubleClick={onBackgroundDoubleClick}
    >
      {/* 领土层：地图未接入，整层不渲染（§4.2.1、§6.7），也不显示占位入口 */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` }}
      >
        <svg
          className="pointer-events-none"
          style={{ position: 'absolute', left: svgBounds.x, top: svgBounds.y }}
          width={svgBounds.width}
          height={svgBounds.height}
          viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.width} ${svgBounds.height}`}
          aria-hidden="true"
        >
          <RelationEdgeLayer
            items={[...drawnEdges, ...drawnFigureEdges]}
            boxes={layout.boxes}
            figureAnchors={figureAnchors}
            figureEdgeIds={figureEdgeIds}
            focusedIds={focusIds}
            dimUnrelated={!onlyRelated}
            showStrength={capabilities.relationStrength}
            onHover={setHoverEdge}
            onSelect={(item) => {
              setActiveRibbon(null);
              setActiveEdge(item);
            }}
          />
          <TreatyRibbonLayer
            ribbons={drawnRibbons}
            boxes={layout.boxes}
            onHover={() => undefined}
            onSelect={(ribbon, anchor) => {
              setActiveEdge(null);
              setActiveRibbon({ ribbon, anchor });
            }}
          />
        </svg>

        {drawnBlocks.map((block) => (
          <button
            key={block.id}
            type="button"
            data-testid="atlas-folded-block"
            data-atlas-interactive="true"
            onClick={() => setExpandedFolded(true)}
            style={{
              left: block.box.x,
              top: block.box.y,
              width: block.box.width,
              height: block.box.height,
            }}
            className="absolute flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-amber-600/50 bg-card/85 text-xs text-foreground transition-all duration-200 hover:border-primary/25 hover:shadow-lg motion-reduce:transition-none"
          >
            <Layers className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            低等级政权 {block.count} 个
            <span className="text-[10px] text-muted-foreground">点击展开</span>
          </button>
        ))}

        {drawnNodes.map(({ node, box }) => (
          <PolityNode
            key={node.polity.id}
            node={node}
            box={box}
            levels={politics.levels ?? []}
            statuses={politics.statuses ?? []}
            refs={politics.refs}
            lod={lod}
            focused={node.polity.id === focusedId}
            marked={markedIds.has(node.polity.id)}
            dimmed={focusActive && !relatedNodeIds.has(node.polity.id)}
            showSatellites={showSatellites}
            showFigureStrip={lod === 'near'}
            showTenureBands={capabilities.tenureBands}
            canEdit={politics.canEdit}
            legacy={node.polity.meta.legacy === true}
            onOpen={(id) => {
              setActiveEdge(null);
              onFocus(id);
            }}
            onOpenFigure={onFocus}
            onAddOrganization={() => onCreateKind(ORGANIZATION_KIND)}
            onRename={(id, name) => politics.updateEntity(id, { name })}
          />
        ))}

        {showLane && (
          <IndependentLane
            band={laneBand}
            items={layout.forceItems}
            dimmed={focusActive}
            legacyIds={legacyIds}
            onOpen={(id) => {
              setActiveEdge(null);
              onFocus(id);
            }}
            onCreate={() => onCreateKind(ORGANIZATION_KIND)}
          />
        )}
      </div>

      {/* 屏幕坐标浮层：工具栏 / 关系层 / 边卡 / 条款浮层（不随画布缩放） */}
      <div
        className="absolute left-2 top-2 z-30 flex max-w-[62%] flex-col items-start gap-1"
        data-atlas-overlay="true"
      >
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/50 bg-card/90 px-1.5 py-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            aria-label="缩小"
            onClick={() => zoomBy(1 / 1.2)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-xs text-muted-foreground">{Math.round(view.k * 100)}%</span>
          <button
            type="button"
            aria-label="放大"
            onClick={() => zoomBy(1.2)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="适应视图"
            onClick={() => setView(fitView(contentBounds, size.width, size.height))}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={relationLayerOpen}
            aria-label="关系层开关"
            onClick={() => onToggleRelationLayer(!relationLayerOpen)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors motion-reduce:transition-none ${
              relationLayerOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
            }`}
          >
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            关系层
          </button>
          {layout.folded && (
            <button
              type="button"
              aria-label="展开低等级聚合块"
              onClick={() => setExpandedFolded(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              展开聚合块
            </button>
          )}
          {expandedFolded && politics.atlasMode === 'folded' && (
            <button
              type="button"
              aria-label="折叠低等级政权"
              onClick={() => setExpandedFolded(false)}
              className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
            >
              折叠低等级
            </button>
          )}
          {markedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setMarkedIds(new Set())}
              className="rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
            >
              已选 {markedIds.size} 个政权 · 清除
            </button>
          )}
          {focusedId && (
            <button
              type="button"
              aria-label="退出聚焦"
              onClick={onClearFocus}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              退出聚焦
            </button>
          )}
        </div>
        <div className="rounded-xl border border-border/40 bg-card/80 px-2.5 py-1 text-xs text-muted-foreground">
          {hint}
        </div>
        {marquee && (
          <div className="text-xs text-primary">框选：松开后高亮命中的政权</div>
        )}
      </div>

      <DanglingEdgeChips
        items={danglingItems}
        refs={politics.refs}
        canEdit={politics.canEdit}
        onSelect={(item) => {
          setActiveRibbon(null);
          setActiveEdge(item);
        }}
        onDeleteAll={() => {
          const linkIds = danglingItems.flatMap((item) => item.memberIds);
          void Promise.all(linkIds.map((linkId) => politics.deleteLink(linkId)));
        }}
      />

      <RelationFilterPanel
        open={relationLayerOpen}
        enabledTypes={enabledTypes}
        onToggleType={toggleType}
        showRibbons={showRibbons}
        onToggleRibbons={setShowRibbons}
        customTypes={politics.config.linkTypes ?? []}
        customEnabled={customEnabled}
        onToggleCustom={toggleCustom}
        onlyRelated={onlyRelated}
        onToggleOnlyRelated={setOnlyRelated}
        treatyCount={politics.treaties.length}
        onOpenTreatyBook={onOpenTreatyBook}
        onClose={() => onToggleRelationLayer(false)}
      />

      {marquee && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-dashed border-primary/70 bg-primary/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
        />
      )}

      {visibleNodes.length > 0 && layout.nodes.length === 0 && layout.foldedBlocks.length > 0 && (
        <div
          className="pointer-events-none absolute bottom-2 left-2 z-30 rounded-xl border border-dashed border-amber-600/50 bg-card/90 px-3 py-1.5 text-xs text-foreground shadow-sm"
          data-atlas-overlay="true"
          data-testid="atlas-all-folded"
        >
          低等级政权已聚合为 {layout.foldedBlocks.length} 个区块，点击区块逐层展开
        </div>
      )}

      {visibleNodes.length === 0 && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-y-2 text-center text-sm text-muted-foreground"
          data-atlas-overlay="true"
        >
          {/* 同画布上还有独立势力时不能只说「没有政权节点」，否则用户以为整块画布是空的 */}
          <div>
            {politics.atlasNodes.length === 0
              ? '当前筛选下没有政权节点'
              : `当前筛选下没有政权节点${showLane ? '（独立势力带仍在下方）' : ''}`}
          </div>
          <button
            type="button"
            onClick={() => onCreateKind(POLITY_KIND)}
            className="rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
          >
            新建政权
          </button>
        </div>
      )}

      {hoverEdge && !activeEdge && (
        <EdgeHoverSummary item={hoverEdge} refs={politics.refs} perspectiveId={focusedId} />
      )}

      {activeEdge && (
        <EdgeCard
          item={activeEdge}
          members={activeMembers}
          refs={politics.refs}
          perspectiveId={focusedId}
          showStrength={capabilities.relationStrength}
          canEdit={politics.canEdit}
          legacy={legacyIds.has(activeEdge.from.id) && legacyIds.has(activeEdge.to.id)}
          isSaving={politics.isSaving}
          onSelectMember={(member) => setActiveEdge(toEdgeItems([member], [], false)[0])}
          onUpdateLink={politics.updateLink}
          onDeleteLink={politics.deleteLink}
          onFocusEntity={onFocus}
          onNavigateToEntity={onNavigateToEntity}
          onClose={() => setActiveEdge(null)}
        />
      )}

      {activeRibbon && floatAnchor && (
        <TreatyTermFloat
          ribbon={activeRibbon.ribbon}
          anchor={floatAnchor}
          terms={treatyTermsOf(politics.items, activeRibbon.ribbon.treaty.id)}
          onClose={() => setActiveRibbon(null)}
          onOpenTreatyBook={onOpenTreatyBook}
          onFocusTreaty={(treatyId) => {
            setActiveRibbon(null);
            onFocus(treatyId);
          }}
        />
      )}
    </div>
  );
};

export default AtlasCanvas;
