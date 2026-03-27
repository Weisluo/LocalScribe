import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit2,
  Trash2,
  User,
  MapPin,
  Calendar,
  Quote,
  Plus,
  ExternalLink,
  X,
} from 'lucide-react';
import { characterApi } from '@/services/characterApi';
import { api } from '@/utils/request';
import { AliasEditor } from './AliasEditor';
import { InfoCard } from './InfoCard';
import { RelationshipList } from './RelationshipList';
import { ArtifactList } from './ArtifactList';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CharacterEditForm } from './CharacterEditForm';
import { CharacterDetailSkeleton } from './CharacterSkeleton';
import { EmptyState } from './EmptyState';
import type {
  CharacterLevel,
  CharacterGender,
  AliasType,
  RelationType,
  ArtifactType,
  CardContentItem,
} from '@/types/character';
import type { TreeNodeType, NoteNode } from '@/types';
import {
  CharacterLevelColors,
  CharacterGenderLabels,
} from '@/types/character';

interface CharacterDetailProps {
  projectId: string;
  characterId: string;
  onClose?: () => void;
  onDelete?: (characterId: string) => void;
  onNavigateToNote?: (noteId: string) => void;
  tree?: TreeNodeType[];
}

/**
 * 人物详情组件
 *
 * 显示和编辑人物的完整信息
 */
