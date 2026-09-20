import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * This used to start MSW before rendering, because the backend was being built
 * in parallel and the app had to run against a mock layer. It no longer does:
 * every call goes to the express server, and the mock layer is archived under
 * `src/_archive/2026-09-20_mock-layer/` with a note on how the two differed.
 *
 * There is nothing to await any more, so there is nothing between the module
 * loading and the first paint.
 */
const el = document.getElementById('root');
if (!el) throw new Error('No #root element');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>
);
