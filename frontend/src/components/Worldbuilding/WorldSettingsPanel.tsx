/**
 * WorldSettingsPanel（Phase 6 P6-T1/T2；worldview_configuration_system §5.1、worldbuilding_ui_design §3.3-§3.5）
 *
 * 世界设置面板，六个分页：
 * - 基础：名称、描述、封面、默认模块（settings.defaultModule）
 * - 外观：palette / accent / texture / radius + 用**当前世界真实内容**渲染的预览卡（绝不使用示例文案）
 * - 术语：键值表 + 恢复默认；空值回退默认、同名冲突给提示（只影响显示）
 * - 历法：纪年名称、元年标签、时间格式、统一纪年（自然语言时间原文存储）
 * - 模块：七个模块一行（kind 数 / 字段数 / 是否自定义），点开模块配置面板，可切子模块管理器与字段编辑器
 * - 备份：导出 世界名-日期.world.json、恢复（新世界 / 覆盖当前世界 + 显式确认）、导入报告
 *   以及危险操作（删除世界、清空世界数据，均需输入世界名二次确认）
 *
 * 写入：PUT /worlds/{id}（settings 浅合并，未知键保留）；术语/模块名只改显示，不动 module_type/kind。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  DatabaseBackup,
  Download,
  Info,
  Layers,
  Loader2,
  Palette,
  RotateCcw,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import {
  worldbuildingApi,
  type World,
  type WorldImportReport,
  type WorldModuleV2,
  type WorldUpdatePayload,
} from '@/services/worldbuildingApi';
import { lucideIcon } from './shared/lucideIcon';
import { ModuleConfigPanel } from './shared/ModuleConfigPanel';
import { kindDefsOf, type ModuleConfig } from './shared/moduleConfig';
import { useModuleConfig, useWorldTerminology } from './shared/useModuleConfig';
import { useLinkRegistry, useWorldBackup } from './hooks/useWorldData';
import { useWorldLinks } from './hooks/useLinks';
import {
  DEFAULT_WORLD_TERMINOLOGY,
  WORLD_PALETTES,
  WORLD_RADII,
  WORLD_TEXTURES,
  WORLD_DEFAULT_MODULE,
  auditTerminology,
  mergeWorldSettings,
  parseWorldCalendar,
  parseWorldSettings,
  parseWorldTone,
  paletteOptionOf,
  termFor,
  worldModuleRows,
  type WorldModuleRow,
  type WorldPalette,
  type WorldRadius,
  type WorldTexture,
} from './hooks/worldSettings';
import {
  assertBackupVersion,
  backupFileName,
  canOverwriteWorld,
  parseBackupText,
  summarizeImportReport,
  type BackupDocument,
  type ImportReportSummary,
  type WorldImportMode,
} from './hooks/worldBackup';
import { SubmoduleManager } from './config/SubmoduleManager';
import { FieldSchemaEditor } from './config/FieldSchemaEditor';

// 各模块内置（推荐）kind：与模块视图同源，见 hooks/moduleBuiltins
import { DEFAULT_MODULE_DEPTH, MAX_MODULE_DEPTH, builtinsOf } from './hooks/moduleBuiltins';
import { resolveRacesConfig } from './RacesView/config';
import { resolveSystemsConfig } from './SystemsView/config';
import { resolvePoliticsConfig } from './PoliticsView/config';
import { resolveEconomyConfig } from './EconomyView/config';

export type WorldSettingsPage =
  | 'basic'
  | 'appearance'
  | 'terminology'
  | 'calendar'
  | 'modules'
  | 'backup';

const PAGES: { id: WorldSettingsPage; label: string; icon: typeof Info }[] = [
  { id: 'basic', label: '基础', icon: Info },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'terminology', label: '术语', icon: Tag },
  { id: 'calendar', label: '历法', icon: CalendarDays },
  { id: 'modules', label: '模块', icon: Layers },
  { id: 'backup', label: '备份', icon: DatabaseBackup },
];

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none';

/** 各模块配置的解析（前端默认值 + 后端 config），与模块视图同口径 */
const resolveModuleConfig = (moduleType: string, raw: ModuleConfig): ModuleConfig => {
  switch (moduleType) {
    case 'races':
      return resolveRacesConfig(raw);
    case 'systems':
      return resolveSystemsConfig(raw);
    case 'politics':
      return resolvePoliticsConfig(raw);
    case 'economy':
      return resolveEconomyConfig(raw) as unknown as ModuleConfig;
    default:
      return raw;
  }
};

