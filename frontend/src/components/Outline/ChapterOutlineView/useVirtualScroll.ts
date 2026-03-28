import { useRef, useState, useCallback, useMemo } from 'react';

interface VirtualScrollOptions<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualScrollResult<T> {
  virtualItems: Array<{
    item: T;
    index: number;
    style: {
      position: 'absolute';
      top: number;
      left: number;
      width: string;
      height: number;
    };
  }>;
  totalHeight: number;
  containerProps: {
    style: {
      height: number;
      overflow: 'hidden';
      position: 'relative';
    };
    ref: React.RefObject<HTMLDivElement>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  };
  scrollToIndex: (index: number) => void;
}

export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: VirtualScrollOptions<T>): VirtualScrollResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const virtualItems = useMemo(() => {
    const result: VirtualScrollResult<T>['virtualItems'] = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      if (item) {
        result.push({
          item,
          index: i,
          style: {
            position: 'absolute' as const,
            top: i * itemHeight,
            left: 0,
            width: '100%',
            height: itemHeight,
          },
        });
      }
    }
    
    return result;
  }, [items, startIndex, endIndex, itemHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [itemHeight]);

  return {
    virtualItems,
    totalHeight,
    containerProps: {
      style: {
        height: containerHeight,
        overflow: 'hidden',
        position: 'relative',
      },
      ref: containerRef,
      onScroll: handleScroll,
    },
    scrollToIndex,
  };
}
