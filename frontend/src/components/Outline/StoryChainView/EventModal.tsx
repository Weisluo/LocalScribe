// frontend/src/components/Outline/StoryChainView/EventModal.tsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, User, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { StoryEvent, StoryEventCreate, StoryEventUpdate, EventType } from '../types';

interface CharacterSimple {
  id: string;
  name: string;
  avatar?: string;
  level?: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: StoryEvent;
  actId: string;
  projectId: string;
  mode: 'create' | 'edit';
  onSave: (data: StoryEventCreate | StoryEventUpdate) => void;
  onDelete?: (eventId: string) => void;
}

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: 'normal', label: '普通' },
  { value: 'decision', label: '决策' },
  { value: 'milestone', label: '里程碑' },
  { value: 'flashback', label: '闪回' },
  { value: 'flashforward', label: '闪前' },
];

export const EventModal = ({
  isOpen,
  onClose,
  event,
  actId,
  projectId,
  mode,
  onSave,
  onDelete,
}: EventModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [eventType, setEventType] = useState<EventType>('normal');
  const [location, setLocation] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  const { data: characterList = [] } = useQuery<CharacterSimple[]>({
    queryKey: ['characters-simple', projectId],
    queryFn: () => api.get<CharacterSimple[]>(`/projects/${projectId}/characters/simple`),
    enabled: !!projectId && isOpen,
  });

  useEffect(() => {
    if (event && mode === 'edit') {
      setTitle(event.title || '');
      setContent(event.content || '');
      setEventType(event.event_type || 'normal');
      setLocation(event.location || '');
      setTimestamp(event.timestamp || '');
      setCharacters(event.characters || []);
    } else {
      setTitle('');
      setContent('');
      setEventType('normal');
      setLocation('');
      setTimestamp('');
      setCharacters([]);
    }
  }, [event, mode, isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (mode === 'create') {
      const data: StoryEventCreate = {
        act_id: actId,
        project_id: projectId,
        title,
        content,
        event_type: eventType,
        location: location || undefined,
        timestamp: timestamp || undefined,
        characters: characters.length > 0 ? characters : undefined,
      };
      onSave(data);
    } else {
      const data: StoryEventUpdate = {
        title,
        content,
        event_type: eventType,
        location: location || undefined,
        timestamp: timestamp || undefined,
        characters: characters.length > 0 ? characters : undefined,
      };
      onSave(data);
    }
    handleClose();
  }, [mode, actId, projectId, title, content, eventType, location, timestamp, characters, onSave, handleClose]);

  const toggleCharacter = useCallback((characterId: string) => {
    setCharacters(prev => 
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  }, []);

  const removeCharacter = useCallback((characterId: string) => {
    setCharacters(prev => prev.filter(id => id !== characterId));
  }, []);

  const selectedCharacters = characterList.filter(c => characters.includes(c.id));

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleSave]);

  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200'}`}>
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className={`
        relative w-full max-w-lg mx-4 bg-card rounded-xl shadow-2xl ring-1 ring-border/60
        ${isClosing ? 'animate-out zoom-out-95 duration-200' : 'animate-in zoom-in-95 duration-200'}
      `}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h3 className="text-lg font-semibold text-foreground">
            {mode === 'create' ? '添加事件' : '编辑事件'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="px-6 py-4 space-y-4">
          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">事件标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                       placeholder:text-muted-foreground/50 transition-all"
              placeholder="输入事件标题..."
              autoFocus
            />
          </div>

          {/* 事件类型 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">事件类型</label>
            <div className="flex gap-2 flex-wrap">
              {eventTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEventType(opt.value)}
                  className={`
                    px-3 py-1.5 text-xs rounded-lg border transition-all duration-200
                    ${eventType === opt.value
                      ? 'bg-accent/20 border-accent/50 text-foreground'
                      : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:border-border/60'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 内容描述 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">内容描述</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                       placeholder:text-muted-foreground/50 transition-all resize-none"
              placeholder="描述这个事件的内容..."
              rows={3}
            />
          </div>

          {/* 地点和时间标记 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">地点</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                         placeholder:text-muted-foreground/50 transition-all"
                placeholder="地点..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">时间标记</label>
              <input
                type="text"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                         placeholder:text-muted-foreground/50 transition-all"
                placeholder="如 Day 1, 第三天..."
              />
            </div>
          </div>

          {/* 参与角色 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">参与角色</label>
            <div className="flex flex-wrap gap-2">
              {selectedCharacters.map((char) => (
                <span
                  key={char.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/15 
                           border border-accent/30 rounded-full text-xs text-foreground"
                >
                  {char.avatar ? (
                    <img src={char.avatar} alt={char.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{char.name}</span>
                  <button
                    onClick={() => removeCharacter(char.id)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-accent/30 text-muted-foreground 
                             hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 border border-dashed 
                           border-border/60 rounded-full text-xs text-muted-foreground
                           hover:border-accent/50 hover:text-foreground transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>添加角色</span>
                </button>
                {showCharacterPicker && (
                  <div className="absolute top-full left-0 mt-1 z-10 min-w-[180px] max-h-48 
                                overflow-y-auto bg-popover rounded-lg shadow-lg border border-border/60
                                animate-in fade-in zoom-in-95 duration-150">
                    {characterList.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                        暂无角色数据
                      </div>
                    ) : (
                      characterList.map((char) => {
                        const isSelected = characters.includes(char.id);
                        return (
                          <button
                            key={char.id}
                            onClick={() => toggleCharacter(char.id)}
                            className={`
                              w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                              transition-colors
                              ${isSelected 
                                ? 'bg-accent/20 text-foreground' 
                                : 'hover:bg-accent/10 text-muted-foreground hover:text-foreground'}
                            `}
                          >
                            {char.avatar ? (
                              <img src={char.avatar} alt={char.name} className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="flex-1">{char.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-accent" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40">
          <div>
            {mode === 'edit' && onDelete && event && (
              <button
                onClick={() => {
                  onDelete(event.id);
                  handleClose();
                }}
                className="px-3 py-2 text-sm text-destructive/70 hover:text-destructive
                         hover:bg-destructive/10 rounded-lg transition-colors"
              >
                删除事件
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground
                       hover:bg-accent/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg
                       hover:bg-primary/90 transition-colors shadow-sm"
            >
              {mode === 'create' ? '添加' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