export interface WorldSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** 当前世界（含 settings / tone） */
  world: World;
  /** /worlds/{id} 详情里的模块（含 submodules + items） */
  modules: WorldModuleV2[];
  /** 项目内全部世界（覆盖恢复的目标选择） */
  worlds: World[];
  projectId?: string | null;
  initialPage?: WorldSettingsPage;
  /** 保存成功（外壳失效缓存） */
  onWorldUpdated?: () => void;
  /** 世界被删除（外壳清空当前世界选择） */
  onWorldDeleted?: () => void;
  /** 世界数据被清空 */
  onWorldCleared?: () => void;
  /** 恢复为新世界成功（外壳切到新世界） */
  onRestoredWorld?: (worldId: string) => void;
}

// ---------- 预览卡（外观页；只用当前世界的真实内容） ----------

interface PreviewItem {
  name: string;
  kindLabel: string;
  moduleLabel: string;
  text: string;
}

const WorldPreviewCard = ({
  palette,
  accent,
  texture,
  radius,
  items,
}: {
  palette: WorldPalette;
  accent: string;
  texture: WorldTexture;
  radius: WorldRadius;
  items: PreviewItem[];
}) => {
  const option = paletteOptionOf(palette);
  const radiusClass = WORLD_RADII.find((item) => item.id === radius)?.className ?? 'rounded-lg';
  const textureClass =
    texture === 'grid'
      ? 'bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:12px_12px]'
      : texture === 'paper'
        ? 'bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.03)_0,rgba(0,0,0,0.03)_1px,transparent_1px,transparent_4px)]'
        : texture === 'starfield'
          ? 'bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.35),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.25),transparent_35%)]'
          : '';

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">实时预览（使用当前世界内容）</div>
      <div
        className={`border border-border/60 p-3 ${radiusClass} ${textureClass}`}
        style={{ backgroundColor: option.surface, color: option.foreground }}
        data-testid="world-tone-preview"
        data-palette={palette}
        data-texture={texture}
        data-radius={radius}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-sm font-semibold">术语与基调预览</span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px]"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            默认模块
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs opacity-70">当前世界还没有内容，这里会随第一条设定一起变化。</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.moduleLabel}:${item.name}`} className={`border border-black/5 bg-white/40 p-2 ${radiusClass}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{item.name}</span>
                  <span className="rounded-full px-1.5 text-[10px]" style={{ backgroundColor: `${accent}22`, color: accent }}>
                    {item.kindLabel}
                  </span>
                  <span className="ml-auto text-[10px] opacity-60">{item.moduleLabel}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] opacity-80">{item.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ---------- 模块配置启动器（一次只挂一个模块，钩子调用有保障） ----------

interface ModuleConfigLauncherProps {
  worldId: string;
  moduleType: string;
  module: WorldModuleV2;
  worldTerminology: Record<string, string>;
  onChanged: () => void;
  onClose: () => void;
}

