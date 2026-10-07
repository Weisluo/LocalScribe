/**
 * WorldbuildingView（Phase 6 P6-T1/T2/T6/T7）
 *
 * 世界容器：头部（世界切换 / 编辑 / 删除 / 搜索 / 世界脉络 / 设置 / 复杂度）、七个模块标签栏、
 * 模块内容区，以及跨模块返回栈与面包屑。
 *
 * P6 口径：
 * - 当前世界是真实状态（按项目记忆），不再是「永远 worlds[0]」；列表按 updated_at 倒序。
 * - 空白创建不携带任何预设内容或世界观类型；旧的分发式概念与文案全部退场。
 * - 复杂度切换写回 World.settings.complexity（P2 只在会话内）。
 * - 详情抽屉（各模块自带）在抽屉内跳转时只替换内容：跳转统一走 onNavigateToEntity。
 * - 经济模块固定渲染新的 EconomyView（旧实现与 feature flag 已在 P6 删除）。
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  worldbuildingApi,
  type EntityRef,
  type SubmoduleV2,
  type ModuleItemV2,
  type World,
  type WorldImportMode,
} from '@/services/worldbuildingApi';
import { useProjectStore } from '@/stores/projectStore';
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Edit2,
  Trash2,
  X,
  Save,
  Globe2,
  Map as MapIcon,
  History,
  Landmark,
  Coins,
  Users,
  Cpu,
  Sparkles,
  type LucideIcon,
  FileUp,
  FilePlus,
  Upload,
  GitBranch,
  AlertTriangle,
  Package,
  Search,
  Network,
  Settings,
  Check,
} from 'lucide-react';
import { HistoryView } from './HistoryView';
import { EconomyView } from './EconomyView';
import { RacesView } from './RacesView';
import { SystemsView } from './SystemsView';
import { PoliticsView } from './PoliticsView';
import { EmptyState } from './shared';
import { ComplexityProvider, ComplexitySwitcher, type ComplexityLevel } from '@/components/common/ComplexitySwitcher';
import {
  useWorlds,
  useWorld,
  useCreateWorld,
  useUpdateWorld,
  useDeleteWorld,
  useWorldBackup,
} from './hooks/useWorldData';
import { useLinkCounts } from './hooks/useLinks';
import { worldbuildingKeys } from './hooks/worldQueryKeys';
import { useMigrationLinks } from './hooks/useMigrationLinks';
import { MigrationContainerPanel } from './MigrationContainerPanel';
import { isMigrationContainer, kindLabel, refKey, sameRef } from './types';
import {
  WORLD_COMPLEXITY_OPTIONS,
  WORLD_PALETTES,
  WORLD_DEFAULT_COMPLEXITY,
  buildComplexityPatch,
  buildWorldCreatePayload,
  formatWorldDate,
  normalizeWorldComplexity,
  readCurrentWorldId,
  resolveCurrentWorldId,
  sortWorlds,
  webEntryDecision,
  writeCurrentWorldId,
  type WorldCreateInput,
  type WorldPalette,
} from './hooks/worldSettings';
import { parseBackupText, assertBackupVersion, summarizeImportReport, type ImportReportSummary } from './hooks/worldBackup';
import { WorldSettingsPanel } from './WorldSettingsPanel';
import { GlobalSearch } from './config/GlobalSearch';
import { WorldWeb } from './config/WorldWeb';
import {
  createBackStack,
  pushFrame,
  popFrame,
  popToDepth,
  peekFrame,
  clearStack,
  isAtRoot,
  toBreadcrumbs,
  type BackStackState,
  type ListSnapshot,
} from './navigation/backStack';

// 弹窗组件
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

const Modal = ({ isOpen, onClose, title, children, showCloseButton = true }: ModalProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    } else if (isVisible) {
      // isOpen 变为 false 时触发关闭动画
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setIsClosing(false);
        setIsVisible(false);
      }, 200);
    }
  }, [isOpen, isVisible]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-all duration-200 ease-out
          ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}
        `}
        onClick={handleClose}
      />
      <div
        className={`
          relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6 z-10
          transition-all duration-200 ease-out
          ${isClosing
            ? 'opacity-0 scale-95'
            : 'opacity-100 scale-100 animate-in zoom-in-95 fade-in duration-200'
          }
        `}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {showCloseButton && (
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/20"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className={`
          transition-all duration-200 ease-out
          ${isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-2 fade-in duration-300'}
        `}>
          {children}
        </div>
      </div>
    </div>
  );
};

/** 欢迎弹窗（无世界时的第一步）：只给「新建世界」与「恢复世界备份」两条路 */
interface WorldWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onRestore: () => void;
}

