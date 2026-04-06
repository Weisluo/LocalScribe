import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, User, Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { characterApi } from '@/services/characterApi';
import { CharacterPickerModalProps } from '../types';
import type { CharacterGender } from '@/types/character';

export const CharacterPickerModal = ({ isOpen, onClose, onSelect, projectId, allowedCharacterIds }: CharacterPickerModalProps) => {
  const [activeTab, setActiveTab] = useState<'select' | 'create'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', gender: '' as CharacterGender | '', race: '' });

  const queryClient = useQueryClient();

  const hasAllowedCharacters = allowedCharacterIds === undefined || allowedCharacterIds.length > 0;

  useEffect(() => {
    if (isOpen && allowedCharacterIds && allowedCharacterIds.length === 0) {
      setActiveTab('create');
    }
  }, [isOpen, allowedCharacterIds]);

  const { data: characters = [], isLoading: isLoadingCharacters } = useQuery({
    queryKey: ['characters-simple', projectId],
    queryFn: () => characterApi.getCharactersSimple(projectId),
    enabled: isOpen && activeTab === 'select',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      characterApi.createCharacter(projectId, {
        name: createForm.name.trim(),
        gender: createForm.gender || undefined,
        race: createForm.race.trim() || undefined,
        level: 'past',
        source: 'history',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['characters-simple', projectId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      onSelect(data.id, data.name);
      onClose();
      handleReset();
    },
  });

  const filteredCharacters = characters.filter((char) => {
    if (allowedCharacterIds && !allowedCharacterIds.includes(char.id)) {
      return false;
    }
    return char.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelect = (characterId: string, characterName: string) => {
    onSelect(characterId, characterName);
    onClose();
    handleReset();
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    createMutation.mutate();
  };

  const handleReset = () => {
    setSearchQuery('');
    setCreateForm({ name: '', gender: '', race: '' });
    setActiveTab('select');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="关联人物" size="sm">
      <div className="space-y-3">
        <div className="flex rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => hasAllowedCharacters && setActiveTab('select')}
            disabled={!hasAllowedCharacters}
            className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'select'
                ? 'bg-background text-foreground shadow-sm'
                : hasAllowedCharacters
                ? 'text-muted-foreground hover:text-foreground'
                : 'text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            选择已有
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'create'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            快速创建
          </button>
        </div>

        {!hasAllowedCharacters && activeTab === 'create' && (
          <div className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-md border border-border/30">
            该事件暂无参与人物，请先创建人物或添加参与人物
          </div>
        )}

        {activeTab === 'select' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索人物..."
                className="w-full bg-background border border-border/50 pl-8 pr-3 py-1.5 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {isLoadingCharacters ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  加载中...
                </div>
              ) : filteredCharacters.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  {searchQuery ? '未找到匹配的人物' : '暂无人物，请先创建'}
                </div>
              ) : (
                filteredCharacters.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => handleSelect(char.id, char.name)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-accent/50 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {char.avatar ? (
                        <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-primary/60" />
                      )}
                    </div>
                    <span className="text-xs font-medium flex-1">{char.name}</span>
                    {char.source === 'history' && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                        历史
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">姓名 *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入人物姓名"
                className="w-full bg-background border border-border/50 px-2.5 py-1.5 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1 text-foreground">性别</label>
                <select
                  value={createForm.gender}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, gender: e.target.value as CharacterGender | '' }))}
                  className="w-full bg-background border border-border/50 px-2.5 py-1.5 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]"
                >
                  <option value="">未设置</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                  <option value="other">其他</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1 text-foreground">种族</label>
                <input
                  type="text"
                  value={createForm.race}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, race: e.target.value }))}
                  placeholder="如：人类"
                  className="w-full bg-background border border-border/50 px-2.5 py-1.5 rounded-md text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]"
                />
              </div>
            </div>
            {createMutation.isError && (
              <div className="text-xs text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-md border border-destructive/20">
                创建失败，请重试
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/10 rounded-md"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.name.trim() || createMutation.isPending}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    创建并关联
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
