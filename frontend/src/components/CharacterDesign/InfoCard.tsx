import { useState, useCallback, useEffect } from 'react';
import { Edit2, Check, X, Plus, Trash2, AlignLeft, List, Image as ImageIcon, Type, Hash, ToggleLeft } from 'lucide-react';
import type { CharacterCard, CardContentItem } from '@/types/character';

interface InfoCardProps {
  card: CharacterCard;
  onUpdate?: (cardId: string, data: { title?: string; icon?: string; content?: CardContentItem[]; order_index?: number }) => void;
  onDelete?: (cardId: string) => void;
  isEditable?: boolean;
  autoEdit?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  text: <Type className="h-3 w-3" />,
  rich_text: <AlignLeft className="h-3 w-3" />,
  list: <List className="h-3 w-3" />,
  image: <ImageIcon className="h-3 w-3" />,
  number: <Hash className="h-3 w-3" />,
  boolean: <ToggleLeft className="h-3 w-3" />,
};

const contentTypeLabels: Record<string, string> = {
  text: '文本',
  rich_text: '富文本',
  list: '列表',
  image: '图片',
  number: '数字',
  boolean: '是/否',
};

/**
 * 信息小卡片组件
 *
 * 显示人物的自定义信息卡片，支持编辑、富文本、图标选择
 */
export const InfoCard = ({
  card,
  onUpdate,
  onDelete,
  isEditable = true,
  autoEdit = false,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: InfoCardProps) => {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editContent, setEditContent] = useState<CardContentItem[]>(card.content || []);

  // 当 autoEdit 变化时更新编辑状态
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
      setEditTitle(card.title);
      setEditContent(card.content || []);
    }
  }, [autoEdit, card]);

  // 当 isEditable 变为 false 时，退出编辑状态
  useEffect(() => {
    if (!isEditable && isEditing) {
      setIsEditing(false);
      setEditTitle(card.title);
      setEditContent(card.content || []);
    }
  }, [isEditable, isEditing, card]);

  // 当卡片数据变化时更新本地状态
  useEffect(() => {
    setEditTitle(card.title);
    setEditContent(card.content || []);
  }, [card.id, card.title, card.content]);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    setEditTitle(card.title);
    setEditContent(card.content || []);
    setIsEditing(true);
  }, [card]);

  // 保存编辑
  const handleSave = useCallback(() => {
    onUpdate?.(card.id, {
      title: editTitle,
      content: editContent,
    });
    setIsEditing(false);
  }, [card.id, editTitle, editContent, onUpdate]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setEditTitle(card.title);
    setEditContent(card.content || []);
    setIsEditing(false);
  }, [card]);

  // 添加字段
  const handleAddField = useCallback((type: CardContentItem['type'] = 'text') => {
    setEditContent((prev) => [
      ...prev,
      { key: '新字段', value: type === 'boolean' ? false : type === 'number' ? 0 : '', type },
    ]);
  }, []);

  // 更新字段
  const handleUpdateField = useCallback((index: number, field: Partial<CardContentItem>) => {
    setEditContent((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...field } : item))
    );
  }, []);

  // 删除字段
  const handleDeleteField = useCallback((index: number) => {
    setEditContent((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 渲染内容项
  const renderContentItem = (item: CardContentItem, index: number) => {
    if (isEditing) {
      return (
        <div key={index} className="space-y-2 p-2 bg-accent/5 rounded-lg group">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.key}
              onChange={(e) => handleUpdateField(index, { key: e.target.value })}
              className="flex-1 px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="字段名"
            />
            <select
              value={item.type}
              onChange={(e) => handleUpdateField(index, { type: e.target.value as CardContentItem['type'], value: e.target.value === 'boolean' ? false : e.target.value === 'number' ? 0 : '' })}
              className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {Object.entries(contentTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => handleDeleteField(index)}
              className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {item.type === 'rich_text' ? (
            <textarea
              value={String(item.value)}
              onChange={(e) => handleUpdateField(index, { value: e.target.value })}
              rows={3}
              className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              placeholder="输入内容..."
            />
          ) : item.type === 'boolean' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(item.value)}
                onChange={(e) => handleUpdateField(index, { value: e.target.checked })}
                className="w-4 h-4 rounded border-border/60"
              />
              <span className="text-xs text-muted-foreground">是</span>
            </label>
          ) : item.type === 'number' ? (
            <input
              type="number"
              value={Number(item.value)}
              onChange={(e) => handleUpdateField(index, { value: Number(e.target.value) })}
              className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="输入数字"
            />
          ) : item.type === 'list' ? (
            <textarea
              value={String(item.value)}
              onChange={(e) => handleUpdateField(index, { value: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              placeholder="输入列表项，每行一个"
            />
          ) : (
            <input
              type="text"
              value={String(item.value)}
              onChange={(e) => handleUpdateField(index, { value: e.target.value })}
              className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="字段值"
            />
          )}
        </div>
      );
    }

    // 显示模式
    const renderValue = () => {
      if (item.type === 'boolean') {
        return (
          <span className={`text-xs ${item.value ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {item.value ? '是' : '否'}
          </span>
        );
      }
      if (item.type === 'rich_text') {
        return (
          <div className="text-xs text-foreground whitespace-pre-wrap">{String(item.value)}</div>
        );
      }
      if (item.type === 'list') {
        const items = String(item.value).split('\n').filter(Boolean);
        return (
          <ul className="text-xs text-foreground list-disc list-inside">
            {items.map((listItem, i) => (
              <li key={i}>{listItem}</li>
            ))}
          </ul>
        );
      }
      return <span className="text-xs text-foreground">{String(item.value)}</span>;
    };

    return (
      <div key={index} className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{item.key}</span>
        {renderValue()}
      </div>
    );
  };

  return (
    <div className="bg-card/50 border border-border/60 rounded-xl overflow-hidden group hover:border-border/80 transition-colors">
      {/* 标题栏 */}
      <div className="h-10 px-4 flex items-center justify-center bg-accent/5 border-b border-border/40 relative">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 px-2 py-1 text-sm font-medium bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 text-center"
              placeholder="卡片标题"
              autoFocus
            />
          </div>
        ) : (
          <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
        )}

        {isEditable && (
          <div className="absolute right-4 flex items-center gap-1">
            {/* 排序按钮 */}
            {!isEditing && (
              <>
                <button
                  onClick={onMoveUp}
                  disabled={isFirst}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上移"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={isLast}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下移"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-100/50 rounded-md transition-colors"
                  title="保存"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1.5 text-muted-foreground hover:bg-accent/20 rounded-md transition-colors"
                  title="取消"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartEdit}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  title="编辑"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(card.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-3">
        {editContent.length === 0 && !isEditing ? (
          <div className="text-xs text-muted-foreground/60 italic text-center py-2">
            暂无内容
          </div>
        ) : (
          editContent.map((item, index) => renderContentItem(item, index))
        )}

        {isEditing && (
          <div className="pt-2 border-t border-border/40">
            <div className="flex flex-wrap gap-2">
              {Object.entries(contentTypeLabels).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => handleAddField(type as CardContentItem['type'])}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  {contentTypeIcons[type]}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoCard;
