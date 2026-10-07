import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </AppErrorBoundary>,
);
