/**
 * 政权节点 PolityNode（Phase 4 P4-T3；politics_ui_design §2.1/§4.1/§4.2.2/§4.2.6/§4.9）
 *
 * - 版图唯一的第一层级大卡：尺寸档只由 node.sizeTier（level.rank 派生）决定，不用 kind 定尺寸；
 * - 布局环由 node.ring 决定（rank 越高越靠中心），位置来自 atlasLayout 的世界坐标盒子；
 * - 默认显示名称、等级、状态、政体、首府、卫星计数、人物头像条、任职带；
 * - node.terminal（StatusDef.isTerminal）加 TERMINAL_NODE_CLASS 降为幽灵节点但不消失，状态始终带文字；
 * - 地图未接入：首府只作纯文本，不出现领土 / 地图入口或占位按钮（§6.7）；
 * - Tab 可遍历、Enter 打开；图标按钮一律有 aria-label。
 */

import { Landmark, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { StatusDef, LevelDef } from '../types';
import type { EntityRefsResult } from '../../hooks';
import {
  ATLAS_NODE_MAX_WIDTH,
  ATLAS_NODE_MIN_WIDTH,
  ATLAS_NODE_WIDTH,
} from '../config';
import { DIM_NODE_CLASS, TERMINAL_NODE_CLASS } from '../tone';
import type { AtlasNodeView } from '../hooks/politicsTypes';
import type { AtlasBox, AtlasLod } from './atlasLayout';
import { FigureStrip } from './FigureStrip';
import { OrganizationCluster } from './OrganizationCluster';

/**
 * 画布节点徽章：节点是**固定尺寸**的可视化盒（atlasLayout 的 width/maxWidth/height + overflow-hidden），
 * 所以徽章沿用画布密集位刻度（10px + 紧凑内边距），不走 DOM 内容的 `chipClass`（text-xs + px-3 py-1）。
 * 理由：后者会让单个徽章宽于节点卡内宽（158 - 2*10 ≈ 138px），被 overflow-hidden 水平裁切；
 * 这与 LaneRow 轴刻度、缎带 SVG 文字保留 10px 是同一口径（ui_style_alignment §3.2「计数徽章 / 密集位」）。
 */
const NODE_BADGE_CLASS =
  'inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] leading-tight transition-colors motion-reduce:transition-none';

/**
 * LevelDef.color -> 安全的内联色（§4.1「等级色」）：只接受 #rgb / #rrggbb / rgb()/hsl()，
 * 其余（未设置、写错的色名）一律返回 undefined，由调用方退回默认琥珀色。
 * 颜色只作辅助，等级徽章上的文字标签始终存在（§4.9）。
 */
const SAFE_CSS_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;
const levelColorOf = (levels: LevelDef[], levelId?: string): string | undefined => {
  const raw = levels.find((def) => def.id === levelId)?.color;
  const color = typeof raw === 'string' ? raw.trim() : '';
  return color && SAFE_CSS_COLOR.test(color) ? color : undefined;
};

export interface PolityNodeProps {
  node: AtlasNodeView;
  box: AtlasBox;
  levels: LevelDef[];
  statuses: StatusDef[];
  refs: EntityRefsResult;
  lod: AtlasLod;
  focused: boolean;
  marked: boolean;
  dimmed: boolean;
  showSatellites: boolean;
  showFigureStrip: boolean;
  showTenureBands: boolean;
  canEdit: boolean;
  /** 回填迁移写入 meta.legacy：标「旧数据」并且不给就地编辑入口（§8） */
  legacy?: boolean;
  onOpen: (polityId: string) => void;
  onOpenFigure: (figureId: string) => void;
  onAddOrganization: () => void;
  onRename: (polityId: string, name: string) => Promise<void>;
}

export const PolityNode = ({
  node,
  box,
  levels,
  statuses,
  refs,
  lod,
  focused,
  marked,
  dimmed,
  showSatellites,
  showFigureStrip,
  showTenureBands,
  canEdit,
  legacy = false,
  onOpen,
  onOpenFigure,
  onAddOrganization,
  onRename,
}: PolityNodeProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.polity.name);

  useEffect(() => {
    if (!editing) setDraft(node.polity.name);
  }, [node.polity.name, editing]);

  const tier = node.sizeTier;
  // 宽度只由 sizeTier 决定：布局宽度取自 ATLAS_NODE_WIDTH，并夹在 min / max 之间（§4.1）
  const width = Math.min(
    ATLAS_NODE_MAX_WIDTH[tier],
    Math.max(ATLAS_NODE_MIN_WIDTH[tier], box.width || ATLAS_NODE_WIDTH[tier])
  );
  const level = node.polity.meta.level;
  const status = node.polity.meta.status;
  const levelDef = levels.find((def) => def.id === level);
  const levelLabel = levelDef?.label ?? level ?? '未分级';
  const statusLabel = statuses.find((def) => def.id === status)?.label ?? status;
  const government = node.polity.meta.governmentFormLabel;
  const capital = node.polity.meta.capitalLabel;
  const compact = tier === 'low';
  const summary = `聚焦政权 ${node.polity.name}`;
  // 等级色：LevelDef.color 不再是只写字段；未设置 / 写坏时退回默认琥珀（§4.1）
  const levelColor = levelColorOf(levels, level);

  const commitRename = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === node.polity.name) return;
    await onRename(node.polity.id, next);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={summary}
      aria-pressed={focused}
      data-testid="atlas-polity-node"
      data-atlas-node="polity"
      data-polity-id={node.polity.id}
      data-size-tier={tier}
      data-ring={node.ring}
      data-legacy={legacy ? 'true' : 'false'}
      onClick={() => onOpen(node.polity.id)}
      onDoubleClick={() => onOpen(node.polity.id)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(node.polity.id);
      }}
      style={{ left: box.x, top: box.y, width, minWidth: ATLAS_NODE_MIN_WIDTH[tier], maxWidth: ATLAS_NODE_MAX_WIDTH[tier], height: box.height }}
      className={`absolute flex cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border bg-card/95 p-2.5 text-left shadow-sm transition-[opacity,box-shadow,border-color] duration-300 motion-reduce:transition-none ${
        focused ? 'border-primary ring-2 ring-primary/60' : 'border-amber-600/40 hover:border-primary/25 hover:shadow-lg'
      } ${marked ? 'border-dashed border-primary' : ''} ${node.terminal ? TERMINAL_NODE_CLASS : ''} ${
        dimmed ? DIM_NODE_CLASS : ''
      }`}
    >
      <div className="flex items-start gap-1.5">
        <Landmark
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
          style={levelColor ? { color: levelColor } : undefined}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              aria-label="政权名称"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') void commitRename();
                if (event.key === 'Escape') {
                  setEditing(false);
                  setDraft(node.polity.name);
                }
              }}
              onBlur={() => void commitRename()}
              className="w-full rounded-lg border border-border/60 bg-background px-2 py-1 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
            />
          ) : (
            <div className={`truncate leading-tight text-foreground ${compact ? 'text-sm font-medium' : 'text-base font-semibold'}`}>
              {node.polity.name}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {/* 等级色只覆盖描边 / 文字色：底色仍是低饱和衬底，light / dark 都可读。
                三个徽章都加 nowrap：flex 收缩会把 CJK chip 压到 min-content（单字）后内部逐字换行 */}
            <span
              className={`${NODE_BADGE_CLASS} border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300`}
              data-testid="atlas-level-badge"
              data-level-color={levelColor ?? ''}
              style={levelColor ? { borderColor: levelColor, color: levelColor } : undefined}
            >
              等级 {levelLabel}
            </span>
            {legacy && (
              <span
                className={`${NODE_BADGE_CLASS} border-dashed border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-300`}
                data-testid="atlas-legacy-badge"
                title="回填迁移写入的旧数据：只读，编辑入口已关闭"
              >
                旧数据
              </span>
            )}
            {statusLabel && (
              <span
                className={`${NODE_BADGE_CLASS} border-border/60 bg-muted/30 text-muted-foreground`}
                data-testid="atlas-status-badge"
              >
                状态 {statusLabel}
                {node.terminal && <span>· 已终结</span>}
              </span>
            )}
          </div>
        </div>
        {canEdit && !compact && !legacy && (
          <button
            type="button"
            aria-label={`重命名政权 ${node.polity.name}`}
            title="就地重命名"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary motion-reduce:transition-none"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {!compact && (government || capital) && (
        <div className="space-y-0.5 text-xs leading-tight text-muted-foreground">
          {government && <div className="truncate">政体 {government}</div>}
          {/* 地图未接入：首府只显示文字标签，不提供地图入口（§6.7） */}
          {capital && <div className="truncate">首府 {capital}</div>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 text-xs leading-tight text-muted-foreground">
        <span>卫星 {node.satellites.length}</span>
        <span>·</span>
        <span>人物 {node.figures.length}</span>
        <span>·</span>
        <span>
          关系 出{node.relationCount.out}/入{node.relationCount.in}
        </span>
        {node.ribbons.length > 0 && (
          <>
            <span>·</span>
            <span>条约 {node.ribbons.length}</span>
          </>
        )}
      </div>

      {showSatellites && !compact && (
        <OrganizationCluster
          organizations={node.satellites}
          variant={tier === 'high' && lod === 'near' ? 'chips' : 'count'}
          onOpen={onOpen}
          onAdd={onAddOrganization}
        />
      )}

      {showFigureStrip && !compact && (
        <div className="mt-auto">
          <FigureStrip
            /* 顺序用已排序的 coreFigures（主要任职 -> 任职数 -> 名称），
               溢出计数仍按全量 node.figures 算 */
            figures={node.coreFigures}
            allFigures={node.figures}
            tenureBands={node.tenureBands}
            refs={refs}
            showTenureBands={showTenureBands}
            onOpenFigure={onOpenFigure}
          />
        </div>
      )}
    </div>
  );
};

export default PolityNode;
