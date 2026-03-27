import { motion } from 'framer-motion';
import type { CharacterLevel } from '@/types/character';
import { CharacterLevelColors, CharacterLevelSizes } from '@/types/character';

interface CharacterSkeletonProps {
  level?: CharacterLevel;
  count?: number;
}

export const CharacterSkeleton = ({ level = 'support', count = 1 }: CharacterSkeletonProps) => {
  const colors = CharacterLevelColors[level];
  const sizes = CharacterLevelSizes[level];

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="relative bg-card rounded-lg border overflow-hidden"
          style={{
            height: sizes.height,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: colors.barWidth,
              backgroundColor: colors.bar,
            }}
          />
          <div className="flex items-center h-full" style={{ paddingLeft: sizes.padding, paddingRight: sizes.padding }}>
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-lg bg-muted/40"
              style={{ width: sizes.avatar, height: sizes.avatar }}
            />
            <div className="flex-1 ml-3 space-y-2">
              <motion.div
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                className="h-4 bg-muted/40 rounded"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
              <motion.div
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                className="h-3 bg-muted/30 rounded"
                style={{ width: `${40 + Math.random() * 30}%` }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
};

interface CharacterDetailSkeletonProps {
  level?: CharacterLevel;
}

export const CharacterDetailSkeleton = ({ level = 'support' }: CharacterDetailSkeletonProps) => {
  const colors = CharacterLevelColors[level];

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="h-8 w-16 bg-muted/30 rounded-lg"
          />
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
            className="h-8 w-16 bg-muted/30 rounded-lg"
          />
        </div>
        <motion.div
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          className="h-8 w-8 bg-muted/30 rounded-lg"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex-shrink-0 w-[180px] h-[220px] rounded-xl bg-muted/30"
            style={{ borderColor: colors.bar, borderWidth: 2 }}
          />
          <div className="flex-1 space-y-4">
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
              className="h-8 w-32 bg-muted/30 rounded"
            />
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              className="h-4 w-48 bg-muted/30 rounded"
            />
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 + i * 0.1 }}
                  className="h-4 w-20 bg-muted/30 rounded"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 + i * 0.1 }}
              className="h-32 bg-muted/20 rounded-lg"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterSkeleton;
