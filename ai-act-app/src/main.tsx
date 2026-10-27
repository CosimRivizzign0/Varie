import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ambienteTauri, creaDriver, ripristinaUltimoBackup, statoAvvio } from './archivio/avvio';
import { migra } from './archivio/migrazioni';
import { creaRepository, type Repository } from './archivio/repository';
import { archivioSessione, avvioApp } from './archivio/sessione';
import App from './ui/App';
import { RepositoryProvider } from './ui/RepositoryContext';
import { ErroreAvvio } from './ui/pagine/ErroreAvvio';

type Stato =
  | { tipo: 'caricamento' }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'pronto'; repo: Repository; erroreBackup: string | null; ripristinato: boolean };

function messaggioDi(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function avvia(): Promise<Stato> {
  let repo: Repository;
  let erroreBackup: string | null = null;
  try {
    if (ambienteTauri()) erroreBackup = (await statoAvvio()).erroreBackup;
    const driver = await creaDriver();
    await migra(driver);
    repo = creaRepository(driver);
  } catch (e) {
    return { tipo: 'errore', messaggio: messaggioDi(e) };
  }
  const { ripristinato } = await avvioApp(repo, archivioSessione());
  return { tipo: 'pronto', repo, erroreBackup, ripristinato };
}

// Una sola esecuzione per caricamento di pagina, anche se StrictMode monta due volte l'effetto.
let avvio: Promise<Stato> | null = null;

function Radice() {
  const [stato, setStato] = useState<Stato>({ tipo: 'caricamento' });
  useEffect(() => {
    let attivo = true;
    (avvio ??= avvia()).then((s) => {
      if (attivo) setStato(s);
    });
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
      <App erroreBackup={stato.erroreBackup} ripristinato={stato.ripristinato} />
    </RepositoryProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Radice />
  </StrictMode>,
);
