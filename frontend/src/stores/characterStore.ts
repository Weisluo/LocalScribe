import { create } from 'zustand';
import type {
  Character,
  CharacterListItem,
  CharacterFilter,
  CharacterLevel,
} from '@/types/character';

/**
 * 人物设定系统 - 状态管理 Store
 *
 * 使用 Zustand 管理人物设定的全局状态
 */

// ==================== 状态定义 ====================

interface CharacterState {
  // 当前选中的项目ID
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;

  // 人物列表
  characters: CharacterListItem[];
  setCharacters: (characters: CharacterListItem[]) => void;

  // 当前选中的人物ID
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;

  // 当前人物详情
  currentCharacter: Character | null;
  setCurrentCharacter: (character: Character | null) => void;

  // 筛选条件
  filter: CharacterFilter;
  setFilter: (filter: CharacterFilter) => void;
  resetFilter: () => void;

  // 搜索关键词
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;

  // 等级筛选
  levelFilter: CharacterLevel | null;
  setLevelFilter: (level: CharacterLevel | null) => void;

  // 编辑模式
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;

  // 加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // 错误信息
  error: string | null;
  setError: (error: string | null) => void;

  // 弹窗状态
  modals: {
    createCharacter: boolean;
    editCharacter: boolean;
    deleteConfirm: boolean;
    aliasEditor: boolean;
    cardEditor: boolean;
    relationshipEditor: boolean;
    artifactEditor: boolean;
  };
  openModal: (modalName: keyof CharacterState['modals']) => void;
  closeModal: (modalName: keyof CharacterState['modals']) => void;
  closeAllModals: () => void;

  // 重置状态
  resetState: () => void;
}

// ==================== 初始状态 ====================

const initialFilter: CharacterFilter = {
  sort_by: 'order_index',
  sort_order: 'asc',
};

const initialModals = {
  createCharacter: false,
  editCharacter: false,
  deleteConfirm: false,
  aliasEditor: false,
  cardEditor: false,
  relationshipEditor: false,
  artifactEditor: false,
};

// ==================== Store 创建 ====================

export const useCharacterStore = create<CharacterState>((set) => ({
  // 项目ID
  currentProjectId: null,
  setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),

  // 人物列表
  characters: [],
  setCharacters: (characters) => set({ characters }),

  // 选中的人物
  selectedCharacterId: null,
  setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),

  // 当前人物详情
  currentCharacter: null,
  setCurrentCharacter: (character) => set({ currentCharacter: character }),

  // 筛选条件
  filter: initialFilter,
  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter },
  })),
  resetFilter: () => set({ filter: initialFilter }),

  // 搜索关键词
  searchKeyword: '',
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  // 等级筛选
  levelFilter: null,
  setLevelFilter: (level) => set({ levelFilter: level }),

  // 编辑模式
  isEditing: false,
  setIsEditing: (editing) => set({ isEditing: editing }),

  // 加载状态
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // 错误信息
  error: null,
  setError: (error) => set({ error }),

  // 弹窗状态
  modals: initialModals,
  openModal: (modalName) => set((state) => ({
    modals: { ...state.modals, [modalName]: true },
  })),
  closeModal: (modalName) => set((state) => ({
    modals: { ...state.modals, [modalName]: false },
  })),
  closeAllModals: () => set({ modals: initialModals }),

  // 重置状态
  resetState: () => set({
    currentProjectId: null,
    characters: [],
    selectedCharacterId: null,
    currentCharacter: null,
    filter: initialFilter,
    searchKeyword: '',
    levelFilter: null,
    isEditing: false,
    isLoading: false,
    error: null,
    modals: initialModals,
  }),
}));

export default useCharacterStore;
