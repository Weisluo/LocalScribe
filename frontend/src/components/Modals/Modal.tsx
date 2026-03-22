import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const FOCUSABLE_ELEMENTS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
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
          const firstInput = focusableElements.find(
            (el) => el.tagName === 'INPUT' && el.getAttribute('type') !== 'hidden'
          );
          const firstElement = firstInput || focusableElements[0];
          if (firstElement) {
            firstElement.focus();
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
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (!isOpen || e.key !== 'Tab') return;
      
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleTab);
    }
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen, getFocusableElements]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-opacity duration-200 ease-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose} 
      />
      
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`
          relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[85vh] flex flex-col z-10
          transition-all duration-200 ease-out
          ${isVisible 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-95'
          }
        `}
      >
        <div className="flex items-center justify-between p-6 pb-0 shrink-0">
          <h3 id="modal-title" className="text-lg font-semibold">{title}</h3>
          <button 
            onClick={onClose}
            aria-label="关闭对话框"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className={`
          overflow-y-auto overflow-x-hidden p-6 pt-4
          transition-all duration-200 ease-out
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
        `}>
          {children}
        </div>
      </div>
    </div>
  );
};
