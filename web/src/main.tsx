import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isMockMode } from './mocks/mode';
import './index.css';

async function start() {
  /* The backend is being rebuilt in parallel, so development runs against MSW
     and a replay of fixtures/cached-run.json. `VITE_MOCK=0` goes through the
     dev proxy to express on 5173 instead.

     `import.meta.env.PROD` is replaced with a literal at build time, so this
     whole branch — MSW, the handlers and the fixture — is dead code in a
     production bundle and is dropped rather than shipped and never called. */
  if (!import.meta.env.PROD && isMockMode()) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
  }

  const el = document.getElementById('root');
  if (!el) throw new Error('No #root element');

  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
