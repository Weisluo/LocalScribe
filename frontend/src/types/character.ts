/**
 * 人物设定系统 - TypeScript 类型定义
 *
 * 提供人物角色相关的类型定义
 */

// ==================== 枚举定义 ====================

export type CharacterLevel = 'protagonist' | 'major_support' | 'support' | 'minor' | 'past';
export type CharacterGender = 'male' | 'female' | 'other' | 'unknown';
export type AliasType = 'zi' | 'hao' | 'nickname' | 'title' | 'other';
export type RelationType = 'family' | 'love' | 'friend' | 'master' | 'apprentice' | 'enemy' | 'other';
export type ArtifactType = 'weapon' | 'armor' | 'accessory' | 'treasure' | 'other';
export type ArtifactRarity = 'legendary' | 'epic' | 'rare' | 'common';

// 角色等级显示名称
export const CharacterLevelLabels: Record<CharacterLevel, string> = {
  protagonist: '主角',
  major_support: '重要配角',
  support: '配角',
  minor: '小角色',
  past: '过往',
};

// 角色等级颜色配置
export const CharacterLevelColors: Record<CharacterLevel, { border: string; bg: string; bar: string; barWidth: number }> = {
  protagonist: {
    border: 'hsl(0 60% 50%)',
    bg: 'hsl(0 60% 97%)',
    bar: 'hsl(0 60% 50%)',
    barWidth: 4,
  },
  major_support: {
    border: 'hsl(45 50% 50%)',
    bg: 'hsl(45 50% 97%)',
    bar: 'hsl(45 50% 50%)',
    barWidth: 3,
  },
  support: {
    border: 'hsl(210 30% 55%)',
    bg: 'hsl(210 30% 97%)',
    bar: 'hsl(210 30% 55%)',
    barWidth: 2,
  },
  minor: {
    border: 'hsl(0 0% 60%)',
    bg: 'hsl(0 0% 98%)',
    bar: 'hsl(0 0% 60%)',
    barWidth: 2,
  },
  past: {
    border: 'hsl(280 30% 55%)',
    bg: 'hsl(280 30% 97%)',
    bar: 'hsl(280 30% 55%)',
    barWidth: 2,
  },
};

// 角色等级尺寸配置
export const CharacterLevelSizes: Record<CharacterLevel, { height: number; padding: number; avatar: number; radius: number }> = {
  protagonist: { height: 100, padding: 14, avatar: 68, radius: 8 },
  major_support: { height: 90, padding: 12, avatar: 62, radius: 7 },
  support: { height: 82, padding: 12, avatar: 54, radius: 6 },
  minor: { height: 74, padding: 10, avatar: 48, radius: 5 },
  past: { height: 74, padding: 10, avatar: 48, radius: 5 },
};

// 性别显示名称
export const CharacterGenderLabels: Record<CharacterGender, string> = {
  male: '男',
  female: '女',
  other: '其他',
  unknown: '未知',
};

// 别名类型显示名称
export const AliasTypeLabels: Record<AliasType, string> = {
  zi: '字',
  hao: '号',
  nickname: '外号',
  title: '称号',
  other: '其他',
};

// 关系类型显示名称
export const RelationTypeLabels: Record<RelationType, string> = {
  family: '亲情',
  love: '爱情',
  friend: '友情',
  master: '师父',
  apprentice: '徒弟',
  enemy: '敌对',
  other: '其他',
};

// 关系类型颜色
export const RelationTypeColors: Record<RelationType, string> = {
  family: 'hsl(120 40% 50%)',
  love: 'hsl(330 70% 60%)',
  friend: 'hsl(200 60% 55%)',
  master: 'hsl(270 50% 55%)',
  apprentice: 'hsl(280 45% 50%)',
  enemy: 'hsl(0 60% 50%)',
  other: 'hsl(0 0% 60%)',
};

