import { useEffect, useState } from 'react';

interface SkeletonProps {
  className?: string;
  animate?: 'pulse' | 'shimmer';
}

export const Skeleton = ({ className = '', animate = 'shimmer' }: SkeletonProps) => {
  const animationClass = animate === 'shimmer' ? 'skeleton-shimmer' : 'animate-pulse';
  
  return (
    <div 
      className={`bg-muted/30 rounded ${animationClass} ${className}`}
    />
  );
};

interface EventNodeSkeletonProps {
  count?: number;
}

export const EventNodeSkeleton = ({ count = 3 }: EventNodeSkeletonProps) => {
  return (
    <div className="space-y-6 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-4">
          <div className="w-[200px] min-h-[80px] rounded-lg border border-border/30 bg-card/50 p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          {i < count - 1 && (
            <div className="w-0.5 h-6 bg-muted/20" />
          )}
        </div>
      ))}
    </div>
  );
};

interface VolumeSkeletonProps {
  actCount?: number;
}

export const VolumeSkeleton = ({ actCount = 2 }: VolumeSkeletonProps) => {
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
      <div className="px-5 py-3.5 bg-accent/10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="px-5 pb-4 space-y-3">
        {Array.from({ length: actCount }).map((_, i) => (
          <ActSkeleton key={i} eventCount={2} />
        ))}
      </div>
    </div>
  );
};

interface ActSkeletonProps {
  eventCount?: number;
}

export const ActSkeleton = ({ eventCount = 3 }: ActSkeletonProps) => {
  return (
    <div className="rounded-lg overflow-hidden ring-1 ring-border/30 bg-background/50">
      <div className="px-4 py-2.5 bg-accent/8">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="p-4">
        <EventNodeSkeleton count={eventCount} />
      </div>
    </div>
  );
};

interface StoryChainSkeletonProps {
  volumeCount?: number;
  actPerVolume?: number;
  showProgress?: boolean;
}

export const StoryChainSkeleton = ({ 
  volumeCount = 2, 
  actPerVolume = 2, 
  showProgress = true 
}: StoryChainSkeletonProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!showProgress) return;
    
    const stages = [
      { time: 200, progress: 20 },
      { time: 500, progress: 40 },
      { time: 1000, progress: 70 },
      { time: 1500, progress: 100 },
    ];

    stages.forEach(({ time, progress: p }) => {
      setTimeout(() => setProgress(p), time);
    });
  }, [showProgress]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto py-6 px-6 space-y-4">
        {showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>加载中...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/60 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        
        {Array.from({ length: volumeCount }).map((_, i) => (
          <VolumeSkeleton key={i} actCount={actPerVolume} />
        ))}
      </div>
    </div>
  );
};

interface VolumeOutlineSkeletonProps {
  volumeCount?: number;
}

export const VolumeOutlineSkeleton = ({ volumeCount = 2 }: VolumeOutlineSkeletonProps) => {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6 space-y-4">
        {Array.from({ length: volumeCount }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
            <div className="px-5 py-3.5 bg-accent/10">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="px-5 pb-5 pt-2">
              <div className="bg-card rounded-xl shadow-lg p-8 max-w-3xl mx-auto">
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-5/6 mb-3" />
                <Skeleton className="h-4 w-4/6 mb-3" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ChapterOutlineSkeletonProps {
  volumeCount?: number;
  actPerVolume?: number;
  chapterPerAct?: number;
}

export const ChapterOutlineSkeleton = ({ 
  volumeCount = 2, 
  actPerVolume = 2, 
  chapterPerAct = 3 
}: ChapterOutlineSkeletonProps) => {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6 space-y-4">
        {Array.from({ length: volumeCount }).map((_, vIndex) => (
          <div key={vIndex} className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
            <div className="px-5 py-3.5 bg-accent/10">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="px-5 pb-4 space-y-3">
              {Array.from({ length: actPerVolume }).map((_, aIndex) => (
                <div key={aIndex} className="rounded-lg overflow-hidden ring-1 ring-border/30 bg-background/50">
                  <div className="px-4 py-2.5 bg-accent/8">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="px-4 pb-3 space-y-4 pt-1">
                    {Array.from({ length: chapterPerAct }).map((_, cIndex) => (
                      <div key={cIndex} className="rounded-lg overflow-hidden ring-1 ring-border/20 bg-card/30">
                        <div className="px-3.5 py-2 bg-muted/20">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-3.5 w-3.5 rounded" />
                            <Skeleton className="h-3.5 w-3.5 rounded" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </div>
                        <div className="p-3">
                          <Skeleton className="h-3 w-full mb-2" />
                          <Skeleton className="h-3 w-5/6" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoryChainSkeleton;
