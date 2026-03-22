import { motion } from 'framer-motion';

export const HistorySkeleton = () => (
  <div className="space-y-8">
    {[1, 2].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl border border-accent/20 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-8 h-8 rounded-lg bg-accent/20"
          />
          <div className="flex-1 space-y-2">
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
              className="h-5 w-32 bg-accent/20 rounded"
            />
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              className="h-3 w-48 bg-muted/30 rounded"
            />
          </div>
        </div>
        <div className="px-5 pb-5 ml-11 flex flex-wrap gap-4">
          {[1, 2, 3].map((j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: j * 0.1 }}
              className="h-24 w-64 bg-muted/20 rounded-lg"
            />
          ))}
        </div>
      </motion.div>
    ))}
  </div>
);
