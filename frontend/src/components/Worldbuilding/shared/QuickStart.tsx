/**
 * QuickStart（Phase 3 P3-T9；races_ui_design §10、systems_ui_design §10）
 *
 * 3 分钟最短路径提示：只在模块为空时出现，按步骤勾选进度；可折叠关闭，
 * 不写入任何持久化存储（避免测试与多世界串味）。
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
      className={`rounded-lg border border-border/50 bg-card/40 ${className}`}
      data-testid="quick-start"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {completed}/{steps.length}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border/40 px-3 py-2">
          {description && (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          )}
          <ol className="space-y-1">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-[11px]">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
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
