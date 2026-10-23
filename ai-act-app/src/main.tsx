import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ambienteTauri, creaDriver, ripristinaUltimoBackup, statoAvvio } from './archivio/avvio';
import { migra } from './archivio/migrazioni';
import { creaRepository, type Repository } from './archivio/repository';
import App from './ui/App';
import { RepositoryProvider } from './ui/RepositoryContext';
import { ErroreAvvio } from './ui/pagine/ErroreAvvio';

type Stato =
  | { tipo: 'caricamento' }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'pronto'; repo: Repository; erroreBackup: string | null };

function messaggioDi(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function Radice() {
  const [stato, setStato] = useState<Stato>({ tipo: 'caricamento' });
  useEffect(() => {
    let attivo = true;
    (async () => {
      let repo: Repository;
      let erroreBackup: string | null = null;
      try {
        if (ambienteTauri()) erroreBackup = (await statoAvvio()).erroreBackup;
        const driver = await creaDriver();
        await migra(driver);
        repo = creaRepository(driver);
      } catch (e) {
        if (attivo) setStato({ tipo: 'errore', messaggio: messaggioDi(e) });
        return;
      }
      try {
        await repo.svuotaCestinoScaduto();
      } catch (e) {
        // Non blocca l'avvio: gli elementi scaduti restano nel cestino fino al prossimo avvio.
        console.error('Svuotamento del cestino non riuscito', e);
      }
      if (attivo) setStato({ tipo: 'pronto', repo, erroreBackup });
    })();
    return () => {
      attivo = false;
    };
  }, []);

  if (stato.tipo === 'caricamento') return <p>Caricamento…</p>;
  if (stato.tipo === 'errore') {
    return (
      <ErroreAvvio
        messaggio={stato.messaggio}
        ripristina={ambienteTauri() ? ripristinaUltimoBackup : undefined}
      />
    );
  }
  return (
    <RepositoryProvider repository={stato.repo}>
      <App erroreBackup={stato.erroreBackup} />
    </RepositoryProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Radice />
  </StrictMode>,
);
