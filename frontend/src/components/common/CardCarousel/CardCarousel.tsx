import { useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CardCarouselProps, CardContext, ViewMode } from './types';
import { AnimatedCard } from './AnimatedCard';
import { CardTabs } from './CardTabs';
import { useCardCarousel } from './hooks/useCardCarousel';
import { defaultCarouselConfig, cardTransition } from './config';
import { CardConnectionsLayer } from './CardConnections';

export function CardCarousel<T>({
  items,
  renderItem,
  renderTab,
  getItemId,
  activeIndex: controlledActiveIndex,
  defaultActiveIndex = 0,
  onChange,
  showTabs = true,
  showSideCards = true,
  enableDrag = true,
  enableKeyboard = true,
  loop = false,
  visibleCount = 1,
  carouselConfig = {},
  viewMode: controlledViewMode,
  defaultViewMode = 'carousel',
  onViewModeChange,
  getRelatedIndices,
  getChildren,
  getParent,
  renderConnection,
  className = '',
  style = {},
}: CardCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const config = useMemo(
    () => ({
      ...defaultCarouselConfig,
      ...carouselConfig,
      spring: {
        ...defaultCarouselConfig.spring,
        ...carouselConfig.spring,
      },
    }),
    [carouselConfig]
  );

  const {
    activeIndex,
    viewMode,
    relatedIndices,
    primaryIndex,
    handleSwitch,
    handleDragEnd,
  } = useCardCarousel<T>({
    items,
    activeIndex: controlledActiveIndex,
    defaultActiveIndex,
    onChange,
    loop,
    visibleCount,
    enableKeyboard,
    viewMode: controlledViewMode,
    defaultViewMode,
    onViewModeChange,
    getRelatedIndices,
    getChildren,
    getParent,
  });

  const getCardContext = (index: number, currentViewMode: ViewMode): CardContext => {
    const position = index - activeIndex;
    const isActive = position >= 0 && position < visibleCount;
    const isSide = showSideCards && (position === -1 || position === visibleCount);
    const isLeft = isSide ? position < 0 : undefined;

    const isPrimary = currentViewMode === 'parallel' && index === primaryIndex;
    const isRelated = currentViewMode === 'parallel' && relatedIndices.includes(index);

    return {
      isActive,
      isSide,
      isLeft,
      index,
      position,
      viewMode: currentViewMode,
      isPrimary,
      isRelated,
      relatedIndices,
    };
  };

  const shouldRenderCard = (index: number): boolean => {
    if (viewMode === 'focus') {
      return index === activeIndex;
    }

    if (viewMode === 'parallel') {
      return index === activeIndex || relatedIndices.includes(index);
    }

    if (viewMode === 'hierarchy') {
      return true;
    }

    const position = index - activeIndex;
    if (position >= 0 && position < visibleCount) return true;
    if (showSideCards && (position === -1 || position === visibleCount)) return true;

    return false;
  };

  if (!items.length) return null;

  if (items.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cardTransition}
        className={className}
        style={style}
      >
        {renderItem(items[0], {
          isActive: true,
          isSide: false,
          isLeft: undefined,
          index: 0,
          position: 0,
          viewMode,
          isPrimary: true,
          isRelated: false,
          relatedIndices: [],
        })}
      </motion.div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} style={style}>
      {showTabs && (
        <CardTabs
          items={items}
          activeIndex={activeIndex}
          onSwitch={handleSwitch}
          renderTab={renderTab}
          getItemId={getItemId ?? ((_, index) => String(index))}
        />
      )}

      <div
        ref={containerRef}
        className="relative px-4 py-2"
        style={{
          minHeight: 'calc(100vh - 200px)',
          perspective: config.perspective,
        }}
      >
        {items.map((item, index) => {
          if (!shouldRenderCard(index)) return null;

          const context = getCardContext(index, viewMode);
          const cardKey = getItemId ? getItemId(item, index) : String(index);

          return (
            <AnimatedCard<T>
              key={cardKey}
              item={item}
              index={index}
              context={context}
              config={config}
              onClick={() => handleSwitch(index)}
              onDragEnd={handleDragEnd}
              renderItem={renderItem}
              enableDrag={enableDrag}
            />
          );
        })}
        {relatedIndices.length > 0 && (
          <CardConnectionsLayer
            connections={relatedIndices.map((ri) => ({ from: activeIndex, to: ri }))}
            containerRef={containerRef as React.RefObject<HTMLElement>}
            renderConnection={renderConnection}
          />
        )}
      </div>
    </div>
  );
}
