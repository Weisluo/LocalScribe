/**
 * 图节点 GraphNode（Phase 5 P5-T10；economy_ui_design §2.2/§4.5.1/§4.7.2）
 *
 * 纯展示件（SVG），只画不写数据：
 * - 形状按 kind（`ECONOMY_KIND_SHAPE`：圆点 / 菱形 / 圆角方 / 双环方 / 轨道端点 / 六边形 / 轨道条；
 *   自定义 kind 缺省圆角方），大小按 `size`（sm | md | lg），右上角是关联数角标（出 / 入）；
 * - 四级视觉权重只影响大小与常显程度，不用颜色单独区分类型（§4.7.2）；
 * - `stub`：虚线光环 + 「待补全」小字；`external`：只读样式（虚线描边 + 领域底色取对方模块 + 「外站」）；
 * - `dimmed`（窗口外 / 被筛选）只降透明度但仍在 DOM：隐藏不等于删除（§4.6.2）；
 * - 选中态是**账页高亮描边**（虚线双框 + 加粗描边），不是仅靠颜色（§4.1）；
 * - 名称最多两行、超出省略；hover 由 `<title>` 给完整名称，选中时补全整名 + kind 徽章；
 *   `aria-label` 用「名称 · kind 文案」作文本替代名。
 */

import type { ReactNode } from 'react';

import { ECONOMY_KIND_SHAPE } from '../config';
import {
  SURPLUS_TONE_KEY,
  hatchPatternId,
  moduleToneOf,
  toneFillClassOf,
  toneStrokeClassOf,
  wrapNodeLabel,
} from '../graph/layout';
import { lucideIcon } from '../../shared/lucideIcon';
import type { GraphNodeProps } from '../types';

/** 形状半高（§4.7.2：形状按 kind，大小按四级权重） */
const SHAPE_HALF: Record<'sm' | 'md' | 'lg', number> = { sm: 11, md: 15, lg: 20 };
const LABEL_FONT: Record<'sm' | 'md' | 'lg', number> = { sm: 9, md: 10, lg: 11 };

/** 形状的横向半宽：轨道类形状是「横条」，命中框与选中描边都要跟着变宽 */
const shapeHalfWidth = (shape: string, half: number): number => {
  if (shape === 'track-bar') return half * 1.7;
  if (shape === 'rail-end' || shape === 'time-band' || shape === 'route') return half * 1.4;
  return half;
};

const hexPoints = (half: number): string =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    return `${(Math.cos(angle) * half).toFixed(2)},${(Math.sin(angle) * half).toFixed(2)}`;
  }).join(' ');

/**
 * kind -> SVG 形状。`fill="none"` / `fillOpacity` 由调用方统一控制，
 * 这里只描述轮廓，避免出现「形状一处实心一处空心」的分叉。
 */
const shapeOf = (shape: string, half: number): ReactNode => {
  switch (shape) {
    case 'dot':
      return <circle r={half} />;
    case 'diamond':
      return <polygon points={`0,${-half} ${half},0 0,${half} ${-half},0`} />;
    case 'double-square':
      return (
        <>
          <rect x={-half} y={-half} width={half * 2} height={half * 2} rx={3} />
          <rect
            x={-half * 0.55}
            y={-half * 0.55}
            width={half * 1.1}
            height={half * 1.1}
            rx={2}
            fillOpacity={0.9}
            className="stroke-none"
          />
        </>
      );
    case 'hexagon':
      return <polygon points={hexPoints(half)} />;
    case 'rail-end':
      return (
        <>
          <rect
            x={-half * 1.2}
            y={-half * 0.75}
            width={half * 2.4}
            height={half * 1.5}
            rx={half * 0.35}
          />
          <line x1={-half * 1.9} y1={0} x2={half * 1.9} y2={0} strokeWidth={1} />
        </>
      );
    case 'track-bar':
      return (
        <>
          <rect
            x={-half * 1.7}
            y={-half * 0.55}
            width={half * 3.4}
            height={half * 1.1}
            rx={3}
          />
          <line x1={-half * 1.7} y1={-half * 1.15} x2={half * 1.7} y2={-half * 1.15} strokeWidth={1} />
          <line x1={-half * 1.7} y1={half * 1.15} x2={half * 1.7} y2={half * 1.15} strokeWidth={1} />
        </>
      );
    case 'time-band':
      return (
        <rect
          x={-half * 1.4}
          y={-half * 0.6}
          width={half * 2.8}
          height={half * 1.2}
          rx={2}
          strokeDasharray="5 3"
        />
      );
    case 'route':
      return (
        <>
          <rect
            x={-half * 1.4}
            y={-half * 0.8}
            width={half * 2.8}
            height={half * 1.6}
            rx={half * 0.4}
            strokeDasharray="6 4"
          />
          <circle r={half * 0.26} fillOpacity={1} />
        </>
      );
    default:
      // 自定义 kind 缺省圆角方（§4.7.2）
      return <rect x={-half} y={-half} width={half * 2} height={half * 2} rx={half * 0.35} />;
  }
};

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;

