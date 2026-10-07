/**
 * 条约缎带层 TreatyRibbonLayer（Phase 4 P4-T7；politics_ui_design §4.1/§4.6/§11.1）
 *
 * - 缎带一律由 politics.ribbons（= politics.signatory_of 投影）绘制，不读不写任何旧条约边；
 * - 单缔约方画节点旌旗（ribbon.anchorB === undefined）；双方画直连缎带；
 *   三方及以上画多段缎带并在公共中点聚合（§4.6.1）；
 * - 缎带宽 24-40px（双线带），展开浮层高 160-240px；
 * - 有效性表达：生效中完整；到期 / 失效半透明并在中点显示状态文字；违约加警示描边 + breachState 文本；
 * - 点击中点出轻量条款浮层（标题 + 摘要），需要编辑时升级为条约簿 / 聚焦抽屉。
 */

import { useEffect, useState } from 'react';

import type { TreatyPartyView, TreatyRibbonView, TreatyTerm } from '../hooks/politicsTypes';
import { TREATY_STATUS_LABELS } from '../types';
import { boxAnchor, fillClassOf, strokeClassOf, type AtlasBox } from './atlasLayout';
import { useDismissOnEscape, usePrefersReducedMotion } from './atlasHooks';
import { sectionTitleClass } from '../tone';

const RIBBON_TONE = 'green';
/** 缎带带宽 24-40px：双线间距即带宽（§4.1） */
const RIBBON_OFFSET = 12;
const MULTI_OFFSET = 10;
/** 缎带生长动画时长（§4.9：150-300ms） */
const GROWTH_MS = 260;
/** 同一对缔约方之间有多条条约时的车道间距（世界坐标像素）：不叠在同一中点上 */
const RIBBON_LANE_GAP = 44;

interface PartyBox {
  party: TreatyPartyView;
  box: AtlasBox;
}

/**
 * 同一对缔约方（同一组缔约方 id 集合）的缎带按稳定顺序分车道：
 * 第 N 条整体下移 N * RIBBON_LANE_GAP，缎带与中点标签框一起移动（§4.6.1 补充：
 * 同一对政权签多条条约时必须能分别点开，标签不互相压字）。
 */
const laneIndexOf = (ribbons: TreatyRibbonView[]): Map<string, number> => {
  const groups = new Map<string, TreatyRibbonView[]>();
  for (const ribbon of ribbons) {
    const key = ribbon.parties
      .map((party) => party.ref.id)
      .sort()
      .join('|');
    const bucket = groups.get(key);
    if (bucket) bucket.push(ribbon);
    else groups.set(key, [ribbon]);
  }
  const lanes = new Map<string, number>();
  for (const members of groups.values()) {
    [...members]
      .sort(
        (a, b) =>
          a.treaty.name.localeCompare(b.treaty.name, 'zh-Hans-CN') ||
          a.treaty.id.localeCompare(b.treaty.id)
      )
      .forEach((ribbon, index) => lanes.set(ribbon.treaty.id, index));
  }
  return lanes;
};

export interface TreatyRibbonLayerProps {
  ribbons: TreatyRibbonView[];
  boxes: Map<string, AtlasBox>;
  onHover: (ribbon: TreatyRibbonView | null) => void;
  /** anchor 为世界坐标，由画布换算成屏幕坐标后弹出条款浮层 */
  onSelect: (ribbon: TreatyRibbonView, anchor: { x: number; y: number }) => void;
}

const statusClassOf = (ribbon: TreatyRibbonView): string => {
  if (ribbon.status === 'expired') return 'opacity-45';
  if (ribbon.status === 'unknown') return 'opacity-60';
  return 'opacity-100';
};

/** 只保留能在画布上定位的缔约方；无法定位的缔约方不画（由条款浮层的缔约方文字兜底） */
const partyPointsOf = (
  parties: TreatyPartyView[],
  boxes: Map<string, AtlasBox>
): PartyBox[] =>
  parties.flatMap((party) => {
    const box = boxes.get(party.ref.id);
    return box ? [{ party, box }] : [];
  });

