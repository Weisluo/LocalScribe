import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit2,
  Trash2,
  User,
  MapPin,
  Calendar,
  Plus,
  ExternalLink,
  X,
  Settings,
  ArrowRightLeft,
} from 'lucide-react';
import { characterApi } from '@/services/characterApi';
import { api } from '@/utils/request';
import { AliasEditor } from './AliasEditor';
import { InfoCard } from './InfoCard';
import { RelationshipList } from './RelationshipList';
import { ArtifactList } from './ArtifactList';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CharacterEditForm } from './CharacterEditForm';
import { EmptyState } from './EmptyState';
import type {
  CharacterLevel,
  CharacterGender,
  AliasType,
  RelationType,
  ArtifactRarity,
  CardContentItem,
} from '@/types/character';
import type { TreeNodeType } from '@/types';
import {
  CharacterLevelColors,
  CharacterGenderLabels,
  CharacterLevelLabels,
} from '@/types/character';
import type { ProjectOutline } from '@/components/Outline/types';

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
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertLevel, setConvertLevel] = useState<CharacterLevel>('minor');

  // 获取人物详情
  const { data: character, isLoading } = useQuery({
    queryKey: ['character', projectId, characterId],
    queryFn: () => characterApi.getCharacter(projectId, characterId),
    enabled: !!projectId && !!characterId,
  });

  // 获取大纲数据
  const { data: outline } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => api.get<ProjectOutline>(`/outline/projects/${projectId}/outline`),
    enabled: !!projectId,
  });

  // 获取可用人物列表（用于关系选择）
  const { data: availableCharacters = [], isLoading: isLoadingCharacters } = useQuery({
    queryKey: ['characters-simple', projectId, characterId],
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
      const response = await api.post<{ url: string }>('/upload/images', formData, {
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

  // 转换历史人物为主线人物
  const convertCharacterMutation = useMutation({
    mutationFn: () =>
      characterApi.updateCharacter(projectId, characterId, {
        source: null,
        level: convertLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      setShowConvertModal(false);
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
    mutationFn: (data: { name: string; quote?: string; description?: string; artifact_type?: string; rarity?: ArtifactRarity }) =>
      characterApi.createArtifact(projectId, characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    },
  });

  const updateArtifactMutation = useMutation({
    mutationFn: ({ artifactId, data }: { artifactId: string; data: { name?: string; quote?: string; description?: string; artifact_type?: string; rarity?: ArtifactRarity } }) =>
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
      race: string;
      faction: string;
      level: CharacterLevel;
      quote: string;
      first_appearance_volume: string;
      first_appearance_act: string;
      first_appearance_chapter: string;
      last_appearance_volume: string;
      last_appearance_act: string;
      last_appearance_chapter: string;
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

  interface AppearanceMatch {
    volume: string;
    act: string;
    chapter: string;
    noteId: string;
  }

  const appearanceMatches = useMemo((): { first: AppearanceMatch | null; last: AppearanceMatch | null } => {
    if (!outline?.volumes || !tree || !character) {
      return { first: null, last: null };
    }

    const characterName = character.name.toLowerCase();
    const aliases = character.aliases?.map(a => a.content.toLowerCase()) || [];
    const searchTerms = [characterName, ...aliases];

    const matches: AppearanceMatch[] = [];

    const searchInText = (text: string): boolean => {
      if (!text) return false;
      const lowerText = text.toLowerCase();
      return searchTerms.some(term => lowerText.includes(term));
    };

    const findNoteId = (volumeName: string, actName: string, chapterTitle: string): string | null => {
      const volume = tree.find(n => n.type === 'volume' && n.name === volumeName);
      if (!volume || !('children' in volume)) return null;
      
      const act = volume.children.find(c => c.type === 'act' && c.name === actName);
      if (!act || !('children' in act)) return null;
      
      const note = act.children.find(n => n.type === 'note' && n.title === chapterTitle);
      return note?.id || null;
    };

    outline.volumes.forEach(volume => {
      volume.acts.forEach(act => {
        act.chapters.forEach(chapter => {
          if (chapter.outline_content && searchInText(chapter.outline_content)) {
            const noteId = findNoteId(volume.name, act.name, chapter.title);
            if (noteId) {
              matches.push({
                volume: volume.name,
                act: act.name,
                chapter: chapter.title,
                noteId,
              });
            }
          }
        });
      });
    });

    if (matches.length === 0) {
      return { first: null, last: null };
    }

    return {
      first: matches[0],
      last: matches[matches.length - 1],
    };
  }, [outline, tree, character]);

  // 出场信息
  const appearanceDisplay = useMemo(() => {
    if (!character) return '';
    
    if (appearanceMatches.first) {
      const { volume, act, chapter } = appearanceMatches.first;
      return `${volume}·${act}·${chapter}`;
    }
    
    const parts: string[] = [];
    if (character.first_appearance_volume) parts.push(character.first_appearance_volume);
    if (character.first_appearance_act) parts.push(character.first_appearance_act);
    if (character.first_appearance_chapter) parts.push(character.first_appearance_chapter);
    return parts.length > 0 ? parts.join('·') : '';
  }, [character, appearanceMatches]);

  // 最后出场信息
  const lastAppearanceDisplay = useMemo(() => {
    if (!character) return '';
    
    if (appearanceMatches.last) {
      const { volume, act, chapter } = appearanceMatches.last;
      if (appearanceMatches.first && 
          appearanceMatches.first.volume === appearanceMatches.last.volume &&
          appearanceMatches.first.act === appearanceMatches.last.act &&
          appearanceMatches.first.chapter === appearanceMatches.last.chapter) {
        return '';
      }
      return `${volume}·${act}·${chapter}`;
    }
    
    const parts: string[] = [];
    if (character.last_appearance_volume) parts.push(character.last_appearance_volume);
    if (character.last_appearance_act) parts.push(character.last_appearance_act);
    if (character.last_appearance_chapter) parts.push(character.last_appearance_chapter);
    return parts.length > 0 ? parts.join('·') : '';
  }, [character, appearanceMatches]);

  if (isLoading) {
    return <EmptyState type="loading" />;
  }

  if (!character) {
    return <EmptyState type="no-selection" />;
  }

  const levelColor = CharacterLevelColors[character.level as CharacterLevel];

  return (
    <div className="flex flex-col h-full bg-background">
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
                projectId={projectId}
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
        <div 
          className="pt-12 px-6 pb-6 border-b border-border/60"
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
        >
          <div className="flex gap-8">
            {/* 人物图片 - 放大尺寸 */}
            <div
              className="flex-shrink-0 w-[280px] h-[360px] rounded-xl overflow-hidden border-2 flex items-center justify-center relative group"
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
                <div className="flex flex-col items-center gap-3 text-muted-foreground/30">
                  <User className="h-24 w-24" />
                  <span className="text-sm">暂无图片</span>
                </div>
              )}
              
              {/* 编辑基础信息按钮 - 仅在编辑模式显示，位于图片内右下角 */}
              {isEditing && !isBasicInfoEditing && (
                <button
                  onClick={() => setIsBasicInfoEditing(true)}
                  className="absolute bottom-3 right-3 px-3 py-1.5 text-sm bg-background/90 hover:bg-background text-foreground rounded-md shadow-sm border border-border/60 transition-colors"
                >
                  编辑基础信息
                </button>
              )}
            </div>

            {/* 基本信息 */}
            <div className="flex-1 min-h-[360px] flex flex-col justify-between">
              <div className="space-y-4">
              {/* 姓名行 - 包含编辑和删除按钮 */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* 第一行：姓名 + 别名 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl font-serif font-bold text-foreground">{character.name}</h1>
                      {!isEditing && aliasDisplay && (
                        <span className="text-[15px] text-foreground">{aliasDisplay}</span>
                      )}
                      {isEditing && (
                        <div className="flex items-center gap-2">
                          <AliasEditor
                            aliases={character.aliases || []}
                            onAdd={(data) => createAliasMutation.mutate(data)}
                            onUpdate={(id, data) => updateAliasMutation.mutate({ aliasId: id, data })}
                            onDelete={(id) => deleteAliasMutation.mutate(id)}
                            isEditable={true}
                            compact={true}
                          />
                        </div>
                      )}
                    </div>
                    {/* 第二行：历史标签 + 转主线按钮 */}
                    {character.source === 'history' && (
                      <div className="flex items-center gap-2">
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs px-2 py-0.5 rounded bg-amber-100/80 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-medium"
                        >
                          历史
                        </motion.span>
                        {!isEditing && (
                          <button
                            onClick={() => setShowConvertModal(true)}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 rounded transition-colors border border-amber-200/60 dark:border-amber-800/60"
                            title="转换为主线故事人物"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            转主线
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 编辑和删除按钮 - 编辑状态始终显示，非编辑状态悬浮时显示 */}
                <div
                  className={`flex items-center gap-2 transition-all duration-200 ${
                    isEditing || isHeaderHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
                  }`}
                >
                  {isEditing ? (
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setIsBasicInfoEditing(false);
                        setIsCardEditing(false);
                        setIsArtifactEditing(false);
                        setIsRelationshipEditing(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      完成
                    </button>
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

              {/* 称号 */}
              {titleDisplay.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {titleDisplay.map((title, idx) => (
                    <span key={idx} className="text-sm text-muted-foreground px-2 py-0.5 bg-accent/10 rounded">
                      {title}
                    </span>
                  ))}
                </div>
              )}

              {/* 分隔线 */}
              <div className="w-full h-px bg-border/60" />

              {/* 基础信息 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {CharacterGenderLabels[character.gender]}
                </span>
                {character.race && (
                  <span className="flex items-center gap-1.5">
                    种族：{character.race}
                  </span>
                )}
                {character.birth_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {character.birth_date}
                  </span>
                )}
                {character.faction && (
                  <span className="flex items-center gap-1.5">
                    阵营：{character.faction}
                  </span>
                )}
                {character.birthplace && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {character.birthplace}
                  </span>
                )}
              </div>

              {/* 出场信息 */}
              {(appearanceDisplay || lastAppearanceDisplay) && (
                <div className="space-y-2">
                  {appearanceDisplay && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-accent font-medium">{appearanceDisplay}</span>
                      <span className="text-muted-foreground">首次出场</span>
                      {onNavigateToNote && tree && appearanceMatches.first && (
                        <button
                          onClick={() => {
                            if (onNavigateToNote && appearanceMatches.first) {
                              onNavigateToNote(appearanceMatches.first.noteId);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          跳转
                        </button>
                      )}
                    </div>
                  )}
                  {lastAppearanceDisplay && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-accent font-medium">{lastAppearanceDisplay}</span>
                      <span className="text-muted-foreground">最后出场</span>
                      {onNavigateToNote && tree && appearanceMatches.last && (
                        <button
                          onClick={() => {
                            if (onNavigateToNote && appearanceMatches.last) {
                              onNavigateToNote(appearanceMatches.last.noteId);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          跳转
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* 判词 - 古朴纸张风格 */}
              {character.quote && (
                <div className="mt-6 flex-1 flex items-center justify-center p-6 relative overflow-hidden rounded-lg">
                  {/* 纸张纹理背景 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-orange-50/60 to-yellow-50/70 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/35" />
                  {/* 边框装饰 */}
                  <div className="absolute inset-0 border-2 border-amber-900/10 dark:border-amber-100/10 rounded-lg" />
                  {/* 角落装饰 */}
                  <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-amber-900/20 dark:border-amber-100/20" />
                  <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-amber-900/20 dark:border-amber-100/20" />
                  <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-amber-900/20 dark:border-amber-100/20" />
                  <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-amber-900/20 dark:border-amber-100/20" />
                  {/* 判词内容 */}
                  <p className="relative z-10 text-base font-serif text-amber-900/80 dark:text-amber-100/80 leading-relaxed text-center tracking-wide">
                    {character.quote}
                  </p>
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
                isLoadingCharacters={isLoadingCharacters}
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

      {/* 转换历史人物确认弹窗 */}
      <AnimatePresence>
        {showConvertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowConvertModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-xl shadow-2xl border border-border/60 m-4 p-6"
            >
              <h3 className="text-lg font-semibold mb-2">转换为主线故事人物</h3>
              <p className="text-sm text-muted-foreground mb-4">
                确定要将 "{character?.name}" 从「历史背景人物」转换为「主线故事人物」吗？
              </p>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mb-6 space-y-3">
                <p className="text-xs text-muted-foreground">
                  转换后，该人物将成为主线故事的一部分。请选择转换后的角色等级：
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['protagonist', 'major_support', 'support', 'minor'] as CharacterLevel[]).map((level) => {
                    const colors = CharacterLevelColors[level];
                    const isSelected = convertLevel === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setConvertLevel(level)}
                        className="px-3 py-2 text-xs rounded-lg border transition-all text-left"
                        style={{
                          borderColor: isSelected ? colors.bar : colors.border,
                          backgroundColor: isSelected ? colors.bar : colors.bg,
                          color: isSelected ? 'white' : 'inherit',
                        }}
                      >
                        <span className="font-medium">{CharacterLevelLabels[level]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground/70">
                  此操作可以随时撤销（通过编辑人物重新设为历史背景）。
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => convertCharacterMutation.mutate()}
                  disabled={convertCharacterMutation.isPending}
                  className="px-4 py-2 text-sm bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {convertCharacterMutation.isPending ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      转换中...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4" />
                      确认转换
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CharacterDetail;
