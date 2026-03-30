import { useState, useEffect } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { EditItemModalProps } from '../types';

export const EditItemModal = ({ isOpen, onClose, onSubmit, item, isLoading, error }: EditItemModalProps) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setFields(Object.entries(item.content).map(([key, value]) => ({ key, value })));
    }
  }, [item]);

  const handleAddField = () => {
    setFields([...fields, { key: '', value: '' }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: string, value: string) => {
    const newFields = [...fields];
    newFields[index] = { key, value };
    setFields(newFields);
  };

  const handleSubmit = () => {
    if (name.trim()) {
      const content: Record<string, string> = {};
      fields.forEach((field) => {
        if (field.key.trim() && field.value.trim()) {
          content[field.key.trim()] = field.value.trim();
        }
      });
      onSubmit({ name: name.trim(), content });
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="编辑条目">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">条目名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入条目名称"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">自定义字段</label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => handleFieldChange(index, e.target.value, field.value)}
                  placeholder="字段名"
                  className="flex-1 bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => handleFieldChange(index, field.key, e.target.value)}
                  placeholder="字段值"
                  className="flex-1 bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
                />
                <button
                  onClick={() => handleRemoveField(index)}
                  className="p-2 hover:bg-destructive/10 rounded-md text-destructive transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={handleAddField}
              className="p-2 hover:bg-primary/10 rounded-md text-primary transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
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
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
