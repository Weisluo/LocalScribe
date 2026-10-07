import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { worldbuildingApi, WorldSubmodule, WorldModuleItem, type EntityRef } from '@/services/worldbuildingApi';
import { useProjectStore } from '@/stores/projectStore';
import { Loader2, Plus, ChevronDown, ChevronRight, ChevronLeft, Edit2, Trash2, X, Save, Globe2, Map as MapIcon, History, Landmark, Coins, Users, Cpu, Sparkles, LucideIcon, FileUp, FilePlus, Upload, GitBranch, AlertTriangle, Package } from 'lucide-react';
import { HistoryView } from './HistoryView';
import { EconomyView } from './EconomyView';
import { EconomyViewV2 } from './EconomyViewV2';
import { isEconomyViewV2Enabled } from '@/utils/featureFlags';
import { RacesView } from './RacesView';
import { SystemsView } from './SystemsView';
import { PoliticsView } from './PoliticsView';
import { EmptyState } from './shared';
import { ComplexityProvider, ComplexitySwitcher, normalizeComplexity, type ComplexityLevel } from '@/components/common/ComplexitySwitcher';
import { useWorlds, useWorld, useCreateWorld, useUpdateWorld, useDeleteWorld, useWorldBackup } from './hooks/useWorldData';
import { useLinkCounts } from './hooks/useLinks';
import { worldbuildingKeys } from './hooks/worldQueryKeys';
import { useMigrationLinks } from './hooks/useMigrationLinks';
import { MigrationContainerPanel } from './MigrationContainerPanel';
import { isMigrationContainer, kindLabel, refKey, sameRef } from './types';
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

// 初始选择弹窗
interface InitialChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onImport: () => void;
}

