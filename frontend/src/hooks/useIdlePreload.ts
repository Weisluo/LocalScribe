import { useEffect, useRef } from 'react';

type ImportFn = () => Promise<unknown>;

export function useIdlePreload(importFns: ImportFn[], delay = 1000) {
  const preloadedRef = useRef(false);

  useEffect(() => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;

    const preload = () => {
      importFns.forEach((importFn) => {
        importFn().catch(() => {});
      });
    };

    if ('requestIdleCallback' in window) {
      const idleCallbackId = requestIdleCallback(
        () => {
          setTimeout(preload, delay);
        },
        { timeout: 5000 }
      );
      return () => cancelIdleCallback(idleCallbackId);
    } else {
      const timerId = setTimeout(preload, delay);
      return () => clearTimeout(timerId);
    }
  }, [importFns, delay]);
}

export function preloadModules(importFns: ImportFn[], delay = 1000) {
  const preload = () => {
    importFns.forEach((importFn) => {
      importFn().catch(() => {});
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        setTimeout(preload, delay);
      },
      { timeout: 5000 }
    );
  } else {
    setTimeout(preload, delay);
  }
}
