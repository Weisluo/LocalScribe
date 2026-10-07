/**
 * SystemsView（Phase 3 P3-T5/T6/T8/T9；systems_ui_design §4.1/§5/§6/§8/§9/§10/§11/§12）
 *
 * 三栏阶梯工作台：体系列表 | 阶梯 / 典籍 | 节点详情。
 * - 中栏「阶梯 / 典籍」共享选中节点与滚动锚点（§4.3），速写档只显示只读阶梯、隐藏典籍（§8）。
 * - 全部关联读写走 LinkPanel 与数据层的 createStairEdge，不新增私有关系编辑器（契约 §5.1）。
 * - 不预置任何体系 / 阶位 / 能力 / 代价，不做数值引擎、跨体系共享节点池、地图改造与 AI 生成（§12）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  Layers,
  Link2,
  ListOrdered,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Rows3,
  ScrollText,
  Settings2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useComplexity } from '@/components/common/ComplexitySwitcher';
import type { EntityRef } from '@/services/worldbuildingApi';
import { useLinkRegistry, toRegistryMap } from '../hooks';
import { kindLabel } from '../types';
import { EmptyState } from '../shared/EmptyState';
import { QuickStart } from '../shared/QuickStart';
// 动效常量取自 shared/motion.ts（ui_style_alignment §5），本视图不自造另一套曲线
import { viewItemVariants, viewStagger } from '../shared/motion';
import { useModuleConfig } from '../shared/useModuleConfig';
import { Modal } from '@/components/Modals/Modal';
import {
  SYSTEMS_DISPLAY_MODES,
  type SystemsDisplayMode,
} from './config';
import {
  SYSTEMS_INCOMING_LINK_TYPES,
  SYSTEMS_OUTGOING_LINK_TYPES,
  isSystemEntityRef,
  isTierNode,
  nextRankOf,
  sortTiersByRank,
  type SystemEntity,
  type SystemNode,
} from './types';
import {
  metaFromMemberForm,
  metaFromTierForm,
  useSystems,
  type MemberFormValues,
  type TierFormValues,
} from './hooks/useSystems';
import { SystemList } from './components/SystemList';
import { StairBoard } from './components/StairBoard';
import { CodexView } from './components/CodexView';
import { NodeDetail } from './components/NodeDetail';
import { buildStairIndex } from './components/systemsSupport';
import { SystemFormModal } from './modals/SystemFormModal';
import { NodeFormModal } from './modals/NodeFormModal';
import { SystemsConfigPanel } from './SystemsConfigPanel';
import type { CustomFieldValues } from '../shared/CustomFieldRenderer';
import type { SystemFormValues } from './hooks/useSystems';

export interface SystemsViewProps {
  worldId: string;
  moduleId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  highlightRef?: EntityRef | null;
}

interface SystemFormState {
  open: boolean;
  editing: SystemEntity | null;
}

interface NodeFormState {
  open: boolean;
  editing: SystemNode | null;
  presetKind?: string;
  grantFromTierId?: string;
}

export const SystemsView = ({
  worldId,
  moduleId,
  onNavigateToEntity,
  highlightRef,
}: SystemsViewProps) => {
  const data = useSystems(worldId, moduleId);
  const {
    config,
    terms,
    kinds,
    tierTerm,
    rankStep,
    refs,
    counts,
    byId,
    systems: systemList,
    stairOf,
    codexOf,
    codexContent,
    grantSourcesOf,
    canEdit,
    isSaving,
    isLoading,
    isError,
  } = data;
  // 模块配置的显式保存（useSystems 只暴露解析结果，不改写 config）
  const moduleConfig = useModuleConfig(worldId, moduleId);
  const { level } = useComplexity();
  // 速写档：只读阶梯（rank + 名称），隐藏 chip / 连线 / 典籍（§8）
  const sketch = level === 'sketch';

  const registryQuery = useLinkRegistry();
  const linkTypes = useMemo(() => toRegistryMap(registryQuery.data), [registryQuery.data]);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<Record<SystemsDisplayMode, number>>({ stair: 0, codex: 0 });

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [systemId, setSystemId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<SystemsDisplayMode>('stair');
  const [leftOpen, setLeftOpen] = useState(true);
  const [middleOpen, setMiddleOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [systemForm, setSystemForm] = useState<SystemFormState>({
    open: false,
    editing: null,
  });
  const [nodeForm, setNodeForm] = useState<NodeFormState>({ open: false, editing: null });
  const [relationHelpOpen, setRelationHelpOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [visitedCodex, setVisitedCodex] = useState(false);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);

  // 搜索 200ms 防抖：覆盖体系名 / 一句话 / 阶位名 / 节点名（§5.3）
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const activeSystem = useMemo<SystemEntity | null>(
    () => systemList.find((item) => item.id === systemId) ?? systemList[0] ?? null,
    [systemList, systemId]
  );

  const activeSystemId = activeSystem?.id ?? null;
  const stair = useMemo(
    () => (activeSystemId ? stairOf(activeSystemId) : null),
    [activeSystemId, stairOf]
  );
  const stairIndex = useMemo(
    () => (stair ? buildStairIndex(stair) : null),
    [stair]
  );
  const tiers = useMemo(() => stair?.tiers ?? [], [stair]);
  const node = useMemo(() => {
    if (!nodeId || !activeSystemId) return null;
    const found = byId.get(nodeId);
    if (!found) return null;
    return found.parentId === activeSystemId ? found : null;
  }, [activeSystemId, byId, nodeId]);

  const filteredSystems = useMemo(() => {
    const keyword = debouncedQuery.trim().toLowerCase();
    if (!keyword) return systemList;
    return systemList.filter((system) => {
      if (system.name.toLowerCase().includes(keyword)) return true;
      if ((system.meta.tagline ?? '').toLowerCase().includes(keyword)) return true;
      const board = stairOf(system.id);
      return (
        board.tiers.some((tier) => tier.name.toLowerCase().includes(keyword)) ||
        board.members.some((member) => member.name.toLowerCase().includes(keyword))
      );
    });
  }, [debouncedQuery, stairOf, systemList]);

  const pathStats = useMemo(() => {
    let tierCount = 0;
    let grantCount = 0;
    for (const system of systemList) {
      const board = stairOf(system.id);
      tierCount += board.tiers.length;
      grantCount += board.edges.filter((edge) => edge.type === 'grants').length;
    }
    return { tierCount, grantCount, hasLink: counts.counts.size > 0 };
  }, [counts.counts, stairOf, systemList]);

  // 视图默认值来自模块配置；用户切换后不再被覆盖（依赖是字符串）
  const configMode: SystemsDisplayMode =
    config.displayMode === 'codex' ? 'codex' : 'stair';
  useEffect(() => {
    setDisplayMode(configMode);
  }, [configMode]);

  const effectiveMode: SystemsDisplayMode = sketch ? 'stair' : displayMode;

  // 阶梯 / 典籍切换时保留滚动锚点（§4.3）
  useEffect(() => {
    const target = anchorRef.current[effectiveMode] ?? 0;
    if (scrollRef.current && target > 0) scrollRef.current.scrollTop = target;
    if (effectiveMode === 'codex') setVisitedCodex(true);
  }, [effectiveMode]);

  const switchMode = useCallback((next: SystemsDisplayMode) => {
    setDisplayMode((current) => {
      if (current === next) return current;
      anchorRef.current[current] = scrollRef.current?.scrollTop ?? 0;
      return next;
    });
  }, []);

  // highlightRef（来自外部跳转）选中并滚动到目标节点
  const highlightId =
    highlightRef && isSystemEntityRef(highlightRef) ? highlightRef.id : null;
  /** 已处理的跳转目标：世界刷新会让 byId 变化，不能因此重复抢走用户当前选中 */
  const appliedHighlight = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightId) {
      appliedHighlight.current = null;
      return;
    }
    if (appliedHighlight.current === highlightId) return;
    const target = byId.get(highlightId);
    if (!target) return;
    appliedHighlight.current = highlightId;
    if (target.parentId) {
      setSystemId(target.parentId);
    } else {
      setSystemId(target.id);
    }
    setNodeId(target.id);
    setRightOpen(true);
    setHighlightNodeId(target.id);
  }, [byId, highlightId]);

  // ---- 选中与表单 ----

  const selectSystem = useCallback((id: string) => {
    setSystemId(id);
    setNodeId(null);
    setHighlightNodeId(null);
  }, []);

  const selectNode = useCallback((id: string) => {
    setNodeId(id);
    setRightOpen(true);
  }, []);

  const openSystemForm = useCallback((editing: SystemEntity | null) => {
    setSystemForm({ open: true, editing });
  }, []);

  const openTierForm = useCallback((editing: SystemNode | null = null) => {
    setNodeForm({ open: true, editing });
  }, []);

  const openMemberForm = useCallback((tierId: string, kind: string) => {
    setNodeForm({ open: true, editing: null, presetKind: kind, grantFromTierId: tierId });
  }, []);

  const openNodeEditor = useCallback(
    (target: SystemNode) => {
      setNodeForm({ open: true, editing: target });
    },
    []
  );

  /** 阶梯卡片上的删除入口：选中节点并交给详情里的删除确认（§5.1.5） */
  const requestDeleteNode = useCallback((target: SystemNode) => {
    setNodeId(target.id);
    setRightOpen(true);
    setDeleteRequestId(target.id);
  }, []);

  const nodeFormMode: 'tier' | 'member' = nodeForm.editing
    ? isTierNode(nodeForm.editing)
      ? 'tier'
      : 'member'
    : nodeForm.presetKind || nodeForm.grantFromTierId
      ? 'member'
      : 'tier';

  const moveSelection = useCallback(
    (delta: number) => {
      if (tiers.length === 0) return;
      const current = tiers.findIndex((tier) => tier.id === nodeId);
      const next =
        current < 0
          ? delta > 0
            ? 0
            : tiers.length - 1
          : Math.min(tiers.length - 1, Math.max(0, current + delta));
      setNodeId(tiers[next].id);
      setRightOpen(true);
    },
    [nodeId, tiers]
  );

  // 键盘：/ 搜索、j/k 按 rank 升序移动、Enter 打开详情、v 切换视图、n 新建阶位（§5.3）
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? '';
      const inField =
        tag === 'input' || tag === 'textarea' || tag === 'select' ||
        target?.isContentEditable === true;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/' && !inField) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (inField || !activeSystem) return;
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        moveSelection(event.key === 'j' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter') {
        setRightOpen(true);
        return;
      }
      if (event.key === 'v' && !sketch) {
        event.preventDefault();
        switchMode(effectiveMode === 'stair' ? 'codex' : 'stair');
        return;
      }
      if (event.key === 'n') {
        event.preventDefault();
        openTierForm(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSystem, effectiveMode, moveSelection, openTierForm, sketch, switchMode]);

  // ---- 写入 ----

  const handleSystemSubmit = async (
    values: SystemFormValues,
    customFields: CustomFieldValues
  ) => {
    if (systemForm.editing) {
      // 单次写入：避免两次 PUT 用旧 meta 互相回滚（Phase 3 修复）
      await data.updateSystem(systemForm.editing.id, values, customFields);
      return;
    }
    const created = await data.createSystem(values, customFields);
    setSystemId(created.id);
    setNodeId(null);
    setHighlightNodeId(null);
    toast.success('体系已创建，接着添加第一个阶位');
  };

  const handleTierSubmit = async (values: TierFormValues, editingId?: string) => {
    if (!activeSystem) return;
    if (editingId) {
      await data.updateNode(editingId, { name: values.name });
      await data.updateTierMeta(editingId, metaFromTierForm(values));
      return;
    }
    const created = await data.createTier(activeSystem.id, values);
    setNodeId(created.id);
  };

  const handleMemberSubmit = async (
    values: MemberFormValues,
    grantFromTierId: string | undefined,
    editingId?: string
  ) => {
    if (!activeSystem) return;
    if (editingId) {
      await data.updateNode(editingId, {
        name: values.name,
        kind: values.kind,
        meta: metaFromMemberForm(values),
      });
      return;
    }
    const created = await data.createMember(activeSystem.id, values, grantFromTierId);
    setNodeId(created.id);
  };

  const handleBulkCreate = async (names: string[]) => {
    if (!activeSystem) return;
    const created = await data.bulkCreateTiers(activeSystem.id, names);
    toast.success(`已创建 ${created.length} 个${tierTerm}`);
  };

  // 删除失败时向上抛：删除确认弹窗据此保持打开（提示由数据层 toast）
  const handleDeleteNode = async (target: SystemNode) => {
    await data.deleteNode(target.id);
    if (nodeId === target.id) setNodeId(null);
    toast.success('节点已删除');
  };

  const handleDeleteLinks = async (linkIds: string[]) => {
    for (const linkId of linkIds) {
      await data.deleteLink(linkId);
    }
    toast.success('关联已删除');
  };

  /** 调序进行中：步进会重排全部 rank，连点会用同一份旧快照重复写，故串行化 */
  const reordering = useRef(false);

  /** 上移/下移：up 即提高 rank（显示顺序由 rankDirection 决定，数据层已按语义处理） */
  const handleMoveTier = async (tierId: string, direction: 'up' | 'down') => {
    if (!activeSystem || reordering.current) return;
    reordering.current = true;
    try {
      await data.moveTier(activeSystem.id, tierId, direction);
    } catch {
      // 失败提示由数据层统一 toast
    } finally {
      reordering.current = false;
    }
  };

  /** 拖拽调序：按落点索引一次到位（早先只移动一位，长距离拖拽需要反复拖） */
  const handleReorder = async (draggedId: string, targetId: string) => {
    if (!activeSystem || draggedId === targetId || reordering.current) return;
    const stair = data.stairOf(activeSystem.id);
    // stair.tiers 是显示序（降序体系为 reversed），落点索引必须换算到 rank 升序口径
    const ascending = sortTiersByRank(stair.tiers, stair.ranks, 'ascending');
    const from = ascending.findIndex((tier) => tier.id === draggedId);
    const to = ascending.findIndex((tier) => tier.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    reordering.current = true;
    try {
      await data.moveTierTo(activeSystem.id, draggedId, to);
    } catch {
      // 失败提示由数据层统一 toast
    } finally {
      reordering.current = false;
    }
  };

  const handleCreateEdge = async (
    sourceId: string,
    targetId: string,
    type: 'systems.advances_to' | 'systems.requires'
  ): Promise<boolean> => {
    if (!activeSystem) return false;
    let result: { ok: boolean; reason?: string };
    try {
      result = await data.createStairEdge(activeSystem.id, sourceId, targetId, type);
    } catch {
      // 请求失败已由数据层 toast；界面保持原样
      return false;
    }
    if (!result.ok) {
      // 环路 / 重复边：toast 提示并保持界面不变（§5.2）
      toast.error(result.reason ?? '连线未建立');
      return false;
    }
    toast.success('连线已建立');
    return true;
  };

  // ---- 派生展示 ----

  const pathSteps = [
    { label: '新建体系，填名称与一句话说明', done: systemList.length > 0 },
    { label: '多行快速录入三行阶位', done: pathStats.tierCount > 0 },
    { label: '给一个阶位加一条能力（自动建立赋予关联）', done: pathStats.grantCount > 0 },
    { label: '在关联面板加一条关联（角色 / 种族 / 代价资源任一）', done: pathStats.hasLink },
    { label: '切换到典籍视图确认', done: visitedCodex },
  ];
  const pathComplete = pathSteps.every((step) => step.done);

  const relationSections: { title: string; ids: string[] }[] = [
    { title: '出链（体系发起）', ids: SYSTEMS_OUTGOING_LINK_TYPES },
    { title: '入链（外部指向体系）', ids: SYSTEMS_INCOMING_LINK_TYPES },
  ];

  const kindRange = (refsOfType?: EntityRef[] | null): string =>
    refsOfType && refsOfType.length > 0
      ? refsOfType.map((item) => kindLabel(item.kind)).join(' / ')
      : '任意';

  if (isLoading && systemList.length === 0) {
    return (
      <div
        data-testid="systems-view"
        className="flex h-full items-center justify-center"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div data-testid="systems-view" className="flex h-full min-h-0 flex-col bg-background">
        {/* ui_style_alignment §4.1：根是 flex 列、工具栏本身不滚动，故不带 sticky */}
        <header className="flex flex-wrap items-center gap-3 px-6 py-4 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-md border-b border-border/20">
          <motion.button
            type="button"
            aria-label={leftOpen ? '折叠体系列表' : '展开体系列表'}
            onClick={() => setLeftOpen((value) => !value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            {leftOpen ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </motion.button>

          <motion.button
            type="button"
            aria-label={middleOpen ? '折叠中栏' : '展开中栏'}
            onClick={() => setMiddleOpen((value) => !value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            <Rows3 className="h-4 w-4" aria-hidden="true" />
          </motion.button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {activeSystem ? activeSystem.name : terms.term('system', '体系')}
            </h1>
            {activeSystem?.meta.tagline && (
              <p className="truncate text-xs text-muted-foreground">
                {activeSystem.meta.tagline}
              </p>
            )}
          </div>

          {!sketch && (
            <div
              role="group"
              aria-label="视图切换"
              className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
            >
              {SYSTEMS_DISPLAY_MODES.map((mode) => {
                const Icon = mode === 'stair' ? ListOrdered : ScrollText;
                const label = mode === 'stair' ? terms.term('stair', '阶梯') : terms.term('codex', '典籍');
                const active = effectiveMode === mode;
                return (
                  <motion.button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchMode(mode)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
                      active
                        ? 'bg-background text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {activeSystem && (
              <motion.button
                type="button"
                onClick={() => openTierForm(null)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />+ 新建{tierTerm}
              </motion.button>
            )}
            {/* §4.3：每个视图只留一个主按钮 */}
            <motion.button
              type="button"
              onClick={() => openSystemForm(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />+ 新建体系
            </motion.button>
            {!sketch && (
              <motion.button
                type="button"
                onClick={() => setConfigOpen(true)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                模块配置
              </motion.button>
            )}
            <motion.button
              type="button"
              aria-label={rightOpen ? '折叠节点详情' : '展开节点详情'}
              onClick={() => setRightOpen((value) => !value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
            >
              {rightOpen ? (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              )}
            </motion.button>
          </div>
        </header>

        {isError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
            体系数据加载失败，请稍后重试。
          </div>
        ) : systemList.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-12">
            <EmptyState
              icon={Layers}
              title={terms.term('emptyTitle', '还没有体系')}
              description='从"体系名 + 一句话 + 三行阶位"开始'
              actions={[
                {
                  label: '+ 新建体系',
                  icon: Plus,
                  onClick: () => openSystemForm(null),
                },
                {
                  label: '查看关联说明',
                  icon: Link2,
                  variant: 'secondary',
                  onClick: () => setRelationHelpOpen(true),
                },
              ]}
            />
            <div className="w-full max-w-md">
              <QuickStart
                title="3 分钟最短路径"
                description="必填只有「名称 + 一句话」；阶位支持多行批量录入；能力、代价、关联全部可后补。"
                steps={pathSteps}
              />
            </div>
          </div>
        ) : (
        /* 三栏工作台：首屏以 viewStagger + viewItemVariants 交错入场（三块面板），
           阶梯 / 典籍内部的行不做交错（ui_style_alignment §5） */
        <motion.div
          variants={viewStagger}
          initial="hidden"
          animate="visible"
          className="flex min-h-0 flex-1 gap-4 px-6 py-6"
        >
          <motion.aside
            variants={viewItemVariants}
            className={`${
              leftOpen ? 'flex' : 'hidden'
            } w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-sm`}
          >
            <SystemList
              systems={filteredSystems}
              selectedSystemId={activeSystemId}
              onSelect={selectSystem}
              query={query}
              onQueryChange={setQuery}
              searchInputRef={searchRef}
              counts={counts}
              totalCount={systemList.length}
              /* 新建体系属于三档共有的必填项（§8），不受结构档限制 */
              canEdit={true}
              onCreate={() => openSystemForm(null)}
              tierTerm={tierTerm}
              className="min-h-0 flex-1"
            />
            {!pathComplete && (
              <div className="shrink-0 border-t border-border/30 p-3">
                <QuickStart
                  title="3 分钟最短路径"
                  description="按顺序完成即可得到最小可用体系。"
                  steps={pathSteps}
                />
              </div>
            )}
          </motion.aside>

          <motion.main
            variants={viewItemVariants}
            className={`${
              middleOpen ? 'flex' : 'hidden'
            } min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-sm`}
          >
            <div className="flex items-center gap-3 border-b border-border/30 px-5 py-4">
              <span className="text-sm font-semibold text-foreground">
                {effectiveMode === 'stair'
                  ? `${terms.term('stair', '阶梯')} · ${tiers.length} ${tierTerm}`
                  : `${terms.term('codex', '典籍')} · ${tiers.length} 卷`}
              </span>
              {sketch && (
                <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                  速写档：只读阶梯
                </span>
              )}
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              {activeSystem && stair && stairIndex && effectiveMode === 'stair' && (
                <StairBoard
                  system={activeSystem}
                  stair={stair}
                  stairIndex={stairIndex}
                  config={config}
                  refs={refs}
                  linkTypes={linkTypes}
                  counts={counts}
                  selectedNodeId={nodeId}
                  highlightNodeId={highlightNodeId}
                  tierTerm={tierTerm}
                  rankStep={rankStep}
                  sketch={sketch}
                  canEdit={canEdit}
                  canManageTier
                  isSaving={isSaving}
                  scrollRootRef={scrollRef}
                  onSelectNode={selectNode}
                  onAddMember={openMemberForm}
                  onEditTier={openTierForm}
                  onDeleteNode={requestDeleteNode}
                  onMoveTier={handleMoveTier}
                  onReorder={handleReorder}
                  onCreateEdge={handleCreateEdge}
                  onBulkCreate={handleBulkCreate}
                />
              )}
              {activeSystem && effectiveMode === 'codex' && (
                <CodexView
                  worldId={worldId}
                  system={activeSystem}
                  volumes={codexOf(activeSystem.id)}
                  tierTerm={tierTerm}
                  codexContent={codexContent}
                  selectedNodeId={nodeId}
                  onSelectNode={selectNode}
                  highlightNodeId={highlightNodeId}
                />
              )}
            </div>
          </motion.main>

          <motion.aside
            variants={viewItemVariants}
            className={`${
              rightOpen ? 'flex' : 'hidden'
            } fixed inset-x-0 bottom-0 z-30 max-h-[60vh] flex-col rounded-t-2xl border border-border/50 bg-card/40 shadow-lg backdrop-blur-md lg:static lg:z-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:overflow-hidden lg:rounded-2xl lg:shadow-sm lg:backdrop-blur-sm`}
          >
            <div className="flex items-center justify-end p-2 lg:hidden">
              <button
                type="button"
                aria-label="关闭节点详情"
                onClick={() => setRightOpen(false)}
                className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeSystem && stair && stairIndex && (
                <NodeDetail
                  worldId={worldId}
                  system={activeSystem}
                  node={node}
                  stair={stair}
                  stairIndex={stairIndex}
                  config={config}
                  kinds={kinds}
                  refs={refs}
                  linkTypes={linkTypes}
                  counts={counts}
                  codexContent={codexContent}
                  tierTerm={tierTerm}
                  sketch={sketch}
                  canEdit={canEdit}
                  canManageTier
                  onNavigate={onNavigateToEntity}
                  onEdit={openNodeEditor}
                  onDeleteNode={handleDeleteNode}
                  onDeleteLinks={handleDeleteLinks}
                  onAddMember={openMemberForm}
                  onEditSystem={() => openSystemForm(activeSystem)}
                  grantSourcesOf={grantSourcesOf}
                  deleteRequestId={deleteRequestId}
                  onDeleteRequestHandled={() => setDeleteRequestId(null)}
                />
              )}
            </div>
          </motion.aside>
        </motion.div>
        )}

        <SystemFormModal
          open={systemForm.open}
          onClose={() => setSystemForm({ open: false, editing: null })}
          config={config}
          kinds={kinds}
          system={systemForm.editing}
          onSubmit={handleSystemSubmit}
          isSubmitting={isSaving}
        />

        <NodeFormModal
          open={nodeForm.open}
          onClose={() => setNodeForm({ open: false, editing: null })}
          mode={nodeFormMode}
          config={config}
          kinds={kinds}
          tierTerm={tierTerm}
          defaultRank={nextRankOf(tiers, rankStep)}
          sketch={sketch}
          editing={nodeForm.editing}
          presetKind={nodeForm.presetKind}
          grantFromTierId={nodeForm.grantFromTierId}
          onSubmitTier={handleTierSubmit}
          onSubmitMember={handleMemberSubmit}
          isSubmitting={isSaving}
        />

        <SystemsConfigPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          config={config}
          rawConfig={moduleConfig.raw ?? undefined}
          onSave={moduleConfig.save}
        />

        <Modal
          isOpen={relationHelpOpen}
          onClose={() => setRelationHelpOpen(false)}
          title="体系关联说明"
          size="lg"
        >
          <div className="space-y-4" data-testid="systems-relation-help">
            <p className="text-xs text-muted-foreground">
              体系模块只使用契约 §4 白名单内的关联类型；未接入的模块（经济 / 历史 / 种族）入口自动隐藏，
              通用兜底仍为 core.related_to / core.references。
            </p>
            {relationSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <div className="text-xs font-semibold text-foreground">{section.title}</div>
                <div className="space-y-1">
                  {section.ids.map((id) => {
                    const definition = linkTypes.get(id);
                    return (
                      <div
                        key={id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs"
                      >
                        <span className="rounded-full border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {id}
                        </span>
                        <span className="text-foreground">
                          {definition?.label ?? '（注册表未提供标签）'}
                        </span>
                        {definition?.reverse_label && (
                          <span className="text-muted-foreground">
                            反向：{definition.reverse_label}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {kindRange(definition?.source)} -&gt; {kindRange(definition?.target)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              关联类型统一来自契约注册表，本模块不新增 link_type；阶位术语「{tierTerm}」可在模块配置中修改。
            </p>
          </div>
        </Modal>
      </div>
    </MotionConfig>
  );
};

export default SystemsView;
