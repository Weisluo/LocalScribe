/**
 * 组织次级行（Phase 4 P4-T9；politics_ui_design §4.4/§2.1）
 *
 * 两种形态共用 40px 次级行高，但列语义不同：
 * - OrganizationRow：缩进在所属政权下的卫星行（子类型 / 等级 / 状态 / 存续 / 负责人 / 下辖数），
 *   可拖拽改归属边；
 * - IndependentRow：独立 / 跨国势力分组里的行（scope / 等级 / 状态 / 存续 / 成员 / 吸附政权数），
 *   不缩进也不参与拖拽，形态与政权分组保持差异（§4.4.4）。
 * 子行不做重型内联编辑：字段改写走「表单」或详情面板。
 */

import { CornerDownRight, Pencil, Shield, SquareArrowOutUpRight } from 'lucide-react';

import { lucideIcon } from '../../shared/lucideIcon';
import { politicsKindDef } from '../config';
import type { RosterIndependentRow, UsePoliticsResult } from '../hooks';
import { toneTextClass } from '../tone';
import {
  ORGANIZATION_KIND,
  SCOPE_LABELS,
  normalizeScope,
  readOrganizationMeta,
  type OrganizationEntity,
  type PoliticsEntity,
} from '../types';
import {
  ORPHAN_LABEL,
  UNSET_LABEL,
  countsOfEntity,
  formatTimeSpan,
  levelLabelOf,
  rosterRowHeight,
  statusLabelOf,
} from './rosterSupport';

const OrgIcon = ({ politics }: { politics: UsePoliticsResult }) => {
  const kindDef = politicsKindDef(politics.config, ORGANIZATION_KIND);
  const Icon = lucideIcon(kindDef?.icon) ?? Shield;
  return <Icon className={`h-4 w-4 shrink-0 ${toneTextClass(kindDef?.color)}`} aria-hidden="true" />;
};

