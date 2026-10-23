import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { creaDriver } from './archivio/avvio';
import { migra } from './archivio/migrazioni';
import { creaRepository, type Repository } from './archivio/repository';
import App from './ui/App';
import { RepositoryProvider } from './ui/RepositoryContext';

function Radice() {
  const [repo, setRepo] = useState<Repository | null>(null);
  useEffect(() => {
    let attivo = true;
    (async () => {
      const driver = await creaDriver();
      await migra(driver);
      if (attivo) setRepo(creaRepository(driver));
    })();
    return () => {
      attivo = false;
    };
  }, []);
  if (!repo) return <p>Caricamento…</p>;
  return (
    <RepositoryProvider repository={repo}>
      <App />
    </RepositoryProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Radice />
  </StrictMode>,
);
