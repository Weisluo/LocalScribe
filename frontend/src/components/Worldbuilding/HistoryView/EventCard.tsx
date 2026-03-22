import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Edit2, Trash2, X, Plus, ChevronDown } from 'lucide-react';
import { EventCardProps } from './types';
import { LEVEL_CONFIG, EVENT_TYPE_CONFIG, animationConfig, cardVariants } from './config';

export const EventCard = ({ event, onEdit, onDelete, onAddItem, onEditItem, onDeleteItem, onUpdateDescription }: EventCardProps) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(event.description || '');
  const [isHovered, setIsHovered] = useState(false);
  
  const typeConfig = event.eventType ? EVENT_TYPE_CONFIG[event.eventType] : null;
  const levelConfig = LEVEL_CONFIG[event.level];
  
  const bgClass = typeConfig ? `bg-gradient-to-br ${typeConfig.gradient}` : levelConfig.bgClass;
  const borderClass = typeConfig ? `border-2 ${typeConfig.border}` : levelConfig.borderClass;
  const textClass = typeConfig ? typeConfig.text : levelConfig.textClass;
  const titleSize = levelConfig.titleSize;
  const glowColor = typeConfig ? typeConfig.color : levelConfig.glowColor;

  const maxVisibleItems = event.level === 'critical' ? 6 : event.level === 'major' ? 3 : event.level === 'normal' ? 2 : 0;
  const visibleItems = showAllItems ? event.items : event.items.slice(0, maxVisibleItems);
  const hasMoreItems = event.items.length > maxVisibleItems;

  const handleStartEditDesc = () => {
    setEditDesc(event.description || '');
    setIsEditingDesc(true);
  };

  const handleSaveDesc = () => {
    onUpdateDescription(editDesc.trim());
    setIsEditingDesc(false);
  };

  const handleCancelEditDesc = () => {
    setEditDesc(event.description || '');
    setIsEditingDesc(false);
  };

  if (event.level === 'minor') {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
        className={`${levelConfig.flexBasis} ${levelConfig.minHeight} ${levelConfig.padding} ${bgClass} ${borderClass} rounded-lg transition-all duration-300 hover:shadow-lg hover:border-muted-foreground/40 group relative cursor-default`}
        whileHover={{ y: -2, scale: 1.01 }}
        transition={animationConfig.spring}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className={`${titleSize} ${textClass} truncate flex items-center gap-1.5`}>
              {typeConfig && <span className="text-base">{typeConfig.icon}</span>}
              {event.icon && !typeConfig && <span className="text-base opacity-70">{event.icon}</span>}
              <span className="truncate">{event.name}</span>
            </div>
            {event.eventDate && (
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span className="truncate">{event.eventDate}</span>
              </div>
            )}
            {event.description && (
              <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">
                {event.description}
              </p>
            )}
          </div>
          {event.items.length > 0 && (
            <span className="text-xs bg-muted-foreground/15 text-muted-foreground px-2 py-0.5 rounded-full font-medium ml-2">
              {event.items.length}
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
      className={`${levelConfig.flexBasis} ${levelConfig.minHeight} ${levelConfig.padding} ${bgClass} ${borderClass} rounded-xl transition-all duration-300 group relative overflow-hidden cursor-default`}
      whileHover={{ y: -4, scale: 1.005 }}
      transition={animationConfig.spring}
      style={event.level === 'critical' ? {
        boxShadow: isHovered 
          ? `0 20px 40px -12px ${glowColor}, 0 0 0 1px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
          : `0 10px 30px -10px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
      } : event.level === 'major' ? {
        boxShadow: isHovered
          ? `0 15px 35px -10px ${glowColor}`
          : `0 8px 25px -8px ${glowColor}`,
      } : undefined}
    >
      {event.level === 'critical' && (
        <>
          <motion.div 
            className="absolute top-0 right-0 w-48 h-48 rounded-full -translate-y-24 translate-x-24"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.15 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)',
            }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-40 h-40 rounded-full translate-y-20 -translate-x-20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 60%)',
            }}
          />
          <motion.div
            className="absolute top-4 left-4 w-2 h-2 rounded-full bg-indigo-400/60"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.6, 0.8, 0.6],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-8 right-8 w-1.5 h-1.5 rounded-full bg-purple-400/50"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
        </>
      )}
      
      {event.level === 'major' && (
        <motion.div 
          className="absolute top-0 right-0 w-36 h-36 rounded-full -translate-y-18 translate-x-18"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.12 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(249, 115, 22, 0.15) 50%, transparent 70%)',
          }}
        />
      )}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2.5">
          <div className={`${titleSize} ${textClass} flex items-center gap-2.5 flex-wrap`}>
            {typeConfig && (
              <motion.span 
                className="text-2xl"
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...animationConfig.spring }}
              >
                {typeConfig.icon}
              </motion.span>
            )}
            {event.icon && !typeConfig && (
              <motion.span 
                className="text-2xl"
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, ...animationConfig.spring }}
              >
                {event.icon}
              </motion.span>
            )}
            <span className={event.level === 'critical' ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent' : ''}>
              {event.name}
            </span>
            {typeConfig && (
              <motion.span 
                className={`text-xs px-2.5 py-1 rounded-full font-normal ${typeConfig.text} bg-opacity-20 border ${typeConfig.border}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {typeConfig.labelCn}
              </motion.span>
            )}
            {!typeConfig && (
              <motion.span 
                className={`text-xs px-2.5 py-1 rounded-full font-normal ${
                  event.level === 'critical' 
                    ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-400/30' 
                    : event.level === 'major'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-400/20'
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {levelConfig.label}
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
        
        {event.eventDate && (
          <motion.div 
            className={`text-sm mb-3 ${textClass} flex items-center gap-2`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={`p-1.5 rounded-md ${
              typeConfig 
                ? `${typeConfig.accent}/15` 
                : event.level === 'critical' 
                ? 'bg-indigo-500/15' 
                : event.level === 'major'
                ? 'bg-amber-500/15'
                : 'bg-slate-500/10'
            }`}>
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">{event.eventDate}</span>
          </motion.div>
        )}
        
        {event.description && (
          <motion.div 
            className="relative mb-4"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div 
              className="relative px-4 py-3.5 text-sm leading-relaxed"
              style={{
                background: event.level === 'critical' || event.level === 'major'
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
                border: event.level === 'critical' 
                  ? '1px solid rgba(99, 102, 241, 0.1)' 
                  : event.level === 'major'
                  ? '1px solid rgba(245, 158, 11, 0.1)'
                  : '1px solid rgba(100, 116, 139, 0.08)',
              }}
            >
              {isEditingDesc ? (
                <div className="relative z-10">
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-transparent resize-none outline-none text-foreground/85 leading-relaxed min-h-[60px]"
                    placeholder="输入事件描述..."
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
                <p 
                  className="relative z-10 text-foreground/85 cursor-text hover:text-foreground transition-colors group/desc"
                  onClick={handleStartEditDesc}
                  title="点击编辑描述"
                >
                  {event.description}
                  <span className="ml-2 opacity-0 group-hover/desc:opacity-40 text-xs transition-opacity">
                    (点击编辑)
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        )}
        
        {(event.level === 'critical' || event.level === 'major' || event.level === 'normal') && (
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
                      background: event.level === 'normal'
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
                      boxShadow: event.level === 'normal'
                        ? `inset 1px 1px 4px rgba(0, 0, 0, 0.03),
                           inset -1px -1px 3px rgba(255, 255, 255, 0.4),
                           inset 0 0 8px rgba(100, 116, 139, 0.03)`
                        : `inset 2px 2px 6px rgba(0, 0, 0, 0.05),
                           inset -1px -1px 4px rgba(255, 255, 255, 0.5),
                           inset 0 0 12px rgba(180, 165, 145, 0.05)`,
                      borderRadius: event.level === 'normal' ? '8px' : '10px',
                      padding: event.level === 'normal' ? '8px 12px' : '12px 16px',
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
                className={`bg-background/50 backdrop-blur-sm rounded-lg px-4 py-3 cursor-pointer hover:bg-background/70 transition-colors flex items-center gap-2 text-sm border border-dashed border-border/40 text-muted-foreground hover:text-foreground ${event.level === 'normal' ? 'opacity-60 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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
                {showAllItems ? '收起' : `展开全部 ${event.items.length} 个条目`}
                <motion.span
                  animate={{ rotate: showAllItems ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
