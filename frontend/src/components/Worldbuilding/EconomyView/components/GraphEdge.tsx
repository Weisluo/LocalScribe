/**
 * 图边 GraphEdge（Phase 5 P5-T10；economy_ui_design §4.1/§4.5.2/§4.6.1/§4.7）
 *
 * 只画不写数据；一切线型 / 颜色 / 宽度 / 盈余都来自 props（FlowCanvas 已按契约注册表与
 * EconomyVisualModel 折算好）：
 * - 线型严格用注册表：solid / dashed / dotted 用 stroke-dasharray，**double 用双边偏移**；
 *   缺流量（`label === FLOW_LABEL_MISSING`，即 '—'）时 solid 降为 dashed，让「缺省」与「flow = 0」可区分；
 * - 颜色取注册表 color（tailwind 色 token），沙盘档的盈余语义色由 FlowCanvas 覆盖传入；
 * - `width` 由沙盘流量或结构档 `meta.intensity` 折算，无值统一细线（不显示 0）；
 * - `surplus='deficit'` 时叠一条 SVG `<pattern>` 自绘斜纹，并且**始终配文字**（颜色不单独承载语义）；
 * - 箭头表达方向；无向边（`directed=false` 或 double 线型）不画箭头；
 * - 命中区是加宽的透明描边，细线也好点选；`dimmed` 只降透明度但仍在 DOM。
 */

import { FLOW_LABEL_MISSING } from '../graph/normalize';
import {
  SURPLUS_TONE_KEY,
  arrowMarkerId,
  clampEdgeWidth,
  dashArrayOf,
  hatchPatternId,
  toneFillClassOf,
  toneStrokeClassOf,
} from '../graph/layout';
import type { GraphEdgeProps } from '../types';

/** 边与节点中心之间留出的空隙（节点半径量级），避免线压在形状下面 */
const NODE_INSET = 22;

/** 注册表里自带纹理 / 双边的线型：缺流量时保持原样，不额外改成虚线 */
const REGISTRY_TEXTURED_STYLES = ['dashed', 'dotted', 'double'];

/**
 * 缺流量（`visual.edgeLabel[id] === '—'`）时把线型降为虚线（§4.6.2：缺省画虚线并标「—」，
 * `flow = 0` 画细实线并标「0」）。以注册表 lineStyle 为基准：dotted / double / dashed 保持原样。
 */
const edgeLineStyleOf = (lineStyle: string, label: string): string =>
  label === FLOW_LABEL_MISSING && !REGISTRY_TEXTURED_STYLES.includes(lineStyle)
    ? 'dashed'
    : lineStyle;

export const GraphEdge = ({
  edge,
  from,
  to,
  width,
  surplus,
  label,
  lineStyle,
  color,
  dimmed,
  selected,
  onSelect,
}: GraphEdgeProps) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 0 ? dx / length : 1;
  const uy = length > 0 ? dy / length : 0;
  const nx = -uy;
  const ny = ux;
  const inset = Math.min(NODE_INSET, Math.max(0, length / 2 - 6));
  const sx = from.x + ux * inset;
  const sy = from.y + uy * inset;
  const ex = to.x - ux * inset;
  const ey = to.y - uy * inset;

  const effectiveStyle = edgeLineStyleOf(lineStyle, label);
  const double = effectiveStyle === 'double';
  const offsets = double ? [-2.6, 2.6] : [0];
  const dash = dashArrayOf(effectiveStyle);
  const strokeWidth = clampEdgeWidth(width);
  const hatched = surplus === 'deficit';
  const tone = hatched ? SURPLUS_TONE_KEY.deficit : color || 'neutral';
  const arrow = edge.directed && !double;
  const markerId = arrowMarkerId(`${edge.id}-${tone}`);
  const patternId = hatchPatternId(edge.id);
  const text = label || (hatched ? '赤字' : '');
  const flowMissing = label === FLOW_LABEL_MISSING;

  const pathOf = (offset: number): string =>
    `M ${sx + nx * offset} ${sy + ny * offset} L ${ex + nx * offset} ${ey + ny * offset}`;

  const labelX = (sx + ex) / 2 - nx * 12;
  const labelY = (sy + ey) / 2 - ny * 12;
  const labelWidth = Math.max(18, text.length * 9 + 10);

  return (
    <g
      data-testid={`economy-edge-${edge.id}`}
      data-edge-id={edge.id}
      data-link-type={edge.linkType}
      data-line-style={effectiveStyle}
      data-registry-line-style={lineStyle}
      data-flow-missing={flowMissing ? 'true' : 'false'}
      data-surplus={surplus}
      data-directed={arrow ? 'true' : 'false'}
      data-dimmed={dimmed ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      opacity={dimmed ? 0.25 : 1}
      className="transition-opacity duration-200 motion-reduce:transition-none"
    >
      <title>{`${text ? `${text}：` : ''}${edge.linkType}`}</title>

      <defs>
        {hatched && (
          <pattern
            id={patternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              strokeWidth={2.4}
              className="stroke-amber-600 dark:stroke-amber-400"
            />
          </pattern>
        )}
        {arrow && (
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L7,3 L0,6 z" className={toneFillClassOf(tone)} />
          </marker>
        )}
      </defs>

      {selected && (
        <path
          d={pathOf(0)}
          fill="none"
          strokeWidth={strokeWidth + 6}
          className="stroke-primary/25"
        />
      )}

      {offsets.map((offset, index) => (
        <path
          key={`${edge.id}-${offset}`}
          d={pathOf(offset)}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          markerEnd={arrow && index === 0 ? `url(#${markerId})` : undefined}
          className={toneStrokeClassOf(tone)}
        />
      ))}

      {/* 赤字：斜纹纹理叠在同一条线上，旁边必有文字（§4.6.2 颜色不单独承载语义） */}
      {hatched && (
        <path
          d={pathOf(0)}
          fill="none"
          strokeWidth={strokeWidth + 1.4}
          stroke={`url(#${patternId})`}
        />
      )}

      {text && (
        <g transform={`translate(${labelX} ${labelY})`} data-testid={`economy-edge-label-${edge.id}`}>
          <rect
            x={-labelWidth / 2}
            y={-8}
            width={labelWidth}
            height={15}
            rx={3}
            strokeWidth={1}
            className="fill-card stroke-border/60"
          />
          <text y={3} textAnchor="middle" fontSize={9} className="fill-foreground">
            {text}
          </text>
        </g>
      )}

      <path
        d={pathOf(0)}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        pointerEvents="stroke"
        className="cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(edge.id);
        }}
      >
        <title>{`${text ? `${text}：` : ''}点击选中这条关联`}</title>
      </path>
    </g>
  );
};

export default GraphEdge;
