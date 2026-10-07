/**
 * WorldWeb（Phase 6 P6-T8；cross_module_link_design §5.4、worldbuilding_ui_design §5.5）
 *
 * 世界脉络只读总览的视图层：力导向 SVG（≤800 节点）或降级为模块矩阵 + 推荐关联。
 * 图构造、布局、筛选、降级判定等纯逻辑在 ./worldWebGraph.ts，便于独立测试。
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Filter, Maximize2, X } from 'lucide-react';

import type { EntityRef, WorldLinkCounts } from '@/services/worldbuildingApi';
import type { WorldModuleV2 } from '../types';
import { MODULE_TYPES, kindLabel, moduleLabel, refKey } from '../types';
import { useLinkRegistry } from '../hooks/useWorldData';
import { useWorldLinks } from '../hooks/useLinks';
import { useWorldLinkCountMap } from '../shared';
import {
  EMPTY_WEB_FILTERS,
  DEFAULT_NODE_HEX,
  LINK_COLOR_HEX,
  MODULE_HEX,
  WEB_CANVAS,
  WEB_NODE_LIMIT,
  buildWebGraph,
  edgeDash,
  filterWebGraph,
  layoutWebGraph,
  nodeRadius,
  recommendWebLinks,
  webDegradeStateOf,
  webKindOptions,
  webModuleMatrix,
  type WebFilters,
  type WebLayoutPoint,
} from './worldWebGraph';

export interface WorldWebProps {
  open: boolean;
  onClose: () => void;
  worldId: string;
  /** /worlds/{id} 详情里的模块（含 submodules + items） */
  modules: WorldModuleV2[];
  /** 服务端聚合的模块级关联计数（降级矩阵用） */
  counts: WorldLinkCounts[];
  onNavigate: (ref: EntityRef) => void;
}

