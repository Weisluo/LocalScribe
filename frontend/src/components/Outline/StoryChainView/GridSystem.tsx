import { useMemo } from 'react';
import type { GridConfig } from '../types';
import './animations.css';

interface GridOverlayProps {
  config: GridConfig;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

export const GridOverlay = ({
  config,
  canvasWidth,
  canvasHeight,
  zoom,
}: GridOverlayProps) => {
  const shouldShow = config.enabled && zoom >= config.showOnZoom;

  const dots = useMemo(() => {
    if (!shouldShow) return [];

    const dots: { x: number; y: number }[] = [];
    const spacing = config.size;
    
    for (let x = spacing; x < canvasWidth; x += spacing) {
      for (let y = spacing; y < canvasHeight; y += spacing) {
        dots.push({ x, y });
      }
    }
    
    return dots;
  }, [shouldShow, canvasWidth, canvasHeight, config.size]);

  if (!shouldShow) return null;

  const dotSize = zoom > 1 ? config.dotSize : zoom > 0.5 ? config.dotSize * 0.75 : config.dotSize * 0.5;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={dotSize}
          fill={config.color}
        />
      ))}
    </svg>
  );
};

interface AlignmentLinesProps {
  showHorizontal: boolean;
  showVertical: boolean;
  horizontalY: number;
  verticalX: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const AlignmentLines = ({
  showHorizontal,
  showVertical,
  horizontalY,
  verticalX,
  canvasWidth,
  canvasHeight,
}: AlignmentLinesProps) => {
  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10 optimize-animations"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {showHorizontal && (
        <line
          x1={0}
          y1={horizontalY}
          x2={canvasWidth}
          y2={horizontalY}
          stroke="hsl(var(--destructive))"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.8}
          className="alignment-line-horizontal"
        />
      )}
      {showVertical && (
        <line
          x1={verticalX}
          y1={0}
          x2={verticalX}
          y2={canvasHeight}
          stroke="hsl(var(--destructive))"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.8}
          className="alignment-line-vertical"
        />
      )}
    </svg>
  );
};

export function useSnapToGrid(
  config: GridConfig,
  _zoom: number,
  allEventPositions: Map<string, { x: number; y: number; width: number; height: number }>
) {
  const snapPosition = (
    x: number,
    y: number,
    width: number,
    height: number,
    excludeId?: string
  ): { x: number; y: number; showHLine: boolean; showVLine: boolean; hLineY: number; vLineX: number } => {
    let snappedX = x;
    let snappedY = y;
    let showHLine = false;
    let showVLine = false;
    let hLineY = 0;
    let vLineX = 0;

    if (config.snapEnabled) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      const gridX = Math.round(centerX / config.size) * config.size - width / 2;
      const gridY = Math.round(centerY / config.size) * config.size - height / 2;
      
      const distToGridX = Math.abs(gridX - x);
      const distToGridY = Math.abs(gridY - y);
      
      if (distToGridX < 20) {
        snappedX = gridX;
      }
      if (distToGridY < 20) {
        snappedY = gridY;
      }
    }

    const threshold = 5;
    const currentCenterX = snappedX + width / 2;
    const currentCenterY = snappedY + height / 2;
    const currentLeft = snappedX;
    const currentRight = snappedX + width;
    const currentTop = snappedY;
    const currentBottom = snappedY + height;

    allEventPositions.forEach((pos, id) => {
      if (id === excludeId) return;

      const otherCenterX = pos.x + pos.width / 2;
      const otherCenterY = pos.y + pos.height / 2;
      const otherLeft = pos.x;
      const otherRight = pos.x + pos.width;
      const otherTop = pos.y;
      const otherBottom = pos.y + pos.height;

      if (Math.abs(currentCenterX - otherCenterX) < threshold) {
        showVLine = true;
        vLineX = otherCenterX;
        snappedX = otherCenterX - width / 2;
      }
      if (Math.abs(currentLeft - otherLeft) < threshold) {
        showVLine = true;
        vLineX = otherLeft;
        snappedX = otherLeft;
      }
      if (Math.abs(currentRight - otherRight) < threshold) {
        showVLine = true;
        vLineX = otherRight;
        snappedX = otherRight - width;
      }

      if (Math.abs(currentCenterY - otherCenterY) < threshold) {
        showHLine = true;
        hLineY = otherCenterY;
        snappedY = otherCenterY - height / 2;
      }
      if (Math.abs(currentTop - otherTop) < threshold) {
        showHLine = true;
        hLineY = otherTop;
        snappedY = otherTop;
      }
      if (Math.abs(currentBottom - otherBottom) < threshold) {
        showHLine = true;
        hLineY = otherBottom;
        snappedY = otherBottom - height;
      }
    });

    return { x: snappedX, y: snappedY, showHLine, showVLine, hLineY, vLineX };
  };

  return { snapPosition };
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: true,
  snapEnabled: true,
  size: 40,
  color: 'rgba(0, 0, 0, 0.05)',
  dotSize: 2,
  showOnZoom: 0.5,
};

export default GridOverlay;
