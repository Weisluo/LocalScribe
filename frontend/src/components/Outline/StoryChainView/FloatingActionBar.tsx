import { useState, useEffect, useCallback } from 'react';
import { X, Pencil, Link2, Copy, Palette, Trash2 } from 'lucide-react';
import type { EventType, ConnectionType } from '../types';

interface FloatingActionBarProps {
  selectedEventId: string;
  onEdit: () => void;
  onConnect: (type: ConnectionType) => void;
  onCopy: () => void;
  onStyleChange: (type: EventType) => void;
  onDelete: () => void;
  onDeselect: () => void;
  currentEventType: EventType;
  position: { x: number; y: number; height?: number };
}

const eventTypeOptions: { value: EventType; label: string; icon: string }[] = [
  { value: 'normal', label: '普通', icon: '●' },
  { value: 'decision', label: '决策', icon: '◆' },
  { value: 'milestone', label: '里程碑', icon: '★' },
  { value: 'flashback', label: '闪回', icon: '◀' },
  { value: 'flashforward', label: '闪前', icon: '▶' },
];

const connectionTypeOptions: { value: ConnectionType; label: string }[] = [
  { value: 'direct', label: '直接连接' },
  { value: 'branch', label: '分支连接' },
  { value: 'parallel', label: '并行开始' },
  { value: 'merge', label: '汇合点' },
  { value: 'loop', label: '循环连接' },
  { value: 'jump', label: '跳跃连接' },
];

export const FloatingActionBar = ({
  onEdit,
  onConnect,
  onCopy,
  onStyleChange,
  onDelete,
  onDeselect,
  currentEventType,
  position,
}: FloatingActionBarProps) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showConnectMenu, setShowConnectMenu] = useState(false);

  const handleStyleChange = useCallback((type: EventType) => {
    onStyleChange(type);
    setShowStyleMenu(false);
  }, [onStyleChange]);

  const handleConnect = useCallback((type: ConnectionType) => {
    onConnect(type);
    setShowConnectMenu(false);
  }, [onConnect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDeselect();
      }
      if (e.key === 'e' || e.key === 'E') {
        onEdit();
      }
      if (e.key === 'c' || e.key === 'C') {
        setShowConnectMenu(prev => !prev);
      }
      if (e.key === 'd' || e.key === 'D') {
        onDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEdit, onDelete, onDeselect]);

  return (
    <div
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: position.x,
        top: position.y - 8,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      <div className="flex flex-col items-center gap-2 pb-2">
        <button
          onClick={onDeselect}
          className="p-1.5 rounded-full bg-card shadow-lg border border-border/60
                     hover:bg-accent/20 text-muted-foreground hover:text-foreground
                     transition-all duration-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-1 p-1.5 rounded-full bg-popover shadow-lg border border-border/60">
          <button
            onClick={onEdit}
            className="group relative p-2 rounded-full hover:bg-accent/20
                       text-muted-foreground hover:text-foreground transition-all duration-200"
            title="编辑 (E)"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowConnectMenu(!showConnectMenu)}
              className={`p-2 rounded-full transition-all duration-200
                         ${showConnectMenu 
                           ? 'bg-accent/20 text-foreground' 
                           : 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'}`}
              title="连接 (C)"
            >
              <Link2 className="h-4 w-4" />
            </button>

            {showConnectMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                              bg-popover rounded-lg shadow-xl border border-border/60
                              p-1.5 min-w-[140px] animate-in fade-in zoom-in-95 duration-150">
                {connectionTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleConnect(opt.value)}
                    className="w-full px-3 py-1.5 text-xs text-left rounded-md
                             hover:bg-accent/20 text-muted-foreground hover:text-foreground
                             transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onCopy}
            className="p-2 rounded-full hover:bg-accent/20
                       text-muted-foreground hover:text-foreground transition-all duration-200"
            title="复制"
          >
            <Copy className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-border/60" />

          <div className="relative">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              className={`p-2 rounded-full transition-all duration-200
                         ${showStyleMenu 
                           ? 'bg-accent/20 text-foreground' 
                           : 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'}`}
              title="样式"
            >
              <Palette className="h-4 w-4" />
            </button>

            {showStyleMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                              bg-popover rounded-lg shadow-xl border border-border/60
                              p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {eventTypeOptions.slice(0, 3).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStyleChange(opt.value)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md
                               transition-all duration-200
                               ${currentEventType === opt.value
                                 ? 'bg-accent/20 text-foreground ring-1 ring-accent/40'
                                 : 'hover:bg-accent/10 text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {eventTypeOptions.slice(3).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStyleChange(opt.value)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md
                               transition-all duration-200
                               ${currentEventType === opt.value
                                 ? 'bg-accent/20 text-foreground ring-1 ring-accent/40'
                                 : 'hover:bg-accent/10 text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            className="p-2 rounded-full hover:bg-destructive/20
                       text-muted-foreground hover:text-destructive transition-all duration-200"
            title="删除 (D)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border/40
                        text-[10px] text-muted-foreground">
          提示: E-编辑  C-连接  D-删除  Esc-取消
        </div>
      </div>
    </div>
  );
};

export default FloatingActionBar;
