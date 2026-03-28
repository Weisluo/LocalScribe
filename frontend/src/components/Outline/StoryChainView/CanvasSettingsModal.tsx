import { useState, useCallback } from 'react';
import { X, Grid3X3, Magnet, Palette, RotateCcw } from 'lucide-react';
import type { GridConfig } from '../types';

interface CanvasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
}

const GRID_SIZES = [20, 30, 40, 50, 60, 80, 100];

const PRESET_COLORS = [
  { value: 'rgba(0, 0, 0, 0.05)', label: '默认灰' },
  { value: 'rgba(59, 130, 246, 0.1)', label: '蓝色' },
  { value: 'rgba(34, 197, 94, 0.1)', label: '绿色' },
  { value: 'rgba(234, 179, 8, 0.1)', label: '黄色' },
  { value: 'rgba(168, 85, 247, 0.1)', label: '紫色' },
  { value: 'rgba(239, 68, 68, 0.1)', label: '红色' },
];

const DEFAULT_CONFIG: GridConfig = {
  enabled: true,
  snapEnabled: true,
  size: 40,
  color: 'rgba(0, 0, 0, 0.05)',
  dotSize: 2,
  showOnZoom: 0.5,
};

export const CanvasSettingsModal = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
}: CanvasSettingsModalProps) => {
  const [localConfig, setLocalConfig] = useState<GridConfig>(config);

  const updateConfig = useCallback((updates: Partial<GridConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const handleReset = useCallback(() => {
    setLocalConfig(DEFAULT_CONFIG);
  }, []);

  const handleApply = useCallback(() => {
    onConfigChange(localConfig);
    onClose();
  }, [localConfig, onConfigChange, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm mx-4 bg-card rounded-xl shadow-2xl ring-1 ring-border/60 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            画布设置
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground flex items-center gap-2">
              <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
              显示网格
            </label>
            <button
              onClick={() => updateConfig({ enabled: !localConfig.enabled })}
              className={`
                relative w-10 h-5 rounded-full transition-colors duration-200
                ${localConfig.enabled ? 'bg-accent' : 'bg-muted'}
              `}
            >
              <div
                className={`
                  absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm
                  transition-transform duration-200
                  ${localConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'}
                `}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground flex items-center gap-2">
              <Magnet className="h-3.5 w-3.5 text-muted-foreground" />
              启用自动吸附
            </label>
            <button
              onClick={() => updateConfig({ snapEnabled: !localConfig.snapEnabled })}
              className={`
                relative w-10 h-5 rounded-full transition-colors duration-200
                ${localConfig.snapEnabled ? 'bg-accent' : 'bg-muted'}
              `}
            >
              <div
                className={`
                  absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm
                  transition-transform duration-200
                  ${localConfig.snapEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                `}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">网格间距</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={20}
                max={100}
                step={10}
                value={localConfig.size}
                onChange={(e) => updateConfig({ size: parseInt(e.target.value) })}
                className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full 
                         [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-xs text-muted-foreground w-12 text-right">
                {localConfig.size}px
              </span>
            </div>
            <div className="flex gap-1 mt-2">
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => updateConfig({ size })}
                  className={`
                    px-2 py-1 text-[10px] rounded transition-colors
                    ${localConfig.size === size
                      ? 'bg-accent/20 text-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'}
                  `}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-foreground mb-2 flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              网格颜色
            </label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateConfig({ color: color.value })}
                  className={`
                    w-7 h-7 rounded-lg border-2 transition-all
                    ${localConfig.color === color.value
                      ? 'border-accent scale-110'
                      : 'border-transparent hover:border-border'}
                  `}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>当前设置预览</span>
              <span>
                {localConfig.enabled ? '显示' : '隐藏'} · 
                {localConfig.snapEnabled ? '吸附' : '自由'} · 
                {localConfig.size}px
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            恢复默认
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground
                       hover:bg-accent/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg
                       hover:bg-primary/90 transition-colors shadow-sm"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasSettingsModal;
