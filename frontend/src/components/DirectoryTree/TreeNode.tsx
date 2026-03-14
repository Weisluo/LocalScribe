import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, BookOpen, Scroll } from 'lucide-react';
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

  const nodeId = node.type === 'note' ? `note-${node.id}` : undefined;

  return (
    <div ref={setNodeRef} style={style} id={nodeId}>
      <div
        className={`
          group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer
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

        <span className={`
          flex-1 truncate text-sm
          ${node.type === 'note' ? 'font-serif' : 'font-medium'}
          ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}
        `}>
          {'title' in node ? node.title || '无标题' : node.name}
        </span>

        {node.type === 'volume' && (
          <button
            onClick={(e) => handleCreateAct(e, node.id)}
            className="
              opacity-0 group-hover:opacity-100
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
              opacity-0 group-hover:opacity-100
              p-1 rounded-md hover:bg-accent/40
              text-muted-foreground hover:text-foreground
              transition-all duration-200
            "
            title="新建笔记"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
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
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};
