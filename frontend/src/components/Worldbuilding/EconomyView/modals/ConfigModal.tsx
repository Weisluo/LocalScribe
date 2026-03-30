import { useState, useEffect } from 'react';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { ConfigModalProps, EntityTypeConfig, RelationTypeConfig, LevelConfig, LineStyle, ArrowType } from '../types';

type TabType = 'entityTypes' | 'relationTypes' | 'levels';

export const ConfigModal = ({ isOpen, onClose, config, onSave, isLoading }: ConfigModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('entityTypes');
  const [localConfig, setLocalConfig] = useState(config);

  const [editingEntityType, setEditingEntityType] = useState<EntityTypeConfig | null>(null);
  const [editingRelationType, setEditingRelationType] = useState<RelationTypeConfig | null>(null);
  const [editingLevel, setEditingLevel] = useState<LevelConfig | null>(null);

  const [showEntityTypeForm, setShowEntityTypeForm] = useState(false);
  const [showRelationTypeForm, setShowRelationTypeForm] = useState(false);
  const [showLevelForm, setShowLevelForm] = useState(false);

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleAddEntityType = () => {
    setEditingEntityType(null);
    setShowEntityTypeForm(true);
  };

  const handleEditEntityType = (type: EntityTypeConfig) => {
    setEditingEntityType(type);
    setShowEntityTypeForm(true);
  };

  const handleDeleteEntityType = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      entityTypes: prev.entityTypes.filter((t) => t.id !== id),
    }));
  };

  const handleSaveEntityType = (type: EntityTypeConfig) => {
    setLocalConfig((prev) => {
      const exists = prev.entityTypes.some((t) => t.id === type.id);
      return {
        ...prev,
        entityTypes: exists
          ? prev.entityTypes.map((t) => (t.id === type.id ? type : t))
          : [...prev.entityTypes, type],
      };
    });
    setShowEntityTypeForm(false);
    setEditingEntityType(null);
  };

  const handleAddRelationType = () => {
    setEditingRelationType(null);
    setShowRelationTypeForm(true);
  };

  const handleEditRelationType = (type: RelationTypeConfig) => {
    setEditingRelationType(type);
    setShowRelationTypeForm(true);
  };

  const handleDeleteRelationType = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      relationTypes: prev.relationTypes.filter((t) => t.id !== id),
    }));
  };

  const handleSaveRelationType = (type: RelationTypeConfig) => {
    setLocalConfig((prev) => {
      const exists = prev.relationTypes.some((t) => t.id === type.id);
      return {
        ...prev,
        relationTypes: exists
          ? prev.relationTypes.map((t) => (t.id === type.id ? type : t))
          : [...prev.relationTypes, type],
      };
    });
    setShowRelationTypeForm(false);
    setEditingRelationType(null);
  };

  const handleAddLevel = () => {
    setEditingLevel(null);
    setShowLevelForm(true);
  };

  const handleEditLevel = (level: LevelConfig) => {
    setEditingLevel(level);
    setShowLevelForm(true);
  };

  const handleDeleteLevel = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      levels: prev.levels.filter((l) => l.id !== id),
    }));
  };

  const handleSaveLevel = (level: LevelConfig) => {
    setLocalConfig((prev) => {
      const exists = prev.levels.some((l) => l.id === level.id);
      return {
        ...prev,
        levels: exists
          ? prev.levels.map((l) => (l.id === level.id ? level : l))
          : [...prev.levels, level],
      };
    });
    setShowLevelForm(false);
    setEditingLevel(null);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'entityTypes', label: '实体类型' },
    { id: 'relationTypes', label: '关系类型' },
    { id: 'levels', label: '等级' },
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
          {activeTab === 'entityTypes' && (
            <EntityTypeTab
              types={localConfig.entityTypes}
              onAdd={handleAddEntityType}
              onEdit={handleEditEntityType}
              onDelete={handleDeleteEntityType}
              showForm={showEntityTypeForm}
              editingType={editingEntityType}
              onSaveForm={handleSaveEntityType}
              onCancelForm={() => {
                setShowEntityTypeForm(false);
                setEditingEntityType(null);
              }}
            />
          )}

          {activeTab === 'relationTypes' && (
            <RelationTypeTab
              types={localConfig.relationTypes}
              onAdd={handleAddRelationType}
              onEdit={handleEditRelationType}
              onDelete={handleDeleteRelationType}
              showForm={showRelationTypeForm}
              editingType={editingRelationType}
              onSaveForm={handleSaveRelationType}
              onCancelForm={() => {
                setShowRelationTypeForm(false);
                setEditingRelationType(null);
              }}
            />
          )}

          {activeTab === 'levels' && (
            <LevelTab
              levels={localConfig.levels}
              onAdd={handleAddLevel}
              onEdit={handleEditLevel}
              onDelete={handleDeleteLevel}
              showForm={showLevelForm}
              editingLevel={editingLevel}
              onSaveForm={handleSaveLevel}
              onCancelForm={() => {
                setShowLevelForm(false);
                setEditingLevel(null);
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

interface EntityTypeTabProps {
  types: EntityTypeConfig[];
  onAdd: () => void;
  onEdit: (type: EntityTypeConfig) => void;
  onDelete: (id: string) => void;
  showForm: boolean;
  editingType: EntityTypeConfig | null;
  onSaveForm: (type: EntityTypeConfig) => void;
  onCancelForm: () => void;
}

const EntityTypeTab = ({
  types,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingType,
  onSaveForm,
  onCancelForm,
}: EntityTypeTabProps) => {
  const [formData, setFormData] = useState<Partial<EntityTypeConfig>>({
    id: '',
    name: '',
    icon: '',
    color: '#6b7280',
    description: '',
  });

  useEffect(() => {
    if (editingType) {
      setFormData({
        id: editingType.id,
        name: editingType.name,
        icon: editingType.icon || '',
        color: editingType.color || '#6b7280',
        description: editingType.description || '',
      });
    } else {
      setFormData({ id: '', name: '', icon: '', color: '#6b7280', description: '' });
    }
  }, [editingType]);

  const handleSubmit = () => {
    if (formData.id && formData.name) {
      onSaveForm({
        id: formData.id,
        name: formData.name,
        icon: formData.icon,
        color: formData.color,
        description: formData.description,
      });
      setFormData({ id: '', name: '', icon: '', color: '#6b7280', description: '' });
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
                value={formData.id}
                onChange={(e) => setFormData((p) => ({ ...p, id: e.target.value }))}
                placeholder="唯一标识"
                disabled={!!editingType}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="显示名称"
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
                placeholder="emoji"
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
              disabled={!formData.id || !formData.name}
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
          添加实体类型
        </button>
      )}

      <div className="space-y-2">
        {types.map((type) => (
          <div
            key={type.id}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{type.icon}</span>
              <div>
                <div className="text-sm font-medium">{type.name}</div>
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
                onClick={() => onDelete(type.id)}
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

interface RelationTypeTabProps {
  types: RelationTypeConfig[];
  onAdd: () => void;
  onEdit: (type: RelationTypeConfig) => void;
  onDelete: (id: string) => void;
  showForm: boolean;
  editingType: RelationTypeConfig | null;
  onSaveForm: (type: RelationTypeConfig) => void;
  onCancelForm: () => void;
}

const RelationTypeTab = ({
  types,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingType,
  onSaveForm,
  onCancelForm,
}: RelationTypeTabProps) => {
  const [formData, setFormData] = useState<Partial<RelationTypeConfig>>({
    id: '',
    name: '',
    icon: '',
    lineStyle: 'solid',
    arrow: '→',
    color: '#6b7280',
    description: '',
  });

  useEffect(() => {
    if (editingType) {
      setFormData({
        id: editingType.id,
        name: editingType.name,
        icon: editingType.icon || '',
        lineStyle: editingType.lineStyle || 'solid',
        arrow: editingType.arrow || '→',
        color: editingType.color || '#6b7280',
        description: editingType.description || '',
      });
    } else {
      setFormData({
        id: '',
        name: '',
        icon: '',
        lineStyle: 'solid',
        arrow: '→',
        color: '#6b7280',
        description: '',
      });
    }
  }, [editingType]);

  const lineStyles: LineStyle[] = ['solid', 'dashed', 'dotted', 'wavy'];
  const arrowTypes: ArrowType[] = ['→', '←', '⟷', '⇌', 'none'];

  const handleSubmit = () => {
    if (formData.id && formData.name) {
      onSaveForm({
        id: formData.id,
        name: formData.name,
        icon: formData.icon,
        lineStyle: formData.lineStyle as LineStyle,
        arrow: formData.arrow as ArrowType,
        color: formData.color,
        description: formData.description,
      });
      setFormData({
        id: '',
        name: '',
        icon: '',
        lineStyle: 'solid',
        arrow: '→',
        color: '#6b7280',
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
                value={formData.id}
                onChange={(e) => setFormData((p) => ({ ...p, id: e.target.value }))}
                placeholder="唯一标识"
                disabled={!!editingType}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="显示名称"
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
                placeholder="emoji"
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
              <label className="block text-xs font-medium mb-1">连线样式</label>
              <select
                value={formData.lineStyle}
                onChange={(e) => setFormData((p) => ({ ...p, lineStyle: e.target.value as LineStyle }))}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              >
                {lineStyles.map((s) => (
                  <option key={s} value={s}>
                    {s === 'solid' ? '实线' : s === 'dashed' ? '虚线' : s === 'dotted' ? '点线' : '波浪线'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">箭头类型</label>
              <select
                value={formData.arrow}
                onChange={(e) => setFormData((p) => ({ ...p, arrow: e.target.value as ArrowType }))}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              >
                {arrowTypes.map((a) => (
                  <option key={a} value={a}>
                    {a === 'none' ? '无箭头' : a}
                  </option>
                ))}
              </select>
            </div>
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
              disabled={!formData.id || !formData.name}
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
          添加关系类型
        </button>
      )}

      <div className="space-y-2">
        {types.map((type) => (
          <div
            key={type.id}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{type.icon}</span>
              <div>
                <div className="text-sm font-medium">{type.name}</div>
                <div className="text-xs text-muted-foreground">
                  {type.arrow} | {type.lineStyle === 'solid' ? '实线' : type.lineStyle === 'dashed' ? '虚线' : type.lineStyle === 'dotted' ? '点线' : '波浪线'}
                </div>
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
                onClick={() => onDelete(type.id)}
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

interface LevelTabProps {
  levels: LevelConfig[];
  onAdd: () => void;
  onEdit: (level: LevelConfig) => void;
  onDelete: (id: string) => void;
  showForm: boolean;
  editingLevel: LevelConfig | null;
  onSaveForm: (level: LevelConfig) => void;
  onCancelForm: () => void;
}

const LevelTab = ({
  levels,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingLevel,
  onSaveForm,
  onCancelForm,
}: LevelTabProps) => {
  const [formData, setFormData] = useState<Partial<LevelConfig>>({
    id: '',
    name: '',
    label: '',
    icon: '',
  });

  useEffect(() => {
    if (editingLevel) {
      setFormData({
        id: editingLevel.id,
        name: editingLevel.name,
        label: editingLevel.label || '',
        icon: editingLevel.icon || '',
      });
    } else {
      setFormData({ id: '', name: '', label: '', icon: '' });
    }
  }, [editingLevel]);

  const handleSubmit = () => {
    if (formData.id && formData.name) {
      onSaveForm({
        id: formData.id,
        name: formData.name,
        label: formData.label,
        icon: formData.icon,
      });
      setFormData({ id: '', name: '', label: '', icon: '' });
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
                value={formData.id}
                onChange={(e) => setFormData((p) => ({ ...p, id: e.target.value }))}
                placeholder="唯一标识"
                disabled={!!editingLevel}
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="显示名称"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">标签</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="如：★★★"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">图标</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData((p) => ({ ...p, icon: e.target.value }))}
                placeholder="emoji"
                className="w-full bg-background border border-border/50 px-2 py-1.5 text-sm rounded-md focus:border-primary focus:outline-none"
              />
            </div>
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
              disabled={!formData.id || !formData.name}
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
          添加等级
        </button>
      )}

      <div className="space-y-2">
        {levels.map((level) => (
          <div
            key={level.id}
            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{level.icon}</span>
              <div>
                <div className="text-sm font-medium">{level.name}</div>
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
                onClick={() => onDelete(level.id)}
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
