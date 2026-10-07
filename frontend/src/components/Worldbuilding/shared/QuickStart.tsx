/**
 * QuickStart（Phase 3 P3-T9；races_ui_design §10、systems_ui_design §10）
 *
 * 3 分钟最短路径提示：只在模块为空时出现，按步骤勾选进度；可折叠关闭，
 * 不写入任何持久化存储（避免测试与多世界串味）。
 *
 * 视觉对齐 ui_style_alignment §4.9 内容面板配方（rounded-2xl / 面板头 / 分隔线）。
 * 接口不变：{ title, description, steps, className }，data-testid="quick-start" 保留。
 */

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ListChecks } from 'lucide-react';

export interface QuickStartStep {
  label: string;
  done: boolean;
}

export interface QuickStartProps {
  title: string;
  description?: string;
  steps: QuickStartStep[];
  className?: string;
}

export const QuickStart = ({
  title,
  description,
  steps,
  className = '',
}: QuickStartProps) => {
  const [open, setOpen] = useState(true);
  const completed = steps.filter((step) => step.done).length;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-sm ${className}`}
      data-testid="quick-start"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-4 text-left transition-colors duration-200 hover:bg-accent/5"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <ListChecks className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {completed}/{steps.length}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/30 px-5 py-4">
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <ol className="space-y-1.5">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <span className={step.done ? 'text-muted-foreground' : 'text-foreground'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
