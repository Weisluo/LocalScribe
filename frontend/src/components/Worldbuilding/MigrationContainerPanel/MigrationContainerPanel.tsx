/**
 * 迁移容器归位面板（Phase 2 P2-T13，props 见 phase2_interface_freeze.md §5）
 *
 * 入口由 WorldbuildingView 按 useMigrationLinks().hasEntryPoint 控制，
 * 面板本身只负责：分组展示容器边、单条/批量归位、冲突改用已有边、失效端点清理、
 * 归零后删除空容器。归位的缓存失效统一在 hooks/useMigrationLinks.ts 完成。
 */

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GitBranch, Info, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { viewSpring } from '../shared/motion';

import type { EntityRef } from '@/services/worldbuildingApi';
import { useDeleteWorld, useWorlds } from '../hooks/useWorldData';
import { useDeleteWorldLink, useWorldLinks } from '../hooks/useLinks';
import {
  moveErrorInfo,
  useMoveWorldLink,
  useMoveWorldLinks,
} from '../hooks/useMigrationLinks';
import { MigrationLinkRow } from './MigrationLinkRow';
import { groupMigrationLinks } from './utils';
import { useProjectEntityIndex } from './useProjectEntityIndex';

export interface MigrationContainerPanelProps {
  /** 容器世界 id */
  worldId: string;
  projectId: string;
  onNavigate?: (ref: EntityRef) => void;
  /** 归位完成或用户收起面板时回调（失效缓存/收起面板） */
  onResolved?: () => void;
}

