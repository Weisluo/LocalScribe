import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { User, UserCircle } from 'lucide-react';
import type { Character, CharacterLevel, CharacterGender } from '@/types/character';
import { CharacterLevelLabels, CharacterLevelColors, CharacterGenderLabels } from '@/types/character';
import { ImageUploadProgress } from './ImageUploadProgress';
import type { TreeNodeType } from '@/types';
import type { ProjectOutline } from '@/components/Outline/types';
import { api } from '@/utils/request';

interface CharacterEditFormProps {
  character: Character;
  projectId: string;
  onSave: (data: {
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
  }) => void;
  onCancel: () => void;
  onImageUpload?: (type: 'avatar' | 'full_image', file: File) => void;
  tree?: TreeNodeType[];
}

const levelOptions: CharacterLevel[] = ['protagonist', 'major_support', 'support', 'minor'];
const genderOptions: CharacterGender[] = ['male', 'female', 'other', 'unknown'];

interface AppearanceMatch {
  volume: string;
  act: string;
  chapter: string;
  noteId: string;
}

export const CharacterEditForm = ({
  character,
  projectId,
  onSave,
  onCancel,
  onImageUpload,
  tree,
}: CharacterEditFormProps) => {
  const [imageType, setImageType] = useState<'full_image' | 'avatar'>('full_image');
  const [formData, setFormData] = useState({
    name: character.name,
    gender: character.gender,
    birth_date: character.birth_date || '',
    birthplace: character.birthplace || '',
    race: character.race || '',
    faction: character.faction || '',
    level: character.level,
    quote: character.quote || '',
    first_appearance_volume: character.first_appearance_volume || '',
    first_appearance_act: character.first_appearance_act || '',
    first_appearance_chapter: character.first_appearance_chapter || '',
    last_appearance_volume: character.last_appearance_volume || '',
    last_appearance_act: character.last_appearance_act || '',
    last_appearance_chapter: character.last_appearance_chapter || '',
  });

  const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(formData);
  }, [formData, onSave]);

  const handleImageChange = useCallback(
    async (type: 'avatar' | 'full_image', file: File) => {
      await onImageUpload?.(type, file);
    },
    [onImageUpload]
  );

  const levelColor = CharacterLevelColors[formData.level];

  const { data: outline } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => api.get<ProjectOutline>(`/outline/projects/${projectId}/outline`),
    enabled: !!projectId,
  });

  const appearanceMatches = useMemo((): { first: AppearanceMatch | null; last: AppearanceMatch | null } => {
    if (!outline?.volumes || !tree) {
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
  }, [outline, tree, character.name, character.aliases]);

  useEffect(() => {
    if (appearanceMatches.first) {
      setFormData(prev => ({
        ...prev,
        first_appearance_volume: appearanceMatches.first!.volume,
        first_appearance_act: appearanceMatches.first!.act,
        first_appearance_chapter: appearanceMatches.first!.chapter,
      }));
    }
    if (appearanceMatches.last) {
      setFormData(prev => ({
        ...prev,
        last_appearance_volume: appearanceMatches.last!.volume,
        last_appearance_act: appearanceMatches.last!.act,
        last_appearance_chapter: appearanceMatches.last!.chapter,
      }));
    }
  }, [appearanceMatches]);

  return (
    <div className="space-y-5">
      <div className="flex gap-8 items-stretch">
        <div className="flex flex-col gap-4 items-center flex-shrink-0">
          <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
            <button
              onClick={() => setImageType('full_image')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                imageType === 'full_image'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <User className="w-4 h-4" />
              全身形象
            </button>
            <button
              onClick={() => setImageType('avatar')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                imageType === 'avatar'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <UserCircle className="w-4 h-4" />
              人物头像
            </button>
          </div>
          
          <AnimatePresence mode="wait">
            {imageType === 'full_image' ? (
              <motion.div
                key="full_image"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex-1"
              >
                <ImageUploadProgress
                  type="full_image"
                  currentImage={character.full_image}
                  onUpload={handleImageChange}
                  label="人物全身形象"
                  size={{ width: 260, height: 350 }}
                  levelColor={levelColor.bar}
                />
              </motion.div>
            ) : (
              <motion.div
                key="avatar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1"
              >
                <ImageUploadProgress
                  type="avatar"
                  currentImage={character.avatar}
                  onUpload={handleImageChange}
                  label="人物头像"
                  size={{ width: 260, height: 260 }}
                  levelColor={levelColor.bar}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-card/50 rounded-xl p-4 border border-border/40">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              基本信息
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-32">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    角色等级
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => handleChange('level', e.target.value as CharacterLevel)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {CharacterLevelLabels[level]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    姓名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    性别
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value as CharacterGender)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  >
                    {genderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {CharacterGenderLabels[gender]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    种族
                  </label>
                  <input
                    type="text"
                    value={formData.race}
                    onChange={(e) => handleChange('race', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    阵营归属
                  </label>
                  <input
                    type="text"
                    value={formData.faction}
                    onChange={(e) => handleChange('faction', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    生辰
                  </label>
                  <input
                    type="text"
                    value={formData.birth_date}
                    onChange={(e) => handleChange('birth_date', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    出生地
                  </label>
                  <input
                    type="text"
                    value={formData.birthplace}
                    onChange={(e) => handleChange('birthplace', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/50 rounded-xl p-4 border border-border/40 flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              判词/引言
            </h3>
            <textarea
              value={formData.quote}
              onChange={(e) => handleChange('quote', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
              placeholder="为这个角色写一段判词或引言..."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors shadow-sm"
        >
          保存修改
        </button>
      </div>
    </div>
  );
};

export default CharacterEditForm;
