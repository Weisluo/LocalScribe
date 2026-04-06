import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { AddEventModalProps, EventLevel, EventType } from '../types';
import { LEVEL_CONFIG, EVENT_TYPE_CONFIG } from '../config';

export const AddEventModal = ({ isOpen, onClose, onSubmit, eras, selectedEraId, isLoading, error }: AddEventModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<EventLevel>('normal');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [icon, setIcon] = useState('');
  const [eraId, setEraId] = useState<string | undefined>(selectedEraId);
  const [eventType, setEventType] = useState<EventType | undefined>(undefined);

  useEffect(() => {
    setEraId(selectedEraId);
  }, [selectedEraId]);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit({ name: name.trim(), description: description.trim(), level, eventDate: eventDate.trim(), eventEndDate: eventEndDate.trim(), icon, eraId, eventType });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="添加历史事件">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">所属时代</label>
          <select
            value={eraId || ''}
            onChange={(e) => setEraId(e.target.value || undefined)}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
          >
            <option value="">无（独立事件）</option>
            {eras.map((era) => (
              <option key={era.id} value={era.id}>{era.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">事件名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入事件名称"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">事件类型</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setEventType(undefined)}
              className={`px-2 py-2 text-xs rounded-lg border transition-all ${
                eventType === undefined 
                  ? 'border-primary bg-primary/10 text-primary font-medium' 
                  : 'border-border/30 hover:border-border/50 bg-muted/20 text-muted-foreground'
              }`}
            >
              默认
            </button>
            {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => {
              const typeConfig = EVENT_TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEventType(t)}
                  className={`px-2 py-2 text-xs rounded-lg border transition-all flex items-center justify-center gap-1 ${
                    eventType === t 
                      ? `${typeConfig.border} bg-gradient-to-br ${typeConfig.gradient} ${typeConfig.text} font-medium` 
                      : 'border-border/30 hover:border-border/50 bg-muted/20 text-muted-foreground'
                  }`}
                  title={typeConfig.description}
                >
                  <span>{typeConfig.icon}</span>
                  <span className="hidden sm:inline">{typeConfig.labelCn}</span>
                </button>
              );
            })}
          </div>
          {eventType && (
            <p className="text-xs text-muted-foreground mt-2 italic">{EVENT_TYPE_CONFIG[eventType].description}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">事件级别</label>
          <div className="grid grid-cols-4 gap-2">
            {(['critical', 'major', 'normal', 'minor'] as EventLevel[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`px-3 py-2 text-sm rounded-md border transition-[border-color,background-color,box-shadow] ${
                  level === l 
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm' 
                    : 'border-border hover:border-primary/50 hover:bg-accent/5'
                }`}
              >
                {LEVEL_CONFIG[l].labelCn}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">开始时间</label>
            <input
              type="text"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              placeholder="如：阳阙历元年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
            <p className="text-xs text-muted-foreground mt-1">支持：元年、阿拉伯数字、中文数字</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">结束时间</label>
            <input
              type="text"
              value={eventEndDate}
              onChange={(e) => setEventEndDate(e.target.value)}
              placeholder="如：阳阙历三年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
            <p className="text-xs text-muted-foreground mt-1">可选，用于持续事件</p>
          </div>
        </div>
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
          <label className="block text-sm font-medium mb-2 text-foreground">事件描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入事件描述"
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
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />创建中...</> : '创建'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
