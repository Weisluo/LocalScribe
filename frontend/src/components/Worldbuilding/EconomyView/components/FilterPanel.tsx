import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { FilterPanelProps } from '../types';
import { animationConfig } from '../config';

export const FilterPanel = ({
  levels,
  selectedLevel,
  onLevelChange,
  searchQuery,
  onSearchChange,
}: FilterPanelProps) => {
  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索实体名称或描述..."
            className="w-full pl-10 pr-10 py-2.5 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
          />
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted-foreground/10 rounded-md transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.button>
          )}
        </motion.div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium">等级筛选:</span>
        <motion.button
          onClick={() => onLevelChange(undefined)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
            !selectedLevel
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
          }`}
        >
          全部
        </motion.button>
        {levels.map((level, index) => (
          <motion.button
            key={level.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, ...animationConfig.ease }}
            onClick={() => onLevelChange(level.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              selectedLevel === level.id
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
            }`}
          >
            {level.icon && <span className="text-xs">{level.icon}</span>}
            <span>{level.name}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
