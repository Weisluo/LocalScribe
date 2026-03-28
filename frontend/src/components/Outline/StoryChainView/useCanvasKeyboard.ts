import { useEffect, useCallback, useRef } from 'react';
import type { GridConfig } from '../types';

interface UseCanvasKeyboardOptions {
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitCanvas: () => void;
  onAutoLayout?: () => void;
  enabled?: boolean;
}

export function useCanvasKeyboard({
  gridConfig,
  onGridConfigChange,
  onZoomIn,
  onZoomOut,
  onFitCanvas,
  onAutoLayout,
  enabled = true,
}: UseCanvasKeyboardOptions) {
  const isSpacePressed = useRef(false);
  const isPanning = useRef(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (e.key === ' ' && !e.repeat) {
      e.preventDefault();
      isSpacePressed.current = true;
      document.body.style.cursor = 'grab';
    }

    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      if (e.shiftKey) {
        onGridConfigChange({ ...gridConfig, snapEnabled: !gridConfig.snapEnabled });
      } else {
        onGridConfigChange({ ...gridConfig, enabled: !gridConfig.enabled });
      }
    }

    if (e.key === 'f' || e.key === 'F') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onFitCanvas();
      }
    }

    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      onAutoLayout?.();
    }

    if (e.key === '+' || e.key === '=') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onZoomIn();
      }
    }

    if (e.key === '-') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onZoomOut();
      }
    }

    if (e.key === '0') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onFitCanvas();
      }
    }
  }, [enabled, gridConfig, onGridConfigChange, onZoomIn, onZoomOut, onFitCanvas, onAutoLayout]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      isSpacePressed.current = false;
      isPanning.current = false;
      document.body.style.cursor = '';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.style.cursor = '';
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isSpacePressed: isSpacePressed.current,
    isPanning: isPanning.current,
    setIsPanning: (value: boolean) => { isPanning.current = value; },
  };
}
