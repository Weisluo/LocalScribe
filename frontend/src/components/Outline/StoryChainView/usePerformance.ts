/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useEffect, useMemo } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= delay) {
        callbackRef.current(...args);
        lastRunRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastRunRef.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    }) as T,
    [delay]
  );
}

export function useRafCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const rafRef = useRef<number>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: Parameters<T>) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        callbackRef.current(...args);
      });
    }) as T,
    []
  );
}

import React from 'react';

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): {
  ref: (node: HTMLElement | null) => void;
  isVisible: boolean;
} {
  const [isVisible, setIsVisible] = React.useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            setIsVisible(entry.isIntersecting);
          },
          { threshold: 0.1, ...options }
        );
        observerRef.current.observe(node);
      }
    },
    [options]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { ref, isVisible };
}

export function useVirtualization<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 3
): {
  virtualItems: Array<{ index: number; item: T; style: React.CSSProperties }>;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
} {
  const scrollTop = 0;

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const virtualItems = useMemo(() => {
    return items
      .slice(startIndex, endIndex + 1)
      .map((item, index) => ({
        index: startIndex + index,
        item,
        style: {
          position: 'absolute' as const,
          top: (startIndex + index) * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      }));
  }, [items, startIndex, endIndex, itemHeight]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
  };
}

export function useMeasure<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  bounds: { width: number; height: number; left: number; top: number };
} {
  const [bounds, setBounds] = React.useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });
  const ref = useCallback((node: T | null) => {
    if (node) {
      const rect = node.getBoundingClientRect();
      setBounds({
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
      });
    }
  }, []);

  return { ref, bounds };
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }) as T, []);
}