/**
 * 缎带线段：生长动画靠「先设 1 的 dashoffset，再在下一帧改成 0」两步完成。
 * transition 类必须始终在样式里：如果在同一帧里既设初值又摘掉 transition，
 * 浏览器算出的 after-change style 会是 transition-duration: 0s，动画根本不会播。
 * prefers-reduced-motion 由 motion-reduce:transition-none 直接跳过动画（瞬间完整）。
 */
const RibbonLine = ({
  d,
  animated,
  className,
  strokeWidth,
}: {
  d: string;
  /** true：本次挂载才需要生长动画（reduced motion 下调用方已置 false） */
  animated: boolean;
  className: string;
  strokeWidth: number;
}) => (
  <path
    d={d}
    fill="none"
    strokeWidth={strokeWidth}
    className={`transition-[stroke-dashoffset] motion-reduce:transition-none ${className}`}
    pathLength={1}
    strokeDasharray={animated ? 1 : undefined}
    strokeDashoffset={animated ? 1 : 0}
    style={animated ? { transitionDuration: `${GROWTH_MS}ms` } : undefined}
  />
);

const TreatyRibbon = ({
  ribbon,
  parties,
  reduced,
  focused,
  onHover,
  onSelect,
}: {
  ribbon: TreatyRibbonView;
  parties: PartyBox[];
  reduced: boolean;
  focused: boolean;
  onHover: (ribbon: TreatyRibbonView | null) => void;
  onSelect: (ribbon: TreatyRibbonView, anchor: { x: number; y: number }) => void;
}) => {
  const [grown, setGrown] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setGrown(true);
      return;
    }
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  if (parties.length === 0) return null;
  const strokeWidth = focused ? 2.4 : 1.8;
  const animated = !grown;
  const suspended = ribbon.status === 'suspended';
  const breach = ribbon.treaty.meta.breachState;

  // 单缔约方：节点旌旗（§4.6.1）
  if (parties.length === 1) {
    const single = parties[0];
    const poleX = single.box.x + single.box.width + 10;
    const topY = single.box.y + 8;
    const baseY = single.box.y + 8 + 34;
    const midY = single.box.y + 8 + 17;
    return (
      <g
        className={`cursor-pointer ${statusClassOf(ribbon)}`}
        data-testid="atlas-treaty-flag"
        data-atlas-ribbon="single"
        data-treaty-id={ribbon.treaty.id}
        onPointerEnter={() => onHover(ribbon)}
        onPointerLeave={() => onHover(null)}
        onClick={() =>
          onSelect(ribbon, { x: poleX + 60, y: midY })
        }
      >
        <path
          d={`M ${poleX} ${topY} L ${poleX} ${baseY}`}
          strokeWidth={1.6}
          className={strokeClassOf(RIBBON_TONE)}
        />
        <path
          d={`M ${poleX} ${topY} L ${poleX + 34} ${topY + 10} L ${poleX} ${topY + 20} Z`}
          className={fillClassOf(RIBBON_TONE)}
        />
        <text x={poleX + 6} y={baseY + 12} className="fill-foreground text-[10px]">
          {ribbon.treaty.name}
        </text>
        <text x={poleX + 6} y={baseY + 24} className="fill-muted-foreground text-[10px]">
          单缔约方 · {TREATY_STATUS_LABELS[ribbon.status]}
        </text>
        {/* 命中区：SVG 根节点 pointer-events-none，这里显式打开 */}
        <rect
          x={poleX - 8}
          y={topY - 8}
          width={132}
          height={baseY - topY + 34}
          fill="transparent"
          pointerEvents="all"
        />
      </g>
    );
  }

  // 双方：直连缎带；三方及以上：各方向公共中点聚合
  const centers = parties.map(({ box }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));
  const mid =
    parties.length === 2
      ? { x: (centers[0].x + centers[1].x) / 2, y: (centers[0].y + centers[1].y) / 2 }
      : {
          x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
          y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
        };
  const offset = parties.length === 2 ? RIBBON_OFFSET : MULTI_OFFSET;
  // 同一政权与其卫星组织可能都是缔约方（卫星吸附在政权卡上）：起点相同只画一段
  const seenStarts = new Set<string>();
  const segments = parties
    .map(({ box }) => {
      const start = boxAnchor(box, mid.x, mid.y);
      const dx = mid.x - start.x;
      const dy = mid.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      return { nx: -dy / length, ny: dx / length, startX: start.x, startY: start.y };
    })
    .filter((segment) => {
      const key = `${Math.round(segment.startX)}:${Math.round(segment.startY)}`;
      if (seenStarts.has(key)) return false;
      seenStarts.add(key);
      return true;
    });

  return (
    <g
      className={`cursor-pointer ${statusClassOf(ribbon)}`}
      data-testid="atlas-treaty-ribbon"
      data-atlas-ribbon="multi"
      data-treaty-id={ribbon.treaty.id}
      data-parties={segments.length}
      onPointerEnter={() => onHover(ribbon)}
      onPointerLeave={() => onHover(null)}
      onClick={() => onSelect(ribbon, mid)}
    >
      {segments.map((segment, index) => (
        <g key={`${ribbon.treaty.id}-${index}`}>
          {suspended && (
            <RibbonLine
              d={`M ${segment.startX} ${segment.startY} L ${mid.x} ${mid.y}`}
              animated={false}
              className="stroke-destructive"
              strokeWidth={12}
            />
          )}
          {[-offset, offset].map((side) => (
            <RibbonLine
              key={side}
              d={`M ${segment.startX + segment.nx * side} ${segment.startY + segment.ny * side} L ${
                mid.x + segment.nx * side
              } ${mid.y + segment.ny * side}`}
              animated={animated}
              className={suspended ? 'stroke-destructive' : strokeClassOf(RIBBON_TONE)}
              strokeWidth={strokeWidth}
            />
          ))}
          <circle
            cx={segment.startX}
            cy={segment.startY}
            r={4}
            className={suspended ? 'fill-destructive' : fillClassOf(RIBBON_TONE)}
          />
          {/* 命中区：缎带本身只有 2px 描边，单独加宽透明线 */}
          <path
            d={`M ${segment.startX} ${segment.startY} L ${mid.x} ${mid.y}`}
            stroke="transparent"
            strokeWidth={Math.max(20, offset * 2 + 8)}
            fill="none"
            pointerEvents="stroke"
          />
        </g>
      ))}

      <circle cx={mid.x} cy={mid.y} r={6} className={fillClassOf(RIBBON_TONE)} />
      <g transform={`translate(${mid.x - 70}, ${mid.y - 34})`}>
        <rect
          width={140}
          height={breach ? 42 : 28}
          rx={6}
          className="fill-card stroke-border"
          strokeWidth={1}
        />
        <text x={8} y={18} className="fill-foreground text-[10px]">
          {ribbon.treaty.name} · {ribbon.parties.length} 方
        </text>
        <text x={8} y={30} className="fill-muted-foreground text-[10px]">
          {TREATY_STATUS_LABELS[ribbon.status]}
          {ribbon.status === 'expired' && ribbon.treaty.meta.expiresAt
            ? ` · ${ribbon.treaty.meta.expiresAt}`
            : ''}
        </text>
        {breach && (
          <text x={8} y={40} className="fill-destructive text-[10px]">
            违约：{breach}
          </text>
        )}
      </g>
      {/* 中点条款浮层命中区 */}
      <rect
        x={mid.x - 70}
        y={mid.y - 34}
        width={140}
        height={breach ? 42 : 28}
        fill="transparent"
        pointerEvents="all"
      />
    </g>
  );
};

