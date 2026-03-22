import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { TimelineTooltipProps } from './types';

export const TimelineTooltip = ({ event, position }: TimelineTooltipProps) => {
  if (!event || !position) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: position.y,
        left: position.x,
        transform: 'translate(12px, -50%)',
      }}
    >
      <div
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-gray-900 dark:text-gray-100 text-sm px-4 py-2.5 rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 whitespace-nowrap"
        style={{ 
          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,0.95) 100%)',
          boxShadow: '0 10px 30px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
          <span className="font-semibold">{event.name}</span>
        </div>
        {event.eventDate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {event.eventDate}
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
};
