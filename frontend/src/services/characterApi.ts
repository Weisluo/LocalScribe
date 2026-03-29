import { api } from '@/utils/request';
import type {
  Character,
  CharacterListItem,
  CharacterSimple,
  CharacterStats,
  CharacterFilter,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  CharacterAlias,
  CreateAliasRequest,
  UpdateAliasRequest,
  CharacterCard,
  CreateCardRequest,
  UpdateCardRequest,
  CharacterRelationship,
  CreateRelationshipRequest,
  UpdateRelationshipRequest,
  CharacterArtifact,
  CreateArtifactRequest,
  UpdateArtifactRequest,
  BatchDeleteRequest,
  BatchUpdateOrderRequest,
} from '@/types/character';

/**
 * 人物设定系统 - API 服务
 *
 * 提供人物角色的完整CRUD接口
 */

// ==================== 人物主接口 ====================

/**
 * 获取人物列表
 */
export const getCharacters = (projectId: string, filter?: CharacterFilter) => {
  return api.get<CharacterListItem[]>(`/projects/${projectId}/characters`, {
    params: filter,
  });
};

/**
 * 获取人物详情
 */
export const getCharacter = (projectId: string, characterId: string) => {
  return api.get<Character>(`/projects/${projectId}/characters/${characterId}`);
};

/**
 * 创建新人物
 */
export const createCharacter = (projectId: string, data: CreateCharacterRequest) => {
  return api.post<Character>(`/projects/${projectId}/characters`, data);
};

/**
 * 更新人物信息
 */
export const updateCharacter = (projectId: string, characterId: string, data: UpdateCharacterRequest) => {
  return api.put<Character>(`/projects/${projectId}/characters/${characterId}`, data);
};

/**
 * 删除人物
 */
export const deleteCharacter = (projectId: string, characterId: string) => {
  return api.delete<void>(`/projects/${projectId}/characters/${characterId}`);
};

/**
 * 批量删除人物
 */
export const batchDeleteCharacters = (projectId: string, data: BatchDeleteRequest) => {
  return api.post<void>(`/projects/${projectId}/characters/batch-delete`, data);
};

/**
 * 批量更新排序
 */
export const batchUpdateCharacterOrder = (projectId: string, data: BatchUpdateOrderRequest) => {
  return api.post<void>(`/projects/${projectId}/characters/batch-update-order`, data);
};

/**
 * 获取人物统计数据
 */
export const getCharacterStats = (projectId: string) => {
  return api.get<CharacterStats>(`/projects/${projectId}/characters/stats`);
};

/**
 * 获取人物简要列表（用于选择器）
 */
export const getCharactersSimple = (projectId: string, excludeId?: string) => {
  const config = excludeId ? { params: { exclude_id: excludeId } } : undefined;
  return api.get<CharacterSimple[]>(`/projects/${projectId}/characters/simple`, config);
};

// ==================== 别名管理 ====================

/**
 * 获取别名列表
 */
export const getAliases = (projectId: string, characterId: string) => {
  return api.get<CharacterAlias[]>(`/projects/${projectId}/characters/${characterId}/aliases`);
};

/**
 * 创建别名
 */
export const createAlias = (projectId: string, characterId: string, data: CreateAliasRequest) => {
  return api.post<CharacterAlias>(`/projects/${projectId}/characters/${characterId}/aliases`, data);
};

/**
 * 更新别名
 */
export const updateAlias = (projectId: string, characterId: string, aliasId: string, data: UpdateAliasRequest) => {
  return api.put<CharacterAlias>(`/projects/${projectId}/characters/${characterId}/aliases/${aliasId}`, data);
};

/**
 * 删除别名
 */
export const deleteAlias = (projectId: string, characterId: string, aliasId: string) => {
  return api.delete<void>(`/projects/${projectId}/characters/${characterId}/aliases/${aliasId}`);
};

// ==================== 卡片管理 ====================

/**
 * 获取卡片列表
 */
export const getCards = (projectId: string, characterId: string) => {
  return api.get<CharacterCard[]>(`/projects/${projectId}/characters/${characterId}/cards`);
};

/**
 * 创建卡片
 */
export const createCard = (projectId: string, characterId: string, data: CreateCardRequest) => {
  return api.post<CharacterCard>(`/projects/${projectId}/characters/${characterId}/cards`, data);
};

/**
 * 更新卡片
 */
export const updateCard = (projectId: string, characterId: string, cardId: string, data: UpdateCardRequest) => {
  return api.put<CharacterCard>(`/projects/${projectId}/characters/${characterId}/cards/${cardId}`, data);
};

/**
 * 删除卡片
 */
export const deleteCard = (projectId: string, characterId: string, cardId: string) => {
  return api.delete<void>(`/projects/${projectId}/characters/${characterId}/cards/${cardId}`);
};

// ==================== 关系管理 ====================

/**
 * 获取关系列表
 */
export const getRelationships = (projectId: string, characterId: string) => {
  return api.get<CharacterRelationship[]>(`/projects/${projectId}/characters/${characterId}/relationships`);
};

/**
 * 创建关系
 */
export const createRelationship = (projectId: string, characterId: string, data: CreateRelationshipRequest) => {
  return api.post<CharacterRelationship>(`/projects/${projectId}/characters/${characterId}/relationships`, data);
};

/**
 * 更新关系
 */
export const updateRelationship = (projectId: string, characterId: string, relationshipId: string, data: UpdateRelationshipRequest) => {
  return api.put<CharacterRelationship>(`/projects/${projectId}/characters/${characterId}/relationships/${relationshipId}`, data);
};

/**
 * 删除关系
 */
export const deleteRelationship = (projectId: string, characterId: string, relationshipId: string) => {
  return api.delete<void>(`/projects/${projectId}/characters/${characterId}/relationships/${relationshipId}`);
};

// ==================== 器物管理 ====================

/**
 * 获取器物列表
 */
export const getArtifacts = (projectId: string, characterId: string) => {
  return api.get<CharacterArtifact[]>(`/projects/${projectId}/characters/${characterId}/artifacts`);
};

/**
 * 创建器物
 */
export const createArtifact = (projectId: string, characterId: string, data: CreateArtifactRequest) => {
  return api.post<CharacterArtifact>(`/projects/${projectId}/characters/${characterId}/artifacts`, data);
};

/**
 * 更新器物
 */
export const updateArtifact = (projectId: string, characterId: string, artifactId: string, data: UpdateArtifactRequest) => {
  return api.put<CharacterArtifact>(`/projects/${projectId}/characters/${characterId}/artifacts/${artifactId}`, data);
};

/**
 * 删除器物
 */
export const deleteArtifact = (projectId: string, characterId: string, artifactId: string) => {
  return api.delete<void>(`/projects/${projectId}/characters/${characterId}/artifacts/${artifactId}`);
};

// ==================== 导出 API 对象 ====================

export const characterApi = {
  // 人物主接口
  getCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  batchDeleteCharacters,
  batchUpdateCharacterOrder,
  getCharacterStats,
  getCharactersSimple,

  // 别名管理
  getAliases,
  createAlias,
  updateAlias,
  deleteAlias,

  // 卡片管理
  getCards,
  createCard,
  updateCard,
  deleteCard,

  // 关系管理
  getRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship,

  // 器物管理
  getArtifacts,
  createArtifact,
  updateArtifact,
  deleteArtifact,
};

export default characterApi;
