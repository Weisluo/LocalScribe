/**
 * 面板内焦点包含（Phase 4 P4 fix；politics_ui_design §5.1.4/§4.9）
 *
 * 聚焦抽屉的窄屏全屏形态与条约簿都是 dialog：Tab 必须在面板内循环，Esc 只关一层。
 * 与 components/Modals/Modal.tsx 保持同一套可聚焦元素选择器与首尾循环规则。
 * - 捕获阶段监听 + stopImmediatePropagation：确保 Esc 只被最内层浮层消费，
 *   不会同时关掉抽屉与主视图（§5.1.4 分层 Esc）。
 * - 未启用时（桌面并排的 complementary 形态）完全不介入键盘事件。
 */

import { useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface FocusTrapOptions {
  /** 只在真正的模态形态（窄屏全屏抽屉 / 条约簿）下启用 */
  active: boolean;
  onEscape: () => void;
}

/** 返回容器 ref：挂到 dialog 根节点上 */
export const useFocusTrap = <T extends HTMLElement>({
  active,
  onEscape,
}: FocusTrapOptions) => {
  const containerRef = useRef<T | null>(null);
  /** onEscape 每次渲染都是新函数：用 ref 保证监听器只挂一次 */
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // 只关一层：拦住同一事件上其它层的 Esc 处理
        event.stopImmediatePropagation();
        escapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const node = containerRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || !node.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (activeElement === last || !node.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active]);

  return containerRef;
};

export default useFocusTrap;
