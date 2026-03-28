import { useState, useCallback, useRef, useEffect } from 'react';
import { Move } from 'lucide-react';
import type { StoryEvent } from '../types';

interface DragState {
  isDragging: boolean;
  dragId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface UseDragOptions {
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  gridSize?: number;
  snapToGrid?: boolean;
}

export function useEventDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  gridSize = 40,
  snapToGrid = true,
}: UseDragOptions = {}) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    eventId: string,
    currentPosition: { x: number; y: number }
  ) => {
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      dragId: eventId,
      startX: currentPosition.x,
      startY: currentPosition.y,
      offsetX,
      offsetY,
    });

    onDragStart?.(eventId);
  }, [onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.dragId) return;

    const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    let newX = e.clientX - canvasRect.left - dragState.offsetX;
    let newY = e.clientY - canvasRect.top - dragState.offsetY;

    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    newX = Math.max(0, newX);
    newY = Math.max(0, newY);

    onDragMove?.(dragState.dragId, newX, newY);
  }, [dragState, gridSize, snapToGrid, onDragMove]);

  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragState.dragId) return;

    const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
    if (!canvas) {
      setDragState(prev => ({ ...prev, isDragging: false, dragId: null }));
      return;
    }

    canvas.getBoundingClientRect();
    const currentElement = document.querySelector(`[data-event-id="${dragState.dragId}"]`) as HTMLElement;
    
    if (currentElement) {
      const transform = currentElement.style.transform;
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      
      if (match) {
        let x = parseFloat(match[1]);
        let y = parseFloat(match[2]);
        
        if (snapToGrid) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        
        onDragEnd?.(dragState.dragId, x, y);
      }
    }

    setDragState(prev => ({ ...prev, isDragging: false, dragId: null }));
  }, [dragState, gridSize, snapToGrid, onDragEnd]);

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return {
    isDragging: dragState.isDragging,
    dragId: dragState.dragId,
    handleMouseDown,
  };
}

interface DraggableEventProps {
  event: StoryEvent;
  position: { x: number; y: number };
  children: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  isDraggable?: boolean;
}

export const DraggableEvent = ({
  event,
  position,
  children,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDraggable = true,
}: DraggableEventProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDraggable || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    onDragStart(event.id);
  }, [isDraggable, event.id, onDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      let newX = e.clientX - canvasRect.left - dragOffset.x;
      let newY = e.clientY - canvasRect.top - dragOffset.y;

      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      onDragMove(event.id, newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const currentRect = elementRef.current?.getBoundingClientRect();
      if (!currentRect) return;

      const newX = currentRect.left - canvasRect.left;
      const newY = currentRect.top - canvasRect.top;

      onDragEnd(event.id, newX, newY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, event.id, onDragMove, onDragEnd]);

  return (
    <div
      ref={elementRef}
      data-event-id={event.id}
      className={`absolute ${isDragging ? 'cursor-grabbing z-50' : 'cursor-grab'}`}
      style={{
        left: position.x,
        top: position.y,
        opacity: isDragging ? 0.9 : 1,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s, opacity 0.2s',
      }}
      onMouseDown={handleMouseDown}
    >
      {isDraggable && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 px-2 py-1 bg-card rounded-md shadow-sm border border-border/40 text-xs text-muted-foreground">
            <Move className="h-3 w-3" />
            拖拽移动
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default DraggableEvent;
