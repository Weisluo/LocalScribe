import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ToastContainer } from '@/components/common/ToastContainer';

const EditorPage = lazy(() => import('./pages/EditorPage/EditorPage').then(m => ({ default: m.EditorPage })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="text-muted-foreground">加载中...</span>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
      <ToastContainer />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<EditorPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
