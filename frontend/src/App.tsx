import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { preloadModules } from '@/hooks/useIdlePreload';

const EditorPage = lazy(() => import('./pages/EditorPage/EditorPage').then(m => ({ default: m.EditorPage })));
const TrashPage = lazy(() => import('./pages/TrashPage').then(m => ({ default: m.TrashPage })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="text-muted-foreground">加载中...</span>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    preloadModules(
      [
        () => import('./pages/TrashPage'),
      ],
      2000
    );
  }, []);

  return (
    <BrowserRouter>
      <Toaster 
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            padding: '12px 16px',
          },
          classNames: {
            toast: 'group-[.toaster]:pr-8',
            title: 'group-[.toaster]:text-sm',
            description: 'group-[.toaster]:text-xs',
          },
        }}
      />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/trash" element={<TrashPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
