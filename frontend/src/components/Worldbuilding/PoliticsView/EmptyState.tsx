/**
 * 政治模块空状态（Phase 4 P4-T11；politics_ui_design §9.1）
 *
 * 空白世界只给引导，不预置任何等级、状态、政体、派系或示例数据（§7.6）。
 */

import { Plus, BookOpen } from 'lucide-react';

import { EmptyState } from '../shared/EmptyState';

export interface PoliticsEmptyStateProps {
  term: (key: string) => string;
  onCreatePolity: () => void;
  onOpenGuide: () => void;
}

export const PoliticsEmptyState = ({
  term,
  onCreatePolity,
  onOpenGuide,
}: PoliticsEmptyStateProps) => (
  <div data-testid="politics-empty">
    <EmptyState
      icon={BookOpen}
      title={term('emptyTitle')}
      description="先立主干，再挂卫星，最后连边。三步得到一张会生长的版图。"
      actions={[
        { label: term('newPolity'), onClick: onCreatePolity, icon: Plus },
        { label: '了解权力版图', onClick: onOpenGuide, variant: 'secondary' },
      ]}
    />
  </div>
);

export default PoliticsEmptyState;
