/**
 * LinkPanel（Phase 2 P2-T4，接口冻结见 phase2_interface_freeze.md §3.4）
 *
 * 结构（契约 §5.1）：顶部「关联 / 出链 n / 入链 n」；按对端模块分组，组内按 link_type 排序。
 * 出链可改可删，入链只读（可跳转到源实体）；失效引用渲染警示 chip 并给出一键清理。
 * 添加关联走 EntityPicker：sketch 档（无 linkPicker 能力）自动降为 simpleMode。
 * 自身请求：useEntityLinks + useLinkRegistry + useEntityRefs；计数直接用分组长度，不额外请求。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import type { WorldLink, WorldLinkCreate } from '@/services/worldbuildingApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import {
  COMPLEXITY_CAPABILITIES,
  useComplexity,
} from '@/components/common/ComplexitySwitcher';
import {
  toRegistryMap,
  useCreateWorldLinks,
  useDeleteWorldLink,
  useEntityRefs,
  useLinkRegistry,
  useUpdateWorldLink,
  useWorld,
  useWorldLinks,
} from '@/components/Worldbuilding/hooks';
import {
  INVALID_BADGE_CLASS,
  groupLinksByModule,
  kindLabel,
  linkCounterpart,
  linkDisplayLabel,
  moduleBadgeClass,
  moduleLabel,
  splitLinks,
} from '@/components/Worldbuilding/types';
import type { LinkPanelProps } from './types';

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

export const LinkPanel = ({
  worldId,
  entity,
  complexity,
  onNavigate,
  title = '关联',
  defaultCollapsed,
  className = '',
}: LinkPanelProps) => {
  const complexityContext = useComplexity();
  const level = complexity ?? complexityContext.level;
  const capabilities = COMPLEXITY_CAPABILITIES[level];

  // 角色的解析需要 projectId：由 world 查询派生（与 useEntityRefs 内部同一 queryKey，不额外发请求）
  const worldQuery = useWorld(worldId, { includeItems: true });
  const entityRefs = useEntityRefs(worldId, worldQuery.data?.project_id ?? undefined);
  const registryQuery = useLinkRegistry();
  const registry = useMemo(() => toRegistryMap(registryQuery.data), [registryQuery.data]);

  // sketch 档缺省收起：只暴露关联计数，展开仍可查看（冻结 §5.5「只控制披露」）
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | undefined>(
    defaultCollapsed
  );
  const collapsed = collapsedOverride ?? !capabilities.linkPanel;
  const showBody = !collapsed;

  useEffect(() => {
    setCollapsedOverride(defaultCollapsed);
  }, [defaultCollapsed]);

  // 关联数据取世界级共享列表后本地分流：整个世界一次请求，避免逐卡请求（phase2 §6）
  const linksQuery = useWorldLinks(worldId);
  const worldLinks = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const { outgoing, incoming } = useMemo(
    () => splitLinks(worldLinks, entity),
    [worldLinks, entity]
  );
  const linksLoading = linksQuery.isLoading;
  const isError = linksQuery.isError;

  const createLinks = useCreateWorldLinks(worldId);
  const updateLink = useUpdateWorldLink(worldId);
  const deleteLink = useDeleteWorldLink(worldId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ label: '', note: '', start: '', end: '' });

  const canAdd = capabilities.linkPicker || capabilities.simpleLinkAdd;

  const existingCounterparts = useMemo(
    () => [
      ...outgoing.map((link) => link.target),
      ...incoming.map((link) => link.source),
    ],
    [outgoing, incoming]
  );

  const startEdit = (link: WorldLink) => {
    setEditingId(link.id);
    setDraft({
      label: link.label ?? '',
      note: link.note ?? '',
      start: link.time?.start ?? '',
      end: link.time?.end ?? '',
    });
  };

  const saveEdit = (linkId: string) => {
    const hasTime = !!draft.start.trim() || !!draft.end.trim();
    updateLink.mutate({
      linkId,
      data: {
        label: draft.label.trim() || null,
        note: draft.note.trim() || null,
        time: hasTime
          ? { start: draft.start.trim() || null, end: draft.end.trim() || null }
          : null,
      },
    });
    setEditingId(null);
  };

  const handleConfirm = async (selection: EntityPickerSelection) => {
    const items: WorldLinkCreate[] = selection.targets.map((target) => ({
      source: entity,
      target,
      link_type: selection.linkType,
      label: selection.label,
      note: selection.note,
      time: selection.time,
    }));
    try {
      const result = await createLinks.mutateAsync(items);
      // 部分失败时保留选择器便于重试；失败提示由 hook 统一 toast
      if (result.failed.length === 0) setPickerOpen(false);
    } catch {
      // 意外异常同样保留选择器
    }
  };

  const renderRow = (link: WorldLink, editable: boolean) => {
    const counterpart = linkCounterpart(link, entity);
    // 实体索引未就绪时不判失效，避免把有效对端渲染成「已失效」并给出删除入口
    const invalid = !entityRefs.isLoading && entityRefs.isInvalid(counterpart);
    const typeLabel = linkDisplayLabel(link, entity, registry);
    const timeText = [link.time?.start, link.time?.end].filter(Boolean).join(' ~ ');

    return (
      <div key={link.id}>
        <div className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30">
          <span className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
            {typeLabel}
          </span>
          {invalid ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${INVALID_BADGE_CLASS}`}
              title={`${moduleLabel(counterpart.module)} · ${kindLabel(counterpart.kind)} · 目标已不存在`}
            >
              <AlertTriangle className="h-3 w-3" />
              {entityRefs.resolveName(counterpart)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate?.(counterpart)}
              disabled={!onNavigate}
              title={onNavigate ? '跳转到该实体' : undefined}
              className="min-w-0 truncate text-left text-xs text-foreground transition-colors enabled:hover:text-primary disabled:cursor-default"
            >
              {entityRefs.resolveName(counterpart)}
            </button>
          )}
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${moduleBadgeClass(counterpart.module)}`}
          >
            {kindLabel(counterpart.kind)}
          </span>
          {timeText && (
            <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">{timeText}</span>
          )}
          {link.note && (
            <span className="min-w-0 truncate pt-0.5 text-[10px] text-muted-foreground">
              {link.note}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {editable && (
              <button
                type="button"
                onClick={() => startEdit(link)}
                title="编辑关联"
                aria-label="编辑关联"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {/* 失效引用的一键清理对两个方向都开放（契约 §2.5），入链的语义字段仍只读 */}
            {(editable || invalid) && (
              <button
                type="button"
                onClick={() => deleteLink.mutate(link.id)}
                title={invalid ? '清理失效关联' : '删除关联'}
                aria-label={invalid ? '清理失效关联' : '删除关联'}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {editingId === link.id && (
          <div className="mt-1 space-y-1.5 rounded-md border border-border/50 bg-muted/20 p-2">
            <input
              type="text"
              value={draft.label}
              onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="标签"
              className={FIELD_CLASS}
            />
            <textarea
              value={draft.note}
              onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="备注"
              rows={2}
              className={FIELD_CLASS}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={draft.start}
                onChange={(event) => setDraft((prev) => ({ ...prev, start: event.target.value }))}
                placeholder="起始"
                className={FIELD_CLASS}
              />
              <input
                type="text"
                value={draft.end}
                onChange={(event) => setDraft((prev) => ({ ...prev, end: event.target.value }))}
                placeholder="结束"
                className={FIELD_CLASS}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => saveEdit(link.id)}
                disabled={updateLink.isPending}
                className="rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (label: string, sectionLinks: WorldLink[], editable: boolean) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 text-[11px] font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="rounded-full bg-muted/40 px-1.5 text-[10px]">
          {sectionLinks.length}
        </span>
      </div>
      {sectionLinks.length === 0 ? (
        <div className="px-2 text-[11px] text-muted-foreground">无</div>
      ) : (
        groupLinksByModule(sectionLinks, entity).map((group) => (
          <div key={`${label}-${group.module}`} className="space-y-0.5">
            <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {moduleLabel(group.module)}
            </div>
            {group.links.map((link) => renderRow(link, editable))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={`rounded-lg border border-border/50 bg-card/40 ${className}`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsedOverride(!collapsed)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-primary"
        >
          {showBody ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {!showBody && <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
          {title}
        </button>
        <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          出链 {outgoing.length}
        </span>
        <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          入链 {incoming.length}
        </span>
        {canAdd && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" />
            添加关联
          </button>
        )}
      </div>

      {showBody && (
        <div className="space-y-3 border-t border-border/40 px-1.5 py-2">
          {linksLoading || entityRefs.isLoading ? (
            <div className="flex items-center justify-center py-3 text-[11px] text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              加载中...
            </div>
          ) : isError ? (
            <div className="px-2 py-1 text-[11px] text-destructive">关联加载失败</div>
          ) : outgoing.length === 0 && incoming.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">暂无关联</div>
          ) : (
            <>
              {renderSection('出链', outgoing, true)}
              {renderSection('入链', incoming, false)}
            </>
          )}
        </div>
      )}

      <EntityPicker
        open={pickerOpen}
        worldId={worldId}
        source={entity}
        multi
        simpleMode={!capabilities.linkPicker}
        excludeRefs={existingCounterparts}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleConfirm}
        isSubmitting={createLinks.isPending}
      />
    </div>
  );
};
