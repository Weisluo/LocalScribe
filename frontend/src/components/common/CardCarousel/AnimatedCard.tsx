import { forwardRef, Ref, useEffect, useMemo } from 'react';
import { motion, type PanInfo, useSpring, useTransform, MotionValue } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatedCardProps } from './types';
import { cardTransition, innerTransition, filterTransition } from './config';

// 自定义 hook 来处理 filter 动画，确保 blur 值不会为负
function useSafeFilterAnimation(
  isActive: boolean,
  isSide: boolean,
  sideBlur: string
) {
  // 解析 sideBlur 数值（例如 "1.5px" -> 1.5）
  const sideBlurValue = useMemo(() => parseFloat(sideBlur) || 1.5, [sideBlur]);
  
  // 目标 blur 值：活动状态为 0，侧边状态为 sideBlurValue
  const targetBlur = isActive ? 0 : isSide ? sideBlurValue : 0;
  const targetBrightness = isActive ? 1 : isSide ? 0.9 : 1;
  
  // 使用优化后的 spring 动画参数
  const blurSpring = useSpring(targetBlur, filterTransition);
  const brightnessSpring = useSpring(targetBrightness, filterTransition);
  
  // 当目标值变化时更新 spring
  useEffect(() => {
    blurSpring.set(targetBlur);
    brightnessSpring.set(targetBrightness);
  }, [targetBlur, targetBrightness, blurSpring, brightnessSpring]);
  
  // 转换 spring 值为 filter 字符串，确保 blur 不为负
  const filter = useTransform(
    [blurSpring, brightnessSpring],
    ([blur, brightness]) => {
      const safeBlur = Math.max(0.01, Math.abs(Number(blur)));
      const safeBrightness = Math.max(0.5, Math.min(1.5, Number(brightness)));
      return `blur(${safeBlur.toFixed(2)}px) brightness(${safeBrightness.toFixed(3)})`;
    }
  );
  
  return filter as MotionValue<string>;
}

// GPU 加速的样式
const gpuAcceleratedStyle = {
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden' as const,
};

function AnimatedCardInner<T>(
  {
    item,
    index,
    context,
    config,
    onClick,
    onDragEnd,
    renderItem,
    enableDrag = true,
  }: AnimatedCardProps<T>,
  ref: Ref<HTMLDivElement>
) {
  const { isActive, isSide, isLeft } = context;
  
  // 使用自定义 hook 获取安全的 filter 值
  const filter = useSafeFilterAnimation(isActive, isSide, config.sideBlur);

  // 使用 useMemo 缓存目标样式，避免不必要的重新计算
  const targetStyle = useMemo(() => {
    if (isActive) {
      return {
        x: 0,
        scale: config.activeScale,
        opacity: 1,
        zIndex: 30,
        rotateY: 0,
      };
    }
    if (isSide) {
      return {
        x: isLeft ? `-${config.sideOffset}` : config.sideOffset,
        scale: config.sideScale,
        opacity: config.sideOpacity,
        zIndex: 10,
        rotateY: isLeft ? config.sideRotateY : -config.sideRotateY,
      };
    }
    return {
      x: 0,
      scale: config.activeScale,
      opacity: 0,
      zIndex: 0,
      rotateY: 0,
    };
  }, [isActive, isSide, isLeft, config]);

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
      style={{ 
        width: '90%', 
        minHeight: '100%',
        filter,
        ...gpuAcceleratedStyle,
      }}
      initial={targetStyle}
      animate={targetStyle}
      transition={cardTransition}
      drag={isActive && enableDrag ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={handleDragEnd}
      onClick={!isActive ? onClick : undefined}
      // 使用 layout={false} 避免不必要的布局计算
      layout={false}
    >
      <motion.div
        className={`min-h-full rounded-2xl shadow-2xl bg-background ${
          !isActive ? 'group hover:shadow-xl/110 overflow-hidden' : ''
        }`}
        animate={!isActive ? { scale: 0.95 } : { scale: 1 }}
        transition={innerTransition}
        style={{
          transformOrigin: isLeft ? 'right center' : isLeft === false ? 'left center' : 'center',
          perspective: config.perspective,
          ...(isSide ? { maxHeight: 'calc(100vh - 240px)', overflow: 'hidden' } : {}),
          ...gpuAcceleratedStyle,
        }}
        layout={false}
      >
        <div className={`min-h-full ${!isActive ? 'pointer-events-none select-none' : ''}`}>
          {renderItem(item, context)}
        </div>

        {isSide && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center rounded-2xl"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, transparent 45%, ${config.sideHoverGradient} 100%)`,
              ...gpuAcceleratedStyle,
            }}
          >
            <motion.div
              className="p-3 rounded-full backdrop-blur-md shadow-lg border border-white/10"
              style={{ backgroundColor: config.sideButtonBg }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
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
