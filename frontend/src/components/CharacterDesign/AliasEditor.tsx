import { useState, useCallback } from 'react';
import { Plus, X, Edit2, Check, Trash2 } from 'lucide-react';
import type { CharacterAlias, AliasType } from '@/types/character';
import { AliasTypeLabels } from '@/types/character';

interface AliasEditorProps {
  aliases: CharacterAlias[];
  onAdd?: (data: { alias_type: AliasType; content: string }) => void;
  onUpdate?: (aliasId: string, data: { alias_type?: AliasType; content?: string }) => void;
  onDelete?: (aliasId: string) => void;
  isEditable?: boolean;
  compact?: boolean;
}

const aliasTypeOptions: AliasType[] = ['zi', 'hao', 'nickname', 'title', 'other'];

/**
 * 别名编辑器组件
 *
 * 管理人物的字、号、外号、称号等别名
 */
export const AliasEditor = ({
  aliases,
  onAdd,
  onUpdate,
  onDelete,
  isEditable = true,
  compact = false,
}: AliasEditorProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newAliasType, setNewAliasType] = useState<AliasType>('zi');
  const [newAliasContent, setNewAliasContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<AliasType>('zi');
  const [editContent, setEditContent] = useState('');

  // 开始添加
  const handleStartAdd = useCallback(() => {
    setNewAliasType('zi');
    setNewAliasContent('');
    setIsAdding(true);
  }, []);

  // 保存添加
  const handleSaveAdd = useCallback(() => {
    if (newAliasContent.trim()) {
      onAdd?.({ alias_type: newAliasType, content: newAliasContent.trim() });
      setIsAdding(false);
      setNewAliasContent('');
    }
  }, [newAliasType, newAliasContent, onAdd]);

  // 取消添加
  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewAliasContent('');
  }, []);

  // 开始编辑
  const handleStartEdit = useCallback((alias: CharacterAlias) => {
    setEditingId(alias.id);
    setEditType(alias.alias_type);
    setEditContent(alias.content);
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(
    (aliasId: string) => {
      if (editContent.trim()) {
        onUpdate?.(aliasId, { alias_type: editType, content: editContent.trim() });
        setEditingId(null);
      }
    },
    [editType, editContent, onUpdate]
  );

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  // 按类型排序的别名
  const sortedAliases = [...aliases].sort((a, b) => {
    const typeOrder: Record<AliasType, number> = { zi: 0, hao: 1, nickname: 2, title: 3, other: 4 };
    return typeOrder[a.alias_type] - typeOrder[b.alias_type];
  });

  return (
    <div className={compact ? 'flex items-center gap-2 flex-wrap' : 'space-y-2'}>
      {/* 别名列表 */}
      <div className="flex flex-wrap gap-2">
        {sortedAliases.map((alias) => (
          <div
            key={alias.id}
            className="group flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 rounded-lg text-sm"
          >
            {editingId === alias.id ? (
              <>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AliasType)}
                  className="px-1.5 py-0.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {aliasTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {AliasTypeLabels[type]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="px-1.5 py-0.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 w-24"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(alias.id)}
                  className="p-0.5 text-emerald-600 hover:bg-emerald-100/50 rounded"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-0.5 text-muted-foreground hover:bg-accent/20 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                {!compact && (
                  <span className="text-xs text-muted-foreground">{AliasTypeLabels[alias.alias_type]}</span>
                )}
                <span className="text-foreground font-medium">{alias.content}</span>
                {isEditable && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(alias)}
                      className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onDelete?.(alias.id)}
                      className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* 添加新别名 */}
      {isEditable && (
        <>
          {isAdding ? (
            <div className="flex items-center gap-1.5">
              <select
                value={newAliasType}
                onChange={(e) => setNewAliasType(e.target.value as AliasType)}
                className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {aliasTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {AliasTypeLabels[type]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newAliasContent}
                onChange={(e) => setNewAliasContent(e.target.value)}
                placeholder="输入别名"
                className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 w-32"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAdd();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
              />
              <button
                onClick={handleSaveAdd}
                className="p-1 text-emerald-600 hover:bg-emerald-100/50 rounded"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCancelAdd}
                className="p-1 text-muted-foreground hover:bg-accent/20 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartAdd}
              className={`flex items-center gap-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors ${
                compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              {compact ? '添加' : '添加别名'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AliasEditor;
