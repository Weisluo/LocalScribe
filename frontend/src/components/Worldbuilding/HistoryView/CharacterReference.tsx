import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Users } from 'lucide-react';
import { characterApi } from '@/services/characterApi';
import { worldbuildingApi } from '@/services/worldbuildingApi';
import { CharacterReferenceProps } from './types';
import { CharacterPickerModal } from './modals/CharacterPickerModal';
import { CharacterBarCard } from '@/components/CharacterDesign/CharacterBarCard';
import type { CharacterListItem } from '@/types/character';

const CHAR_REF_PREFIX = '_char_ref:';

export const CharacterReference = ({
  eventId,
  eventItems,
  projectId,
  moduleId,
  onAddItem: _onAddItem,
  onEditItem: _onEditItem,
  onDeleteItem: _onDeleteItem,
  onNavigateToCharacter,
  isHovered,
}: CharacterReferenceProps) => {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  const { data: allCharacters = [] } = useQuery({
    queryKey: ['characters', projectId],
    queryFn: () => characterApi.getCharacters(projectId),
  });

  const standaloneCharRefs = useMemo(() => {
    const refs: Array<{ charId: string; itemId: string }> = [];
    for (const item of eventItems) {
      for (const key of Object.keys(item.content)) {
        if (key.startsWith(CHAR_REF_PREFIX)) {
          const charId = key.slice(CHAR_REF_PREFIX.length);
          if (charId) {
            refs.push({ charId, itemId: item.id });
          }
        }
      }
    }
    return refs;
  }, [eventItems]);

  const linkedCharacters: Array<CharacterListItem & { itemId: string }> = useMemo(() => {
    return standaloneCharRefs
      .map((ref): (CharacterListItem & { itemId: string }) | null => {
        const char = allCharacters.find((c) => c.id === ref.charId);
        if (!char) return null;
        return {
          ...char,
          itemId: ref.itemId,
        };
      })
      .filter((c): c is CharacterListItem & { itemId: string } => c !== null);
  }, [standaloneCharRefs, allCharacters]);

  const addCharRefMutation = useMutation({
    mutationFn: (data: { charId: string; charName: string }) => {
      const content: Record<string, string> = {
        [`${CHAR_REF_PREFIX}${data.charId}`]: data.charName,
      };
      return worldbuildingApi.createItem(moduleId, {
        name: `_char_ref_${data.charId}`,
        content,
        submodule_id: eventId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items'] });
    },
  });

  const removeCharRefMutation = useMutation({
    mutationFn: (itemId: string) => {
      return worldbuildingApi.deleteItem(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items'] });
    },
  });

  const handleSelectCharacter = (characterId: string, characterName: string) => {
    const existingRef = standaloneCharRefs.find((r) => r.charId === characterId);
    if (existingRef) {
      setShowPicker(false);
      return;
    }

    addCharRefMutation.mutate({ charId: characterId, charName: characterName });
    setShowPicker(false);
  };

  const handleRemoveCharacter = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCharRefMutation.mutate(itemId);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Users className="h-3.5 w-3.5" />
          参与人物
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <Plus className="h-3 w-3" />
          添加
        </button>
      </div>

      {linkedCharacters.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {linkedCharacters.map((char) => (
            <div key={char.id} className="relative group">
              <CharacterBarCard
                character={char}
                isSelected={false}
                onClick={() => onNavigateToCharacter?.(char.id)}
              />
              <button
                type="button"
                onClick={(e) => handleRemoveCharacter(char.itemId, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-border/50"
                title={`移除 ${char.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {linkedCharacters.length === 0 && (
        <p className="text-xs text-muted-foreground/50 italic py-1">暂无参与人物</p>
      )}

      <CharacterPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectCharacter}
        projectId={projectId}
      />
    </div>
  );
};
