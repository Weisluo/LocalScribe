/**
 * EntityPicker（Phase 2 P2-T3，接口冻结见 phase2_interface_freeze.md §3.3）
 *
 * 流程：模块 -> 实体（搜索 / kind 过滤）-> 关联类型（按源/目标的 (module, kind) 过滤 registry）
 *       -> 可选 label / note / time -> 保存。
 * sketch 简化流程（simpleMode）跳过类型选择，落 SKETCH_DEFAULT_LINK_TYPE。
 * 键盘：Esc 关闭（Modal 承担）、上下方向键移动、Enter 选中；无 emoji，图标全部 Lucide。
 */

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft, Loader2, Search } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { Modal } from '@/components/Modals/Modal';
import { EntityBadge } from '@/components/common/EntityBadge';
import { useEntityRefs, useLinkRegistry, useWorld, type EntityIndexEntry } from '@/components/Worldbuilding/hooks';
import {
  SKETCH_DEFAULT_LINK_TYPE,
  kindLabel,
  moduleBadgeClass,
  moduleLabel,
  refKey,
  sameRef,
} from '@/components/Worldbuilding/types';
import { filterLinkTypes } from './linkTypes';
import type { EntityPickerProps, EntityPickerSelection } from './types';

/** 契约 §5.2：地图 / 特殊未接入，选择器不展示这两个模块 */
const PICKER_MODULES = [
  'history',
  'politics',
  'economy',
  'races',
  'systems',
  'character',
];

type Step = 'module' | 'entity' | 'linkType';

const ROW_CLASS = (active: boolean, picked: boolean) =>
  `w-full flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
    active ? 'border-primary/50 bg-primary/10' : 'border-transparent hover:bg-accent/40'
  } ${picked ? 'text-foreground' : 'text-foreground/90'}`;

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2.5 py-1.5 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

