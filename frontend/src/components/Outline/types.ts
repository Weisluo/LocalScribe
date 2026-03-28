// frontend/src/components/Outline/types.ts

// ======== 连接类型枚举 ========
export type ConnectionType = 'direct' | 'branch' | 'parallel' | 'merge' | 'loop' | 'jump';

// ======== 事件类型枚举 ========
export type EventType = 'normal' | 'decision' | 'milestone' | 'flashback' | 'flashforward';

// ======== 大纲 Tab ========
export type OutlineTab = 'story-chain' | 'volume-outline' | 'chapter-outline';

// ======== 事件连接 ========
export interface EventConnection {
  id: string;
  from_event_id: string;
  to_event_id: string;
  connection_type: ConnectionType;
  label?: string;
  condition?: string;
  color?: string;
  dashed: boolean;
  thickness?: number;
  created_at: string;
}

export interface EventConnectionCreate {
  from_event_id: string;
  to_event_id: string;
  connection_type: ConnectionType;
  label?: string;
  condition?: string;
  color?: string;
  dashed?: boolean;
  thickness?: number;
}

export interface EventConnectionUpdate {
  connection_type?: ConnectionType;
  label?: string;
  condition?: string;
  color?: string;
  dashed?: boolean;
  thickness?: number;
}

// ======== 故事事件 ========
export interface StoryEvent {
  id: string;
  act_id: string;
  project_id: string;
  title: string;
  content: string;
  event_type: EventType;
  characters?: string[];
  location?: string;
  timestamp?: string;
  order: number;
  position_x?: number;
  position_y?: number;
  lane?: number;
  created_at: string;
  updated_at: string;
  outgoing_connections: EventConnection[];
}

export interface StoryEventCreate {
  act_id: string;
  project_id: string;
  title?: string;
  content?: string;
  event_type?: EventType;
  characters?: string[];
  location?: string;
  timestamp?: string;
  order?: number;
  position_x?: number;
  position_y?: number;
  lane?: number;
}

export interface StoryEventUpdate {
  title?: string;
  content?: string;
  event_type?: EventType;
  characters?: string[];
  location?: string;
  timestamp?: string;
  order?: number;
  position_x?: number;
  position_y?: number;
  lane?: number;
}

// ======== 大纲数据结构 ========
export interface ChapterOutline {
  id: string;
  title: string;
  folder_id: string;
  order: number;
  outline_content?: string;
  word_count?: number;
  scene_count?: number;
  outline_characters?: string[];
  updated_at: string;
}

export interface ActOutline {
  id: string;
  name: string;
  order: number;
  chapters: ChapterOutline[];
}

export interface VolumeOutline {
  id: string;
  name: string;
  order: number;
  outline_content?: string;
  acts: ActOutline[];
}

export interface ProjectOutline {
  volumes: VolumeOutline[];
}

// ======== 幕事件数据 ========
export interface ActEvents {
  act_id: string;
  act_name: string;
  volume_id: string;
  events: StoryEvent[];
  connections: EventConnection[];
}

// ======== 事件详情弹窗 ========
export interface EventModalData {
  event?: StoryEvent;
  actId: string;
  projectId: string;
  mode: 'create' | 'edit';
}

// ======== 搜索功能 ========
export type SearchScope = 'title' | 'content' | 'character' | 'location' | 'timestamp';

export interface SearchFilters {
  scopes: SearchScope[];
  eventTypes?: EventType[];
  caseSensitive: boolean;
}

export interface SearchResult {
  event: StoryEvent;
  matches: { field: string; positions: number[] }[];
  score: number;
}

// ======== 网格系统 ========
export interface GridConfig {
  enabled: boolean;
  snapEnabled: boolean;
  size: number;
  color: string;
  dotSize: number;
  showOnZoom: number;
}

// ======== 批量选择 ========
export interface SelectionState {
  selectedIds: Set<string>;
  isMultiSelectMode: boolean;
}
