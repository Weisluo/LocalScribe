import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { type PanInfo } from 'framer-motion';
import { UseCardCarouselOptions, UseCardCarouselReturn, ViewMode } from '../types';
import { SWIPE_THRESHOLD, SWIPE_VELOCITY_THRESHOLD } from '../config';

export function useCardCarousel<T>(options: UseCardCarouselOptions<T>): UseCardCarouselReturn {
  const {
    items,
    activeIndex: controlledActiveIndex,
    defaultActiveIndex = 0,
    onChange,
    loop = false,
    visibleCount = 1,
    enableKeyboard = true,
    viewMode: controlledViewMode,
    defaultViewMode = 'carousel',
    onViewModeChange,
    getRelatedIndices,
    getChildren,
  } = options;

  const isControlled = controlledActiveIndex !== undefined;
  const [internalActiveIndex, setInternalActiveIndex] = useState(defaultActiveIndex);
  const activeIndex = isControlled ? controlledActiveIndex : internalActiveIndex;

  const isViewModeControlled = controlledViewMode !== undefined;
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>(defaultViewMode);
  const viewMode = isViewModeControlled ? controlledViewMode : internalViewMode;

  const [hierarchyStack, setHierarchyStack] = useState<number[]>([]);

  const prevActiveIndexRef = useRef<number>(activeIndex);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const finishTransition = useCallback(() => {
    isTransitioningRef.current = false;
  }, []);

  const visibleRange = useMemo(() => {
    const halfVisible = Math.floor(visibleCount / 2);
    let start = activeIndex - halfVisible;
    let end = start + visibleCount;

    if (loop) {
      return { start, end };
    }

    if (start < 0) {
      start = 0;
      end = Math.min(visibleCount, items.length);
    }
    if (end > items.length) {
      end = items.length;
      start = Math.max(0, end - visibleCount);
    }

    return { start, end };
  }, [activeIndex, visibleCount, items.length, loop]);

  const relatedIndices = useMemo(() => {
    if (viewMode !== 'parallel' || !getRelatedIndices) {
      return [];
    }
    const currentItem = items[activeIndex];
    if (!currentItem) return [];
    return getRelatedIndices(activeIndex, currentItem);
  }, [viewMode, getRelatedIndices, activeIndex, items]);

  const primaryIndex = useMemo(() => {
    if (viewMode === 'hierarchy' && hierarchyStack.length > 0) {
      return hierarchyStack[hierarchyStack.length - 1];
    }
    return activeIndex;
  }, [viewMode, hierarchyStack, activeIndex]);

  useEffect(() => {
    if (prevActiveIndexRef.current !== activeIndex) {
      isTransitioningRef.current = true;

      clearTransitionTimer();
      transitionTimerRef.current = setTimeout(() => {
        finishTransition();
      }, 500);
    }
    prevActiveIndexRef.current = activeIndex;
  }, [activeIndex, clearTransitionTimer, finishTransition]);

  const handleSwitch = useCallback(
    (rawIndex: number) => {
      if (isTransitioningRef.current) return;
      let targetIndex = rawIndex;
      if (targetIndex < 0 || targetIndex >= items.length) {
        if (!loop) return;
        targetIndex = ((targetIndex % items.length) + items.length) % items.length;
      }

      isTransitioningRef.current = true;

      if (!isControlled) {
        setInternalActiveIndex(targetIndex);
      }
      if (onChange) {
        onChange(targetIndex, items[targetIndex]);
      }

      clearTransitionTimer();
      transitionTimerRef.current = setTimeout(() => {
        finishTransition();
      }, 500);
    },
    [items, loop, isControlled, onChange, clearTransitionTimer, finishTransition]
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const swipeConfidenceThreshold = Math.abs(info.offset.x) * info.velocity.x;
      if (
        swipeConfidenceThreshold > SWIPE_VELOCITY_THRESHOLD ||
        Math.abs(info.offset.x) > SWIPE_THRESHOLD
      ) {
        if (info.offset.x < 0) {
          const nextIndex = activeIndex + 1;
          if (nextIndex < items.length || loop) {
            handleSwitch(loop ? ((nextIndex % items.length) + items.length) % items.length : nextIndex);
          }
        } else {
          const prevIndex = activeIndex - 1;
          if (prevIndex >= 0 || loop) {
            handleSwitch(loop ? ((prevIndex % items.length) + items.length) % items.length : prevIndex);
          }
        }
      }
    },
    [activeIndex, items.length, loop, handleSwitch]
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (!isViewModeControlled) {
        setInternalViewMode(mode);
      }
      if (onViewModeChange) {
        onViewModeChange(mode);
      }
    },
    [isViewModeControlled, onViewModeChange]
  );

  const expandHierarchy = useCallback(
    (index: number) => {
      if (getChildren && getChildren(index, items[index]).length > 0) {
        setHierarchyStack((prev) => [...prev, index]);
        if (viewMode !== 'hierarchy') {
          setViewMode('hierarchy');
        }
      }
    },
    [getChildren, items, viewMode, setViewMode]
  );

  const collapseHierarchy = useCallback(() => {
    setHierarchyStack((prev) => {
      if (prev.length <= 1) {
        if (viewMode === 'hierarchy') {
          setViewMode('carousel');
        }
        return [];
      }
      return prev.slice(0, -1);
    });
  }, [viewMode, setViewMode]);

  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        const prevIndex = activeIndex - 1;
        if (prevIndex >= 0 || loop) {
          handleSwitch(loop ? ((prevIndex % items.length) + items.length) % items.length : prevIndex);
        }
      } else if (e.key === 'ArrowRight') {
        const nextIndex = activeIndex + 1;
        if (nextIndex < items.length || loop) {
          handleSwitch(loop ? ((nextIndex % items.length) + items.length) % items.length : nextIndex);
        }
      } else if (e.key === 'Escape' && viewMode === 'hierarchy') {
        collapseHierarchy();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, items.length, loop, enableKeyboard, handleSwitch, viewMode, collapseHierarchy]);

  useEffect(() => {
    return () => {
      clearTransitionTimer();
    };
  }, [clearTransitionTimer]);

  return {
    activeIndex,
    viewMode,
    visibleRange,
    relatedIndices,
    primaryIndex,
    handleSwitch,
    handleDragEnd,
    setViewMode,
    expandHierarchy,
    collapseHierarchy,
  };
}
