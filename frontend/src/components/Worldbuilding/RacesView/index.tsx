/**
 * 种族主视图 RacesView（Phase 3 P3-T3；races_ui_design §4.1/§4.2/§4.3/§5/§9/§10/§12）
 *
 * 结构：
 * - 工具条：搜索（防抖 200ms）、图鉴 / 血缘 切换、复杂度说明、新建种族、模块配置（非 sketch 档）；
 * - 筛选：全部 + 各 kind（内置 race/subrace + 配置里的自定义 kind），排序：名称 / 最近编辑；
 * - 主体：图鉴网格（RaceGrid，自带滚动容器）或血缘树（structure / sandbox 才加载，>80 节点降级列表）；
 * - 详情：选中卡片即在右侧展开 RaceDetail（不丢失网格上的选中徽章），返回只清空选中。
 * 空态：模块为空给「新建种族 + 查看关联说明」，筛选无结果给「清空筛选」；模块为空时额外展示 3 分钟路径。
 * 键盘：`/` 聚焦搜索、`j/k` 移动选中、`Enter` 打开详情、`g` 切换图鉴 / 血缘（输入框内不响应）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  LayoutGrid,
  Network,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { useComplexity, COMPLEXITY_DESCRIPTIONS, COMPLEXITY_LABELS } from '@/components/common/ComplexitySwitcher';
import { Modal } from '@/components/Modals/Modal';
import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { toRegistryMap, useLinkRegistry, useWorldLinks } from '@/components/Worldbuilding/hooks';
import { EmptyState } from '../shared/EmptyState';
import { QuickStart } from '../shared/QuickStart';
import { useModuleConfig } from '../shared/useModuleConfig';
import type { CustomFieldValue } from '../shared/moduleConfig';
import { useRaces, type RaceFormValues } from './hooks/useRaces';
import { RaceConfigPanel } from './RaceConfigPanel';
import { LineageFallback } from './components/LineageFallback';
import { LineageTree } from './components/LineageTree';
import { RaceDetail } from './components/RaceDetail';
import { RaceGrid } from './components/RaceGrid';
import { EdgeMetaModal } from './modals/EdgeMetaModal';
import { RaceFormModal } from './modals/RaceFormModal';
import { SubraceFormModal } from './modals/SubraceFormModal';
import {
  RACES_INCOMING_LINK_TYPES,
  RACES_MODULE,
  RACES_OUTGOING_LINK_TYPES,
  type RaceNode,
} from './types';
import type { RacesDisplayMode } from './config';

/** registry 未就绪时的兜底标签（全部取自契约 §4.1/§4.5/§6.1，不新增类型） */
const FALLBACK_LINK_LABELS: Record<string, string> = {
  'races.inhabits': '聚居',
  'races.origin_at': '起源于',
  'races.related_to': '血缘 / 渊源',
  'races.notable_figure': '代表人物',
  'races.affinity_with': '体系亲和',
  'races.specialty': '特产',
  'races.prefers': '消费偏好',
  'character.belongs_to_race': '种族归属',
  'politics.includes_race': '民族 / 种族构成',
  'history.involves': '涉及',
  'history.milestone_of': '大事记',
};

type SortKey = 'name' | 'updated';

/** 列数与 Tailwind 响应式类保持一致：<640 一列、<1024 两列、<1280 三列，其余四列 */
const columnsForWidth = (width: number): number => {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  if (width < 1280) return 3;
  return 4;
};

