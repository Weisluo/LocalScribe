import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, X, Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { EconomicCardProps } from '../types';
import { animationConfig, cardVariants, contentVariants } from '../config';
import { RelationGraph } from './RelationGraph';

export const EconomicCard = ({
  entity,
  entityTypeConfig,
  levelConfig,
  allEntities,
  relationTypes,
  onEdit,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAddRelation,
  onEditRelation,
  onDeleteRelation,
  onUpdateDescription,
  onUpdateSpecification,
}: EconomicCardProps) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(entity.description || '');
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [editSpecKey, setEditSpecKey] = useState('');
  const [editSpecValue, setEditSpecValue] = useState('');

  const bgClass = entityTypeConfig?.gradient 
    ? `bg-gradient-to-br ${entityTypeConfig.gradient}` 
    : levelConfig?.bgClass || 'bg-muted/40';
  const borderClass = entityTypeConfig?.border 
    ? `border-2 ${entityTypeConfig.border}` 
    : levelConfig?.borderClass || 'border border-border/50';
  const textClass = levelConfig?.textClass || 'text-foreground';
  const titleSize = levelConfig?.titleSize || 'text-base font-medium';
  const glowColor = entityTypeConfig?.color || levelConfig?.glowColor || 'transparent';

  const maxVisibleItems = entity.level === 'global' ? 6 : entity.level === 'national' ? 4 : entity.level === 'regional' ? 3 : 2;
  const visibleItems = showAllItems ? entity.items : entity.items.slice(0, maxVisibleItems);
  const hasMoreItems = entity.items.length > maxVisibleItems;

  const handleStartEditDesc = () => {
    setEditDesc(entity.description || '');
    setIsEditingDesc(true);
  };

  const handleSaveDesc = () => {
    onUpdateDescription(editDesc.trim());
    setIsEditingDesc(false);
  };

  const handleCancelEditDesc = () => {
    setEditDesc(entity.description || '');
    setIsEditingDesc(false);
  };

  const handleStartEditSpec = (key?: string, value?: string) => {
    setEditSpecKey(key || '');
    setEditSpecValue(value || '');
    setIsEditingSpec(true);
  };

  const handleSaveSpec = () => {
    if (editSpecKey.trim()) {
      const newSpec = { ...(entity.specification || {}) };
      newSpec[editSpecKey.trim()] = editSpecValue.trim();
      onUpdateSpecification(newSpec);
    }
    setIsEditingSpec(false);
    setEditSpecKey('');
    setEditSpecValue('');
  };

  const handleDeleteSpec = (key: string) => {
    const newSpec = { ...(entity.specification || {}) };
    delete newSpec[key];
    onUpdateSpecification(newSpec);
  };

  const isMinorLevel = entity.level === 'local';

  if (isMinorLevel) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
        className={`${levelConfig?.flexBasis || 'flex-[1_1_calc(25%-12px)]'} ${levelConfig?.minHeight || 'min-h-[100px]'} ${levelConfig?.padding || 'p-3'} ${bgClass} ${borderClass} rounded-lg transition-all duration-300 hover:shadow-lg hover:border-muted-foreground/40 group relative cursor-default`}
        whileHover={{ y: -2, scale: 1.01 }}
        transition={animationConfig.spring}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className={`${titleSize} ${textClass} truncate flex items-center gap-1.5`}>
              {entity.icon && <span className="text-base">{entity.icon}</span>}
              {entityTypeConfig?.icon && !entity.icon && (
                <span className="text-base opacity-70">{entityTypeConfig.icon}</span>
              )}
              <span className="truncate">{entity.name}</span>
            </div>
            {entity.unit && (
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span className="truncate">{entity.unit}</span>
              </div>
            )}
            {entity.description && (
              <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">
                {entity.description}
              </p>
            )}
          </div>
          {entity.items.length > 0 && (
            <span className="text-xs bg-muted-foreground/15 text-muted-foreground px-2 py-0.5 rounded-full font-medium ml-2">
              {entity.items.length}
            </span>
          )}
        </div>
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 flex gap-0.5">
          <button 
            onClick={onEdit} 
            className="p-1.5 hover:bg-background/60 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button 
            onClick={onDelete} 
            className="p-1.5 hover:bg-destructive/15 rounded-md text-destructive/70 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`${levelConfig?.flexBasis || 'flex-[1_1_calc(33.333%-12px)]'} ${levelConfig?.minHeight || 'min-h-[130px]'} ${levelConfig?.padding || 'p-4'} ${bgClass} ${borderClass} rounded-xl transition-all duration-300 group relative overflow-hidden cursor-default`}
      whileHover={{ y: -4, scale: 1.005 }}
      transition={animationConfig.spring}
      style={entity.level === 'global' || entity.level === 'national' ? {
        boxShadow: isHovered 
          ? `0 20px 40px -12px ${glowColor}, 0 0 0 1px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
          : `0 10px 30px -10px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
      } : undefined}
    >
      {entity.level === 'global' && (
        <>
          <motion.div 
            className="absolute top-0 right-0 w-48 h-48 rounded-full -translate-y-24 translate-x-24"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.15 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              background: 'radial-gradient(circle, rgba(202, 162, 39, 0.3) 0%, rgba(245, 158, 11, 0.2) 40%, transparent 70%)',
            }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-40 h-40 rounded-full translate-y-20 -translate-x-20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 60%)',
            }}
          />
        </>
      )}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2.5">
          <div className={`${titleSize} ${textClass} flex items-center gap-2.5 flex-wrap`}>
            {entity.icon && (
              <motion.span 
                className="text-2xl"
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...animationConfig.spring }}
              >
                {entity.icon}
              </motion.span>
            )}
            {entityTypeConfig?.icon && !entity.icon && (
              <motion.span 
                className="text-2xl"
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...animationConfig.spring }}
              >
                {entityTypeConfig.icon}
              </motion.span>
            )}
            <span>{entity.name}</span>
            {entityTypeConfig && (
              <motion.span 
                className={`text-xs px-2.5 py-1 rounded-full font-normal ${textClass} bg-opacity-20 border ${entityTypeConfig.border || 'border-border/30'}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {entityTypeConfig.name}
              </motion.span>
            )}
            {levelConfig && (
              <motion.span 
                className={`text-xs px-2.5 py-1 rounded-full font-normal ${
                  entity.level === 'global' 
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border border-yellow-400/30' 
                    : entity.level === 'national'
                    ? 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-400/30'
                    : 'bg-stone-500/15 text-stone-600 dark:text-stone-400 border border-stone-400/20'
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {levelConfig.label || levelConfig.name}
              </motion.span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 flex gap-1 shrink-0">
            <motion.button 
              onClick={onEdit} 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 hover:bg-background/60 rounded-lg transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </motion.button>
            <motion.button 
              onClick={onDelete} 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 hover:bg-destructive/15 rounded-lg text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
        
        {entity.unit && (
          <motion.div 
            className={`text-sm mb-3 ${textClass} flex items-center gap-2`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={`p-1.5 rounded-md ${
              entity.level === 'global' 
                ? 'bg-yellow-500/15' 
                : entity.level === 'national'
                ? 'bg-slate-500/15'
                : 'bg-stone-500/10'
            }`}>
              <Package className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">{entity.unit}</span>
          </motion.div>
        )}
        
        {entity.description && (
          <motion.div 
            className="relative mb-4"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div 
              className="relative px-4 py-3.5 text-sm leading-relaxed"
              style={{
                background: entity.level === 'global' || entity.level === 'national'
                  ? `linear-gradient(145deg, 
                      rgba(255, 253, 248, 0.9) 0%, 
                      rgba(252, 248, 240, 0.8) 50%,
                      rgba(250, 246, 238, 0.85) 100%
                    )`
                  : `linear-gradient(145deg, 
                      rgba(248, 250, 252, 0.9) 0%, 
                      rgba(241, 245, 249, 0.8) 50%,
                      rgba(248, 250, 252, 0.85) 100%
                    )`,
                boxShadow: `
                  inset 2px 2px 8px rgba(0, 0, 0, 0.04),
                  inset -1px -1px 5px rgba(255, 255, 255, 0.6),
                  inset 0 0 15px rgba(180, 165, 145, 0.04)
                `,
                borderRadius: '10px',
                border: entity.level === 'global' 
                  ? '1px solid rgba(202, 162, 39, 0.1)' 
                  : entity.level === 'national'
                  ? '1px solid rgba(148, 163, 184, 0.1)'
                  : '1px solid rgba(100, 116, 139, 0.08)',
              }}
            >
              {isEditingDesc ? (
                <div className="relative z-10">
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-transparent resize-none outline-none text-foreground/85 leading-relaxed min-h-[60px]"
                    placeholder="输入实体描述..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/20">
                    <button
                      onClick={handleCancelEditDesc}
                      className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveDesc}
                      className="px-2.5 py-1 text-xs bg-primary/90 text-primary-foreground rounded-md hover:bg-primary transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="relative z-10 text-foreground/85 cursor-text hover:text-foreground transition-colors group/desc"
                  onClick={handleStartEditDesc}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStartEditDesc();
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="编辑描述"
                >
                  {entity.description}
                  <span className="ml-2 opacity-0 group-hover/desc:opacity-40 text-xs transition-opacity">
                    (点击编辑)
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
        
        <motion.div 
          className="mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  transition={{ delay: idx * 0.04, ...animationConfig.spring }}
                  onClick={() => onEditItem(item)}
                  className="cursor-pointer transition-all duration-200 group/item hover:scale-[1.02]"
                  style={{
                    background: entity.level === 'regional'
                      ? `linear-gradient(145deg, 
                          rgba(248, 250, 252, 0.9) 0%, 
                          rgba(241, 245, 249, 0.8) 50%,
                          rgba(248, 250, 252, 0.85) 100%
                        )`
                      : `linear-gradient(145deg, 
                          rgba(255, 253, 248, 0.88) 0%, 
                          rgba(252, 248, 240, 0.78) 50%,
                          rgba(250, 246, 238, 0.82) 100%
                        )`,
                    boxShadow: entity.level === 'regional'
                      ? `inset 1px 1px 4px rgba(0, 0, 0, 0.03),
                         inset -1px -1px 3px rgba(255, 255, 255, 0.4),
                         inset 0 0 8px rgba(100, 116, 139, 0.03)`
                      : `inset 2px 2px 6px rgba(0, 0, 0, 0.05),
                         inset -1px -1px 4px rgba(255, 255, 255, 0.5),
                         inset 0 0 12px rgba(180, 165, 145, 0.05)`,
                    borderRadius: entity.level === 'regional' ? '8px' : '10px',
                    padding: entity.level === 'regional' ? '8px 12px' : '12px 16px',
                  }}
                >
                  <div className="text-sm font-medium flex items-center gap-2">
                    {item.name}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onDeleteItem(item.id); 
                      }} 
                      className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-destructive/15 rounded transition-all"
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                  {Object.entries(item.content).length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {Object.entries(item.content).map(([k, v]) => (
                        <div key={k} className="text-xs flex items-start gap-1.5">
                          <span className="text-muted-foreground/60 shrink-0 font-medium">{k}:</span>
                          <span className="text-muted-foreground">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <motion.button 
              onClick={onAddItem} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`bg-background/50 backdrop-blur-sm rounded-lg px-4 py-3 cursor-pointer hover:bg-background/70 transition-colors flex items-center gap-2 text-sm border border-dashed border-border/40 text-muted-foreground hover:text-foreground ${entity.level === 'regional' ? 'opacity-60 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <Plus className="h-4 w-4" />
              添加条目
            </motion.button>
          </div>
          {hasMoreItems && (
            <motion.button 
              onClick={() => setShowAllItems(!showAllItems)} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm mt-3 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              {showAllItems ? '收起' : `展开全部 ${entity.items.length} 个条目`}
              <motion.span
                animate={{ rotate: showAllItems ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </motion.button>
          )}
        </motion.div>
        
        {(entity.relations && entity.relations.length > 0) && (
          <motion.div 
            className="mt-4 pt-3 border-t border-border/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <motion.button
              onClick={() => setShowRelations(!showRelations)}
              className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <span className="flex items-center gap-2">
                <span>经济关系</span>
                <span className="text-xs bg-muted-foreground/15 px-2 py-0.5 rounded-full">
                  {entity.relations.length}
                </span>
              </span>
              {showRelations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </motion.button>
            <AnimatePresence>
              {showRelations && (
                <motion.div
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  variants={contentVariants}
                >
                  <RelationGraph
                    entity={entity}
                    allEntities={allEntities}
                    relationTypes={relationTypes}
                    onAddRelation={onAddRelation}
                    onEditRelation={onEditRelation}
                    onDeleteRelation={onDeleteRelation}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        
        {entity.specification && Object.keys(entity.specification).length > 0 && (
          <motion.div 
            className="mt-4 pt-3 border-t border-border/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>详细信息</span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </motion.button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  variants={contentVariants}
                  className="mt-3 space-y-2"
                >
                  {isEditingSpec ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 bg-muted/20 rounded-md p-3"
                    >
                      <input
                        type="text"
                        value={editSpecKey}
                        onChange={(e) => setEditSpecKey(e.target.value)}
                        placeholder="属性名称"
                        className="w-full bg-background border border-border/50 px-3 py-1.5 rounded-md text-sm focus:border-primary focus:outline-none"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editSpecValue}
                        onChange={(e) => setEditSpecValue(e.target.value)}
                        placeholder="属性值"
                        className="w-full bg-background border border-border/50 px-3 py-1.5 rounded-md text-sm focus:border-primary focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditingSpec(false)}
                          className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveSpec}
                          className="px-2.5 py-1 text-xs bg-primary/90 text-primary-foreground rounded-md hover:bg-primary transition-colors"
                        >
                          保存
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      {Object.entries(entity.specification).map(([key, value], idx) => (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-start gap-2 text-sm group/spec"
                        >
                          <span className="text-muted-foreground font-medium shrink-0">{key}:</span>
                          <span className="text-foreground/85 flex-1">{value}</span>
                          <div className="opacity-0 group-hover/spec:opacity-100 transition-opacity flex gap-1">
                            <button
                              onClick={() => handleStartEditSpec(key, value)}
                              className="p-0.5 hover:bg-primary/10 rounded text-primary transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpec(key)}
                              className="p-0.5 hover:bg-destructive/10 rounded text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                      <motion.button
                        onClick={() => handleStartEditSpec()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-background/50 backdrop-blur-sm rounded-md px-3 py-2 cursor-pointer hover:bg-background/70 transition-colors flex items-center justify-center gap-2 text-sm border border-dashed border-border/40 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        添加属性
                      </motion.button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
