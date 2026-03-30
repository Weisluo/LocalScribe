import { useEffect, useState } from 'react';
import type { EventConnection, ConnectionType } from '../types';
import './animations.css';

interface ConnectionLineProps {
  connection: EventConnection;
  eventPositions: Map<string, { x: number; y: number; width: number; height: number }>;
  isNew?: boolean;
  isSelected?: boolean;
  onSelect?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
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
  isSelected = false,
  onSelect,
  onDelete,
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(connection.id);
    }
  };

  return (
    <g className="optimize-animations" onClick={handleClick}>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
      />
      <path
        d={path}
        fill="none"
        stroke={isSelected ? 'hsl(var(--destructive))' : overrideColor}
        strokeWidth={isSelected ? 3 : (connection.thickness || style.strokeWidth)}
        strokeDasharray={connection.dashed ? '6 3' : style.strokeDasharray}
        markerEnd={style.markerEnd}
        className={`
          ${isAnimating ? 'connection-line-draw' : ''}
          ${connection.connection_type === 'loop' ? 'connection-line-flow' : ''}
          transition-all duration-200
        `}
        style={{
          strokeDasharray: isAnimating ? pathLength : undefined,
          cursor: 'pointer',
        }}
      />
      {isSelected && onDelete && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onDelete(connection.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx={(startX + endX) / 2}
            cy={midY}
            r={14}
            fill="hsl(var(--destructive))"
            className="transition-all duration-200 hover:r-[16]"
          />
          <text
            x={(startX + endX) / 2}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="14"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            ×
          </text>
        </g>
      )}
      {connection.label && (
        <text
          x={(startX + endX) / 2}
          y={midY - 8}
          textAnchor="middle"
          className="text-[10px] fill-muted-foreground pointer-events-none"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

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
