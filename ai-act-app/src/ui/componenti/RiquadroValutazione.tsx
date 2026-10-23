import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Valutazione } from '../../domain/valutazione';
import { ERRORE_REGOLE, REGOLE } from '../../regole/attive';
import { ETICHETTE_CLASSE } from '../../regole/tipi';
import { useRepository } from '../RepositoryContext';
import { conferma } from '../conferma';

const STATI = { in_corso: 'In corso', completata: 'Completata', confermata: 'Confermata' } as const;

export function RiquadroValutazione({ sistemaId }: { sistemaId: string }) {
  const repo = useRepository();
  const navigate = useNavigate();
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    repo
      .getValutazioneAttiva(sistemaId)
      .then((v) => {
        if (attivo) {
          setValutazione(v);
          setCaricato(true);
        }
      })
      .catch((err) => {
        if (attivo) {
          setErrore((err as Error).message);
          setCaricato(true);
        }
      });
    return () => {
      attivo = false;
    };
  }, [repo, sistemaId]);

  if (ERRORE_REGOLE || !REGOLE) {
    return (
      <section className="riquadro-valutazione">
        <h2>Valutazione AI Act</h2>
        <p role="alert" className="avviso">
          Regole non caricate: {ERRORE_REGOLE ? ERRORE_REGOLE.problemi.join('; ') : 'file regole assente'}
        </p>
      </section>
    );
  }
  const regole = REGOLE;

  async function avvia(conRichiesta: boolean) {
    if (conRichiesta && !(await conferma('Avviare una nuova valutazione? Quella attuale resterà nello storico.'))) return;
    try {
      setErrore(null);
      await repo.avviaValutazione(sistemaId, regole.meta.versione);
      navigate(`/sistemi/${sistemaId}/valutazione`);
    } catch (err) {
      setErrore((err as Error).message);
    }
  }

  const classe = valutazione ? (valutazione.classeConfermata ?? valutazione.esito?.classe ?? null) : null;
  const daRivedere = valutazione !== null && valutazione.versioneRegole !== regole.meta.versione;

  return (
    <section className="riquadro-valutazione">
      <h2>Valutazione AI Act</h2>
      {errore && <p role="alert" className="avviso">{errore}</p>}
      {caricato && (
        <>
          <p className="stato-valutazione">
            <span>{valutazione ? STATI[valutazione.stato] : 'Non avviata'}</span>
            {classe && <span className="classe-valutazione">{ETICHETTE_CLASSE[classe]}</span>}
            {daRivedere && <span className="badge-rivedere">Da rivedere</span>}
          </p>
          <div className="azioni-modulo">
            {!valutazione && (
              <button type="button" className="pulsante pulsante-primario" onClick={() => avvia(false)}>
                Avvia valutazione
              </button>
            )}
            {valutazione?.stato === 'in_corso' && (
              <Link className="pulsante pulsante-primario" to={`/sistemi/${sistemaId}/valutazione`}>Riprendi</Link>
            )}
            {valutazione && valutazione.stato !== 'in_corso' && (
              <Link className="pulsante pulsante-primario" to={`/sistemi/${sistemaId}/valutazione/esito`}>Vedi esito</Link>
            )}
            {valutazione && (
              <button type="button" className="pulsante" onClick={() => avvia(true)}>Nuova valutazione</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
