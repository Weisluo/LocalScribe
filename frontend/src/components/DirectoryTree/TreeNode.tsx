// frontend/src/components/DirectoryTree/TreeNode.tsx
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus } from 'lucide-react';
import type { components } from '@/types/api';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUIStore } from '@/stores/uiStore';

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
}

export const TreeNode = ({
  node,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  expandedIds,
}: TreeNodeProps) => {
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const openModal = useUIStore(state => state.openModal);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative' as const,
  };

  const hasChildren = 'children' in node && node.children && node.children.length > 0;
  const childIds = hasChildren ? (node as VolumeNode | ActNode).children.map(child => child.id) : [];

  const getIcon = () => {
    if (node.type === 'note') {
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
    if (node.type === 'volume') {
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-primary" />
      ) : (
        <Folder className="h-4 w-4 text-primary" />
      );
    }
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 text-secondary-foreground" />
    ) : (
      <Folder className="h-4 w-4 text-secondary-foreground" />
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

  // 为笔记节点设置 ID，方便滚动定位
  const nodeId = node.type === 'note' ? `note-${node.id}` : undefined;

  return (
    <div ref={setNodeRef} style={style} id={nodeId}>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors
          hover:bg-accent hover:text-accent-foreground
          ${isSelected ? 'bg-accent text-accent-foreground font-medium' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        {...attributes}
        {...listeners}
      >
        {node.type !== 'note' && (
          <span
            className="flex items-center justify-center w-4 h-4 hover:bg-muted rounded-sm"
            onClick={handleToggleClick}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : (
              <span className="w-3" />
            )}
          </span>
        )}

        {getIcon()}

        <span className="flex-1 truncate text-sm">
          {'title' in node ? node.title : node.name}
        </span>

        {node.type === 'volume' && (
          <button
            onClick={(e) => handleCreateAct(e, node.id)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="新建幕"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        {node.type === 'act' && (
          <button
            onClick={(e) => handleCreateNote(e, node.id)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="新建笔记"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isExpanded && hasChildren && (
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          <div>
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
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};