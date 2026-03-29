import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, User, Edit2, Check, X } from 'lucide-react';
import type { CharacterRelationship, RelationType, CharacterSimple } from '@/types/character';
import { RelationTypeLabels, RelationTypeColors } from '@/types/character';

interface RelationshipListProps {
  relationships: CharacterRelationship[];
  availableCharacters: CharacterSimple[];
  isLoadingCharacters?: boolean;
  onAdd?: (data: {
    target_character_id?: string;
    target_name?: string;
    relation_type: RelationType;
    description?: string;
    strength?: number;
    is_bidirectional?: boolean;
    reverse_description?: string;
  }) => void;
  onUpdate?: (relationshipId: string, data: {
    relation_type?: RelationType;
    description?: string;
    strength?: number;
    is_bidirectional?: boolean;
    reverse_description?: string;
  }) => void;
  onDelete?: (relationshipId: string) => void;
  isEditable?: boolean;
}

const relationTypeOptions: RelationType[] = ['family', 'love', 'friend', 'master', 'apprentice', 'enemy', 'other'];

/**
 * 关系列表组件
 *
 * 显示和管理人物之间的关系，支持关系强度和双向关系
 */
export const RelationshipList = ({
  relationships,
  availableCharacters,
  isLoadingCharacters = false,
  onAdd,
  onUpdate,
  onDelete,
  isEditable = true,
}: RelationshipListProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRelationType, setNewRelationType] = useState<RelationType>('friend');
  const [newTargetId, setNewTargetId] = useState('');
  const [newTargetName, setNewTargetName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStrength, setNewStrength] = useState(50);
  const [newIsBidirectional, setNewIsBidirectional] = useState(true);
  const [newReverseDescription, setNewReverseDescription] = useState('');
  const [useExistingCharacter, setUseExistingCharacter] = useState(true);

  // 编辑状态
  const [editRelationType, setEditRelationType] = useState<RelationType>('friend');
  const [editDescription, setEditDescription] = useState('');
  const [editStrength, setEditStrength] = useState(50);
  const [editIsBidirectional, setEditIsBidirectional] = useState(true);
  const [editReverseDescription, setEditReverseDescription] = useState('');

  // 当 isEditable 变为 false 时，退出编辑状态
  useEffect(() => {
    if (!isEditable) {
      setIsAdding(false);
      setEditingId(null);
    }
  }, [isEditable]);

  // 开始添加
  const handleStartAdd = useCallback(() => {
    setNewRelationType('friend');
    setNewTargetId('');
    setNewTargetName('');
    setNewDescription('');
    setNewStrength(50);
    setNewIsBidirectional(true);
    setNewReverseDescription('');
    setUseExistingCharacter(true);
    setIsAdding(true);
  }, []);

  // 保存添加
  const handleSaveAdd = useCallback(() => {
    const targetId = useExistingCharacter ? newTargetId || undefined : undefined;
    const targetName = !useExistingCharacter ? newTargetName || undefined : undefined;

    if (targetId || targetName) {
      onAdd?.({
        target_character_id: targetId,
        target_name: targetName,
        relation_type: newRelationType,
        description: newDescription || undefined,
        strength: newStrength,
        is_bidirectional: newIsBidirectional,
        reverse_description: newIsBidirectional ? newReverseDescription || undefined : undefined,
      });
      setIsAdding(false);
    }
  }, [newRelationType, newTargetId, newTargetName, newDescription, newStrength, newIsBidirectional, newReverseDescription, useExistingCharacter, onAdd]);

  // 取消添加
  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
  }, []);

  // 开始编辑
  const handleStartEdit = useCallback((relationship: CharacterRelationship) => {
    setEditingId(relationship.id);
    setEditRelationType(relationship.relation_type);
    setEditDescription(relationship.description || '');
    setEditStrength(relationship.strength);
    setEditIsBidirectional(relationship.is_bidirectional);
    setEditReverseDescription(relationship.reverse_description || '');
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback((relationshipId: string) => {
    onUpdate?.(relationshipId, {
      relation_type: editRelationType,
      description: editDescription || undefined,
      strength: editStrength,
      is_bidirectional: editIsBidirectional,
      reverse_description: editIsBidirectional ? editReverseDescription || undefined : undefined,
    });
    setEditingId(null);
  }, [editRelationType, editDescription, editStrength, editIsBidirectional, editReverseDescription, onUpdate]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  // 删除关系
  const handleDelete = useCallback(
    (relationshipId: string) => {
      if (confirm('确定要删除这个关系吗？')) {
        onDelete?.(relationshipId);
      }
    },
    [onDelete]
  );

  // 获取关系类型标签样式
  const getRelationTypeStyle = (type: RelationType) => {
    const color = RelationTypeColors[type];
    return {
      backgroundColor: `${color}20`,
      color: color,
      borderColor: `${color}40`,
    };
  };

  // 渲染关系强度条
  const renderStrengthBar = (strength: number) => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-accent/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${strength}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{strength}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* 关系列表 */}
      <div className="space-y-2">
        {relationships.map((relationship) => (
          <div
            key={relationship.id}
            className="flex flex-col gap-2 p-3 bg-accent/5 rounded-lg group hover:bg-accent/10 transition-colors"
          >
            {editingId === relationship.id ? (
              // 编辑模式
              <div className="space-y-3">
                {/* 关系类型选择 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">关系类型:</span>
                  <select
                    value={editRelationType}
                    onChange={(e) => setEditRelationType(e.target.value as RelationType)}
                    className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {relationTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {RelationTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 关系强度 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">关系强度</span>
                    <span className="text-xs text-primary">{editStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editStrength}
                    onChange={(e) => setEditStrength(Number(e.target.value))}
                    className="w-full h-1.5 bg-accent/20 rounded-full appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* 关系描述 */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">关系描述</span>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="描述这段关系..."
                    className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>

                {/* 双向关系 */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsBidirectional}
                      onChange={(e) => setEditIsBidirectional(e.target.checked)}
                      className="w-4 h-4 rounded border-border/60"
                    />
                    <span className="text-xs text-muted-foreground">双向关系</span>
                  </label>
                </div>

                {/* 反向描述 */}
                {editIsBidirectional && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">反向描述（对方视角）</span>
                    <input
                      type="text"
                      value={editReverseDescription}
                      onChange={(e) => setEditReverseDescription(e.target.value)}
                      placeholder="从对方角度描述这段关系..."
                      className="w-full px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleSaveEdit(relationship.id)}
                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              // 显示模式
              <>
                <div className="flex items-center gap-3">
                  {/* 关系类型标签 */}
                  <span
                    className="px-2 py-0.5 text-xs rounded-full border"
                    style={getRelationTypeStyle(relationship.relation_type)}
                  >
                    {RelationTypeLabels[relationship.relation_type]}
                  </span>

                  {/* 目标人物 */}
                  <div className="flex items-center gap-2 flex-1">
                    {relationship.target_character ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                          {relationship.target_character.avatar ? (
                            <img
                              src={relationship.target_character.avatar}
                              alt={relationship.target_character.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{relationship.target_character.name}</span>
                      </>
                    ) : (
                      <span className="text-sm font-medium">{relationship.target_name}</span>
                    )}
                  </div>

                  {/* 关系强度 */}
                  {renderStrengthBar(relationship.strength)}

                  {/* 操作按钮 */}
                  {isEditable && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(relationship)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(relationship.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 关系描述 */}
                {relationship.description && (
                  <div className="text-xs text-muted-foreground pl-1">
                    {relationship.description}
                  </div>
                )}

                {/* 双向关系标识 */}
                {relationship.is_bidirectional && (
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0-12l4 4m-4-4l-4 4" />
                    </svg>
                    <span>双向关系</span>
                    {relationship.reverse_description && (
                      <span className="text-muted-foreground">({relationship.reverse_description})</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {relationships.length === 0 && !isAdding && (
          <div className="text-center py-4 text-sm text-muted-foreground/60">
            暂无人物关系
          </div>
        )}
      </div>

      {/* 添加新关系 */}
      {isEditable && (
        <div>
          {isAdding ? (
            <div className="p-3 bg-accent/5 rounded-lg space-y-3">
              {/* 关系类型选择 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">关系类型:</span>
                <select
                  value={newRelationType}
                  onChange={(e) => setNewRelationType(e.target.value as RelationType)}
                  className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {relationTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {RelationTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 关系强度 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">关系强度</span>
                  <span className="text-xs text-primary">{newStrength}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newStrength}
                  onChange={(e) => setNewStrength(Number(e.target.value))}
                  className="w-full h-1.5 bg-accent/20 rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* 目标人物选择 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      checked={useExistingCharacter}
                      onChange={() => setUseExistingCharacter(true)}
                      className="w-3 h-3"
                    />
                    选择已有角色
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      checked={!useExistingCharacter}
                      onChange={() => setUseExistingCharacter(false)}
                      className="w-3 h-3"
                    />
                    输入角色名称
                  </label>
                </div>

                {useExistingCharacter ? (
                  <div>
                    {isLoadingCharacters ? (
                      <div className="text-xs text-muted-foreground py-2">
                        加载中...
                      </div>
                    ) : availableCharacters.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2">
                        暂无其他角色可选
                      </div>
                    ) : (
                      <select
                        value={newTargetId}
                        onChange={(e) => setNewTargetId(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        <option value="">选择角色...</option>
                        {availableCharacters.map((char) => (
                          <option key={char.id} value={char.id}>
                            {char.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newTargetName}
                    onChange={(e) => setNewTargetName(e.target.value)}
                    placeholder="输入角色名称"
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                )}
              </div>

              {/* 关系描述 */}
              <div>
                <span className="text-xs text-muted-foreground block mb-1">关系描述</span>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="描述这段关系..."
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* 双向关系 */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsBidirectional}
                    onChange={(e) => setNewIsBidirectional(e.target.checked)}
                    className="w-4 h-4 rounded border-border/60"
                  />
                  <span className="text-xs text-muted-foreground">双向关系</span>
                </label>
              </div>

              {/* 反向描述 */}
              {newIsBidirectional && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">反向描述（对方视角）</span>
                  <input
                    type="text"
                    value={newReverseDescription}
                    onChange={(e) => setNewReverseDescription(e.target.value)}
                    placeholder="从对方角度描述这段关系..."
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelAdd}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAdd}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartAdd}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors w-full justify-center"
            >
              <Plus className="h-4 w-4" />
              添加关系
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RelationshipList;
