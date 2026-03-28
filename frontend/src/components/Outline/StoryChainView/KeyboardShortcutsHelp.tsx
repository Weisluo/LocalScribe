import { useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Space'], description: '拖拽画布', category: '导航' },
  { keys: ['G'], description: '切换网格', category: '网格' },
  { keys: ['Shift', 'G'], description: '切换吸附', category: '网格' },
  { keys: ['F'], description: '适应画布', category: '视图' },
  { keys: ['L'], description: '自动布局', category: '编辑' },
  { keys: ['Ctrl', '+'], description: '放大', category: '视图' },
  { keys: ['Ctrl', '-'], description: '缩小', category: '视图' },
  { keys: ['Ctrl', '0'], description: '重置缩放', category: '视图' },
  { keys: ['Ctrl', 'F'], description: '搜索事件', category: '搜索' },
  { keys: ['Esc'], description: '取消操作', category: '通用' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal = ({ isOpen, onClose }: KeyboardShortcutsModalProps) => {
  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm mx-4 bg-card rounded-xl shadow-2xl ring-1 ring-border/60 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            键盘快捷键
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category} className="mb-4 last:mb-0">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {category}
              </h4>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 
                                        text-xs font-medium bg-muted rounded border border-border/40
                                        text-foreground shadow-sm">
                            {key === 'Ctrl' ? (
                              <Command className="h-3 w-3" />
                            ) : key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end px-5 py-3 border-t border-border/40">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg
                     hover:bg-primary/90 transition-colors shadow-sm"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
