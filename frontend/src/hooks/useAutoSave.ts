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
  // 1. 对数据进行防抖
  const debouncedData = useDebounce(data, delay);
  
  // 2. 记录是否是第一次渲染（避免初始化时就触发保存）
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    // 3. 防抖数据变化后，触发保存
    // 只有当标题或内容确实存在时才保存（避免空数据覆盖）
    if (debouncedData.title || debouncedData.content) {
      onSave(debouncedData);
    }
  }, [debouncedData, onSave]);
};
