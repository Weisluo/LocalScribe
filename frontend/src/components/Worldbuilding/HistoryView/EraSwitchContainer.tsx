import { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Era, EraSwitchContainerProps } from './types';
import { ERA_THEME_CONFIG } from './config';
import { flushSync } from 'react-dom';

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;

const cardTransition = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 25,
  mass: 1.2,
};

const EraTabs = ({
  eras,
  activeEraId,
  onSwitchEra,
}: {
  eras: Era[];
  activeEraId: string;
  onSwitchEra: (id: string) => void;
}) => {
  const sortedEras = [...eras].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      <div className="grid auto-cols-fr grid-flow-col items-center gap-1.5 px-4">
        <AnimatePresence mode="popLayout">
          {sortedEras.map((era) => {
            const theme = era.theme ? ERA_THEME_CONFIG[era.theme] : ERA_THEME_CONFIG.ochre;
            const isActive = era.id === activeEraId;

            return (
              <motion.button
                key={era.id}
                layout
                onClick={() => onSwitchEra(era.id)}
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
                    layoutId="era-tab-indicator"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      backgroundColor: theme.bgLight,
                      boxShadow: `0 2px 12px ${theme.bgLight}`,
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
                      backgroundColor: theme.bgLight,
                      opacity: 0.7,
                    }}
                    style={{ opacity: 0 }}
                  />
                )}
                <span
                  className="relative z-10"
                  style={
                    isActive
                      ? { color: theme.accentColor, fontWeight: 600 }
                      : undefined
                  }
                >
                  {era.name}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border/50 to-transparent" />
    </div>
  );
};

interface ExitingCardData {
  era: Era;
  direction: number;
}

