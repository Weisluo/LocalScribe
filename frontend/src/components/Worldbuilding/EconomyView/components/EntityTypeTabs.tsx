import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import { EntityTypeTabsProps } from '../types';
import { animationConfig } from '../config';

export const EntityTypeTabs = ({
  entityTypes,
  activeType,
  onTypeChange,
  onAddType,
  onOpenConfig,
}: EntityTypeTabsProps) => {
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <AnimatePresence mode="popLayout">
        {entityTypes.map((type, index) => (
          <motion.button
            key={type.id}
            layout
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ delay: index * 0.04, ...animationConfig.spring }}
            onClick={() => onTypeChange(type.id)}
            className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
              activeType === type.id
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            whileHover={{ scale: activeType === type.id ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {type.icon && <span className="text-base">{type.icon}</span>}
            <span>{type.name}</span>
            {activeType === type.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary rounded-lg -z-10"
                transition={animationConfig.spring}
              />
            )}
          </motion.button>
        ))}
      </AnimatePresence>
      
      <motion.button
        onClick={onAddType}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-3 py-2 rounded-lg bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 flex items-center gap-1.5 text-sm border border-dashed border-border/50"
      >
        <Plus className="h-4 w-4" />
        <span>添加类型</span>
      </motion.button>
      
      <motion.button
        onClick={onOpenConfig}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05, rotate: 90 }}
        whileTap={{ scale: 0.95 }}
        className="p-2 rounded-lg bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 border border-dashed border-border/50"
        title="配置"
      >
        <Settings className="h-4 w-4" />
      </motion.button>
    </div>
  );
};
