import { forwardRef, Ref } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatedCardProps } from './types';
import { cardTransition } from './config';

function AnimatedCardInner<T>(
  {
    item,
    index,
    context,
    config,
    isExiting,
    exitDirection,
    onClick,
    onDragEnd,
    renderItem,
    enableDrag = true,
  }: AnimatedCardProps<T>,
  ref: Ref<HTMLDivElement>
) {
  const { isActive, isSide, isLeft } = context;

  const getTargetStyle = () => {
    if (isExiting && exitDirection !== undefined) {
      const isToRight = exitDirection > 0;
      return {
        x: isToRight ? `-${config.exitOffset}` : config.exitOffset,
        scale: config.exitScale,
        opacity: 0,
        zIndex: 25,
        filter: 'blur(10px) brightness(0.75)',
        rotateY: isToRight ? -20 : 20,
      };
    }
    if (isActive) {
      return {
        x: 0,
        scale: config.activeScale,
        opacity: 1,
        zIndex: 20,
        filter: 'blur(0px) brightness(1)',
        rotateY: 0,
      };
    }
    if (isSide) {
      return {
        x: isLeft ? `-${config.sideOffset}` : config.sideOffset,
        scale: config.sideScale,
        opacity: config.sideOpacity,
        zIndex: 5,
        filter: `blur(${config.sideBlur}) brightness(0.9)`,
        rotateY: isLeft ? config.sideRotateY : -config.sideRotateY,
      };
    }
    return {
      x: 0,
      scale: config.activeScale,
      opacity: 1,
      zIndex: 20,
      filter: 'blur(0px) brightness(1)',
      rotateY: 0,
    };
  };

  const targetStyle = getTargetStyle();

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (onDragEnd) {
      onDragEnd(_event, info);
    }
  };

  return (
    <motion.div
      ref={ref}
      data-card-index={index}
      className="absolute top-0 left-0 right-0 mx-auto cursor-pointer"
      style={{ width: '90%', minHeight: '100%' }}
      initial={isExiting ? false : {
        x: isActive ? (exitDirection && exitDirection > 0 ? '45%' : '-45%') : targetStyle.x,
        scale: isActive ? 0.75 : targetStyle.scale,
        opacity: isActive ? 0.85 : targetStyle.opacity,
        zIndex: isActive ? 15 : targetStyle.zIndex,
        filter: isActive ? 'blur(8px) brightness(0.8)' : targetStyle.filter,
        rotateY: isActive ? (exitDirection && exitDirection > 0 ? 15 : -15) : targetStyle.rotateY,
      }}
      animate={targetStyle}
      exit={{
        x: exitDirection && exitDirection > 0 ? `-${config.exitOffset}` : config.exitOffset,
        scale: config.exitScale,
        opacity: 0,
        zIndex: 25,
        filter: 'blur(10px) brightness(0.75)',
        rotateY: exitDirection && exitDirection > 0 ? -20 : 20,
      }}
      transition={isExiting ? {
        x: { type: 'spring', stiffness: 280, damping: 32, mass: 0.8 },
        scale: { type: 'spring', stiffness: 220, damping: 26, mass: 1 },
        opacity: { duration: 0.4, ease: 'easeOut' },
        filter: { duration: 0.35, ease: 'easeOut' },
        rotateY: { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 },
      } : cardTransition}
      drag={isActive && !isExiting && enableDrag ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={handleDragEnd}
      onClick={!isActive && !isExiting ? onClick : undefined}
    >
      <motion.div
        className={`min-h-full rounded-2xl shadow-2xl bg-background ${
          !isActive ? 'group hover:shadow-xl/110 overflow-hidden' : ''
        }`}
        animate={!isActive && !isExiting ? { scale: 0.95 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 1.1 }}
        style={{
          transformOrigin: isLeft ? 'right center' : isLeft === false ? 'left center' : 'center',
          perspective: config.perspective,
          ...(isSide ? { maxHeight: 'calc(100vh - 240px)', overflow: 'hidden' } : {}),
        }}
      >
        <div className={`min-h-full ${!isActive ? 'pointer-events-none select-none' : ''}`}>
          {renderItem(item, context)}
        </div>

        {!isActive && !isExiting && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center rounded-2xl"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{
              background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, transparent 45%, ${config.sideHoverGradient} 100%)`,
            }}
          >
            <motion.div
              className="p-3 rounded-full backdrop-blur-md shadow-lg border border-white/10"
              style={{ backgroundColor: config.sideButtonBg }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              {isLeft ? (
                <ChevronLeft className={`h-6 w-6 ${config.sideIconClassName}`} />
              ) : (
                <ChevronRight className={`h-6 w-6 ${config.sideIconClassName}`} />
              )}
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export const AnimatedCard = forwardRef(AnimatedCardInner) as <T>(
  props: AnimatedCardProps<T> & { ref?: Ref<HTMLDivElement> }
) => ReturnType<typeof AnimatedCardInner>;

(AnimatedCard as { displayName?: string }).displayName = 'AnimatedCard';