const InitialChoiceModal = ({ isOpen, onClose, onCreateNew, onImport }: InitialChoiceModalProps) => {
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
    }
  }, [isOpen]);

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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">欢迎使用世界观设定</h3>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`
          transition-all duration-200 ease-out space-y-4
          ${isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-2 fade-in duration-300'}
        `}>
          <p className="text-sm text-muted-foreground text-center mb-6">
            您还没有创建任何世界模板，请选择以下方式开始：
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                onCreateNew();
                // 只关闭弹窗，不触发onClose回调
                setIsClosing(true);
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                }
                closeTimerRef.current = setTimeout(() => {
                  setIsClosing(false);
                  setIsVisible(false);
                }, 200);
              }}
              className="flex flex-col items-center gap-3 p-6 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FilePlus className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <div className="font-medium">命名新建</div>
                <div className="text-xs text-muted-foreground mt-1">创建全新的世界</div>
              </div>
            </button>

            <button
              onClick={() => {
                onImport();
                // 只关闭弹窗，不触发onClose回调
                setIsClosing(true);
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                }
                closeTimerRef.current = setTimeout(() => {
                  setIsClosing(false);
                  setIsVisible(false);
                }, 200);
              }}
              className="flex flex-col items-center gap-3 p-6 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <div className="font-medium">导入模板</div>
                <div className="text-xs text-muted-foreground mt-1">从JSON文件导入</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 命名新建弹窗
interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isLoading?: boolean;
}

const CreateTemplateModal = ({ isOpen, onClose, onSubmit, isLoading }: CreateTemplateModalProps) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="创建新世界">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">世界名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入世界名称"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                创建中...
              </>
            ) : (
              '创建'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// 导入模板弹窗
interface ImportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, file: File) => void;
  isLoading?: boolean;
}

const ImportTemplateModal = ({ isOpen, onClose, onSubmit, isLoading }: ImportTemplateModalProps) => {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateJson = (content: string): boolean => {
    try {
      const data = JSON.parse(content);
      // 基本验证：检查是否包含必要的字段
      if (!data.modules || !Array.isArray(data.modules)) {
        setError('无效的模板文件：缺少modules字段');
        return false;
      }
      setError('');
      return true;
    } catch (e) {
      setError('无效的JSON文件');
      return false;
    }
  };

  const handleFileChange = (selectedFile: File) => {
    setError('');
    if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
      setError('请选择JSON格式的文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (validateJson(content)) {
        setFile(selectedFile);
        // 尝试从JSON中读取名称
        try {
          const data = JSON.parse(content);
          // 完整备份（WorldExport）的世界名在 world 段，旧模板文件在顶层
          const worldName = data?.world?.name ?? data?.name;
          if (typeof worldName === 'string' && worldName && !name) {
            setName(worldName);
          }
        } catch {
          // JSON 解析失败，忽略
        }
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleSubmit = () => {
    if (name.trim() && file) {
      onSubmit(name.trim(), file);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="导入世界模板">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">世界名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入世界名称"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">模板文件</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
              ${dragActive
                ? 'border-primary bg-primary/5'
                : file
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-border hover:border-primary/50 hover:bg-accent/20'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <FileUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-sm font-medium text-emerald-700">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setError('');
                  }}
                  className="text-xs text-destructive hover:underline mt-1"
                >
                  移除文件
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground">
                  点击或拖拽上传JSON文件
                </div>
                <div className="text-xs text-muted-foreground/70">
                  支持从世界观导出功能生成的JSON文件
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="text-sm text-destructive mt-2">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !file || isLoading || !!error}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              '导入'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// 删除确认弹窗
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateName: string;
  isLoading?: boolean;
}

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, templateName, isLoading }: DeleteConfirmModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="删除确认">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-amber-600 bg-amber-50/50 p-3 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="text-sm">
            确定要删除世界模板「<span className="font-medium">{templateName}</span>」吗？
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          此操作不可恢复，所有相关的模块、子模块和条目数据都将被永久删除。
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                删除
              </>
            )}
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

/** 模块图标名（Lucide 名，写入 WorldModule.icon；与后端 DEFAULT_MODULE_SPECS 保持一致） */
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
        // 创建中禁用，避免连点触发两次 POST（后端会以 400「该模块类型已存在」回错）
        disabled: isCreating,
      },
    ]}
  />
);

interface ModuleItemEditorProps {
  item: WorldModuleItem;
  onSave: (data: { name: string; content: Record<string, string> }) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const ModuleItemEditor = ({ item, onSave, onDelete, onCancel }: ModuleItemEditorProps) => {
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState<Record<string, string>>(item.content || {});
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
    const newContent = { ...content };
    delete newContent[key];
    setContent(newContent);
  };

  const handleSave = () => {
    onSave({ name, content });
  };

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none px-2 py-1"
          placeholder="条目名称"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="p-2 hover:bg-accent/50 rounded-lg text-emerald-600 transition-colors"
            title="保存"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-accent/50 rounded-lg text-destructive transition-colors"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground transition-colors"
            title="取消"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(content).map(([key, value]) => (
          <div key={key} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={key}
                disabled
                className="bg-muted/30 px-3 py-2 rounded-md text-sm font-medium"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => setContent({ ...content, [key]: e.target.value })}
                className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
                placeholder="内容"
              />
            </div>
            <button
              onClick={() => handleRemoveField(key)}
              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="属性名称"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="属性值"
            />
          </div>
          <button
            onClick={handleAddField}
            className="p-2 hover:bg-accent/50 rounded-lg text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface SubmoduleSectionProps {
  submodule: WorldSubmodule;
  moduleId: string;
  onItemUpdate: () => void;
  /** 展开态由视图持有，便于返回栈快照恢复（P2-T7） */
  isExpanded: boolean;
  onToggle: () => void;
  /** 返回栈恢复时的定位高亮 */
  highlightId?: string;
}

const SubmoduleSection = ({ submodule, moduleId, onItemUpdate, isExpanded, onToggle, highlightId }: SubmoduleSectionProps) => {
  const [editingItem, setEditingItem] = useState<WorldModuleItem | null>(null);
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
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<{ name: string; content: Record<string, string>; order_index: number; is_published: boolean }> }) =>
      worldbuildingApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodule-items', submodule.id] });
      onItemUpdate();
      setEditingItem(null);
    },
  });

  return (
    <div className="ml-4 border-l-2 border-border/30 pl-4 space-y-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full group rounded ${
          highlightId === submodule.id ? 'ring-1 ring-primary/50' : ''
        }`}
        style={{ color: submodule.color || undefined }}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>{submodule.icon && <span className="mr-1">{submodule.icon}</span>}{submodule.name}</span>
        <span className="text-xs text-muted-foreground">({submodule.item_count})</span>
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-auto transition-opacity" />
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
                  className={`w-full text-left p-3 bg-muted/20 hover:bg-muted/40 rounded-lg transition-colors ${
                    highlightId === item.id ? 'ring-1 ring-primary/60' : ''
                  }`}
                >
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {Object.entries(item.content || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' | ')}
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
  const [editingItem, setEditingItem] = useState<WorldModuleItem | null>(null);
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
    mutationFn: (data: { name: string; description?: string; color?: string }) =>
      worldbuildingApi.createSubmodule(module.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', module.id] });
      onModuleUpdate();
      setShowSubmoduleForm(false);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string>; submodule_id?: string }) =>
      worldbuildingApi.createItem(module.id, data),
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
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<{ name: string; content: Record<string, string>; order_index: number; is_published: boolean }> }) =>
      worldbuildingApi.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', module.id] });
      onModuleUpdate();
      setEditingItem(null);
    },
  });

  return (
    <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/20 transition-colors text-left"
      >
        {module.icon ? (
          <span className="text-2xl">{module.icon}</span>
        ) : (
          <Package className="h-6 w-6 text-muted-foreground" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold">{module.name}</h3>
          {module.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{module.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="bg-accent/20 px-2 py-1 rounded">{module.submodule_count} 子模块</span>
          <span className="bg-accent/20 px-2 py-1 rounded">{module.item_count} 条目</span>
        </div>
        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

      {isExpanded && (
        <div className="border-t border-border/30 p-4 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSubmoduleForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              添加子模块
            </button>
            <button
              onClick={() => setShowItemForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors"
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
            {items.filter(item => !item.submodule_id).map((item) => (
              <button
                key={item.id}
                onClick={() => setEditingItem(item)}
                className={`w-full text-left p-3 bg-muted/20 hover:bg-muted/40 rounded-lg transition-colors ${
                  highlightId === item.id ? 'ring-1 ring-primary/60' : ''
                }`}
              >
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {Object.entries(item.content || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' | ')}
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
    <div className="bg-muted/30 border border-border/50 rounded-lg p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
        placeholder="子模块名称"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
        placeholder="描述（可选）"
      />
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">颜色：</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer"
        />
        <div className="flex-1 flex gap-2 ml-auto">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => name.trim() && onSubmit({ name: name.trim(), description: description.trim() || undefined, color })}
            disabled={!name.trim() || isLoading}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModuleItemFormProps {
  submodules: WorldSubmodule[];
  onSubmit: (data: { name: string; content: Record<string, string>; submodule_id?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ModuleItemForm = ({ submodules, onSubmit, onCancel, isLoading }: ModuleItemFormProps) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submoduleId, setSubmoduleId] = useState<string>('');

  const handleAddField = () => {
    if (newKey.trim()) {
      setContent({ ...content, [newKey.trim()]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleSubmit = () => {
    if (name.trim() && Object.keys(content).length > 0) {
      onSubmit({
        name: name.trim(),
        content,
        submodule_id: submoduleId || undefined,
      });
    }
  };

  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
        placeholder="条目名称"
      />

      {submodules.length > 0 && (
        <select
          value={submoduleId}
          onChange={(e) => setSubmoduleId(e.target.value)}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none"
        >
          <option value="">不归属任何子模块</option>
          {submodules.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">属性（键值对）</span>
        {Object.entries(content).map(([key, value]) => (
          <div key={key} className="flex gap-2 items-center">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input type="text" value={key} disabled className="bg-muted/30 px-3 py-2 rounded-md text-sm" />
              <input
                type="text"
                value={value}
                onChange={(e) => setContent({ ...content, [key]: e.target.value })}
                className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                const newContent = { ...content };
                delete newContent[key];
                setContent(newContent);
              }}
              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="属性名"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-background border border-border/50 px-3 py-2 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="属性值"
            />
          </div>
          <button
            onClick={handleAddField}
            className="p-2 hover:bg-accent/50 rounded-lg text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || Object.keys(content).length === 0 || isLoading}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建'}
        </button>
      </div>
    </div>
  );
};

export const WorldbuildingView = ({ onNavigateToCharacter }: { onNavigateToCharacter?: (characterId: string) => void }) => {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const { currentProjectId } = useProjectStore();
  const queryClient = useQueryClient();

  // 世界列表与当前世界：POST /worlds 由服务端按契约 §2.2 补齐七个模块，
  // 前端不再手工建模块（phase2 §11.1 L1）
  const { data: worlds = [], isLoading: worldsLoading, isFetching: worldsFetching } = useWorlds(currentProjectId ?? undefined);
  const currentWorld = worlds[0] ?? null;

  // 模块与条目一次性从 /worlds/{id}?include_modules=true&include_items=true 取回
  const { data: worldDetail, isLoading: worldLoading } = useWorld(currentWorld?.id);
  const { data: linkCounts = [] } = useLinkCounts(currentWorld?.id);
  const activeWorld = worldDetail ?? currentWorld;

  // 迁移容器入口（P2-T13）：仅当项目存在容器且容器 link_count > 0 时出现
  const { container, hasEntryPoint, linkCount: containerLinkCount } = useMigrationLinks(currentProjectId ?? undefined);
  const [migrationPanelWorldId, setMigrationPanelWorldId] = useState<string | null>(null);

  const [isEditingTemplateName, setIsEditingTemplateName] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState('');

  // 弹窗状态
  const [showInitialChoice, setShowInitialChoice] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 复杂度披露档：P2 只在会话内切换，不写回 World.settings（P6 负责持久化）
  const [complexityOverride, setComplexityOverride] = useState<ComplexityLevel | null>(null);

  // 返回栈与列表状态快照（P2-T7）
  const [navStack, setNavStack] = useState<BackStackState>(() => createBackStack());
  const [expandedSubmoduleIds, setExpandedSubmoduleIds] = useState<string[]>([]);
  const [highlightedRef, setHighlightedRef] = useState<EntityRef | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  const createWorldMutation = useCreateWorld();
  const updateWorldMutation = useUpdateWorld(currentWorld?.id);
  const deleteWorldMutation = useDeleteWorld();
  const { restoreBackup, isImporting } = useWorldBackup();

  // 模块缺失兜底（P3-T1）：复用 P1 的兼容转发路由，WorldModule.world_id 与 template_id 同列
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

  // 检查是否需要显示初始选择弹窗（仅在首次加载且非获取中时检查）
  useEffect(() => {
    if (!worldsLoading && !worldsFetching && worlds.length === 0 && currentProjectId) {
      setShowInitialChoice(true);
    }
  }, [worldsLoading, worldsFetching, worlds.length, currentProjectId]);

  useEffect(() => {
    setActiveTab('map');
    setShowInitialChoice(false);
    setShowCreateModal(false);
    setShowImportModal(false);
    setShowDeleteModal(false);
    setMigrationPanelWorldId(null);
    setNavStack(createBackStack());
    setExpandedSubmoduleIds([]);
    setHighlightedRef(null);
    setComplexityOverride(null);
  }, [currentProjectId, currentWorld?.id]);

  const currentModule = worldDetail?.modules?.find(m => m.module_type === activeTab);

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
    (ref: EntityRef): string =>
      entityNames.get(ref.id) ?? `${kindLabel(ref.kind)}·${ref.id.slice(0, 8)}`,
    [entityNames]
  );

  // tab 徽章：按模块的关联总数（useLinkCounts 整批返回，不逐卡请求）
  const linkCountByModule = useMemo(() => {
    const map = new Map<string, number>();
    for (const counts of linkCounts) map.set(counts.module, counts.total);
    return map;
  }, [linkCounts]);

  const activeComplexity = complexityOverride ?? normalizeComplexity(
    typeof activeWorld?.settings?.complexity === 'string' ? activeWorld.settings.complexity : undefined
  );
  const isContainerWorld = !!activeWorld && isMigrationContainer(activeWorld);

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
      // 端点不在当前世界（如迁移容器边的对端）：本视图无法跨世界定位
      if (!entityNames.has(ref.id)) {
        toast.info('该实体不在当前世界，请切换到对应世界查看');
        return;
      }
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
    [captureSnapshot, entityLabel, entityNames, onNavigateToCharacter]
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

  // Esc 回退：弹窗、世界改名与归位面板各自处理 Esc 时让位
  useEffect(() => {
    if (isAtRoot(navStack)) return;
    if (showInitialChoice || showCreateModal || showImportModal || showDeleteModal || isEditingTemplateName || migrationPanelWorldId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleNavigateBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navStack, isEditingTemplateName, showInitialChoice, showCreateModal, showImportModal, showDeleteModal, migrationPanelWorldId, handleNavigateBack]);

  // 处理初始选择弹窗关闭
  const handleInitialChoiceClose = () => {
    setShowInitialChoice(false);
  };

  // 处理创建新世界
  const handleCreateNewWorld = () => {
    setShowCreateModal(true);
  };

  // 创建缺失模块（P3-T1）：成功后模块详情由 worldRoot 失效后重新拉取
  const handleCreateModule = useCallback(
    (tab: TabType) => {
      const worldId = worldDetail?.id ?? currentWorld?.id;
      if (!worldId) return;
      createModuleMutation.mutate({ worldId, tab });
    },
    [createModuleMutation, currentWorld?.id, worldDetail?.id]
  );

  // 处理导入世界备份
  const handleImportWorld = () => {
    setShowImportModal(true);
  };

  // 提交创建：服务端一次建好世界与七个模块
  const handleCreateTemplateSubmit = (name: string) => {
    createWorldMutation.mutate(
      { name, project_id: currentProjectId ?? undefined },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setShowInitialChoice(false);
        },
      }
    );
  };

  // 提交导入：只回传本应用导出的完整备份（phase2 §11.1 L4）
  const handleImportTemplateSubmit = (name: string, file: File) => {
    restoreBackup(file, currentProjectId ?? undefined)
      .then(async (created) => {
        if (created && name && created.name !== name) {
          await worldbuildingApi.updateWorld(created.id, { name });
          queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
          queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
        }
        setShowImportModal(false);
        setShowInitialChoice(false);
        // 备份可能自带 migrationContainer 世界，入口条件需重新求值
        queryClient.invalidateQueries({
          queryKey: worldbuildingKeys.migrationContainer(currentProjectId ?? undefined),
        });
      })
      .catch(() => undefined);
  };

  const handleDeleteTemplate = () => {
    if (!currentWorld) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!currentWorld) return;
    deleteWorldMutation.mutate(currentWorld.id, {
      onSuccess: () => {
        setShowDeleteModal(false);
      },
    });
  };

  const handleStartEditTemplateName = () => {
    if (currentWorld) {
      setEditingTemplateName(currentWorld.name);
      setIsEditingTemplateName(true);
    }
  };

  const handleSaveTemplateName = () => {
    if (currentWorld && editingTemplateName.trim()) {
      updateWorldMutation.mutate(
        { name: editingTemplateName.trim() },
        {
          onSuccess: () => {
            setIsEditingTemplateName(false);
          },
        }
      );
    }
  };

  const handleCancelEditTemplateName = () => {
    setIsEditingTemplateName(false);
    setEditingTemplateName('');
  };

  return (
    <ComplexityProvider value={activeComplexity} onChange={setComplexityOverride}>
      <div className="flex flex-col h-full bg-background">
        <header className="h-16 border-b border-border/60 flex items-center justify-center px-6 bg-card/20 backdrop-blur-sm flex-shrink-0 relative group">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2 absolute left-6">
            <Globe2 className="h-5 w-5" />
            世界观设定
          </h1>
          {currentWorld && (
            <>
              {isEditingTemplateName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingTemplateName}
                    onChange={(e) => setEditingTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTemplateName();
                      if (e.key === 'Escape') handleCancelEditTemplateName();
                    }}
                    className="text-sm bg-background border border-border/50 px-2 py-1 rounded focus:border-primary focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTemplateName}
                    disabled={updateWorldMutation.isPending}
                    className="p-1 hover:bg-accent/50 rounded text-emerald-600 transition-colors"
                    title="保存"
                  >
                    {updateWorldMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleCancelEditTemplateName}
                    className="p-1 hover:bg-accent/50 rounded text-muted-foreground transition-colors"
                    title="取消"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-2xl font-semibold text-foreground">{worldDetail?.name ?? currentWorld.name}</span>
              )}
            </>
          )}
          <div className="flex items-center gap-2 absolute right-6">
            {activeWorld && (
              <span className="rounded-full border border-border/60 bg-card/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {activeWorld.module_count ?? 0} 模块 · {activeWorld.link_count ?? 0} 关联
              </span>
            )}
            {activeWorld && (
              <ComplexitySwitcher value={activeComplexity} onChange={setComplexityOverride} />
            )}
            {hasEntryPoint && container && (
              <button
                onClick={() => setMigrationPanelWorldId(container.id)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-500/20 transition-colors dark:text-amber-300"
                title="打开关联归位面板"
              >
                <GitBranch className="h-3.5 w-3.5" />
                待归位 {containerLinkCount}
              </button>
            )}
            {currentWorld && !isEditingTemplateName && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={handleStartEditTemplateName}
                  className="p-1 hover:bg-accent/50 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="修改名称"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDeleteTemplate}
                  disabled={deleteWorldMutation.isPending}
                  className="p-1 hover:bg-accent/50 rounded text-muted-foreground hover:text-destructive transition-colors"
                  title="删除世界"
                >
                  {deleteWorldMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
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
                    className={
                      isCurrent
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground transition-colors'
                    }
                  >
                    {item.label}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={handleNavigateBack}
              className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors"
              title="返回（Esc）"
            >
              <ChevronLeft className="h-3 w-3" />
              返回
            </button>
          </div>
        )}

        {/* 横向标签栏 */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-border/60 bg-card/10 flex-shrink-0 overflow-x-auto">
          {TAB_ORDER.map((tab) => {
            const config = TAB_CONFIG[tab];
            const Icon = config.icon;
            const isActive = activeTab === tab;
            const linkTotal = linkCountByModule.get(tab) ?? 0;

            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap
                ${isActive
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                }
              `}
                title={config.label}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{config.label}</span>
                {linkTotal > 0 && (
                  <span className="rounded-full bg-accent/30 px-1.5 text-[10px]">{linkTotal}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {!worldDetail && !worldsLoading && worlds.length === 0 && (
              <div className="px-6 py-4">
                <div className="mt-4 flex flex-col items-center justify-center py-8 text-center">
                  <Globe2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground mb-4">还没有创建世界模板</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateNewWorld}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      创建世界模板
                    </button>
                    <button
                      onClick={handleImportWorld}
                      className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-accent/20 rounded-lg transition-colors"
                    >
                      <FileUp className="h-4 w-4" />
                      导入模板
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 弹窗组件 */}
            <InitialChoiceModal
              isOpen={showInitialChoice}
              onClose={handleInitialChoiceClose}
              onCreateNew={handleCreateNewWorld}
              onImport={handleImportWorld}
            />

            <CreateTemplateModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateTemplateSubmit}
              isLoading={createWorldMutation.isPending}
            />

            <ImportTemplateModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onSubmit={handleImportTemplateSubmit}
              isLoading={isImporting}
            />

            <DeleteConfirmModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={handleConfirmDelete}
              templateName={worldDetail?.name ?? currentWorld?.name ?? ''}
              isLoading={deleteWorldMutation.isPending}
            />

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
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (activeTab === 'races' || activeTab === 'systems') &&
                currentModule &&
                worldDetail ? (
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
              ) : (activeTab === 'races' || activeTab === 'systems') ? (
                <MissingModuleState
                  tab={activeTab}
                  isCreating={createModuleMutation.isPending}
                  onCreate={() => handleCreateModule(activeTab)}
                />
              ) : activeTab === 'politics' && currentModule && worldDetail ? (
                <PoliticsView
                  worldId={worldDetail.id}
                  moduleId={currentModule.id}
                  onNavigateToEntity={handleNavigateToEntity}
                  highlightRef={highlightedRef}
                />
              ) : activeTab === 'politics' ? (
                <MissingModuleState
                  tab={activeTab}
                  isCreating={createModuleMutation.isPending}
                  onCreate={() => handleCreateModule(activeTab)}
                />
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
                // Phase 5 P5-T15：flag 关闭时完全走旧 EconomyView（P6 才删旧实现）
                isEconomyViewV2Enabled() ? (
                  <EconomyViewV2
                    worldId={worldDetail?.id ?? ''}
                    moduleId={currentModule.id}
                    onNavigateToEntity={handleNavigateToEntity}
                    highlightRef={highlightedRef}
                  />
                ) : (
                  <EconomyView moduleId={currentModule.id} />
                )
              ) : currentModule ? (
                <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
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
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <span className="h-12 w-12 text-muted-foreground/30 mb-3 flex items-center justify-center">
                    {(() => {
                      const Icon = TAB_CONFIG[activeTab].icon;
                      return <Icon className="h-12 w-12" />;
                    })()}
                  </span>
                  <p className="text-muted-foreground">该模块暂无内容</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">点击左侧"添加条目"开始添加设定</p>
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