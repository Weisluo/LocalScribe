/**
 * ModuleConfigPanel（Phase 3 P3-T8；契约 §2.7、races_ui_design §7、systems_ui_design §7）
 * Phase 6 P6-T5：分页收敛为 类型 / 字段 / 等级 / 状态 / 关联类型 / 展示 / 术语（+ 模块专属）。
 *
 * 草稿显式保存：所有编辑只改本地 draft，点「保存」才写回 module.config；校验失败不生效。
 * 覆盖通用键（entityTypes / fieldSchema / statuses / levels / linkTypes / terminology /
 * defaultComplexity / displayMode）与模块专属键（races: relationKinds、emblemPalette、cardFields；
 * systems: tierTerm、rankStep、nodeStyles、costFields）。
 * 未知键不参与编辑但也不会被删除（保存是浅合并补丁）。
 *
 * 关联类型页只编辑 module.config.linkTypes：核心注册表条目可以改名 / 改色 / 改图标（存为覆盖项，
 * 不写回注册表，也不可删除），自定义条目只落在本模块 config，绝不新增契约 §4 之外的 link_type。
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Check,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';
import type { ComplexityLevel, LinkTypeDef } from '@/services/worldbuildingApi';
import {
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_KIND_PREFIX,
  LINK_TYPE_FALLBACK_ID,
  kindDefsOf,
  toFieldId,
  toKindId,
  toLinkTypeId,
  validateCustomLinkType,
  validateEntityType,
  type CustomFieldDef,
  type CustomFieldType,
  type CustomLinkTypeDef,
  type EntityTypeDef,
  type LevelDef,
  type ModuleConfig,
  type RelationKindDef,
  type StatusDef,
} from './moduleConfig';
import { lucideIcon } from './lucideIcon';

/** 输入框配方（ui_style_alignment §3.1 / §4.5）：rounded-xl + muted 底 + primary 焦点环 */
const FIELD_CLASS =
  'w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-1.5 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15';

/** 行内编辑用：FIELD_CLASS 的 w-full 放进 flex 行会互相挤压，这里用固定宽度 */
const INLINE_FIELD_CLASS =
  'rounded-xl border border-border/40 bg-muted/30 px-3 py-1.5 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15';

/** 配置行（列表行，不是实体卡片）：§4.8 的轻量版 */
const CONFIG_ROW_CLASS = 'rounded-lg border border-border/50 bg-card/40 px-3 py-1.5';

/** 表单分组外壳（§4.9 面板内的局部区块） */
const CONFIG_SECTION_CLASS = 'rounded-xl border border-border/50 bg-muted/20 p-3';

/** 主按钮（§4.3 的紧凑版） */
const PRIMARY_BUTTON_CLASS =
  'flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20';

/** 次要按钮（§4.2 的紧凑版） */
const SECONDARY_BUTTON_CLASS =
  'flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground';

const FIELD_TYPES = CUSTOM_FIELD_TYPES;

const FIELD_TYPE_LABELS = CUSTOM_FIELD_TYPE_LABELS;

const asDefs = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** 稳定深比较：只用于判断某个键相对初始基线是否被用户改过 */
const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ModuleConfigPanelProps {
  open: boolean;
  onClose: () => void;
  /** 解析后的配置（默认值 + 后端 config），作为草稿初值 */
  config: ModuleConfig;
  /** 后端原始 config（可选，仅用于兼容调用方；保存仍是浅合并补丁） */
  rawConfig?: ModuleConfig;
  /** 保存补丁（由 useModuleConfig().save 承担浅合并与 PUT） */
  onSave: (patch: ModuleConfig) => Promise<void>;
  /** 内置 kind：不可删除，作为 parentKind 解析基准 */
  builtins: EntityTypeDef[];
  /** 该模块允许的最大层级（races=2、systems=3） */
  maxDepth: number;
  /** 模块专属配置段；不传时按 config 里出现的键自动识别 */
  moduleType?: 'races' | 'systems' | string;
  /** 核心关联类型注册表（只读展示；不传时关联类型页只显示自定义条目） */
  linkRegistry?: LinkTypeDef[];
  /** 打开字段编辑器（P6-T4 FieldSchemaEditor）；不传时字段页只保留行内快编 */
  onManageFields?: (kindId: string) => void;
  /** 额外自定义区（可选；模块专属键已由 moduleType / 自动识别覆盖） */
  extra?: ReactNode;
  /** 打开时落在哪一页（默认「类型」） */
  initialTab?: PanelTab;
  title?: string;
}

type PanelTab =
  | 'types'
  | 'fields'
  | 'levels'
  | 'statuses'
  | 'linkTypes'
  | 'display'
  | 'terms'
  | 'module';

/**
 * 保存补丁构造（纯函数，P6-T5 抽出便于单测）：
 * 只提交相对打开时基线有变化的键——调用方传进来的 config 是「解析后配置」（已叠加前端默认值），
 * 全量提交会把 EMBLEM_PALETTE / DEFAULT_NODE_STYLES / cardFields 等预设冻结进 module.config，
 * 之后前端默认值再改就不生效了。save 是把补丁浅合并回后端原始 config，未改动的键保持原样。
 * 对象键（fieldSchema / terminology / nodeStyles）按子键差分，只提交新增或有改动的子键；
 * 子键被删除时整份提交（浅合并没有别的办法删掉旧子键）。
 */
export interface ModuleConfigPatchInput {
  source: ModuleConfig;
  baseline: ModuleConfig;
  /** 后端真实存着的 config：对象键要基于它做增量，避免丢掉未编辑的子键 */
  stored: ModuleConfig;
  hasRacesKeys: boolean;
  hasSystemsKeys: boolean;
}

