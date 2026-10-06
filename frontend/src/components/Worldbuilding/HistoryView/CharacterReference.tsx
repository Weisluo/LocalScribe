import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, Users } from 'lucide-react';
import { characterApi } from '@/services/characterApi';
import type { CharacterListItem } from '@/types/character';
import type { WorldLink } from '@/services/worldbuildingApi';
import { CharacterReferenceProps } from './types';
import { CharacterPickerModal } from './modals/CharacterPickerModal';
import { CharacterBarCard } from '@/components/CharacterDesign/CharacterBarCard';
import { useCreateWorldLink, useDeleteWorldLink, useWorldLinks } from '../hooks';
import { characterToRef, splitLinks } from '../types';

/** 旧前缀键（只读兼容展示，不再写入新键，phase2 §7/§8） */
const CHAR_REF_PREFIX = '_char_ref:';
/** 人物关联统一类型（契约 §4.2） */
const HISTORY_INVOLVES = 'history.involves';

/** meta.order 缺失时排到最后（回填前的旧链没有顺序） */
const linkOrder = (link: WorldLink): number => {
  const value = link.meta?.order;
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
};

export const CharacterReference = ({
  eventId,
  eventKind,
  worldId,
  projectId,
  isHovered,
  onNavigateToCharacter,
  eventItems,
}: CharacterReferenceProps) => {
  const [showPicker, setShowPicker] = useState(false);

  const { data: allCharacters = [] } = useQuery({
    queryKey: ['characters', projectId],
    queryFn: () => characterApi.getCharacters(projectId),
  });

  // worldId 缺失（WorldbuildingView 并行窗口）时降级：不请求 links，只展示旧 _char_ref
  const linkEnabled = !!worldId;

  const entityRef = useMemo(
    () => ({ module: 'history', kind: eventKind, id: eventId }),
    [eventKind, eventId]
  );

  // 关联数据取世界级共享列表后本地分流：整个世界一次请求，禁止逐卡请求（phase2 §6）
  const linksQuery = useWorldLinks(worldId || undefined);
  const involvesLinks = useMemo(
    () => (linksQuery.data ?? []).filter((link) => link.link_type === HISTORY_INVOLVES),
    [linksQuery.data]
  );
  const { outgoing } = useMemo(
    () =>
      linkEnabled ? splitLinks(involvesLinks, entityRef) : { outgoing: [], incoming: [] },
    [involvesLinks, entityRef, linkEnabled]
  );

  // 旧 _char_ref 条目在事件里的原始次序（P1-MIG-06 回填的链带 meta.legacyItemId，
  // 用它把回填链排回原顺序，避免「顺序不丢」退化成按 uuid5 排序）
  const legacyItemOrder = useMemo(() => {
    const order = new Map<string, number>();
    (eventItems ?? []).forEach((item, index) => order.set(item.id, index));
    return order;
  }, [eventItems]);

  // 人物关联 = history.involves 出链中目标为 character 的部分：
  // 回填链按原条目次序，新链按 meta.order，两者都缺失时用 created_at/id 兜底
  const linkedLinks = useMemo(
    () =>
      outgoing
        .filter((link) => link.target.module === 'character' && link.target.id)
        .sort((a, b) => {
          const rankOf = (link: (typeof outgoing)[number]): [number, number] => {
            const legacyItemId = link.meta?.legacyItemId;
            const legacyIndex =
              typeof legacyItemId === 'string'
                ? legacyItemOrder.get(legacyItemId)
                : undefined;
            if (legacyIndex !== undefined) return [legacyIndex, 0];
            return [legacyItemOrder.size, linkOrder(link)];
          };
          const [a0, a1] = rankOf(a);
          const [b0, b1] = rankOf(b);
          return (
            a0 - b0 ||
            a1 - b1 ||
            (a.created_at || '').localeCompare(b.created_at || '') ||
            a.id.localeCompare(b.id)
          );
        }),
    [outgoing, legacyItemOrder]
  );
  // 旧 _char_ref item 只读展示（双读窗口）：保持 item 顺序，不写回
  const legacyCharIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of eventItems ?? []) {
      for (const key of Object.keys(item.content)) {
        if (key.startsWith(CHAR_REF_PREFIX)) {
          const charId = key.slice(CHAR_REF_PREFIX.length);
          if (charId && !ids.includes(charId)) {
            ids.push(charId);
          }
        }
      }
    }
    return ids;
  }, [eventItems]);

  const charById = useMemo(
    () => new Map(allCharacters.map((character) => [character.id, character])),
    [allCharacters]
  );

  const entries = useMemo(() => {
    const result: Array<{ linkId?: string; character: CharacterListItem }> = [];
    const seen = new Set<string>();
    for (const link of linkedLinks) {
      const charId = link.target.id;
      const character = charById.get(charId);
      if (seen.has(charId) || !character) continue;
      seen.add(charId);
      result.push({ linkId: link.id, character });
    }
    // 已迁移成 WorldLink 的旧键不重复展示，其余旧键按原顺序补在后面
    for (const charId of legacyCharIds) {
      const character = charById.get(charId);
      if (seen.has(charId) || !character) continue;
      seen.add(charId);
      result.push({ character });
    }
    return result;
  }, [linkedLinks, legacyCharIds, charById]);

  const createLinkMutation = useCreateWorldLink(worldId);
  const deleteLinkMutation = useDeleteWorldLink(worldId);

  /** 追加顺序：最大 meta.order + 1（缺顺序的旧链不参与） */
  const nextOrder = useMemo(
    () =>
      linkedLinks.reduce(
        (max, link) => Math.max(max, linkOrder(link) === Number.MAX_SAFE_INTEGER ? max : linkOrder(link)),
        -1
      ) + 1,
    [linkedLinks]
  );

  const handleSelectCharacter = (characterId: string) => {
    if (linkedLinks.some((link) => link.target.id === characterId)) {
      setShowPicker(false);
      return;
    }
    createLinkMutation.mutate({
      source: entityRef,
      target: characterToRef(characterId),
      link_type: HISTORY_INVOLVES,
      // 顺序写入 meta.order，替代旧 _char_ref item 的顺序语义
      meta: { order: nextOrder },
    });
    setShowPicker(false);
  };

  const handleRemoveCharacter = (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLinkMutation.mutate(linkId);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Users className="h-3.5 w-3.5" />
          参与人物
        </div>
        {linkEnabled && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          >
            <Plus className="h-3 w-3" />
            添加
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {entries.map((entry) => {
            const { linkId, character } = entry;
            return (
              <div key={character.id} className="relative group">
                <CharacterBarCard
                  character={character}
                  isSelected={false}
                  onClick={() => onNavigateToCharacter?.(character.id)}
                />
                {linkId && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveCharacter(linkId, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-border/50"
                    title={`移除 ${character.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
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
