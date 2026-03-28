import { useState, useCallback, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoRedoOptions<T> {
  maxHistory?: number;
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
}

interface UseUndoRedoReturn<T> {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newState: T) => void;
  history: {
    past: T[];
    future: T[];
  };
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions<T> = {}
): UseUndoRedoReturn<T> {
  const { maxHistory = 50, onUndo, onRedo } = options;

  const [historyState, setHistoryState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const isUndoRedoRef = useRef(false);

  const setState = useCallback(
    (newState: T) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return;
      }

      setHistoryState((prev) => {
        const newPast = [...prev.past, prev.present].slice(-maxHistory);
        return {
          past: newPast,
          present: newState,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);

      isUndoRedoRef.current = true;
      onUndo?.(previous);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, [onUndo]);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.future.length === 0) return prev;

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      isUndoRedoRef.current = true;
      onRedo?.(next);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, [onRedo]);

  const reset = useCallback((newState: T) => {
    setHistoryState({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  return {
    state: historyState.present,
    setState,
    undo,
    redo,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    reset,
    history: {
      past: historyState.past,
      future: historyState.future,
    },
  };
}
