export type EventLevel = 'critical' | 'major' | 'normal' | 'minor';

export type EraTheme = 'ochre' | 'gilded' | 'verdant' | 'cerulean' | 'patina' | 'parchment' | 'cinnabar' | 'ink';

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
  event: { name: string; eventDate?: string } | null;
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
  onSubmit: (data: { name: string; description: string; level: EventLevel; eventDate: string; icon: string; eraId?: string; eventType?: EventType }) => void;
  eras: Era[];
  selectedEraId?: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; level: EventLevel; eventDate: string; icon: string; eraId?: string; eventType?: EventType }) => void;
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
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: EventItem) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateDescription: (description: string) => void;
}

export interface HistoryViewProps {
  moduleId: string;
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
