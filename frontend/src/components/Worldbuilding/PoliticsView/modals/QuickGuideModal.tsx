/**
 * 权力版图引导弹层（Phase 4 P4-T11；politics_ui_design §9.1/§9.3/§10）
 *
 * 三步引导「政权、组织、关系」；引导只是文案，不向表单预填任何默认等级、政体、状态或名称，
 * 可一键跳过、可随时关闭，不影响任何功能可用性。
 */

import { useEffect, useState } from 'react';
import { Handshake, Landmark, Shield } from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';

export interface QuickGuideModalProps {
  open: boolean;
  onClose: () => void;
  onCreatePolity: () => void;
}

const STEPS = [
  {
    icon: Landmark,
    title: '1 政权：立主干',
    description: '必填只有名称与等级，等级可现场新建（label + rank + color）；统治者可跳过。',
  },
  {
    icon: Shield,
    title: '2 组织：挂卫星',
    description: '在政权详情「机构」段添加组织，默认归属于该政权；独立势力可在版图的独立势力带新建。',
  },
  {
    icon: Handshake,
    title: '3 关系：连边',
    description: '拖出关系边（同盟 / 敌对 / 附庸 / 贸易），或从节点发起条约缎带；条款稍后补充。',
  },
] as const;

export const QuickGuideModal = ({ open, onClose, onCreatePolity }: QuickGuideModalProps) => {
  const [step, setStep] = useState(0);

  // 每次打开回到第一步，避免上次进度残留
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Modal isOpen={open} onClose={onClose} title="三步得到一张会生长的版图" size="md">
      <div className="space-y-3" data-testid="politics-guide">
        <div role="tablist" aria-label="引导步骤" className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
          {STEPS.map((item, index) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={index === step}
              onClick={() => setStep(index)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
                index === step
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              }`}
            >
              {index + 1}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            示例只是文案，不会预填任何内容
          </span>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-sm">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-foreground">{current.title}</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{current.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            跳过引导
          </button>
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            disabled={step === 0}
            className="rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-40"
          >
            上一步
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(prev + 1, STEPS.length - 1))}
              className="rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
            >
              下一步
            </button>
          ) : null}
          {step === 0 ? (
            <button
              type="button"
              onClick={onCreatePolity}
              data-testid="politics-guide-create"
              className="ml-auto rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
            >
              创建第一个政权
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default QuickGuideModal;
