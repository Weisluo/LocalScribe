/**
 * ChipRow（Phase 3 P3-T6；systems_ui_design §4.2/§6.2/§9）
 *
 * 节点详情里的一行关联 chip：标题 + 对端实体徽章。空字段不显示标题（§4.2）；
 * 为空但给了 onAdd 时渲染幽灵占位（§9）。本组件只读展示，增删改一律走 LinkPanel。
 */

import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { EntityBadge } from '@/components/common/EntityBadge';
import { linkCounterpart } from '@/components/Worldbuilding/types';
import type { EntityRef, LinkTypeDef, WorldLink } from '@/services/worldbuildingApi';
import type { EntityRefsResult } from '../../hooks';
import { linkLabelOf } from './systemsSupport';

export interface ChipRowProps {
  title: string;
  links: WorldLink[];
  /** link_type 注册表（契约 §4），用于反向标签与类型名 */
  linkTypes: Map<string, LinkTypeDef>;
  refs: EntityRefsResult;
  onNavigate?: (ref: EntityRef) => void;
  onAdd?: () => void;
  addLabel?: string;
  icon?: LucideIcon;
  /** 行内关联以哪个实体为源；缺省按 link.target 取对端（详情行的关联都是出链） */
  source?: EntityRef;
  className?: string;
  testId?: string;
}

export const ChipRow = ({
  title,
  links,
  linkTypes,
  refs,
  onNavigate,
  onAdd,
  addLabel = '添加',
  icon: Icon,
  source,
  className = '',
  testId,
}: ChipRowProps) => {
  // 空字段不显示标题（systems_ui_design §4.2）；纯空行直接不渲染
  if (links.length === 0 && !onAdd) return null;

  const mixedTypes = new Set(links.map((link) => link.link_type)).size > 1;

  return (
    <div className={`space-y-1.5 ${className}`} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{title}</span>
        {links.length > 0 && (
          <span className="rounded-full bg-muted/40 px-1.5 text-[10px]">{links.length}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {links.map((link) => {
          const target = source ? linkCounterpart(link, source) : link.target;
          const timeText = [link.time?.start, link.time?.end].filter(Boolean).join(' ~ ');
          return (
            <span key={link.id} className="inline-flex items-center gap-1">
              {mixedTypes && (
                <span className="text-xs text-muted-foreground/80">
                  {linkLabelOf(link, linkTypes)}
                </span>
              )}
              <EntityBadge
                entityRef={target}
                name={refs.resolveName(target)}
                invalid={refs.isInvalid(target)}
                onClick={onNavigate}
                title={link.note ?? undefined}
              />
              {timeText && (
                <span className="text-xs text-muted-foreground">{timeText}</span>
              )}
            </span>
          );
        })}

        {links.length === 0 && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
};