const WorldWelcomeModal = ({ isOpen, onClose, onCreateNew, onRestore }: WorldWelcomeModalProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  const choose = (action: () => void) => {
    action();
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      // 必须真的关掉自己：只把 isVisible 置 false 时守卫（!isOpen && !isVisible）不成立，
      // 弹窗会在淡出后原地重现并与新建 / 恢复弹窗叠成双层遮罩
      onClose();
    }, 200);
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose} />
      <div className={`relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">欢迎来到你的世界</h3>
          <button onClick={handleClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent/20" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          这里没有任何预设内容。新建世界后从第一条设定开始，或恢复一份世界备份。
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => choose(onCreateNew)}
            className="group flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all hover:border-primary hover:bg-primary/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20">
              <FilePlus className="h-6 w-6 text-primary" />
            </span>
            <span className="text-center">
              <span className="block font-medium">新建世界</span>
              <span className="mt-1 block text-xs text-muted-foreground">从空白开始</span>
            </span>
          </button>
          <button
            onClick={() => choose(onRestore)}
            className="group flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all hover:border-primary hover:bg-primary/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20">
              <FileUp className="h-6 w-6 text-primary" />
            </span>
            <span className="text-center">
              <span className="block font-medium">恢复世界备份</span>
              <span className="mt-1 block text-xs text-muted-foreground">从 .world.json 恢复</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

/** 空白创建弹窗（ui_design §3.2）：无世界观类型、无预设内容、无模板措辞 */
interface BlankWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: WorldCreateInput) => void;
  isLoading?: boolean;
}

const BlankWorldModal = ({ isOpen, onClose, onSubmit, isLoading }: BlankWorldModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [palette, setPalette] = useState<WorldPalette>('parchment');
  const [accent, setAccent] = useState(WORLD_PALETTES[0].accent);
  const [complexity, setComplexity] = useState<ComplexityLevel>(WORLD_DEFAULT_COMPLEXITY);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setPalette('parchment');
      setAccent(WORLD_PALETTES[0].accent);
      setComplexity(WORLD_DEFAULT_COMPLEXITY);
    }
  }, [isOpen]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description, palette, accent, complexity });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新建世界">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="new-world-name">
            世界名称 *
          </label>
          <input
            id="new-world-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) submit();
            }}
            placeholder="请输入世界名称"
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="new-world-description">
            一句话描述（可选）
          </label>
          <input
            id="new-world-description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例如：一座靠潮汐历法运转的群岛世界"
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">视觉基调（可选，可随时修改）</span>
          <div className="flex flex-wrap gap-2">
            {WORLD_PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={palette === item.id}
                onClick={() => {
                  setPalette(item.id);
                  if (item.id !== 'custom') setAccent(item.accent);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  palette === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-accent/20'
                }`}
              >
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.accent }} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">强调色</span>
            <input
              type="color"
              aria-label="强调色"
              value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#B45309'}
              onChange={(event) => setAccent(event.target.value)}
              className="h-7 w-9 cursor-pointer rounded"
            />
            <span className="text-[11px] text-muted-foreground">{accent}</span>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">默认复杂度</span>
          <div className="flex gap-2">
            {WORLD_COMPLEXITY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={complexity === option.id}
                title={option.hint}
                onClick={() => setComplexity(option.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  complexity === option.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-accent/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-md border border-border/60 bg-card/30 px-3 py-2 text-[11px] text-muted-foreground">
          新世界为空，不包含任何预设内容。
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            取消
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isLoading ? '创建中...' : '创建空白世界'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** 恢复备份弹窗（ui_design §3.4）：模式选择 + 显式确认 + 导入报告 */
interface RestoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 覆盖目标候选（项目内世界）：entityCount 为 null 表示「列表接口拿不到，未知」 */
  worlds: { id: string; name: string; linkCount: number; entityCount: number | null }[];
  currentWorldId?: string | null;
  isImporting?: boolean;
  onRestore: (file: File, options: { mode: WorldImportMode; targetWorldId?: string | null; confirmOverwrite: boolean; keepDangling: boolean }) => Promise<ImportReportSummary>;
}

const RestoreBackupModal = ({ isOpen, onClose, worlds, currentWorldId, isImporting, onRestore }: RestoreBackupModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<WorldImportMode>('new');
  const [targetWorldId, setTargetWorldId] = useState(currentWorldId ?? '');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [keepDangling, setKeepDangling] = useState(true);
  const [report, setReport] = useState<ImportReportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setError('');
    setMode('new');
    setTargetWorldId(currentWorldId ?? '');
    setConfirmOverwrite(false);
    setKeepDangling(true);
    setReport(null);
  }, [isOpen, currentWorldId]);

  const handleFile = async (selected: File) => {
    setError('');
    setReport(null);
    if (selected.type !== 'application/json' && !selected.name.endsWith('.json')) {
      setError('请选择 .world.json 备份文件');
      return;
    }
    try {
      const document = parseBackupText(await selected.text());
      assertBackupVersion(document);
      setFile(selected);
    } catch (validationError) {
      setFile(null);
      setError((validationError as Error).message);
    }
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const summary = await onRestore(file, {
        mode,
        targetWorldId: mode === 'overwrite' ? targetWorldId : null,
        confirmOverwrite,
        keepDangling,
      });
      setReport(summary);
    } catch {
      // 错误已由 hook toast，这里保留弹窗让用户改选模式/确认位
    } finally {
      setBusy(false);
    }
  };

  const targetWorld = worlds.find((item) => item.id === targetWorldId) ?? null;
  // 后端只按「实体或关联」判定非空（worlds.py 的 confirm_overwrite 校验）；实体数只有当前
  // 世界拿得到，未知（null）时按非空处理，避免少要一次确认后被后端 409
  const targetNonEmpty = (targetWorld?.linkCount ?? 0) > 0 || targetWorld?.entityCount !== 0;
  const overwriteNeedsConfirm = mode === 'overwrite' && targetNonEmpty;
  const overwriteBlocked =
    mode === 'overwrite' && (!targetWorldId || (targetNonEmpty && !confirmOverwrite));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="恢复世界备份">
      <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium">备份文件</span>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) void handleFile(dropped);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
              dragActive ? 'border-primary bg-primary/5' : file ? 'border-emerald-500 bg-emerald-50/40' : 'border-border hover:border-primary/50 hover:bg-accent/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void handleFile(selected);
              }}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">{file.name}</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setFile(null);
                    setReport(null);
                  }}
                  className="mt-1 text-xs text-destructive hover:underline"
                >
                  移除文件
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">点击或拖拽上传 .world.json 备份</span>
                <span className="text-xs text-muted-foreground/70">只接受本应用导出的完整世界备份</span>
              </div>
            )}
          </div>
          {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
        </div>

        {file && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
              恢复为新世界（默认，在新 id 空间重建）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
              覆盖已有世界
            </label>
            {mode === 'overwrite' && (
              <div className="space-y-2">
                <select
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
                {worlds.length === 0 && (
                  <p className="text-xs text-muted-foreground">项目内还没有世界，无法覆盖恢复；请先恢复为新世界。</p>
                )}
                {overwriteNeedsConfirm && (
                  <label className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <input
                      type="checkbox"
                      checked={confirmOverwrite}
                      onChange={(event) => setConfirmOverwrite(event.target.checked)}
                    />
                    目标世界已有数据（实体 {targetWorld?.entityCount ?? '—'} · 关联 {targetWorld?.linkCount ?? 0}），我确认覆盖并丢弃其现有内容。
                  </label>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={keepDangling} onChange={(event) => setKeepDangling(event.target.checked)} />
              端点无法解析时保留为失效引用（渲染为警示 chip）
            </label>
          </div>
        )}

        {report && (
          <div className="space-y-1 rounded-md border border-border/60 bg-card/30 p-3" data-testid="restore-report">
            <div className="text-xs font-medium">
              {report.entityCount} 实体 · {report.linkCount} 关联 · id 映射 {report.idMapCount} 条
            </div>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {report.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            {report ? '关闭' : '取消'}
          </button>
          <button
            onClick={submit}
            disabled={!file || busy || isImporting || overwriteBlocked}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy || isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy || isImporting ? '恢复中...' : '恢复'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** 删除世界确认弹窗：必须输入世界名才能启用危险色按钮（ui_design §3.5） */
interface DeleteWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  worldName: string;
  entityCount: number;
  linkCount: number;
  updatedAt?: string;
  isLoading?: boolean;
}

const DeleteWorldModal = ({ isOpen, onClose, onConfirm, worldName, entityCount, linkCount, updatedAt, isLoading }: DeleteWorldModalProps) => {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="删除世界">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-amber-50/60 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Trash2 className="h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            确定要删除世界「<span className="font-medium">{worldName}</span>」吗？
          </div>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>实体 {entityCount} 个 · 关联 {linkCount} 条</li>
          <li>最近编辑：{formatWorldDate(updatedAt)}</li>
          <li>会级联删除全部实体、关联与世界配置，此操作不可恢复。</li>
        </ul>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="delete-world-name">
            输入世界名称以确认
          </label>
          <input
            id="delete-world-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={worldName}
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== worldName || isLoading}
            className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm text-white transition-colors hover:bg-destructive/90 disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            删除世界
          </button>
        </div>
      </div>
    </Modal>
  );
};

type TabType = 'map' | 'history' | 'politics' | 'economy' | 'races' | 'systems' | 'special';

const TAB_CONFIG: Record<TabType, { label: string; icon: LucideIcon }> = {
  map: { label: '地图', icon: MapIcon },
  history: { label: '历史', icon: History },
  politics: { label: '政治', icon: Landmark },
  economy: { label: '经济', icon: Coins },
  races: { label: '种族', icon: Users },
  systems: { label: '体系', icon: Cpu },
  special: { label: '特殊', icon: Sparkles },
};

const TAB_ORDER: TabType[] = ['map', 'history', 'politics', 'economy', 'races', 'systems', 'special'];

/** 模块图标名（Lucide 名，写入 WorldModule.icon；与后端 DEFAULT_MODULE_SPECS 保持一致，P6 不改） */
const TAB_ICON_NAMES: Record<TabType, string> = {
  map: 'map',
  history: 'scroll-text',
  politics: 'crown',
  economy: 'coins',
  races: 'users',
  systems: 'sparkles',
  special: 'star',
};

/**
 * 模块缺失兜底（P3-T1）：POST /worlds 会补齐七个模块，但导入/迁移来的旧世界可能缺；
 * 这里给一个显式创建入口，不静默建模块。
 */
interface MissingModuleStateProps {
  tab: TabType;
  isCreating: boolean;
  onCreate: () => void;
}

const MissingModuleState = ({ tab, isCreating, onCreate }: MissingModuleStateProps) => (
  <EmptyState
    icon={TAB_CONFIG[tab].icon}
    title={`${TAB_CONFIG[tab].label}模块尚未创建`}
    description="当前世界缺少这个模块，创建后即可开始设定。"
    actions={[
      {
        label: isCreating ? '创建中...' : `创建${TAB_CONFIG[tab].label}模块`,
        onClick: onCreate,
        icon: Plus,
        disabled: isCreating,
      },
    ]}
  />
);

interface ModuleItemEditorProps {
  item: ModuleItemV2;
  onSave: (data: { name: string; content: Record<string, string> }) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const ModuleItemEditor = ({ item, onSave, onDelete, onCancel }: ModuleItemEditorProps) => {
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(item.content ?? {}).map(([key, value]) => [key, String(value)]))
  );
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAddField = () => {
    if (newKey.trim()) {
      setContent({ ...content, [newKey.trim()]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemoveField = (key: string) => {
    const next = { ...content };
    delete next[key];
    setContent(next);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-b border-border bg-transparent px-2 py-1 text-lg font-semibold focus:border-primary focus:outline-none"
          placeholder="条目名称"
        />
        <div className="flex items-center gap-2">
          <button onClick={() => onSave({ name, content })} className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-accent/50" title="保存">
            <Save className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded-lg p-2 text-destructive transition-colors hover:bg-accent/50" title="删除">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onCancel} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50" title="取消">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(content).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input type="text" value={key} disabled className="rounded-md bg-muted/30 px-3 py-2 text-sm font-medium" />
              <input
                type="text"
                value={value}
                onChange={(event) => setContent({ ...content, [key]: event.target.value })}
                className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="内容"
              />
            </div>
            <button onClick={() => handleRemoveField(key)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="属性名称"
            />
            <input
              type="text"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="属性值"
            />
          </div>
          <button onClick={handleAddField} className="rounded-lg p-2 text-primary transition-colors hover:bg-accent/50">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface SubmoduleSectionProps {
  submodule: SubmoduleV2;
  moduleId: string;
  onItemUpdate: () => void;
  /** 展开态由视图持有，便于返回栈快照恢复（P2-T7） */
  isExpanded: boolean;
  onToggle: () => void;
  /** 返回栈恢复时的定位高亮 */
  highlightId?: string;
}

const SubmoduleSection = ({ submodule, moduleId, onItemUpdate, isExpanded, onToggle, highlightId }: SubmoduleSectionProps) => {
  const [editingItem, setEditingItem] = useState<ModuleItemV2 | null>(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['worldbuilding', 'submodule-items', submodule.id],
    queryFn: () => worldbuildingApi.getItems(moduleId, { submodule_id: submodule.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => worldbuildingApi.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodule-items', submodule.id] });
      onItemUpdate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { name: string; content: Record<string, string> } }) =>
      worldbuildingApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodule-items', submodule.id] });
      onItemUpdate();
      setEditingItem(null);
    },
  });

  return (
    <div className="ml-4 space-y-2 border-l-2 border-border/30 pl-4">
      <button
        onClick={onToggle}
        className={`group flex w-full items-center gap-2 rounded text-sm font-medium transition-colors hover:text-primary ${
          highlightId === submodule.id ? 'ring-1 ring-primary/50' : ''
        }`}
        style={{ color: submodule.color || undefined }}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>{submodule.name}</span>
        <span className="text-xs text-muted-foreground">({submodule.item_count})</span>
        <Edit2 className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      </button>

      {isExpanded && (
        <div className="space-y-2 pl-2">
          {items.map((item) => (
            <div key={item.id}>
              {editingItem?.id === item.id ? (
                <ModuleItemEditor
                  item={editingItem}
                  onSave={(data) => updateMutation.mutate({ itemId: item.id, data })}
                  onDelete={() => {
                    deleteMutation.mutate(item.id);
                    setEditingItem(null);
                  }}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <button
                  onClick={() => setEditingItem(item)}
                  className={`w-full rounded-lg bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40 ${
                    highlightId === item.id ? 'ring-1 ring-primary/60' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {Object.entries(item.content || {}).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(' | ')}
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** 模块视图只依赖展示字段，便于直接消费 /worlds 详情返回的 v2 模块 */
interface ModuleSectionModel {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  submodule_count: number;
  item_count: number;
}

interface ModuleSectionProps {
  module: ModuleSectionModel;
  onModuleUpdate: () => void;
  expandedIds: string[];
  onToggleExpanded: (submoduleId: string) => void;
  highlightId?: string;
}

const ModuleSection = ({ module, onModuleUpdate, expandedIds, onToggleExpanded, highlightId }: ModuleSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSubmoduleForm, setShowSubmoduleForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ModuleItemV2 | null>(null);
  const queryClient = useQueryClient();

  const { data: submodules = [] } = useQuery({
    queryKey: ['worldbuilding', 'submodules', module.id],
    queryFn: () => worldbuildingApi.getSubmodules(module.id),
    enabled: !!module.submodule_count,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['worldbuilding', 'items', module.id],
    queryFn: () => worldbuildingApi.getItems(module.id),
  });

  const createSubmoduleMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) => worldbuildingApi.createSubmodule(module.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', module.id] });
      onModuleUpdate();
      setShowSubmoduleForm(false);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string>; submodule_id?: string }) => worldbuildingApi.createItem(module.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', module.id] });
      onModuleUpdate();
      setShowItemForm(false);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => worldbuildingApi.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', module.id] });
      onModuleUpdate();
      setEditingItem(null);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { name: string; content: Record<string, string> } }) =>
      worldbuildingApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', module.id] });
      onModuleUpdate();
      setEditingItem(null);
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card/30">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/20">
        {module.icon ? <Globe2 className="h-6 w-6 text-muted-foreground" /> : <Package className="h-6 w-6 text-muted-foreground" />}
        <div className="flex-1">
          <h3 className="font-semibold">{module.name}</h3>
          {module.description && <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="rounded bg-accent/20 px-2 py-1">{module.submodule_count} 子模块</span>
          <span className="rounded bg-accent/20 px-2 py-1">{module.item_count} 条目</span>
        </div>
        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-border/30 p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSubmoduleForm(true)}
              className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              添加子模块
            </button>
            <button
              onClick={() => setShowItemForm(true)}
              className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/20"
            >
              <Plus className="h-3.5 w-3.5" />
              添加条目
            </button>
          </div>

          {showSubmoduleForm && (
            <SubmoduleForm
              onSubmit={(data) => createSubmoduleMutation.mutate(data)}
              onCancel={() => setShowSubmoduleForm(false)}
              isLoading={createSubmoduleMutation.isPending}
            />
          )}

          {showItemForm && (
            <ModuleItemForm
              submodules={submodules}
              onSubmit={(data) => createItemMutation.mutate(data)}
              onCancel={() => setShowItemForm(false)}
              isLoading={createItemMutation.isPending}
            />
          )}

          {editingItem && (
            <ModuleItemEditor
              item={editingItem}
              onSave={(data) => updateItemMutation.mutate({ itemId: editingItem.id, data })}
              onDelete={() => {
                deleteItemMutation.mutate(editingItem.id);
                setEditingItem(null);
              }}
              onCancel={() => setEditingItem(null)}
            />
          )}

          {submodules.map((submodule) => (
            <SubmoduleSection
              key={submodule.id}
              submodule={submodule}
              moduleId={module.id}
              onItemUpdate={onModuleUpdate}
              isExpanded={expandedIds.includes(submodule.id)}
              onToggle={() => onToggleExpanded(submodule.id)}
              highlightId={highlightId}
            />
          ))}

          <div className="grid gap-2">
            {items
              .filter((item) => !item.submodule_id)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setEditingItem(item)}
                  className={`w-full rounded-lg bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40 ${
                    highlightId === item.id ? 'ring-1 ring-primary/60' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {Object.entries(item.content || {}).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(' | ')}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface SubmoduleFormProps {
  onSubmit: (data: { name: string; description?: string; color?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SubmoduleForm = ({ onSubmit, onCancel, isLoading }: SubmoduleFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
        placeholder="子模块名称"
      />
      <input
        type="text"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
        placeholder="描述（可选）"
      />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">颜色：</span>
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-8 cursor-pointer rounded" />
        <div className="ml-auto flex flex-1 justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            取消
          </button>
          <button
            onClick={() => name.trim() && onSubmit({ name: name.trim(), description: description.trim() || undefined, color })}
            disabled={!name.trim() || isLoading}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModuleItemFormProps {
  submodules: SubmoduleV2[];
  onSubmit: (data: { name: string; content: Record<string, string>; submodule_id?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ModuleItemForm = ({ submodules, onSubmit, onCancel, isLoading }: ModuleItemFormProps) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submoduleId, setSubmoduleId] = useState('');

  const handleAddField = () => {
    if (newKey.trim()) {
      setContent({ ...content, [newKey.trim()]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
        placeholder="条目名称"
      />

      {submodules.length > 0 && (
        <select
          value={submoduleId}
          onChange={(event) => setSubmoduleId(event.target.value)}
          className="w-full rounded-md border border-border/50 bg-background px-3 py-2 focus:border-primary focus:outline-none"
        >
          <option value="">不归属任何子模块</option>
          {submodules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )}

      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">属性（键值对）</span>
        {Object.entries(content).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input type="text" value={key} disabled className="rounded-md bg-muted/30 px-3 py-2 text-sm" />
              <input
                type="text"
                value={value}
                onChange={(event) => setContent({ ...content, [key]: event.target.value })}
                className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                const next = { ...content };
                delete next[key];
                setContent(next);
              }}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="属性名"
            />
            <input
              type="text"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="属性值"
            />
          </div>
          <button onClick={handleAddField} className="rounded-lg p-2 text-primary transition-colors hover:bg-accent/50">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          取消
        </button>
        <button
          onClick={() => name.trim() && onSubmit({ name: name.trim(), content, submodule_id: submoduleId || undefined })}
          disabled={!name.trim() || Object.keys(content).length === 0 || isLoading}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建'}
        </button>
      </div>
    </div>
  );
};

/** 世界切换下拉（ui_design §3.1）：封面占位、名称、一句话描述、模块/关联数、最近编辑 + 新建世界 */
interface WorldSwitcherProps {
  open: boolean;
  onToggle: () => void;
  worlds: { id: string; name: string; description: string; coverImage: string | null; moduleCount: number; linkCount: number; entityCount: number | null; updatedLabel: string }[];
  currentWorldId: string | null;
  onSelect: (worldId: string) => void;
  onCreate: () => void;
}

const WorldSwitcher = ({ open, onToggle, worlds, currentWorldId, onSelect, onCreate }: WorldSwitcherProps) => (
  <div className="relative">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label="切换世界"
      className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
    >
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && (
      <div role="listbox" aria-label="世界列表" className="absolute left-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <ul className="max-h-80 overflow-y-auto">
          {worlds.map((world) => (
            <li key={world.id}>
              <button
                type="button"
                role="option"
                aria-selected={world.id === currentWorldId}
                onClick={() => onSelect(world.id)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  world.id === currentWorldId ? 'bg-primary/10' : 'hover:bg-accent/20'
                }`}
              >
                {world.coverImage ? (
                  <img src={world.coverImage} alt="" className="h-9 w-9 flex-shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary/20 to-accent/20">
                    <Globe2 className="h-4 w-4 text-primary/70" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{world.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {world.description || '（无描述）'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground/80">
                    {world.entityCount !== null ? `${world.entityCount} 实体 · ` : `${world.moduleCount} 模块 · `}
                    {world.linkCount} 关联 · {world.updatedLabel}
                  </span>
                </span>
                {world.id === currentWorldId && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
          新建世界
        </button>
      </div>
    )}
  </div>
);

export const WorldbuildingView = ({ onNavigateToCharacter }: { onNavigateToCharacter?: (characterId: string) => void }) => {
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const { currentProjectId } = useProjectStore();
  const queryClient = useQueryClient();

  // 世界列表与当前世界：POST /worlds 由服务端按契约 §2.2 补齐七个模块
  const { data: worlds = [], isLoading: worldsLoading, isFetching: worldsFetching } = useWorlds(currentProjectId ?? undefined);
  const sortedWorlds = useMemo(() => sortWorlds(worlds), [worlds]);

  const [currentWorldId, setCurrentWorldId] = useState<string | null>(null);
  const currentWorld = useMemo(
    () => sortedWorlds.find((world) => world.id === currentWorldId) ?? null,
    [sortedWorlds, currentWorldId]
  );

  // 当前世界收敛：优先沿用记忆值，其次列表首位；被删除后自动回退（ui_design §3.1）
  // pendingWorldIdRef：刚创建 / 刚恢复出来的世界在列表刷新回来之前必须保持选中，
  // 否则这一步会用陈旧列表把选择覆盖回 sorted[0]（P6 复审修复）
  const pendingWorldIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (worldsLoading) return;
    const pending = pendingWorldIdRef.current;
    if (pending && sortedWorlds.some((world) => world.id === pending)) {
      pendingWorldIdRef.current = null;
    }
    const remembered = currentWorldId ?? readCurrentWorldId(currentProjectId);
    const resolved = resolveCurrentWorldId(sortedWorlds, remembered, pendingWorldIdRef.current);
    if (resolved !== currentWorldId) {
      setCurrentWorldId(resolved);
      writeCurrentWorldId(currentProjectId, resolved);
    }
  }, [sortedWorlds, currentProjectId, worldsLoading, currentWorldId]);

  // 模块与条目一次性从 /worlds/{id}?include_modules=true&include_items=true 取回
  const { data: worldDetail, isLoading: worldLoading } = useWorld(currentWorld?.id);
  const { data: linkCounts = [] } = useLinkCounts(currentWorld?.id);
  const activeWorld = worldDetail ?? currentWorld;

  // 迁移容器入口（P2-T13）：仅当项目存在容器且容器 link_count > 0 时出现
  const { container, hasEntryPoint, linkCount: containerLinkCount } = useMigrationLinks(currentProjectId ?? undefined);
  const [migrationPanelWorldId, setMigrationPanelWorldId] = useState<string | null>(null);

  const [isEditingWorldName, setIsEditingWorldName] = useState(false);
  const [editingWorldName, setEditingWorldName] = useState('');

  // 弹窗与面板状态
  const [showInitialChoice, setShowInitialChoice] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [webOpen, setWebOpen] = useState(false);

  // 复杂度披露档：P6 起写回 World.settings.complexity（本地覆盖保证即时反馈）
  const [complexityOverride, setComplexityOverride] = useState<ComplexityLevel | null>(null);

  // 返回栈与列表状态快照（P2-T7）
  const [navStack, setNavStack] = useState<BackStackState>(() => createBackStack());
  const [expandedSubmoduleIds, setExpandedSubmoduleIds] = useState<string[]>([]);
  const [highlightedRef, setHighlightedRef] = useState<EntityRef | null>(null);
  const [brokenRef, setBrokenRef] = useState<{ ref: EntityRef; label: string; fromModule: string | null } | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  const createWorldMutation = useCreateWorld();
  const updateWorldMutation = useUpdateWorld(currentWorld?.id);
  const deleteWorldMutation = useDeleteWorld();
  const { restoreBackup, isImporting } = useWorldBackup();

  // 模块缺失兜底（P3-T1）：P6 起走正式路由 POST /worlds/{id}/modules
  const createModuleMutation = useMutation({
    mutationFn: ({ worldId, tab }: { worldId: string; tab: TabType }) =>
      worldbuildingApi.createWorldModule(worldId, {
        module_type: tab,
        name: TAB_CONFIG[tab].label,
        icon: TAB_ICON_NAMES[tab],
        order_index: TAB_ORDER.indexOf(tab),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      toast.success('模块已创建');
    },
    onError: (error: Error) => toast.error(error.message || '创建模块失败'),
  });

  // 检查是否需要显示欢迎弹窗（仅在首次加载且非获取中时检查）
  useEffect(() => {
    if (!worldsLoading && !worldsFetching && worlds.length === 0 && currentProjectId) {
      setShowInitialChoice(true);
    }
  }, [worldsLoading, worldsFetching, worlds.length, currentProjectId]);

  // 切世界/切项目：保留当前模块标签，重置返回栈、展开态与定位（ui_design §3.1）
  useEffect(() => {
    setShowInitialChoice(false);
    setShowCreateModal(false);
    setShowRestoreModal(false);
    setShowDeleteModal(false);
    setMigrationPanelWorldId(null);
    setNavStack(createBackStack());
    setExpandedSubmoduleIds([]);
    setHighlightedRef(null);
    setBrokenRef(null);
    setComplexityOverride(null);
    setWebOpen(false);
    setSettingsOpen(false);
    setSearchOpen(false);
  }, [currentProjectId, currentWorld?.id]);

  const currentModule = worldDetail?.modules?.find((module) => module.module_type === activeTab);

  // 当前世界的实体名索引：数据来自 useWorld 详情，不额外请求
  const entityNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const module of worldDetail?.modules ?? []) {
      for (const submodule of module.submodules ?? []) map.set(submodule.id, submodule.name);
      for (const item of module.items ?? []) map.set(item.id, item.name);
    }
    return map;
  }, [worldDetail]);

  const entityLabel = useCallback(
    (ref: EntityRef): string => entityNames.get(ref.id) ?? `${kindLabel(ref.kind)}·${ref.id.slice(0, 8)}`,
    [entityNames]
  );

  // tab 徽章：按模块的关联总数（useLinkCounts 整批返回，不逐卡请求）
  const linkCountByModule = useMemo(() => {
    const map = new Map<string, number>();
    for (const counts of linkCounts) map.set(counts.module, counts.total);
    return map;
  }, [linkCounts]);

  const activeComplexity = complexityOverride ?? normalizeWorldComplexity(
    typeof activeWorld?.settings?.complexity === 'string' ? activeWorld.settings.complexity : undefined
  );
  const isContainerWorld = !!activeWorld && isMigrationContainer(activeWorld);
  const webEntry = webEntryDecision(activeComplexity);

  const breadcrumbs = useMemo(() => toBreadcrumbs(navStack, '世界观'), [navStack]);

  // 进入实体前的列表状态快照（P2-T7）
  const captureSnapshot = useCallback(
    (stack: BackStackState): ListSnapshot => ({
      tab: activeTab,
      scrollTop: contentScrollRef.current?.scrollTop ?? 0,
      expandedIds: expandedSubmoduleIds,
      selectedRef: peekFrame(stack)?.ref,
    }),
    [activeTab, expandedSubmoduleIds]
  );

  // 恢复快照；容器未挂载等恢复失败场景退化为默认列表态（phase2 §8）
  const applySnapshot = useCallback((snapshot: ListSnapshot) => {
    if ((TAB_ORDER as string[]).includes(snapshot.tab)) {
      setActiveTab(snapshot.tab as TabType);
    }
    setExpandedSubmoduleIds(snapshot.expandedIds);
    setHighlightedRef(snapshot.selectedRef ?? null);
    pendingScrollTopRef.current = snapshot.scrollTop;
  }, []);

  useEffect(() => {
    const top = pendingScrollTopRef.current;
    if (top === null) return;
    pendingScrollTopRef.current = null;
    const element = contentScrollRef.current;
    if (!element) return;
    element.scrollTop = top;
  }, [activeTab, navStack]);

  // 统一导航入口：角色仍走 EditorPage 回调，其它实体走内部返回栈（冻结 §5）
  const handleNavigateToEntity = useCallback(
    (ref: EntityRef) => {
      if (ref.module === 'character') {
        onNavigateToCharacter?.(ref.id);
        return;
      }
      // 端点不在当前世界：按失效引用处理（可查看来源 / 清理引用），不假装能定位
      if (!entityNames.has(ref.id)) {
        setBrokenRef({ ref, label: `${kindLabel(ref.kind)}·${ref.id.slice(0, 8)}`, fromModule: activeTab });
        toast.info('目标实体可能已被删除，已标记为失效引用');
        return;
      }
      setBrokenRef(null);
      setNavStack((stack) => {
        if (sameRef(peekFrame(stack)?.ref, ref)) return stack;
        return pushFrame(stack, {
          ref,
          label: entityLabel(ref),
          snapshot: captureSnapshot(stack),
        });
      });
      if ((TAB_ORDER as string[]).includes(ref.module)) {
        setActiveTab(ref.module as TabType);
      }
      setHighlightedRef(ref);
    },
    [activeTab, captureSnapshot, entityLabel, entityNames, onNavigateToCharacter]
  );

  const handleNavigateBack = useCallback(() => {
    const { stack: next, popped } = popFrame(navStack);
    if (!popped) return;
    applySnapshot(popped.snapshot);
    setNavStack(next);
  }, [navStack, applySnapshot]);

  // 面包屑跳转：index 即保留的帧数（0 为回到根列表）
  const handleBreadcrumbClick = useCallback(
    (keepFrames: number) => {
      const { stack: next, exited } = popToDepth(navStack, keepFrames);
      if (!exited) return;
      applySnapshot(exited.snapshot);
      setNavStack(next);
    },
    [navStack, applySnapshot]
  );

  // 手动切换模块即离开实体定位，清空返回栈
  const handleTabClick = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setNavStack((stack) => clearStack(stack));
    setHighlightedRef(null);
  }, []);

  const handleToggleSubmodule = useCallback((submoduleId: string) => {
    setExpandedSubmoduleIds((ids) =>
      ids.includes(submoduleId) ? ids.filter((id) => id !== submoduleId) : [...ids, submoduleId]
    );
  }, []);

  // 复杂度切换：写入 World.settings.complexity（P2 只在会话内，P6 落库）
  const handleComplexityChange = useCallback(
    (level: ComplexityLevel) => {
      setComplexityOverride(level);
      if (!currentWorld) return;
      updateWorldMutation.mutate(buildComplexityPatch(activeWorld, level));
    },
    [activeWorld, currentWorld, updateWorldMutation]
  );

  // Esc 回退：面板、世界改名与归位面板各自处理 Esc 时让位
  useEffect(() => {
    if (isAtRoot(navStack)) return;
    if (
      showInitialChoice || showCreateModal || showRestoreModal || showDeleteModal ||
      isEditingWorldName || migrationPanelWorldId || settingsOpen || searchOpen || webOpen
    ) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleNavigateBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navStack,
    isEditingWorldName,
    showInitialChoice,
    showCreateModal,
    showRestoreModal,
    showDeleteModal,
    migrationPanelWorldId,
    settingsOpen,
    searchOpen,
    webOpen,
    handleNavigateBack,
  ]);

  // Ctrl/Cmd + K 打开全局搜索（ui_design §2.4）；输入控件内不抢焦点
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 世界切换：保持当前模块标签；目标世界没有该模块时走模块缺失空状态
  const handleSwitchWorld = useCallback(
    (worldId: string) => {
      if (worldId === currentWorldId) {
        setSwitcherOpen(false);
        return;
      }
      setCurrentWorldId(worldId);
      writeCurrentWorldId(currentProjectId, worldId);
      setSwitcherOpen(false);
    },
    [currentProjectId, currentWorldId]
  );

  // 创建缺失模块（P3-T1）：成功后模块详情由 worldRoot 失效后重新拉取
  const handleCreateModule = useCallback(
    (tab: TabType) => {
      const worldId = worldDetail?.id ?? currentWorld?.id;
      if (!worldId) return;
      createModuleMutation.mutate({ worldId, tab });
    },
    [createModuleMutation, currentWorld?.id, worldDetail?.id]
  );

  // 空白创建：成功后切到新世界并打开默认模块（默认历史）
  const handleCreateWorld = useCallback(
    (input: WorldCreateInput) => {
      const payload = buildWorldCreatePayload(input, currentProjectId ?? undefined);
      createWorldMutation.mutate(payload, {
        onSuccess: (world) => {
          // 先登记待选中世界，列表刷新回来之前收敛 effect 不会覆盖这次选择
          pendingWorldIdRef.current = world.id;
          setCurrentWorldId(world.id);
          writeCurrentWorldId(currentProjectId, world.id);
          const defaultModule = (payload.settings as { defaultModule?: string } | null)?.defaultModule;
          setActiveTab(((defaultModule as TabType) ?? 'history') as TabType);
          setShowCreateModal(false);
          setShowInitialChoice(false);
        },
      });
    },
    [createWorldMutation, currentProjectId]
  );

  // 恢复备份：只接受本应用导出的完整备份；覆盖非空世界需显式确认（后端 409 会回错）
  const handleRestore = useCallback(
    async (
      file: File,
      options: { mode: WorldImportMode; targetWorldId?: string | null; confirmOverwrite: boolean; keepDangling: boolean }
    ) => {
      const report = await restoreBackup(file, {
        mode: options.mode,
        targetWorldId: options.targetWorldId,
        confirmOverwrite: options.confirmOverwrite,
        keepDangling: options.keepDangling,
        projectId: currentProjectId ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.migrationContainer(currentProjectId ?? undefined) });
      if (options.mode === 'new') {
        pendingWorldIdRef.current = report.world.id;
        setCurrentWorldId(report.world.id);
        writeCurrentWorldId(currentProjectId, report.world.id);
        setShowInitialChoice(false);
      }
      return summarizeImportReport(report, { keepDangling: options.keepDangling });
    },
    [currentProjectId, queryClient, restoreBackup]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!currentWorld) return;
    const deletedWorldId = currentWorld.id;
    deleteWorldMutation.mutate(deletedWorldId, {
      onSuccess: () => {
        setShowDeleteModal(false);
        // 立刻从列表缓存摘掉该世界：否则收敛 effect 会拿陈旧列表把已删世界重新选中，
        // 并对它发一次必然 404 的详情请求
        queryClient.setQueryData<World[]>(
          worldbuildingKeys.worlds(currentProjectId ?? undefined),
          (previous) => (previous ?? []).filter((world) => world.id !== deletedWorldId)
        );
        // 删除后回到列表：收敛逻辑会把当前世界切到下一个
        setCurrentWorldId(null);
        writeCurrentWorldId(currentProjectId, null);
      },
    });
  }, [currentProjectId, currentWorld, deleteWorldMutation, queryClient]);

  const handleStartEditWorldName = () => {
    if (currentWorld) {
      setEditingWorldName(currentWorld.name);
      setIsEditingWorldName(true);
    }
  };

  const handleSaveWorldName = () => {
    if (currentWorld && editingWorldName.trim()) {
      updateWorldMutation.mutate(
        { name: editingWorldName.trim() },
        {
          onSuccess: () => setIsEditingWorldName(false),
        }
      );
    }
  };

  // 失效引用的两个动作：查看来源（跳回来源模块）与清理引用（删除悬挂端点上的关联）
  const handleViewBrokenSource = useCallback(() => {
    if (!brokenRef?.fromModule) return;
    if ((TAB_ORDER as string[]).includes(brokenRef.fromModule)) {
      setActiveTab(brokenRef.fromModule as TabType);
    }
    setBrokenRef(null);
  }, [brokenRef]);

  const handleCleanupBrokenRef = useCallback(async () => {
    if (!brokenRef || !currentWorld) return;
    try {
      const links = await worldbuildingApi.getWorldLinks(currentWorld.id, {
        module: brokenRef.ref.module,
        entity_id: brokenRef.ref.id,
      });
      const dangling = links.filter(
        (link) => !entityNames.has(link.source.id) || !entityNames.has(link.target.id)
      );
      for (const link of dangling) await worldbuildingApi.deleteWorldLink(link.id);
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
      toast.success(dangling.length ? `已清理 ${dangling.length} 条失效引用` : '没有需要清理的关联');
      setBrokenRef(null);
    } catch (error) {
      toast.error((error as Error).message || '清理引用失败');
    }
  }, [brokenRef, currentWorld, entityNames, queryClient]);

  const switcherWorlds = useMemo(
    () =>
      sortedWorlds.map((world) => {
        const isCurrent = world.id === currentWorldId;
        return {
          id: world.id,
          name: world.name,
          description: (world.description ?? '').trim(),
          coverImage: world.cover_image ?? null,
          moduleCount: world.module_count ?? 0,
          linkCount: world.link_count ?? 0,
          entityCount: isCurrent && worldDetail ? entityNames.size : null,
          updatedLabel: formatWorldDate(world.updated_at),
        };
      }),
    [currentWorldId, entityNames, sortedWorlds, worldDetail]
  );

  const moduleLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const module of worldDetail?.modules ?? []) map[module.module_type] = module.name;
    return map;
  }, [worldDetail]);

  const universeEntityCount = entityNames.size;

  return (
    <ComplexityProvider value={activeComplexity} onChange={handleComplexityChange}>
      <div className="flex h-full flex-col bg-background">
        <header className="group relative flex h-16 flex-shrink-0 items-center justify-center border-b border-border/60 bg-card/20 px-6 backdrop-blur-sm">
          <h1 className="absolute left-6 flex items-center gap-2 text-xl font-semibold text-foreground">
            <Globe2 className="h-5 w-5" />
            世界观设定
          </h1>
          {currentWorld && (
            <div className="flex items-center gap-2">
              {isEditingWorldName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingWorldName}
                    onChange={(event) => setEditingWorldName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSaveWorldName();
                      if (event.key === 'Escape') {
                        setIsEditingWorldName(false);
                        setEditingWorldName('');
                      }
                    }}
                    className="rounded border border-border/50 bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveWorldName}
                    disabled={updateWorldMutation.isPending}
                    className="rounded p-1 text-emerald-600 transition-colors hover:bg-accent/50"
                    title="保存"
                  >
                    {updateWorldMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingWorldName(false);
                      setEditingWorldName('');
                    }}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/50"
                    title="取消"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-2xl font-semibold text-foreground">{worldDetail?.name ?? currentWorld.name}</span>
              )}
              <WorldSwitcher
                open={switcherOpen}
                onToggle={() => setSwitcherOpen((value) => !value)}
                worlds={switcherWorlds}
                currentWorldId={currentWorldId}
                onSelect={handleSwitchWorld}
                onCreate={() => {
                  setSwitcherOpen(false);
                  setShowCreateModal(true);
                }}
              />
            </div>
          )}
          <div className="absolute right-6 flex items-center gap-2">
            {activeWorld && (
              <span className="hidden rounded-full border border-border/60 bg-card/40 px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
                {universeEntityCount} 实体 · {activeWorld.link_count ?? 0} 关联
              </span>
            )}
            {activeWorld && <ComplexitySwitcher value={activeComplexity} onChange={handleComplexityChange} />}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              title="全局搜索（Ctrl/Cmd + K）"
            >
              <Search className="h-3.5 w-3.5" />
              搜索
            </button>
            {activeWorld && webEntry.visible && (
              <button
                type="button"
                onClick={() => setWebOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                title={`世界脉络（${webEntry.reason}）`}
              >
                <Network className="h-3.5 w-3.5" />
                世界脉络
              </button>
            )}
            {currentWorld && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                title="世界设置"
              >
                <Settings className="h-3.5 w-3.5" />
                设置
              </button>
            )}
            {hasEntryPoint && container && (
              <button
                onClick={() => setMigrationPanelWorldId(container.id)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                title="打开关联归位面板"
              >
                <GitBranch className="h-3.5 w-3.5" />
                待归位 {containerLinkCount}
              </button>
            )}
            {currentWorld && !isEditingWorldName && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  onClick={handleStartEditWorldName}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  title="修改名称"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleteWorldMutation.isPending}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-destructive"
                  title="删除世界"
                >
                  {deleteWorldMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 容器提示位：仅当前世界就是迁移容器时出现（P2-T13） */}
        {isContainerWorld && (
          <div className="flex items-center gap-2 border-b border-border/60 bg-amber-500/10 px-6 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            这是「关联迁移容器」：暂存无法归属到具体世界的旧关联，可用右上角「待归位」逐条或批量归位。
          </div>
        )}

        {/* 返回栈面包屑（P2-T7）：仅进入实体后出现 */}
        {!isAtRoot(navStack) && (
          <div className="flex items-center gap-2 border-b border-border/60 bg-card/20 px-6 py-1.5 text-xs">
            {breadcrumbs.map((item, index) => {
              const isCurrent = index === breadcrumbs.length - 1;
              return (
                <span key={item.ref ? refKey(item.ref) : 'root'} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(index)}
                    disabled={isCurrent}
                    className={isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground transition-colors hover:text-foreground'}
                  >
                    {item.label}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={handleNavigateBack}
              className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
              title="返回（Esc）"
            >
              <ChevronLeft className="h-3 w-3" />
              返回
            </button>
          </div>
        )}

        {/* 失效引用（T7 缺口）：目标已删除时提供查看来源 / 清理引用 */}
        {brokenRef && (
          <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-6 py-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>引用已失效：{brokenRef.label}（目标可能已被删除）</span>
            {brokenRef.fromModule && (
              <button type="button" onClick={handleViewBrokenSource} className="rounded border border-destructive/40 px-2 py-0.5 hover:bg-destructive/20">
                查看来源
              </button>
            )}
            <button type="button" onClick={() => void handleCleanupBrokenRef()} className="rounded border border-destructive/40 px-2 py-0.5 hover:bg-destructive/20">
              清理引用
            </button>
            <button type="button" onClick={() => setBrokenRef(null)} className="ml-auto text-destructive/70 hover:text-destructive">
              忽略
            </button>
          </div>
        )}

        {/* 横向标签栏 */}
        <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-card/10 px-6 py-3">
          {TAB_ORDER.map((tab) => {
            const config = TAB_CONFIG[tab];
            const Icon = config.icon;
            const isActive = activeTab === tab;
            const linkTotal = linkCountByModule.get(tab) ?? 0;

            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 transition-all duration-200 ${
                  isActive ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                }`}
                title={moduleLabels[tab] ?? config.label}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{moduleLabels[tab] ?? config.label}</span>
                {linkTotal > 0 && <span className="rounded-full bg-accent/30 px-1.5 text-[10px]">{linkTotal}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            {!currentWorld && !worldsLoading && (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <Globe2 className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="mb-1 text-foreground">还没有世界</p>
                <p className="mb-4 text-sm text-muted-foreground">先新建一个空白世界，或恢复一份世界备份。</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                    新建世界
                  </button>
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 transition-colors hover:bg-accent/20"
                  >
                    <FileUp className="h-4 w-4" />
                    恢复世界备份
                  </button>
                </div>
              </div>
            )}

            {/* 弹窗与面板 */}
            <WorldWelcomeModal
              isOpen={showInitialChoice}
              onClose={() => setShowInitialChoice(false)}
              onCreateNew={() => setShowCreateModal(true)}
              onRestore={() => setShowRestoreModal(true)}
            />

            <BlankWorldModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateWorld}
              isLoading={createWorldMutation.isPending}
            />

            <RestoreBackupModal
              isOpen={showRestoreModal}
              onClose={() => setShowRestoreModal(false)}
              worlds={sortedWorlds.map((world) => ({
                id: world.id,
                name: world.name,
                linkCount: world.link_count ?? 0,
                // 实体数只有当前世界的详情拿得到；其余世界未知（null 时按非空保守处理）
                entityCount:
                  world.id === currentWorldId && worldDetail ? universeEntityCount : null,
              }))}
              currentWorldId={currentWorldId}
              isImporting={isImporting}
              onRestore={handleRestore}
            />

            <DeleteWorldModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={handleConfirmDelete}
              worldName={worldDetail?.name ?? currentWorld?.name ?? ''}
              entityCount={universeEntityCount}
              linkCount={activeWorld?.link_count ?? 0}
              updatedAt={activeWorld?.updated_at}
              isLoading={deleteWorldMutation.isPending}
            />

            {currentWorld && settingsOpen && worldDetail && (
              <WorldSettingsPanel
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                world={worldDetail}
                modules={worldDetail.modules ?? []}
                worlds={sortedWorlds}
                projectId={currentProjectId}
                onWorldUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
                  queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
                }}
                onWorldDeleted={() => {
                  setCurrentWorldId(null);
                  writeCurrentWorldId(currentProjectId, null);
                }}
                onWorldCleared={() => {
                  queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
                  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
                  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
                  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules'] });
                  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items'] });
                }}
                onRestoredWorld={(worldId) => {
                  // 与 handleRestore 同口径：列表刷新回来之前不能被收敛 effect 覆盖
                  pendingWorldIdRef.current = worldId;
                  setCurrentWorldId(worldId);
                  writeCurrentWorldId(currentProjectId, worldId);
                }}
              />
            )}

            {currentWorld && (
              <GlobalSearch
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                modules={worldDetail?.modules ?? []}
                worldId={currentWorld.id}
                projectId={currentProjectId}
                moduleLabels={moduleLabels}
                onNavigate={handleNavigateToEntity}
              />
            )}

            {webOpen && currentWorld && worldDetail && (
              <WorldWeb
                open={webOpen}
                onClose={() => setWebOpen(false)}
                worldId={worldDetail.id}
                modules={worldDetail.modules ?? []}
                counts={linkCounts}
                onNavigate={handleNavigateToEntity}
              />
            )}

            {/* 迁移容器归位面板（P2-T13）：入口满足后才可能打开 */}
            {migrationPanelWorldId && (
              <MigrationContainerPanel
                worldId={migrationPanelWorldId}
                projectId={currentProjectId ?? ''}
                onNavigate={handleNavigateToEntity}
                onResolved={() => setMigrationPanelWorldId(null)}
              />
            )}

            <div className="flex-1 overflow-hidden">
              {worldLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !currentWorld ? null : (activeTab === 'races' || activeTab === 'systems') && currentModule && worldDetail ? (
                activeTab === 'races' ? (
                  <RacesView
                    worldId={worldDetail.id}
                    moduleId={currentModule.id}
                    onNavigateToEntity={handleNavigateToEntity}
                    highlightRef={highlightedRef}
                  />
                ) : (
                  <SystemsView
                    worldId={worldDetail.id}
                    moduleId={currentModule.id}
                    onNavigateToEntity={handleNavigateToEntity}
                    highlightRef={highlightedRef}
                  />
                )
              ) : activeTab === 'races' || activeTab === 'systems' ? (
                <MissingModuleState tab={activeTab} isCreating={createModuleMutation.isPending} onCreate={() => handleCreateModule(activeTab)} />
              ) : activeTab === 'politics' && currentModule && worldDetail ? (
                <PoliticsView
                  worldId={worldDetail.id}
                  moduleId={currentModule.id}
                  onNavigateToEntity={handleNavigateToEntity}
                  highlightRef={highlightedRef}
                />
              ) : activeTab === 'politics' ? (
                <MissingModuleState tab={activeTab} isCreating={createModuleMutation.isPending} onCreate={() => handleCreateModule(activeTab)} />
              ) : activeTab === 'history' && currentModule ? (
                <HistoryView
                  moduleId={currentModule.id}
                  projectId={currentProjectId || ''}
                  worldId={worldDetail?.id}
                  highlightRef={highlightedRef}
                  onNavigateToCharacter={onNavigateToCharacter}
                  onNavigateToEntity={handleNavigateToEntity}
                />
              ) : activeTab === 'economy' && currentModule ? (
                <EconomyView
                  worldId={worldDetail?.id ?? ''}
                  moduleId={currentModule.id}
                  onNavigateToEntity={handleNavigateToEntity}
                  highlightRef={highlightedRef}
                />
              ) : currentModule ? (
                <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-6">
                  <div className="mx-auto max-w-4xl">
                    <ModuleSection
                      module={currentModule}
                      onModuleUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
                      }}
                      expandedIds={expandedSubmoduleIds}
                      onToggleExpanded={handleToggleSubmodule}
                      highlightId={highlightedRef?.id}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center text-muted-foreground/30">
                    {(() => {
                      const Icon = TAB_CONFIG[activeTab].icon;
                      return <Icon className="h-12 w-12" />;
                    })()}
                  </span>
                  <p className="text-muted-foreground">该模块暂无内容</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">点击模块内的添加按钮开始添加设定</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ComplexityProvider>
  );
};

export default WorldbuildingView;
