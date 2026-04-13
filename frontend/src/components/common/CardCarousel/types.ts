export type ViewMode = 'carousel' | 'parallel' | 'hierarchy' | 'focus';

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export interface CarouselConfig {
  perspective?: number;
  gap?: number;

  activeScale?: number;
  activeOffset?: number;

  sideOffset?: string;
  sideScale?: number;
  sideOpacity?: number;
  sideBlur?: string;
  sideRotateY?: number;

  sideHoverGradient?: string;
  sideButtonBg?: string;
  sideIconClassName?: string;

  exitOffset?: string;
  exitScale?: number;

  spring?: SpringConfig;
}

export interface CardContext {
  isActive: boolean;
  isSide: boolean;
  isLeft: boolean | undefined;
  index: number;
  position: number;
  viewMode: ViewMode;
  isPrimary: boolean;
  isRelated: boolean;
  relatedIndices: number[];
}

export interface CardCarouselProps<T> {
  items: T[];

  renderItem: (item: T, context: CardContext) => React.ReactNode;
  renderTab?: (item: T, isActive: boolean) => React.ReactNode;
  getItemId?: (item: T, index: number) => string;

  activeIndex?: number;
  defaultActiveIndex?: number;
  onChange?: (index: number, item: T) => void;

  showTabs?: boolean;
  showSideCards?: boolean;
  enableDrag?: boolean;
  enableKeyboard?: boolean;
  loop?: boolean;
  visibleCount?: number;
  carouselConfig?: CarouselConfig;

  viewMode?: ViewMode;
  defaultViewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  getRelatedIndices?: (index: number, item: T) => number[];
  getChildren?: (index: number, item: T) => T[];
  getParent?: (index: number, item: T) => number | null;
  renderConnection?: (fromIndex: number, toIndex: number, fromRect: DOMRect, toRect: DOMRect) => React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
}

export interface AnimatedCardProps<T> {
  item: T;
  index: number;
  context: CardContext;
  config: Required<CarouselConfig>;
  isExiting?: boolean;
  exitDirection?: number;
  onClick?: () => void;
  onDragEnd?: (_event: MouseEvent | TouchEvent | PointerEvent, info: import('framer-motion').PanInfo) => void;
  renderItem: (item: T, context: CardContext) => React.ReactNode;
  enableDrag?: boolean;
}

export interface CardTabsProps<T> {
  items: T[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  renderTab?: (item: T, isActive: boolean) => React.ReactNode;
  getItemId?: (item: T, index: number) => string;
}

export interface CardConnectionsProps {
  fromIndex: number;
  toIndex: number;
  containerRef: React.RefObject<HTMLElement>;
  renderConnection?: (fromIndex: number, toIndex: number, fromRect: DOMRect, toRect: DOMRect) => React.ReactNode;
}

export interface UseCardCarouselReturn<T> {
  activeIndex: number;
  direction: number;
  exitingCard: { index: number; item: T; direction: number } | null;
  viewMode: ViewMode;
  visibleRange: { start: number; end: number };
  relatedIndices: number[];
  primaryIndex: number;
  handleSwitch: (index: number) => void;
  handleDragEnd: (_event: MouseEvent | TouchEvent | PointerEvent, info: import('framer-motion').PanInfo) => void;
  setViewMode: (mode: ViewMode) => void;
  expandHierarchy: (index: number) => void;
  collapseHierarchy: () => void;
}

export interface UseCardCarouselOptions<T> {
  items: T[];
  activeIndex?: number;
  defaultActiveIndex?: number;
  onChange?: (index: number, item: T) => void;
  loop?: boolean;
  visibleCount?: number;
  enableKeyboard?: boolean;
  viewMode?: ViewMode;
  defaultViewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  getRelatedIndices?: (index: number, item: T) => number[];
  getChildren?: (index: number, item: T) => T[];
  getParent?: (index: number, item: T) => number | null;
}