/**
 * 附加 prop：画布超过 SVG 节点上限时只画选中 / hover 的标签（P5-T10 简化标签，
 * 真实性能降级由 P5-T14 负责）。`GraphNodeProps` 是冻结接口，这里以**可选**扩展兼容，
 * 单独渲染 GraphNode 时行为与不传一致。
 */
export interface GraphNodeExtras {
  showLabel?: boolean;
}

export const GraphNode = ({
  node,
  x,
  y,
  size,
  selected,
  sandbox,
  surplus,
  scaleLabel,
  external,
  stub,
  dimmed,
  kindDef,
  onSelect,
  onOpenEntity,
  showLabel = true,
}: GraphNodeProps & GraphNodeExtras) => {
  const shape = ECONOMY_KIND_SHAPE[node.kind] ?? 'rounded-square';
  const half = SHAPE_HALF[size];
  const halfWidth = shapeHalfWidth(shape, half);
  const kindLabel = kindDef?.label ?? node.kind;
  const outCount = node.counts?.outgoing ?? 0;
  const inCount = node.counts?.incoming ?? 0;
  const total = node.counts?.total ?? outCount + inCount;

  // 颜色口径：外站取对方模块领域色；沙盘档取盈余语义色；结构档取节点自身领域色（green / cyan）
  const tone = external
    ? moduleToneOf(node.ref?.module)
    : sandbox
      ? SURPLUS_TONE_KEY[surplus]
      : (node.color?.trim() || 'green');
  const hole = sandbox && (surplus === 'unknown' || !scaleLabel || scaleLabel === '—');
  const hatched = sandbox && !external && surplus === 'deficit';
  const patternId = hatchPatternId(node.id);

  const shapeClass = hatched
    ? `${toneStrokeClassOf(tone)} fill-none`
    : `${toneFillClassOf(tone)} ${toneStrokeClassOf(tone)}`;
  const fillOpacity = hatched ? 0 : hole ? 0 : external ? 0.16 : 0.34;

  const metaParts: string[] = [];
  if (sandbox) metaParts.push(scaleLabel === '—' || !scaleLabel ? '规模未填' : `规模 ${scaleLabel}`);
  if (stub) metaParts.push('待补全');
  metaParts.push(`出${outCount}/入${inCount}`);
  const metaText = clip(metaParts.join(' · '), 18);

  const labelLines = wrapNodeLabel(node.name, size === 'lg' ? 9 : 8, 2);
  const labelFont = LABEL_FONT[size];
  const metaY = half + (labelLines.length + 1) * (labelFont + 1);
  const kindBadgeWidth = Math.max(30, kindLabel.length * 10 + 14);
  const glyph = kindDef?.icon ? lucideIcon(kindDef.icon) : undefined;
  const Glyph = glyph;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.name} · ${kindLabel}`}
      aria-pressed={selected}
      data-testid={`economy-node-${node.id}`}
      data-node-id={node.id}
      data-kind={node.kind}
      data-size={size}
      data-shape={shape}
      data-stub={stub ? 'true' : 'false'}
      data-external={external ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      data-dimmed={dimmed ? 'true' : 'false'}
      transform={`translate(${x} ${y})`}
      className={`group/node cursor-pointer outline-none transition-opacity duration-200 motion-reduce:transition-none ${
        dimmed ? 'opacity-25' : 'opacity-100'
      }`}
      onClick={(event) => {
        event.stopPropagation();
        event.currentTarget.focus();
        onSelect(node.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onOpenEntity(node.id);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // 空格 / 回车打开，向上冒泡会与画布的方向键处理重叠，这里自行吞掉
        event.preventDefault();
        event.stopPropagation();
        onOpenEntity(node.id);
      }}
    >
      <title>{`${node.name} · ${kindLabel}${stub ? ' · 待补全' : ''}${external ? ' · 外站（跨模块只读）' : ''}`}</title>

      {hatched && (
        <defs>
          <pattern
            id={patternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth={2.4} className="stroke-amber-600 dark:stroke-amber-400" />
          </pattern>
        </defs>
      )}

      {stub && (
        <circle
          r={half + 7}
          fill="none"
          strokeWidth={1}
          strokeDasharray="3 3"
          className="stroke-muted-foreground/70"
        />
      )}

      {/* hover 光环：只做反馈，不改变形状语义（§5：画布节点不加交错入场，只保留 hover / 选中） */}
      <rect
        x={-halfWidth - 5}
        y={-half - 5}
        width={halfWidth * 2 + 10}
        height={half * 2 + 10}
        rx={5}
        fill="none"
        strokeWidth={1}
        className="stroke-primary/40 opacity-0 transition-opacity duration-200 group-hover/node:opacity-100 motion-reduce:transition-none"
      />

      {selected && (
        <rect
          x={-halfWidth - 5}
          y={-half - 5}
          width={halfWidth * 2 + 10}
          height={half * 2 + 10}
          rx={5}
          fill="none"
          strokeWidth={1.2}
          strokeDasharray="4 2"
          className="stroke-primary"
        />
      )}

      <g
        className={shapeClass}
        fill={hatched ? `url(#${patternId})` : undefined}
        fillOpacity={fillOpacity}
        strokeWidth={selected ? 2.4 : 1.4}
        strokeDasharray={external ? '4 3' : undefined}
      >
        {shapeOf(shape, half)}
      </g>

      {Glyph && !hole && (
        <Glyph
          x={-half * 0.42}
          y={-half * 0.42}
          width={half * 0.84}
          height={half * 0.84}
          strokeWidth={1.6}
          className="text-background"
          aria-hidden="true"
        />
      )}

      {/* 关联数角标（出 / 入合计），契约 §5.1：节点右上角显示关联计数 */}
      <g transform={`translate(${halfWidth + 4} ${-half - 4})`}>
        <circle r={7} strokeWidth={1} className="fill-card stroke-border/70" />
        <text y={3} textAnchor="middle" fontSize={9} className="fill-foreground">
          {total}
        </text>
      </g>

      {external && (
        <text
          x={-halfWidth - 4}
          y={4}
          textAnchor="end"
          fontSize={9}
          className="fill-muted-foreground"
          data-testid={`economy-node-external-${node.id}`}
        >
          外站
        </text>
      )}

      {selected && (
        <>
          <text y={-half - 20} textAnchor="middle" fontSize={11} className="fill-foreground">
            {node.name}
          </text>
          <g transform={`translate(0 ${-half - 38})`}>
            <rect
              x={-kindBadgeWidth / 2}
              y={-9}
              width={kindBadgeWidth}
              height={16}
              rx={8}
              strokeWidth={1}
              className="fill-muted stroke-border/70"
            />
            <text y={3} textAnchor="middle" fontSize={9} className="fill-muted-foreground">
              {kindLabel}
            </text>
          </g>
        </>
      )}

      {showLabel &&
        labelLines.map((line, index) => (
          <text
            key={`${node.id}-label-${index}`}
            y={half + 11 + index * (labelFont + 1)}
            textAnchor="middle"
            fontSize={labelFont}
            className="fill-foreground"
          >
            {line}
          </text>
        ))}

      {showLabel && (
        <text y={metaY} textAnchor="middle" fontSize={9} className="fill-muted-foreground">
          {metaText}
        </text>
      )}
    </g>
  );
};

export default GraphNode;
