/**
 * EntityBadge（Phase 2 P2-T2，契约 §2.4/§5.1）
 *
 * 纯展示组件：不做数据请求，名称与失效态由 useEntityRefs 解析后传入，
 * 避免列表里逐卡请求（phase2 §6「计数批量，禁止逐卡请求」）。
 *
 * 说明：契约文档写作 prop `ref`，React 18 中 ref 是保留 prop，故冻结为 `entityRef`。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import { shortRefId } from '@/components/Worldbuilding/hooks';
import {
  INVALID_BADGE_CLASS,
  kindLabel,
  moduleBadgeClass,
  moduleLabel,
} from '@/components/Worldbuilding/types';

export interface EntityBadgeProps {
  entityRef: EntityRef;
  /** 已解析的显示名；缺省时显示 id 短号 */
  name?: string;
  size?: 'sm' | 'md';
  showKind?: boolean;
  showModule?: boolean;
  /** 失效引用（索引未命中）：警示 chip + 提示 */
  invalid?: boolean;
  onClick?: (ref: EntityRef) => void;
  className?: string;
  title?: string;
}

const SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'px-1.5 py-0.5 text-[11px] gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
};

export const EntityBadge = ({
  entityRef,
  name,
  size = 'sm',
  showKind = true,
  showModule = false,
  invalid = false,
  onClick,
  className = '',
  title,
}: EntityBadgeProps) => {
  // 冻结 §3.2：缺省显示 id 短号，与 useEntityRefs.resolveName 的回退口径保持一致
  const displayName = name ?? shortRefId(entityRef.id);
  const colorClass = invalid ? INVALID_BADGE_CLASS : moduleBadgeClass(entityRef.module);
  const interactive = !!onClick;

  const content = (
    <>
      {showModule && (
        <span className="opacity-70">{moduleLabel(entityRef.module)}</span>
      )}
      {showKind && (
        <span className="font-medium">{kindLabel(entityRef.kind)}</span>
      )}
      <span className="truncate max-w-[12rem]">{displayName}</span>
      {invalid && <span className="opacity-80">（已失效）</span>}
    </>
  );

  const classes = `inline-flex items-center max-w-full rounded-full border ${SIZE_CLASS[size]} ${colorClass} ${
    interactive
      ? 'cursor-pointer hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
      : ''
  } ${className}`;

  const resolvedTitle =
    title ??
    (invalid
      ? `${moduleLabel(entityRef.module)} · ${kindLabel(entityRef.kind)} · 目标已不存在`
      : `${moduleLabel(entityRef.module)} · ${kindLabel(entityRef.kind)} · ${displayName}`);

  if (interactive) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(entityRef)}
        className={classes}
        title={resolvedTitle}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} title={resolvedTitle}>
      {content}
    </span>
  );
};
