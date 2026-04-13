import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CardConnectionsProps } from './types';

interface LinePosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function CardConnections({
  fromIndex,
  toIndex,
  containerRef,
  renderConnection,
}: CardConnectionsProps) {
  const [linePosition, setLinePosition] = useState<LinePosition | null>(null);
  const rafIdRef = useRef<number>();
  const isAnimatingRef = useRef(false);

  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const fromCard = container.querySelector(`[data-card-index="${fromIndex}"]`) as HTMLElement;
    const toCard = container.querySelector(`[data-card-index="${toIndex}"]`) as HTMLElement;

    if (!fromCard || !toCard) {
      setLinePosition(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const fromRect = fromCard.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
    const x2 = toRect.left + toRect.width / 2 - containerRect.left;
    const y2 = toRect.top + toRect.height / 2 - containerRect.top;

    setLinePosition({ x1, y1, x2, y2 });
  }, [fromIndex, toIndex, containerRef]);

  const startAnimationTracking = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const tick = () => {
      updatePositions();
      if (isAnimatingRef.current) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [updatePositions]);

  const stopAnimationTracking = useCallback(() => {
    isAnimatingRef.current = false;
    if (rafIdRef.current !== undefined) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    updatePositions();

    const handleResize = () => {
      updatePositions();
    };

    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver((mutations) => {
      const hasAnimation = mutations.some(
        (m) =>
          m.type === 'attributes' &&
          (m.target as HTMLElement).style?.transform !== undefined
      );
      if (hasAnimation) {
        startAnimationTracking();
      } else {
        updatePositions();
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      stopAnimationTracking();
    };
  }, [updatePositions, startAnimationTracking, stopAnimationTracking, containerRef]);

  if (!linePosition) return null;

  if (renderConnection && containerRef.current) {
    const fromCard = containerRef.current.querySelector(`[data-card-index="${fromIndex}"]`) as HTMLElement;
    const toCard = containerRef.current.querySelector(`[data-card-index="${toIndex}"]`) as HTMLElement;

    if (fromCard && toCard) {
      const fromRect = fromCard.getBoundingClientRect();
      const toRect = toCard.getBoundingClientRect();
      return (
        <>
          {renderConnection(fromIndex, toIndex, fromRect, toRect)}
        </>
      );
    }
  }

  const { x1, y1, x2, y2 } = linePosition;
  const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 30 }}
    >
      <defs>
        <linearGradient id={`line-gradient-${fromIndex}-${toIndex}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
        </linearGradient>
        <marker
          id={`arrowhead-${fromIndex}-${toIndex}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="var(--primary)"
            fillOpacity="0.5"
          />
        </marker>
      </defs>

      <motion.path
        d={pathD}
        stroke={`url(#line-gradient-${fromIndex}-${toIndex})`}
        strokeWidth="2"
        strokeDasharray="5,5"
        fill="none"
        markerEnd={`url(#arrowhead-${fromIndex}-${toIndex})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      <motion.circle
        cx={x1}
        cy={y1}
        r="4"
        fill="var(--primary)"
        fillOpacity="0.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      />

      <motion.circle
        cx={x2}
        cy={y2}
        r="4"
        fill="var(--primary)"
        fillOpacity="0.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      />
    </svg>
  );
}

export function CardConnectionsLayer({
  connections,
  containerRef,
  renderConnection,
}: {
  connections: Array<{ from: number; to: number }>;
  containerRef: React.RefObject<HTMLElement>;
  renderConnection?: (fromIndex: number, toIndex: number, fromRect: DOMRect, toRect: DOMRect) => React.ReactNode;
}) {
  return (
    <>
      {connections.map(({ from, to }) => (
        <CardConnections
          key={`connection-${from}-${to}`}
          fromIndex={from}
          toIndex={to}
          containerRef={containerRef}
          renderConnection={renderConnection}
        />
      ))}
    </>
  );
}