// 器物类型显示名称
export const ArtifactTypeLabels: Record<ArtifactType, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
  treasure: '法宝',
  other: '其他',
};

// 器物等级显示名称
export const ArtifactRarityLabels: Record<ArtifactRarity, string> = {
  legendary: '神器',
  epic: '传说',
  rare: '稀有',
  common: '普通',
};

// 器物等级边框颜色（低饱和度）
export const ArtifactRarityColors: Record<ArtifactRarity, string> = {
  legendary: 'hsl(0 60% 50%)',   // 红色 - 神器
  epic: 'hsl(45 50% 50%)',       // 金色 - 传说
  rare: 'hsl(210 30% 55%)',      // 银色 - 稀有
  common: 'hsl(0 0% 60%)',       // 灰色 - 普通
};

// 器物等级背景颜色
export const ArtifactRarityBgColors: Record<ArtifactRarity, string> = {
  legendary: 'hsl(0 60% 97%)',   // 红色淡 - 神器
  epic: 'hsl(45 50% 97%)',       // 金色淡 - 传说
  rare: 'hsl(210 30% 97%)',      // 银色淡 - 稀有
  common: 'hsl(0 0% 98%)',       // 灰色淡 - 普通
};

// ==================== 基础类型 ====================

export interface CharacterAlias {
  id: string;
  character_id: string;
  alias_type: AliasType;
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CardContentItem {
  key: string;
  value: unknown;
  type: 'text' | 'rich_text' | 'list' | 'image' | 'number' | 'boolean';
}

export interface CharacterCard {
  id: string;
  character_id: string;
  title: string;
  icon?: string;
  content: CardContentItem[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterRelationship {
  id: string;
  character_id: string;
  target_character_id?: string;
  target_name?: string;
  relation_type: RelationType;
  description?: string;
  strength: number;
  is_bidirectional: boolean;
  reverse_description?: string;
  order_index: number;
  target_character?: {
    id: string;
    name: string;
    avatar?: string;
    level: CharacterLevel;
  };
  created_at: string;
  updated_at: string;
}

export interface CharacterArtifact {
  id: string;
  character_id: string;
  name: string;
  quote?: string;
  description?: string;
  artifact_type?: string;
  rarity?: ArtifactRarity;
  image?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// ==================== 人物主类型 ====================

export interface Character {
  id: string;
  project_id: string;
  name: string;
  gender: CharacterGender;
  birth_date?: string;
  birthplace?: string;
  race?: string;
  faction?: string;
  level: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  last_appearance_volume?: string;
  last_appearance_act?: string;
  last_appearance_chapter?: string;
  order_index: number;
  source?: 'history' | null;
  aliases: CharacterAlias[];
  cards: CharacterCard[];
  relationships: CharacterRelationship[];
  artifacts: CharacterArtifact[];
  created_at: string;
  updated_at: string;
}

// 人物列表项（简化版）
export interface CharacterListItem {
  id: string;
  name: string;
  gender: CharacterGender;
  level: CharacterLevel;
  quote?: string;
  avatar?: string;
  birth_date?: string;
  race?: string;
  faction?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  last_appearance_volume?: string;
  last_appearance_act?: string;
  last_appearance_chapter?: string;
  order_index: number;
  source?: 'history' | null;
  aliases: CharacterAlias[];
  created_at: string;
  updated_at: string;
}

// 人物简要信息（用于选择器）
export interface CharacterSimple {
  id: string;
  name: string;
  avatar?: string;
  level: CharacterLevel;
  source?: 'history' | null;
}

// ==================== 请求/响应类型 ====================

export interface CreateCharacterRequest {
  name: string;
  gender?: CharacterGender;
  birth_date?: string;
  birthplace?: string;
  race?: string;
  faction?: string;
  level?: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  order_index?: number;
  source?: string;
  aliases?: Omit<CharacterAlias, 'id' | 'character_id' | 'created_at' | 'updated_at'>[];
  cards?: Omit<CharacterCard, 'id' | 'character_id' | 'created_at' | 'updated_at'>[];
  relationships?: Omit<CharacterRelationship, 'id' | 'character_id' | 'target_character' | 'created_at' | 'updated_at'>[];
  artifacts?: Omit<CharacterArtifact, 'id' | 'character_id' | 'created_at' | 'updated_at'>[];
}

export interface UpdateCharacterRequest {
  name?: string;
  gender?: CharacterGender;
  birth_date?: string;
  birthplace?: string;
  race?: string;
  faction?: string;
  level?: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  last_appearance_volume?: string;
  last_appearance_act?: string;
  last_appearance_chapter?: string;
  order_index?: number;
  source?: string | null;
}

export interface CharacterFilter {
  level?: CharacterLevel;
  search?: string;
  volume?: string;
  act?: string;
  chapter?: string;
  source?: 'history' | 'main' | 'all';
  sort_by?: 'default' | 'order_index' | 'name' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface CharacterStats {
  total: number;
  by_level: Record<CharacterLevel, number>;
  by_gender: Record<CharacterGender, number>;
}

export interface BatchDeleteRequest {
  ids: string[];
}

export interface BatchUpdateOrderRequest {
  orders: Record<string, number>;
}

// ==================== 别名相关 ====================

export interface CreateAliasRequest {
  alias_type: AliasType;
  content: string;
  order_index?: number;
}

export interface UpdateAliasRequest {
  alias_type?: AliasType;
  content?: string;
  order_index?: number;
}

// ==================== 卡片相关 ====================

export interface CreateCardRequest {
  title: string;
  icon?: string;
  content?: CardContentItem[];
  order_index?: number;
}

export interface UpdateCardRequest {
  title?: string;
  icon?: string;
  content?: CardContentItem[];
  order_index?: number;
}

// ==================== 关系相关 ====================

export interface CreateRelationshipRequest {
  target_character_id?: string;
  target_name?: string;
  relation_type: RelationType;
  description?: string;
  strength?: number;
  is_bidirectional?: boolean;
  reverse_description?: string;
  order_index?: number;
}

export interface UpdateRelationshipRequest {
  target_character_id?: string;
  target_name?: string;
  relation_type?: RelationType;
  description?: string;
  strength?: number;
  is_bidirectional?: boolean;
  reverse_description?: string;
  order_index?: number;
}

// ==================== 器物相关 ====================

export interface CreateArtifactRequest {
  name: string;
  quote?: string;
  description?: string;
  artifact_type?: string;
  rarity?: ArtifactRarity;
  image?: string;
  order_index?: number;
}

export interface UpdateArtifactRequest {
  name?: string;
  quote?: string;
  description?: string;
  artifact_type?: string;
  rarity?: ArtifactRarity;
  image?: string;
  order_index?: number;
}

// ==================== 快照相关 ====================

export type CharacterSnapshotType = 'volume' | 'act' | 'chapter' | 'custom';

// 快照类型显示名称
export const SnapshotTypeLabels: Record<CharacterSnapshotType, string> = {
  volume: '卷快照',
  act: '幕快照',
  chapter: '章快照',
  custom: '自定义快照',
};

export interface CharacterSnapshot {
  id: string;
  character_id: string;
  snapshot_type: CharacterSnapshotType;
  volume_id?: string;
  act_id?: string;
  chapter_id?: string;
  title: string;
  description?: string;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSnapshotRequest {
  snapshot_type: CharacterSnapshotType;
  volume_id?: string;
  act_id?: string;
  chapter_id?: string;
  title: string;
  description?: string;
  attributes?: Record<string, unknown>;
}

export interface UpdateSnapshotRequest {
  snapshot_type?: CharacterSnapshotType;
  volume_id?: string;
  act_id?: string;
  chapter_id?: string;
  title?: string;
  description?: string;
  attributes?: Record<string, unknown>;
}
