import { useState, useCallback, useMemo } from 'react';
import { Crown, User, Star, Circle } from 'lucide-react';
import type { Character, CharacterLevel, CharacterGender } from '@/types/character';
import { CharacterLevelLabels, CharacterLevelColors, CharacterGenderLabels } from '@/types/character';
import { ImageUploadProgress } from './ImageUploadProgress';
import type { TreeNodeType, VolumeNode, ActNode, NoteNode } from '@/types';

interface CharacterEditFormProps {
  character: Character;
  onSave: (data: {
    name: string;
    gender: CharacterGender;
    birth_date: string;
    birthplace: string;
    level: CharacterLevel;
    quote: string;
    first_appearance_volume: string;
    first_appearance_act: string;
    first_appearance_chapter: string;
  }) => void;
  onCancel: () => void;
  onImageUpload?: (type: 'avatar' | 'full_image', file: File) => void;
  tree?: TreeNodeType[];
}

const levelOptions: CharacterLevel[] = ['protagonist', 'major_support', 'support', 'minor'];
const genderOptions: CharacterGender[] = ['male', 'female', 'other', 'unknown'];

const levelIcons: Record<CharacterLevel, React.ReactNode> = {
  protagonist: <Crown className="h-4 w-4" />,
  major_support: <Star className="h-4 w-4" />,
  support: <User className="h-4 w-4" />,
  minor: <Circle className="h-4 w-4" />,
};

export const CharacterEditForm = ({
  character,
  onSave,
  onCancel,
  onImageUpload,
  tree,
}: CharacterEditFormProps) => {
  const [formData, setFormData] = useState({
    name: character.name,
    gender: character.gender,
    birth_date: character.birth_date || '',
    birthplace: character.birthplace || '',
    level: character.level,
    quote: character.quote || '',
    first_appearance_volume: character.first_appearance_volume || '',
    first_appearance_act: character.first_appearance_act || '',
    first_appearance_chapter: character.first_appearance_chapter || '',
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

  // 从目录树提取章节选项
  const chapterOptions = useMemo(() => {
    const options: { value: string; label: string; volume?: string; act?: string }[] = [];
    if (!tree) return options;

    const processNode = (node: TreeNodeType, parentVolume?: string, parentAct?: string) => {
      if (node.type === 'volume') {
        const volume = node as VolumeNode;
        if ('children' in volume && volume.children) {
          volume.children.forEach((child) => processNode(child as TreeNodeType, volume.name, undefined));
        }
      } else if (node.type === 'act') {
        const act = node as ActNode;
        if ('children' in act && act.children) {
          act.children.forEach((child) => processNode(child as TreeNodeType, parentVolume, act.name));
        }
      } else if (node.type === 'note') {
        const note = node as NoteNode;
        const parts: string[] = [];
        if (parentVolume) parts.push(parentVolume);
        if (parentAct) parts.push(parentAct);
        parts.push(note.title);
        options.push({
          value: parts.join(' · '),
          label: parts.join(' · '),
          volume: parentVolume,
          act: parentAct,
        });
      }
    };

    tree.forEach((node) => processNode(node));
    return options;
  }, [tree]);

  // 处理首次出场选择
  const handleAppearanceChange = useCallback((value: string) => {
    const selected = chapterOptions.find((opt) => opt.value === value);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        first_appearance_volume: selected.volume || '',
        first_appearance_act: selected.act || '',
        first_appearance_chapter: selected.label.split(' · ').pop() || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        first_appearance_volume: '',
        first_appearance_act: '',
        first_appearance_chapter: '',
      }));
    }
  }, [chapterOptions]);

  // 获取当前选中的首次出场值
  const currentAppearanceValue = useMemo(() => {
    const parts: string[] = [];
    if (formData.first_appearance_volume) parts.push(formData.first_appearance_volume);
    if (formData.first_appearance_act) parts.push(formData.first_appearance_act);
    if (formData.first_appearance_chapter) parts.push(formData.first_appearance_chapter);
    return parts.join(' · ');
  }, [formData.first_appearance_volume, formData.first_appearance_act, formData.first_appearance_chapter]);

  return (
    <div className="space-y-6">
      {/* 顶部区域：图片 + 基础信息 */}
      <div className="flex gap-6">
        {/* 左侧图片 - 占一半 */}
        <div className="flex-1 flex gap-4 justify-center">
          <ImageUploadProgress
            type="full_image"
            currentImage={character.full_image}
            onUpload={handleImageChange}
            label="人物全身形象"
            size={{ width: 160, height: 200 }}
            levelColor={levelColor.bar}
          />
          <ImageUploadProgress
            type="avatar"
            currentImage={character.avatar}
            onUpload={handleImageChange}
            label="人物头像"
            size={{ width: 110, height: 110 }}
            levelColor={levelColor.bar}
          />
        </div>

        {/* 右侧基础信息 - 占一半 */}
        <div className="flex-1 space-y-3">
          {/* 姓名和性别 */}
          <div className="flex gap-3">
            {/* 姓名 */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                姓名
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="输入人物姓名"
              />
            </div>
            {/* 性别 */}
            <div className="w-24">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                性别
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value as CharacterGender)}
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                {genderOptions.map((gender) => (
                  <option key={gender} value={gender}>
                    {CharacterGenderLabels[gender]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 角色等级 */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              角色等级
            </label>
            <div className="flex flex-wrap gap-1.5">
              {levelOptions.map((level) => {
                const colors = CharacterLevelColors[level];
                const isSelected = formData.level === level;
                return (
                  <button
                    key={level}
                    onClick={() => handleChange('level', level)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary/30'
                        : 'hover:bg-accent/10'
                    }`}
                    style={{
                      backgroundColor: isSelected ? colors.bg : undefined,
                      borderColor: colors.border,
                      color: isSelected ? colors.bar : undefined,
                    }}
                  >
                    {levelIcons[level]}
                    {CharacterLevelLabels[level]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 生辰 */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              生辰
            </label>
            <input
              type="text"
              value={formData.birth_date}
              onChange={(e) => handleChange('birth_date', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="例如：甲子年三月初三"
            />
          </div>
        </div>
      </div>

      {/* 其他信息表单 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 出生地 */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            出生地
          </label>
          <input
            type="text"
            value={formData.birthplace}
            onChange={(e) => handleChange('birthplace', e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            placeholder="例如：江南水乡"
          />
        </div>

        {/* 首次出场 */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            首次出场
          </label>
          <select
            value={currentAppearanceValue}
            onChange={(e) => handleAppearanceChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          >
            <option value="">-- 请选择章节 --</option>
            {chapterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {chapterOptions.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">暂无章节数据，请先在目录中创建卷、幕、章</p>
          )}
        </div>

        {/* 判词 */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            判词/引言
          </label>
          <textarea
            value={formData.quote}
            onChange={(e) => handleChange('quote', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
            placeholder="输入人物判词或引言..."
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
        >
          保存修改
        </button>
      </div>
    </div>
  );
};

export default CharacterEditForm;
