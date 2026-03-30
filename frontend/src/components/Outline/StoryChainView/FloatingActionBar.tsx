import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Link2, Copy, Palette, Trash2 } from 'lucide-react';
import type { EventType, ConnectionType } from '../types';
import './animations.css';

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
  { value: 'flashback', label: '闪回', icon: '▲' },
  { value: 'flashforward', label: '闪前', icon: '▼' },
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

  const toggleStyleMenu = useCallback(() => {
    setShowStyleMenu(prev => !prev);
    setShowConnectMenu(false);
  }, []);

  const toggleConnectMenu = useCallback(() => {
    setShowConnectMenu(prev => !prev);
    setShowStyleMenu(false);
  }, []);

  const isNearTop = useMemo(() => {
    return position.y < 200;
  }, [position.y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showStyleMenu || showConnectMenu) {
          setShowStyleMenu(false);
          setShowConnectMenu(false);
        } else {
          onDeselect();
        }
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        onEdit();
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleConnectMenu();
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        onCopy();
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleStyleMenu();
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onEdit, onCopy, onDelete, onDeselect, showStyleMenu, showConnectMenu, toggleStyleMenu, toggleConnectMenu]);

  const menuPosition = isNearTop ? 'top-full mt-2' : 'bottom-full mb-2';

  return createPortal(
    <div
      className="fixed z-50 floating-bar-enter optimize-animations"
      style={{
        left: position.x,
        top: isNearTop 
          ? position.y + (position.height || 80) + 16
          : position.y - 90,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        {!isNearTop && (
          <div className="px-3 py-1 rounded-full bg-card border border-border/40
                          text-[10px] text-muted-foreground shadow-sm">
            E-编辑  C-连接  V-复制  S-样式  D-删除  Esc-关闭
          </div>
        )}

        <div className="flex items-center gap-1 p-1.5 rounded-full bg-popover shadow-lg border border-border/60">
          <button
            onClick={onEdit}
            className="group relative p-2 rounded-full hover:bg-accent/20
                       text-muted-foreground hover:text-foreground hover-scale"
            title="编辑 (E)"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              onClick={toggleConnectMenu}
              className={`p-2 rounded-full hover-scale
                         ${showConnectMenu 
                           ? 'bg-accent/20 text-foreground' 
                           : 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'}`}
              title="连接 (C)"
            >
              <Link2 className="h-4 w-4" />
            </button>

            {showConnectMenu && (
              <div className={`absolute left-1/2 -translate-x-1/2 ${menuPosition}
                              bg-popover rounded-lg shadow-xl border border-border/60
                              p-1.5 min-w-[140px] zoom-in optimize-animations`}
                   style={{ backgroundColor: 'hsl(var(--popover))' }}>
                {connectionTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleConnect(opt.value)}
                    className="w-full px-3 py-1.5 text-xs text-left rounded-md
                             hover:bg-accent/20 text-muted-foreground hover:text-foreground
                             hover-scale"
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
                       text-muted-foreground hover:text-foreground hover-scale"
            title="复制 (V)"
          >
            <Copy className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-border/60" />

          <div className="relative">
            <button
              onClick={toggleStyleMenu}
              className={`p-2 rounded-full hover-scale
                         ${showStyleMenu 
                           ? 'bg-accent/20 text-foreground' 
                           : 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'}`}
              title="样式 (S)"
            >
              <Palette className="h-4 w-4" />
            </button>

            {showStyleMenu && (
              <div className={`absolute left-1/2 -translate-x-1/2 ${menuPosition}
                              bg-popover rounded-lg shadow-xl border border-border/60
                              p-2 w-[180px] zoom-in optimize-animations`}
                   style={{ backgroundColor: 'hsl(var(--popover))' }}>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {eventTypeOptions.slice(0, 3).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStyleChange(opt.value)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md
                               hover-scale
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
                               hover-scale
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
                       text-muted-foreground hover:text-destructive hover-scale"
            title="删除 (D)"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={onDeselect}
            className="p-2 rounded-full hover:bg-accent/20
                       text-muted-foreground hover:text-foreground hover-scale"
            title="关闭 (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isNearTop && (
          <div className="px-3 py-1 rounded-full bg-card border border-border/40
                          text-[10px] text-muted-foreground shadow-sm">
            E-编辑  C-连接  V-复制  S-样式  D-删除  Esc-关闭
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FloatingActionBar;
