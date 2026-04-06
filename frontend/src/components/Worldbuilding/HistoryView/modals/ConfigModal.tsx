import { useState, useEffect } from 'react';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { ConfigModalProps, EraThemeConfig, EventTypeConfig, EventLevelConfig } from '../types';

type TabType = 'eraThemes' | 'eventTypes' | 'levels';

export const ConfigModal = ({ isOpen, onClose, config, onSave, isLoading }: ConfigModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('eraThemes');
  const [localConfig, setLocalConfig] = useState(config);

  const [editingEraTheme, setEditingEraTheme] = useState<EraThemeConfig | null>(null);
  const [editingEventType, setEditingEventType] = useState<EventTypeConfig | null>(null);
  const [editingEventLevel, setEditingEventLevel] = useState<EventLevelConfig | null>(null);

  const [showEraThemeForm, setShowEraThemeForm] = useState(false);
  const [showEventTypeForm, setShowEventTypeForm] = useState(false);
  const [showEventLevelForm, setShowEventLevelForm] = useState(false);

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleAddEraTheme = () => {
    setEditingEraTheme(null);
    setShowEraThemeForm(true);
  };

  const handleEditEraTheme = (theme: EraThemeConfig) => {
    setEditingEraTheme(theme);
    setShowEraThemeForm(true);
  };

  const handleDeleteEraTheme = (label: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      eraThemes: prev.eraThemes.filter((t) => t.label !== label),
    }));
  };

  const handleSaveEraTheme = (theme: EraThemeConfig & { id: string }) => {
    setLocalConfig((prev) => {
      const exists = prev.eraThemes.some((t) => t.label === theme.label);
      return {
        ...prev,
        eraThemes: exists
          ? prev.eraThemes.map((t) => (t.label === theme.label ? theme : t))
          : [...prev.eraThemes, theme],
      };
    });
    setShowEraThemeForm(false);
    setEditingEraTheme(null);
  };

  const handleAddEventType = () => {
    setEditingEventType(null);
    setShowEventTypeForm(true);
  };

  const handleEditEventType = (type: EventTypeConfig) => {
    setEditingEventType(type);
    setShowEventTypeForm(true);
  };

  const handleDeleteEventType = (label: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.filter((t) => t.label !== label),
    }));
  };

  const handleSaveEventType = (type: EventTypeConfig & { id: string }) => {
    setLocalConfig((prev) => {
      const exists = prev.eventTypes.some((t) => t.label === type.label);
      return {
        ...prev,
        eventTypes: exists
          ? prev.eventTypes.map((t) => (t.label === type.label ? type : t))
          : [...prev.eventTypes, type],
      };
    });
    setShowEventTypeForm(false);
    setEditingEventType(null);
  };

  const handleAddEventLevel = () => {
    setEditingEventLevel(null);
    setShowEventLevelForm(true);
  };

  const handleEditEventLevel = (level: EventLevelConfig) => {
    setEditingEventLevel(level);
    setShowEventLevelForm(true);
  };

  const handleDeleteEventLevel = (label: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      levels: prev.levels.filter((l) => l.label !== label),
    }));
  };

  const handleSaveEventLevel = (level: EventLevelConfig & { id: string }) => {
    setLocalConfig((prev) => {
      const exists = prev.levels.some((l) => l.label === level.label);
      return {
        ...prev,
        levels: exists
          ? prev.levels.map((l) => (l.label === level.label ? level : l))
          : [...prev.levels, level],
      };
    });
    setShowEventLevelForm(false);
    setEditingEventLevel(null);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'eraThemes', label: '时代主题' },
    { id: 'eventTypes', label: '事件类型' },
    { id: 'levels', label: '事件等级' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="模块配置">
      <div className="space-y-4">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-sm rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[300px]">
          {activeTab === 'eraThemes' && (
            <EraThemeTab
              themes={localConfig.eraThemes}
              onAdd={handleAddEraTheme}
              onEdit={handleEditEraTheme}
              onDelete={handleDeleteEraTheme}
              showForm={showEraThemeForm}
              editingTheme={editingEraTheme}
              onSaveForm={handleSaveEraTheme}
              onCancelForm={() => {
                setShowEraThemeForm(false);
                setEditingEraTheme(null);
              }}
            />
          )}

          {activeTab === 'eventTypes' && (
            <EventTypeTab
              types={localConfig.eventTypes}
              onAdd={handleAddEventType}
              onEdit={handleEditEventType}
              onDelete={handleDeleteEventType}
              showForm={showEventTypeForm}
              editingType={editingEventType}
              onSaveForm={handleSaveEventType}
              onCancelForm={() => {
                setShowEventTypeForm(false);
                setEditingEventType(null);
              }}
            />
          )}

          {activeTab === 'levels' && (
            <EventLevelTab
              levels={localConfig.levels}
              onAdd={handleAddEventLevel}
              onEdit={handleEditEventLevel}
              onDelete={handleDeleteEventLevel}
              showForm={showEventLevelForm}
              editingLevel={editingEventLevel}
              onSaveForm={handleSaveEventLevel}
              onCancelForm={() => {
                setShowEventLevelForm(false);
                setEditingEventLevel(null);
              }}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/10 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存配置'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface EraThemeTabProps {
  themes: EraThemeConfig[];
  onAdd: () => void;
  onEdit: (theme: EraThemeConfig) => void;
  onDelete: (label: string) => void;
  showForm: boolean;
  editingTheme: EraThemeConfig | null;
  onSaveForm: (theme: EraThemeConfig & { id: string }) => void;
  onCancelForm: () => void;
}

const EraThemeTab = ({
  themes,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingTheme,
  onSaveForm,
  onCancelForm,
}: EraThemeTabProps) => {
  const [formData, setFormData] = useState<Partial<EraThemeConfig>>({
    label: '',
    labelCn: '',
    gradient: '',
    border: '',
    accent: '',
    accentColor: '',
    text: '',
    bgLight: '',
    bgDark: '',
    description: '',
  });

  useEffect(() => {
    if (editingTheme) {
      setFormData({
        label: editingTheme.label,
        labelCn: editingTheme.labelCn || '',
        gradient: editingTheme.gradient || '',
        border: editingTheme.border || '',
        accent: editingTheme.accent || '',
        accentColor: editingTheme.accentColor || '',
        text: editingTheme.text || '',
        bgLight: editingTheme.bgLight || '',
        bgDark: editingTheme.bgDark || '',
        description: editingTheme.description || '',
      });
    } else {
      setFormData({
        label: '',
        labelCn: '',
        gradient: '',
        border: '',
        accent: '',
        accentColor: '',
        text: '',
        bgLight: '',
        bgDark: '',
        description: '',
      });
    }
  }, [editingTheme]);

  const handleSubmit = () => {
    if (formData.label && formData.labelCn) {
      onSaveForm({
        id: formData.label ?? '',
        label: formData.label ?? '',
        labelCn: formData.labelCn ?? '',
        gradient: formData.gradient ?? '',
        border: formData.border ?? '',
        accent: formData.accent ?? '',
        accentColor: formData.accentColor ?? '',
        text: formData.text ?? '',
        bgLight: formData.bgLight ?? '',
        bgDark: formData.bgDark ?? '',
        description: formData.description ?? '',
      });
      setFormData({
        label: '',
        labelCn: '',
        gradient: '',
        border: '',
        accent: '',
        accentColor: '',
        text: '',
        bgLight: '',
        bgDark: '',
        description: '',
      });
    }
  };

  return (
    <div className="space-y-3">
      {showForm ? (
        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">ID *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="唯一标识（英文）"
                disabled={!!editingTheme}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">英文名 *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="英文标签名"
                disabled={!!editingTheme}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">中文名 *</label>
              <input
                type="text"
                value={formData.labelCn}
                onChange={(e) => setFormData((p) => ({ ...p, labelCn: e.target.value }))}
                placeholder="中文显示名称"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">渐变类名</label>
              <input
                type="text"
                value={formData.gradient}
                onChange={(e) => setFormData((p) => ({ ...p, gradient: e.target.value }))}
                placeholder="如：from-amber-600 to-yellow-500"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">边框类名</label>
              <input
                type="text"
                value={formData.border}
                onChange={(e) => setFormData((p) => ({ ...p, border: e.target.value }))}
                placeholder="如：border-amber-400/30"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">强调色背景</label>
              <input
                type="text"
                value={formData.accent}
                onChange={(e) => setFormData((p) => ({ ...p, accent: e.target.value }))}
                placeholder="如：bg-amber-900/20"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">强调色值</label>
              <input
                type="text"
                value={formData.accentColor}
                onChange={(e) => setFormData((p) => ({ ...p, accentColor: e.target.value }))}
                placeholder="如：#d97706"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">文字颜色</label>
              <input
                type="text"
                value={formData.text}
                onChange={(e) => setFormData((p) => ({ ...p, text: e.target.value }))}
                placeholder="如：text-amber-200"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">浅色背景</label>
              <input
                type="text"
                value={formData.bgLight}
                onChange={(e) => setFormData((p) => ({ ...p, bgLight: e.target.value }))}
                placeholder="如：bg-amber-50"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">深色背景</label>
              <input
                type="text"
                value={formData.bgDark}
                onChange={(e) => setFormData((p) => ({ ...p, bgDark: e.target.value }))}
                placeholder="如：bg-amber-950/40"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">描述</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="主题描述"
              className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelForm}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.label || !formData.labelCn}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {editingTheme ? '更新' : '添加'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg hover:border-border transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          添加时代主题
        </button>
      )}

      <div className="space-y-2">
        {themes.map((theme) => (
          <div
            key={theme.label}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-md ${theme.gradient} ${theme.border} border`}
              />
              <div>
                <div className="text-sm font-medium">{theme.labelCn}</div>
                <div className="text-xs text-muted-foreground">{theme.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(theme)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-md transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(theme.label)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EventTypeTabProps {
  types: EventTypeConfig[];
  onAdd: () => void;
  onEdit: (type: EventTypeConfig) => void;
  onDelete: (label: string) => void;
  showForm: boolean;
  editingType: EventTypeConfig | null;
  onSaveForm: (type: EventTypeConfig & { id: string }) => void;
  onCancelForm: () => void;
}

const EventTypeTab = ({
  types,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingType,
  onSaveForm,
  onCancelForm,
}: EventTypeTabProps) => {
  const [formData, setFormData] = useState<Partial<EventTypeConfig>>({
    label: '',
    labelCn: '',
    color: '#6b7280',
    gradient: '',
    border: '',
    accent: '',
    text: '',
    icon: '',
    description: '',
  });

  useEffect(() => {
    if (editingType) {
      setFormData({
        label: editingType.label,
        labelCn: editingType.labelCn || '',
        color: editingType.color || '#6b7280',
        gradient: editingType.gradient || '',
        border: editingType.border || '',
        accent: editingType.accent || '',
        text: editingType.text || '',
        icon: editingType.icon || '',
        description: editingType.description || '',
      });
    } else {
      setFormData({
        label: '',
        labelCn: '',
        color: '#6b7280',
        gradient: '',
        border: '',
        accent: '',
        text: '',
        icon: '',
        description: '',
      });
    }
  }, [editingType]);

  const handleSubmit = () => {
    if (formData.label && formData.labelCn) {
      onSaveForm({
        id: formData.label ?? '',
        label: formData.label ?? '',
        labelCn: formData.labelCn ?? '',
        color: formData.color ?? '#6b7280',
        gradient: formData.gradient ?? '',
        border: formData.border ?? '',
        accent: formData.accent ?? '',
        text: formData.text ?? '',
        icon: formData.icon ?? '',
        description: formData.description ?? '',
      });
      setFormData({
        label: '',
        labelCn: '',
        color: '#6b7280',
        gradient: '',
        border: '',
        accent: '',
        text: '',
        icon: '',
        description: '',
      });
    }
  };

  return (
    <div className="space-y-3">
      {showForm ? (
        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">ID *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="唯一标识（英文）"
                disabled={!!editingType}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">英文名 *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="英文标签名"
                disabled={!!editingType}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">中文名 *</label>
              <input
                type="text"
                value={formData.labelCn}
                onChange={(e) => setFormData((p) => ({ ...p, labelCn: e.target.value }))}
                placeholder="中文显示名称"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">颜色</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                className="w-full h-8 bg-background border border-border/50 rounded-md cursor-pointer"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">渐变类名</label>
              <input
                type="text"
                value={formData.gradient}
                onChange={(e) => setFormData((p) => ({ ...p, gradient: e.target.value }))}
                placeholder="如：from-red-600 to-orange-500"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">边框类名</label>
              <input
                type="text"
                value={formData.border}
                onChange={(e) => setFormData((p) => ({ ...p, border: e.target.value }))}
                placeholder="如：border-red-400/30"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">强调色背景</label>
              <input
                type="text"
                value={formData.accent}
                onChange={(e) => setFormData((p) => ({ ...p, accent: e.target.value }))}
                placeholder="如：bg-red-900/20"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">文字颜色</label>
              <input
                type="text"
                value={formData.text}
                onChange={(e) => setFormData((p) => ({ ...p, text: e.target.value }))}
                placeholder="如：text-red-200"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">图标</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData((p) => ({ ...p, icon: e.target.value }))}
                placeholder="emoji 图标"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div></div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">描述</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="类型描述"
              className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelForm}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.label || !formData.labelCn}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {editingType ? '更新' : '添加'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg hover:border-border transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          添加事件类型
        </button>
      )}

      <div className="space-y-2">
        {types.map((type) => (
          <div
            key={type.label}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{type.icon}</span>
              <div>
                <div className="text-sm font-medium">{type.labelCn}</div>
                <div className="text-xs text-muted-foreground">{type.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(type)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-md transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(type.label)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EventLevelTabProps {
  levels: EventLevelConfig[];
  onAdd: () => void;
  onEdit: (level: EventLevelConfig) => void;
  onDelete: (label: string) => void;
  showForm: boolean;
  editingLevel: EventLevelConfig | null;
  onSaveForm: (level: EventLevelConfig & { id: string }) => void;
  onCancelForm: () => void;
}

const EventLevelTab = ({
  levels,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingLevel,
  onSaveForm,
  onCancelForm,
}: EventLevelTabProps) => {
  const [formData, setFormData] = useState<Partial<EventLevelConfig>>({
    label: '',
    labelCn: '',
    icon: '',
    flexBasis: '0',
    minHeight: '60px',
    padding: '12px',
    bgClass: '',
    borderClass: '',
    textClass: '',
    titleSize: 'text-sm',
    glowColor: '',
    accentGradient: '',
  });

  useEffect(() => {
    if (editingLevel) {
      setFormData({
        label: editingLevel.label,
        labelCn: editingLevel.labelCn || '',
        icon: editingLevel.icon || '',
        flexBasis: editingLevel.flexBasis || '0',
        minHeight: editingLevel.minHeight || '60px',
        padding: editingLevel.padding || '12px',
        bgClass: editingLevel.bgClass || '',
        borderClass: editingLevel.borderClass || '',
        textClass: editingLevel.textClass || '',
        titleSize: editingLevel.titleSize || 'text-sm',
        glowColor: editingLevel.glowColor || '',
        accentGradient: editingLevel.accentGradient || '',
      });
    } else {
      setFormData({ label: '', labelCn: '', icon: '', flexBasis: '0', minHeight: '60px', padding: '12px', bgClass: '', borderClass: '', textClass: '', titleSize: 'text-sm', glowColor: '', accentGradient: '' });
    }
  }, [editingLevel]);

  const handleSubmit = () => {
    if (formData.label && formData.labelCn) {
      onSaveForm({
        id: formData.label ?? '',
        label: formData.label ?? '',
        labelCn: formData.labelCn ?? '',
        icon: formData.icon ?? '',
        flexBasis: formData.flexBasis ?? '0',
        minHeight: formData.minHeight ?? '60px',
        padding: formData.padding ?? '12px',
        bgClass: formData.bgClass ?? '',
        borderClass: formData.borderClass ?? '',
        textClass: formData.textClass ?? '',
        titleSize: formData.titleSize ?? 'text-sm',
        glowColor: formData.glowColor ?? '',
        accentGradient: formData.accentGradient ?? '',
      });
      setFormData({ label: '', labelCn: '', icon: '', flexBasis: '0', minHeight: '60px', padding: '12px', bgClass: '', borderClass: '', textClass: '', titleSize: 'text-sm', glowColor: '', accentGradient: '' });
    }
  };

  return (
    <div className="space-y-3">
      {showForm ? (
        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">ID *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="唯一标识（如 critical）"
                disabled={!!editingLevel}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={formData.labelCn}
                onChange={(e) => setFormData((p) => ({ ...p, labelCn: e.target.value }))}
                placeholder="如：重点大事件"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">图标</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData((p) => ({ ...p, icon: e.target.value }))}
                placeholder="如：★"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div></div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelForm}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.label || !formData.labelCn}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {editingLevel ? '更新' : '添加'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg hover:border-border transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          添加事件等级
        </button>
      )}

      <div className="space-y-2">
        {levels.map((level) => (
          <div
            key={level.label}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{level.icon}</span>
              <div>
                <div className="text-sm font-medium">{level.labelCn}</div>
                <div className="text-xs text-muted-foreground">{level.label}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(level)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-md transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(level.label)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
