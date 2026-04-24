import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardCarousel, CardContext } from '@/components/common/CardCarousel';
import { Era, EraSwitchContainerProps } from './types';
import { ERA_THEME_CONFIG } from './config';

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
        <AnimatePresence mode="sync">
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

export const EraSwitchContainer = ({
  eras,
  activeEraId,
  onSwitchEra,
  renderEraContent,
}: EraSwitchContainerProps) => {
  const sortedEras = [...eras].sort((a, b) => a.order_index - b.order_index);
  const activeIndex = sortedEras.findIndex((e) => e.id === activeEraId);

  const activeEra = activeIndex >= 0 ? sortedEras[activeIndex] : null;
  const activeTheme = activeEra?.theme ? ERA_THEME_CONFIG[activeEra.theme] : ERA_THEME_CONFIG.ochre;

  const carouselConfig = useMemo(() => ({
    perspective: 1400,
    sideOffset: '28%',
    sideScale: 0.88,
    sideOpacity: 0.7,
    sideBlur: '1.5px',
    sideRotateY: 3,
    sideHoverGradient: `${activeTheme.bgLight}60`,
    sideButtonBg: `${activeTheme.bgLight}90`,
    sideIconClassName: activeTheme.text,
    exitOffset: '55%',
    exitScale: 0.65,
    spring: {
      stiffness: 200,
      damping: 25,
      mass: 1.2,
    },
  }), [activeTheme]);

  const handleEraChange = useCallback(
    (_index: number, era: Era) => {
      onSwitchEra(era.id);
    },
    [onSwitchEra]
  );

  const renderEraItem = useCallback(
    (era: Era, _context: CardContext) => {
      return renderEraContent(era);
    },
    [renderEraContent]
  );

  if (!eras.length || activeIndex < 0) return null;

  if (sortedEras.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 25,
          mass: 1.2,
        }}
      >
        {renderEraContent(sortedEras[0])}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col">
      <EraTabs
        eras={eras}
        activeEraId={activeEraId || ''}
        onSwitchEra={onSwitchEra}
      />

      <CardCarousel
        items={sortedEras}
        activeIndex={activeIndex}
        onChange={handleEraChange}
        showTabs={false}
        getItemId={(era) => era.id}
        renderItem={renderEraItem}
        carouselConfig={carouselConfig}
      />
    </div>
  );
};