/** 视口宽度 -> 网格列数（仅用于超过 200 张卡时的窗口化计算） */
const useGridColumns = (): number => {
  const [columns, setColumns] = useState(() =>
    columnsForWidth(typeof window === 'undefined' ? 1280 : window.innerWidth)
  );
  useEffect(() => {
    const onResize = () => setColumns(columnsForWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return columns;
};

interface RacesViewProps {
  worldId: string;
  moduleId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  highlightRef?: EntityRef | null;
}

export const RacesView = ({
  worldId,
  moduleId,
  onNavigateToEntity,
  highlightRef,
}: RacesViewProps) => {
  const { level } = useComplexity();
  const races = useRaces(worldId, moduleId);
  const configPanel = useModuleConfig(worldId, moduleId);
  const linksQuery = useWorldLinks(worldId);
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const registryQuery = useLinkRegistry();
  const registry = useMemo(() => toRegistryMap(registryQuery.data), [registryQuery.data]);
  const columns = useGridColumns();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollTopRef = useRef(0);

  const [layout, setLayout] = useState<RacesDisplayMode>('atlas');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [raceForm, setRaceForm] = useState<{ open: boolean; node: RaceNode | null }>({
    open: false,
    node: null,
  });
  const [subraceForm, setSubraceForm] = useState<{
    open: boolean;
    node: RaceNode | null;
    parent: RaceNode | null;
  }>({ open: false, node: null, parent: null });
  const [edgeLink, setEdgeLink] = useState<WorldLink | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [visitedLineage, setVisitedLineage] = useState(false);

  // 搜索防抖 200ms（§11）
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // 默认视图读 config.displayMode（只在首次读到配置时生效，之后由用户决定）
  const displaySeeded = useRef(false);
  useEffect(() => {
    if (displaySeeded.current) return;
    if (!races.config) return;
    displaySeeded.current = true;
    if (races.config.displayMode === 'lineage' && races.canUseLineage) setLayout('lineage');
  }, [races.config, races.canUseLineage]);

  // sketch 档不加载血缘布局（§8）
  useEffect(() => {
    if (!races.canUseLineage) setLayout('atlas');
  }, [races.canUseLineage]);

  // highlightRef 命中种族实体：选中并滚动到该卡
  useEffect(() => {
    if (!highlightRef || highlightRef.module !== RACES_MODULE) return;
    if (!races.byId.has(highlightRef.id)) return;
    setSelectedId(highlightRef.id);
    setScrollToId(highlightRef.id);
  }, [highlightRef, races.byId]);

  const kindTabs = useMemo(
    () => [
      { id: 'all', label: '全部' },
      ...races.kinds.map((def) => ({
        id: def.id,
        label: races.terms.term(def.id, def.label),
      })),
    ],
    [races.kinds, races.terms]
  );

  const filtered = useMemo(() => {
    const keyword = debounced.trim().toLowerCase();
    const matched = races.nodes.filter((node) => {
      if (kindFilter !== 'all' && node.kind !== kindFilter) return false;
      if (!keyword) return true;
      const customText = Object.values(node.meta.customFields ?? {})
        .filter((value): value is string => typeof value === 'string')
        .join('\n');
      const haystack = [
        node.name,
        node.meta.tagline ?? '',
        node.description ?? '',
        node.meta.traits.join('\n'),
        customText,
      ]
        .join('\n')
        .toLowerCase();
      return haystack.includes(keyword);
    });
    return [...matched].sort((a, b) => {
      if (sort === 'updated') {
        return (
          b.submodule.updated_at.localeCompare(a.submodule.updated_at) ||
          a.name.localeCompare(b.name, 'zh-Hans-CN')
        );
      }
      return a.name.localeCompare(b.name, 'zh-Hans-CN') || a.id.localeCompare(b.id);
    });
  }, [races.nodes, kindFilter, debounced, sort]);

  // 键盘：/ 聚焦搜索、j/k 移动选中、Enter 打开、g 切换视图（输入态不响应）
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'g') {
        if (!races.canUseLineage) return;
        setLayout((prev) => (prev === 'atlas' ? 'lineage' : 'atlas'));
        setVisitedLineage(true);
        return;
      }
      if (filtered.length === 0) return;
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        const current = filtered.findIndex((node) => node.id === selectedId);
        const nextIndex =
          current < 0
            ? event.key === 'j'
              ? 0
              : filtered.length - 1
            : event.key === 'j'
              ? Math.min(filtered.length - 1, current + 1)
              : Math.max(0, current - 1);
        const next = filtered[nextIndex];
        if (next) {
          setSelectedId(next.id);
          setScrollToId(next.id);
        }
        return;
      }
      if (event.key === 'Enter' && selectedId) setScrollToId(selectedId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, selectedId, races.canUseLineage]);

  const selectedNode = (selectedId ? races.byId.get(selectedId) : undefined) ?? null;

  const openCreateRace = () => setRaceForm({ open: true, node: null });

  const openEdit = (node: RaceNode) => {
    if (node.parentId) {
      setSubraceForm({ open: true, node, parent: races.byId.get(node.parentId) ?? null });
    } else {
      setRaceForm({ open: true, node });
    }
  };

  const submitRaceForm = async (
    values: RaceFormValues,
    customFields: Record<string, CustomFieldValue>
  ) => {
    if (raceForm.node) {
      // 单次写入：表单字段与自定义字段同一个 PUT（分两次写会互相回滚，Phase 3 修复）
      await races.updateRace(raceForm.node.id, values, customFields);
      return;
    }
    const created = await races.createRace(values, customFields);
    // 保存后详情自动打开（§5.1.2）
    setSelectedId(created.id);
  };

  const submitSubraceForm = async (
    values: RaceFormValues,
    customFields: Record<string, CustomFieldValue>
  ) => {
    if (subraceForm.node) {
      await races.updateRace(subraceForm.node.id, values, customFields);
      return;
    }
    if (!subraceForm.parent) return;
    const created = await races.createSubrace(subraceForm.parent.id, values, customFields);
    setSelectedId(created.id);
  };

  const handleDelete = async (nodeId: string) => {
    const removing = new Set([nodeId, ...races.subracesOf(nodeId).map((child) => child.id)]);
    await races.deleteNode(nodeId);
    if (selectedId && removing.has(selectedId)) setSelectedId(null);
  };

  const linkTypeLabel = (id: string): string =>
    registry.get(id)?.label ?? FALLBACK_LINK_LABELS[id] ?? id;

  const renderRelationTable = (title: string, types: string[], direction: string) => (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-foreground">{title}</div>
      <ul className="space-y-0.5">
        {types.map((id) => (
          <li key={id} className="flex items-center gap-2 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-foreground">{linkTypeLabel(id)}</span>
            <span className="shrink-0 text-muted-foreground">{direction}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{id}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  /** 支系的添加入口只走第一层：父级必须是主条目（§12.3 第三层不出现） */
  const handleAddSubrace = (parent: RaceNode) =>
    setSubraceForm({ open: true, node: null, parent });

  const handleAddSubraceById = (parentId: string) => {
    const parent = races.byId.get(parentId);
    if (parent) handleAddSubrace(parent);
  };

  const handleSubraceCount = (nodeId: string) => races.subracesOf(nodeId).length;

  const handleOpenNode = (nodeId: string) => {
    setSelectedId(nodeId);
    setScrollToId(nodeId);
  };

  /** 血缘树上的「建立关系」不开私有编辑器：选中节点后统一在右栏 LinkPanel 里添加（§5.2） */
  const handleAddRelation = () => {
    const first = selectedNode ?? races.roots[0];
    if (first) setSelectedId(first.id);
    toast.info('在右侧关联面板里添加关联');
  };

  const renderEmptyState = () => {
    if (races.isLoading) {
      return <div className="p-4 text-xs text-muted-foreground">加载中...</div>;
    }
    if (races.nodes.length === 0) {
      return (
        <div className="space-y-3 p-2">
          <QuickStart
            title="3 分钟最小可用路径"
            description="必填只有名称 / 一句话 / 代表色，其余字段可后补。"
            steps={[
              { label: '新建种族：填名称、一句话、选代表色', done: false },
              { label: '补 1-2 句外貌 / 寿命（可选）', done: false },
              { label: '加一条关联（地图 / 角色 / 体系 / 经济任一）', done: false },
              { label: '添加一个支系（可选）', done: false },
              { label: '切换图鉴 / 血缘确认', done: visitedLineage },
            ]}
          />
          <EmptyState
            icon={BookOpen}
            title={races.terms.term('emptyTitle', '还没有种族条目')}
            description="从「名称 + 一句话 + 代表色」开始。"
            actions={[
              {
                label: races.terms.term('newRace', '新建种族'),
                onClick: openCreateRace,
                icon: Plus,
              },
              {
                label: '查看关联说明',
                onClick: () => setHelpOpen(true),
                variant: 'secondary',
              },
            ]}
          />
        </div>
      );
    }
    return (
      <EmptyState
        icon={SearchX}
        title="没有匹配的种族"
        description={`当前筛选：${
          kindTabs.find((tab) => tab.id === kindFilter)?.label ?? '全部'
        }${search.trim() ? ` · 关键词「${search.trim()}」` : ''}`}
        actions={[
          {
            label: '清空筛选',
            variant: 'secondary',
            onClick: () => {
              setSearch('');
              setDebounced('');
              setKindFilter('all');
            },
          },
        ]}
      />
    );
  };

  const renderBody = () => {
    if (races.isError) {
      return <div className="p-4 text-xs text-destructive">种族数据加载失败</div>;
    }
    if (filtered.length === 0) return renderEmptyState();
    if (layout === 'lineage') {
      return (
        <div className="h-full overflow-y-auto p-1" data-testid="races-lineage">
          {races.lineage.degraded ? (
            <LineageFallback
              lineage={races.lineage}
              config={races.config}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddSubrace={races.canEdit ? handleAddSubraceById : undefined}
            />
          ) : (
            <LineageTree
              lineage={races.lineage}
              config={races.config}
              refs={races.refs}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEditEdge={setEdgeLink}
              onAddRelation={handleAddRelation}
              onAddSubrace={races.canEdit ? handleAddSubraceById : undefined}
            />
          )}
        </div>
      );
    }
    return (
      <RaceGrid
        nodes={filtered}
        config={races.config}
        links={links}
        columns={columns}
        sketch={level === 'sketch'}
        selectedId={selectedId}
        resolveName={races.refs.resolveName}
        countOf={races.counts.countOf}
        subraceCountOf={handleSubraceCount}
        onOpen={handleOpenNode}
        scrollTopRef={scrollTopRef}
        scrollToId={scrollToId}
      />
    );
  };

  return (
    <div data-testid="races-view" data-layout={layout} className="flex h-full min-h-0 flex-col gap-2">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h1 className="text-sm font-semibold text-foreground">
            {races.terms.term('atlas', '图鉴')}
          </h1>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索名称 / 一句话 / 标签（按 / 聚焦）"
              aria-label="搜索种族"
              className="w-56 rounded-md border border-border/50 bg-background py-1 pl-7 pr-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div
            role="tablist"
            aria-label="图鉴 / 血缘视图切换"
            className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={layout === 'atlas'}
              onClick={() => setLayout('atlas')}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                layout === 'atlas'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              {races.terms.term('atlas', '图鉴')}
            </button>
            {races.canUseLineage && (
              <button
                type="button"
                role="tab"
                aria-selected={layout === 'lineage'}
                onClick={() => {
                  setLayout('lineage');
                  setVisitedLineage(true);
                }}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                  layout === 'lineage'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Network className="h-3.5 w-3.5" aria-hidden="true" />
                {races.terms.term('lineage', '血缘树')}
              </button>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground">
            {COMPLEXITY_LABELS[level]}档 · {COMPLEXITY_DESCRIPTIONS[level]}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {level !== 'sketch' && (
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                模块配置
              </button>
            )}
            <button
              type="button"
              onClick={openCreateRace}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {races.terms.term('newRace', '新建种族')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="类型筛选"
            className="flex flex-wrap items-center gap-1"
            data-testid="kind-filter"
          >
            {kindTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={kindFilter === tab.id}
                onClick={() => setKindFilter(tab.id)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                  kindFilter === tab.id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1" data-testid="sort-switch">
            <span className="text-[10px] text-muted-foreground">排序</span>
            <button
              type="button"
              aria-pressed={sort === 'name'}
              onClick={() => setSort('name')}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                sort === 'name' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
              }`}
            >
              名称
            </button>
            <button
              type="button"
              aria-pressed={sort === 'updated'}
              onClick={() => setSort('updated')}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                sort === 'updated' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
              }`}
            >
              最近编辑
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
        {selectedNode && (
          <div className="max-h-[70vh] min-h-0 w-full overflow-hidden lg:h-full lg:max-h-none lg:w-[420px] lg:shrink-0">
            <RaceDetail
              key={selectedNode.id}
              worldId={worldId}
              node={selectedNode}
              config={races.config}
              races={races}
              onBack={() => setSelectedId(null)}
              onNavigateToEntity={onNavigateToEntity}
              onEdit={openEdit}
              onAddSubrace={(parent) => setSubraceForm({ open: true, node: null, parent })}
              onSelectNode={setSelectedId}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      <RaceFormModal
        open={raceForm.open}
        config={races.config}
        kinds={races.kinds}
        node={raceForm.node}
        onClose={() => setRaceForm({ open: false, node: null })}
        onSubmit={submitRaceForm}
      />

      <SubraceFormModal
        open={subraceForm.open}
        config={races.config}
        parent={subraceForm.parent}
        node={subraceForm.node}
        onClose={() => setSubraceForm({ open: false, node: null, parent: null })}
        onSubmit={submitSubraceForm}
      />

      <EdgeMetaModal
        open={edgeLink !== null}
        worldId={worldId}
        link={edgeLink}
        config={races.config}
        resolveName={races.refs.resolveName}
        onClose={() => setEdgeLink(null)}
      />

      <RaceConfigPanel
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={races.config}
        onSave={configPanel.save}
      />

      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="关联说明"
        size="lg"
      >
        <div className="space-y-3" data-testid="races-link-help">
          <p className="text-[11px] text-muted-foreground">
            关联一律存 WorldLink，增删改在详情右栏的关联面板完成；类型取自契约 §4 注册表。
          </p>
          {renderRelationTable('出链（种族指向其他模块）', RACES_OUTGOING_LINK_TYPES, '出链')}
          {renderRelationTable('入链（其他模块指向种族）', RACES_INCOMING_LINK_TYPES, '入链')}
        </div>
      </Modal>
    </div>
  );
};

export type { RacesViewProps };
export default RacesView;
