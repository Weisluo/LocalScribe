import { useState } from 'react';
import { useDirectoryTree } from '@/hooks/useDirectory';
import { useMoveFolder } from '@/hooks/useDirectory';
import { useMoveNote } from '@/hooks/useNote';
import { TreeNode } from './TreeNode';
import { Loader2, Library, Sparkles } from 'lucide-react';
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
  onSelectNote: (id: string, title: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
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

  const handleNoteDeleted = (noteId: string) => {
    if (selectedNoteId === noteId && tree) {
      // 如果删除的是当前选中的章节，需要找到上一章
      
      // 递归查找所有章节节点
      const findAllNotes = (nodes: (VolumeNode | ActNode | NoteNode)[]): NoteNode[] => {
        let notes: NoteNode[] = [];
        for (const node of nodes) {
          if (node.type === 'note') {
            notes.push(node as NoteNode);
          } else if ('children' in node) {
            notes = notes.concat(findAllNotes(node.children as any));
          }
        }
        return notes;
      };

      const allNotes = findAllNotes(tree);
      const deletedIndex = allNotes.findIndex(note => note.id === noteId);
      
      if (deletedIndex > 0) {
        // 存在上一章，切换到上一章
        const previousNote = allNotes[deletedIndex - 1];
        onSelectNote(previousNote.id, previousNote.title);
      } else if (deletedIndex === 0 && allNotes.length > 1) {
        // 删除的是第一章，但还有其他章节，切换到新的第一章
        const nextNote = allNotes[1];
        onSelectNote(nextNote.id, nextNote.title);
      } else {
        // 没有其他章节了，清空选中状态
        onSelectNote('', '');
      }
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
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-3">
        <div className="relative">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="absolute inset-0 blur-md bg-primary/20 rounded-full" />
        </div>
        <span className="text-sm">整理书架上...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 p-4 text-destructive gap-2">
        <Library className="h-8 w-8 opacity-50" />
        <span className="text-sm">加载目录失败</span>
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 p-6 text-muted-foreground">
        <div className="relative mb-4">
          <Library className="h-12 w-12 opacity-30" />
          <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-accent opacity-60" />
        </div>
        <p className="text-sm font-medium mb-1">书架空空如也</p>
        <p className="text-xs opacity-60">点击上方 + 按钮添加新卷</p>
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
        <div className="py-2 px-1">
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
              onNoteDeleted={handleNoteDeleted}
            />
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeId ? (
          <div className="px-4 py-2.5 bg-card border border-border/50 shadow-xl rounded-lg text-sm font-medium opacity-90 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              正在移动...
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
