/**
 * 关联 chip 行 RelationChipRow（Phase 3 P3-T3；races_ui_design §4.2/§6.2/§9）
 *
 * 详情右栏的快捷摘要：按 link_type 白名单从世界级关联里筛出对端 chip，
 * 名称与失效态走 refs.resolveName / refs.isInvalid，点击跳转目标实体。
 * 编辑入口不在这里——增删改一律回到统一 LinkPanel（§5.2）。
 * 无关联时只在给了 onAdd 的情况下渲染幽灵占位（§9 局部空）。
 */

import { Plus } from 'lucide-react';

import { EntityBadge } from '@/components/common/EntityBadge';
import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { linkCounterpart } from '@/components/Worldbuilding/types';

export interface RelationChipRowRefs {
  resolveName: (ref?: EntityRef | null) => string;
  isInvalid: (ref?: EntityRef | null) => boolean;
  isLoading: boolean;
}

export interface RelationChipRowProps {
  links: WorldLink[];
  /** 展示哪些 link_type（契约 §4 白名单，不新增类型） */
  linkTypes: string[];
  label: string;
  refs: RelationChipRowRefs;
  onNavigate: (ref: EntityRef) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** 当前实体：对称关联（如 races.related_to）用它对端，避免显示成自己 */
  sourceRef?: EntityRef;
}

export const RelationChipRow = ({
  links,
  linkTypes,
  label,
  refs,
  onNavigate,
  onAdd,
  addLabel,
  sourceRef,
}: RelationChipRowProps) => {
  const matched = links.filter((link) => linkTypes.includes(link.link_type));

  // 无关联且没有添加入口时整行隐藏（§9：不显示空分组标题）
  if (matched.length === 0 && !onAdd) return null;

  return (
    <div className="space-y-1" data-testid="relation-chip-row" data-row-label={label}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="rounded-full bg-muted/40 px-1.5 text-[10px]">{matched.length}</span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {addLabel ?? '添加'}
          </button>
        )}
      </div>
      {matched.length === 0 ? (
        onAdd ? (
          <div className="text-[11px] text-muted-foreground/60">未记录{label}</div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-1">
          {matched.map((link) => {
            const counterpart = sourceRef ? linkCounterpart(link, sourceRef) : link.target;
            return (
              <EntityBadge
                key={link.id}
                entityRef={counterpart}
                name={refs.resolveName(counterpart)}
                invalid={!refs.isLoading && refs.isInvalid(counterpart)}
                onClick={onNavigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
