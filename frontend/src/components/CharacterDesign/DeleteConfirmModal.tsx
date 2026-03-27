import { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const FOCUSABLE_ELEMENTS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * 删除确认弹窗组件
 *
 * 符合项目整体UI设计风格的确认对话框
 */
export const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '确认删除',
  message = '此操作不可恢复，确定要删除吗？',
  confirmText = '确认删除',
  cancelText = '取消',
  isLoading = false,
}: DeleteConfirmModalProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS));
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
        requestAnimationFrame(() => {
          const focusableElements = getFocusableElements();
          const firstButton = focusableElements.find((el) => el.tagName === 'BUTTON');
          if (firstButton) {
            firstButton.focus();
          }
        });
      });
    } else if (shouldRender) {
      setIsVisible(false);
      closeTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      }, 200);
    }
  }, [isOpen, shouldRender, getFocusableElements]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, isLoading]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-opacity duration-200 ease-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={!isLoading ? onClose : undefined}
      />

      {/* 弹窗内容 */}
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
        className={`
          relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4
          transition-all duration-200 ease-out overflow-hidden
          ${isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2'
          }
        `}
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 p-6 pb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 id="delete-modal-title" className="text-lg font-semibold text-foreground">
              {title}
            </h3>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              aria-label="关闭对话框"
              className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 内容 */}
        <div className="px-6 pb-6">
          <p id="delete-modal-description" className="text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>

        {/* 按钮区域 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-accent/5 border-t border-border/60">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                <span>删除中...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
