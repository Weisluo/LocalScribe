import { motion, AnimatePresence } from 'framer-motion';
import { CardTabsProps } from './types';

export function CardTabs<T>({
  items,
  activeIndex,
  onSwitch,
  renderTab,
  getItemId = (_, index) => String(index),
}: CardTabsProps<T>) {
  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      <div className="grid auto-cols-fr grid-flow-col items-center gap-1.5 px-4">
        <AnimatePresence mode="sync">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const itemId = getItemId(item, index);

            return (
              <motion.button
                key={itemId}
                layout
                onClick={() => onSwitch(index)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                className={`
                  relative px-4 py-1.5 rounded-xl text-sm font-medium overflow-hidden
                  ${isActive ? '' : 'text-muted-foreground hover:text-foreground'}
                `}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="card-tab-indicator"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    style={{
                      boxShadow: '0 2px 12px var(--primary)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                      mass: 0.8,
                    }}
                  />
                )}
                {!isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    initial={false}
                    whileHover={{
                      backgroundColor: 'var(--primary)',
                      opacity: 0.1,
                    }}
                    style={{ opacity: 0 }}
                  />
                )}
                <span
                  className="relative z-10"
                  style={
                    isActive
                      ? { color: 'var(--primary)', fontWeight: 600 }
                      : undefined
                  }
                >
                  {renderTab ? renderTab(item, isActive) : String(item)}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border/50 to-transparent" />
    </div>
  );
}
