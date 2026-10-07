/**
 * SubmoduleManager（Phase 6 P6-T3；worldbuilding_ui_design §4.2、契约 §2.3 / §2.7）
 *
 * 一个模块的子模块（实体）树管理：缩进表示层级，行内显示名称、kind、图标、颜色、条目数、关联数。
 * 支持新建 / 重命名 / 描述 / 图标（Lucide 名）/ 颜色（色板）/ kind 绑定 / 父级调整 / 拖拽排序 /
 * 删除（先给影响范围，再选级联删除或子级上移）。
 *
 * 口径：
 * - 层级只用 parent_id（契约 §2.3），拖拽只调整同级顺序，跨级用「父级」下拉；
 * - 推荐 kind 只是可选快捷项，绝不自动创建任何内容；
 * - 删除影响统计来自传入的 items 与 linkCounts；级联删除由后端负责，前端只提示；
 * - 图标一律存 Lucide kebab-case 名，界面渲染走 lucideIcon，不出现 emoji。
 */

import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderTree,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/components/Modals/Modal';
import {
  worldbuildingApi,
  type ModuleItemV2,
  type SubmoduleV2,
} from '@/services/worldbuildingApi';
import {
  kindDefsOf,
  terminologyOf,
  type EntityTypeDef,
  type ModuleConfig,
} from '../shared/moduleConfig';
import { lucideIcon } from '../shared/lucideIcon';

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

/** 图标选择器的候选项：全部为 lucide-react 真实导出（kebab-case） */
export const SUBMODULE_ICON_CHOICES: string[] = [
  'landmark',
  'crown',
  'users',
  'swords',
  'scroll-text',
  'factory',
  'store',
  'coins',
  'map-pin',
  'globe',
  'building-2',
  'package',
  'gem',
  'flame',
  'book-open',
  'flag',
  'handshake',
  'key-round',
  'wheat',
  'sprout',
  'sparkles',
  'shield',
  'route',
  'truck',
  'gavel',
  'pen-line',
  'calendar-range',
  'git-branch',
  'link-2',
  'shapes',
  'layers',
  'network',
  'target',
  'compass',
  'mountain',
  'briefcase',
  'heart-handshake',
  'chevrons-up',
  'arrow-up-right',
];

/** 颜色候选：色板只提供色块，不用 emoji 色块（契约 §6.3） */
export const SUBMODULE_PALETTE: string[] = [
  '#64748b',
  '#b45309',
  '#b91c1c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#0369a1',
  '#4338ca',
  '#7c3aed',
  '#be185d',
  '#4b5563',
  '#a8a29e',
];

// ---------- 纯函数（可单测） ----------

/** 同级子模块（parent_id 相同），按 order_index 排序 */
export const submoduleSiblings = (
  submodules: SubmoduleV2[],
  parentId: string | null
): SubmoduleV2[] =>
  submodules
    .filter((item) => (item.parent_id ?? null) === parentId)
    .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));

export interface SubmoduleRow {
  submodule: SubmoduleV2;
  depth: number;
}

/** 深度优先展开成带缩进的扁平行；parent_id 指向不存在节点的孤儿也展示（不静默丢数据） */
export const submoduleRows = (submodules: SubmoduleV2[]): SubmoduleRow[] => {
  const rows: SubmoduleRow[] = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    for (const child of submoduleSiblings(submodules, parentId)) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      rows.push({ submodule: child, depth });
      if (depth < 32) visit(child.id, depth + 1);
    }
  };
  visit(null, 0);
  for (const item of submodules) {
    if (!visited.has(item.id)) rows.push({ submodule: item, depth: 0 });
  }
  return rows;
};

/** 节点深度（根 = 1）；环路时提前退出，不抛错 */
export const submoduleDepth = (submodules: SubmoduleV2[], id: string): number => {
  const byId = new Map(submodules.map((item) => [item.id, item]));
  let depth = 1;
  let cursor = byId.get(id)?.parent_id ?? null;
  const visited = new Set<string>([id]);
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    depth += 1;
    cursor = byId.get(cursor)?.parent_id ?? null;
    if (depth > 32) break;
  }
  return depth;
};

