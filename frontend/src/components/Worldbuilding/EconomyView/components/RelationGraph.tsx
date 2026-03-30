import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { RelationGraphProps, RelationTypeConfig, EconomicEntity, EconomicRelation } from '../types';
import { getRelationTypeConfig } from '../config';

interface RelationNode {
  entity: EconomicEntity;
  relation: EconomicRelation;
  config?: RelationTypeConfig;
  angle: number;
}

const getLineStyle = (lineStyle: string): string => {
  switch (lineStyle) {
    case 'dashed':
      return '8,4';
    case 'dotted':
      return '2,3';
    case 'wavy':
      return '4,2';
    default:
      return '';
  }
};

const Node = ({
  entity,
  x,
  y,
  isCenter,
  onClick,
}: {
  entity: EconomicEntity;
  x: number;
  y: number;
  isCenter: boolean;
  onClick?: () => void;
}) => (
  <motion.g
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
  >
    <motion.circle
      cx={x}
      cy={y}
      r={isCenter ? 40 : 32}
      fill={isCenter ? 'rgba(99, 102, 241, 0.15)' : 'rgba(100, 116, 139, 0.1)'}
      stroke={isCenter ? 'rgb(99, 102, 241)' : 'rgb(100, 116, 139)'}
      strokeWidth={isCenter ? 2 : 1.5}
      whileHover={onClick ? { scale: 1.1 } : {}}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
    <text
      x={x}
      y={y - 8}
      textAnchor="middle"
      className="text-2xl pointer-events-none select-none"
      style={{ dominantBaseline: 'middle' }}
    >
      {entity.icon || '📦'}
    </text>
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      className="text-xs font-medium fill-foreground pointer-events-none select-none"
      style={{ dominantBaseline: 'middle' }}
    >
      {entity.name.length > 10 ? `${entity.name.slice(0, 10)}...` : entity.name}
    </text>
  </motion.g>
);

