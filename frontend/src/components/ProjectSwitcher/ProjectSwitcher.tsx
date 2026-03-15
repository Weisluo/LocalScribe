import * as Select from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';

type ProjectResponse = components['schemas']['ProjectResponse'];

export const ProjectSwitcher = () => {
  const { currentProjectId, setCurrentProjectId } = useProjectStore();
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectResponse[]>('/projects'),
  });

  if (!projects || projects.length === 0) return null;

  const currentProject = projects.find(p => p.id === currentProjectId);

  return (
    <Select.Root
      value={currentProjectId ?? undefined}
      onValueChange={setCurrentProjectId}
    >
      <Select.Trigger className="inline-flex items-center justify-between w-full bg-muted/5 border border-input rounded-md py-2 pl-4 pr-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
        <Select.Value placeholder="选择项目">
          {currentProject?.title}
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden bg-background border border-border rounded-md shadow-lg"
        >
          <Select.Viewport className="p-1">
            {projects.map((project) => (
              <Select.Item
                key={project.id}
                value={project.id}
                className="relative flex items-center px-6 py-2 text-sm rounded-md cursor-pointer focus:outline-none transition-all duration-200 hover:bg-primary/5 hover:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-medium border-l-2 border-transparent data-[state=checked]:border-primary"
              >
                <Select.ItemText>{project.title}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};