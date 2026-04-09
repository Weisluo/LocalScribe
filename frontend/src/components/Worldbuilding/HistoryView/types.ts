export type EventLevel = 'critical' | 'major' | 'normal' | 'minor';

export type EraTheme = 'ochre' | 'gilded' | 'verdant' | 'cerulean' | 'patina' | 'parchment' | 'cinnabar' | 'ink' | 'standalone';

export type EventType = 'imperial' | 'war' | 'culture' | 'discovery' | 'disaster' | 'folk' | 'mystery' | 'legacy';

export interface Era {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  order_index: number;
  theme?: EraTheme;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  level: EventLevel;
  eventDate?: string;
  eventEndDate?: string;
  icon?: string;
  order_index: number;
  eraId?: string;
  items: EventItem[];
  eventType?: EventType;
}

export interface EventItem {
  id: string;
  name: string;
  content: Record<string, string>;
  order_index: number;
}

export interface EraThemeConfig {
  label: string;
  labelCn: string;
  gradient: string;
  border: string;
  accent: string;
  accentColor: string;
  text: string;
  bgLight: string;
  bgDark: string;
  description: string;
}

export interface EventTypeConfig {
  label: string;
  labelCn: string;
  color: string;
  gradient: string;
  border: string;
  accent: string;
  text: string;
  icon: string;
  description: string;
}

export interface EventLevelConfig {
  label: string;
  labelCn: string;
  flexBasis: string;
  minHeight: string;
  padding: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  titleSize: string;
  icon: string;
  glowColor: string;
  accentGradient: string;
}

export interface TimelineTooltipProps {
  event: { name: string; eventDate?: string; eventEndDate?: string } | null;
  position: { x: number; y: number } | null;
}

export interface AddEraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; startDate: string; endDate: string; theme: EraTheme }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditEraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; startDate: string; endDate: string; theme: EraTheme }) => void;
  era: Era | null;
  isLoading?: boolean;
  error?: string | null;
}

export interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; level: EventLevel; eventDate: string; eventEndDate: string; icon: string; eraId?: string; eventType?: EventType }) => void;
  eras: Era[];
  selectedEraId?: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; level: EventLevel; eventDate: string; eventEndDate: string; icon: string; eraId?: string; eventType?: EventType }) => void;
  event: Event | null;
  eras: Era[];
  isLoading?: boolean;
  error?: string | null;
}

export interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; content: Record<string, string> }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; content: Record<string, string> }) => void;
  item: EventItem | null;
  isLoading?: boolean;
  error?: string | null;
}

export interface EventCardProps {
  event: Event;
  projectId?: string;
  moduleId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: EventItem) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateDescription: (description: string) => void;
  onAddCharRefItem?: (name: string, content: Record<string, string>) => void;
  onNavigateToCharacter?: (characterId: string) => void;
  eventTypeConfigs?: (EventTypeConfig & { id: string })[];
  levelConfigs?: (EventLevelConfig & { id: string })[];
}

export interface HistoryViewProps {
  moduleId: string;
  projectId: string;
  onNavigateToCharacter?: (characterId: string) => void;
}

export interface EraCardProps {
  era: Era;
  events: Event[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddItem: (event: Event) => void;
  onEditItem: (event: Event, item: EventItem) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateEventDescription: (event: Event, description: string) => void;
  onUpdateEraDescription: (description: string) => void;
}

export interface CharacterRef {
  id: string;
  name: string;
  avatar?: string;
  source?: 'history' | null;
}

export interface EraSwitchContainerProps {
  eras: Era[];
  activeEraId: string | null;
  onSwitchEra: (eraId: string) => void;
  renderEraContent: (era: Era) => React.ReactNode;
}

export interface EraContentPanelProps {
  era: Era;
  events: Event[];
  onEditEra: () => void;
  onDeleteEra: () => void;
  onAddEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddItem: (event: Event) => void;
  onEditItem: (event: Event, item: EventItem) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateEventDescription: (event: Event, desc: string) => void;
  onUpdateEraDescription: (desc: string) => void;
  onAddCharRefItem?: (event: Event, name: string, content: Record<string, string>) => void;
  projectId: string;
  moduleId: string;
  isStandalone?: boolean;
  onNavigateToCharacter?: (characterId: string) => void;
  eraThemeConfigs?: (EraThemeConfig & { id: string })[];
  eventTypeConfigs?: (EventTypeConfig & { id: string })[];
  levelConfigs?: (EventLevelConfig & { id: string })[];
}

export interface EraTimelineProps {
  events: Event[];
  eraId: string;
  theme?: EraTheme;
}

export interface CharacterReferenceProps {
  eventId: string;
  eventItems: EventItem[];
  projectId: string;
  moduleId: string;
  onAddItem: (name: string, content: Record<string, string>) => void;
  onEditItem: (item: EventItem) => void;
  onDeleteItem: (itemId: string) => void;
  onNavigateToCharacter?: (characterId: string) => void;
  isHovered?: boolean;
}

export interface CharacterPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (characterId: string, characterName: string) => void;
  projectId: string;
  allowedCharacterIds?: string[];
}

// 历史模块配置
export interface HistoryModuleConfig {
  eraThemes: (EraThemeConfig & { id: string })[];
  eventTypes: (EventTypeConfig & { id: string })[];
  levels: (EventLevelConfig & { id: string })[];
}

export interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HistoryModuleConfig;
  onSave: (config: HistoryModuleConfig) => void;
  isLoading?: boolean;
}
