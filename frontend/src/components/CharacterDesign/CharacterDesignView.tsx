import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CharacterSidebar } from './CharacterSidebar';
import { CharacterDetail } from './CharacterDetail';
import { CharacterCloudView } from './CharacterCloudView';
import { EmptyState } from './EmptyState';
import { api } from '@/utils/request';
import { characterApi } from '@/services/characterApi';
import type { VolumeNode } from '@/types';
import type { CharacterListItem } from '@/types/character';

interface CharacterDesignViewProps {
  projectId: string;
  onClose: () => void;
  onNavigateToNote?: (noteId: string) => void;
}

type ViewMode = 'list' | 'cloud';

/**
 * 人物设定主视图组件
 *
 * 支持两种视图模式：
 * - 列表视图：左右分栏，左侧人物列表，右侧详情编辑
 * - 云图视图：力导向图展示人物关系网络
 */
export const CharacterDesignView = ({ projectId, onNavigateToNote }: CharacterDesignViewProps) => {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const hasInitializedSelection = useRef(false);

  // 获取项目目录树（用于出场章节跳转）
  const { data: tree } = useQuery({
    queryKey: ['directory', projectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${projectId}/tree`),
    enabled: !!projectId,
  });

  // 获取人物列表（用于默认选中主角）
  const { data: characters = [] } = useQuery<CharacterListItem[]>({
    queryKey: ['characters', projectId, null, '', null, null, false],
    queryFn: () =>
      characterApi.getCharacters(projectId, {
        sort_by: 'default',
        sort_order: 'asc',
      }),
    enabled: !!projectId,
  });

  // 默认选中主角（仅初始化时执行一次）
  useEffect(() => {
    if (hasInitializedSelection.current || characters.length === 0) return;

    hasInitializedSelection.current = true;

    // 优先选择主角
    const protagonist = characters.find((c) => c.level === 'protagonist');
    if (protagonist) {
      setSelectedCharacterId(protagonist.id);
    } else {
      // 没有主角则选择第一个角色
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters]);

  // 处理选择人物
  const handleSelectCharacter = useCallback((characterId: string) => {
    setSelectedCharacterId(characterId);
  }, []);

  // 处理删除人物
  const handleDeleteCharacter = useCallback((characterId: string) => {
    if (selectedCharacterId === characterId) {
      setSelectedCharacterId(null);
    }
  }, [selectedCharacterId]);

  // 切换到云图视图时清空选中
  const handleSwitchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'cloud') {
      setSelectedCharacterId(null);
    }
  }, []);

  return (
    <div className="flex h-full bg-background">
      {/* 左侧人物栏 - 25% 宽度 */}
      <div className="w-1/4 min-w-[280px] max-w-[360px] border-r border-border/60 flex flex-col">
        <CharacterSidebar
          projectId={projectId}
          onSelectCharacter={handleSelectCharacter}
          selectedCharacterId={selectedCharacterId}
          viewMode={viewMode}
          onSwitchView={handleSwitchView}
        />
      </div>

      {/* 右侧详情区 - 75% 宽度 */}
      <div className="flex-1 relative">
        {viewMode === 'cloud' ? (
          <CharacterCloudView
            projectId={projectId}
            onSelectCharacter={handleSelectCharacter}
            selectedCharacterId={selectedCharacterId}
          />
        ) : selectedCharacterId ? (
          <CharacterDetail
            projectId={projectId}
            characterId={selectedCharacterId}
            onClose={() => setSelectedCharacterId(null)}
            onDelete={handleDeleteCharacter}
            onNavigateToNote={onNavigateToNote}
            tree={tree}
          />
        ) : (
          <EmptyState type="no-selection" />
        )}
      </div>
    </div>
  );
};

export default CharacterDesignView;
