import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';

// 保存结果类型
export type SaveResult = 'success' | 'skipped';

// 保存节流延迟（毫秒）
export const SAVE_THROTTLE_DELAY = 500;

interface AutoSaveOptions {
  data: {
    title: string;
    content: string;
  };
  onSave: (data: { title: string; content: string }) => SaveResult;
  delay?: number;
}

export const useAutoSave = ({ data, onSave, delay = SAVE_THROTTLE_DELAY }: AutoSaveOptions) => {
  const debouncedData = useDebounce(data, delay);
  const isFirstRun = useRef(true);
  const lastSavedDataRef = useRef(data);
  const lastDataRef = useRef(data);
  const previousDataRef = useRef(data);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      lastSavedDataRef.current = data;
      lastDataRef.current = data;
      previousDataRef.current = data;
      return;
    }

    // 检测是否是外部数据更新（如切换章节）
    // 外部更新的特征：data 突然大幅变化（标题和内容都变了）
    const titleChanged = data.title !== lastDataRef.current.title;
    const contentChanged = data.content !== lastDataRef.current.content;
    
    // 如果标题和内容同时变化，很可能是切换章节（外部更新）
    // 因为用户正常输入时，通常只会修改标题或内容其中之一
    const isExternalUpdate = titleChanged && contentChanged;

    // 更新数据引用
    previousDataRef.current = lastDataRef.current;
    lastDataRef.current = data;

    // 只有当防抖后的数据与上次真正保存的数据不同时，才触发保存
    if (
      debouncedData.title !== lastSavedDataRef.current.title ||
      debouncedData.content !== lastSavedDataRef.current.content
    ) {
      // 如果是外部数据更新，直接更新 lastSavedDataRef，不触发保存
      if (isExternalUpdate) {
        lastSavedDataRef.current = debouncedData;
        return;
      }

      // 检查是否有实质内容变化需要保存
      // 如果防抖后的数据与当前数据不一致，说明用户正在输入（防抖时间内），不触发保存
      const isTyping = 
        debouncedData.title !== data.title || 
        debouncedData.content !== data.content;
      
      if (isTyping) {
        // 用户正在输入，等待防抖完成后再保存
        return;
      }

      if (debouncedData.title || debouncedData.content) {
        // 尝试保存，onSave 返回 SaveResult 类型表示保存状态
        const saved = onSave(debouncedData);
        // 只有当保存成功时才更新 lastSavedDataRef
        if (saved === 'success') {
          lastSavedDataRef.current = debouncedData;
        }
      }
    }
  }, [debouncedData, onSave, data]);
};