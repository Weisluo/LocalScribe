import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { AddEntityModalProps } from '../types';
import { CustomFieldRenderer } from '../components/CustomFieldRenderer';

export const AddEntityModal = ({
  isOpen,
  onClose,
  onSubmit,
  entityTypes,
  levels,
  selectedEntityType,
  isLoading,
  error,
}: AddEntityModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState(selectedEntityType || '');
  const [level, setLevel] = useState('');
  const [icon, setIcon] = useState('');
  const [unit, setUnit] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    if (selectedEntityType) {
      setEntityType(selectedEntityType);
    }
  }, [selectedEntityType]);

  useEffect(() => {
    if (entityType) {
      const config = entityTypes.find((t) => t.id === entityType);
      if (config?.customFields) {
        const defaults: Record<string, string | string[]> = {};
        config.customFields.forEach((field) => {
          if (field.defaultValue) {
            defaults[field.id] = field.defaultValue;
          }
        });
        setCustomFields(defaults);
      } else {
        setCustomFields({});
      }
    }
  }, [entityType, entityTypes]);

  const currentEntityTypeConfig = entityTypes.find((t) => t.id === entityType);

  const handleCustomFieldChange = (fieldId: string, value: string | string[]) => {
    setCustomFields((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = () => {
    if (name.trim() && entityType && level) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        entityType,
        level,
        icon,
        unit: unit.trim() || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setEntityType(selectedEntityType || '');
    setLevel('');
    setIcon('');
    setUnit('');
    setCustomFields({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="添加经济实体">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">实体名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入实体名称"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">实体类型 *</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
          >
            <option value="">请选择实体类型</option>
            {entityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.icon} {type.name}
              </option>
            ))}
          </select>
          {currentEntityTypeConfig?.description && (
            <p className="text-xs text-muted-foreground mt-1">{currentEntityTypeConfig.description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">经济等级 *</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
          >
            <option value="">请选择等级</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.icon} {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">图标</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="emoji图标"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">单位</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="如：金币、吨"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
          </div>
        </div>

        {currentEntityTypeConfig?.customFields && currentEntityTypeConfig.customFields.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border/30">
            <h4 className="text-sm font-medium text-foreground">自定义字段</h4>
            {currentEntityTypeConfig.customFields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  {field.name}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <CustomFieldRenderer
                  field={field}
                  value={customFields[field.id] || (field.type === 'multiselect' ? [] : '')}
                  onChange={handleCustomFieldChange}
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入实体描述"
            rows={3}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow] resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/10 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !entityType || !level || isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
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
