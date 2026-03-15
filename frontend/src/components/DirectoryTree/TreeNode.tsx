import { useState } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, Plus, BookOpen, Scroll, Edit2, Trash2, Check, X } from 'lucide-react';
import type { components } from '@/types/api';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUIStore } from '@/stores/uiStore';
import { useUpdateFolder, useDeleteFolder } from '@/hooks/useDirectory';
import { useDeleteNote, useUpdateNote } from '@/hooks/useNote';
import { useProjectStore } from '@/stores/projectStore';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];
type TreeNodeType = VolumeNode | ActNode | NoteNode;

interface TreeNodeProps {
  node: TreeNodeType;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNodeType) => void;
  expandedIds?: Set<string>;
  projectId?: string;
  onNoteDeleted?: (noteId: string) => void;
}

export const TreeNode = ({
  node,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  expandedIds,
  onNoteDeleted,
}: TreeNodeProps) => {
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const openModal = useUIStore(state => state.openModal);
  const currentProjectId = useProjectStore(state => state.currentProjectId);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const deleteNoteMutation = useDeleteNote(currentProjectId || '');
  const updateNoteMutation = useUpdateNote(currentProjectId || '');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative' as const,
  };

  const hasChildren = 'children' in node && node.children && node.children.length > 0;
  const childIds = hasChildren ? (node as VolumeNode | ActNode).children.map(child => child.id) : [];

  const getIcon = () => {
    if (node.type === 'note') {
      return (
        <div className={`p-1 rounded ${isSelected ? 'bg-accent/30' : 'bg-muted/50'}`}>
          <FileText className={`h-3.5 w-3.5 ${isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
        </div>
      );
    }
    if (node.type === 'volume') {
      return (
        <div className={`p-1 rounded ${isExpanded ? 'bg-primary/15' : 'bg-primary/10'}`}>
          {isExpanded ? (
            <BookOpen className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
      );
    }
    return (
      <div className={`p-1 rounded ${isExpanded ? 'bg-accent/20' : 'bg-muted/50'}`}>
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Scroll className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
    );
  };

  const handleClick = () => {
    if (node.type === 'note') {
      onSelect(node);
    } else {
      onToggle(node.id);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  const handleCreateAct = (e: React.MouseEvent, volumeId: string) => {
    e.stopPropagation();
    openModal('act', volumeId);
  };

  const handleCreateNote = (e: React.MouseEvent, actId: string) => {
    e.stopPropagation();
    openModal('note', actId);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue('title' in node ? node.title || '' : node.name);
  };

  const handleSaveEdit = () => {
    if (!editValue.trim()) return;
    if (!currentProjectId) {
      alert('请先选择项目');
      setIsEditing(false);
      return;
    }
    
    if (node.type === 'note') {
      // 章节重命名
      updateNoteMutation.mutate({
        noteId: node.id,
        data: { title: editValue.trim() }
      }, {
        onSuccess: () => {
          setIsEditing(false);
          // 更新标题显示
          onSelect({ ...node, title: editValue.trim() });
        },
        onError: (error) => {
          console.error('重命名章节失败:', error);
          // 显示错误提示
          alert('重命名失败，请重试');
          // 保持编辑状态，允许用户重试或取消
        }
      });
    } else {
      // 卷/幕重命名
      updateFolderMutation.mutate({
        folderId: node.id,
        data: { name: editValue.trim() }
      }, {
        onSuccess: () => {
          setIsEditing(false);
        },
        onError: (error) => {
          console.error('重命名卷/幕失败:', error);
          // 显示错误提示
          alert('重命名失败，请重试');
          // 保持编辑状态，允许用户重试或取消
        }
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!currentProjectId) {
      alert('请先选择项目');
      setShowDeleteConfirm(false);
      return;
    }
    
    if (node.type === 'note') {
      deleteNoteMutation.mutate(node.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          if (onNoteDeleted) {
            onNoteDeleted(node.id);
          }
        },
        onError: (error) => {
          console.error('删除章节失败:', error);
          // 显示错误提示
          alert('删除失败，请重试');
          // 关闭确认对话框
          setShowDeleteConfirm(false);
        }
      });
    } else {
      // 删除卷或幕
      deleteFolderMutation.mutate(node.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
        },
        onError: (error) => {
          console.error('删除卷/幕失败:', error);
          // 显示错误提示
          alert('删除失败，请重试');
          // 关闭确认对话框
          setShowDeleteConfirm(false);
        }
      });
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const nodeId = node.type === 'note' ? `note-${node.id}` : undefined;

  return (
    <div ref={setNodeRef} style={style} id={nodeId}>
      <div
        className={`
          group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer relative
          transition-all duration-200 ease-out
          ${isSelected
            ? 'bg-accent/20 text-accent-foreground font-medium shadow-sm'
            : 'hover:bg-accent/10 hover:text-accent-foreground'
          }
          ${node.type === 'note' && isSelected ? 'ring-1 ring-accent/30' : ''}
        `}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={handleClick}
        {...attributes}
        {...listeners}
      >
        {node.type !== 'note' && (
          <button
            className={`
              flex items-center justify-center w-5 h-5 rounded-md
              transition-all duration-200
              ${hasChildren ? 'hover:bg-accent/30' : ''}
            `}
            onClick={handleToggleClick}
          >
            {hasChildren ? (
              <div className={`
                transition-transform duration-200
                ${isExpanded ? 'rotate-90' : 'rotate-0'}
              `}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ) : (
              <span className="w-3" />
            )}
          </button>
        )}

        {getIcon()}

        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm bg-background border border-accent/50 rounded px-1.5 py-0.5 focus:outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <span className={`
            flex-1 truncate text-sm pr-16
            ${node.type === 'note' ? 'font-serif' : 'font-medium'}
            ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}
          `}>
            {'title' in node ? node.title || '无标题' : node.name}
          </span>
        )}

        {!isEditing && !showDeleteConfirm && (
          <div className="
            absolute right-1 top-1/2 -translate-y-1/2
            flex items-center gap-0.5
            opacity-0 group-hover:opacity-100
            transition-all duration-200
            bg-inherit rounded-md px-1
            shadow-[-8px_0_8px_rgba(0,0,0,0.05)]
          ">
            {node.type === 'volume' && (
              <button
                onClick={(e) => handleCreateAct(e, node.id)}
                className="
                  p-1 rounded-md hover:bg-accent/40
                  text-muted-foreground hover:text-foreground
                  transition-all duration-200
                "
                title="新建幕"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {node.type === 'act' && (
              <button
                onClick={(e) => handleCreateNote(e, node.id)}
                className="
                  p-1 rounded-md hover:bg-accent/40
                  text-muted-foreground hover:text-foreground
                  transition-all duration-200
                "
                title="新建章节"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={handleStartEdit}
              className="
                p-1 rounded-md hover:bg-accent/40
                text-muted-foreground hover:text-foreground
                transition-all duration-200
              "
              title="重命名"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleDelete}
              className="
                p-1 rounded-md hover:bg-destructive/20 hover:text-destructive
                text-muted-foreground
                transition-all duration-200
              "
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="
            absolute right-1 top-1/2 -translate-y-1/2
            flex items-center gap-0.5
            bg-inherit rounded-md px-1
          ">
            <button
              onClick={handleConfirmDelete}
              className="
                p-1 rounded-md hover:bg-destructive/20 hover:text-destructive
                text-destructive
                transition-all duration-200
              "
              title="确认删除"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancelDelete}
              className="
                p-1 rounded-md hover:bg-accent/40
                text-muted-foreground hover:text-foreground
                transition-all duration-200
              "
              title="取消"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          <div className="relative">
            {/* 缩进引导线 */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-px bg-border/40"
              style={{ left: `${(level + 1) * 14 + 14}px` }}
            />
            {(node as VolumeNode | ActNode).children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                isExpanded={expandedIds ? expandedIds.has(child.id) : false}
                isSelected={isSelected}
                onToggle={onToggle}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onNoteDeleted={onNoteDeleted}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};
