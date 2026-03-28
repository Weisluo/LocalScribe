import { Undo2, Redo2 } from 'lucide-react';

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
}

export const UndoRedoButtons = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className = '',
}: UndoRedoButtonsProps) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`
          p-1.5 rounded transition-colors
          ${canUndo
            ? 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground/30 cursor-not-allowed'}
        `}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`
          p-1.5 rounded transition-colors
          ${canRedo
            ? 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground/30 cursor-not-allowed'}
        `}
        title="重做 (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default UndoRedoButtons;
