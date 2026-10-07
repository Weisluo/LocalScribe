/**
 * 迁移容器中的单条旧关联（Phase 2 P2-T13）
 *
 * 行内展示：meta.legacySourceName/legacyTargetName + 端点解析后的实体名与 kind 徽章。
 * 端点失效的行按失效 chip 展示、不阻塞归位，并给出清理动作；
 * 冲突行（目标世界已有等价边）给出「改用已有边并删除容器边」。
 */

import { ArrowRight, Loader2, MoveRight, Trash2 } from 'lucide-react';

import { EntityBadge } from '@/components/common/EntityBadge';
import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { kindLabel } from '../types';
import { shortRefId } from '../hooks/useEntityRefs';
import { readMigrationMeta } from './utils';
import type { IndexedEntity } from './useProjectEntityIndex';

export interface MigrationLinkRowProps {
  link: WorldLink;
  selected: boolean;
  onToggleSelect: (linkId: string) => void;
  /** 目标世界已有等价边（单条 409 或批量 conflicts 返回） */
  conflict: boolean;
  sourceEntry?: IndexedEntity;
  targetEntry?: IndexedEntity;
  isMoving: boolean;
  onMove: (linkId: string) => void;
  /** 删除容器边：清理失效端点，或冲突时改用已有边 */
  onDelete: (linkId: string) => void;
  onNavigate?: (ref: EntityRef) => void;
}

export const MigrationLinkRow = ({
  link,
  selected,
  onToggleSelect,
  conflict,
  sourceEntry,
  targetEntry,
  isMoving,
  onMove,
  onDelete,
  onNavigate,
}: MigrationLinkRowProps) => {
  const info = readMigrationMeta(link);
  const sourceInvalid = !sourceEntry;
  const targetInvalid = !targetEntry;

  const sourceName =
    info.legacySourceName ?? sourceEntry?.name ?? shortRefId(link.source.id);
  const targetName =
    info.legacyTargetName ?? targetEntry?.name ?? shortRefId(link.target.id);

  // 目标世界提示：默认按端点自动归位，端点分属不同世界时需显式指定
  const sourceWorldId = sourceEntry?.worldId;
  const targetWorldId = targetEntry?.worldId;
  const splitWorlds = !!sourceWorldId && !!targetWorldId && sourceWorldId !== targetWorldId;
  const derivedWorldName =
    !splitWorlds && sourceWorldId ? sourceEntry?.worldName ?? '' : '';

  return (
    <div className="flex items-start gap-3 border-b border-border/30 px-6 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-accent/5">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(link.id)}
        className="mt-1 h-4 w-4 rounded border-border accent-primary"
        title="选择该关联参与批量归位"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-semibold text-foreground">{sourceName}</span>
          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold text-foreground">{targetName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <EntityBadge
            entityRef={link.source}
            name={sourceEntry?.name}
            invalid={sourceInvalid}
            onClick={onNavigate}
          />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <EntityBadge
            entityRef={link.target}
            name={targetEntry?.name}
            invalid={targetInvalid}
            onClick={onNavigate}
          />
          <span className="rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            {link.link_type}
          </span>
          {info.strength && (
            <span className="rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              强度 {info.strength}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {sourceInvalid || targetInvalid ? (
            <span className="text-destructive">
              端点已失效：归位不受阻，可清理容器边
            </span>
          ) : splitWorlds ? (
            <span className="text-amber-600 dark:text-amber-400">
              端点分属不同世界（{sourceEntry?.worldName || kindLabel(link.source.kind)} /{' '}
              {targetEntry?.worldName || kindLabel(link.target.kind)}），需在顶部指定目标世界
            </span>
          ) : derivedWorldName ? (
            <span>按端点自动归位到「{derivedWorldName}」</span>
          ) : (
            <span>按端点自动归位</span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => onMove(link.id)}
          disabled={isMoving}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
          title="按端点自动归位到端点所属世界"
        >
          {isMoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MoveRight className="h-3.5 w-3.5" />
          )}
          归位
        </button>

        {conflict && (
          <button
            type="button"
            onClick={() => onDelete(link.id)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-500/20 dark:text-amber-300"
            title="目标世界已有等价边：删除容器边并保留已有边"
          >
            <Trash2 className="h-3.5 w-3.5" />
            改用已有边并删除容器边
          </button>
        )}

        {!conflict && (sourceInvalid || targetInvalid) && (
          <button
            type="button"
            onClick={() => onDelete(link.id)}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            title="删除这条端点已失效的容器边"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清理
          </button>
        )}
      </div>
    </div>
  );
};
