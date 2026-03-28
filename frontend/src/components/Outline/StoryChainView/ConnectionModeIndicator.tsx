import { X, Link2, ArrowRight } from 'lucide-react';
import type { ConnectionType } from '../types';

interface ConnectionModeIndicatorProps {
  connectionType: ConnectionType;
  connectionSource: string | null;
  onCancel: () => void;
}

const connectionTypeLabels: Record<ConnectionType, { label: string; description: string }> = {
  direct: { 
    label: '直接连接', 
    description: '线性发展，直接连接到下一个事件' 
  },
  branch: { 
    label: '分支连接', 
    description: '条件分支，根据条件选择不同路径' 
  },
  parallel: { 
    label: '并行开始', 
    description: '同时开始的并行事件线' 
  },
  merge: { 
    label: '汇合点', 
    description: '多条事件线汇合到一点' 
  },
  loop: { 
    label: '循环连接', 
    description: '回到之前的事件，形成循环' 
  },
  jump: { 
    label: '跳跃连接', 
    description: '闪回或闪前，时间跳跃' 
  },
};

export const ConnectionModeIndicator = ({
  connectionType,
  connectionSource,
  onCancel,
}: ConnectionModeIndicatorProps) => {
  const typeInfo = connectionTypeLabels[connectionType];

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40
                    animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl
                      bg-primary/10 backdrop-blur-md border border-primary/30
                      shadow-lg">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">连接模式</span>
        </div>

        <div className="w-px h-4 bg-border/60" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">{typeInfo.label}</span>
          <span className="text-xs text-muted-foreground">{typeInfo.description}</span>
        </div>

        {connectionSource && (
          <>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>已选择源事件</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-primary font-medium">点击目标事件</span>
            </div>
          </>
        )}

        {!connectionSource && (
          <>
            <div className="w-px h-4 bg-border/60" />
            <span className="text-xs text-muted-foreground">点击选择源事件</span>
          </>
        )}

        <button
          onClick={onCancel}
          className="ml-2 p-1 rounded-lg hover:bg-primary/20
                     text-muted-foreground hover:text-foreground
                     transition-colors"
          title="取消连接模式"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ConnectionModeIndicator;
