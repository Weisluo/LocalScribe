/**
 * 图鉴详情页 RaceDetail（Phase 3 P3-T3；races_ui_design §4.2/§6.2/§9、§5.1.3）
 *
 * 左栏：档案字段组，固定顺序「生理 / 文化 / 天赋 / 渊源」（races_ui_design §3.3 的 atlas.* item），
 * 空组显示幽灵占位（点击就地编辑）；编辑走本地草稿 + 显式保存（Ctrl/Cmd+Enter 保存、Esc 撤销），
 * 落库经 saveAtlasItem（合并写，未知键不丢）；右栏下方自定义字段同款草稿 + 显式保存
 * （写一次 race meta，不逐字符写库）；只读档位（sketch）不提供编辑入口。
 * 代表人物头像行取 races.notable_figure（懒加载）；支系区只列直接子级，第三层入口不渲染。
 * 右栏是契约统一 LinkPanel（唯一可编辑关联面），其下叠加快捷 chip 摘要（只读、点击跳转）。
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Link2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import { LinkPanel } from '@/components/common/LinkPanel';
import { Modal } from '@/components/Modals/Modal';
import {
  shortRefId,
  toRegistryMap,
  useCreateWorldLinks,
  useLinkRegistry,
  useWorld,
  useWorldLinks,
} from '@/components/Worldbuilding/hooks';
import { linkDisplayLabel, splitLinks } from '@/components/Worldbuilding/types';
import type { EntityRef } from '@/services/worldbuildingApi';
import {
  CustomFieldRenderer,
  type CustomFieldValues,
} from '../../shared/CustomFieldRenderer';
import { writeCustomField } from '../../shared/customFieldModel';
import {
  customFieldsOf,
  kindLabelOf,
  statusDefsOf,
  statusLabelOf,
  type CustomFieldValue,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import { viewSpring } from '../../shared/motion';
import { useInView } from '../../shared/useVirtualList';
import { emblemColorOf, raceAtlasItems } from '../config';
import {
  RACE_KINDS,
  RACES_INCOMING_LINK_TYPES,
  canOwnSubrace,
  raceRefOf,
  type AtlasItemDef,
  type RaceNode,
} from '../types';
import type { UseRacesResult } from '../hooks/useRaces';
import { Emblem } from './Emblem';
import { RelationChipRow } from './RelationChipRow';
import { toneColor } from './toneColor';

/** 右栏快捷 chip 分组：link_type 全部取自契约 §4.5 / §6.1 白名单 */
const CHIP_GROUPS: {
  label: string;
  linkTypes: string[];
  module: string;
  direction: 'out' | 'in';
}[] = [
  { label: '居住地', linkTypes: ['races.inhabits'], module: 'map', direction: 'out' },
  { label: '起源', linkTypes: ['races.origin_at'], module: 'map', direction: 'out' },
  { label: '体系亲和', linkTypes: ['races.affinity_with'], module: 'systems', direction: 'out' },
  {
    label: '特产与消费偏好',
    linkTypes: ['races.specialty', 'races.prefers'],
    module: 'economy',
    direction: 'out',
  },
  { label: '族外关系', linkTypes: ['races.related_to'], module: 'races', direction: 'out' },
  {
    label: '入链（角色 / 政治 / 历史）',
    linkTypes: RACES_INCOMING_LINK_TYPES,
    module: 'politics',
    direction: 'in',
  },
];

/** 代表人物头像：进入视口后才渲染字母章（§11 头像懒加载） */
const NotableFigureRow = ({ name, onOpen }: { name: string; onOpen: () => void }) => {
  const { ref, inView } = useInView<HTMLButtonElement>();
  return (
    <motion.button
      ref={ref}
      type="button"
      data-testid="notable-figure-row"
      onClick={onOpen}
      title={name}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={viewSpring}
      className="flex w-16 flex-col items-center gap-1 rounded-xl p-1.5 transition-colors hover:bg-accent/10"
    >
      {inView ? (
        <Emblem name={name} color={toneColor('slate')} size={32} />
      ) : (
        <span className="h-8 w-8 rounded-lg bg-muted/30" aria-hidden="true" />
      )}
      <span className="w-full truncate text-center text-xs text-foreground">{name}</span>
    </motion.button>
  );
};

export interface RaceDetailProps {
  worldId: string;
  node: RaceNode;
  config: ModuleConfig;
  races: UseRacesResult;
  onBack: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onEdit: (node: RaceNode) => void;
  onAddSubrace: (parent: RaceNode) => void;
  onSelectNode: (nodeId: string) => void;
  onDelete: (nodeId: string) => Promise<unknown>;
}

