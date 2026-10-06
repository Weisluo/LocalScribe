/**
 * 政治主视图 PoliticsView（Phase 4 P4-T3/P4-T8/P4-T11；politics_ui_design §2.3/§4/§5/§8/§9/§10）
 *
 * 结构：
 * - 顶栏：三视图分段控件（版图 / 名录 / 沿革，没有四个平级 Tab）+ 搜索 + 复杂度 + 新建；
 * - 左侧：层级导航（全部 / 政权 / 组织 / 人物 / 条约）——它是过滤器，不是四个页面；
 * - 主体：PowerAtlas / Roster / Chronicle 三选一；
 * - 上下文：FocusDrawer（聚焦详情，可固定，最多 3 个）+ 次级 TreatyBook 抽屉；
 * - 快捷键：1/2/3 切视图、/ 搜索、N 新建、L 关系层、Esc 逐级返回（§5.1.4）。
 *
 * 空态：模块为空给「创建第一个政权 + 了解权力版图 + 3 分钟路径」；
 * 筛选无结果给「清除筛选」；历史 / 经济 / 种族 / 体系为空不阻塞（§9）。
 * 地图未接入：领土 / 首府入口整体隐藏，不显示占位（§6.7）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Landmark, Plus, Search, SlidersHorizontal, X } from 'lucide-react';

import { useComplexity, COMPLEXITY_LABELS } from '@/components/common/ComplexitySwitcher';
import type { EntityRef } from '@/services/worldbuildingApi';
import { QuickStart } from '../shared/QuickStart';
import { useModuleConfig } from '../shared/useModuleConfig';
import { PoliticsFormModal } from './modals/PoliticsFormModal';
import { QuickGuideModal } from './modals/QuickGuideModal';
import { PoliticsConfigPanel } from './modals/PoliticsConfigPanel';
import {
  EMPTY_POLITICS_FILTER,
  usePolitics,
  type PoliticsFilterState,
} from './hooks';
import { PowerAtlas } from './PowerAtlas';
import { Roster } from './Roster';
import { Chronicle } from './Chronicle';
import { FocusPanel } from './FocusPanel';
import { TreatyBook } from './TreatyBook';
import { PoliticsEmptyState } from './EmptyState';
import {
  POLITICS_TERM_DEFAULTS,
  POLITICS_VIEWS,
  POLITICS_VIEW_LABELS,
  resolvePoliticsView,
  type PoliticsViewId,
} from './config';
import { FOCUS_PIN_LIMIT, ORGANIZATION_KIND, POLITY_KIND, TREATY_KIND, type PoliticsEntity } from './types';
import { fieldClass, toneTextClass } from './tone';

export interface PoliticsViewProps {
  worldId: string;
  moduleId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  highlightRef?: EntityRef | null;
}

/* ---------------- §5.1.1 URL query 同步（可分享 / 返回恢复） ---------------- */

const URL_VIEW_KEY = 'politicsView';
const URL_FOCUS_KEY = 'politicsFocus';

const urlParams = (): URLSearchParams =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

const hasUrlParam = (key: string): boolean => urlParams().has(key);

const readViewFromUrl = (): PoliticsViewId => {
  const raw = urlParams().get(URL_VIEW_KEY);
  return raw === 'roster' || raw === 'chronicle' || raw === 'atlas' ? raw : 'atlas';
};

const readFocusFromUrl = (): string | null => urlParams().get(URL_FOCUS_KEY);

const readFilterFromUrl = (): PoliticsFilterState => ({
  kind:
    (urlParams().get('politicsKind') as PoliticsFilterState['kind']) ??
    EMPTY_POLITICS_FILTER.kind,
  level: urlParams().get('politicsLevel') ?? '',
  status: urlParams().get('politicsStatus') ?? '',
  search: urlParams().get('politicsSearch') ?? '',
});

