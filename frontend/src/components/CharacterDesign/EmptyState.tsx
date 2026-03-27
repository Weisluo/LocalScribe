import { motion } from 'framer-motion';
import { Users, Plus, Search, Filter } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-characters' | 'no-search-results' | 'no-filter-results' | 'no-selection';
  onAction?: () => void;
}

export const EmptyState = ({ type, onAction }: EmptyStateProps) => {
  const configs = {
    'no-characters': {
      icon: <Users className="h-16 w-16" />,
      title: '还没有人物设定',
      description: '开始创建你的人物角色，为故事注入生命力',
      actionLabel: '创建第一个人物',
      showAction: true,
    },
    'no-search-results': {
      icon: <Search className="h-16 w-16" />,
      title: '未找到匹配的人物',
      description: '尝试使用其他关键词搜索',
      actionLabel: '',
      showAction: false,
    },
    'no-filter-results': {
      icon: <Filter className="h-16 w-16" />,
      title: '没有符合条件的人物',
      description: '尝试调整筛选条件',
      actionLabel: '',
      showAction: false,
    },
    'no-selection': {
      icon: <Users className="h-16 w-16" />,
      title: '人物设定',
      description: '从左侧选择一个人物，或创建新人物',
      actionLabel: '',
      showAction: false,
    },
  };

  const config = configs[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-full text-muted-foreground"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6">
          <div className="text-primary/40">
            {config.icon}
          </div>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/20"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
          className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-accent/20"
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-serif font-semibold text-foreground mb-2"
      >
        {config.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-muted-foreground mb-6 text-center max-w-xs"
      >
        {config.description}
      </motion.p>

      {config.showAction && onAction && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={onAction}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          {config.actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
};

export default EmptyState;
