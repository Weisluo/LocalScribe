/**
 * 关系边层 RelationEdgeLayer（Phase 4 P4-T6；politics_ui_design §4.1/§4.7/§11.1）
 *
 * - 只画 politics.edgeViews / aggregatedEdges（细线，实线 / 虚线 / 双线 + 有向箭头），
 *   条约缎带不在此层（§4.7.2：两者不共用图层）；
 * - 命中区用加宽透明描边，避免细线难以点选；悬停与点击交给上层浮层（边卡）处理；
 * - 聚焦降噪：非相关边降到 DIM_EDGE_OPACITY（10%），相关边加粗；
 * - 人物对人物边（politics.marriage_tie / politics.succeeds）：人物没有自己的布局盒，
 *   由上层传入 figureAnchors（人物 -> 所属政权 / 组织盒子）解析落点，并且给这类边加一点弧度，
 *   不会和同对节点的政权边压在一起；解析不到任何端点的边标 dangling 渲染（不静默丢弃）；
 * - 失效引用（dangling）：能定位的一端画警示虚线短桩并标「失效」，两端都缺时只进清理清单（§3.8.7）。
 */

import { DIM_EDGE_OPACITY } from '../tone';
import type { AtlasEdgeItem } from './atlasLayout';
import {
  arrowMarkerId,
  boxAnchor,
  boxCenter,
  dashArrayOf,
  edgeWidthOf,
  fillClassOf,
  markerTonesFor,
  strokeClassOf,
  type AtlasBox,
} from './atlasLayout';

/** 人物关系边相对直连的弧度（世界坐标像素，按端点距离比例收窄） */
const FIGURE_EDGE_BOW = 0.18;

export interface RelationEdgeLayerProps {
  items: AtlasEdgeItem[];
  boxes: Map<string, AtlasBox>;
  /** 人物 id -> 所属政权 / 组织盒子（人物关系边落点，§4.7.4） */
  figureAnchors?: Map<string, AtlasBox>;
  /** 两端都是人物的边 key（link id）：渲染时加弧度区分 */
  figureEdgeIds?: Set<string>;
  focusedIds: Set<string>;
  /** true 且已聚焦：无关边降到 10%；false：不降噪 */
  dimUnrelated: boolean;
  /** 沙盘档：强度映射线宽 */
  showStrength: boolean;
  onHover: (item: AtlasEdgeItem | null) => void;
  onSelect: (item: AtlasEdgeItem) => void;
}