/** 全部后代 id（不含自身） */
export const submoduleDescendantIds = (
  submodules: SubmoduleV2[],
  id: string
): string[] => {
  const result: string[] = [];
  const queue = submoduleSiblings(submodules, id).map((item) => item.id);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (result.includes(current)) continue;
    result.push(current);
    queue.push(...submoduleSiblings(submodules, current).map((item) => item.id));
  }
  return result;
};

/** 能否把 id 挂到 parentId 之下：不能挂到自己或自己的后代（避免环） */
export const canReparentSubmodule = (
  submodules: SubmoduleV2[],
  id: string,
  parentId: string | null
): boolean => {
  if (parentId === null) return true;
  if (parentId === id) return false;
  if (!submodules.some((item) => item.id === parentId)) return false;
  return !submoduleDescendantIds(submodules, id).includes(parentId);
};

/** 挂到新父级：返回更新后的数组（不改原数组）；非法层级原样返回 */
export const reparentSubmodule = (
  submodules: SubmoduleV2[],
  id: string,
  parentId: string | null
): SubmoduleV2[] => {
  if (!canReparentSubmodule(submodules, id, parentId)) return submodules;
  const siblings = submoduleSiblings(submodules, parentId).filter((item) => item.id !== id);
  const nextOrder =
    siblings.length === 0
      ? 0
      : Math.max(...siblings.map((item) => item.order_index)) + 1;
  return submodules.map((item) =>
    item.id === id ? { ...item, parent_id: parentId, order_index: nextOrder } : item
  );
};

/** 同级重排：按 orderedIds 重写 order_index（0..n），返回新数组 */
export const reorderSubmodules = (
  submodules: SubmoduleV2[],
  parentId: string | null,
  orderedIds: string[]
): SubmoduleV2[] => {
  const siblings = submoduleSiblings(submodules, parentId);
  if (orderedIds.length !== siblings.length) return submodules;
  if (!siblings.every((item) => orderedIds.includes(item.id))) return submodules;
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  return submodules.map((item) =>
    position.has(item.id) ? { ...item, order_index: position.get(item.id) as number } : item
  );
};

/** 某子模块下的条目数（后端 item_count 与本地 items 取较大值，避免详情未带 items 时显示 0） */
export const submoduleItemCount = (items: ModuleItemV2[], submodule: SubmoduleV2): number =>
  Math.max(
    submodule.item_count ?? 0,
    items.filter((item) => (item.submodule_id ?? null) === submodule.id).length
  );

export interface SubmoduleDeleteImpact {
  id: string;
  name: string;
  parentId: string | null;
  /** 将被级联删除的后代 id（不含自身） */
  descendants: string[];
  /** 受影响的条目数（自身 + 后代挂载的条目） */
  items: number;
  /** 受影响的关联数（键为实体 id） */
  links: number;
}

export const submoduleDeleteImpact = (
  submodules: SubmoduleV2[],
  items: ModuleItemV2[],
  linkCounts: Map<string, number> | undefined,
  id: string
): SubmoduleDeleteImpact => {
  const target = submodules.find((item) => item.id === id);
  const affected = new Set<string>([id, ...submoduleDescendantIds(submodules, id)]);
  const affectedItems = items.filter((item) =>
    affected.has(item.submodule_id ?? '')
  ).length;
  let links = 0;
  for (const entityId of affected) links += linkCounts?.get(entityId) ?? 0;
  return {
    id,
    name: target?.name ?? id,
    parentId: target?.parent_id ?? null,
    descendants: submoduleDescendantIds(submodules, id),
    items: affectedItems,
    links,
  };
};

/** 「子级上移后删除」的写入计划：直接子级改挂到被删节点的父级，排在现有同级之后 */
export const moveChildrenPlan = (
  submodules: SubmoduleV2[],
  id: string
): { submoduleId: string; parentId: string | null; orderIndex: number }[] => {
  const target = submodules.find((item) => item.id === id);
  if (!target) return [];
  const parentId = target.parent_id ?? null;
  const existing = submoduleSiblings(submodules, parentId).filter((item) => item.id !== id);
  const base =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((item) => item.order_index)) + 1;
  return submoduleSiblings(submodules, id).map((child, index) => ({
    submoduleId: child.id,
    parentId,
    orderIndex: base + index,
  }));
};