export const PoliticsView = ({
  worldId,
  moduleId,
  onNavigateToEntity,
  highlightRef,
}: PoliticsViewProps) => {
  const { level } = useComplexity();
  const politics = usePolitics(worldId, moduleId);
  const moduleConfig = useModuleConfig(worldId, moduleId);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [view, setView] = useState<PoliticsViewId>(() => readViewFromUrl());
  const viewSeeded = useRef(false);
  useEffect(() => {
    if (viewSeeded.current) return;
    if (politics.rawConfig === null) return;
    viewSeeded.current = true;
    // URL 明确指定了视图时以 URL 为准（§5.1.1 可分享 / 可返回）
    if (readViewFromUrl() !== 'atlas' || hasUrlParam(URL_VIEW_KEY)) return;
    setView(resolvePoliticsView(politics.config.displayMode));
  }, [politics.config.displayMode, politics.rawConfig]);

  const [filter, setFilter] = useState<PoliticsFilterState>(() => readFilterFromUrl());
  const [search, setSearch] = useState(() => readFilterFromUrl().search);
  const [debounced, setDebounced] = useState(() => readFilterFromUrl().search);
  const [relationLayerOpen, setRelationLayerOpen] = useState(false);
  const [treatyBookOpen, setTreatyBookOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  /** 聚焦与固定：固定最多 3 个（§5.5.2） */
  const [focusedId, setFocusedId] = useState<string | null>(() => readFocusFromUrl());
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  /** 新建 / 编辑：kind + 目标 id（null 表示新建） */
  const [form, setForm] = useState<{ kind: string; entityId: string | null } | null>(null);
  const [visitedChronicle, setVisitedChronicle] = useState(false);
  const [visitedRelations, setVisitedRelations] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setFilter((prev) => ({ ...prev, search: debounced }));
  }, [debounced]);

  /**
   * 视图 / 筛选 / 聚焦写入 URL query（§5.1.1 可分享、§5.5.1 返回恢复）。
   * 用 replaceState 而不是路由跳转：不污染历史栈，也不影响其他参数；
   * 在 about:blank 之类的不可写 URL 环境下静默跳过（测试沙箱）。
   */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set(URL_VIEW_KEY, view);
      if (focusedId) params.set(URL_FOCUS_KEY, focusedId);
      else params.delete(URL_FOCUS_KEY);
      if (filter.kind !== 'all') params.set('politicsKind', filter.kind);
      else params.delete('politicsKind');
      if (filter.level) params.set('politicsLevel', filter.level);
      else params.delete('politicsLevel');
      if (filter.status) params.set('politicsStatus', filter.status);
      else params.delete('politicsStatus');
      if (debounced) params.set('politicsSearch', debounced);
      else params.delete('politicsSearch');
      const query = params.toString();
      const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', next);
    } catch {
      // URL 不可写（about:blank / 沙箱）：忽略，状态仍在内存里
    }
  }, [debounced, filter.kind, filter.level, filter.status, focusedId, view]);

  // highlightRef 命中政治实体：打开聚焦；同一次高亮只消费一次，
  // 用户关闭抽屉后任何一次数据刷新都不能把它重新打开（否则抽屉关不掉）。
  const [consumedHighlight, setConsumedHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightRef || highlightRef.module !== 'politics') return;
    if (!politics.byId.has(highlightRef.id)) return;
    const key = `${highlightRef.module}:${highlightRef.kind}:${highlightRef.id}`;
    if (consumedHighlight === key) return;
    setConsumedHighlight(key);
    setFocusedId(highlightRef.id);
  }, [highlightRef, politics.byId, consumedHighlight]);

  const selectedEntity: PoliticsEntity | undefined = focusedId
    ? politics.byId.get(focusedId)
    : undefined;

  const openFocus = useCallback((entityId: string) => setFocusedId(entityId), []);
  const closeFocus = useCallback(() => setFocusedId(null), []);

  const togglePin = useCallback((entityId: string) => {
    setPinnedIds((prev) => {
      if (prev.includes(entityId)) return prev.filter((id) => id !== entityId);
      if (prev.length >= FOCUS_PIN_LIMIT) return [...prev.slice(1), entityId];
      return [...prev, entityId];
    });
  }, []);

  const isPinned = selectedEntity ? pinnedIds.includes(selectedEntity.id) : false;

  /** §9.2「清除筛选」：筛选状态在壳里，由子视图的回调统一重置 */
  const resetFilter = useCallback(() => {
    setFilter(EMPTY_POLITICS_FILTER);
    setSearch('');
    setDebounced('');
  }, []);

  const handleDelete = useCallback(
    async (entityId: string) => {
      await politics.deleteEntity(entityId);
      setPinnedIds((prev) => prev.filter((id) => id !== entityId));
      if (focusedId === entityId) setFocusedId(null);
    },
    [focusedId, politics]
  );

  // 快捷键（输入态不响应；Esc 逐级返回：抽屉 -> 详情 -> 聚焦 -> 全局）
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const next = POLITICS_VIEWS[Number(event.key) - 1];
        if (next) {
          setView(next);
          if (next === 'chronicle') setVisitedChronicle(true);
        }
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'n' || event.key === 'N') {
        setForm({ kind: POLITY_KIND, entityId: null });
        return;
      }
      if (event.key === 'l' || event.key === 'L') {
        setRelationLayerOpen((prev) => !prev);
        setVisitedRelations(true);
        return;
      }
      if (event.key === 'Escape') {
        // 逐级返回（§5.1.4）：本壳只关自己这一层。
        // 有任何 dialog / 抽屉内浮层打开时一律让位，避免一次 Esc 同时关掉多层。
        if (configOpen) {
          setConfigOpen(false);
          return;
        }
        if (guideOpen) {
          setGuideOpen(false);
          return;
        }
        if (treatyBookOpen) {
          setTreatyBookOpen(false);
          return;
        }
        if (form) {
          setForm(null);
          return;
        }
        if (document.querySelector('[role="dialog"]')) return;
        if (focusedId) setFocusedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [configOpen, focusedId, form, guideOpen, treatyBookOpen]);

  const term = useCallback(
    (key: string) => politics.terms.term(key, POLITICS_TERM_DEFAULTS[key] ?? key),
    [politics.terms]
  );

  const kindFilters = useMemo(
    () => [
      { id: 'all', label: term('all') },
      { id: POLITY_KIND, label: term('polity') },
      { id: ORGANIZATION_KIND, label: term('organization') },
      { id: 'figure', label: term('figure') },
      { id: TREATY_KIND, label: term('treaty') },
    ],
    [term]
  );

  const totalCount =
    politics.polities.length +
    politics.organizations.length +
    politics.figures.length +
    politics.treaties.length;

  const filteredCounts: Record<string, number> = useMemo(
    () => ({
      all: totalCount,
      [POLITY_KIND]: politics.polities.length,
      [ORGANIZATION_KIND]: politics.organizations.length,
      figure: politics.figures.length,
      [TREATY_KIND]: politics.treaties.length,
    }),
    [totalCount, politics]
  );

  const renderBody = () => {
    if (politics.isError) {
      return (
        <div
          className="flex flex-col items-start gap-2 p-4 text-xs text-destructive"
          data-testid="politics-error"
        >
          <span>政治数据加载失败</span>
          <button
            type="button"
            onClick={() => void politics.refetch?.()}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            重试
          </button>
        </div>
      );
    }
    if (politics.isLoading && totalCount === 0) {
      // §7.3：列表与画布用骨架屏，不用纯文本
      return (
        <div className="space-y-2 p-3" data-testid="politics-loading">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg border border-border/50 bg-muted/30 motion-reduce:animate-none"
            />
          ))}
        </div>
      );
    }
    if (totalCount === 0) {
      return (
        <div className="space-y-3 overflow-y-auto p-2">
          <QuickStart
            title="3 分钟最小可用路径"
            description="必填只有政权名称、等级与一位统治者；其余留白，不阻塞后续生长。"
            steps={[
              { label: '新建政权：填名称 + 选等级（可内联新建）', done: politics.polities.length > 0 },
              { label: '添加一位统治者（全局角色选择器）', done: politics.figures.length > 0 },
              { label: '可选：从政权卡内添加一个组织卫星', done: politics.organizations.length > 0 },
              { label: '可选：拖出一条关系边', done: visitedRelations },
              { label: '可选：发起一条条约缎带', done: politics.treaties.length > 0 },
              { label: '可选：进入沿革视图确认兴亡线', done: visitedChronicle },
            ]}
          />
          <PoliticsEmptyState
            term={term}
            onCreatePolity={() => setForm({ kind: POLITY_KIND, entityId: null })}
            onOpenGuide={() => setGuideOpen(true)}
          />
        </div>
      );
    }
    if (view === 'atlas') {
      return (
        <PowerAtlas
          politics={politics}
          filter={filter}
          focusedId={focusedId}
          onFocus={openFocus}
          onClearFocus={closeFocus}
          onNavigateToEntity={onNavigateToEntity}
          relationLayerOpen={relationLayerOpen}
          onToggleRelationLayer={(next) => {
            setRelationLayerOpen(next);
            setVisitedRelations(true);
          }}
          onOpenTreatyBook={() => setTreatyBookOpen(true)}
          onCreateKind={(kind) => setForm({ kind, entityId: null })}
        />
      );
    }
    if (view === 'roster') {
      return (
        <Roster
          politics={politics}
          filter={filter}
          focusedId={focusedId}
          onOpen={openFocus}
          onNavigateToEntity={onNavigateToEntity}
          onOpenTreatyBook={() => setTreatyBookOpen(true)}
          onCreateKind={(kind) => setForm({ kind, entityId: null })}
          onEditKind={(entity) => setForm({ kind: entity.kind, entityId: entity.id })}
          onResetFilter={resetFilter}
        />
      );
    }
    return (
      <Chronicle
        politics={politics}
        filter={filter}
        focusedId={focusedId}
        onOpen={openFocus}
        onNavigateToEntity={onNavigateToEntity}
        onOpenTreatyBook={() => setTreatyBookOpen(true)}
        onOpenTreaty={openFocus}
        onResetFilter={resetFilter}
        onOpenHistory={onNavigateToEntity}
        onCreateTreaty={() => setForm({ kind: TREATY_KIND, entityId: null })}
      />
    );
  };

  const hasFilter =
    filter.kind !== 'all' || !!filter.level || !!filter.status || !!search.trim();

  return (
    <div
      data-testid="politics-view"
      data-view={view}
      className="relative flex h-full min-h-0 flex-col gap-2"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h1 className="text-sm font-semibold text-foreground">{term(view)}</h1>

          <div
            role="tablist"
            aria-label="政治视图切换"
            className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5"
          >
            {POLITICS_VIEWS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                data-testid={`politics-view-tab-${id}`}
                onClick={() => {
                  setView(id);
                  if (id === 'chronicle') setVisitedChronicle(true);
                }}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                  view === id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {POLITICS_VIEW_LABELS[id]}
              </button>
            ))}
          </div>

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
              placeholder="搜索名称 / 别名 / 标签 / 关联 / 自定义字段（按 / 聚焦）"
              aria-label="搜索政治实体"
              data-testid="politics-search"
              className={`${fieldClass} w-56 pl-7`}
            />
          </div>

          <span className="text-[10px] text-muted-foreground">{COMPLEXITY_LABELS[level]}档</span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTreatyBookOpen(true)}
              data-testid="open-treaty-book"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30"
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              {term('treatyBook')}
              <span className="text-muted-foreground">{politics.treaties.length}</span>
            </button>
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
              onClick={() => setForm({ kind: POLITY_KIND, entityId: null })}
              data-testid="new-polity"
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {term('newPolity')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="层级导航（过滤器）"
            className="flex flex-wrap items-center gap-1"
            data-testid="politics-kind-filter"
          >
            {kindFilters.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={filter.kind === tab.id}
                onClick={() => setFilter((prev) => ({ ...prev, kind: tab.id }))}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                  filter.kind === tab.id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className="ml-1 text-[9px] text-muted-foreground">
                  {filteredCounts[tab.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {politics.levels && politics.levels.length > 0 && (
              <select
                aria-label="按等级筛选"
                value={filter.level}
                onChange={(event) => setFilter((prev) => ({ ...prev, level: event.target.value }))}
                className="rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-[11px]"
              >
                <option value="">全部等级</option>
                {politics.levels?.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}
                  </option>
                ))}
              </select>
            )}
            {politics.statuses && politics.statuses.length > 0 && (
              <select
                aria-label="按状态筛选"
                value={filter.status}
                onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-[11px]"
              >
                <option value="">全部状态</option>
                {politics.statuses?.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}
                  </option>
                ))}
              </select>
            )}
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setFilter(EMPTY_POLITICS_FILTER);
                  setSearch('');
                  setDebounced('');
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                清除筛选
              </button>
            )}
          </div>
        </div>
      </header>

      {/* §9：没有任何任职边的人物不属于任何政权 / 组织分组，这里给一个明确入口，
          避免「创建了但哪里都看不到」的静默丢失。 */}
      {politics.unattachedFigures.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground"
          data-testid="politics-unattached-figures"
        >
          <span>未归属人物 {politics.unattachedFigures.length}</span>
          {politics.unattachedFigures.slice(0, 8).map((figure) => (
            <button
              key={figure.id}
              type="button"
              onClick={() => openFocus(figure.id)}
              className="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
            >
              {politics.refs.resolveName({ module: 'politics', kind: figure.kind, id: figure.id }) ||
                figure.name}
            </button>
          ))}
          <span className="text-[10px]">（为其补一条任职边即可归入政权 / 组织）</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
        {selectedEntity && (
          <FocusPanel
            key={selectedEntity.id}
            politics={politics}
            worldId={worldId}
            entity={selectedEntity}
            pinned={isPinned}
            onTogglePin={() => togglePin(selectedEntity.id)}
            onClose={closeFocus}
            onNavigateToEntity={onNavigateToEntity}
            onOpenTreatyBook={() => setTreatyBookOpen(true)}
            onOpenFocus={openFocus}
            onDelete={handleDelete}
            onEdit={(entity) => setForm({ kind: entity.kind, entityId: entity.id })}
            onResetFilter={resetFilter}
          />
        )}
      </div>

      <TreatyBook
        open={treatyBookOpen}
        politics={politics}
        onClose={() => setTreatyBookOpen(false)}
        onOpenTreaty={(entityId) => {
          setTreatyBookOpen(false);
          setFocusedId(entityId);
        }}
        onCreate={() => {
          setTreatyBookOpen(false);
          setForm({ kind: TREATY_KIND, entityId: null });
        }}
        onNavigateToEntity={onNavigateToEntity}
      />

      <PoliticsFormModal
        open={form !== null}
        kind={form?.kind ?? POLITY_KIND}
        editing={form?.entityId ? politics.byId.get(form.entityId) : undefined}
        politics={politics}
        onClose={() => setForm(null)}
        onSaved={(entityId) => {
          setForm(null);
          setFocusedId(entityId);
        }}
      />

      {pinnedIds.length > 0 && (
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap gap-1"
          data-testid="politics-pinned"
        >
          {pinnedIds.map((id) => {
            const entity = politics.byId.get(id);
            if (!entity) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFocusedId(id)}
                className={`pointer-events-auto rounded-md border bg-card/95 px-2 py-0.5 text-[11px] ${
                  entity.kind === POLITY_KIND ? toneTextClass('gold') : 'border-border/60'
                }`}
              >
                {entity.name}
              </button>
            );
          })}
        </div>
      )}

      {configOpen && (
        <PoliticsConfigPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          config={politics.config}
          onSave={moduleConfig.save}
        />
      )}

      <QuickGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onCreatePolity={() => {
          setGuideOpen(false);
          setForm({ kind: POLITY_KIND, entityId: null });
        }}
      />
    </div>
  );
};

export type { PoliticsViewId };
export default PoliticsView;