const RelationLine = ({
  x1,
  y1,
  x2,
  y2,
  config,
  onEdit,
  onDelete,
}: {
  x1: number;
  y1: number;
  y2: number;
  x2: number;
  config: RelationTypeConfig;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const lineStyle = getLineStyle(config.lineStyle);
  const isWavy = config.lineStyle === 'wavy';

  const pathD = isWavy
    ? `M ${x1} ${y1} Q ${midX - 10} ${midY - 15} ${midX} ${midY} Q ${midX + 10} ${midY + 15} ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`;

  const showForwardArrow = config.arrow === '→' || config.arrow === '⟷' || config.arrow === '⇌';
  const showBackwardArrow = config.arrow === '←' || config.arrow === '⟷' || config.arrow === '⇌';

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.path
        d={pathD}
        stroke={config.color || '#64748b'}
        strokeWidth={isHovered ? 3 : 2}
        strokeDasharray={lineStyle}
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />

      {showForwardArrow && (
        <motion.polygon
          points="0,-5 10,0 0,5"
          fill={config.color || '#64748b'}
          transform={`translate(${x2 - 40}, ${y2}) rotate(${angle})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
      )}

      {showBackwardArrow && (
        <motion.polygon
          points="0,-5 -10,0 0,5"
          fill={config.color || '#64748b'}
          transform={`translate(${x1 + 40}, ${y1}) rotate(${angle})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
      )}

      <motion.g
        transform={`translate(${midX}, ${midY})`}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.rect
          x={-30}
          y={-14}
          width={60}
          height={28}
          rx={6}
          fill="rgba(255, 255, 255, 0.95)"
          stroke={config.color || '#64748b'}
          strokeWidth={isHovered ? 2 : 1}
          whileHover={{ scale: 1.05 }}
          style={{ cursor: 'pointer' }}
        />
        <text
          x={0}
          y={-2}
          textAnchor="middle"
          className="text-sm pointer-events-none select-none"
          style={{ dominantBaseline: 'middle' }}
        >
          {config.icon || '🔗'}
        </text>
        <text
          x={0}
          y={8}
          textAnchor="middle"
          className="text-[10px] fill-muted-foreground pointer-events-none select-none"
          style={{ dominantBaseline: 'middle' }}
        >
          {config.name}
        </text>
      </motion.g>

      <AnimatePresence>
        {isHovered && (
          <motion.g
            transform={`translate(${midX}, ${midY - 35})`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
          >
            <motion.rect
              x={-35}
              y={-12}
              width={70}
              height={24}
              rx={4}
              fill="rgba(0, 0, 0, 0.8)"
            />
            <g transform="translate(-15, 0)">
              <circle
                r={8}
                fill="rgba(99, 102, 241, 0.2)"
                stroke="rgb(99, 102, 241)"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onClick={onEdit}
              />
              <Edit2
                x={-4}
                y={-4}
                width={8}
                height={8}
                className="stroke-indigo-400 pointer-events-none"
                strokeWidth={2}
              />
            </g>
            <g transform="translate(15, 0)">
              <circle
                r={8}
                fill="rgba(239, 68, 68, 0.2)"
                stroke="rgb(239, 68, 68)"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onClick={onDelete}
              />
              <Trash2
                x={-4}
                y={-4}
                width={8}
                height={8}
                className="stroke-red-400 pointer-events-none"
                strokeWidth={2}
              />
            </g>
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
};

export const RelationGraph = ({
  entity,
  allEntities,
  relationTypes,
  onAddRelation,
  onEditRelation,
  onDeleteRelation,
}: RelationGraphProps) => {
  const relations = entity.relations || [];

  const centerX = 300;
  const centerY = 250;
  const radius = 160;

  const nodes = useMemo(() => {
    const result: RelationNode[] = [];
    relations.forEach((relation, index) => {
      const targetEntity = allEntities.find((e) => e.id === relation.target_id);
      if (!targetEntity) return;

      const config = getRelationTypeConfig(relation.relationType, relationTypes);
      const angle = (index / relations.length) * 2 * Math.PI - Math.PI / 2;

      result.push({
        entity: targetEntity,
        relation,
        config,
        angle,
      });
    });
    return result;
  }, [relations, allEntities, relationTypes]);

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-50/50 via-white to-slate-100/50 dark:from-slate-900/50 dark:via-slate-900 dark:to-slate-800/50 rounded-xl border border-border/40 overflow-hidden">
      <div className="absolute top-4 right-4 z-10">
        <motion.button
          onClick={onAddRelation}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-500/25 transition-colors"
        >
          <Plus className="h-4 w-4" />
          添加关系
        </motion.button>
      </div>

      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-lg border border-border/40">
          <span className="text-sm text-muted-foreground">关系数量:</span>
          <span className="text-sm font-semibold text-foreground">{relations.length}</span>
        </div>
      </div>

      {relations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">🔗</div>
            <p className="text-lg font-medium mb-2">暂无经济关系</p>
            <p className="text-sm mb-4">点击右上角按钮添加关系</p>
            <motion.button
              onClick={onAddRelation}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors mx-auto"
            >
              <Plus className="h-4 w-4" />
              添加第一个关系
            </motion.button>
          </motion.div>
        </div>
      ) : (
        <svg
          width="100%"
          height="500"
          viewBox="0 0 600 500"
          className="overflow-visible"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <AnimatePresence>
            {nodes.map((node) => {
              const x = centerX + radius * Math.cos(node.angle);
              const y = centerY + radius * Math.sin(node.angle);

              if (!node.config) return null;

              return (
                <g key={node.relation.id}>
                  <RelationLine
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    config={node.config}
                    onEdit={() => onEditRelation(node.relation)}
                    onDelete={() => onDeleteRelation(node.relation.id)}
                  />
                  <Node
                    entity={node.entity}
                    x={x}
                    y={y}
                    isCenter={false}
                  />
                </g>
              );
            })}
          </AnimatePresence>

          <Node entity={entity} x={centerX} y={centerY} isCenter={true} />
        </svg>
      )}

      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {relationTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-background/60 backdrop-blur-sm rounded-md border border-border/30 text-xs"
            >
              <span>{type.icon}</span>
              <span className="text-muted-foreground">{type.name}</span>
              <div
                className="w-8 h-0.5"
                style={{
                  backgroundColor: type.color || '#64748b',
                  borderStyle: type.lineStyle === 'dashed' ? 'dashed' : type.lineStyle === 'dotted' ? 'dotted' : 'solid',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
