import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { EditEraModalProps, EraTheme } from '../types';
import { ERA_THEME_CONFIG } from '../config';

export const EditEraModal = ({ isOpen, onClose, onSubmit, era, isLoading, error }: EditEraModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [theme, setTheme] = useState<EraTheme>('ochre');

  useEffect(() => {
    if (era) {
      setName(era.name);
      setDescription(era.description || '');
      setStartDate(era.startDate || '');
      setEndDate(era.endDate || '');
      setTheme(era.theme || 'ochre');
    }
  }, [era]);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit({ name: name.trim(), description: description.trim(), startDate: startDate.trim(), endDate: endDate.trim(), theme });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑时代">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">时代名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：上古时代、中世纪、工业革命"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">时代基调</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(ERA_THEME_CONFIG) as EraTheme[]).map((t) => {
              const themeConfig = ERA_THEME_CONFIG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                    theme === t 
                      ? `${themeConfig.border} bg-gradient-to-br ${themeConfig.gradient}` 
                      : 'border-border/30 hover:border-border/50 bg-muted/20'
                  }`}
                  title={themeConfig.description}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${themeConfig.accent}`} />
                    <span className={`text-xs font-medium ${theme === t ? themeConfig.text : 'text-muted-foreground'}`}>
                      {themeConfig.labelCn}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 line-clamp-1">{themeConfig.label}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">{ERA_THEME_CONFIG[theme].description}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">起始时间</label>
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="如：阳阙历元年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
            <p className="text-xs text-muted-foreground mt-1">支持：元年、阿拉伯数字、中文数字</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">结束时间</label>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="如：阳阙历1633年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
            <p className="text-xs text-muted-foreground mt-1">例：阳阙历一六三三年</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">时代描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述这个时代的特点"
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
            onClick={onClose} 
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/10 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />保存中...</> : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
