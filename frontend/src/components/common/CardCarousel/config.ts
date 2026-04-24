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
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
};

export const cardTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

// 内部元素缩放动画配置（更柔和）
export const innerTransition = {
  type: 'spring' as const,
  stiffness: 350,
  damping: 35,
  mass: 0.6,
};

// Filter 动画配置（使用更保守的参数避免性能问题）
export const filterTransition = {
  type: 'spring' as const,
  stiffness: 250,
  damping: 35,
  mass: 0.5,
};

export const SWIPE_THRESHOLD = 60;
export const SWIPE_VELOCITY_THRESHOLD = 500;
