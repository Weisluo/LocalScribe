// frontend/src/components/Outline/StoryChainView/ConnectionLine.tsx
import { useEffect, useState } from 'react';
import type { EventConnection, ConnectionType } from '../types';
import './animations.css';

interface ConnectionLineProps {
  connection: EventConnection;
  eventPositions: Map<string, { x: number; y: number; width: number; height: number }>;
  isNew?: boolean;
}

const connectionStyles: Record<ConnectionType, {
  strokeDasharray?: string;
  strokeWidth: number;
  color: string;
  markerEnd: string;
}> = {
  direct: { strokeWidth: 2, color: 'hsl(var(--muted-foreground) / 0.4)', markerEnd: 'url(#arrowhead)' },
  branch: { strokeWidth: 2, color: 'hsl(var(--muted-foreground) / 0.5)', markerEnd: 'url(#arrowhead)' },
  parallel: { strokeWidth: 1.5, color: 'hsl(var(--accent) / 0.5)', markerEnd: 'url(#arrowhead)' },
  merge: { strokeWidth: 2, color: 'hsl(var(--muted-foreground) / 0.5)', markerEnd: 'url(#arrowhead-merge)' },
  loop: { strokeDasharray: '6 3', strokeWidth: 2, color: 'hsl(var(--muted-foreground) / 0.4)', markerEnd: 'url(#arrowhead)' },
  jump: { strokeDasharray: '3 3', strokeWidth: 2, color: 'hsl(var(--accent) / 0.4)', markerEnd: 'url(#arrowhead)' },
};

export const ConnectionLine = ({
  connection,
  eventPositions,
  isNew = false,
}: ConnectionLineProps) => {
  const [isAnimating, setIsAnimating] = useState(isNew);
  const fromPos = eventPositions.get(connection.from_event_id);
  const toPos = eventPositions.get(connection.to_event_id);

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setIsAnimating(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  if (!fromPos || !toPos) return null;

  const style = connectionStyles[connection.connection_type] || connectionStyles.direct;

  const startX = fromPos.x + fromPos.width / 2;
  const startY = fromPos.y + fromPos.height;
  const endX = toPos.x + toPos.width / 2;
  const endY = toPos.y;

  const midY = (startY + endY) / 2;
  const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

  const overrideColor = connection.color || style.color;

  const pathLength = Math.sqrt(
    Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
  );

  return (
    <g className="optimize-animations">
      <path
        d={path}
        fill="none"
        stroke={overrideColor}
        strokeWidth={connection.thickness || style.strokeWidth}
        strokeDasharray={connection.dashed ? '6 3' : style.strokeDasharray}
        markerEnd={style.markerEnd}
        className={`
          ${isAnimating ? 'connection-line-draw' : ''}
          ${connection.connection_type === 'loop' ? 'connection-line-flow' : ''}
        `}
        style={{
          strokeDasharray: isAnimating ? pathLength : undefined,
        }}
      />
      {connection.label && (
        <text
          x={(startX + endX) / 2}
          y={midY - 8}
          textAnchor="middle"
          className="text-[10px] fill-muted-foreground"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

// SVG Definitions for arrowheads
export const SvgDefs = () => (
  <defs>
    <marker
      id="arrowhead"
      markerWidth="8"
      markerHeight="6"
      refX="8"
      refY="3"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L8,3 L0,6 L2,3 Z" fill="hsl(var(--muted-foreground) / 0.4)" />
    </marker>
    <marker
      id="arrowhead-merge"
      markerWidth="10"
      markerHeight="8"
      refX="5"
      refY="8"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L5,8 L10,0" fill="none" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="1.5" />
    </marker>
  </defs>
);
