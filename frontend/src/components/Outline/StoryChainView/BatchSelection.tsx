import { useState, useCallback, useEffect } from 'react';
import { Trash2, Copy, Link2, AlignLeft, Merge, X } from 'lucide-react';
import type { ConnectionType } from '../types';

interface BatchActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onCopy: () => void;
  onConnect: (type: ConnectionType) => void;
  onAlign: () => void;
  onMerge: () => void;
  onDeselect: () => void;
}

const connectionTypes: { value: ConnectionType; label: string }[] = [
  { value: 'direct', label: '直接连接' },
  { value: 'parallel', label: '并行开始' },
  { value: 'merge', label: '汇合点' },
];

export const BatchActionBar = ({
  selectedCount,
  onDelete,
  onCopy,
  onConnect,
  onAlign,
  onMerge,
  onDeselect,
}: BatchActionBarProps) => {
  const [showConnectMenu, setShowConnectMenu] = useState(false);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 px-5 py-3 bg-popover/95 backdrop-blur-sm rounded-xl shadow-2xl border border-border/60">
        <div className="flex items-center gap-2 pr-3 border-r border-border/40">
          <span className="text-sm font-medium text-foreground">
            已选择 {selectedCount} 个事件
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAlign}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                     hover:bg-accent/20 text-muted-foreground hover:text-foreground
                     transition-all duration-200"
            title="对齐事件"
          >
            <AlignLeft className="h-3.5 w-3.5" />
            对齐
          </button>

          <div className="relative">
            <button
              onClick={() => setShowConnectMenu(!showConnectMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                       hover:bg-accent/20 text-muted-foreground hover:text-foreground
                       transition-all duration-200"
              title="批量连接"
            >
              <Link2 className="h-3.5 w-3.5" />
              连接
            </button>

            {showConnectMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-popover rounded-lg shadow-xl 
                            border border-border/60 p-1.5 min-w-[120px]
                            animate-in fade-in zoom-in-95 duration-150">
                {connectionTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => {
                      onConnect(type.value);
                      setShowConnectMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left rounded-md
                             hover:bg-accent/20 text-muted-foreground hover:text-foreground
                             transition-colors"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                     hover:bg-accent/20 text-muted-foreground hover:text-foreground
                     transition-all duration-200"
            title="复制事件"
          >
            <Copy className="h-3.5 w-3.5" />
            复制
          </button>

          <button
            onClick={onMerge}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                     hover:bg-accent/20 text-muted-foreground hover:text-foreground
                     transition-all duration-200"
            title="合并事件"
          >
            <Merge className="h-3.5 w-3.5" />
            合并
          </button>

          <div className="w-px h-4 bg-border/60" />

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                     hover:bg-destructive/20 text-muted-foreground hover:text-destructive
                     transition-all duration-200"
            title="删除事件"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
        </div>

        <button
          onClick={onDeselect}
          className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground 
                   hover:text-foreground transition-colors"
          title="取消选择"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const toggleSelection = useCallback((id: string, isShiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      
      if (isShiftKey) {
        setIsMultiSelectMode(true);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      } else {
        if (next.size === 1 && next.has(id)) {
          next.clear();
          setIsMultiSelectMode(false);
        } else {
          next.clear();
          next.add(id);
          setIsMultiSelectMode(false);
        }
      }
      
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setIsMultiSelectMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  return {
    selectedIds,
    isMultiSelectMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected: (id: string) => selectedIds.has(id),
  };
}

export default BatchActionBar;
