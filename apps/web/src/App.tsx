import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './screens/Landing';

/** The single-file share build can't use URL paths, so it routes in memory. */
const Router = ({ children }: { children: ReactNode }) => (__SINGLE__ ? <MemoryRouter>{children}</MemoryRouter> : <BrowserRouter>{children}</BrowserRouter>);

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
