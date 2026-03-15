// frontend/src/App.tsx
import { EditorPage } from './pages/EditorPage/EditorPage';
import { TrashPage } from './pages/TrashPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/trash" element={<TrashPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
