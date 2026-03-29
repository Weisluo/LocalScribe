import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { CharacterArtifact, ArtifactRarity } from '@/types/character';
import { ArtifactRarityLabels, ArtifactRarityColors, ArtifactRarityBgColors } from '@/types/character';

interface ArtifactListProps {
  artifacts: CharacterArtifact[];
  onAdd?: (data: { name: string; quote?: string; description?: string; artifact_type?: string; rarity?: ArtifactRarity }) => void;
  onUpdate?: (artifactId: string, data: { name?: string; quote?: string; description?: string; artifact_type?: string; rarity?: ArtifactRarity }) => void;
  onDelete?: (artifactId: string) => void;
  isEditable?: boolean;
}

const rarityOptions: ArtifactRarity[] = ['legendary', 'epic', 'rare', 'common'];

const getRarityStyle = (rarity?: ArtifactRarity): React.CSSProperties => {
  if (!rarity) return {};
  return {
    borderColor: ArtifactRarityColors[rarity],
    backgroundColor: ArtifactRarityBgColors[rarity],
  };
};

export const ArtifactList = ({
  artifacts,
  onAdd,
  onUpdate,
  onDelete,
  isEditable = true,
}: ArtifactListProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newQuote, setNewQuote] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('');
  const [newRarity, setNewRarity] = useState<ArtifactRarity | ''>('');
  const [editName, setEditName] = useState('');
  const [editQuote, setEditQuote] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');
  const [editRarity, setEditRarity] = useState<ArtifactRarity | ''>('');

  // 当 isEditable 变为 false 时，退出编辑状态
  useEffect(() => {
    if (!isEditable) {
      setIsAdding(false);
      setEditingId(null);
    }
  }, [isEditable]);

  const handleStartAdd = useCallback(() => {
    setNewName('');
    setNewQuote('');
    setNewDescription('');
    setNewType('');
    setNewRarity('');
    setIsAdding(true);
  }, []);

  const handleSaveAdd = useCallback(() => {
    if (newName.trim()) {
      onAdd?.({
        name: newName.trim(),
        quote: newQuote.trim() || undefined,
        description: newDescription.trim() || undefined,
        artifact_type: newType.trim() || undefined,
        rarity: newRarity || undefined,
      });
      setIsAdding(false);
    }
  }, [newName, newQuote, newDescription, newType, newRarity, onAdd]);

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
  }, []);

  const handleStartEdit = useCallback((artifact: CharacterArtifact) => {
    setEditingId(artifact.id);
    setEditName(artifact.name);
    setEditQuote(artifact.quote || '');
    setEditDescription(artifact.description || '');
    setEditType(artifact.artifact_type || '');
    setEditRarity(artifact.rarity || '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      onUpdate?.(editingId, {
        name: editName.trim(),
        quote: editQuote.trim() || undefined,
        description: editDescription.trim() || undefined,
        artifact_type: editType.trim() || undefined,
        rarity: editRarity || undefined,
      });
      setEditingId(null);
    }
  }, [editingId, editName, editQuote, editDescription, editType, editRarity, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleDelete = useCallback(
    (artifactId: string) => {
      if (confirm('确定要删除这个器物吗？')) {
        onDelete?.(artifactId);
      }
    },
    [onDelete]
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="w-full p-3 rounded-lg group hover:bg-accent/10 transition-colors border-2 relative"
            style={getRarityStyle(artifact.rarity)}
          >
            {editingId === artifact.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">等级:</span>
                  {rarityOptions.map((rarity) => (
                    <button
                      key={rarity}
                      onClick={() => setEditRarity(rarity)}
                      className={`px-2 py-1 text-xs rounded transition-colors border ${
                        editRarity === rarity
                          ? 'text-white'
                          : 'bg-background text-muted-foreground hover:text-foreground'
                      }`}
                      style={editRarity === rarity ? { backgroundColor: ArtifactRarityColors[rarity], borderColor: ArtifactRarityColors[rarity] } : { borderColor: ArtifactRarityColors[rarity] }}
                    >
                      {ArtifactRarityLabels[rarity]}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="器物名称"
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  placeholder="器物类型（可选，如：剑、法器、丹药）"
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  type="text"
                  value={editQuote}
                  onChange={(e) => setEditQuote(e.target.value)}
                  placeholder="判词（可选）"
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="器物描述（可选）"
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center justify-between">
                  {artifact.artifact_type && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-sm text-muted-foreground bg-background/60 shrink-0">
                      {artifact.artifact_type}
                    </span>
                  )}
                  <h5 className="text-base font-medium text-foreground text-center flex-1 absolute left-0 right-0 pointer-events-none">{artifact.name}</h5>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isEditable && (
                      <>
                        <button
                          onClick={() => handleStartEdit(artifact)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(artifact.id)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  {artifact.quote && (
                    <p className="text-xs text-muted-foreground/80 italic text-center mb-1">"{artifact.quote}"</p>
                  )}
                  {artifact.description && (
                    <p className="text-xs text-muted-foreground text-center">{artifact.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {artifacts.length === 0 && !isAdding && (
          <div className="text-center py-4 text-sm text-muted-foreground/60">
            暂无器物
          </div>
        )}
      </div>

      {isEditable && (
        <div>
          {isAdding ? (
            <div className="p-3 bg-accent/5 rounded-lg space-y-2 border-2 border-dashed border-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">等级:</span>
                {rarityOptions.map((rarity) => (
                  <button
                    key={rarity}
                    onClick={() => setNewRarity(rarity)}
                    className={`px-2 py-1 text-xs rounded transition-colors border ${
                      newRarity === rarity
                        ? 'text-white'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                    style={newRarity === rarity ? { backgroundColor: ArtifactRarityColors[rarity], borderColor: ArtifactRarityColors[rarity] } : { borderColor: ArtifactRarityColors[rarity] }}
                  >
                    {ArtifactRarityLabels[rarity]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="器物名称"
                className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
              />
              <input
                type="text"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="器物类型（可选，如：剑、法器、丹药）"
                className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                type="text"
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                placeholder="判词（可选）"
                className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="器物描述（可选）"
                rows={2}
                className="w-full px-3 py-1.5 text-sm bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
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
              添加器物
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactList;
