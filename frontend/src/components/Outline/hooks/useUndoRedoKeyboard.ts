import { useEffect, useCallback } from 'react';

interface UseUndoRedoKeyboardOptions {
  onUndo: () => void;
  onRedo: () => void;
  enabled?: boolean;
}

export function useUndoRedoKeyboard({
  onUndo,
  onRedo,
  enabled = true,
}: UseUndoRedoKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const isMetaKey = e.metaKey || e.ctrlKey;

      if (isMetaKey && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      }

      if (isMetaKey && e.key === 'y') {
        e.preventDefault();
        onRedo();
      }
    },
    [enabled, onUndo, onRedo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