export const RaceDetail = ({
  worldId,
  node,
  config,
  races,
  onBack,
  onNavigateToEntity,
  onEdit,
  onAddSubrace,
  onSelectNode,
  onDelete,
}: RaceDetailProps) => {
  const entityRef = useMemo(() => raceRefOf(node.id, node.kind), [node.id, node.kind]);
  const linksQuery = useWorldLinks(worldId);
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const registryQuery = useLinkRegistry();
  const registry = useMemo(() => toRegistryMap(registryQuery.data), [registryQuery.data]);
  const worldQuery = useWorld(worldId);
  const createLinks = useCreateWorldLinks(worldId);

  /** 档案字段组草稿：显式保存，避免逐字符写库 */
  const [draft, setDraft] = useState<{ name: string; values: CustomFieldValues } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** 自定义字段草稿：与档案字段组同款「本地草稿 + 显式保存」，输入只改草稿，点保存才写一次 */
  const [customDraft, setCustomDraft] = useState<CustomFieldValues>(() => node.meta.customFields);

  const color = emblemColorOf(node, config);
  const icon = node.meta.emblem?.icon ?? node.icon;
  const tagline = node.meta.tagline ?? node.description ?? '';
  const statusLabel = statusLabelOf(config, node.meta.status);
  const statusColor = statusDefsOf(config).find((def) => def.id === node.meta.status)?.color;
  const customFields = customFieldsOf(config, node.kind, RACE_KINDS);
  const serverCustomFields = node.meta.customFields;

  // 切换到另一个条目时以服务端值重置草稿；后台刷新不覆盖正在输入的草稿
  useEffect(() => {
    setCustomDraft(node.meta.customFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只按条目切换重置草稿
  }, [node.id]);

  /** 自定义字段是否有未保存修改：只按本 kind 声明的字段取值签名比较（数组值也能正确对比） */
  const customDirty =
    JSON.stringify(customFields.map((field) => customDraft[field.id] ?? '')) !==
    JSON.stringify(customFields.map((field) => serverCustomFields[field.id] ?? ''));

  const { outgoing, incoming } = useMemo(() => splitLinks(links, entityRef), [links, entityRef]);
  const notableLinks = useMemo(
    () =>
      outgoing.filter(
        (link) => link.link_type === 'races.notable_figure' && link.target.module === 'character'
      ),
    [outgoing]
  );
  const linkCount = races.counts.countOf(entityRef);
  const subraces = node.children;
  const canAddSubrace = races.canEdit && canOwnSubrace(config, node.kind, RACE_KINDS);

  /** 首个该类关联的对端名；对端解析不到（返回短号）时回退到文本字段 */
  const firstTargetName = (linkType: string, fallback?: string): string => {
    const link = outgoing.find((item) => item.link_type === linkType);
    if (!link) return fallback || '未记录';
    const name = races.refs.resolveName(link.target);
    if (!name || name === shortRefId(link.target.id)) return fallback || '未记录';
    return name;
  };
  const habitat = firstTargetName('races.inhabits', node.meta.habitatText);
  const origin = firstTargetName('races.origin_at', node.meta.originText);

  const moduleTypes = useMemo(
    () =>
      new Set<string>((worldQuery.data?.modules ?? []).map((module) => module.module_type)),
    [worldQuery.data]
  );

  const patchDraft = (fieldId: string, value: CustomFieldValue) => {
    setDraft((prev) =>
      prev ? { ...prev, values: writeCustomField(prev.values, fieldId, value) } : prev
    );
  };

  const commitDraft = async () => {
    if (!draft) return;
    try {
      await races.saveAtlasItem(node.id, draft.name, draft.values);
      setDraft(null);
    } catch {
      // 失败提示由 useModuleEntities.onError 统一给出；这里保留草稿供重试，异常不外抛
    }
  };

  /** 自定义字段显式保存：一次 PUT 写完，失败保留草稿 */
  const commitCustomDraft = async () => {
    try {
      await races.updateRaceMeta(node.id, { customFields: customDraft });
    } catch {
      // 同上：失败提示已由 mutation 的 onError 给出，草稿保留
    }
  };

  /** 字段组内的键盘：Ctrl/Cmd+Enter 保存，Esc 撤销本次输入（§5.1.3） */
  const handleDraftKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setDraft(null);
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commitDraft();
    }
  };

  const handlePickerConfirm = (selection: EntityPickerSelection) => {
    const items = selection.targets.map((target) => ({
      source: entityRef,
      target,
      // 头像行只做「代表人物」，类型不由选择器决定（§4.2 / 契约 §4.5）
      link_type: 'races.notable_figure',
      label: selection.label,
      note: selection.note,
    }));
    // EntityPicker 不 await onConfirm：这里自己收口 Promise，失败只提示不抛（不产生 unhandledrejection）
    void createLinks
      .mutateAsync(items)
      .then((result) => {
        if (result.failed.length === 0) setPickerOpen(false);
      })
      .catch((error: unknown) => {
        // 单条失败已由 useCreateWorldLinks.onSuccess 汇总提示，这里兜底整个请求被拒的情况
        toast.error(error instanceof Error ? error.message : '添加代表人物失败');
      });
  };

  const renderAtlasGroup = (item: AtlasItemDef) => {
    const values = races.atlasOf(node.id, item.name) as CustomFieldValues;
    const isDraft = draft?.name === item.name;
    const empty = item.fields.every((field) => {
      const value = values?.[field.id];
      return value === undefined || value === null || value === '';
    });
    const ghostLabel = `添加${item.fields
      .slice(0, 3)
      .map((field) => field.label)
      .join('/')}`;

    return (
      <div
        key={item.name}
        className="space-y-1.5"
        data-testid="atlas-group"
        data-group={item.name}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{item.label}</span>
          {races.canEdit && !isDraft && (
            <button
              type="button"
              aria-label={`编辑${item.label}`}
              onClick={() => setDraft({ name: item.name, values: { ...(values ?? {}) } })}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {isDraft && (
            <span className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void commitDraft()}
                disabled={races.isSaving}
                className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                保存
              </button>
            </span>
          )}
        </div>
        {isDraft ? (
          <div onKeyDown={handleDraftKeys}>
            <CustomFieldRenderer fields={item.fields} values={draft.values} onChange={patchDraft} />
          </div>
        ) : empty ? (
          races.canEdit ? (
            <button
              type="button"
              data-testid="atlas-ghost"
              onClick={() => setDraft({ name: item.name, values: {} })}
              className="rounded-lg border-2 border-dashed border-border/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/5 hover:text-primary"
            >
              {ghostLabel}
            </button>
          ) : null
        ) : (
          <CustomFieldRenderer
            fields={item.fields}
            values={values}
            readOnly
            onNavigateToEntity={onNavigateToEntity}
            resolveEntityName={races.refs.resolveName}
            invalidEntity={races.refs.isInvalid}
          />
        )}
      </div>
    );
  };

  const relatedRows = [
    ...outgoing.map((link) => ({ key: link.id, link, counterpart: link.target })),
    ...incoming.map((link) => ({ key: link.id, link, counterpart: link.source })),
  ];

  /** 删除确认：列出将失效 / 级联的关联（契约 §2.5 / §5.1.3） */
  const renderDeleteConfirm = () => (
    <Modal
      isOpen={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      title="删除种族条目"
      size="md"
    >
      <div className="space-y-4" data-testid="race-delete-confirm">
        <p className="text-sm text-foreground">确认删除「{node.name}」？此操作不可撤销。</p>
        {subraces.length > 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {subraces.length} 个支系将随主条目一并删除：
            {subraces.map((child) => child.name).join('、')}
          </p>
        )}
        <div className="space-y-1.5 rounded-xl border border-border/40 bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            以下 {races.linksOfNode(node.id)} 条关联将失效或被级联删除
          </div>
          {relatedRows.length === 0 ? (
            <div className="text-xs text-muted-foreground">当前没有关联</div>
          ) : (
            <ul className="space-y-1">
              {relatedRows.map(({ key, link, counterpart }) => (
                <li key={key} className="flex items-center gap-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {linkDisplayLabel(link, entityRef, registry)}
                  </span>
                  <span className="min-w-0 truncate text-foreground">
                    {races.refs.resolveName(counterpart)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            disabled={races.isSaving}
            onClick={() => {
              setConfirmDelete(false);
              // 删除失败提示由 useModuleEntities.onError 统一给出，这里只兜底 Promise 拒绝
              void onDelete(node.id).catch(() => {
                // 不重复提示，也不让异常逃逸成 unhandledrejection
              });
            }}
            className="rounded-lg bg-destructive px-3.5 py-1.5 text-sm font-medium text-destructive-foreground shadow-sm transition-all duration-200 hover:bg-destructive/90 disabled:opacity-50"
          >
            确认删除
          </button>
        </div>
      </div>
    </Modal>
  );

  return (
    <section
      data-testid="race-detail"
      data-race-id={node.id}
      data-kind={node.kind}
      className="flex h-full min-h-0 flex-col overflow-y-auto rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-sm"
    >
      <header className="space-y-3 border-b border-border/30 pb-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回图鉴"
            className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <Emblem name={node.name} icon={icon} color={color} size={40} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                {node.name}
              </h2>
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                {kindLabelOf(config, node.kind, RACE_KINDS)}
              </span>
              {statusLabel && (
                <span className="flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: toneColor(statusColor) }}
                    aria-hidden="true"
                  />
                  {statusLabel}
                </span>
              )}
            </div>
            {tagline && (
              <p className="text-xs leading-relaxed text-muted-foreground">{tagline}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(node)}
              aria-label="编辑条目"
              className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="删除条目"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-destructive transition-all duration-200 hover:border-destructive/60 hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {node.meta.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {node.meta.traits.map((trait, index) => (
              <span
                // 标签是自由文本，可能重复：key 用「值 + 下标」保持稳定唯一
                key={`${trait}-${index}`}
                className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300"
              >
                {trait}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>居住地：{habitat}</span>
          <span>起源：{origin}</span>
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3" aria-hidden="true" />
            关联 {linkCount} · 出链 {outgoing.length} 入链 {incoming.length}
          </span>
        </div>
      </header>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div
            className="space-y-4 rounded-xl border border-border/40 bg-card/30 p-4"
            data-testid="atlas-panel"
          >
            <div className="text-xs font-semibold text-muted-foreground">档案</div>
            {raceAtlasItems().map(renderAtlasGroup)}
          </div>

          {customFields.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border/40 bg-card/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">自定义字段</span>
                {/* 有未保存修改才出现取消 / 保存，与档案字段组的草稿态一致 */}
                {races.canEdit && customDirty && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomDraft(serverCustomFields)}
                      className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => void commitCustomDraft()}
                      disabled={races.isSaving}
                      className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      保存
                    </button>
                  </span>
                )}
              </div>
              <CustomFieldRenderer
                fields={customFields}
                values={customDraft}
                readOnly={!races.canEdit}
                showEmpty={races.canEdit}
                onChange={(fieldId, value) =>
                  setCustomDraft((prev) => writeCustomField(prev, fieldId, value))
                }
                onNavigateToEntity={onNavigateToEntity}
                resolveEntityName={races.refs.resolveName}
                invalidEntity={races.refs.isInvalid}
              />
            </div>
          )}

          <div
            className="space-y-3 rounded-xl border border-border/40 bg-card/30 p-4"
            data-testid="notable-figures"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              代表人物
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                从角色中选择
              </button>
            </div>
            {notableLinks.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground">
                未关联代表人物
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {notableLinks.map((link) => (
                  <NotableFigureRow
                    key={link.id}
                    name={races.refs.resolveName(link.target)}
                    onOpen={() => onNavigateToEntity(link.target)}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="space-y-3 rounded-xl border border-border/40 bg-card/30 p-4"
            data-testid="subrace-area"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              支系
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                {subraces.length}
              </span>
              {canAddSubrace && (
                <button
                  type="button"
                  onClick={() => onAddSubrace(node)}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  添加支系
                </button>
              )}
            </div>
            {subraces.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground">
                还没有支系{canAddSubrace ? '，点击「添加支系」补一个' : ''}
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* 只渲染直接子级：第三层入口不出现（§4.2 / §12.3） */}
                {subraces.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    data-testid="subrace-row"
                    data-race-id={child.id}
                    onClick={() => onSelectNode(child.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors hover:border-teal-500/30 hover:bg-accent/10"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{child.name}</span>
                    <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs text-teal-700 dark:text-teal-300">
                      {kindLabelOf(config, child.kind, RACE_KINDS)}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3" aria-hidden="true" />
                      {races.linksOfNode(child.id)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <LinkPanel worldId={worldId} entity={entityRef} onNavigate={onNavigateToEntity} />
          {CHIP_GROUPS.map((group) => {
            const pool = group.direction === 'in' ? incoming : outgoing;
            const groupLinks = pool.filter((link) => group.linkTypes.includes(link.link_type));
            // 目标模块未接入且没有任何关联时不显示该分组（§6.1 未接入处理）
            const integrated =
              moduleTypes.has(group.module) ||
              (group.direction === 'in' &&
                (moduleTypes.has('history') ||
                  moduleTypes.has('politics') ||
                  moduleTypes.has('character')));
            if (groupLinks.length === 0 && !integrated) return null;
            return (
              <RelationChipRow
                key={group.label}
                links={pool}
                linkTypes={group.linkTypes}
                label={group.label}
                refs={races.refs}
                onNavigate={onNavigateToEntity}
                sourceRef={entityRef}
              />
            );
          })}
        </div>
      </div>

      <EntityPicker
        open={pickerOpen}
        worldId={worldId}
        source={entityRef}
        presetModule="character"
        kindFilter={['character']}
        multi
        simpleMode
        excludeRefs={notableLinks.map((link) => link.target)}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        isSubmitting={createLinks.isPending}
      />

      {renderDeleteConfirm()}
    </section>
  );
};
