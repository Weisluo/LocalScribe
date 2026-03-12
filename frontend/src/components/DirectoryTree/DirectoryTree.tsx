// frontend/src/components/DirectoryTree/DirectoryTree.tsx
import { useState } from 'react';
import { useDirectoryTree } from '@/hooks/useDirectory';
import { useMoveFolder } from '@/hooks/useDirectory';
import { useMoveNote } from '@/hooks/useNote';
import { TreeNode } from './TreeNode';
import { Loader2 } from 'lucide-react';
import type { components } from '@/types/api';
import { useNoteStore } from '@/stores/noteStore'; // 新增导入

// dnd-kit 核心引入
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  // pointerWithin,
  // rectIntersection,
  // CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];
type TreeNodeType = VolumeNode | ActNode | NoteNode;

interface DirectoryTreeProps {
  projectId: string;
  selectedNoteId?: string;
  onSelectNote: (noteId: string, noteTitle: string) => void;
}

export const DirectoryTree = ({ 
  projectId, 
  selectedNoteId, 
  onSelectNote 
}: DirectoryTreeProps) => {
  
  const { data: tree, isLoading, error } = useDirectoryTree(projectId);
  const { mutate: moveFolder } = useMoveFolder(projectId);
  const { mutate: moveNote } = useMoveNote(projectId);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  // 新增：获取全局状态更新函数
  const setCurrentNoteId = useNoteStore(state => state.setCurrentNoteId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- 辅助函数：递归查找节点信息 ---
  const findNodeInfo = (
    nodes: TreeNodeType[], 
    targetId: string, 
    parentId: string | null = null,
    parentType: 'root' | 'volume' | 'act' = 'root'
  ): { node: TreeNodeType; parentId: string | null; parentType: 'root' | 'volume' | 'act'; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.id === targetId) {
        return { node, parentId, parentType, index: i };
      }
      
      const children = (node as VolumeNode).children || (node as ActNode).children;
      if (children && children.length > 0) {
        const nextParentType = node.type === 'volume' ? 'volume' : 'act';
        const found = findNodeInfo(children, targetId, node.id, nextParentType);
        if (found) return found;
      }
    }
    return null;
  };

  // --- 展开/折叠逻辑 ---
  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 修改：选择节点时更新全局状态，同时保留原有回调
  const handleSelect = (node: TreeNodeType) => {
    if (node.type === 'note') {
      setCurrentNoteId(node.id); // 更新全局状态
      onSelectNote(node.id, node.title); // 保持原有回调以兼容现有代码
    }
  };

  // --- 拖拽逻辑 ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !tree) return;

    // 1. 获取被拖拽节点信息
    const activeInfo = findNodeInfo(tree, active.id as string);
    if (!activeInfo) return;

    // 2. 获取目标位置节点信息
    const overInfo = findNodeInfo(tree, over.id as string);
    if (!overInfo) return;

    // 3. 业务逻辑校验与执行
    
    // 场景 A: 拖拽的是卷
    if (activeInfo.node.type === 'volume') {
      // 只能和卷交换位置
      if (overInfo.node.type !== 'volume') return;
      
      // 如果位置变了
      if (activeInfo.index !== overInfo.index) {
        moveFolder({
          folderId: active.id as string,
          data: {
            target_parent_id: null, // 卷始终在根目录
            new_order: overInfo.index
          }
        });
      }
    }
    
    // 场景 B: 拖拽的是幕
    else if (activeInfo.node.type === 'act') {
      // 只能和幕交换位置 (暂不支持拖拽幕变成卷或章节)
      if (overInfo.node.type !== 'act') return;

      // 如果父级变了 (跨卷移动) 或者 顺序变了 (卷内排序)
      if (activeInfo.parentId !== overInfo.parentId || activeInfo.index !== overInfo.index) {
        moveFolder({
          folderId: active.id as string,
          data: {
            target_parent_id: overInfo.parentId!, // 移动到目标所在的父卷
            new_order: overInfo.index
          }
        });
      }
    }

    // 场景 C: 拖拽的是章节
    else if (activeInfo.node.type === 'note') {
      // 只能和章节交换位置
      if (overInfo.node.type !== 'note') return;

      // 如果父级变了 (跨幕移动) 或者 顺序变了 (幕内排序)
      if (activeInfo.parentId !== overInfo.parentId || activeInfo.index !== overInfo.index) {
        moveNote({
          noteId: active.id as string,
          data: {
            target_folder_id: overInfo.parentId!, // 移动到目标所在的幕
            new_order: overInfo.index
          }
        });
      }
    }
  };

  // --- 渲染 ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        加载目录...
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">加载目录失败</div>;
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        暂无内容
        <br />
        <span className="text-xs">右键或使用按钮添加卷</span>
      </div>
    );
  }

  const volumeIds = tree.map(v => v.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={volumeIds} strategy={verticalListSortingStrategy}>
        <div className="py-2">
          {tree.map((volumeNode) => (
            <TreeNode
              key={volumeNode.id}
              node={volumeNode}
              level={0}
              isExpanded={expandedIds.has(volumeNode.id)}
              isSelected={selectedNoteId === volumeNode.id}
              onToggle={handleToggle}
              onSelect={handleSelect}
              expandedIds={expandedIds}
            />
          ))}
        </div>
      </SortableContext>
      
      {/* 拖拽时的半透明预览层*/}
      <DragOverlay>
        {activeId ? (
          <div className="px-2 py-1 bg-background border shadow-lg rounded text-sm opacity-80">
            正在移动...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};