const RowActions = ({
  name,
  canEdit,
  onOpen,
  onEditForm,
  entity,
}: {
  name: string;
  canEdit: boolean;
  onOpen: () => void;
  /** 自定义 kind 的实体也走同一条编辑入口，因此按联合类型接收 */
  onEditForm: (entity: PoliticsEntity) => void;
  entity: PoliticsEntity;
}) => (
  <span className="flex w-20 shrink-0 items-center justify-end gap-0.5">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开 ${name}`}
      title="打开聚焦详情"
      className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
    >
      <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={() => onEditForm(entity)}
      disabled={!canEdit}
      aria-label={`编辑 ${name}`}
      title="编辑归属与字段"
      className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-40"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

export interface OrganizationRowProps {
  politics: UsePoliticsResult;
  org: OrganizationEntity;
  /** 负责人：leads 边指向该组织的人物名（无则显示未指定） */
  leaderName?: string;
  /** 下辖组织数（parent_id 指向它） */
  childCount: number;
  canEdit: boolean;
  focused: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** 键盘等价操作：把该组织改归属到当前政权列表里的上一个 / 下一个政权 */
  onMoveToPreviousPolity: () => void;
  onMoveToNextPolity: () => void;
  onOpen: () => void;
  onEditForm: (entity: PoliticsEntity) => void;
}

export const OrganizationRow = ({
  politics,
  org,
  leaderName,
  childCount,
  canEdit,
  focused,
  dragging,
  onDragStart,
  onDragEnd,
  onMoveToPreviousPolity,
  onMoveToNextPolity,
  onOpen,
  onEditForm,
}: OrganizationRowProps) => {
  const meta = readOrganizationMeta(org.meta);
  const subtype = meta.orgSubtypeId
    ? politicsKindDef(politics.config, meta.orgSubtypeId)?.label ?? meta.orgSubtypeId
    : ORPHAN_LABEL;
  const counts = countsOfEntity(politics, org.id, org.kind);

  return (
    <div
      data-testid="roster-organization-row"
      data-entity-id={org.id}
      role="row"
      aria-current={focused ? 'true' : undefined}
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', org.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        // 键盘等价于拖拽改归属：文本输入 / 下拉里的方向键不劫持
        if (!canEdit) return;
        const target = event.target as HTMLElement | null;
        if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onMoveToPreviousPolity();
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onMoveToNextPolity();
        }
      }}
      title="拖到其他政权行可改归属边；键盘：方向键左右改归属，Enter 打开"
      style={{ height: rosterRowHeight('organization') }}
      className={`flex items-center gap-2 border-b border-border/20 pl-7 pr-2 transition-colors motion-reduce:transition-none ${
        focused ? 'bg-primary/5' : 'hover:bg-accent/20'
      } ${dragging ? 'opacity-40' : ''} ${canEdit ? 'cursor-grab' : ''}`}
    >
      <span className="flex w-4 shrink-0 justify-center text-muted-foreground/60" aria-hidden="true">
        <CornerDownRight className="h-3 w-3" />
      </span>
      <span className="w-5 shrink-0" aria-hidden="true" />
      <OrgIcon politics={politics} />
      <button
        type="button"
        onClick={onOpen}
        title={`${org.name}（点击打开详情）`}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {org.name}
      </button>
      <span
        className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground sm:block"
        title={`子类型：${subtype}`}
      >
        {subtype}
      </span>
      <span className="w-20 shrink-0 truncate text-xs text-foreground">
        {meta.level ? levelLabelOf(politics.levels, meta.level) : UNSET_LABEL}
      </span>
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
        {meta.status ? statusLabelOf(politics.statuses, meta.status) : UNSET_LABEL}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground md:block">
        {formatTimeSpan(meta.time)}
      </span>
      <span className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground lg:block">
        {leaderName ?? '未指定负责人'}
      </span>
      <span className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground xl:block">
        下辖 {childCount}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        出{counts.out}/入{counts.in}
      </span>
      <RowActions name={org.name} canEdit={canEdit} onOpen={onOpen} onEditForm={onEditForm} entity={org} />
    </div>
  );
};

export interface IndependentRowProps {
  politics: UsePoliticsResult;
  row: RosterIndependentRow;
  /** 跨国组织吸附的政权数；RosterIndependentRow 未提供该字段，由 index 结算后传入 */
  anchorCount: number;
  canEdit: boolean;
  focused: boolean;
  selected: boolean;
  onSelect: (next: boolean) => void;
  onOpen: () => void;
  /** 自定义 kind 的势力行：实体可能缺 organization 专属 meta，编辑入口按联合类型传导 */
  onEditForm: (entity: PoliticsEntity) => void;
}

export const IndependentRow = ({
  politics,
  row,
  anchorCount,
  canEdit,
  focused,
  selected,
  onSelect,
  onOpen,
  onEditForm,
}: IndependentRowProps) => {
  const meta = readOrganizationMeta(row.entity.meta);
  const counts = countsOfEntity(politics, row.entity.id, row.entity.kind);
  const legacy = row.legacy === true || (row.entity.meta as { legacy?: boolean }).legacy === true;
  return (
    <div
      data-testid="roster-independent-row"
      data-entity-id={row.entity.id}
      data-unattached={row.unattached ? 'true' : undefined}
      role="row"
      aria-current={focused ? 'true' : undefined}
      title={
        row.unattached
          ? '未归属：上溯不到任何政权，需要归入政权请在详情面板里改归属'
          : '独立势力不依附于任何政权；需要归入政权请在详情面板里改归属'
      }
      style={{ height: rosterRowHeight('organization') }}
      className={`flex items-center gap-2 border-b border-border/20 px-2 transition-colors motion-reduce:transition-none ${
        focused ? 'bg-primary/5' : 'hover:bg-accent/20'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!canEdit}
        onChange={(event) => onSelect(event.target.checked)}
        aria-label={`选择组织 ${row.entity.name}`}
        className="h-3.5 w-3.5 shrink-0"
      />
      <span className="w-5 shrink-0" aria-hidden="true" />
      <OrgIcon politics={politics} />
      <button
        type="button"
        onClick={onOpen}
        title={`${row.entity.name}（点击打开详情）`}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.entity.name}
      </button>
      <span className="hidden w-20 shrink-0 truncate text-xs font-medium text-foreground sm:block">
        {SCOPE_LABELS[normalizeScope(row.scope)]}
      </span>
      {row.unattached ? (
        <span className="shrink-0 rounded-full border border-amber-500/50 px-1 text-xs text-amber-700 dark:text-amber-300">
          未归属
        </span>
      ) : null}
      {legacy ? (
        <span className="shrink-0 rounded-full border border-border/60 px-1 text-xs text-muted-foreground">
          旧数据
        </span>
      ) : null}
      <span className="w-20 shrink-0 truncate text-xs text-foreground">
        {meta.level ? levelLabelOf(politics.levels, meta.level) : UNSET_LABEL}
      </span>
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
        {meta.status ? statusLabelOf(politics.statuses, meta.status) : UNSET_LABEL}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground md:block">
        {formatTimeSpan(meta.time)}
      </span>
      <span className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground lg:block">
        成员 {row.memberCount}
      </span>
      <span className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground xl:block">
        {row.scope === 'cross_polity' ? `吸附 ${anchorCount}` : ORPHAN_LABEL}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        出{counts.out}/入{counts.in}
      </span>
      <RowActions
        name={row.entity.name}
        canEdit={canEdit}
        onOpen={onOpen}
        onEditForm={onEditForm}
        entity={row.entity}
      />
    </div>
  );
};

export default OrganizationRow;
