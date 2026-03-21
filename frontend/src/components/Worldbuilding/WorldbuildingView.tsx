import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worldbuildingApi, WorldModule, WorldSubmodule, WorldModuleItem } from '@/services/worldbuildingApi';
import { useProjectStore } from '@/stores/projectStore';
import { Loader2, Plus, ChevronDown, ChevronRight, Edit2, Trash2, X, Save, Globe2, Map, History, Landmark, Coins, Users, Cpu, Sparkles, LucideIcon, FileUp, FilePlus, Upload } from 'lucide-react';

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
          if (data.name && !name) {
            setName(data.name);
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
  map: { label: '地图', icon: Map },
  history: { label: '历史', icon: History },
  politics: { label: '政治', icon: Landmark },
  economy: { label: '经济', icon: Coins },
  races: { label: '种族', icon: Users },
  systems: { label: '体系', icon: Cpu },
  special: { label: '特殊', icon: Sparkles },
};

const TAB_ORDER: TabType[] = ['map', 'history', 'politics', 'economy', 'races', 'systems', 'special'];

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
}

const SubmoduleSection = ({ submodule, moduleId, onItemUpdate }: SubmoduleSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
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
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full group"
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
                  className="w-full text-left p-3 bg-muted/20 hover:bg-muted/40 rounded-lg transition-colors"
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

interface ModuleSectionProps {
  module: WorldModule;
  onModuleUpdate: () => void;
}

const ModuleSection = ({ module, onModuleUpdate }: ModuleSectionProps) => {
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
        <span className="text-2xl">{module.icon || '📦'}</span>
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
            />
          ))}

          <div className="grid gap-2">
            {items.filter(item => !item.submodule_id).map((item) => (
              <button
                key={item.id}
                onClick={() => setEditingItem(item)}
                className="w-full text-left p-3 bg-muted/20 hover:bg-muted/40 rounded-lg transition-colors"
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

export const WorldbuildingView = () => {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isEditingTemplateName, setIsEditingTemplateName] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const { currentProjectId } = useProjectStore();

  // 弹窗状态
  const [showInitialChoice, setShowInitialChoice] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: templatesLoading, isFetching: templatesFetching } = useQuery({
    queryKey: ['worldbuilding', 'templates', currentProjectId],
    queryFn: () => worldbuildingApi.getTemplates({ project_id: currentProjectId ?? undefined }),
    enabled: !!currentProjectId,
    staleTime: 300,
  });

  const { data: currentTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ['worldbuilding', 'template', selectedTemplateId],
    queryFn: () => worldbuildingApi.getTemplate(selectedTemplateId!, { include_modules: true }),
    enabled: !!selectedTemplateId,
  });

  // 检查是否需要显示初始选择弹窗（仅在首次加载且非获取中时检查）
  useEffect(() => {
    if (!templatesLoading && !templatesFetching && templates.length === 0 && currentProjectId) {
      setShowInitialChoice(true);
    }
  }, [templatesLoading, templatesFetching, templates.length, currentProjectId]);

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      worldbuildingApi.createTemplate({ ...data, project_id: currentProjectId ?? undefined }),
    onSuccess: async (newTemplate) => {
      // 自动创建所有默认模块
      const modulePromises = TAB_ORDER.map((tabType, index) =>
        worldbuildingApi.createModule(newTemplate.id, {
          module_type: tabType,
          name: TAB_CONFIG[tabType].label,
          order_index: index,
        })
      );
      await Promise.all(modulePromises);
      setSelectedTemplateId(newTemplate.id);
      setShowCreateModal(false);
      setShowInitialChoice(false); // 关闭初始选择弹窗
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'templates'] });
    },
  });

  const importTemplateMutation = useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const content = await file.text();
      const templateData = JSON.parse(content);
      return worldbuildingApi.importTemplate({
        name,
        template_data: templateData,
        project_id: currentProjectId ?? undefined,
      });
    },
    onSuccess: (newTemplate) => {
      setSelectedTemplateId(newTemplate.id);
      setShowImportModal(false);
      setShowInitialChoice(false);
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'templates'] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => worldbuildingApi.deleteTemplate(templateId),
    onSuccess: () => {
      setSelectedTemplateId(null);
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'templates'] });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: { name: string } }) =>
      worldbuildingApi.updateTemplate(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'templates'] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'template', selectedTemplateId] });
      setIsEditingTemplateName(false);
    },
  });

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    setSelectedTemplateId(null);
    setActiveTab('map');
    setShowInitialChoice(false);
    setShowCreateModal(false);
    setShowImportModal(false);
    setShowDeleteModal(false);
  }, [currentProjectId]);

  const currentModule = currentTemplate?.modules?.find(m => m.module_type === activeTab);

  // 处理初始选择弹窗关闭
  const handleInitialChoiceClose = () => {
    setShowInitialChoice(false);
  };

  // 处理创建新世界
  const handleCreateNewWorld = () => {
    setShowCreateModal(true);
  };

  // 处理导入模板
  const handleImportWorld = () => {
    setShowImportModal(true);
  };

  // 提交创建
  const handleCreateTemplateSubmit = (name: string) => {
    createTemplateMutation.mutate({ name });
  };

  // 提交导入
  const handleImportTemplateSubmit = (name: string, file: File) => {
    importTemplateMutation.mutate({ name, file });
  };

  const handleDeleteTemplate = () => {
    if (!currentTemplate) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (currentTemplate) {
      deleteTemplateMutation.mutate(currentTemplate.id, {
        onSuccess: () => {
          setShowDeleteModal(false);
        },
      });
    }
  };

  const handleStartEditTemplateName = () => {
    if (currentTemplate) {
      setEditingTemplateName(currentTemplate.name);
      setIsEditingTemplateName(true);
    }
  };

  const handleSaveTemplateName = () => {
    if (currentTemplate && editingTemplateName.trim()) {
      updateTemplateMutation.mutate({
        templateId: currentTemplate.id,
        data: { name: editingTemplateName.trim() },
      });
    }
  };

  const handleCancelEditTemplateName = () => {
    setIsEditingTemplateName(false);
    setEditingTemplateName('');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-16 border-b border-border/60 flex items-center justify-center px-6 bg-card/20 backdrop-blur-sm flex-shrink-0 relative group">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2 absolute left-6">
          <Globe2 className="h-5 w-5" />
          世界观设定
        </h1>
        {currentTemplate && (
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
                  disabled={updateTemplateMutation.isPending}
                  className="p-1 hover:bg-accent/50 rounded text-emerald-600 transition-colors"
                  title="保存"
                >
                  {updateTemplateMutation.isPending ? (
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
              <>
                <span className="text-2xl font-semibold text-foreground">{currentTemplate.name}</span>
                <div className="flex items-center gap-1 absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={handleStartEditTemplateName}
                    className="p-1 hover:bg-accent/50 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="修改名称"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleDeleteTemplate}
                    disabled={deleteTemplateMutation.isPending}
                    className="p-1 hover:bg-accent/50 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="删除世界"
                  >
                    {deleteTemplateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </header>

      {/* 横向标签栏 */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border/60 bg-card/10 flex-shrink-0 overflow-x-auto">
        {TAB_ORDER.map((tab) => {
          const config = TAB_CONFIG[tab];
          const Icon = config.icon;
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {!currentTemplate && !templatesLoading && (
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
            isLoading={createTemplateMutation.isPending}
          />

          <ImportTemplateModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSubmit={handleImportTemplateSubmit}
            isLoading={importTemplateMutation.isPending}
          />

          <DeleteConfirmModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleConfirmDelete}
            templateName={currentTemplate?.name || ''}
            isLoading={deleteTemplateMutation.isPending}
          />

          <div className="flex-1 overflow-y-auto p-6">
            {templateLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : currentModule ? (
              <div className="max-w-4xl mx-auto">
                <ModuleSection
                  module={currentModule}
                  onModuleUpdate={() => {
                    if (selectedTemplateId) {
                      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'template', selectedTemplateId] });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
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
  );
};

export default WorldbuildingView;