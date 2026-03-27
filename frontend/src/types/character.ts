/**
 * 人物设定系统 - TypeScript 类型定义
 *
 * 提供人物角色相关的类型定义
 */

// ==================== 枚举定义 ====================

export type CharacterLevel = 'protagonist' | 'major_support' | 'support' | 'minor';
export type CharacterGender = 'male' | 'female' | 'other' | 'unknown';
export type AliasType = 'zi' | 'hao' | 'nickname' | 'title' | 'other';
export type RelationType = 'family' | 'love' | 'friend' | 'mentor' | 'enemy' | 'other';
export type ArtifactType = 'weapon' | 'armor' | 'accessory' | 'treasure' | 'other';

// 角色等级显示名称
export const CharacterLevelLabels: Record<CharacterLevel, string> = {
  protagonist: '主角',
  major_support: '重要配角',
  support: '配角',
  minor: '小角色',
};

// 角色等级颜色配置
export const CharacterLevelColors: Record<CharacterLevel, { border: string; bg: string; bar: string; barWidth: number }> = {
  protagonist: {
    border: 'hsl(45 90% 55%)',
    bg: 'hsl(45 90% 97%)',
    bar: 'hsl(45 90% 55%)',
    barWidth: 4,
  },
  major_support: {
    border: 'hsl(200 60% 55%)',
    bg: 'hsl(200 60% 97%)',
    bar: 'hsl(200 60% 55%)',
    barWidth: 3,
  },
  support: {
    border: 'hsl(120 40% 50%)',
    bg: 'hsl(120 40% 97%)',
    bar: 'hsl(120 40% 50%)',
    barWidth: 2,
  },
  minor: {
    border: 'hsl(0 0% 70%)',
    bg: 'hsl(0 0% 98%)',
    bar: 'hsl(0 0% 70%)',
    barWidth: 2,
  },
};

// 角色等级尺寸配置
export const CharacterLevelSizes: Record<CharacterLevel, { height: number; padding: number; avatar: number; radius: number }> = {
  protagonist: { height: 88, padding: 14, avatar: 60, radius: 8 },
  major_support: { height: 80, padding: 12, avatar: 56, radius: 7 },
  support: { height: 72, padding: 12, avatar: 48, radius: 6 },
  minor: { height: 64, padding: 10, avatar: 44, radius: 5 },
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
  mentor: '师徒',
  enemy: '敌对',
  other: '其他',
};

// 关系类型颜色
export const RelationTypeColors: Record<RelationType, string> = {
  family: 'hsl(120 40% 50%)',
  love: 'hsl(330 70% 60%)',
  friend: 'hsl(200 60% 55%)',
  mentor: 'hsl(270 50% 55%)',
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
  description?: string;
  artifact_type?: ArtifactType;
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
  level: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  order_index: number;
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
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  order_index: number;
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
}

// ==================== 请求/响应类型 ====================

export interface CreateCharacterRequest {
  name: string;
  gender?: CharacterGender;
  birth_date?: string;
  birthplace?: string;
  level?: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  order_index?: number;
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
  level?: CharacterLevel;
  quote?: string;
  avatar?: string;
  full_image?: string;
  first_appearance_volume?: string;
  first_appearance_act?: string;
  first_appearance_chapter?: string;
  order_index?: number;
}

export interface CharacterFilter {
  level?: CharacterLevel;
  search?: string;
  volume?: string;
  act?: string;
  chapter?: string;
  sort_by?: 'order_index' | 'name' | 'created_at' | 'updated_at';
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
  orders: { id: string; order_index: number }[];
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
  description?: string;
  artifact_type?: ArtifactType;
  image?: string;
  order_index?: number;
}

export interface UpdateArtifactRequest {
  name?: string;
  description?: string;
  artifact_type?: ArtifactType;
  image?: string;
  order_index?: number;
}
