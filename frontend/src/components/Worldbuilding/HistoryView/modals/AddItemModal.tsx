import { useState, useRef, useEffect } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { AddItemModalProps } from '../types';

export const AddItemModal = ({ isOpen, onClose, onSubmit, isLoading, error }: AddItemModalProps) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<{ key: string; value: string }[]>([]);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const keyBoxRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleAddField = () => {
    setFields([...fields, { key: '', value: '' }]);
  };

  const handleRemoveField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
  };

  const handleFieldChange = (index: number, key: string, value: string) => {
    const newFields = [...fields];
    newFields[index] = { key, value };
    setFields(newFields);
  };

  const adjustHeight = (textarea: HTMLTextAreaElement | null | undefined, keyBox: HTMLDivElement | null | undefined) => {
    if (textarea && keyBox) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(38, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
      keyBox.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    fields.forEach((_, index) => {
      const id = `field-${index}`;
      const textarea = textareaRefs.current.get(id);
      const keyBox = keyBoxRefs.current.get(id);
      adjustHeight(textarea, keyBox);
    });
  }, [fields]);

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
    setName('');
    setFields([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="添加条目">
      <div className="space-y-4 min-w-[400px]">
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
          <div className="space-y-3">
            {fields.map((field, index) => {
              const id = `field-${index}`;
              return (
                <div key={id} className="flex gap-2">
                  <div
                    ref={(el) => {
                      if (el) keyBoxRefs.current.set(id, el);
                      else keyBoxRefs.current.delete(id);
                    }}
                    className="w-28 shrink-0 bg-background border border-border/50 rounded-md flex items-center px-3 overflow-hidden transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                    style={{ minHeight: '38px', height: '38px' }}
                  >
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => handleFieldChange(index, e.target.value, field.value)}
                      placeholder="字段名"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                  <textarea
                    ref={(el) => {
                      if (el) textareaRefs.current.set(id, el);
                      else textareaRefs.current.delete(id);
                    }}
                    value={field.value}
                    onChange={(e) => {
                      handleFieldChange(index, field.key, e.target.value);
                      const keyBox = keyBoxRefs.current.get(id);
                      adjustHeight(e.target, keyBox);
                    }}
                    placeholder="字段值"
                    rows={1}
                    className="flex-1 min-w-0 bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow] resize-none whitespace-pre-wrap break-words overflow-hidden text-sm"
                    style={{ minHeight: '38px', height: '38px' }}
                  />
                  <button
                    onClick={() => handleRemoveField(index)}
                    className="p-2 hover:bg-destructive/10 rounded-md text-destructive transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={handleAddField}
              className="flex items-center gap-1.5 px-3 py-2 hover:bg-primary/10 rounded-md text-primary transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              添加字段
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
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />创建中...</> : '创建'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
