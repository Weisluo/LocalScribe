/**
 * 名录视图（Phase 4 P4-T9；politics_ui_design §4.4/§8/§9.2/§11.1/§11.3）
 *
 * 权重形态（四类不得拉平，§2.4）：
 * - 政权主行 56px：名称 / 等级 / 状态 / 存续 / 政体 / 首府 / 卫星 / 人物 / 关系 / 更新 / 打开，可原地展开、可内联编辑；
 * - 组织次级行 40px：缩进在所属政权下，可拖拽改归属边；独立 / 跨国势力单独分组，不缩进也不参与拖拽；
 * - 人物紧凑行 32px：头像 + 政治身份 + 当前任职，点击打开轻量侧栏；
 * - 条约折叠区块 36px：默认折叠，展开后进入条约簿表形态，完整检索在次级抽屉。
 *
 * 峰值保护：行数 > ROSTER_VIRTUAL_LIMIT（200）时启用 useVirtualRows（§11.1.5）：
 * 异质行高（56/40/40/32/28）用前缀和偏移表 + 二分查找定位可视窗口，不再用平均行高近似。
 * 速写档只保留政权主行与计数（§8.2）；地图未接入时首府只读、不给入口（§6.7）。
 * 上溯不到政权的组织单列「未归属」分组，绝不静默消失（§9）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, SearchX, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EmptyState } from '../../shared/EmptyState';
import {
  matchesFilter,
  type RosterIndependentRow,
  type RosterPolityRow,
  type RosterTreatyRow,
  type UsePoliticsResult,
} from '../hooks';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_LINK_TYPES,
  POLITY_KIND,
  SCOPE_LABELS,
  TREATY_KIND,
  normalizeScope,
  politicsRefOf,
  readOrganizationMeta,
  type FigureEntity,
  type OrganizationEntity,
  type PoliticsEntity,
  type PoliticsMetaBase,
} from '../types';
import type { PoliticsFilterState } from '../hooks';
import { BulkBar } from './BulkBar';
import { FigureRow } from './FigureRow';
import { IndependentRow, OrganizationRow } from './OrganizationRow';
import { OrgMoveDialog } from './OrgMoveDialog';
import { PolityRow, PolityRowHeader } from './PolityRow';
import { TreatyBlock } from './TreatyBlock';
import { useVirtualRows } from './useVirtualRows';
import {
  hasActiveFilter,
  levelLabelOf,
  rosterRowHeight,
  shiftTimeSpan,
  withoutKind,
} from './rosterSupport';

export interface RosterProps {
  politics: UsePoliticsResult;
  filter: PoliticsFilterState;
  focusedId: string | null;
  onOpen: (entityId: string) => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onOpenTreatyBook: () => void;
  onCreateKind: (kind: string) => void;
  onEditKind: (entity: PoliticsEntity) => void;
  /** 空态「清除筛选」入口：筛选状态在壳里，由壳统一重置（§9.2） */
  onResetFilter: () => void;
}

const SECTION_HEIGHT = 28;
const FIGURE_ROW_HEIGHT = rosterRowHeight('figure');
const ORG_ROW_HEIGHT = rosterRowHeight('organization');

interface PolityBlock {
  row: RosterPolityRow;
  orgs: OrganizationEntity[];
  figures: RosterPolityRow['figures'];
}

type RosterListItem =
  | {
      key: string;
      type: 'section';
      id: string;
      label: string;
      hint: string;
      count: number;
      open: boolean;
      onToggle: () => void;
      height: number;
    }
  | { key: string; type: 'polity'; id: string; row: RosterPolityRow; block: PolityBlock; height: number }
  | {
      key: string;
      type: 'organization';
      id: string;
      org: OrganizationEntity;
      parentPolityId: string;
      height: number;
    }
  | {
      key: string;
      type: 'figure';
      id: string;
      figure: FigureEntity;
      office?: string;
      start?: string;
      end?: string;
      isPrimary: boolean;
      height: number;
    }
  | { key: string; type: 'independent'; id: string; row: RosterIndependentRow; height: number };

