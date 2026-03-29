import { useMemo } from 'react';
import type { CharacterListItem, CharacterLevel } from '@/types/character';
import {
  CharacterLevelColors,
  CharacterLevelSizes,
  CharacterGenderLabels,
} from '@/types/character';
import { User } from 'lucide-react';

interface AppearanceMatch {
  volume: string;
  act: string;
  chapter: string;
}

interface CharacterBarCardProps {
  character: CharacterListItem;
  isSelected: boolean;
  onClick: () => void;
  appearance?: {
    first: AppearanceMatch | null;
    last: AppearanceMatch | null;
  };
}

/**
 * 条形人物卡片组件
 *
 * 根据角色等级显示不同尺寸和样式的卡片
 */
export const CharacterBarCard = ({ character, isSelected, onClick, appearance }: CharacterBarCardProps) => {
  const level = character.level as CharacterLevel;
  const colors = CharacterLevelColors[level];
  const sizes = CharacterLevelSizes[level];

  const aliasDisplay = useMemo(() => {
    const parts: string[] = [];

    const zi = character.aliases?.find((a) => a.alias_type === 'zi');
    if (zi) parts.push(`字${zi.content}`);

    const hao = character.aliases?.find((a) => a.alias_type === 'hao');
    if (hao) parts.push(`号${hao.content}`);

    return parts.join(' · ');
  }, [character.aliases]);

  const titleDisplay = useMemo(() => {
    const titles: string[] = [];

    const nickname = character.aliases?.find((a) => a.alias_type === 'nickname');
    if (nickname) titles.push(`${nickname.content}`);

    const title = character.aliases?.find((a) => a.alias_type === 'title');
    if (title) titles.push(`${title.content}`);

    return titles;
  }, [character.aliases]);

  const appearanceDisplay = useMemo(() => {
    if (appearance?.first) {
      const { chapter } = appearance.first;
      return `出场于 ${chapter}`;
    }
    
    if (character.first_appearance_chapter) {
      return `出场于 ${character.first_appearance_chapter}`;
    }
    return '';
  }, [character, appearance]);

  const lastAppearanceDisplay = useMemo(() => {
    if (appearance?.last) {
      const { chapter } = appearance.last;
      if (appearance?.first && 
          appearance.first.volume === appearance.last.volume &&
          appearance.first.act === appearance.last.act &&
          appearance.first.chapter === appearance.last.chapter) {
        return '';
      }
      return `退场于 ${chapter}`;
    }
    
    if (character.last_appearance_chapter) {
      if (character.first_appearance_chapter === character.last_appearance_chapter) {
        return '';
      }
      return `退场于 ${character.last_appearance_chapter}`;
    }
    return '';
  }, [character, appearance]);

  const showDetails = level === 'protagonist' || level === 'major_support';

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full cursor-pointer rounded-lg overflow-hidden
        transition-all duration-200 ease-out
        ${isSelected ? 'ring-2 ring-primary/50 bg-accent/10' : 'hover:shadow-md hover:bg-accent/5'}
      `}
      style={{
        height: `${sizes.height}px`,
        backgroundColor: isSelected ? undefined : colors.bg,
        boxShadow: isSelected ? undefined : '0 1px 4px hsl(30 20% 20% / 0.06)',
      }}
    >
      {/* 左侧等级条 */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: `${colors.barWidth}px`,
          backgroundColor: colors.bar,
        }}
      />

      {/* 内容区域 */}
      <div
        className="flex items-center h-full gap-3"
        style={{ padding: `${sizes.padding}px`, paddingLeft: `${sizes.padding + colors.barWidth}px` }}
      >
        {/* 头像 */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
          style={{
            width: `${sizes.avatar}px`,
            height: `${sizes.avatar}px`,
          }}
        >
          {character.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="text-muted-foreground/30" style={{ width: sizes.avatar * 0.5, height: sizes.avatar * 0.5 }} />
          )}
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* 姓名行 */}
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-foreground truncate" style={{ fontSize: '16px' }}>
              {character.name}
            </span>
            {aliasDisplay && (
              <span className="text-xs text-foreground truncate">·{aliasDisplay}</span>
            )}
          </div>

          {/* 称号/外号行 - 仅主角和重要配角显示 */}
          {showDetails && titleDisplay.length > 0 && (
            <div className="flex items-center gap-2 mt-0.5">
              {titleDisplay.map((title, idx) => (
                <span key={idx} className="text-xs text-muted-foreground italic truncate">
                  {title}
                </span>
              ))}
            </div>
          )}

          {/* 分隔线 - 仅主角和重要配角显示 */}
          {showDetails && (titleDisplay.length > 0 || character.birth_date) && (
            <div className="w-full h-px bg-border/50 my-1" />
          )}

          {/* 基础信息行 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{CharacterGenderLabels[character.gender]}</span>
            {character.birth_date && (
              <>
                <span>|</span>
                <span className="truncate">{character.birth_date}</span>
              </>
            )}
          </div>

          {/* 出场信息 */}
          {appearanceDisplay && (
            <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
              {appearanceDisplay}
            </div>
          )}

          {/* 最后出场信息 */}
          {lastAppearanceDisplay && (
            <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
              {lastAppearanceDisplay}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterBarCard;