export const TreatyRibbonLayer = ({
  ribbons,
  boxes,
  onHover,
  onSelect,
}: TreatyRibbonLayerProps) => {
  const reduced = usePrefersReducedMotion();
  const lanes = laneIndexOf(ribbons);

  return (
    <g data-testid="atlas-treaty-ribbon-layer">
      {ribbons.map((ribbon) => {
        const lane = lanes.get(ribbon.treaty.id) ?? 0;
        return (
          <g
            key={ribbon.treaty.id}
            transform={`translate(0 ${lane * RIBBON_LANE_GAP})`}
            data-treaty-lane={lane}
          >
            <TreatyRibbon
              ribbon={ribbon}
              parties={partyPointsOf(ribbon.parties, boxes)}
              reduced={reduced}
              focused={false}
              onHover={onHover}
              onSelect={onSelect}
            />
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ *
 * 中点条款浮层（§4.6.3：先轻量浮层，需要编辑时升级为条约簿 / 聚焦抽屉）
 * ------------------------------------------------------------------ */

export interface TreatyTermFloatProps {
  ribbon: TreatyRibbonView;
  /** 屏幕坐标（画布已换算） */
  anchor: { x: number; y: number };
  terms: TreatyTerm[];
  onClose: () => void;
  onOpenTreatyBook: () => void;
  onFocusTreaty: (treatyId: string) => void;
}

export const TreatyTermFloat = ({
  ribbon,
  anchor,
  terms,
  onClose,
  onOpenTreatyBook,
  onFocusTreaty,
}: TreatyTermFloatProps) => {
  useDismissOnEscape(true, onClose);
  const meta = ribbon.treaty.meta;
  const shown = terms.slice(0, 6);
  const overflow = terms.length - shown.length;

  return (
    <div
      role="dialog"
      aria-label={`条约条款 ${ribbon.treaty.name}`}
      data-testid="atlas-treaty-float"
      className="absolute z-40 flex max-h-60 min-h-40 w-80 flex-col gap-2 overflow-y-auto rounded-2xl border border-emerald-600/40 bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="flex items-center gap-1.5">
        <span className={sectionTitleClass}>{ribbon.treaty.name}</span>
        <span className="text-xs text-muted-foreground">
          {TREATY_STATUS_LABELS[ribbon.status]} · {ribbon.parties.length} 个缔约方
        </span>
        <button
          type="button"
          aria-label="关闭条款浮层"
          onClick={onClose}
          className="ml-auto rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          关闭
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        缔约方：{ribbon.parties.map((party) => party.label).join('、') || '未标注'}
      </div>
      {(meta.effectiveAt || meta.expiresAt) && (
        <div className="text-xs text-muted-foreground">
          生效 {meta.effectiveAt || '未标注'} - 失效 {meta.expiresAt || '未标注'}
        </div>
      )}
      {meta.summary && <div className="text-sm leading-relaxed text-foreground">{meta.summary}</div>}
      {meta.breachState && (
        <div className="rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive">
          违约状态：{meta.breachState}
        </div>
      )}

      <div className="space-y-1.5 border-t border-border/30 pt-2">
        {shown.length === 0 ? (
          <div className="text-xs text-muted-foreground/70">还没有条款</div>
        ) : (
          shown.map((term) => (
            <div key={term.id} className="text-xs leading-relaxed text-foreground">
              <span className="font-medium">{term.title}</span>
              {term.content && (
                <span className="ml-1 text-muted-foreground">{term.content}</span>
              )}
              {term.secret && <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">密约</span>}
            </div>
          ))
        )}
        {overflow > 0 && (
          <div className="text-xs text-muted-foreground">等 {terms.length} 条条款</div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border/30 pt-2">
        <button
          type="button"
          onClick={onOpenTreatyBook}
          className="rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          在条约簿中编辑
        </button>
        <button
          type="button"
          onClick={() => onFocusTreaty(ribbon.treaty.id)}
          className="rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          打开条约详情
        </button>
      </div>
    </div>
  );
};

export default TreatyRibbonLayer;
