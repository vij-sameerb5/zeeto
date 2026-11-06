import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth';
import './index.css';
import { useApp } from './store';

// Demo without a backend: two tabs (stall + customer) share state through localStorage.
window.addEventListener('storage', (e) => { if (e.key === 'zeeto-v3') void useApp.persist.rehydrate(); });

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
