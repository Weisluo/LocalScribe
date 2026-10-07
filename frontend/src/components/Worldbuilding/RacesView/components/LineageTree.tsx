/**
 * 血缘树 LineageTree（Phase 3 P3-T3；races_ui_design §4.3/§8）
 *
 * - 层级只用 parent_id：主条目（race）在上，支系（subrace）挂其下，实线连接；
 *   只渲染 root -> 直接子级，第三层永不出现（§12.3）；「+ 支系」入口与详情页同一判据
 *   （canOwnSubrace：只有第一层 kind 能挂支系）。
 * - 跨族 races.related_to 由 buildLineage 按无序端点对去重（A-B 与 B-A 只留一条），
 *   这里直接渲染为显式边列表，颜色 + 线型取 relationKindDef（double 双线 / dashed 虚线 / solid 实线），
 *   点击进入元数据编辑。
 * - 布局只在 structure / sandbox 加载（sketch 档父级不渲染本组件）。
 */

import { motion } from 'framer-motion';
import { GitMerge, Plus } from 'lucide-react';

import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { kindLabelOf, type ModuleConfig } from '../../shared/moduleConfig';
import { viewSpring } from '../../shared/motion';
import {
  RACE_KINDS,
  canOwnSubrace,
  relationKindDef,
  raceRelationKinds,
  type LineageCrossEdge,
  type LineageModel,
  type RaceNode,
} from '../types';
import { toneColor } from './toneColor';

export interface LineageTreeRefs {
  resolveName: (ref?: EntityRef | null) => string;
}

export interface LineageTreeProps {
  lineage: LineageModel;
  config: ModuleConfig;
  refs: LineageTreeRefs;
  selectedId?: string | null;
  onSelect: (nodeId: string) => void;
  onEditEdge: (link: WorldLink) => void;
  onAddRelation?: () => void;
  onAddSubrace?: (parentId: string) => void;
}

const LINE_STYLE_CLASS: Record<string, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  double: 'border-double border-t-4',
};

const LineageNode = ({
  node,
  config,
  selected,
  onSelect,
  onAddSubrace,
}: {
  node: RaceNode;
  config: ModuleConfig;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onAddSubrace?: (parentId: string) => void;
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <motion.button
      type="button"
      data-testid="lineage-node"
      data-node-id={node.id}
      data-kind={node.kind}
      aria-pressed={selected}
      onClick={() => onSelect(node.id)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={viewSpring}
      className={`min-w-[160px] max-w-[220px] truncate rounded-xl border px-3.5 py-2 text-sm font-medium shadow-sm transition-all duration-300 motion-reduce:transition-none ${
        selected
          ? 'border-teal-500 bg-teal-500/10 text-foreground ring-1 ring-teal-500/40'
          : 'border-border/50 bg-card/50 text-foreground hover:border-teal-500/30 hover:shadow-lg'
      }`}
    >
      {node.name}
      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
        {kindLabelOf(config, node.kind, RACE_KINDS)}
      </span>
    </motion.button>
    {onAddSubrace && canOwnSubrace(config, node.kind, RACE_KINDS) && (
      <button
        type="button"
        onClick={() => onAddSubrace(node.id)}
        className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        支系
      </button>
    )}
  </div>
);

export const LineageTree = ({
  lineage,
  config,
  refs,
  selectedId,
  onSelect,
  onEditEdge,
  onAddRelation,
  onAddSubrace,
}: LineageTreeProps) => {
  const relationKinds = raceRelationKinds(config);

  // 建边已在 buildLineage 按「无序端点对 + link_type」去重：对称关联两行只画一条（Phase 3 修复）
  const edges: LineageCrossEdge[] = lineage.crossEdges;

  return (
    <div className="space-y-4" data-testid="lineage-tree">
      <div className="space-y-4">
        {lineage.roots.map((root) => (
          <div
            key={root.id}
            className="flex flex-col items-center"
            data-testid="lineage-branch"
            data-root-id={root.id}
          >
            <LineageNode
              node={root}
              config={config}
              selected={root.id === selectedId}
              onSelect={onSelect}
              onAddSubrace={onAddSubrace}
            />
            {root.children.length > 0 ? (
              <>
                {/* parent_id 实线（层级） */}
                <span className="h-4 w-px bg-border" aria-hidden="true" />
                <div className="flex flex-col items-center">
                  <span className="h-px w-3/4 max-w-md bg-border" aria-hidden="true" />
                  <div className="flex flex-wrap items-start justify-center gap-4">
                    {root.children.map((child) => (
                      <div key={child.id} className="flex flex-col items-center">
                        <span className="h-4 w-px bg-border" aria-hidden="true" />
                        <LineageNode
                          node={child}
                          config={config}
                          selected={child.id === selectedId}
                          onSelect={onSelect}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <span className="pt-1.5 text-xs text-muted-foreground/60">还没有支系</span>
            )}
          </div>
        ))}
      </div>

      <div
        className="space-y-3 rounded-xl border border-border/40 bg-card/30 p-4"
        data-testid="lineage-edges"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
          跨族关系
          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px]">{edges.length}</span>
          {onAddRelation && (
            <button
              type="button"
              onClick={onAddRelation}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              建立关系
            </button>
          )}
        </div>
        {edges.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground">
            还没有跨族关系
          </div>
        ) : (
          <div className="space-y-1.5">
            {edges.map((edge) => {
              const def = relationKindDef(edge.relationKind, relationKinds);
              return (
                <button
                  key={edge.link.id}
                  type="button"
                  data-testid="lineage-edge"
                  data-edge-id={edge.link.id}
                  data-relation-kind={edge.relationKind}
                  onClick={() => onEditEdge(edge.link)}
                  aria-label={`编辑关系 ${def.label}`}
                  className="flex w-full items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-all duration-200 hover:border-border/70 hover:bg-accent/10"
                >
                  <span className="min-w-0 max-w-[35%] truncate text-foreground">
                    {refs.resolveName(edge.link.source)}
                  </span>
                  <span
                    className={`h-0 w-10 shrink-0 border-t-2 ${
                      LINE_STYLE_CLASS[def.lineStyle ?? 'solid'] ?? 'border-solid'
                    }`}
                    style={{ borderColor: toneColor(def.color) }}
                    aria-hidden="true"
                  />
                  <span className="shrink-0" style={{ color: toneColor(def.color) }}>
                    {def.label}
                  </span>
                  <span className="min-w-0 max-w-[35%] truncate text-foreground">
                    {refs.resolveName(edge.link.target)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="pt-0.5 text-xs text-muted-foreground/70">
          图例：实线 = 父子层级；双线 = 血缘 / 渊源；虚线 = 敌对 / 其他关系语义
        </div>
      </div>
    </div>
  );
};
