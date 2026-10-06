/**
 * 血缘降级列表 LineageFallback（Phase 3 P3-T3；races_ui_design §4.3/§11）
 *
 * 节点数超过 RACE_LINEAGE_LIMIT（80）时不画树，改「按主条目分组的列表 + 关系列」：
 * 主条目一行，其下逐行列出支系；每行显示名称、kind、支系数与跨族关系数。
 */

import { Link2, Network } from 'lucide-react';

import { kindLabelOf, type ModuleConfig } from '../../shared/moduleConfig';
import { RACE_KINDS, RACE_LINEAGE_LIMIT, canOwnSubrace, type LineageModel } from '../types';

export interface LineageFallbackProps {
  lineage: LineageModel;
  config: ModuleConfig;
  selectedId?: string | null;
  onSelect: (nodeId: string) => void;
  onAddSubrace?: (parentId: string) => void;
}

export const LineageFallback = ({
  lineage,
  config,
  selectedId,
  onSelect,
  onAddSubrace,
}: LineageFallbackProps) => {
  /** 每个节点参与的跨族关系数（对称边两端各计一次，与实际可见边数一致） */
  const relationCounts = new Map<string, number>();
  for (const edge of lineage.crossEdges) {
    relationCounts.set(edge.sourceId, (relationCounts.get(edge.sourceId) ?? 0) + 1);
    relationCounts.set(edge.targetId, (relationCounts.get(edge.targetId) ?? 0) + 1);
  }

  const row = (
    id: string,
    name: string,
    kind: string,
    subraceCount: number,
    indent: boolean
  ) => (
    <button
      key={id}
      type="button"
      data-testid={indent ? 'lineage-fallback-child' : 'lineage-fallback-row'}
      data-node-id={id}
      data-kind={kind}
      aria-pressed={id === selectedId}
      onClick={() => onSelect(id)}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-[11px] transition-colors motion-reduce:transition-none ${
        id === selectedId
          ? 'border-primary bg-primary/10'
          : 'border-border/40 hover:bg-accent/30'
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      <span className="shrink-0 rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground">
        {kindLabelOf(config, kind, RACE_KINDS)}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">支系 {subraceCount}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
        <Link2 className="h-3 w-3" aria-hidden="true" />
        {relationCounts.get(id) ?? 0}
      </span>
    </button>
  );

  return (
    <div className="space-y-3" data-testid="lineage-fallback">
      <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
        <Network className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        节点 {lineage.nodeCount} 个，超过 {RACE_LINEAGE_LIMIT} 个不再画树，改为按主条目分组的列表。
      </div>
      {lineage.roots.map((root) => (
        <div key={root.id} className="space-y-1">
          {row(root.id, root.name, root.kind, root.children.length, false)}
          {root.children.length > 0 && (
            <div className="ml-3 space-y-1 border-l border-border/40 pl-2">
              {root.children.map((child) =>
                row(child.id, child.name, child.kind, child.children.length, true)
              )}
            </div>
          )}
          {/* 只有第一层 kind 能挂支系：与详情页同一判据，避免造出第三层（§2 / §12.3） */}
          {onAddSubrace &&
            root.children.length === 0 &&
            canOwnSubrace(config, root.kind, RACE_KINDS) && (
              <button
                type="button"
                onClick={() => onAddSubrace(root.id)}
                className="ml-3 text-[10px] text-muted-foreground transition-colors hover:text-primary"
              >
                还没有支系，添加支系
              </button>
            )}
        </div>
      ))}
    </div>
  );
};
