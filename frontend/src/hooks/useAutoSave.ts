import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';

interface AutoSaveOptions {
  data: {
    title: string;
    content: string;
  };
  onSave: (data: { title: string; content: string }) => void;
  delay?: number;
}

export const useAutoSave = ({ data, onSave, delay = 800 }: AutoSaveOptions) => {
  const debouncedData = useDebounce(data, delay);
  const isFirstRun = useRef(true);
  const lastSavedDataRef = useRef(data);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      lastSavedDataRef.current = data;
      return;
    }

    // 只有当防抖后的数据与上次真正保存的数据不同时，才触发保存
    if (
      debouncedData.title !== lastSavedDataRef.current.title ||
      debouncedData.content !== lastSavedDataRef.current.content
    ) {
      if (debouncedData.title || debouncedData.content) {
        onSave(debouncedData);
        lastSavedDataRef.current = debouncedData;
      }
    }
  }, [debouncedData, onSave]);
};