export const CharacterDetail = ({
  projectId,
  characterId,
  onClose: _onClose,
  onDelete,
  onNavigateToNote,
  tree,
}: CharacterDetailProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isBasicInfoEditing, setIsBasicInfoEditing] = useState(false);
  const [isCardEditing, setIsCardEditing] = useState(false);
  const [isArtifactEditing, setIsArtifactEditing] = useState(false);
  const [isRelationshipEditing, setIsRelationshipEditing] = useState(false);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 获取人物详情
  const { data: character, isLoading } = useQuery({
    queryKey: ['character', projectId, characterId],
    queryFn: () => characterApi.getCharacter(projectId, characterId),
    enabled: !!projectId && !!characterId,
  });

  // 获取可用人物列表（用于关系选择）
  const { data: availableCharacters = [] } = useQuery({
    queryKey: ['characters-simple', projectId],
    queryFn: () => characterApi.getCharactersSimple(projectId, characterId),
    enabled: !!projectId && !!characterId,
  });

  // 更新人物
  const updateCharacterMutation = useMutation({
    mutationFn: (data: Parameters<typeof characterApi.updateCharacter>[2]) =>
      characterApi.updateCharacter(projectId, characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  // 上传图片
  const uploadImageMutation = useMutation({
    mutationFn: async ({ type, file }: { type: 'avatar' | 'full_image'; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<{ url: string }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { type, url: response.url };
    },
    onSuccess: (data) => {
      updateCharacterMutation.mutate({
        [data.type === 'avatar' ? 'avatar' : 'full_image']: data.url,
      });
    },
  });

  // 删除人物
  const deleteCharacterMutation = useMutation({
    mutationFn: () => characterApi.deleteCharacter(projectId, characterId),
    onSuccess: () => {
      onDelete?.(characterId);
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  // 别名操作
  const createAliasMutation = useMutation({
    mutationFn: (data: { alias_type: AliasType; content: string }) =>
      characterApi.createAlias(projectId, characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  const updateAliasMutation = useMutation({
    mutationFn: ({ aliasId, data }: { aliasId: string; data: { alias_type?: AliasType; content?: string } }) =>
      characterApi.updateAlias(projectId, characterId, aliasId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: (aliasId: string) => characterApi.deleteAlias(projectId, characterId, aliasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  // 卡片操作
  const createCardMutation = useMutation({
    mutationFn: (data: { title: string; icon?: string; content?: CardContentItem[] }) =>
      characterApi.createCard(projectId, characterId, data),
    onSuccess: (newCard) => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      // 标记新创建的卡片，让它自动进入编辑模式
      setNewCardId(newCard.id);
      // 3秒后清除标记
      setTimeout(() => setNewCardId(null), 3000);
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: { title?: string; icon?: string; content?: CardContentItem[]; order_index?: number } }) =>
      characterApi.updateCard(projectId, characterId, cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => characterApi.deleteCard(projectId, characterId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  // 关系操作
  const createRelationshipMutation = useMutation({
    mutationFn: (data: {
      target_character_id?: string;
      target_name?: string;
      relation_type: RelationType;
      description?: string;
      strength?: number;
      is_bidirectional?: boolean;
      reverse_description?: string;
    }) => characterApi.createRelationship(projectId, characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const updateRelationshipMutation = useMutation({
    mutationFn: ({ relationshipId, data }: { relationshipId: string; data: {
      relation_type?: RelationType;
      description?: string;
      strength?: number;
      is_bidirectional?: boolean;
      reverse_description?: string;
    } }) => characterApi.updateRelationship(projectId, characterId, relationshipId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: string) =>
      characterApi.deleteRelationship(projectId, characterId, relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  // 器物操作
  const createArtifactMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; artifact_type?: ArtifactType; image?: string }) =>
      characterApi.createArtifact(projectId, characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const updateArtifactMutation = useMutation({
    mutationFn: ({ artifactId, data }: { artifactId: string; data: { image?: string } }) =>
      characterApi.updateArtifact(projectId, characterId, artifactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const deleteArtifactMutation = useMutation({
    mutationFn: (artifactId: string) => characterApi.deleteArtifact(projectId, characterId, artifactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  // 处理删除人物
  const handleDelete = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    deleteCharacterMutation.mutate();
    setShowDeleteModal(false);
  }, [deleteCharacterMutation]);

  // 处理保存人物信息
  const handleSaveCharacter = useCallback(
    (data: {
      name: string;
      gender: CharacterGender;
      birth_date: string;
      birthplace: string;
      level: CharacterLevel;
      quote: string;
      first_appearance_volume: string;
      first_appearance_act: string;
      first_appearance_chapter: string;
    }) => {
      updateCharacterMutation.mutate(data);
      setIsEditing(false);
    },
    [updateCharacterMutation]
  );

  // 处理图片上传
  const handleImageUpload = useCallback(
    (type: 'avatar' | 'full_image', file: File) => {
      uploadImageMutation.mutate({ type, file });
    },
    [uploadImageMutation]
  );

  // 获取别名显示
  const aliasDisplay = useMemo(() => {
    if (!character) return '';
    const parts: string[] = [];
    const zi = character.aliases?.find((a) => a.alias_type === 'zi');
    const hao = character.aliases?.find((a) => a.alias_type === 'hao');
    if (zi) parts.push(`字${zi.content}`);
    if (hao) parts.push(`号${hao.content}`);
    return parts.join(' · ');
  }, [character]);

  // 获取称号显示
  const titleDisplay = useMemo(() => {
    if (!character) return [];
    const titles: string[] = [];
    const nickname = character.aliases?.find((a) => a.alias_type === 'nickname');
    const title = character.aliases?.find((a) => a.alias_type === 'title');
    if (nickname) titles.push(`外号：${nickname.content}`);
    if (title) titles.push(`称号：${title.content}`);
    return titles;
  }, [character]);

  // 出场信息
  const appearanceDisplay = useMemo(() => {
    if (!character) return '';
    const parts: string[] = [];
    if (character.first_appearance_volume) parts.push(character.first_appearance_volume);
    if (character.first_appearance_act) parts.push(character.first_appearance_act);
    if (character.first_appearance_chapter) parts.push(character.first_appearance_chapter);
    return parts.length > 0 ? parts.join('·') : '';
  }, [character]);

  // 根据出场信息查找对应的章节ID
  const findNoteIdByAppearance = useCallback((): string | null => {
    if (!tree || !character) return null;

    const findNote = (nodes: TreeNodeType[]): string | null => {
      for (const node of nodes) {
        if (node.type === 'note') {
          const note = node as NoteNode;
          // 检查章节标题是否匹配出场信息中的章
          if (character.first_appearance_chapter && note.title.includes(character.first_appearance_chapter)) {
            return note.id;
          }
        }
        if ('children' in node && node.children) {
          const found = findNote(node.children as TreeNodeType[]);
          if (found) return found;
        }
      }
      return null;
    };

    return findNote(tree);
  }, [tree, character]);

  // 处理跳转到出场章节
  const handleNavigateToAppearance = useCallback(() => {
    const noteId = findNoteIdByAppearance();
    if (noteId && onNavigateToNote) {
      onNavigateToNote(noteId);
    } else {
      alert('未找到对应的章节，请检查出场信息设置');
    }
  }, [findNoteIdByAppearance, onNavigateToNote]);

  if (isLoading) {
    return <CharacterDetailSkeleton level="support" />;
  }

  if (!character) {
    return <EmptyState type="no-selection" />;
  }

  const levelColor = CharacterLevelColors[character.level as CharacterLevel];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部工具栏 */}
      <div className="h-14 border-b border-border/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setIsBasicInfoEditing(false);
                  setIsCardEditing(false);
                  setIsArtifactEditing(false);
                  setIsRelationshipEditing(false);
                }}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
              >
                完成
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              编辑
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        </div>
      </div>

      {/* 基础信息编辑弹窗 */}
      {isEditing && isBasicInfoEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card rounded-xl shadow-2xl border border-border/60 m-4">
            <div className="p-6 border-b border-border/60 flex items-center justify-between sticky top-0 bg-card z-10">
              <h2 className="text-lg font-semibold">编辑基础信息</h2>
              <button
                onClick={() => setIsBasicInfoEditing(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <CharacterEditForm
                character={character}
                onSave={(data) => {
                  handleSaveCharacter(data);
                  setIsBasicInfoEditing(false);
                }}
                onCancel={() => setIsBasicInfoEditing(false)}
                onImageUpload={handleImageUpload}
                tree={tree}
              />
            </div>
          </div>
        </div>
      )}

      {/* 可滚动内容区 */}
      <div className={`flex-1 overflow-y-auto ${isEditing && isBasicInfoEditing ? 'hidden' : ''}`}>
        {/* 头部区域 */}
        <div className="p-6 border-b border-border/60">
          <div className="flex gap-6">
            {/* 人物图片 */}
            <div
              className="flex-shrink-0 w-[180px] h-[220px] rounded-xl overflow-hidden bg-gradient-to-br from-accent/20 to-primary/20 border-2 flex items-center justify-center relative"
              style={{ borderColor: levelColor.bar }}
            >
              {character.full_image ? (
                <img
                  src={character.full_image}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                  <User className="h-16 w-16" />
                  <span className="text-xs">暂无图片</span>
                </div>
              )}
              
              {/* 编辑基础信息按钮 - 仅在编辑模式显示，位于图片内右下角 */}
              {isEditing && !isBasicInfoEditing && (
                <button
                  onClick={() => setIsBasicInfoEditing(true)}
                  className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-background/90 hover:bg-background text-foreground rounded-md shadow-sm border border-border/60 transition-colors"
                >
                  编辑基础信息
                </button>
              )}
            </div>

            {/* 基本信息 */}
            <div className="flex-1 space-y-3">
              {/* 姓名 */}
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">{character.name}</h1>
                {aliasDisplay && (
                  <p className="text-base text-primary mt-1">{aliasDisplay}</p>
                )}
              </div>

              {/* 别名编辑器 - 仅在编辑模式显示 */}
              {isEditing && (
                <div className="pt-1">
                  <AliasEditor
                    aliases={character.aliases || []}
                    onAdd={(data) => createAliasMutation.mutate(data)}
                    onUpdate={(id, data) => updateAliasMutation.mutate({ aliasId: id, data })}
                    onDelete={(id) => deleteAliasMutation.mutate(id)}
                    isEditable={true}
                  />
                </div>
              )}

              {/* 称号 */}
              {titleDisplay.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {titleDisplay.map((title, idx) => (
                    <span key={idx} className="text-sm text-muted-foreground">
                      {title}
                    </span>
                  ))}
                </div>
              )}

              {/* 分隔线 */}
              <div className="w-full h-px bg-border/60" />

              {/* 基础信息 */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {CharacterGenderLabels[character.gender]}
                </span>
                {character.birth_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {character.birth_date}
                  </span>
                )}
                {character.birthplace && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {character.birthplace}
                  </span>
                )}
              </div>

              {/* 出场信息 */}
              {appearanceDisplay && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-accent">{appearanceDisplay}</span>
                  <span className="text-muted-foreground">首次出场</span>
                  {onNavigateToNote && tree && (
                    <button
                      onClick={handleNavigateToAppearance}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      跳转
                    </button>
                  )}
                </div>
              )}

              {/* 判词 */}
              {character.quote && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Quote className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="text-base italic">&ldquo;{character.quote}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 小卡片区域 */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">详细信息</h3>
            {/* 编辑卡片按钮 - 仅在编辑模式显示 */}
            {isEditing && (
              <div className="flex items-center gap-2">
                {isCardEditing && (
                  <button
                    onClick={() =>
                      createCardMutation.mutate({
                        title: '新卡片',
                        icon: '📝',
                        content: [],
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    添加卡片
                  </button>
                )}
                <button
                  onClick={() => setIsCardEditing(!isCardEditing)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    isCardEditing
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Edit2 className="h-4 w-4" />
                  {isCardEditing ? '完成编辑' : '编辑卡片'}
                </button>
              </div>
            )}
          </div>

          {/* 卡片网格 */}
          <div className="grid grid-cols-2 gap-4">
            {character.cards?.map((card, index) => (
              <InfoCard
                key={card.id}
                card={card}
                onUpdate={(id, data) => updateCardMutation.mutate({ cardId: id, data })}
                onDelete={(id) => deleteCardMutation.mutate(id)}
                isEditable={isCardEditing}
                autoEdit={newCardId === card.id}
                isFirst={index === 0}
                isLast={index === (character.cards?.length || 0) - 1}
                onMoveUp={() => {
                  if (index > 0) {
                    const cards = [...(character.cards || [])];
                    const temp = cards[index];
                    cards[index] = cards[index - 1];
                    cards[index - 1] = temp;
                    // 更新所有卡片的顺序
                    cards.forEach((c, i) => {
                      updateCardMutation.mutate({ cardId: c.id, data: { order_index: i } });
                    });
                  }
                }}
                onMoveDown={() => {
                  if (index < (character.cards?.length || 0) - 1) {
                    const cards = [...(character.cards || [])];
                    const temp = cards[index];
                    cards[index] = cards[index + 1];
                    cards[index + 1] = temp;
                    // 更新所有卡片的顺序
                    cards.forEach((c, i) => {
                      updateCardMutation.mutate({ cardId: c.id, data: { order_index: i } });
                    });
                  }
                }}
              />
            ))}
          </div>

          {(!character.cards || character.cards.length === 0) && (
            <div className="text-center py-8 text-muted-foreground/60">
              暂无详细信息卡片
            </div>
          )}
        </div>

        {/* 器物和关系并排区域 */}
        <div className="p-6 border-t border-border/60">
          <div className="grid grid-cols-2 gap-6">
            {/* 器物区域 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">器物</h3>
                {/* 编辑器物按钮 - 仅在编辑模式显示 */}
                {isEditing && (
                  <button
                    onClick={() => setIsArtifactEditing(!isArtifactEditing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      isArtifactEditing
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                    }`}
                  >
                    <Edit2 className="h-4 w-4" />
                    {isArtifactEditing ? '完成' : '编辑'}
                  </button>
                )}
              </div>
              <ArtifactList
                artifacts={character.artifacts || []}
                onAdd={(data) => createArtifactMutation.mutate(data)}
                onUpdate={(id, data) => updateArtifactMutation.mutate({ artifactId: id, data })}
                onDelete={(id) => deleteArtifactMutation.mutate(id)}
                isEditable={isArtifactEditing}
              />
            </div>

            {/* 关系区域 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">人物关系</h3>
                {/* 编辑关系按钮 - 仅在编辑模式显示 */}
                {isEditing && (
                  <button
                    onClick={() => setIsRelationshipEditing(!isRelationshipEditing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      isRelationshipEditing
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                    }`}
                  >
                    <Edit2 className="h-4 w-4" />
                    {isRelationshipEditing ? '完成' : '编辑'}
                  </button>
                )}
              </div>
              <RelationshipList
                relationships={character.relationships || []}
                availableCharacters={availableCharacters}
                onAdd={(data) => createRelationshipMutation.mutate(data)}
                onUpdate={(id, data) => updateRelationshipMutation.mutate({ relationshipId: id, data })}
                onDelete={(id) => deleteRelationshipMutation.mutate(id)}
                isEditable={isRelationshipEditing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="删除人物"
        message={`确定要删除人物 "${character?.name || ''}" 吗？此操作将同时删除该人物的所有信息（别名、卡片、关系、器物），且不可恢复。`}
        confirmText="确认删除"
        isLoading={deleteCharacterMutation.isPending}
      />
    </div>
  );
};

export default CharacterDetail;
