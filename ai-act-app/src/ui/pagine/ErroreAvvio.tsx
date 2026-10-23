import { useState } from 'react';
import '../stile.css';
import { ricarica } from '../../archivio/avvio';

interface Props {
  messaggio: string;
  /** Assente nell'anteprima web, dove non esistono backup. */
  ripristina?: () => Promise<void>;
}

export function ErroreAvvio({ messaggio, ripristina }: Props) {
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function ripristinaUltimo() {
    if (!ripristina || inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await ripristina();
      ricarica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
      setInCorso(false);
    }
  }

  return (
    <main className="contenuto">
      <h1>Il database non può essere aperto.</h1>
      <p className="avviso" role="alert">{messaggio}</p>
      {ripristina && (
        <button type="button" className="pulsante pulsante-primario" disabled={inCorso} onClick={ripristinaUltimo}>
          Ripristina l'ultimo backup
        </button>
      )}
      {errore && <p className="avviso" role="alert">{errore}</p>}
    </main>
  );
}