interface MoveRequest {
  orgId: string;
  orgName: string;
  fromPolityId?: string;
  toPolityId: string;
}

export const Roster = ({
  politics,
  filter,
  focusedId,
  onOpen,
  onNavigateToEntity,
  onOpenTreatyBook,
  onCreateKind,
  onEditKind,
  onResetFilter,
}: RosterProps) => {
  const baseFilter = useMemo(() => withoutKind(filter), [filter]);
  const levels = politics.levels ?? [];
  const statuses = politics.statuses ?? [];

  const showPolities = filter.kind === 'all' || filter.kind === POLITY_KIND;
  const showOrganizations = filter.kind === 'all' || filter.kind === ORGANIZATION_KIND;
  const showFigures = filter.kind === 'all' || filter.kind === FIGURE_KIND;
  const showTreaties = filter.kind === 'all' || filter.kind === TREATY_KIND;
  // §8.2：速写档隐藏卫星 / 人物 / 条约层，只保留政权主行与计数
  const organizationsEnabled = politics.capabilities.satellites;
  const figuresEnabled = politics.capabilities.tenureBands;
  const treatiesEnabled = politics.capabilities.treatyRibbons;

  const [collapsedPolities, setCollapsedPolities] = useState<Set<string>>(new Set());
  const [unattachedOpen, setUnattachedOpen] = useState(true);
  const [independentOpen, setIndependentOpen] = useState(true);
  const [figuresOpen, setFiguresOpen] = useState(false);
  const [treatiesOpen, setTreatiesOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<
    { type: 'polity' | 'organization'; id: string; parentPolityId?: string } | null
  >(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [movePending, setMovePending] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  /* ---------------------------------------------------------------- *
   * 行数据：全部消费 politics.roster*（§11.2 客户端聚合，组件不重算）
   * ---------------------------------------------------------------- */

  const visibleBlocks = useMemo<PolityBlock[]>(() => {
    const blocks = politics.rosterPolities.map((row) => ({
      row,
      orgs:
        organizationsEnabled && showOrganizations
          ? row.organizations.filter((org) => matchesFilter(org, baseFilter))
          : [],
      figures:
        figuresEnabled && showFigures
          ? row.figures.filter((item) => matchesFilter(item.entity, baseFilter))
          : [],
    }));
    return blocks.filter((block) => {
      const selfMatch = matchesFilter(block.row.polity, baseFilter);
      const hasChildren = block.orgs.length > 0 || block.figures.length > 0;
      // 过滤到组织 / 人物时，保留政权行作为上级容器，形态不变
      return showPolities ? selfMatch || hasChildren : hasChildren;
    });
  }, [
    baseFilter,
    figuresEnabled,
    organizationsEnabled,
    politics.rosterPolities,
    showFigures,
    showOrganizations,
    showPolities,
  ]);

  /**
   * 独立 / 跨国 / 未归属势力带。
   * 未归属（上溯不到政权）单列一组：速写档也不隐藏，否则实体会在名录里再次消失（§9）。
   */
  const independents = useMemo<RosterIndependentRow[]>(
    () =>
      showOrganizations
        ? politics.rosterIndependents.filter((row) => matchesFilter(row.entity, baseFilter))
        : [],
    [baseFilter, politics.rosterIndependents, showOrganizations]
  );

  const unattachedIndependents = useMemo(
    () => independents.filter((row) => row.unattached === true),
    [independents]
  );
  const attachedIndependents = useMemo(
    () => independents.filter((row) => row.unattached !== true),
    [independents]
  );

  const treaties = useMemo<RosterTreatyRow[]>(
    () =>
      treatiesEnabled && showTreaties
        ? politics.rosterTreaties.filter((row) => matchesFilter(row.treaty, baseFilter))
        : [],
    [baseFilter, politics.rosterTreaties, showTreaties, treatiesEnabled]
  );

  const nestedFigureIds = useMemo(
    () => new Set(visibleBlocks.flatMap((block) => block.figures.map((item) => item.entity.id))),
    [visibleBlocks]
  );

  const orphanFigures = useMemo(
    () =>
      figuresEnabled && showFigures
        ? politics.figures.filter(
            (figure) => matchesFilter(figure, baseFilter) && !nestedFigureIds.has(figure.id)
          )
        : [],
    [baseFilter, figuresEnabled, nestedFigureIds, politics.figures, showFigures]
  );

  /** 当前可见的全部可选 id：数据变化 / 筛选变化后据此裁剪多选，避免对隐藏项写入（§4.4.5） */
  const visibleSelectableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of visibleBlocks) {
      ids.add(block.row.polity.id);
      for (const org of block.orgs) ids.add(org.id);
      for (const figure of block.figures) ids.add(figure.entity.id);
    }
    for (const row of independents) ids.add(row.entity.id);
    for (const row of treaties) ids.add(row.treaty.id);
    return ids;
  }, [independents, treaties, visibleBlocks]);

  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleSelectableIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleSelectableIds]);

  /**
   * 负责人 / 下辖数 / 吸附政权数在 RosterRow 里没有字段：
   * 用世界级 links 与 parent_id 做一次 O(links) 结算，避免逐行扫描。
   */
  const orgExtras = useMemo(() => {
    const leaders = new Map<string, string>();
    const children = new Map<string, number>();
    const anchors = new Map<string, Set<string>>();
    for (const link of politics.links) {
      if (link.link_type === POLITICS_LINK_TYPES.leads && link.source.module === 'politics') {
        if (link.target.kind === ORGANIZATION_KIND && !leaders.has(link.target.id)) {
          leaders.set(
            link.target.id,
            politics.byId.get(link.source.id)?.name ?? politics.refs.resolveName(link.source)
          );
        }
      }
      if (
        link.source.module === 'politics' &&
        link.target.kind === POLITY_KIND &&
        (link.link_type === POLITICS_LINK_TYPES.subordinateTo ||
          link.link_type === POLITICS_LINK_TYPES.memberOf)
      ) {
        const bucket = anchors.get(link.source.id) ?? new Set<string>();
        bucket.add(link.target.id);
        anchors.set(link.source.id, bucket);
      }
    }
    for (const org of politics.organizations) {
      if (org.parent_id) children.set(org.parent_id, (children.get(org.parent_id) ?? 0) + 1);
    }
    return { leaders, children, anchors };
  }, [politics.byId, politics.links, politics.organizations, politics.refs]);

  /* ---------------------------------------------------------------- *
   * 虚拟列表的行模型：异质行高（56/40/40/32/28），逐行给出真实高度
   * ---------------------------------------------------------------- */

  const listItems = useMemo<RosterListItem[]>(() => {
    const items: RosterListItem[] = [];
    if (visibleBlocks.length > 0) {
      items.push({
        key: 'section:polities',
        type: 'section',
        id: 'polities',
        label: '政权',
        hint: '主干 · 主行可展开组织与人物',
        count: visibleBlocks.length,
        open: true,
        onToggle: () => undefined,
        height: SECTION_HEIGHT,
      });
      for (const block of visibleBlocks) {
        const polityId = block.row.polity.id;
        items.push({
          key: `polity:${polityId}`,
          type: 'polity',
          id: polityId,
          row: block.row,
          block,
          height: rosterRowHeight('polity'),
        });
        if (collapsedPolities.has(polityId)) continue;
        for (const org of block.orgs) {
          items.push({
            key: `org:${org.id}`,
            type: 'organization',
            id: org.id,
            org,
            parentPolityId: polityId,
            height: ORG_ROW_HEIGHT,
          });
        }
        for (const figure of block.figures) {
          items.push({
            key: `figure:${figure.entity.id}`,
            type: 'figure',
            id: figure.entity.id,
            figure: figure.entity,
            office: figure.office,
            start: figure.start,
            end: figure.end,
            isPrimary: figure.isPrimary,
            height: FIGURE_ROW_HEIGHT,
          });
        }
      }
    }
    if (unattachedIndependents.length > 0) {
      items.push({
        key: 'section:unattached',
        type: 'section',
        id: 'unattached',
        label: '未归属',
        hint: '上溯不到政权 · 需要归入政权或保留为独立势力',
        count: unattachedIndependents.length,
        open: unattachedOpen,
        onToggle: () => setUnattachedOpen((prev) => !prev),
        height: SECTION_HEIGHT,
      });
      if (unattachedOpen) {
        for (const row of unattachedIndependents) {
          items.push({
            key: `unattached:${row.entity.id}`,
            type: 'independent',
            id: row.entity.id,
            row,
            height: ORG_ROW_HEIGHT,
          });
        }
      }
    }
    if (attachedIndependents.length > 0) {
      items.push({
        key: 'section:independents',
        type: 'section',
        id: 'independents',
        label: '独立 / 跨国组织',
        hint: '不依附于任何政权',
        count: attachedIndependents.length,
        open: independentOpen,
        onToggle: () => setIndependentOpen((prev) => !prev),
        height: SECTION_HEIGHT,
      });
      if (independentOpen) {
        for (const row of attachedIndependents) {
          items.push({
            key: `independent:${row.entity.id}`,
            type: 'independent',
            id: row.entity.id,
            row,
            height: ORG_ROW_HEIGHT,
          });
        }
      }
    }
    return items;
  }, [
    attachedIndependents,
    collapsedPolities,
    independentOpen,
    unattachedIndependents,
    unattachedOpen,
    visibleBlocks,
  ]);

  const virtual = useVirtualRows(listItems);

  /* ---------------------------------------------------------------- *
   * 写入：行内字段 / 拖拽 / 批量（全部走 politics 契约）
   * ---------------------------------------------------------------- */

  const reorderPolity = useCallback(
    async (draggedId: string, targetId: string) => {
      const order = politics.rosterPolities.map((row) => row.polity.id);
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      const changes = next
        .map((id, index) => ({ id, index }))
        .filter(({ id, index }) => politics.byId.get(id)?.order_index !== index);
      if (changes.length === 0) return;
      try {
        for (const change of changes) {
          await politics.updateEntity(change.id, { orderIndex: change.index });
        }
        toast.success(`已调整政权顺序（写入 ${changes.length} 项 order_index）`);
      } catch (error) {
        toast.error(`排序失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    },
    [politics]
  );

  const ownershipLinksOf = useCallback(
    (orgId: string) =>
      politics.links.filter(
        (link) =>
          link.source.module === 'politics' &&
          link.source.id === orgId &&
          link.target.kind === POLITY_KIND &&
          (link.link_type === POLITICS_LINK_TYPES.subordinateTo ||
            link.link_type === POLITICS_LINK_TYPES.memberOf)
      ),
    [politics.links]
  );

  const handleDrop = useCallback(
    (targetPolityId: string) => {
      const source = drag;
      setDrag(null);
      setDropTargetId(null);
      if (!source || !politics.canWriteEntities) return;
      if (source.type === 'polity') {
        void reorderPolity(source.id, targetPolityId);
        return;
      }
      if (source.parentPolityId === targetPolityId) {
        toast.info('该组织已经归属这个政权');
        return;
      }
      const org = politics.byId.get(source.id);
      if (!org) return;
      setMoveRequest({
        orgId: org.id,
        orgName: org.name,
        fromPolityId: source.parentPolityId,
        toPolityId: targetPolityId,
      });
    },
    [drag, politics.byId, politics.canWriteEntities, reorderPolity]
  );

  const moveLines = useMemo(() => {
    if (!moveRequest) return [];
    const org = politics.byId.get(moveRequest.orgId) as OrganizationEntity | undefined;
    const scope = org ? readOrganizationMeta(org.meta).scope : 'intra_polity';
    const fromName = moveRequest.fromPolityId
      ? politics.byId.get(moveRequest.fromPolityId)?.name
      : undefined;
    const toName = politics.byId.get(moveRequest.toPolityId)?.name ?? '';
    const fromCount = moveRequest.fromPolityId
      ? politics.rosterPolities.find((row) => row.polity.id === moveRequest.fromPolityId)
          ?.satelliteCount ?? 0
      : 0;
    const toCount =
      politics.rosterPolities.find((row) => row.polity.id === moveRequest.toPolityId)
        ?.satelliteCount ?? 0;
    const staleCount = ownershipLinksOf(moveRequest.orgId).length;
    return [
      `归属边：删除 ${staleCount} 条 politics.subordinate_to 旧边，新建 1 条指向「${toName}」的 politics.subordinate_to 边。`,
      `scope：随后调用 recalcScope 按归属边重算（仅挂 1 个政权 = 政权内；挂多个政权 = 跨国）。该组织当前标记为「${SCOPE_LABELS[normalizeScope(scope)]}」。`,
      `统计：${
        fromName
          ? `「${fromName}」卫星由 ${fromCount} 变为 ${Math.max(0, fromCount - 1)}`
          : '原无政权归属'
      }；「${toName}」卫星由 ${toCount} 变为 ${toCount + 1}。`,
      '该组织作为缔约方的条约（politics.signatory_of）不受影响，缔约方仍是它本身。',
    ];
  }, [moveRequest, ownershipLinksOf, politics.byId, politics.rosterPolities]);

  const confirmMove = useCallback(async () => {
    const request = moveRequest;
    if (!request) return;
    setMovePending(true);
    try {
      for (const link of ownershipLinksOf(request.orgId)) {
        await politics.deleteLink(link.id);
      }
      const created = await politics.createLinks(
        [
          {
            linkType: POLITICS_LINK_TYPES.subordinateTo,
            target: politicsRefOf(request.toPolityId, POLITY_KIND),
            label: '下属于',
          },
        ],
        politicsRefOf(request.orgId, ORGANIZATION_KIND)
      );
      const scope = await politics.recalcScope(request.orgId);
      if (created.failed > 0) {
        toast.warning('新归属边写入失败，请检查网络后重试');
      } else {
        toast.success(
          `已改归属：${request.orgName} 从原政权改到 ${
            politics.byId.get(request.toPolityId)?.name ?? ''
          }，scope 重算为「${SCOPE_LABELS[scope]}」`
        );
      }
    } catch (error) {
      toast.error(`改归属失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setMovePending(false);
      setMoveRequest(null);
    }
  }, [moveRequest, ownershipLinksOf, politics]);

  /**
   * 批量写入：逐项失败不中断，成功项保留；
   * 失败项把受影响 id 写进 toast 描述，便于定位（不再只说「失败 N 项」）。
   */
  const runBulk = useCallback(
    async (action: (id: string) => Promise<void>, message: string) => {
      setBulkBusy(true);
      const failedIds: string[] = [];
      try {
        for (const id of selected) {
          try {
            await action(id);
          } catch {
            failedIds.push(id);
          }
        }
        if (failedIds.length > 0) {
          toast.error(`${failedIds.length} 项写入失败，其余已保存`, {
            description: `失败 id：${failedIds.join('、')}`,
          });
        } else {
          toast.success(message);
        }
      } finally {
        setBulkBusy(false);
      }
    },
    [selected]
  );

  const shiftSelected = useCallback(
    async (days: number) => {
      setBulkBusy(true);
      let shifted = 0;
      let missing = 0;
      let skipped = 0;
      const failedIds: string[] = [];
      try {
        for (const id of selected) {
          const entity = politics.byId.get(id);
          if (!entity) {
            failedIds.push(id);
            continue;
          }
          const time = (entity.meta as PoliticsMetaBase).time;
          if (!time?.start && !time?.end) {
            missing += 1;
            continue;
          }
          const result = shiftTimeSpan(time, days);
          skipped += result.skipped;
          if (!result.changed) {
            missing += 1;
            continue;
          }
          try {
            await politics.updateEntity(id, { time: result.time });
            shifted += 1;
          } catch {
            failedIds.push(id);
          }
        }
        const parts = [`已平移 ${shifted} 项 ${days > 0 ? '+' : ''}${days} 天`];
        if (missing > 0) parts.push(`${missing} 项没有可解析时间`);
        if (skipped > 0) parts.push(`${skipped} 个端点保留原样`);
        if (failedIds.length > 0) parts.push(`${failedIds.length} 项写入失败`);
        toast.success(parts.join('，'), {
          description:
            failedIds.length > 0 ? `失败 id：${failedIds.join('、')}` : undefined,
        });
      } finally {
        setBulkBusy(false);
      }
    },
    [politics, selected]
  );

  /* ---------------------------------------------------------------- *
   * 渲染
   * ---------------------------------------------------------------- */

  const toggleCollapsed = useCallback((polityId: string) => {
    setCollapsedPolities((prev) => {
      const next = new Set(prev);
      if (next.has(polityId)) next.delete(polityId);
      else next.add(polityId);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string, next: boolean) => {
    setSelected((prev) => {
      const set = new Set(prev);
      if (next) set.add(id);
      else set.delete(id);
      return set;
    });
  }, []);

  /**
   * 键盘等价操作（§4.9 可访问性）：拖拽不能被键盘触发，
   * 因此组织行支持「方向键左右 = 改归属到相邻政权」，政权行支持「方向键上下 = 调整顺序」。
   * 目标行按当前可见政权顺序取，没有相邻项时给文字提示而不是静默失败。
   */
  const polityOrder = useMemo(
    () => visibleBlocks.map((block) => block.row.polity.id),
    [visibleBlocks]
  );

  const moveOrganizationByStep = useCallback(
    (orgId: string, orgName: string, parentPolityId: string | undefined, step: number) => {
      const index = polityOrder.indexOf(parentPolityId ?? '');
      const nextIndex = index < 0 ? (step > 0 ? 0 : polityOrder.length - 1) : index + step;
      const targetId = polityOrder[nextIndex];
      if (!targetId || targetId === parentPolityId) {
        toast.info('没有相邻政权可移动（列表两端）');
        return;
      }
      setMoveRequest({
        orgId,
        orgName,
        fromPolityId: parentPolityId,
        toPolityId: targetId,
      });
    },
    [polityOrder]
  );

  const reorderPolityByStep = useCallback(
    (polityId: string, step: number) => {
      const index = polityOrder.indexOf(polityId);
      const targetId = polityOrder[index + step];
      if (index < 0 || !targetId) {
        toast.info('没有相邻政权可交换（列表两端）');
        return;
      }
      void reorderPolity(polityId, targetId);
    },
    [polityOrder, reorderPolity]
  );

  const renderItem = (item: RosterListItem) => {
    if (item.type === 'section') {
      return (
        <div
          key={item.key}
          data-testid={`roster-section-${item.id}`}
          style={{ height: item.height }}
          className="flex items-center gap-2 border-y border-border/40 bg-muted/25 px-2"
        >
          {item.id !== 'polities' ? (
            <button
              type="button"
              onClick={item.onToggle}
              aria-expanded={item.open}
              className="flex items-center gap-2 text-xs font-semibold text-foreground transition-colors hover:text-primary"
            >
              <Shield
                className={
                  item.id === 'unattached'
                    ? 'h-3.5 w-3.5 text-amber-600 dark:text-amber-300'
                    : 'h-3.5 w-3.5 text-red-600 dark:text-red-300'
                }
                aria-hidden="true"
              />
              {item.label}（{item.count}）
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Landmark className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
              {item.label}（{item.count}）
            </span>
          )}
          <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
        </div>
      );
    }
    if (item.type === 'polity') {
      return (
        <PolityRow
          key={item.key}
          politics={politics}
          row={item.row}
          canEdit={politics.canWriteEntities}
          focused={focusedId === item.id}
          expanded={!collapsedPolities.has(item.id)}
          hasChildren={item.block.orgs.length + item.block.figures.length > 0}
          selected={selected.has(item.id)}
          dragging={drag?.type === 'polity' && drag.id === item.id}
          dropTarget={dropTargetId === item.id}
          onDragStart={() => setDrag({ type: 'polity', id: item.id })}
          onDragEnd={() => {
            setDrag(null);
            setDropTargetId(null);
          }}
          onMoveToPreviousPolity={() => reorderPolityByStep(item.id, -1)}
          onMoveToNextPolity={() => reorderPolityByStep(item.id, 1)}
          onDragOver={() => setDropTargetId(item.id)}
          onDrop={() => handleDrop(item.id)}
          onToggleExpand={() => toggleCollapsed(item.id)}
          onSelect={(next) => toggleSelected(item.id, next)}
          onOpen={() => onOpen(item.id)}
          onEditForm={onEditKind}
        />
      );
    }
    if (item.type === 'organization') {
      return (
        <OrganizationRow
          key={item.key}
          politics={politics}
          org={item.org}
          leaderName={orgExtras.leaders.get(item.id)}
          childCount={orgExtras.children.get(item.id) ?? 0}
          canEdit={politics.canWriteEntities}
          focused={focusedId === item.id}
          dragging={drag?.type === 'organization' && drag.id === item.id}
          onDragStart={() =>
            setDrag({ type: 'organization', id: item.id, parentPolityId: item.parentPolityId })
          }
          onDragEnd={() => {
            setDrag(null);
            setDropTargetId(null);
          }}
          onMoveToPreviousPolity={() =>
            moveOrganizationByStep(item.id, item.org.name, item.parentPolityId, -1)
          }
          onMoveToNextPolity={() =>
            moveOrganizationByStep(item.id, item.org.name, item.parentPolityId, 1)
          }
          onOpen={() => onOpen(item.id)}
          onEditForm={onEditKind}
        />
      );
    }
    if (item.type === 'figure') {
      return (
        <FigureRow
          key={item.key}
          politics={politics}
          figure={item.figure}
          office={item.office}
          start={item.start}
          end={item.end}
          isPrimary={item.isPrimary}
          indented
          focused={focusedId === item.id}
          onOpen={() => onOpen(item.id)}
          onNavigateToEntity={onNavigateToEntity}
        />
      );
    }
    return (
      <IndependentRow
        key={item.key}
        politics={politics}
        row={item.row}
        anchorCount={orgExtras.anchors.get(item.id)?.size ?? 0}
        canEdit={politics.canWriteEntities}
        focused={focusedId === item.id}
        selected={selected.has(item.id)}
        onSelect={(next) => toggleSelected(item.id, next)}
        onOpen={() => onOpen(item.id)}
        onEditForm={onEditKind}
      />
    );
  };

  const moduleEmpty =
    politics.rosterPolities.length === 0 &&
    politics.rosterIndependents.length === 0 &&
    politics.rosterTreaties.length === 0 &&
    politics.figures.length === 0;

  const nothingVisible =
    listItems.length === 0 && orphanFigures.length === 0 && treaties.length === 0;
  const filtered = hasActiveFilter(filter);

  if (nothingVisible) {
    return (
      <div
        className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-6"
        data-testid="politics-roster"
      >
        {filtered ? (
          <EmptyState
            compact
            icon={SearchX}
            title="没有符合条件的结果"
            description="清除筛选，或放宽等级与状态。"
            actions={[{ label: '清除筛选', onClick: onResetFilter, variant: 'secondary' }]}
          />
        ) : (
          <EmptyState
            compact
            icon={Landmark}
            title="还没有可维护的政治实体"
            description={
              moduleEmpty
                ? '先建一个政权，组织、人物与条约都会挂在它下面；也可以从版图引导进入。'
                : '当前筛选 / 复杂度档位下没有可显示的行；速写档只显示政权主行。'
            }
            actions={[{ label: '新建政权', onClick: () => onCreateKind(POLITY_KIND), icon: Plus }]}
          />
        )}
      </div>
    );
  }

  const virtualRows = virtual.enabled ? virtual.items : listItems;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="politics-roster">
      <div className="flex flex-wrap items-center gap-2 px-2">
        <span className="text-xs text-muted-foreground">
          政权 {visibleBlocks.length} · 独立 / 跨国 {attachedIndependents.length} · 未归属{' '}
          {unattachedIndependents.length} · 人物 {nestedFigureIds.size + orphanFigures.length} · 条约{' '}
          {treaties.length}
        </span>
        {virtual.enabled && (
          <span
            className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground"
            title="名录超过 200 行启用虚拟滚动（按真实行高定位）"
          >
            虚拟滚动 · {listItems.length} 行
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCreateKind(POLITY_KIND)}
            disabled={!politics.canWriteEntities}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            新建政权
          </button>
          <button
            type="button"
            onClick={() => onCreateKind(ORGANIZATION_KIND)}
            disabled={!politics.canWriteEntities}
            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
          >
            添加组织
          </button>
          <button
            type="button"
            onClick={() => onCreateKind(FIGURE_KIND)}
            disabled={!politics.canWriteEntities}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            关联人物
          </button>
          <button
            type="button"
            onClick={() => onCreateKind(TREATY_KIND)}
            disabled={!politics.canWriteEntities}
            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
          >
            发起条约
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <BulkBar
          selectedCount={selected.size}
          levels={levels}
          statuses={statuses}
          canEdit={politics.canWriteEntities}
          busy={bulkBusy}
          onSetLevel={(level) =>
            void runBulk(
              (id) => politics.updateEntity(id, { level }),
              `已把 ${selected.size} 项的等级设为「${levelLabelOf(levels, level)}」`
            )
          }
          onSetStatus={(status) =>
            void runBulk(
              (id) => politics.updateEntity(id, { status }),
              `已把 ${selected.size} 项的状态更新为「${
                statuses.find((def) => def.id === status)?.label ?? status
              }」`
            )
          }
          onShiftDays={(days) => void shiftSelected(days)}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div ref={virtual.containerRef} className="min-h-0 flex-1 overflow-y-auto">
        <PolityRowHeader />
        <div style={{ transform: `translateY(${virtual.paddingTop}px)` }}>
          {virtualRows.map(renderItem)}
        </div>
        {/* 虚拟窗口下的占位：保持滚动高度与尾随区块的间距 */}
        <div aria-hidden="true" style={{ height: virtual.paddingBottom + 6 }} />

        {/* 人物：默认折叠的紧凑列表（§4.4 图示），只列未挂到政权下的人物 */}
        {figuresEnabled && showFigures && (
          <section data-testid="roster-figure-section" className="border-t border-border/40">
            <button
              type="button"
              onClick={() => setFiguresOpen((prev) => !prev)}
              aria-expanded={figuresOpen}
              style={{ height: SECTION_HEIGHT }}
              className="flex w-full items-center gap-2 bg-muted/25 px-2 text-left"
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                人物（{orphanFigures.length}）
              </span>
              <span className="truncate text-xs text-muted-foreground">
                紧凑列表 · 默认折叠 · 只列未在政权下任职的人物
              </span>
            </button>
            {figuresOpen &&
              (orphanFigures.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  所有人物都已挂在政权下任职。
                </div>
              ) : (
                orphanFigures.map((figure) => (
                  <FigureRow
                    key={figure.id}
                    politics={politics}
                    figure={figure}
                    focused={focusedId === figure.id}
                    onOpen={() => onOpen(figure.id)}
                    onNavigateToEntity={onNavigateToEntity}
                  />
                ))
              ))}
          </section>
        )}

        {/* 条约：次级折叠区块（36px），展开进入条约簿表形态 */}
        {treatiesEnabled && showTreaties && (
          <TreatyBlock
            politics={politics}
            rows={treaties}
            totalCount={politics.rosterTreaties.length}
            open={treatiesOpen}
            canEdit={politics.canWriteEntities}
            onToggle={() => {
              const next = !treatiesOpen;
              setTreatiesOpen(next);
              if (next) onOpenTreatyBook();
            }}
            onOpenTreatyBook={onOpenTreatyBook}
            onOpen={onOpen}
            onCreate={() => onCreateKind(TREATY_KIND)}
          />
        )}
      </div>

      <OrgMoveDialog
        open={moveRequest !== null}
        orgName={moveRequest?.orgName ?? ''}
        fromPolityName={
          moveRequest?.fromPolityId
            ? politics.byId.get(moveRequest.fromPolityId)?.name
            : undefined
        }
        toPolityName={
          moveRequest ? politics.byId.get(moveRequest.toPolityId)?.name ?? '' : ''
        }
        lines={moveLines}
        pending={movePending}
        onCancel={() => setMoveRequest(null)}
        onConfirm={() => void confirmMove()}
      />
    </div>
  );
};

export default Roster;