export const WorldWeb = ({
  open,
  onClose,
  worldId,
  modules,
  counts,
  onNavigate,
}: WorldWebProps) => {
  const linksQuery = useWorldLinks(open ? worldId : undefined);
  const registryQuery = useLinkRegistry();
  const countMap = useWorldLinkCountMap(open ? worldId : undefined);
  const [filters, setFilters] = useState<WebFilters>(EMPTY_WEB_FILTERS);

  const registry = useMemo(
    () => new Map((registryQuery.data ?? []).map((def) => [def.id, def])),
    [registryQuery.data]
  );

  const graph = useMemo(() => {
    const links = (linksQuery.data ?? []).map((link) => ({
      id: link.id,
      source: link.source,
      target: link.target,
      link_type: link.link_type,
      label: link.label ?? null,
      time: link.time ?? null,
    }));
    const built = buildWebGraph(modules, links, {
      countOfRef: (ref) => countMap.countOf(ref),
    });
    return {
      ...built,
      edges: built.edges.map((edge) => ({
        ...edge,
        lineStyle: registry.get(edge.linkType)?.line_style ?? edge.lineStyle,
      })),
    };
  }, [modules, linksQuery.data, countMap, registry]);

  const degrade = webDegradeStateOf(graph.nodes.length);
  const filtered = useMemo(() => filterWebGraph(graph, filters), [graph, filters]);
  // 降级时渲染的是模块矩阵，坐标完全不用；超过 800 节点的世界还要跑 120 轮力导向
  // 是纯粹的浪费（节点越多每格越挤，反而最容易卡住）
  const positions = useMemo(
    () => (degrade.degraded ? new Map<string, WebLayoutPoint>() : layoutWebGraph(filtered.nodes, filtered.edges)),
    [degrade.degraded, filtered.nodes, filtered.edges]
  );
  const kindOptions = useMemo(() => webKindOptions(graph), [graph]);
  const matrix = useMemo(() => webModuleMatrix(graph), [graph]);
  const recommendations = useMemo(() => recommendWebLinks(graph), [graph]);
  const countByModule = useMemo(
    () => new Map(counts.map((entry) => [entry.module, entry])),
    [counts]
  );

  if (!open) return null;

  const toggleModule = (module: string) => {
    setFilters((previous) => ({
      ...previous,
      modules: previous.modules.includes(module)
        ? previous.modules.filter((item) => item !== module)
        : [...previous.modules, module],
    }));
  };

  const renderCanvas = !degrade.degraded && filtered.nodes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="world-web">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="世界脉络"
        className="relative z-10 flex h-[88vh] w-[92vw] max-w-[1400px] flex-col rounded-2xl border border-border/50 bg-card/60 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center gap-3 border-b border-border/30 px-5 py-4">
          <Maximize2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">世界脉络</h2>
          <span className="text-xs text-muted-foreground">
            只读总览 · 实体 {graph.nodes.length} · 关联 {graph.edges.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭世界脉络"
            className="ml-auto rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border/30 px-5 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            筛选
          </span>
          {MODULE_TYPES.filter((module) =>
            graph.nodes.some((node) => node.module === module)
          ).map((module) => {
            const active = filters.modules.includes(module);
            return (
              <button
                key={module}
                type="button"
                aria-pressed={active}
                onClick={() => toggleModule(module)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 motion-reduce:transition-none ${
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                    : 'border-border/40 text-muted-foreground hover:border-border/70 hover:bg-accent/5 hover:text-foreground'
                }`}
              >
                {moduleLabel(module)}
              </button>
            );
          })}
          <select
            aria-label="按 kind 筛选"
            value={filters.kind}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, kind: event.target.value }))
            }
            className="rounded-xl border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs transition-all duration-200 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">全部 kind</option>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
          <select
            aria-label="按关联类型筛选"
            value={filters.linkType}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, linkType: event.target.value }))
            }
            className="rounded-xl border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs transition-all duration-200 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">全部关联类型</option>
            {(registryQuery.data ?? []).map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            aria-label="时间范围起点"
            placeholder="时间起"
            value={filters.timeStart}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, timeStart: event.target.value }))
            }
            className="w-20 rounded-xl border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <input
            type="text"
            aria-label="时间范围终点"
            placeholder="时间止"
            value={filters.timeEnd}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, timeEnd: event.target.value }))
            }
            className="w-20 rounded-xl border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={!filters.hideIsolated}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  hideIsolated: !event.target.checked,
                }))
              }
            />
            显示孤立节点
          </label>
          <span className="ml-auto text-xs text-muted-foreground">
            当前 {filtered.nodes.length} 节点 / {filtered.edges.length} 关联
          </span>
        </div>

        {degrade.degraded && (
          <div
            className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-300"
            data-testid="world-web-degraded"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {degrade.reason}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          {linksQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              正在加载关联…
            </div>
          ) : linksQuery.isError ? (
            <div className="flex h-full items-center justify-center text-xs text-destructive">
              关联加载失败，请稍后重试
            </div>
          ) : degrade.degraded ? (
            <div className="space-y-4" data-testid="world-web-matrix">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="border-b border-border/30 py-1.5 pr-2 font-medium">模块</th>
                    <th className="border-b border-border/30 py-1.5 pr-2 font-medium">实体</th>
                    <th className="border-b border-border/30 py-1.5 pr-2 font-medium">孤立</th>
                    <th className="border-b border-border/30 py-1.5 pr-2 font-medium">关联</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.module}>
                      <td className="border-b border-border/20 py-1.5 pr-2">
                        {moduleLabel(row.module)}
                      </td>
                      <td className="border-b border-border/20 py-1.5 pr-2">{row.nodes}</td>
                      <td className="border-b border-border/20 py-1.5 pr-2">{row.isolated}</td>
                      <td className="border-b border-border/20 py-1.5 pr-2">
                        {countByModule.get(row.module)?.total ?? row.edges}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div>
                <div className="mb-1.5 text-sm font-semibold text-foreground">推荐关联</div>
                {recommendations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    暂无可推荐的同类型实体对。
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {recommendations.map((item) => (
                      <li
                        key={`${refKey(item.a.ref)}|${refKey(item.b.ref)}`}
                        className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-2 text-xs shadow-sm"
                      >
                        <span className="text-foreground">{item.a.name}</span>
                        <span className="text-muted-foreground">与</span>
                        <span className="text-foreground">{item.b.name}</span>
                        <span className="text-muted-foreground">{item.reason}</span>
                        <button
                          type="button"
                          onClick={() => onNavigate(item.a.ref)}
                          className="ml-auto rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
                        >
                          打开
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : !renderCanvas ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              当前筛选下没有可展示的节点。
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${WEB_CANVAS.width} ${WEB_CANVAS.height}`}
              className="h-full w-full"
              role="img"
              aria-label="世界脉络只读图"
              data-testid="world-web-canvas"
            >
              <g>
                {filtered.edges.map((edge) => {
                  const source = positions.get(edge.sourceKey);
                  const target = positions.get(edge.targetKey);
                  if (!source || !target) return null;
                  const definition = registry.get(edge.linkType);
                  const color =
                    LINK_COLOR_HEX[definition?.color ?? 'slate'] ?? LINK_COLOR_HEX.slate;
                  return (
                    <line
                      key={edge.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={color}
                      strokeOpacity={0.55}
                      strokeWidth={edge.lineStyle === 'double' ? 2.5 : 1.4}
                      strokeDasharray={edgeDash(edge.lineStyle)}
                      data-link-type={edge.linkType}
                    />
                  );
                })}
              </g>
              <g>
                {filtered.nodes.map((node) => {
                  const key = refKey(node.ref);
                  const point = positions.get(key);
                  if (!point) return null;
                  const radius = nodeRadius(node.linkCount);
                  const fill = MODULE_HEX[node.module] ?? DEFAULT_NODE_HEX;
                  const showLabel = radius >= 11 || filtered.nodes.length <= 140;
                  return (
                    <g key={key}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                        fill={fill}
                        fillOpacity={node.external ? 0.35 : 0.85}
                        stroke={node.external ? fill : '#0b0b0b'}
                        strokeOpacity={node.external ? 0.9 : 0.25}
                        strokeDasharray={node.external ? '2 2' : undefined}
                        tabIndex={0}
                        role="button"
                        aria-label={`${moduleLabel(node.module)} ${node.name}，关联 ${node.linkCount}`}
                        onClick={() => onNavigate(node.ref)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onNavigate(node.ref);
                          }
                        }}
                        data-testid="world-web-node"
                        data-ref-key={key}
                      >
                        <title>
                          {`${moduleLabel(node.module)} · ${node.name} · ${kindLabel(node.kind)} · 关联 ${node.linkCount}${node.external ? '（外站引用）' : ''}`}
                        </title>
                      </circle>
                      {showLabel && (
                        <text
                          x={point.x}
                          y={point.y + radius + 11}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[10px]"
                        >
                          {node.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/30 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span>节点按模块着色、按关联数定大小；边按关联类型色与线型区分。</span>
          <span>超过 {WEB_NODE_LIMIT} 节点自动降级为模块矩阵与推荐关联。</span>
          <span className="ml-auto">只读：此处不提供图编辑能力。</span>
        </div>
      </div>
    </div>
  );
};

export default WorldWeb;