interface AnimatedCardProps {
  era: Era;
  isActive: boolean;
  isSide?: boolean;
  isLeft?: boolean;
  isExiting?: boolean;
  exitDirection?: number;
  onClick?: () => void;
  renderEraContent: (era: Era) => React.ReactNode;
  onDragEnd?: (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(({
  era,
  isActive,
  isSide,
  isLeft,
  isExiting,
  exitDirection,
  onClick,
  renderEraContent,
  onDragEnd,
}, ref) => {
  const theme = era.theme ? ERA_THEME_CONFIG[era.theme] : ERA_THEME_CONFIG.ochre;

  const getTargetStyle = () => {
    if (isExiting && exitDirection !== undefined) {
      const isToRight = exitDirection > 0;
      return {
        x: isToRight ? '-55%' : '55%',
        scale: 0.65,
        opacity: 0,
        zIndex: 25,
        filter: 'blur(10px) brightness(0.75)',
        rotateY: isToRight ? -20 : 20,
      };
    }
    if (isActive) {
      return {
        x: 0,
        scale: 1,
        opacity: 1,
        zIndex: 20,
        filter: 'blur(0px) brightness(1)',
        rotateY: 0,
      };
    }
    if (isSide) {
      return {
        x: isLeft ? '-28%' : '28%',
        scale: 0.88,
        opacity: 0.7,
        zIndex: 5,
        filter: 'blur(1.5px) brightness(0.9)',
        rotateY: isLeft ? 3 : -3,
      };
    }
    return {
      x: 0,
      scale: 1,
      opacity: 1,
      zIndex: 20,
      filter: 'blur(0px) brightness(1)',
      rotateY: 0,
    };
  };

  const targetStyle = getTargetStyle();

  return (
    <motion.div
      ref={ref}
      className="absolute top-0 left-0 right-0 mx-auto cursor-pointer"
      style={{ width: '90%', minHeight: '100%' }}
      initial={isExiting ? false : {
        // 入场方向：如果上一个卡片向右退出，新卡片从右侧入场
        x: isActive ? (exitDirection && exitDirection > 0 ? '45%' : '-45%') : targetStyle.x,
        scale: isActive ? 0.75 : targetStyle.scale,
        opacity: isActive ? 0.85 : targetStyle.opacity,
        zIndex: isActive ? 15 : targetStyle.zIndex,
        filter: isActive ? 'blur(8px) brightness(0.8)' : targetStyle.filter,
        // rotateY 方向：从右侧入场时向右旋转，从左侧入场时向左旋转
        rotateY: isActive ? (exitDirection && exitDirection > 0 ? 15 : -15) : targetStyle.rotateY,
      }}
      animate={targetStyle}
      exit={{
        x: exitDirection && exitDirection > 0 ? '-55%' : '55%',
        scale: 0.65,
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
      drag={isActive && !isExiting ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={onDragEnd}
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
          perspective: 1200,
          ...(isSide ? { maxHeight: 'calc(100vh - 240px)', overflow: 'hidden' } : {}),
        }}
      >
        <div className={`min-h-full ${!isActive ? 'pointer-events-none select-none' : ''}`}>
          {renderEraContent(era)}
        </div>

        {!isActive && !isExiting && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center rounded-2xl"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{
              background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, transparent 45%, ${theme.bgLight}60 100%)`,
            }}
          >
            <motion.div
              className="p-3 rounded-full backdrop-blur-md shadow-lg border border-white/10"
              style={{ backgroundColor: `${theme.bgLight}90` }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              {isLeft ? (
                <ChevronLeft className={`h-6 w-6 ${theme.text}`} />
              ) : (
                <ChevronRight className={`h-6 w-6 ${theme.text}`} />
              )}
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
});

AnimatedCard.displayName = 'AnimatedCard';



export const EraSwitchContainer = ({
  eras,
  activeEraId,
  onSwitchEra,
  renderEraContent,
}: EraSwitchContainerProps) => {
  const [direction, setDirection] = useState(0);
  const [exitingCard, setExitingCard] = useState<ExitingCardData | null>(null);
  const prevActiveIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalSwitchRef = useRef(false);

  const sortedEras = [...eras].sort((a, b) => a.order_index - b.order_index);
  const activeIndex = sortedEras.findIndex((e) => e.id === activeEraId);
  const activeEra = activeIndex >= 0 ? sortedEras[activeIndex] : null;

  const prevEra = activeIndex > 0 ? sortedEras[activeIndex - 1] : null;
  const nextEra = activeIndex < sortedEras.length - 1 ? sortedEras[activeIndex + 1] : null;

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const finishTransition = useCallback(() => {
    setExitingCard(null);
    isTransitioningRef.current = false;
    isInternalSwitchRef.current = false;
  }, []);

  useEffect(() => {
    if (prevActiveIdRef.current && prevActiveIdRef.current !== activeEraId && !isTransitioningRef.current && !isInternalSwitchRef.current) {
      const prevIdx = sortedEras.findIndex((e) => e.id === prevActiveIdRef.current);
      const prevEraData = sortedEras[prevIdx];
      if (prevIdx >= 0 && activeIndex >= 0 && prevEraData) {
        const newDirection = activeIndex > prevIdx ? 1 : -1;
        setDirection(newDirection);
        setExitingCard({ era: prevEraData, direction: newDirection });
        isTransitioningRef.current = true;

        clearTransitionTimer();
        transitionTimerRef.current = setTimeout(() => {
          finishTransition();
        }, 600);
      }
    }
    prevActiveIdRef.current = activeEraId;
  }, [activeEraId, activeIndex, sortedEras, clearTransitionTimer, finishTransition]);

  const handleSwitch = useCallback(
    (targetId: string) => {
      if (isTransitioningRef.current) return;
      const targetIdx = sortedEras.findIndex((e) => e.id === targetId);
      if (targetIdx >= 0 && activeIndex >= 0 && activeEra) {
        const newDirection = targetIdx > activeIndex ? 1 : -1;
        isInternalSwitchRef.current = true;
        flushSync(() => {
          setDirection(newDirection);
          setExitingCard({ era: activeEra, direction: newDirection });
        });
      }
      isTransitioningRef.current = true;
      onSwitchEra(targetId);

      clearTransitionTimer();
      transitionTimerRef.current = setTimeout(() => {
        finishTransition();
      }, 600);
    },
    [onSwitchEra, sortedEras, activeIndex, activeEra, clearTransitionTimer, finishTransition]
  );

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const swipeConfidenceThreshold = Math.abs(info.offset.x) * info.velocity.x;
      if (
        swipeConfidenceThreshold > SWIPE_VELOCITY_THRESHOLD ||
        Math.abs(info.offset.x) > SWIPE_THRESHOLD
      ) {
        if (info.offset.x < 0 && nextEra) {
          handleSwitch(nextEra.id);
        } else if (info.offset.x > 0 && prevEra) {
          handleSwitch(prevEra.id);
        }
      }
    },
    [handleSwitch, prevEra, nextEra]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevEra) {
        handleSwitch(prevEra.id);
      } else if (e.key === 'ArrowRight' && nextEra) {
        handleSwitch(nextEra.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevEra, nextEra, handleSwitch]);

  if (!eras.length || !activeEra) return null;

  if (sortedEras.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cardTransition}
      >
        {renderEraContent(activeEra)}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col">
      <EraTabs eras={eras} activeEraId={activeEra.id} onSwitchEra={handleSwitch} />

      <div
        ref={containerRef}
        className="relative px-4 py-2"
        style={{ minHeight: 'calc(100vh - 200px)', perspective: '1400px' }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {prevEra && (
            <AnimatedCard
              key={`side-${prevEra.id}`}
              era={prevEra}
              isActive={false}
              isSide
              isLeft
              onClick={() => handleSwitch(prevEra!.id)}
              renderEraContent={renderEraContent}
            />
          )}

          {nextEra && (
            <AnimatedCard
              key={`side-${nextEra.id}`}
              era={nextEra}
              isActive={false}
              isSide
              isLeft={false}
              onClick={() => handleSwitch(nextEra!.id)}
              renderEraContent={renderEraContent}
            />
          )}

          {activeEra && (
            <AnimatedCard
              key={`active-${activeEra.id}`}
              era={activeEra}
              isActive
              exitDirection={direction}
              onDragEnd={handleDragEnd}
              renderEraContent={renderEraContent}
            />
          )}

          {exitingCard && (
            <AnimatedCard
              key={`exiting-${exitingCard.era.id}`}
              era={exitingCard.era}
              isActive={false}
              isExiting
              exitDirection={exitingCard.direction}
              renderEraContent={renderEraContent}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