export const buildModuleConfigPatch = ({
  source,
  baseline,
  stored,
  hasRacesKeys,
  hasSystemsKeys,
}: ModuleConfigPatchInput): ModuleConfig => {
  const built: ModuleConfig = {
    entityTypes: asDefs<EntityTypeDef>(source.entityTypes),
    fieldSchema: source.fieldSchema ?? {},
    statuses: asDefs<StatusDef>(source.statuses),
    levels: asDefs<LevelDef>(source.levels),
    linkTypes: asDefs<CustomLinkTypeDef>(source.linkTypes),
    terminology: source.terminology ?? {},
    defaultComplexity: source.defaultComplexity,
    displayMode: source.displayMode,
  };
  if (hasRacesKeys) {
    built.relationKinds = asDefs<RelationKindDef>(source.relationKinds);
    built.emblemPalette = asDefs<string>(source.emblemPalette);
    built.cardFields = asDefs<string>(source.cardFields);
  }
  if (hasSystemsKeys) {
    built.tierTerm = source.tierTerm;
    built.rankStep = source.rankStep;
    built.nodeStyles = source.nodeStyles ?? {};
    built.costFields = asDefs<string>(source.costFields);
  }

  const patch: ModuleConfig = {};
  for (const [key, value] of Object.entries(built)) {
    // undefined 经浅合并会被跳过，没必要写进补丁
    if (value === undefined) continue;
    const base = baseline[key];
    if (isRecord(value)) {
      const draftRecord = value;
      const baseRecord = isRecord(base) ? base : {};
      // 注意：save 是把补丁**浅合并**到后端原始 config（mergeModuleConfig 只做顶层合并），
      // 所以对象键必须提交「完整的目标对象」——只提交改动子键会把未编辑的同级子键整片抹掉。
      const storedRecord = isRecord(stored[key]) ? stored[key] : {};
      const changed: Record<string, unknown> = {};
      for (const [subKey, subValue] of Object.entries(draftRecord)) {
        if (!sameJson(subValue, baseRecord[subKey])) changed[subKey] = subValue;
      }
      // 用户显式删掉的子键：基线里有、草稿里没有
      const removedKeys = Object.keys(baseRecord).filter((subKey) => !(subKey in draftRecord));
      if (Object.keys(changed).length > 0 || removedKeys.length > 0) {
        const next: Record<string, unknown> = { ...storedRecord, ...changed };
        for (const subKey of removedKeys) delete next[subKey];
        patch[key] = next;
      }
      continue;
    }
    if (!sameJson(value, base)) patch[key] = value;
  }
  return patch;
};


/**
 * 面板正文（不含 Modal 外壳）：SSR / 单测可直接渲染，不必等 Modal 的过渡动画挂载。
 * 草稿初值同时用 useState 惰性初始化（SSR 无 effect）与 open 效果重置（真实挂载）。
 */
