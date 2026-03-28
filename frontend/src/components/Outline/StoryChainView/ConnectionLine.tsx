// frontend/src/components/Outline/StoryChainView/ConnectionLine.tsx
import type { EventConnection, ConnectionType } from '../types';

interface ConnectionLineProps {
  connection: EventConnection;
  eventPositions: Map<string, { x: number; y: number; width: number; height: number }>;
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
}: ConnectionLineProps) => {
  const fromPos = eventPositions.get(connection.from_event_id);
  const toPos = eventPositions.get(connection.to_event_id);

  if (!fromPos || !toPos) return null;

  const style = connectionStyles[connection.connection_type] || connectionStyles.direct;

  // 计算连接线的起止点
  const startX = fromPos.x + fromPos.width / 2;
  const startY = fromPos.y + fromPos.height;
  const endX = toPos.x + toPos.width / 2;
  const endY = toPos.y;

  // 使用贝塞尔曲线
  const midY = (startY + endY) / 2;
  const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

  const overrideColor = connection.color || style.color;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={overrideColor}
        strokeWidth={connection.thickness || style.strokeWidth}
        strokeDasharray={connection.dashed ? '6 3' : style.strokeDasharray}
        markerEnd={style.markerEnd}
        className="transition-all duration-200"
      />
      {/* 连接标签 */}
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
