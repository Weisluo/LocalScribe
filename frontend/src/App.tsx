// frontend/src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
  return (
    <BrowserRouter>
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