export const ModuleConfigPanelBody = ({
  open,
  onClose,
  config,
  rawConfig,
  onSave,
  builtins,
  maxDepth,
  moduleType,
  linkRegistry,
  onManageFields,
  extra,
  initialTab,
}: ModuleConfigPanelProps) => {
  /** rawConfig 仅在调用方显式传入时覆盖同名键（通常与 config 同源） */
  const initialConfig = useMemo<ModuleConfig>(
    () => ({ ...config, ...(rawConfig ?? {}) }),
    [config, rawConfig]
  );
  const [draft, setDraft] = useState<ModuleConfig>(() => initialConfig);
  const [tab, setTab] = useState<PanelTab>(initialTab ?? 'types');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 代价字段顺序输入框的原文草稿：直接用数组 join 回写会抹掉正在输入的逗号 */
  const [costFieldsText, setCostFieldsText] = useState<string | null>(null);
  const wasOpen = useRef(false);
  /** 打开面板时的配置基线：保存时只提交与它不同的键（见 buildModuleConfigPatch） */
  const baselineRef = useRef<ModuleConfig>(initialConfig);
  /** 后端真实存着的 config：对象键（fieldSchema/terminology/nodeStyles）要基于它做增量，避免丢掉未编辑的子键 */
  const storedRef = useRef<ModuleConfig>(rawConfig ?? {});

  // 只在打开时初始化草稿：避免父组件每次渲染产生的新对象把草稿重置掉
  useEffect(() => {
    if (open && !wasOpen.current) {
      baselineRef.current = initialConfig;
      storedRef.current = rawConfig ?? {};
      setDraft(initialConfig);
      setError(null);
      setNotice(null);
      setTab(initialTab ?? 'types');
      setCostFieldsText(null);
    }
    wasOpen.current = open;
  }, [open, initialConfig, rawConfig, initialTab]);

  const kinds = useMemo(() => kindDefsOf(draft, builtins), [draft, builtins]);
  const builtinIds = useMemo(() => builtins.map((def) => def.id), [builtins]);
  const builtinIdSet = useMemo(() => new Set(builtinIds), [builtinIds]);

  // 模块专属键自动识别：调用方即使不传 moduleType，races/systems 的键也能编辑并落库
  const hasRacesKeys =
    moduleType === 'races' ||
    (!moduleType && (config.relationKinds !== undefined || config.emblemPalette !== undefined));
  const hasSystemsKeys =
    moduleType === 'systems' ||
    (!moduleType &&
      (config.tierTerm !== undefined ||
        config.rankStep !== undefined ||
        config.nodeStyles !== undefined));
  const showModuleTab = hasRacesKeys || hasSystemsKeys;

  const patchDraft = (patch: ModuleConfig) => setDraft((prev) => ({ ...prev, ...patch }));

  // ---- 类型 ----

  const [newKind, setNewKind] = useState({
    label: '',
    parentKind: builtins.find((def) => !def.parentKind)?.id ?? builtins[0]?.id ?? '',
    icon: '',
    color: '',
  });

  const addKind = () => {
    const label = newKind.label.trim();
    if (!label) {
      setError('类型名称不能为空');
      return;
    }
    const id = toKindId(label, kinds.map((def) => def.id));
    const def: EntityTypeDef = {
      id,
      label,
      parentKind: newKind.parentKind || undefined,
      icon: newKind.icon.trim() || undefined,
      color: newKind.color.trim() || undefined,
    };
    const reason = validateEntityType(draft, def, { builtins, maxDepth });
    if (reason) {
      setError(reason);
      return;
    }
    patchDraft({ entityTypes: [...asDefs<EntityTypeDef>(draft.entityTypes), def] });
    setNewKind((prev) => ({ ...prev, label: '', icon: '', color: '' }));
    setError(null);
  };

  const removeKind = (id: string) => {
    // 只摘掉类型定义：fieldSchema[id] 的字段定义保留，重新添加同 id 类型后继续生效
    patchDraft({
      entityTypes: asDefs<EntityTypeDef>(draft.entityTypes).filter((def) => def.id !== id),
    });
    setNotice(
      `已移除类型 ${id}：已有实体仍保留原 kind 与 meta，详情页会按未知类型回退展示；字段定义仍保留，重新添加同 id 的类型后会再次生效。`
    );
  };

  // ---- 字段 ----

  const [fieldKind, setFieldKind] = useState(builtins[0]?.id ?? '');
  const [newField, setNewField] = useState({
    label: '',
    type: 'text' as CustomFieldType,
    options: '',
    group: '',
  });

  const activeFieldKind = kinds.some((def) => def.id === fieldKind)
    ? fieldKind
    : kinds[0]?.id ?? '';

  // 语义必须与 customFieldsOf 一致：空数组不算显式定义，回退内置 defaultFields
  const fieldsOfKind = (kindId: string): CustomFieldDef[] => {
    const explicit = draft.fieldSchema?.[kindId];
    if (Array.isArray(explicit) && explicit.length > 0) return explicit;
    return builtins.find((def) => def.id === kindId)?.defaultFields ?? [];
  };

  const setFieldsOfKind = (kindId: string, fields: CustomFieldDef[]) =>
    patchDraft({ fieldSchema: { ...(draft.fieldSchema ?? {}), [kindId]: fields } });

  const addField = () => {
    const label = newField.label.trim();
    if (!label) {
      setError('字段名称不能为空');
      return;
    }
    const current = fieldsOfKind(activeFieldKind);
    const id = toFieldId(label, current.map((field) => field.id));
    const def: CustomFieldDef = {
      id,
      label,
      type: newField.type,
      options:
        newField.type === 'select' || newField.type === 'multiselect'
          ? newField.options
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      group: newField.group.trim() || undefined,
    };
    setFieldsOfKind(activeFieldKind, [...current, def]);
    setNewField({ label: '', type: 'text', options: '', group: '' });
    setError(null);
  };

  const removeField = (kindId: string, fieldId: string) => {
    setFieldsOfKind(
      kindId,
      fieldsOfKind(kindId).filter((field) => field.id !== fieldId)
    );
    setNotice(
      `字段 ${fieldId} 已从 schema 移除：已填数据仍保存在 meta.customFields / item.content，详情页不再渲染该字段。`
    );
  };

  // ---- 状态与等级 ----

  const [newStatus, setNewStatus] = useState({ label: '', color: '' });
  const [newLevel, setNewLevel] = useState({ label: '', rank: '' });

  const addStatus = () => {
    const label = newStatus.label.trim();
    if (!label) return;
    const id = toFieldId(label, asDefs<StatusDef>(draft.statuses).map((item) => item.id));
    patchDraft({
      statuses: [
        ...asDefs<StatusDef>(draft.statuses),
        { id, label, color: newStatus.color.trim() || undefined },
      ],
    });
    setNewStatus({ label: '', color: '' });
  };

  /**
   * 新等级的默认 rank：现有最大 rank + 10（都没有 rank 时以 0 起算）。
   * 政治版图只用 LevelDef.rank 决定节点尺寸档与布局环，缺 rank 会让所有等级同权重画成平版图。
   */
  const nextLevelRank = (levels: LevelDef[]): number =>
    levels.reduce(
      (max, def) => (typeof def.rank === 'number' && def.rank > max ? def.rank : max),
      0
    ) + 10;

  const addLevel = () => {
    const label = newLevel.label.trim();
    if (!label) return;
    const levels = asDefs<LevelDef>(draft.levels);
    const id = toFieldId(label, levels.map((item) => item.id));
    const typed = Number(newLevel.rank.trim());
    const rank =
      newLevel.rank.trim() !== '' && Number.isFinite(typed) ? typed : nextLevelRank(levels);
    patchDraft({ levels: [...levels, { id, label, rank }] });
    setNewLevel({ label: '', rank: '' });
  };

  /** 行内改等级：label 与 rank 都可编辑（rank 留空表示不设权重） */
  const updateLevel = (id: string, patch: { label?: string; rank?: string }) => {
    patchDraft({
      levels: asDefs<LevelDef>(draft.levels).map((level) => {
        if (level.id !== id) return level;
        const next: LevelDef = { ...level };
        if (patch.label !== undefined) next.label = patch.label;
        if (patch.rank !== undefined) {
          const parsed = Number(patch.rank.trim());
          next.rank =
            patch.rank.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
        }
        return next;
      }),
    });
  };

  // ---- 术语 ----

  const [newTerm, setNewTerm] = useState({ key: '', value: '' });

  const addTerm = () => {
    const key = newTerm.key.trim();
    const value = newTerm.value.trim();
    if (!key || !value) return;
    patchDraft({ terminology: { ...(draft.terminology ?? {}), [key]: value } });
    setNewTerm({ key: '', value: '' });
  };

  // ---- 模块专属 ----

  const [newRelationKind, setNewRelationKind] = useState({
    id: '',
    label: '',
    color: '',
    lineStyle: 'dashed' as RelationKindDef['lineStyle'],
  });

  const addRelationKind = () => {
    const label = newRelationKind.label.trim();
    if (!label) return;
    const id =
      newRelationKind.id.trim() ||
      toFieldId(label, asDefs<RelationKindDef>(draft.relationKinds).map((item) => item.id));
    const def: RelationKindDef = {
      id,
      label,
      color: newRelationKind.color.trim() || undefined,
      lineStyle: newRelationKind.lineStyle ?? 'dashed',
    };
    patchDraft({
      relationKinds: [...asDefs<RelationKindDef>(draft.relationKinds), def],
    });
    setNewRelationKind({ id: '', label: '', color: '', lineStyle: 'dashed' });
  };

  // ---- 关联类型（P6-T5：核心注册表只读 + 自定义类型只落 module.config）----

  /** 核心注册表 id：同名条目在 config.linkTypes 里是「覆盖项」，不可删除 */
  const coreLinkIds = useMemo(
    () => (linkRegistry ?? []).map((def) => def.id),
    [linkRegistry]
  );
  const coreLinkIdSet = useMemo(() => new Set(coreLinkIds), [coreLinkIds]);
  /** config.linkTypes 里属于核心覆盖的条目 */
  const linkOverrides = useMemo(() => {
    const overrides = new Map<string, CustomLinkTypeDef>();
    for (const def of asDefs<CustomLinkTypeDef>(draft.linkTypes)) {
      if (coreLinkIdSet.has(def.id)) overrides.set(def.id, def);
    }
    return overrides;
  }, [draft.linkTypes, coreLinkIdSet]);
  /** 用户自定义关联类型（非核心 id） */
  const customLinkTypes = asDefs<CustomLinkTypeDef>(draft.linkTypes).filter(
    (def) => !coreLinkIdSet.has(def.id)
  );

  const setLinkTypes = (next: CustomLinkTypeDef[]) => patchDraft({ linkTypes: next });

  /** 写入或更新一条 linkTypes 条目（核心覆盖与自定义共用同一条通道） */
  const upsertLinkType = (def: CustomLinkTypeDef) => {
    const others = asDefs<CustomLinkTypeDef>(draft.linkTypes).filter(
      (item) => item.id !== def.id
    );
    setLinkTypes([...others, def]);
  };

  /** 核心类型改名 / 改色：写覆盖项，不写回注册表 */
  const updateLinkOverride = (id: string, patch: Partial<CustomLinkTypeDef>) => {
    const base = linkOverrides.get(id) ?? { id, label: '' };
    upsertLinkType({ ...base, ...patch, id });
  };

  /** 撤销核心覆盖：从 config.linkTypes 移除该 id，回到注册表默认 */
  const resetLinkOverride = (id: string) =>
    setLinkTypes(asDefs<CustomLinkTypeDef>(draft.linkTypes).filter((item) => item.id !== id));

  const [newLinkType, setNewLinkType] = useState({
    label: '',
    reverseLabel: '',
    icon: '',
    color: '',
    directed: true,
    sourceModule: '',
    sourceKind: '',
    targetModule: '',
    targetKind: '',
  });

  const addLinkType = () => {
    const label = newLinkType.label.trim();
    if (!label) {
      setError('关联类型标签不能为空');
      return;
    }
    const taken = asDefs<CustomLinkTypeDef>(draft.linkTypes).map((item) => item.id);
    const def: CustomLinkTypeDef = {
      id: toLinkTypeId(label, [...taken, ...coreLinkIds]),
      label,
      reverseLabel: newLinkType.reverseLabel.trim() || undefined,
      icon: newLinkType.icon.trim() || undefined,
      color: newLinkType.color.trim() || undefined,
      directed: newLinkType.directed,
      source: {
        module: newLinkType.sourceModule.trim() || undefined,
        kind: newLinkType.sourceKind.trim() || undefined,
      },
      target: {
        module: newLinkType.targetModule.trim() || undefined,
        kind: newLinkType.targetKind.trim() || undefined,
      },
    };
    const reason = validateCustomLinkType(def, {
      existing: asDefs<CustomLinkTypeDef>(draft.linkTypes),
      coreIds: coreLinkIds,
    });
    if (reason) {
      setError(reason);
      return;
    }
    upsertLinkType(def);
    setNewLinkType({
      label: '',
      reverseLabel: '',
      icon: '',
      color: '',
      directed: true,
      sourceModule: '',
      sourceKind: '',
      targetModule: '',
      targetKind: '',
    });
    setError(null);
  };

  const removeLinkType = (id: string, label: string) => {
    setLinkTypes(asDefs<CustomLinkTypeDef>(draft.linkTypes).filter((item) => item.id !== id));
    setNotice(
      `已移除自定义关联类型 ${label}（${id}）：已有该类型关联在界面上回退为「相关」（${LINK_TYPE_FALLBACK_ID}），关联记录与备注保留。`
    );
  };

  // ---- 保存 ----

  const validateDraft = (source: ModuleConfig): string | null => {
    const customKinds = asDefs<EntityTypeDef>(source.entityTypes).filter(
      (def) => !builtinIdSet.has(def.id)
    );
    for (const def of customKinds) {
      const reason = validateEntityType(source, def, { builtins, maxDepth });
      if (reason) return `${def.label || def.id}：${reason}`;
    }
    const ids = asDefs<EntityTypeDef>(source.entityTypes).map((def) => def.id);
    if (new Set(ids).size !== ids.length) return '类型 id 存在重复';
    for (const [kind, fields] of Object.entries(source.fieldSchema ?? {})) {
      const fieldIds = fields.map((field) => field.id);
      if (new Set(fieldIds).size !== fieldIds.length) {
        return `${kind} 的字段 id 存在重复`;
      }
      if (fields.some((field) => !field.id || !field.label)) {
        return `${kind} 存在缺少 id 或名称的字段`;
      }
    }
    const linkTypes = asDefs<CustomLinkTypeDef>(source.linkTypes);
    const customIds = linkTypes
      .filter((def) => !coreLinkIdSet.has(def.id))
      .map((def) => def.id);
    if (new Set(customIds).size !== customIds.length) return '关联类型 id 存在重复';
    for (const def of linkTypes) {
      if (coreLinkIdSet.has(def.id)) {
        // 核心覆盖只允许改名 / 改色，不校验 source / target
        if (!(def.label ?? '').trim()) return `核心关联类型 ${def.id} 的名称不能为空`;
        continue;
      }
      const reason = validateCustomLinkType(def, {
        existing: linkTypes,
        coreIds: coreLinkIds,
        editingId: def.id,
      });
      if (reason) return `${def.label || def.id}：${reason}`;
    }
    return null;
  };

  const handleSave = async () => {
    const reason = validateDraft(draft);
    if (reason) {
      setError(reason);
      setNotice('校验失败，配置未保存。');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(
        buildModuleConfigPatch({
          source: draft,
          baseline: baselineRef.current,
          stored: storedRef.current,
          hasRacesKeys,
          hasSystemsKeys,
        })
      );
      onClose();
    } catch (saveError) {
      // save 失败（网络 / 后端校验）时面板保持打开，把原因显示在错误框里
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 设计 §5.2 的分页集合：类型、字段、等级、状态、关联类型、展示、术语（+ 模块专属）
  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'types', label: '类型' },
    { id: 'fields', label: '字段' },
    { id: 'levels', label: '等级' },
    { id: 'statuses', label: '状态' },
    { id: 'linkTypes', label: '关联类型' },
    { id: 'display', label: '展示' },
    { id: 'terms', label: '术语' },
    ...(showModuleTab ? [{ id: 'module' as PanelTab, label: '模块专属' }] : []),
  ];

  return (
    <div className="space-y-3" data-testid="module-config-panel">
      <div
        role="tablist"
        aria-label="配置分区"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
      >
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
                active
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

        {error && (
          <div
            className="flex items-start gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            data-testid="config-error"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {notice}
          </div>
        )}

        {tab === 'types' && (
          <div className="space-y-2" data-testid="config-types">
            <div className="space-y-1">
              {kinds.map((def) => {
                const builtin = builtinIdSet.has(def.id);
                const Icon = lucideIcon(def.icon);
                return (
                  <div
                    key={def.id}
                    className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
                    data-testid="config-kind-row"
                    data-kind-id={def.id}
                  >
                    {Icon ? (
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-border/60"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs font-medium text-foreground">{def.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{def.id}</span>
                    {def.parentKind && (
                      <span className="text-xs text-muted-foreground">
                        父级 {def.parentKind}
                      </span>
                    )}
                    {builtin ? (
                      <span className="ml-auto rounded-full border border-border/50 px-1.5 text-xs text-muted-foreground">
                        内置
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`删除类型 ${def.label}`}
                        onClick={() => removeKind(def.id)}
                        className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`space-y-1.5 ${CONFIG_SECTION_CLASS}`}>
              <div className="text-xs font-medium text-foreground">新增自定义类型</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKind.label}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="类型名称"
                  aria-label="类型名称"
                  className={FIELD_CLASS}
                />
                <select
                  value={newKind.parentKind}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, parentKind: event.target.value }))
                  }
                  aria-label="父级类型"
                  className={FIELD_CLASS}
                >
                  {kinds.map((def) => (
                    <option key={def.id} value={def.id}>
                      父级：{def.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKind.icon}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, icon: event.target.value }))
                  }
                  placeholder="Lucide 图标名，如 book-marked"
                  aria-label="图标名"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newKind.color}
                  onChange={(event) =>
                    setNewKind((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色 token 或 hex"
                  aria-label="颜色"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addKind}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                自定义类型 id 自动生成为 {CUSTOM_KIND_PREFIX}*，必须声明父级；最多 {maxDepth} 层。
              </p>
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="space-y-2" data-testid="config-fields">
            <div className="flex items-center gap-2">
              <select
                value={activeFieldKind}
                onChange={(event) => setFieldKind(event.target.value)}
                aria-label="选择类型"
                className={FIELD_CLASS}
              >
                {kinds.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}（{def.id}）
                  </option>
                ))}
              </select>
              {onManageFields && (
                <button
                  type="button"
                  onClick={() => onManageFields(activeFieldKind)}
                  className={SECONDARY_BUTTON_CLASS}
                  data-testid="config-open-field-editor"
                >
                  字段编辑器
                </button>
              )}
            </div>

            <div className="space-y-1">
              {fieldsOfKind(activeFieldKind).map((field) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
                  data-testid="config-field-row"
                  data-field-id={field.id}
                >
                  <span className="text-xs font-medium text-foreground">{field.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{field.id}</span>
                  <span className="rounded-full border border-border/50 px-1.5 text-xs text-muted-foreground">
                    {FIELD_TYPE_LABELS[field.type] ?? field.type}
                  </span>
                  {field.group && (
                    <span className="text-xs text-muted-foreground">组 {field.group}</span>
                  )}
                  <button
                    type="button"
                    aria-label={`删除字段 ${field.label}`}
                    onClick={() => removeField(activeFieldKind, field.id)}
                    className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {fieldsOfKind(activeFieldKind).length === 0 && (
                <p className="text-xs text-muted-foreground">该类型暂无自定义字段</p>
              )}
            </div>

            <div className={`space-y-1.5 ${CONFIG_SECTION_CLASS}`}>
              <div className="text-xs font-medium text-foreground">新增字段</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newField.label}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="字段名称"
                  aria-label="字段名称"
                  className={FIELD_CLASS}
                />
                <select
                  value={newField.type}
                  onChange={(event) =>
                    setNewField((prev) => ({
                      ...prev,
                      type: event.target.value as CustomFieldType,
                    }))
                  }
                  aria-label="字段类型"
                  className={FIELD_CLASS}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newField.options}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, options: event.target.value }))
                  }
                  placeholder="选项（逗号分隔，仅选项类型用）"
                  aria-label="字段选项"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newField.group}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, group: event.target.value }))
                  }
                  placeholder="字段组（可选）"
                  aria-label="字段组"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addField}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                删除字段只影响渲染；已填数据保留在 meta.customFields 或 item.content 中。
              </p>
            </div>
          </div>
        )}

        {tab === 'levels' && (
          <div className="space-y-1" data-testid="config-levels">
            {asDefs<LevelDef>(draft.levels).map((level) => (
              <div
                key={level.id}
                className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
              >
                <input
                  type="text"
                  value={level.label}
                  onChange={(event) => updateLevel(level.id, { label: event.target.value })}
                  aria-label={`等级名 ${level.label}`}
                  className={`${INLINE_FIELD_CLASS} w-36`}
                />
                <span className="font-mono text-xs text-muted-foreground">{level.id}</span>
                <input
                  type="number"
                  value={typeof level.rank === 'number' ? level.rank : ''}
                  onChange={(event) => updateLevel(level.id, { rank: event.target.value })}
                  placeholder="rank"
                  aria-label={`等级 rank ${level.label}`}
                  title="rank 越大权重越高（政治版图按它决定节点尺寸与布局环）"
                  className={`${INLINE_FIELD_CLASS} w-20`}
                />
                <button
                  type="button"
                  aria-label={`删除等级 ${level.label}`}
                  onClick={() =>
                    patchDraft({
                      levels: asDefs<LevelDef>(draft.levels).filter(
                        (item) => item.id !== level.id
                      ),
                    })
                  }
                  className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newLevel.label}
                onChange={(event) =>
                  setNewLevel((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="等级名（含义由用户定义）"
                aria-label="等级名"
                className={FIELD_CLASS}
              />
              <input
                type="number"
                value={newLevel.rank}
                onChange={(event) =>
                  setNewLevel((prev) => ({ ...prev, rank: event.target.value }))
                }
                placeholder={`rank（默认 ${nextLevelRank(asDefs<LevelDef>(draft.levels))}）`}
                aria-label="等级 rank"
                className={FIELD_CLASS}
              />
              <button
                type="button"
                onClick={addLevel}
                className={SECONDARY_BUTTON_CLASS}
              >
                <Plus className="h-3.5 w-3.5" />
                等级
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              等级含义由各模块自行定义（如 超级大国 / 王国 / 城邦），系统不规定档数与语义；
              rank 越大权重越高。
            </p>
          </div>
        )}

        {tab === 'statuses' && (
          <div className="space-y-1" data-testid="config-statuses">
            {asDefs<StatusDef>(draft.statuses).map((status) => (
              <div
                key={status.id}
                className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
              >
                <span className="text-xs">{status.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{status.id}</span>
                <button
                  type="button"
                  aria-label={`删除状态 ${status.label}`}
                  onClick={() =>
                    patchDraft({
                      statuses: asDefs<StatusDef>(draft.statuses).filter(
                        (item) => item.id !== status.id
                      ),
                    })
                  }
                  className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newStatus.label}
                onChange={(event) =>
                  setNewStatus((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="状态名，如 存续"
                aria-label="状态名"
                className={FIELD_CLASS}
              />
              <input
                type="text"
                value={newStatus.color}
                onChange={(event) =>
                  setNewStatus((prev) => ({ ...prev, color: event.target.value }))
                }
                placeholder="颜色（可选）"
                aria-label="状态颜色"
                className={FIELD_CLASS}
              />
              <button
                type="button"
                onClick={addStatus}
                className={SECONDARY_BUTTON_CLASS}
              >
                <Plus className="h-3.5 w-3.5" />
                状态
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              状态用文字徽章加色阶表达（如 存续、已灭亡、流亡），不使用星号或 emoji 拼贴。
            </p>
          </div>
        )}

        {tab === 'linkTypes' && (
          <div className="space-y-3" data-testid="config-link-types">
            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">
                核心关联类型（后端注册表，只读；可改名 / 改色 / 改图标，不可删除）
              </div>
              {(linkRegistry ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  未提供核心注册表（linkRegistry），仅显示自定义关联类型。
                </p>
              )}
              {(linkRegistry ?? []).map((core) => {
                const override = linkOverrides.get(core.id);
                const Icon = lucideIcon(override?.icon ?? core.icon);
                return (
                  <div
                    key={core.id}
                    className={`flex flex-wrap items-center gap-2 ${CONFIG_ROW_CLASS}`}
                    data-testid="config-core-link-type"
                    data-link-type={core.id}
                  >
                    {Icon ? (
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-border/60"
                        aria-hidden="true"
                      />
                    )}
                    <input
                      type="text"
                      value={override?.label ?? core.label}
                      aria-label={`关联类型名称 ${core.id}`}
                      onChange={(event) =>
                        updateLinkOverride(core.id, { label: event.target.value })
                      }
                      className={`${INLINE_FIELD_CLASS} w-28`}
                    />
                    <span className="font-mono text-xs text-muted-foreground">{core.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {core.directed ? '有向' : '对称'}
                    </span>
                    <input
                      type="text"
                      value={override?.color ?? core.color}
                      aria-label={`关联类型颜色 ${core.id}`}
                      onChange={(event) =>
                        updateLinkOverride(core.id, { color: event.target.value })
                      }
                      className={`${INLINE_FIELD_CLASS} w-24`}
                    />
                    <span className="ml-auto flex items-center gap-2">
                      <span className="rounded-full border border-border/50 px-1.5 text-xs text-muted-foreground">
                        核心
                      </span>
                      {override && (
                        <button
                          type="button"
                          onClick={() => resetLinkOverride(core.id)}
                          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          恢复默认
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">自定义关联类型</div>
              {customLinkTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">尚未登记自定义关联类型。</p>
              )}
              {customLinkTypes.map((def) => (
                <div
                  key={def.id}
                  className={`flex flex-wrap items-center gap-2 ${CONFIG_ROW_CLASS}`}
                  data-testid="config-custom-link-type"
                  data-link-type={def.id}
                >
                  <span className="text-xs font-medium text-foreground">{def.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{def.id}</span>
                  <span className="text-xs text-muted-foreground">
                    源 {def.source?.module ?? '?'}
                    {def.source?.kind ? `/${def.source.kind}` : ''} · 目标{' '}
                    {def.target?.module ?? '?'}
                    {def.target?.kind ? `/${def.target.kind}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {def.directed ? '有向' : '对称'}
                  </span>
                  <button
                    type="button"
                    aria-label={`删除关联类型 ${def.label}`}
                    onClick={() => removeLinkType(def.id, def.label)}
                    className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className={`space-y-1.5 ${CONFIG_SECTION_CLASS}`}>
              <div className="text-xs font-medium text-foreground">新增自定义关联类型</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLinkType.label}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="标签，如 结盟"
                  aria-label="关联类型标签"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newLinkType.reverseLabel}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, reverseLabel: event.target.value }))
                  }
                  placeholder="反向标签（可选）"
                  aria-label="关联类型反向标签"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLinkType.sourceModule}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, sourceModule: event.target.value }))
                  }
                  placeholder="源模块，如 politics"
                  aria-label="关联类型源模块"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newLinkType.sourceKind}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, sourceKind: event.target.value }))
                  }
                  placeholder="源 kind（可选）"
                  aria-label="关联类型源 kind"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLinkType.targetModule}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, targetModule: event.target.value }))
                  }
                  placeholder="目标模块，如 polity"
                  aria-label="关联类型目标模块"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newLinkType.targetKind}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, targetKind: event.target.value }))
                  }
                  placeholder="目标 kind（可选）"
                  aria-label="关联类型目标 kind"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newLinkType.directed}
                    aria-label="关联类型有向"
                    onChange={(event) =>
                      setNewLinkType((prev) => ({ ...prev, directed: event.target.checked }))
                    }
                    className="h-3 w-3"
                  />
                  有向
                </label>
                <input
                  type="text"
                  value={newLinkType.icon}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, icon: event.target.value }))
                  }
                  placeholder="Lucide 图标名，如 handshake"
                  aria-label="关联类型图标"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newLinkType.color}
                  onChange={(event) =>
                    setNewLinkType((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色 token 或 hex"
                  aria-label="关联类型颜色"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addLinkType}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                自定义关联类型只写入本模块 config.linkTypes，不写入后端注册表；必须声明方向、标签与
                源 / 目标范围。删除后既有该类型关联回退为「相关」（{LINK_TYPE_FALLBACK_ID}）并保留备注。
              </p>
            </div>
          </div>
        )}

        {tab === 'display' && (
          <div className="space-y-3" data-testid="config-display">
            <div className="flex gap-2">
              <label className="flex-1 space-y-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  默认复杂度
                </span>
                <select
                  value={draft.defaultComplexity ?? 'sketch'}
                  onChange={(event) =>
                    patchDraft({ defaultComplexity: event.target.value as ComplexityLevel })
                  }
                  aria-label="默认复杂度"
                  className={FIELD_CLASS}
                >
                  {COMPLEXITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {COMPLEXITY_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 space-y-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  默认视图
                </span>
                <input
                  type="text"
                  value={draft.displayMode ?? ''}
                  onChange={(event) => patchDraft({ displayMode: event.target.value })}
                  placeholder="如 atlas / stair"
                  aria-label="默认视图"
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              默认复杂度只决定新实体的起始披露档位，不影响已有数据；降档隐藏、升档恢复。
            </p>
          </div>
        )}

        {tab === 'terms' && (
          <div className="space-y-3" data-testid="config-terms">
            <div className="space-y-1">
              {Object.entries(draft.terminology ?? {}).map(([key, value]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
                >
                  <span className="font-mono text-xs text-muted-foreground">{key}</span>
                  <input
                    type="text"
                    value={value}
                    aria-label={`术语 ${key}`}
                    onChange={(event) =>
                      patchDraft({
                        terminology: { ...(draft.terminology ?? {}), [key]: event.target.value },
                      })
                    }
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    aria-label={`删除术语 ${key}`}
                    onClick={() => {
                      const next = { ...(draft.terminology ?? {}) };
                      delete next[key];
                      patchDraft({ terminology: next });
                    }}
                    className="rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTerm.key}
                  onChange={(event) =>
                    setNewTerm((prev) => ({ ...prev, key: event.target.value }))
                  }
                  placeholder="键，如 race"
                  aria-label="术语键"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newTerm.value}
                  onChange={(event) =>
                    setNewTerm((prev) => ({ ...prev, value: event.target.value }))
                  }
                  placeholder="展示名，如 族裔"
                  aria-label="术语值"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addTerm}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  术语
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                术语只影响显示与导出文案；模块级术语优先于世界级，稳定 id 不变。
              </p>
            </div>
          </div>
        )}

        {tab === 'module' && hasRacesKeys && (
          <div className="space-y-3" data-testid="config-races">
            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">血缘语义分色</div>
              {asDefs<RelationKindDef>(draft.relationKinds).map((kind) => (
                <div
                  key={kind.id}
                  className={`flex items-center gap-2 ${CONFIG_ROW_CLASS}`}
                  data-testid="config-relation-kind"
                >
                  <span className="text-xs">{kind.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{kind.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {kind.lineStyle ?? 'dashed'}
                  </span>
                  <button
                    type="button"
                    aria-label={`删除关系语义 ${kind.label}`}
                    onClick={() =>
                      patchDraft({
                        relationKinds: asDefs<RelationKindDef>(draft.relationKinds).filter(
                          (item) => item.id !== kind.id
                        ),
                      })
                    }
                    className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRelationKind.label}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({ ...prev, label: event.target.value }))
                  }
                  placeholder="语义名，如 宿敌"
                  aria-label="关系语义名"
                  className={FIELD_CLASS}
                />
                <input
                  type="text"
                  value={newRelationKind.color}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({ ...prev, color: event.target.value }))
                  }
                  placeholder="颜色"
                  aria-label="关系语义颜色"
                  className={FIELD_CLASS}
                />
                <select
                  value={newRelationKind.lineStyle}
                  onChange={(event) =>
                    setNewRelationKind((prev) => ({
                      ...prev,
                      lineStyle: event.target.value as RelationKindDef['lineStyle'],
                    }))
                  }
                  aria-label="线型"
                  className={FIELD_CLASS}
                >
                  <option value="solid">实线</option>
                  <option value="dashed">虚线</option>
                  <option value="double">双线</option>
                </select>
                <button
                  type="button"
                  onClick={addRelationKind}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">纹章色板</div>
              <div className="flex flex-wrap items-center gap-1">
                {asDefs<string>(draft.emblemPalette).map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/40 px-2 py-0.5"
                  >
                    <span
                      className="h-3 w-3 rounded-sm border border-border/60"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={color}
                      aria-label={`色板颜色 ${index + 1}`}
                      onChange={(event) =>
                        patchDraft({
                          emblemPalette: asDefs<string>(draft.emblemPalette).map(
                            (item, position) =>
                              position === index ? event.target.value : item
                          ),
                        })
                      }
                      className={`${FIELD_CLASS} w-24`}
                    />
                    <button
                      type="button"
                      aria-label={`删除色板颜色 ${color}`}
                      onClick={() =>
                        patchDraft({
                          emblemPalette: asDefs<string>(draft.emblemPalette).filter(
                            (_, position) => position !== index
                          ),
                        })
                      }
                      className="rounded-lg p-1 text-muted-foreground transition-colors duration-200 hover:bg-accent/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    patchDraft({
                      emblemPalette: [...asDefs<string>(draft.emblemPalette), '#0f766e'],
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  颜色
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'module' && hasSystemsKeys && (
          <div className="space-y-3" data-testid="config-systems">
            <div className="flex gap-2">
              <label className="flex-1 space-y-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  阶位术语
                </span>
                <input
                  type="text"
                  value={draft.tierTerm ?? ''}
                  onChange={(event) => patchDraft({ tierTerm: event.target.value })}
                  placeholder="阶位 / 境界 / 等级"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex-1 space-y-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  新建步长
                </span>
                <input
                  type="number"
                  value={draft.rankStep ?? 10}
                  onChange={(event) =>
                    patchDraft({ rankStep: Number(event.target.value) || 10 })
                  }
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">节点样式（kind 对应图标与颜色）</div>
              {kinds.map((def) => {
                const kind = def.id;
                const style = draft.nodeStyles?.[kind];
                return (
                  <div key={kind} className="flex items-center gap-2">
                    <span className="w-24 font-mono text-xs text-muted-foreground">
                      {kind}
                    </span>
                    <input
                      type="text"
                      value={style?.icon ?? ''}
                      aria-label={`${kind} 图标`}
                      onChange={(event) =>
                        patchDraft({
                          nodeStyles: {
                            ...(draft.nodeStyles ?? {}),
                            [kind]: {
                              ...(draft.nodeStyles?.[kind] ?? {}),
                              icon: event.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Lucide 图标名"
                      className={FIELD_CLASS}
                    />
                    <input
                      type="text"
                      value={style?.color ?? ''}
                      aria-label={`${kind} 颜色`}
                      onChange={(event) =>
                        patchDraft({
                          nodeStyles: {
                            ...(draft.nodeStyles ?? {}),
                            [kind]: {
                              ...(draft.nodeStyles?.[kind] ?? {}),
                              color: event.target.value,
                            },
                          },
                        })
                      }
                      placeholder="颜色"
                      className={FIELD_CLASS}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-0.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                代价表单字段顺序（逗号分隔）
              </span>
              <input
                type="text"
                value={costFieldsText ?? asDefs<string>(draft.costFields).join(', ')}
                aria-label="代价字段顺序"
                onChange={(event) => {
                  const text = event.target.value;
                  setCostFieldsText(text);
                  patchDraft({
                    costFields: text
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  });
                }}
                className={FIELD_CLASS}
              />
            </div>
          </div>
        )}

        {extra}

        <div className="flex items-center justify-end gap-3 border-t border-border/30 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/50 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
          >
            {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            保存配置
          </button>
        </div>
      </div>
  );
};

export const ModuleConfigPanel = (props: ModuleConfigPanelProps) => (
  <Modal isOpen={props.open} onClose={props.onClose} title={props.title ?? '模块配置'} size="lg">
    <ModuleConfigPanelBody {...props} />
  </Modal>
);