const ModuleConfigLauncher = ({
  worldId,
  moduleType,
  module,
  worldTerminology,
  onChanged,
  onClose,
}: ModuleConfigLauncherProps) => {
  const { config: stored, save } = useModuleConfig(worldId, module.id);
  const registryQuery = useLinkRegistry();
  // 子模块管理器按**实体 id** 要关联计数（删除影响面板用它算「将影响 N 条关联」）；
  // 服务端的 /links/counts 是按模块聚合的，键对不上，这里从世界关联列表本地归并
  const { data: worldLinks } = useWorldLinks(worldId);
  const entityLinkCounts = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (id: string) => map.set(id, (map.get(id) ?? 0) + 1);
    for (const link of worldLinks ?? []) {
      bump(link.source.id);
      if (link.target.id !== link.source.id) bump(link.target.id);
    }
    return map;
  }, [worldLinks]);
  const [submoduleOpen, setSubmoduleOpen] = useState(false);
  const [fieldKind, setFieldKind] = useState<string | null>(null);

  const builtins = builtinsOf(moduleType);
  const resolved = useMemo<ModuleConfig>(() => resolveModuleConfig(moduleType, stored), [moduleType, stored]);

  const kinds = kindDefsOf(resolved, builtins);

  return (
    <>
      <ModuleConfigPanel
        open
        onClose={onClose}
        config={resolved}
        rawConfig={stored}
        onSave={async (patch) => {
          await save(patch);
          onChanged();
        }}
        builtins={builtins}
        maxDepth={MAX_MODULE_DEPTH[moduleType] ?? DEFAULT_MODULE_DEPTH}
        moduleType={moduleType}
        linkRegistry={registryQuery.data}
        onManageFields={(kindId) => setFieldKind(kindId)}
        title={`${module.name} · 模块配置`}
        extra={
          <button
            type="button"
            onClick={() => setSubmoduleOpen(true)}
            className="flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            <span>打开子模块管理器（{module.submodule_count} 个子模块 / {module.item_count} 个条目）</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      />

      {submoduleOpen && (
        <SubmoduleManager
          open
          onClose={() => setSubmoduleOpen(false)}
          worldId={worldId}
          moduleId={module.id}
          moduleType={moduleType}
          config={resolved}
          builtins={builtins}
          worldTerminology={worldTerminology}
          submodules={module.submodules ?? []}
          items={module.items ?? []}
          linkCounts={entityLinkCounts}
          onChanged={() => {
            onChanged();
          }}
          onManageFields={(kindId) => {
            setSubmoduleOpen(false);
            setFieldKind(kindId);
          }}
        />
      )}

      {fieldKind && (
        <FieldSchemaEditor
          open
          onClose={() => setFieldKind(null)}
          moduleId={module.id}
          builtins={builtins}
          config={resolved}
          initialKind={fieldKind}
          onSave={async (patch) => {
            await save(patch);
            onChanged();
          }}
        />
      )}

      {/* 供调试与静态断言：当前解析到的 kind 数 */}
      <span className="hidden" data-testid="module-config-kinds" data-count={kinds.length} />
    </>
  );
};

// ---------- 主面板 ----------

