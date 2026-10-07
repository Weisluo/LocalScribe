/**
 * 聚焦详情内部展示件（Phase 4 P4-T8；politics_ui_design §4.3/§4.8/§4.9）
 *
 * 只做排版、空态与小型交互壳：不发请求、不读数据源，四个分页面板共用。
 * 颜色不单独承载语义，任何色块旁边都保留文字（§4.9 可访问性）。
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { InlineReference } from '@/components/common/InlineReference';
import { useWorld } from '@/components/Worldbuilding/hooks';
import { chipClass, labelClass, sectionTitleClass, toneTextClass } from '../tone';

export interface SectionBlockProps {
  id?: string;
  title: string;
  count?: number;
  /** 标题右侧动作（打开条约簿 / 添加关联等） */
  actions?: ReactNode;
  children: ReactNode;
}

export const SectionBlock = ({ id, title, count, actions, children }: SectionBlockProps) => (
  <section
    id={id}
    data-testid={id}
    className="space-y-2 border-t border-border/30 px-5 py-4 first:border-t-0"
  >
    <div className="flex items-center gap-2">
      <h3 className={sectionTitleClass}>{title}</h3>
      {typeof count === 'number' && <CountPill value={count} />}
      {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
    </div>
    {children}
  </section>
);

export const CountPill = ({ value, label }: { value: number; label?: string }) => (
  <span className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
    {label ? `${label} ${value}` : value}
  </span>
);

/** 概览用的键值行：左侧固定宽度标签，右侧内容可换行 */
export const InfoRow = ({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex items-start gap-2.5">
    <span className={`${labelClass} w-14 shrink-0 pt-0.5`}>{label}</span>
    <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">{children}</div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

/** 局部空态：一句话 + 可选入口，不用大块空态铺满面板（§9.2） */
export const EmptyHint = ({
  text,
  actionLabel,
  onAction,
  icon: Icon,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) => (
  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 px-3 py-2 text-sm text-muted-foreground">
    {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
    <span>{text}</span>
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="text-sm font-medium text-primary transition-colors hover:underline"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

/** 可点击的文字 chip：用于种族 / 体系 / 关联类型等行内引用 */
export const LinkChip = ({
  label,
  onClick,
  tone,
  title,
}: {
  label: string;
  onClick?: () => void;
  tone?: string;
  title?: string;
}) => {
  const classes = `${chipClass} ${toneTextClass(tone)} ${
    onClick ? 'hover:bg-accent/20' : 'cursor-default'
  }`;
  if (!onClick) {
    return (
      <span className={classes} title={title}>
        {label}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} title={title}>
      {label}
    </button>
  );
};

/** 只读信息 chip：明确不可点击（如地图未接入的首府） */
export const StaticChip = ({ label, title }: { label: string; title?: string }) => (
  <span className={`${chipClass} border-border/60 text-muted-foreground`} title={title}>
    {label}
  </span>
);

/**
 * 备注 / 摘要行：只读渲染 @ 行内引用 token 为可点击 chip（§4.8.7/§5.3），
 * 空值整行不渲染。projectId 从 world 查询派生（与 useEntityRefs 同一 queryKey，不额外请求）。
 */
export const NoteRow = ({
  worldId,
  label = '备注',
  value,
  onNavigate,
}: {
  worldId: string;
  label?: string;
  value?: string | null;
  onNavigate?: (ref: EntityRef) => void;
}) => {
  const projectId = useWorld(worldId, { includeItems: true }).data?.project_id;
  if (!value || !value.trim()) return null;
  return (
    <InfoRow label={label}>
      <InlineReference
        value={value}
        readOnly
        worldId={worldId}
        projectId={projectId ?? undefined}
        onNavigate={onNavigate}
        placeholder="未填写"
      />
    </InfoRow>
  );
};

/** 面板内的小图标按钮：必须有 aria-label（§4.9） */
export const IconAction = ({
  icon: Icon,
  label,
  onClick,
  tone = 'muted',
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: 'muted' | 'danger' | 'primary';
  disabled?: boolean;
}) => {
  const toneClass =
    tone === 'danger'
      ? 'hover:text-destructive'
      : tone === 'primary'
        ? 'hover:text-primary'
        : 'hover:text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 ${toneClass} disabled:opacity-40`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
};
