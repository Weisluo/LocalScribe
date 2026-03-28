// frontend/src/components/Outline/OutlineNavigation.tsx
import { GitBranch, BookOpen, FileText } from 'lucide-react';
import type { OutlineTab } from './types';

interface OutlineNavigationProps {
  activeTab: OutlineTab;
  onTabChange: (tab: OutlineTab) => void;
  rightActions?: React.ReactNode;
}

const tabs: { id: OutlineTab; label: string; icon: React.ReactNode }[] = [
  { id: 'story-chain', label: '故事链路', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'volume-outline', label: '卷大纲', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'chapter-outline', label: '章大纲', icon: <FileText className="h-4 w-4" /> },
];

export const OutlineNavigation = ({ activeTab, onTabChange, rightActions }: OutlineNavigationProps) => {
  return (
    <div className="h-14 border-b border-border/60 bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0">
      <nav className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              transition-all duration-200
              ${activeTab === tab.id
                ? 'text-foreground bg-accent/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </nav>
      
      {rightActions && (
        <div className="flex items-center gap-2">
          {rightActions}
        </div>
      )}
    </div>
  );
};