export const RelationEdgeLayer = ({
  items,
  boxes,
  figureAnchors,
  figureEdgeIds,
  focusedIds,
  dimUnrelated,
  showStrength,
  onHover,
  onSelect,
}: RelationEdgeLayerProps) => {
  const focusActive = focusedIds.size > 0;

  // 箭头 marker 按「本层实际用到的色名」生成：未登记色名由 arrowMarkerId 归一化到 neutral，
  // 不会出现 markerEnd 指向一个不存在 id 的「有线无箭头」
  const markerTones = markerTonesFor(items.map((item) => item.color));

  const boxOf = (entityId: string): AtlasBox | undefined =>
    boxes.get(entityId) ?? figureAnchors?.get(entityId);

  return (
    <g data-testid="atlas-relation-edge-layer">
      <defs>
        {markerTones.map((tone) => (
          <marker
            key={tone}
            id={arrowMarkerId(tone)}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L7,3 L0,6 z" className={fillClassOf(tone)} />
          </marker>
        ))}
      </defs>

      {items.map((item) => {
        const fromBox = boxOf(item.from.id);
        const toBox = boxOf(item.to.id);
        const color = item.color || 'neutral';
        const strokeWidth = showStrength ? edgeWidthOf(item.strength) : 1.6;
        const related = focusedIds.has(item.from.id) || focusedIds.has(item.to.id);
        const opacity = dimUnrelated && focusActive && !related ? DIM_EDGE_OPACITY : 1;
        const dash = dashArrayOf(item.lineStyle);
        const figureEdge = figureEdgeIds?.has(item.single?.link.id ?? item.memberIds[0]) ?? false;

        // 失效引用：能定位的一端画警示短桩，两端都缺时不画（由清理清单覆盖）
        if (!fromBox || !toBox) {
          const known = fromBox ?? toBox;
          if (!known) return null;
          const center = boxCenter(known);
          const leftward = !fromBox;
          const stubX = leftward ? known.x - 64 : known.x + known.width + 64;
          const stubY = center.y;
          return (
            <g
              key={item.key}
              opacity={opacity}
              data-testid="atlas-dangling-edge"
              data-atlas-edge="dangling"
              data-edge-key={item.key}
            >
              <path
                d={`M ${leftward ? known.x : known.x + known.width} ${stubY} L ${stubX} ${stubY}`}
                strokeWidth={1.6}
                strokeDasharray="4 4"
                fill="none"
                className="stroke-destructive"
              />
              <circle cx={stubX} cy={stubY} r="3" className="fill-destructive/70" />
              <path
                d={`M ${stubX - 30} ${stubY - 34} L ${stubX + 30} ${stubY - 34} L ${stubX + 30} ${stubY - 14} L ${stubX - 30} ${stubY - 14} Z`}
                fill="transparent"
                className="cursor-pointer"
                pointerEvents="all"
                onPointerEnter={() => onHover(item)}
                onPointerLeave={() => onHover(null)}
                onClick={() => onSelect(item)}
              />
            </g>
          );
        }

        const start = boxAnchor(fromBox, boxCenter(toBox).x, boxCenter(toBox).y);
        const end = boxAnchor(toBox, boxCenter(fromBox).x, boxCenter(fromBox).y);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const offsets = item.lineStyle === 'double' ? [-2.5, 2.5] : [0];
        // 人物关系边：同对人物可能有多条边，用二次贝塞尔画弧，弧度随距离缩放
        const bow = figureEdge ? Math.min(FIGURE_EDGE_BOW * length, 120) : 0;
        const pathOf = (offset: number): string => {
          if (bow === 0) {
            return `M ${start.x + nx * offset} ${start.y + ny * offset} L ${end.x + nx * offset} ${
              end.y + ny * offset
            }`;
          }
          const cx = (start.x + end.x) / 2 + nx * bow + nx * offset;
          const cy = (start.y + end.y) / 2 + ny * bow + ny * offset;
          return `M ${start.x + nx * offset} ${start.y + ny * offset} Q ${cx} ${cy} ${
            end.x + nx * offset
          } ${end.y + ny * offset}`;
        };

        return (
          <g
            key={item.key}
            opacity={opacity}
            data-testid="atlas-relation-edge"
            data-atlas-edge={figureEdge ? 'figure' : 'relation'}
            data-figure-edge={figureEdge ? 'true' : 'false'}
            data-edge-key={item.key}
            data-link-type={item.linkType}
            data-related={related ? 'true' : 'false'}
          >
            {offsets.map((offset, index) => (
              <path
                key={`${item.key}-${offset}`}
                d={pathOf(offset)}
                strokeWidth={related && focusActive ? strokeWidth + 0.6 : strokeWidth}
                strokeDasharray={dash}
                fill="none"
                markerEnd={item.directed && index === 0 ? `url(#${arrowMarkerId(color)})` : undefined}
                className={strokeClassOf(color)}
              />
            ))}
            <path
              d={pathOf(0)}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              pointerEvents="stroke"
              className="cursor-pointer"
              onPointerEnter={() => onHover(item)}
              onPointerLeave={() => onHover(null)}
              onClick={() => onSelect(item)}
            >
              <title>
                {`${item.label}：${item.memberIds.length > 1 ? `聚合 ${item.memberIds.length} 条` : '点击打开边卡'}`}
              </title>
            </path>
          </g>
        );
      })}
    </g>
  );
};

export default RelationEdgeLayer;
