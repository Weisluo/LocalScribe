import { CarouselConfig } from './types';

export const defaultCarouselConfig: Required<CarouselConfig> = {
  perspective: 1400,
  gap: 16,

  activeScale: 1,
  activeOffset: 0,

  sideOffset: '28%',
  sideScale: 0.88,
  sideOpacity: 0.7,
  sideBlur: '1.5px',
  sideRotateY: 3,

  sideHoverGradient: 'rgba(128,128,128,0.15)',
  sideButtonBg: 'rgba(128,128,128,0.55)',
  sideIconClassName: 'text-foreground',

  exitOffset: '55%',
  exitScale: 0.65,

  spring: {
    stiffness: 200,
    damping: 25,
    mass: 1.2,
  },
};

export const cardTransition = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 25,
  mass: 1.2,
};

export const SWIPE_THRESHOLD = 60;
export const SWIPE_VELOCITY_THRESHOLD = 500;