// ---------- 组件 ----------

export interface SubmoduleManagerProps {
  open: boolean;
  onClose: () => void;
  worldId: string;
  moduleId: string;
  /** module_type: map|history|politics|economy|races|systems|special */
  moduleType: string;
  /** 已解析的模块配置（含 entityTypes / fieldSchema），用于 kind 候选与字段数统计 */
  config: ModuleConfig;
  /** 内置（推荐）kind 定义，来自各模块的 config.ts */
  builtins: EntityTypeDef[];
  /** 世界级术语，用于展示名替换 */
  worldTerminology?: Record<string, string> | null;
  /** 子模块数据（来自 useWorld 详情） */
  submodules: SubmoduleV2[];
  /** 该模块的条目，用于删除影响统计 */
  items?: ModuleItemV2[];
  /** 关联计数（useLinkCountMap），key 为实体 id */
  linkCounts?: Map<string, number>;
  /** 数据变更后请调用方失效查询 */
  onChanged?: () => void;
  /** 打开字段编辑器 */
  onManageFields?: (kindId: string) => void;
}

interface SubmoduleFormState {
  name: string;
  description: string;
  icon: string;
  color: string;
  kind: string;
}

const formFromSubmodule = (submodule: SubmoduleV2 | null, fallbackKind: string): SubmoduleFormState => ({
  name: submodule?.name ?? '',
  description: submodule?.description ?? '',
  icon: submodule?.icon ?? '',
  color: submodule?.color ?? '',
  kind: submodule?.kind ?? fallbackKind,
});

interface SortableRowProps {
  row: SubmoduleRow;
  selected: boolean;
  kindLabel: (kind?: string | null) => string;
  itemCount: number;
  linkCount: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onEdit: (submodule: SubmoduleV2) => void;
  onAddChild: (submodule: SubmoduleV2) => void;
  onDelete: (submodule: SubmoduleV2) => void;
  onManageFields?: (kindId: string) => void;
}

