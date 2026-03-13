// frontend/src/components/DirectoryTree/DirectoryTree.tsx
import { useState } from 'react';
import { useDirectoryTree } from '@/hooks/useDirectory';
import { useMoveFolder } from '@/hooks/useDirectory';
import { useMoveNote } from '@/hooks/useNote';
import { TreeNode } from './TreeNode';
import { Loader2 } from 'lucide-react';
import type { components } from '@/types/api';
import { useNoteStore } from '@/stores/noteStore';

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
  expandedIds: Set<string>;          // 新增：展开状态由父组件控制
  onToggle: (id: string) => void;    // 新增：展开/折叠回调
}

export const DirectoryTree = ({ 
  projectId, 
  selectedNoteId, 
  onSelectNote,
  expandedIds,
  onToggle
}: DirectoryTreeProps) => {
  
  const { data: tree, isLoading, error } = useDirectoryTree(projectId);
  const { mutate: moveFolder } = useMoveFolder(projectId);
  const { mutate: moveNote } = useMoveNote(projectId);

  const [activeId, setActiveId] = useState<string | null>(null);

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

  const handleSelect = (node: TreeNodeType) => {
    if (node.type === 'note') {
      setCurrentNoteId(node.id);
      onSelectNote(node.id, node.title);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !tree) return;

    const activeInfo = findNodeInfo(tree, active.id as string);
    if (!activeInfo) return;

    const overInfo = findNodeInfo(tree, over.id as string);
    if (!overInfo) return;

    if (activeInfo.node.type === 'volume') {
      if (overInfo.node.type !== 'volume') return;
      if (activeInfo.index !== overInfo.index) {
        moveFolder({
          folderId: active.id as string,
          data: {
            target_parent_id: null,
            new_order: overInfo.index
          }
        });
      }
    }
    else if (activeInfo.node.type === 'act') {
      if (overInfo.node.type !== 'act') return;
      if (activeInfo.parentId !== overInfo.parentId || activeInfo.index !== overInfo.index) {
        moveFolder({
          folderId: active.id as string,
          data: {
            target_parent_id: overInfo.parentId!,
            new_order: overInfo.index
          }
        });
      }
    }
    else if (activeInfo.node.type === 'note') {
      if (overInfo.node.type !== 'note') return;
      if (activeInfo.parentId !== overInfo.parentId || activeInfo.index !== overInfo.index) {
        moveNote({
          noteId: active.id as string,
          data: {
            target_folder_id: overInfo.parentId!,
            new_order: overInfo.index
          }
        });
      }
    }
  };

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
              onToggle={onToggle}
              onSelect={handleSelect}
              expandedIds={expandedIds}
            />
          ))}
        </div>
      </SortableContext>
      
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