import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // 控制显示状态
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  // 按 ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div 
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-all duration-200 ease-out
          ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}
        `}
        onClick={handleClose} 
      />
      
      {/* 弹窗主体 */}
      <div 
        className={`
          relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6 z-10
          transition-all duration-200 ease-out
          ${isClosing 
            ? 'opacity-0 scale-95' 
            : 'opacity-100 scale-100 animate-in zoom-in-95 fade-in duration-200'
          }
        `}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button 
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className={`
          transition-all duration-200 ease-out
          ${isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-2 fade-in duration-300'}
        `}>
          {children}
        </div>
      </div>
    </div>
  );
}