const SortableRow = ({
  row,
  selected,
  kindLabel,
  itemCount,
  linkCount,
  hasChildren,
  expanded,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onManageFields,
}: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.submodule.id,
  });
  const Icon = lucideIcon(row.submodule.icon ?? undefined);
  const kind = row.submodule.kind ?? '';
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${
        selected ? 'border-primary/60 bg-primary/5' : 'border-border/40'
      } ${isDragging ? 'opacity-60' : ''}`}
      data-testid="submodule-row"
      data-submodule-id={row.submodule.id}
      data-depth={row.depth}
    >
      <span style={{ width: row.depth * 14 }} aria-hidden="true" className="shrink-0" />
      <button
        type="button"
        aria-label="拖拽排序"
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? '折叠子级' : '展开子级'}
          onClick={() => onToggle(row.submodule.id)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" aria-hidden="true" />
      )}
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-border/60"
          aria-hidden="true"
        />
      )}
      <span className="truncate text-[11px] font-medium text-foreground">
        {row.submodule.name}
      </span>
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-border/60"
        style={{ backgroundColor: row.submodule.color ?? 'transparent' }}
        aria-hidden="true"
      />
      {kind && (
        <span className="shrink-0 rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground">
          {kindLabel(kind)}
        </span>
      )}
      <span className="shrink-0 text-[10px] text-muted-foreground" data-testid="submodule-count">
        条目 {itemCount} · 关联 {linkCount}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`新增子级 ${row.submodule.name}`}
          onClick={() => onAddChild(row.submodule)}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
        {onManageFields && kind && (
          <button
            type="button"
            aria-label={`管理字段 ${row.submodule.name}`}
            onClick={() => onManageFields(kind)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={`编辑 ${row.submodule.name}`}
          onClick={() => onEdit(row.submodule)}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`删除 ${row.submodule.name}`}
          onClick={() => onDelete(row.submodule)}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
};

export interface DeleteImpactPanelProps {
  impact: SubmoduleDeleteImpact;
  busy?: boolean;
  onCancel: () => void;
  onCascade: () => void;
  onMoveUp: () => void;
}

/** 删除影响提示：先给数量，再让用户选级联删除或子级上移（设计 §4.2） */
export const DeleteImpactPanel = ({
  impact,
  busy = false,
  onCancel,
  onCascade,
  onMoveUp,
}: DeleteImpactPanelProps) => (
  <div
    className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2"
    data-testid="submodule-delete-impact"
  >
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
      <AlertTriangle className="h-3.5 w-3.5" />
      删除「{impact.name}」将影响 {impact.descendants.length} 个子级、{impact.items} 个条目、
      {impact.links} 条关联
    </div>
    <p className="text-[10px] text-muted-foreground">
      级联删除会连同全部下级一起删除；子级上移会把直接子级挂到原父级下并保留内容。
    </p>
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      >
        取消
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onMoveUp}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent/30 disabled:opacity-50"
        data-testid="submodule-delete-move-up"
      >
        <Undo2 className="h-3.5 w-3.5" />
        子级上移后删除
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCascade}
        className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[11px] text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
        data-testid="submodule-delete-cascade"
      >
        <Trash2 className="h-3.5 w-3.5" />
        级联删除
      </button>
    </div>
  </div>
);

export const SubmoduleManagerPanel = ({
  onClose,
  worldId,
  moduleId,
  moduleType,
  config,
  builtins,
  worldTerminology,
  submodules,
  items,
  linkCounts,
  onChanged,
  onManageFields,
}: SubmoduleManagerProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  /** undefined = 未打开新建表单；null = 新建根节点；字符串 = 新建到该父级下 */
  const [createParent, setCreateParent] = useState<string | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [form, setForm] = useState<SubmoduleFormState>(() => formFromSubmodule(null, ''));

  const kinds = useMemo(() => kindDefsOf(config, builtins), [config, builtins]);
  const fallbackKind = kinds[0]?.id ?? '';
  const terminology = useMemo(
    () => terminologyOf(config, worldTerminology),
    [config, worldTerminology]
  );
  const kindLabel = (kind?: string | null) => {
    if (!kind) return '';
    if (terminology[kind]) return terminology[kind];
    return kinds.find((def) => def.id === kind)?.label ?? kind;
  };

  const allRows = submoduleRows(submodules);
  const rows = useMemo(
    () =>
      allRows.filter((row) => {
        // 折叠时隐藏整棵子树：逐级判断是否有被折叠的祖先
        let cursor = row.submodule.parent_id ?? null;
        while (cursor) {
          if (collapsed.has(cursor)) return false;
          cursor = submodules.find((item) => item.id === cursor)?.parent_id ?? null;
        }
        return true;
      }),
    [allRows, collapsed, submodules]
  );

  const childCountOf = (id: string) =>
    submodules.filter((item) => (item.parent_id ?? null) === id).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const impact = pendingDelete
    ? submoduleDeleteImpact(submodules, items ?? [], linkCounts, pendingDelete)
    : null;

  const resetForm = () => {
    setEditingId(null);
    setCreateParent(undefined);
    setError(null);
  };

  const openCreate = (parentId: string | null) => {
    setEditingId(null);
    setCreateParent(parentId);
    setForm(formFromSubmodule(null, fallbackKind));
    setError(null);
    setNotice(null);
  };

  const openEdit = (submodule: SubmoduleV2) => {
    setCreateParent(undefined);
    setEditingId(submodule.id);
    setForm(formFromSubmodule(submodule, fallbackKind));
    setError(null);
    setNotice(null);
  };

  const submitForm = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('名称不能为空');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        const current = submodules.find((item) => item.id === editingId);
        if (!current) return;
        const patch: Record<string, unknown> = {};
        if (name !== current.name) patch.name = name;
        if ((form.description || '') !== (current.description ?? '')) {
          patch.description = form.description || null;
        }
        if ((form.icon || '') !== (current.icon ?? '')) patch.icon = form.icon || null;
        if ((form.color || '') !== (current.color ?? '')) patch.color = form.color || null;
        if ((form.kind || '') !== (current.kind ?? '')) patch.kind = form.kind;
        if (Object.keys(patch).length > 0) {
          await worldbuildingApi.updateSubmodule(editingId, patch);
          onChanged?.();
        }
        toast.success('子模块已保存');
      } else {
        const parentId = createParent ?? null;
        const siblings = submoduleSiblings(submodules, parentId);
        const orderIndex =
          siblings.length === 0
            ? 0
            : Math.max(...siblings.map((item) => item.order_index)) + 1;
        await worldbuildingApi.createSubmodule(moduleId, {
          name,
          description: form.description || undefined,
          icon: form.icon || undefined,
          color: form.color || undefined,
          kind: form.kind || undefined,
          parent_id: parentId ?? undefined,
          order_index: orderIndex,
        });
        onChanged?.();
        toast.success('子模块已创建');
      }
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const changeParent = async (submodule: SubmoduleV2, parentId: string | null) => {
    if ((submodule.parent_id ?? null) === parentId) return;
    if (!canReparentSubmodule(submodules, submodule.id, parentId)) {
      setError('不能把子模块挂到自身或自己的后代之下');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = reparentSubmodule(submodules, submodule.id, parentId);
      const moved = next.find((item) => item.id === submodule.id);
      if (moved) {
        await worldbuildingApi.updateSubmodule(submodule.id, {
          parent_id: parentId,
          order_index: moved.order_index,
        });
        onChanged?.();
      }
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : '调整层级失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeItem = submodules.find((item) => item.id === active.id);
    const overItem = submodules.find((item) => item.id === over.id);
    if (!activeItem || !overItem) return;
    const parentId = activeItem.parent_id ?? null;
    if (parentId !== (overItem.parent_id ?? null)) {
      setNotice('拖拽只调整同级顺序；跨层级请用「父级」下拉调整。');
      return;
    }
    const siblings = submoduleSiblings(submodules, parentId);
    const from = siblings.findIndex((item) => item.id === active.id);
    const to = siblings.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    const ordered = arrayMove(siblings, from, to).map((item) => item.id);
    const next = reorderSubmodules(submodules, parentId, ordered);
    const updates = next.filter((item) => {
      const previous = submodules.find((entry) => entry.id === item.id);
      return previous ? previous.order_index !== item.order_index : false;
    });
    if (updates.length === 0) return;
    setBusy(true);
    try {
      for (const item of updates) {
        await worldbuildingApi.updateSubmodule(item.id, { order_index: item.order_index });
      }
      onChanged?.();
    } catch (dragError) {
      toast.error(dragError instanceof Error ? dragError.message : '排序保存失败');
    } finally {
      setBusy(false);
    }
  };

  const cascadeDelete = async (id: string) => {
    setBusy(true);
    try {
      await worldbuildingApi.deleteSubmodule(id);
      onChanged?.();
      setPendingDelete(null);
      toast.success('已级联删除子模块及其下级');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const deleteWithChildrenMoved = async (id: string) => {
    setBusy(true);
    try {
      for (const step of moveChildrenPlan(submodules, id)) {
        await worldbuildingApi.updateSubmodule(step.submoduleId, {
          parent_id: step.parentId,
          order_index: step.orderIndex,
        });
      }
      await worldbuildingApi.deleteSubmodule(id);
      onChanged?.();
      setPendingDelete(null);
      toast.success('子级已上移，原节点已删除');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="submodule-manager">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          世界 {worldId} · 模块 {moduleType}
        </span>
        <button
          type="button"
          onClick={() => openCreate(null)}
          className="ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
          data-testid="submodule-create-root"
        >
          <Plus className="h-3.5 w-3.5" />
          新建顶层分类
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          关闭
        </button>
      </div>

      {builtins.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 px-2 py-1.5">
          <span className="text-[10px] text-muted-foreground">推荐 kind（可选快捷项）：</span>
          {builtins.map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => {
                if (createParent === undefined && !editingId) openCreate(null);
                setForm((prev) => ({ ...prev, kind: def.id }));
              }}
              className="rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {def.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground/70">
            只填充 kind，不预置任何内容
          </span>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
          data-testid="submodule-error"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
          {notice}
        </div>
      )}

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border/50 px-3 py-6 text-[11px] text-muted-foreground"
          data-testid="submodule-empty"
        >
          <FolderTree className="h-5 w-5" />
          该模块还没有子模块。子模块承载分类与实体，条目承载字段组与长文。
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <SortableContext
            items={rows.map((row) => row.submodule.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {rows.map((row) => (
                <SortableRow
                  key={row.submodule.id}
                  row={row}
                  selected={editingId === row.submodule.id}
                  kindLabel={kindLabel}
                  itemCount={submoduleItemCount(items ?? [], row.submodule)}
                  linkCount={linkCounts?.get(row.submodule.id) ?? 0}
                  hasChildren={childCountOf(row.submodule.id) > 0}
                  expanded={!collapsed.has(row.submodule.id)}
                  onToggle={(id) =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onEdit={openEdit}
                  onAddChild={(submodule) => openCreate(submodule.id)}
                  onDelete={(submodule) => {
                    setPendingDelete(submodule.id);
                    setError(null);
                  }}
                  onManageFields={onManageFields}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {(createParent !== undefined || editingId) && (
        <div className="space-y-1.5 rounded-md border border-border/40 p-2" data-testid="submodule-form">
          <div className="text-[11px] font-medium text-foreground">
            {editingId ? '编辑子模块' : createParent ? `新建子级：${kindLabel(submodules.find((item) => item.id === createParent)?.kind)}` : '新建顶层分类'}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="名称"
              aria-label="子模块名称"
              className={FIELD_CLASS}
            />
            <select
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
              aria-label="子模块 kind"
              className={FIELD_CLASS}
            >
              {kinds.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.label}（{def.id}）
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="描述（可选）"
              aria-label="子模块描述"
              className={FIELD_CLASS}
            />
            {editingId && (
              <select
                value={submodules.find((item) => item.id === editingId)?.parent_id ?? ''}
                onChange={(event) => {
                  const current = submodules.find((item) => item.id === editingId);
                  if (current) {
                    void changeParent(current, event.target.value || null);
                  }
                }}
                aria-label="父级"
                className={FIELD_CLASS}
              >
                <option value="">无（顶层）</option>
                {submodules
                  .filter(
                    (item) =>
                      item.id !== editingId &&
                      canReparentSubmodule(submodules, editingId, item.id)
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      父级：{item.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
              图标（Lucide 名）
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <input
                type="text"
                value={form.icon}
                onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                placeholder="如 landmark"
                aria-label="子模块图标"
                className={`${FIELD_CLASS} w-32`}
              />
              {SUBMODULE_ICON_CHOICES.map((name) => {
                const Icon = lucideIcon(name);
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={`选择图标 ${name}`}
                    onClick={() => setForm((prev) => ({ ...prev, icon: name }))}
                    className={`rounded border px-1 py-0.5 transition-colors ${
                      form.icon === name
                        ? 'border-primary text-primary'
                        : 'border-border/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : name.slice(0, 2)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">颜色</div>
            <div className="flex flex-wrap items-center gap-1">
              <input
                type="text"
                value={form.color}
                onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                placeholder="hex 或颜色 token"
                aria-label="子模块颜色"
                className={`${FIELD_CLASS} w-32`}
              />
              {SUBMODULE_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`选择颜色 ${color}`}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={`h-4 w-4 rounded-sm border transition-transform ${
                    form.color === color
                      ? 'scale-110 border-primary'
                      : 'border-border/60 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
            <button
              type="button"
              onClick={() => void submitForm()}
              disabled={busy}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              data-testid="submodule-save"
            >
              <Save className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>
      )}

      {impact && (
        <DeleteImpactPanel
          impact={impact}
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onCascade={() => void cascadeDelete(impact.id)}
          onMoveUp={() => void deleteWithChildrenMoved(impact.id)}
        />
      )}

      <p className="text-[10px] text-muted-foreground">
        层级建议不超过 3 层；拖拽只调整同级顺序。删除只影响结构，条目内容随所选方式一起删除或上移。
      </p>
    </div>
  );
};

export const SubmoduleManager = (props: SubmoduleManagerProps) => (
  <Modal isOpen={props.open} onClose={props.onClose} title="子模块管理" size="lg">
    <SubmoduleManagerPanel {...props} />
  </Modal>
);