export const EntityPicker = ({
  open,
  worldId,
  source,
  presetModule,
  kindFilter,
  multi = false,
  excludeRefs,
  simpleMode = false,
  onClose,
  onConfirm,
  isSubmitting = false,
}: EntityPickerProps) => {
  // LinkPanel / InlineReference 只传 worldId；角色的解析需要 projectId，
  // 由 world 查询（与 useEntityRefs 内部同一 queryKey，不额外发请求）派生。
  const worldQuery = useWorld(worldId, { includeItems: true });
  const entityRefs = useEntityRefs(worldId, worldQuery.data?.project_id ?? undefined);
  const registryQuery = useLinkRegistry();

  const [step, setStep] = useState<Step>(presetModule ? 'entity' : 'module');
  const [activeModule, setActiveModule] = useState<string | undefined>(presetModule);
  const [selected, setSelected] = useState<EntityRef[]>([]);
  const [linkType, setLinkType] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);

  // 每次打开重置流程，避免上次选择残留
  useEffect(() => {
    if (!open) return;
    setStep(presetModule ? 'entity' : 'module');
    setActiveModule(presetModule);
    setSelected([]);
    setLinkType('');
    setLabel('');
    setNote('');
    setTimeStart('');
    setTimeEnd('');
    setSearch('');
    setKind('all');
    setActiveIndex(0);
  }, [open, presetModule]);

  useEffect(() => {
    setActiveIndex(0);
  }, [step, activeModule, search, kind]);

  const sourceKey = refKey(source);
  const excludedKeys = useMemo(
    () => new Set((excludeRefs ?? []).map(refKey)),
    [excludeRefs]
  );

  /** 可被选为对端的候选：排除源自身与已存在的对端，并应用调用方的 kindFilter */
  const isEligible = useCallback(
    (entry: EntityIndexEntry) => {
      const key = refKey(entry.ref);
      if (key === sourceKey || excludedKeys.has(key)) return false;
      if (kindFilter && kindFilter.length > 0 && !kindFilter.includes(entry.kind)) return false;
      return true;
    },
    [sourceKey, excludedKeys, kindFilter]
  );

  const moduleOptions = useMemo(
    () =>
      PICKER_MODULES.map((module) => ({
        module,
        count: (entityRefs.byModule.get(module) ?? []).filter(isEligible).length,
      })).filter((option) => option.count > 0),
    [entityRefs.byModule, isEligible]
  );

  const moduleEntries = useMemo(() => {
    const entries = activeModule ? entityRefs.byModule.get(activeModule) ?? [] : [];
    const keyword = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!isEligible(entry)) return false;
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (keyword && !entry.name.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [activeModule, entityRefs.byModule, search, kind, isEligible]);

  const kindOptions = useMemo(() => {
    const kinds = new Set<string>();
    for (const entry of activeModule ? entityRefs.byModule.get(activeModule) ?? [] : []) {
      if (isEligible(entry)) kinds.add(entry.kind);
    }
    return [...kinds].sort();
  }, [activeModule, entityRefs.byModule, isEligible]);

  const linkTypeOptions = useMemo(
    () => filterLinkTypes(registryQuery.data ?? [], source, selected),
    [registryQuery.data, source, selected]
  );

  // 进入类型步骤时默认选中第一条合法类型，避免空提交
  useEffect(() => {
    if (step !== 'linkType') return;
    if (linkTypeOptions.length === 0) return;
    if (!linkTypeOptions.some((definition) => definition.id === linkType)) {
      setLinkType(linkTypeOptions[0].id);
    }
  }, [step, linkTypeOptions, linkType]);

  const moveActive = (count: number, delta: number) => {
    if (count === 0) return;
    setActiveIndex((prev) => Math.min(Math.max(prev + delta, 0), count - 1));
  };

  const handleListKeys = (
    event: KeyboardEvent<HTMLDivElement>,
    count: number,
    onPick: (index: number) => void
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(count, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(count, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (count > 0) onPick(activeIndex);
    }
  };

  const toggleTarget = (ref: EntityRef) => {
    setSelected((prev) => {
      if (!multi) return [ref];
      return prev.some((item) => sameRef(item, ref))
        ? prev.filter((item) => !sameRef(item, ref))
        : [...prev, ref];
    });
  };

  const goEntityStep = (module: string) => {
    setActiveModule(module);
    setStep('entity');
  };

  const handleSave = () => {
    if (selected.length === 0 || isSubmitting) return;
    const hasTime = !!timeStart.trim() || !!timeEnd.trim();
    const selection: EntityPickerSelection = {
      targets: selected,
      linkType: simpleMode ? SKETCH_DEFAULT_LINK_TYPE : linkType,
      label: label.trim() || undefined,
      note: note.trim() || undefined,
      time: hasTime
        ? { start: timeStart.trim() || undefined, end: timeEnd.trim() || undefined }
        : undefined,
    };
    onConfirm(selection);
  };

  const canAdvance = selected.length > 0;

  return (
    <Modal isOpen={open} onClose={onClose} title="添加关联" size="md">
      {/* 键盘统一挂在步骤容器上：搜索框与 listbox 是兄弟节点，挂在 listbox 上时
          从自动聚焦的搜索框按下方向键/回车不会生效（冻结 §3.3 要求键盘可用） */}
      <div
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.target instanceof HTMLSelectElement) return;
          if (step === 'entity') {
            handleListKeys(event, moduleEntries.length, (index) => {
              const entry = moduleEntries[index];
              if (entry) toggleTarget(entry.ref);
            });
            return;
          }
          handleListKeys(event, moduleOptions.length, (index) => {
            const option = moduleOptions[index];
            if (option) goEntityStep(option.module);
          });
        }}
      >
        {step === 'module' && (
          <div role="listbox" aria-label="选择模块" className="space-y-1">
            {entityRefs.isLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                加载中...
              </div>
            ) : moduleOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                暂无可关联实体
              </div>
            ) : (
              moduleOptions.map((option, index) => (
                <button
                  key={option.module}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => goEntityStep(option.module)}
                  className={ROW_CLASS(index === activeIndex, false)}
                >
                  <span className="flex-1 font-medium">{moduleLabel(option.module)}</span>
                  <span className="text-[11px] text-muted-foreground">{option.count}</span>
                </button>
              ))
            )}
          </div>
        )}

        {step === 'entity' && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('module')}
                className="flex items-center gap-0.5 px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {activeModule ? moduleLabel(activeModule) : '模块'}
              </button>
              {kindOptions.length > 1 && (
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  aria-label="按类型过滤"
                  className="bg-background border border-border/50 px-2 py-1 rounded-md text-[11px] focus:border-primary focus:outline-none"
                >
                  <option value="all">全部类型</option>
                  {kindOptions.map((option) => (
                    <option key={option} value={option}>
                      {kindLabel(option)}
                    </option>
                  ))}
                </select>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {multi ? `已选 ${selected.length}` : ''}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索实体..."
                className={`${FIELD_CLASS} pl-8`}
                autoFocus
              />
            </div>

            <div
              role="listbox"
              aria-label="选择实体"
              aria-multiselectable={multi}
              className="max-h-56 space-y-1 overflow-y-auto"
            >
              {entityRefs.isLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              ) : moduleEntries.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  没有匹配的实体
                </div>
              ) : (
                moduleEntries.map((entry, index) => {
                  const picked = selected.some((item) => sameRef(item, entry.ref));
                  return (
                    <button
                      key={refKey(entry.ref)}
                      type="button"
                      role="option"
                      aria-selected={picked}
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      onClick={() => toggleTarget(entry.ref)}
                      className={ROW_CLASS(index === activeIndex, picked)}
                    >
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${moduleBadgeClass(entry.module)}`}
                      >
                        {kindLabel(entry.kind)}
                      </span>
                      <span className="flex-1 truncate">{entry.name}</span>
                      {picked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                取消
              </button>
              {simpleMode ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canAdvance || isSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  保存
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('linkType')}
                  disabled={!canAdvance}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-50"
                >
                  下一步
                </button>
              )}
            </div>
          </>
        )}

        {step === 'linkType' && (
          <>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">关联类型</div>
              {registryQuery.isLoading ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              ) : linkTypeOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  没有适用于该组合的关联类型
                </div>
              ) : (
                <div
                  role="listbox"
                  aria-label="选择关联类型"
                  className="max-h-44 space-y-1 overflow-y-auto"
                  onKeyDown={(event) =>
                    handleListKeys(event, linkTypeOptions.length, (index) => {
                      const definition = linkTypeOptions[index];
                      if (definition) setLinkType(definition.id);
                    })
                  }
                >
                  {linkTypeOptions.map((definition, index) => {
                    const picked = definition.id === linkType;
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        role="option"
                        aria-selected={picked}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => setLinkType(definition.id)}
                        title={definition.id}
                        className={ROW_CLASS(index === activeIndex, picked)}
                      >
                        <span className="flex-1 truncate">{definition.label}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {definition.reverse_label}
                        </span>
                        {picked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">标签</label>
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="可选，覆盖默认类型标签"
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">备注</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="可选"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-foreground">起始</label>
                  <input
                    type="text"
                    value={timeStart}
                    onChange={(event) => setTimeStart(event.target.value)}
                    placeholder="如：208 年"
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-foreground">结束</label>
                  <input
                    type="text"
                    value={timeEnd}
                    onChange={(event) => setTimeEnd(event.target.value)}
                    placeholder="可选"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('entity')}
                className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                上一步
              </button>
              <span className="text-[11px] text-muted-foreground">
                已选 {selected.length} 个实体
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={!linkType || isSubmitting}
                className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                保存
              </button>
            </div>
          </>
        )}

        {selected.length > 0 && step === 'linkType' && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/40 pt-2">
            {selected.map((ref) => (
              <EntityBadge
                key={refKey(ref)}
                entityRef={ref}
                name={entityRefs.resolveName(ref)}
                onClick={() => toggleTarget(ref)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