export const MigrationContainerPanel = ({
  worldId,
  projectId,
  onNavigate,
  onResolved,
}: MigrationContainerPanelProps) => {
  const worldsQuery = useWorlds(projectId);
  const worlds = useMemo(() => worldsQuery.data ?? [], [worldsQuery.data]);
  const containerWorld = worlds.find((world) => world.id === worldId);
  const targetWorlds = useMemo(
    () => worlds.filter((world) => world.id !== worldId),
    [worlds, worldId]
  );
  const targetWorldIds = useMemo(
    () => targetWorlds.map((world) => world.id),
    [targetWorlds]
  );

  const linksQuery = useWorldLinks(worldId);
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const entityIndex = useProjectEntityIndex(targetWorldIds, projectId);

  const moveOne = useMoveWorldLink();
  const moveMany = useMoveWorldLinks();
  const deleteLink = useDeleteWorldLink(worldId);
  const deleteWorld = useDeleteWorld();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [explicitTargetId, setExplicitTargetId] = useState('');
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const groups = useMemo(() => groupMigrationLinks(links), [links]);
  const allSelected = links.length > 0 && selectedIds.length === links.length;
  // 容器内列表就是面板的权威数据源；归位/清理后列表为空即可删除空容器
  const isEmpty = !linksQuery.isLoading && !linksQuery.isError && links.length === 0;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onResolved?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onResolved]);

  const handleToggleSelect = (linkId: string) => {
    setSelectedIds((ids) =>
      ids.includes(linkId) ? ids.filter((id) => id !== linkId) : [...ids, linkId]
    );
  };

  const handleToggleAll = () => {
    setSelectedIds(allSelected ? [] : links.map((link) => link.id));
  };

  const handleMoveOne = (linkId: string) => {
    setActiveLinkId(linkId);
    moveOne
      .mutateAsync({
        linkId,
        targetWorldId: explicitTargetId || undefined,
        containerWorldId: worldId,
      })
      .catch((error: unknown) => {
        const info = moveErrorInfo(error);
        // 两种 409 处置完全不同：只有「已有等价边」才有替代边可改用
        if (info.code === 'duplicate_link') {
          setConflictIds((ids) => (ids.includes(linkId) ? ids : [...ids, linkId]));
          toast.info('目标世界已有等价边，可改用已有边并删除容器边');
          return;
        }
        if (info.status === 409) {
          // 端点分属不同世界：没有替代边，绝不能给出删除动作
          toast.info('该关联两端分属不同世界，请在顶部指定目标世界后再归位');
          return;
        }
        // 其余错误已由 useMoveWorldLink.onError 统一提示
      })
      .finally(() => setActiveLinkId(null));
  };

  const handleBatchMove = () => {
    if (selectedIds.length === 0) return;
    moveMany
      .mutateAsync({
        worldId,
        linkIds: selectedIds,
        targetWorldId: explicitTargetId || undefined,
      })
      .then((result) => {
        setSelectedIds([]);
        const duplicates = result.conflicts.filter(
          (item) => item.code === 'duplicate_link'
        );
        if (duplicates.length > 0) {
          const conflicted = duplicates.map((item) => item.link_id);
          setConflictIds((ids) => [...new Set([...ids, ...conflicted])]);
        }
        if (result.moved > 0) {
          toast.success(`已归位 ${result.moved} 条关联`);
        }
        if (duplicates.length > 0) {
          toast.info(
            `${duplicates.length} 条目标世界已有等价边，可改用已有边并删除容器边`
          );
        }
        // invalid 按后端 code 分类提示，避免把「需指定目标世界」误报成「端点已失效」
        const byCode = (code: string) =>
          result.invalid.filter((item) => item.code === code);
        const needTarget = byCode('endpoint_world_conflict');
        const broken = [
          ...byCode('unresolvable_endpoint'),
          ...byCode('character_world_ambiguous'),
        ];
        const foreign = byCode('not_in_world');
        const already = byCode('already_in_target');
        const handled = [
          'endpoint_world_conflict',
          'unresolvable_endpoint',
          'character_world_ambiguous',
          'not_in_world',
          'already_in_target',
        ];
        // 后端新增 code 时不能让失败项静默消失：未知 code 统一兜底提示
        const other = result.invalid.filter((item) => !handled.includes(item.code));
        if (needTarget.length > 0) {
          toast.info(`${needTarget.length} 条需在顶部指定目标世界`);
        }
        if (already.length > 0) {
          toast.info(`${already.length} 条已位于目标世界，已跳过`);
        }
        if (foreign.length > 0) {
          toast.warning(`${foreign.length} 条不属于该世界，已跳过`);
        }
        if (broken.length > 0) {
          toast.warning(
            `${broken.length} 条端点已失效或无唯一世界归属，可清理容器边`
          );
        }
        if (other.length > 0) {
          toast.warning(`${other.length} 条未能归位：${other[0].reason || other[0].code}`);
        }
      })
      .catch(() => undefined);
  };

  // 去掉一条容器边后，世界列表里的 link_count 与容器入口条件都要重新求值
  const handleDeleteLink = (linkId: string) => {
    deleteLink.mutate(linkId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
        queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'migration-container'] });
      },
    });
  };

  const handleDeleteContainer = () => {
    deleteWorld.mutate(worldId, {
      onSuccess: () => onResolved?.(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={() => onResolved?.()}
      />
      <motion.aside
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={viewSpring}
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border/50 bg-background shadow-lg"
      >
        <header className="flex items-start justify-between border-b border-border/30 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              关联归位
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {containerWorld?.name ?? '关联迁移容器'} · 待归位 {links.length} 条
            </p>
          </div>
          <button
            type="button"
            onClick={() => onResolved?.()}
            className="rounded-lg border border-transparent p-1.5 text-muted-foreground transition-all duration-200 hover:border-border/50 hover:bg-muted/40 hover:text-foreground"
            title="收起面板"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 border-b border-border/30 px-6 py-4">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="migration-target-world">
            目标世界
          </label>
          <select
            id="migration-target-world"
            value={explicitTargetId}
            onChange={(event) => setExplicitTargetId(event.target.value)}
            className="w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm transition-all duration-200 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">按端点自动归位（默认，省略 target_world_id）</option>
            {targetWorlds.map((world) => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAll}
              disabled={links.length === 0}
              className="rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
            <button
              type="button"
              onClick={handleBatchMove}
              disabled={selectedIds.length === 0 || moveMany.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
            >
              {moveMany.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4" />
              )}
              批量归位（{selectedIds.length}）
            </button>
          </div>
          {entityIndex.isLoading && links.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在解析端点实体…
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {linksQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-border/40 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5">
                <Info className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium text-foreground">容器内已无待归位关联</p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-card/60 px-6 py-2 text-xs text-muted-foreground backdrop-blur-md">
                  <span className="font-medium">
                    {group.legacyRelationType ?? '未标注类型'} · 强度{' '}
                    {group.strength ?? '未标注'}
                  </span>
                  <span>{group.links.length} 条</span>
                </div>
                {group.links.map((link) => (
                  <MigrationLinkRow
                    key={link.id}
                    link={link}
                    selected={selectedIds.includes(link.id)}
                    onToggleSelect={handleToggleSelect}
                    conflict={conflictIds.includes(link.id)}
                    sourceEntry={entityIndex.lookup(link.source)}
                    targetEntry={entityIndex.lookup(link.target)}
                    isMoving={activeLinkId === link.id}
                    onMove={handleMoveOne}
                    onDelete={handleDeleteLink}
                    onNavigate={onNavigate}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        {isEmpty && (
          <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
            <span className="text-xs text-muted-foreground">
              容器已无待归位关联，可以删除空容器
            </span>
            <button
              type="button"
              onClick={handleDeleteContainer}
              disabled={deleteWorld.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-1.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-all duration-200 hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleteWorld.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              删除空容器
            </button>
          </div>
        )}
      </motion.aside>
    </div>
  );
};