export const WorldSettingsPanel = ({
  open,
  onClose,
  world,
  modules,
  worlds,
  projectId,
  initialPage = 'basic',
  onWorldUpdated,
  onWorldDeleted,
  onWorldCleared,
  onRestoredWorld,
}: WorldSettingsPanelProps) => {
  const [page, setPage] = useState<WorldSettingsPage>(initialPage);
  const [activeModuleType, setActiveModuleType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [clearConfirm, setClearConfirm] = useState('');

  const queryClient = useQueryClient();
  const { downloadBackup, restoreBackup, isImporting } = useWorldBackup();
  const worldTerminology = useWorldTerminology(world.id);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupDoc, setBackupDoc] = useState<BackupDocument | null>(null);
  const [backupError, setBackupError] = useState('');
  const [restoreMode, setRestoreMode] = useState<WorldImportMode>('new');
  const [targetWorldId, setTargetWorldId] = useState(world.id);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [keepDangling, setKeepDangling] = useState(true);
  const [report, setReport] = useState<ImportReportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const settings = useMemo(() => parseWorldSettings(world.settings), [world.settings]);
  const tone = useMemo(() => parseWorldTone(world.tone), [world.tone]);
  const calendar = useMemo(() => parseWorldCalendar(world.settings?.calendar), [world.settings?.calendar]);

  // 基础页草稿
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description ?? '');
  const [coverImage, setCoverImage] = useState(world.cover_image ?? '');
  const [defaultModule, setDefaultModule] = useState(settings.defaultModule);
  // 外观页草稿
  const [palette, setPalette] = useState<WorldPalette>(tone.palette);
  const [accent, setAccent] = useState(tone.accent);
  const [texture, setTexture] = useState<WorldTexture>(tone.texture);
  const [radius, setRadius] = useState<WorldRadius>(tone.radius);
  // 术语页草稿
  const [terminology, setTerminology] = useState<Record<string, string>>(settings.terminology);
  // 历法页草稿
  const [calendarDraft, setCalendarDraft] = useState(calendar);

  const worldId = world.id;
  useEffect(() => {
    if (!open) return;
    const nextSettings = parseWorldSettings(world.settings);
    const nextTone = parseWorldTone(world.tone);
    setName(world.name);
    setDescription(world.description ?? '');
    setCoverImage(world.cover_image ?? '');
    setDefaultModule(nextSettings.defaultModule);
    setPalette(nextTone.palette);
    setAccent(nextTone.accent);
    setTexture(nextTone.texture);
    setRadius(nextTone.radius);
    setTerminology(nextSettings.terminology);
    setCalendarDraft(parseWorldCalendar(world.settings?.calendar));
    setPage(initialPage);
    setActiveModuleType(null);
    setDeleteConfirm('');
    setClearConfirm('');
    setReport(null);
    setBackupDoc(null);
    setRestoreFile(null);
    setBackupError('');
    setTargetWorldId(world.id);
    // world 对象每次保存后都会变，这里只在打开或切世界时重置草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worldId, initialPage]);

  const moduleRows = useMemo(() => worldModuleRows(modules, builtinsOf), [modules]);

  const previewItems = useMemo<PreviewItem[]>(() => {
    const items: PreviewItem[] = [];
    for (const module of modules) {
      for (const submodule of module.submodules ?? []) {
        items.push({
          name: submodule.name,
          kindLabel: submodule.kind ?? 'custom',
          moduleLabel: module.name,
          text:
            submodule.description?.trim() ||
            Object.values((submodule.meta ?? {}) as Record<string, unknown>)
              .filter((value) => typeof value === 'string' && value.trim())
              .slice(0, 1)
              .join('') ||
            '（没有补充说明）',
        });
        if (items.length >= 3) return items;
      }
    }
    return items;
  }, [modules]);

  const terminologyAudit = useMemo(() => auditTerminology(terminology), [terminology]);

  const analysisEntities = useMemo(
    () => modules.reduce((total, module) => total + (module.submodules?.length ?? 0) + (module.items?.length ?? 0), 0),
    [modules]
  );

  const save = useCallback(async () => {
    if (!name.trim()) {
      toast.error('世界名称不能为空');
      return;
    }
    setSaving(true);
    try {
      await worldbuildingApi.updateWorld(world.id, {
        name: name.trim(),
        description: description.trim() || null,
        cover_image: coverImage.trim() || null,
        // 未知键保留：tone 与 settings 都是浅合并，未编辑的键不丢
        tone: { ...tone.raw, palette, accent, texture, radius } as WorldUpdatePayload['tone'],
        settings: mergeWorldSettings(world.settings, {
          terminology: terminologyAudit.entries,
          calendar: { ...calendarDraft.raw, ...toCalendarPayload(calendarDraft) },
          defaultModule: defaultModule.trim() || WORLD_DEFAULT_MODULE,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'world'] });
      toast.success('世界设置已保存');
      onWorldUpdated?.();
    } catch (error) {
      toast.error((error as Error).message || '保存世界设置失败');
    } finally {
      setSaving(false);
    }
  }, [
    accent,
    calendarDraft,
    coverImage,
    defaultModule,
    description,
    name,
    onWorldUpdated,
    palette,
    queryClient,
    radius,
    terminologyAudit.entries,
    texture,
    tone.raw,
    world.id,
    world.settings,
  ]);

  const handleExport = useCallback(async () => {
    try {
      await downloadBackup(world.id, world.name);
      toast.success(`已导出 ${backupFileName(world.name)}`);
    } catch (error) {
      toast.error((error as Error).message || '导出世界备份失败');
    }
  }, [downloadBackup, world.id, world.name]);

  const handlePickRestoreFile = useCallback(async (file: File) => {
    setRestoreFile(file);
    setBackupDoc(null);
    setBackupError('');
    setReport(null);
    try {
      const document = parseBackupText(await file.text());
      assertBackupVersion(document);
      setBackupDoc(document);
    } catch (error) {
      setBackupError((error as Error).message || '备份文件校验失败');
    }
  }, []);

  const handleRestore = useCallback(async () => {
    if (!restoreFile || !backupDoc) return;
    setReport(null);
    try {
      const result: WorldImportReport = await restoreBackup(restoreFile, {
        mode: restoreMode,
        targetWorldId: restoreMode === 'overwrite' ? targetWorldId : null,
        projectId: projectId ?? null,
        confirmOverwrite,
        keepDangling,
      });
      setReport(summarizeImportReport(result, { keepDangling }));
      onWorldUpdated?.();
      if (restoreMode === 'new') onRestoredWorld?.(result.world.id);
    } catch {
      // 错误已由 useImportWorld 的 onError toast；这里不再重复弹同一句
      // 保留弹窗让用户改选模式 / 确认位
    }
  }, [
    backupDoc,
    confirmOverwrite,
    keepDangling,
    onRestoredWorld,
    onWorldUpdated,
    projectId,
    restoreBackup,
    restoreFile,
    restoreMode,
    targetWorldId,
  ]);

  const handleClearWorldData = useCallback(async () => {
    setClearing(true);
    try {
      // 一次原子请求：后端同时清掉子模块 / 条目 / 关联，模块与 module.config 保留；
      // 逐条删只会漏掉 WorldLink，留下满世界的失效引用
      await worldbuildingApi.clearWorldContent(world.id);
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'world'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items'] });
      toast.success('世界数据已清空（模块与配置保留）');
      setClearConfirm('');
      onWorldCleared?.();
    } catch (error) {
      toast.error((error as Error).message || '清空世界数据失败');
    } finally {
      setClearing(false);
    }
  }, [onWorldCleared, queryClient, world.id]);

  if (!open) return null;

  const targetWorld = worlds.find((item) => item.id === targetWorldId) ?? null;
  // 复杂度门禁：与 races / systems 视图、useModuleConfig.canEdit 同口径——
  // 速写档只披露内容，不开放模块配置（配置属于结构档能力）
  const canConfigureModules = settings.complexity !== 'sketch';
  const targetNonEmpty =
    (targetWorld?.link_count ?? 0) > 0 ||
    (targetWorldId === world.id && analysisEntities > 0);
  const overwriteBlocked = !canOverwriteWorld(restoreMode, targetNonEmpty, confirmOverwrite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="世界设置">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-[86vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <nav className="flex w-40 flex-shrink-0 flex-col gap-0.5 border-r border-border/60 bg-card/20 p-3" aria-label="世界设置分页">
          <div className="mb-2 px-2 text-[11px] font-medium text-muted-foreground">世界设置</div>
          {PAGES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                aria-current={page === item.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  page === item.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">{world.name}</h2>
            <span className="text-[11px] text-muted-foreground">
              {analysisEntities} 实体 · {world.link_count ?? 0} 关联
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭世界设置"
              className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            {page === 'basic' && (
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium">世界名称</span>
                  <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">一句话描述</span>
                  <input
                    className={FIELD_CLASS}
                    value={description}
                    placeholder="例如：一座靠潮汐历法运转的群岛世界"
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">封面图片 URL</span>
                  <input
                    className={FIELD_CLASS}
                    value={coverImage}
                    placeholder="留空则显示占位纹样"
                    onChange={(event) => setCoverImage(event.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">默认模块</span>
                  <select
                    className={FIELD_CLASS}
                    value={defaultModule}
                    onChange={(event) => setDefaultModule(event.target.value)}
                    aria-label="默认模块"
                  >
                    {modules.map((module) => (
                      <option key={module.id} value={module.module_type}>
                        {module.name}
                      </option>
                    ))}
                    {modules.length === 0 && <option value={WORLD_DEFAULT_MODULE}>历史</option>}
                  </select>
                  <span className="text-[11px] text-muted-foreground">进入这个世界时默认打开该模块。</span>
                </label>
                <SaveRow saving={saving} onSave={save} />
              </div>
            )}

            {page === 'appearance' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium">视觉基调</span>
                  <div className="flex flex-wrap gap-2">
                    {WORLD_PALETTES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPalette(item.id);
                          if (item.id !== 'custom') setAccent(item.accent);
                        }}
                        aria-pressed={palette === item.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                          palette === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-accent/20'
                        }`}
                      >
                        <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: item.accent }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium">强调色</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#B45309'}
                      onChange={(event) => setAccent(event.target.value)}
                      aria-label="强调色"
                      className="h-8 w-10 cursor-pointer rounded"
                    />
                    <input className={FIELD_CLASS} value={accent} onChange={(event) => setAccent(event.target.value)} />
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">纹理</span>
                    <select className={FIELD_CLASS} value={texture} onChange={(event) => setTexture(event.target.value as WorldTexture)}>
                      {WORLD_TEXTURES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">圆角</span>
                    <select className={FIELD_CLASS} value={radius} onChange={(event) => setRadius(event.target.value as WorldRadius)}>
                      {WORLD_RADII.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <WorldPreviewCard palette={palette} accent={accent} texture={texture} radius={radius} items={previewItems} />
                <SaveRow saving={saving} onSave={save} />
              </div>
            )}

            {page === 'terminology' && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  术语只改变显示：模块名、通用称谓与关联标签的世界内称呼。module_type / kind / link_type 等稳定标识不变。
                  留空即回退默认值。
                </p>
                {terminologyAudit.conflicts.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      同名冲突：{terminologyAudit.conflicts.map((key) => termFor(terminology, key, DEFAULT_WORLD_TERMINOLOGY[key])).join('、')}
                      （与另一个术语的默认名相同）；仍按你填写的显示，请确认是否有意为之。
                    </span>
                  </div>
                )}
                {terminologyAudit.empty.length > 0 && (
                  <div className="rounded-md border border-border/60 bg-card/30 px-3 py-2 text-[11px] text-muted-foreground">
                    空值回退默认：{terminologyAudit.empty.join('、')}
                  </div>
                )}

                <div className="space-y-1.5">
                  {Object.entries(DEFAULT_WORLD_TERMINOLOGY).map(([key, fallback]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-28 flex-shrink-0 text-xs text-muted-foreground">{fallback}</span>
                      <input
                        className={FIELD_CLASS}
                        value={terminology[key] ?? ''}
                        placeholder={fallback}
                        aria-label={`术语 ${key}`}
                        onChange={(event) => setTerminology({ ...terminology, [key]: event.target.value })}
                      />
                      <span className="w-24 flex-shrink-0 truncate text-[10px] text-muted-foreground/70">{key}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTerminology({})}
                    className="flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复默认
                  </button>
                  <SaveRow saving={saving} onSave={save} inline />
                </div>
              </div>
            )}

            {page === 'calendar' && (
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground">
                  历法只用于展示与排序：自然语言时间（如 阳阙历三年）按原文存储，解析失败不改写原文。
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">纪年名称</span>
                    <input
                      className={FIELD_CLASS}
                      value={calendarDraft.eraName}
                      placeholder="例如 阳阙历"
                      onChange={(event) => setCalendarDraft({ ...calendarDraft, eraName: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">元年标签</span>
                    <input
                      className={FIELD_CLASS}
                      value={calendarDraft.epochLabel}
                      placeholder="例如 开元"
                      onChange={(event) => setCalendarDraft({ ...calendarDraft, epochLabel: event.target.value })}
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">时间格式</span>
                  <input
                    className={FIELD_CLASS}
                    value={calendarDraft.timeFormat}
                    placeholder="例如 {era}{year}年{month}月"
                    onChange={(event) => setCalendarDraft({ ...calendarDraft, timeFormat: event.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={calendarDraft.unified}
                    onChange={(event) => setCalendarDraft({ ...calendarDraft, unified: event.target.checked })}
                  />
                  使用统一纪年（跨模块时间轴按同一套纪年排序）
                </label>
                <SaveRow saving={saving} onSave={save} />
              </div>
            )}

            {page === 'modules' && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  七个固定模块各一行：显示 kind 数、字段数与是否已自定义；点开后进入该模块的配置面板。
                </p>
                {!canConfigureModules && (
                  <p
                    className="text-[11px] text-amber-700 dark:text-amber-300"
                    data-testid="module-config-sketch-hint"
                  >
                    速写档不开放模块配置：切到「结构」或「沙盘」档后可编辑类型 / 字段 / 等级 / 关联类型。
                  </p>
                )}
                {moduleRows.map((row) => (
                  <ModuleRow
                    key={row.moduleType}
                    row={row}
                    disabled={!row.moduleId || !canConfigureModules}
                    onOpen={() => setActiveModuleType(row.moduleType)}
                  />
                ))}
                {activeModuleType &&
                  (() => {
                    const row = moduleRows.find((item) => item.moduleType === activeModuleType);
                    const module = modules.find((item) => item.module_type === activeModuleType);
                    if (!row?.moduleId || !module) return null;
                    return (
                      <ModuleConfigLauncher
                        key={module.id}
                        worldId={world.id}
                        moduleType={row.moduleType}
                        module={module}
                        worldTerminology={worldTerminology}
                        onClose={() => setActiveModuleType(null)}
                        onChanged={() => {
                          queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'world'] });
                        }}
                      />
                    );
                  })()}
                {activeModuleType && (
                  <button
                    type="button"
                    onClick={() => setActiveModuleType(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    关闭模块配置
                  </button>
                )}
              </div>
            )}

            {page === 'backup' && (
              <div className="space-y-5">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                    <Download className="h-3.5 w-3.5" />
                    导出备份
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    导出完整 JSON（世界、模块配置、实体、关联），文件名 {backupFileName(world.name)}。
                  </p>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出世界备份
                  </button>
                </section>

                <section className="space-y-2 border-t border-border/50 pt-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                    <Upload className="h-3.5 w-3.5" />
                    恢复备份
                  </h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handlePickRestoreFile(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    选择备份文件
                  </button>
                  {restoreFile && (
                    <div className="text-[11px] text-muted-foreground">
                      {restoreFile.name}（{(restoreFile.size / 1024).toFixed(1)} KB）
                    </div>
                  )}
                  {backupError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {backupError}
                    </div>
                  )}
                  {backupDoc && (
                    <div className="space-y-2 rounded-md border border-border/60 bg-card/30 p-3">
                      <div className="text-[11px] text-muted-foreground">
                        备份格式版本 {backupDoc.schema_version} · 模块 {backupDoc.modules.length} · 关联 {backupDoc.links.length}
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="radio"
                            name="restore-mode"
                            checked={restoreMode === 'new'}
                            onChange={() => setRestoreMode('new')}
                          />
                          恢复为新世界（默认，在新 id 空间重建）
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="radio"
                            name="restore-mode"
                            checked={restoreMode === 'overwrite'}
                            onChange={() => setRestoreMode('overwrite')}
                          />
                          覆盖当前世界
                        </label>
                      </div>
                      {restoreMode === 'overwrite' && (
                        <div className="space-y-2">
                          <select
                            className={FIELD_CLASS}
                            value={targetWorldId}
                            onChange={(event) => {
                              setTargetWorldId(event.target.value);
                              setConfirmOverwrite(false);
                            }}
                            aria-label="覆盖目标世界"
                          >
                            {worlds.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          {targetNonEmpty && (
                            <label className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300">
                              <input
                                type="checkbox"
                                checked={confirmOverwrite}
                                onChange={(event) => setConfirmOverwrite(event.target.checked)}
                              />
                              目标世界已有数据（{targetWorld?.link_count ?? 0} 条关联），我确认覆盖并丢弃其现有内容。
                            </label>
                          )}
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={keepDangling} onChange={(event) => setKeepDangling(event.target.checked)} />
                        端点无法解析时保留为失效引用（渲染为警示 chip，可稍后清理）
                      </label>
                      <button
                        type="button"
                        onClick={handleRestore}
                        disabled={isImporting || overwriteBlocked}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        开始恢复
                      </button>
                    </div>
                  )}
                  {report && (
                    <div className="space-y-2 rounded-md border border-border/60 bg-card/30 p-3" data-testid="import-report">
                      <div className="text-xs font-medium">
                        {report.entityCount} 实体 · {report.linkCount} 关联 · id 映射 {report.idMapCount} 条
                      </div>
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        {report.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {report.danglingCount > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(report.unknownKinds.length > 0 || report.unknownLinkTypes.length > 0) && (
                            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                              降级项：kind {report.unknownKinds.length} · link_type {report.unknownLinkTypes.length}
                            </span>
                          )}
                          <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 text-[10px] text-destructive">
                            保留失效引用 {report.danglingCount} 条
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="space-y-2 border-t border-border/50 pt-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    危险操作
                  </h3>
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="text-[11px] text-muted-foreground">
                      清空世界数据会删除全部子模块与条目，保留模块与配置；此操作不可撤销。
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className={FIELD_CLASS}
                        value={clearConfirm}
                        placeholder={`输入世界名「${world.name}」以启用`}
                        aria-label="清空世界数据确认"
                        onChange={(event) => setClearConfirm(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={clearConfirm !== world.name || clearing}
                        onClick={handleClearWorldData}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-40"
                      >
                        {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        清空世界数据
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      删除世界会连同全部实体、关联与配置一起永久删除。
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className={FIELD_CLASS}
                        value={deleteConfirm}
                        placeholder={`输入世界名「${world.name}」以启用`}
                        aria-label="删除世界确认"
                        onChange={(event) => setDeleteConfirm(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={deleteConfirm !== world.name}
                        onClick={async () => {
                          try {
                            await worldbuildingApi.deleteWorld(world.id);
                            queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
                            toast.success(`世界「${world.name}」已删除`);
                            onWorldDeleted?.();
                            onClose();
                          } catch (error) {
                            toast.error((error as Error).message || '删除世界失败');
                          }
                        }}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs text-white transition-colors hover:bg-destructive/90 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除世界
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const toCalendarPayload = (calendar: {
  eraName: string;
  epochLabel: string;
  timeFormat: string;
  unified: boolean;
}): Record<string, unknown> => ({
  eraName: calendar.eraName,
  epochLabel: calendar.epochLabel,
  timeFormat: calendar.timeFormat,
  unified: calendar.unified,
});

const SaveRow = ({ saving, onSave, inline }: { saving: boolean; onSave: () => void; inline?: boolean }) => (
  <div className={inline ? '' : 'flex justify-end border-t border-border/40 pt-3'}>
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      保存设置
    </button>
  </div>
);

const ModuleRow = ({
  row,
  disabled,
  onOpen,
}: {
  row: WorldModuleRow;
  disabled: boolean;
  onOpen: () => void;
}) => {
  const Icon = lucideIcon(MODULE_ROW_ICONS[row.moduleType]) ?? Layers;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/30 px-3 py-2 text-left transition-colors hover:bg-accent/20 disabled:opacity-50"
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{row.label}</span>
        <span className="block text-[11px] text-muted-foreground">
          {row.kindCount} 个类型 · {row.fieldCount} 个字段 · {row.submoduleCount} 实体 / {row.itemCount} 条目
        </span>
      </span>
      {row.customised ? (
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">已自定义</span>
      ) : (
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">默认</span>
      )}
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </button>
  );
};

const MODULE_ROW_ICONS: Record<string, string> = {
  map: 'map',
  history: 'scroll-text',
  politics: 'crown',
  economy: 'coins',
  races: 'users',
  systems: 'sparkles',
  special: 'star',
};

export default WorldSettingsPanel;
