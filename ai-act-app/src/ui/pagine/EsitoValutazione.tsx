import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ErroreValidazione } from '../../archivio/errori';
import type { SistemaAI } from '../../domain/tipi';
import type { Valutazione } from '../../domain/valutazione';
import { ERRORE_REGOLE, REGOLE } from '../../regole/attive';
import { ETICHETTE_CLASSE, type Classe } from '../../regole/tipi';
import { useRepository } from '../RepositoryContext';
import { Campo } from '../componenti/Campo';
import { formattaData } from '../formatoData';

const CLASSI = Object.keys(ETICHETTE_CLASSE) as Classe[];

export function EsitoValutazione() {
  const { id } = useParams();
  return <Contenuto key={id} id={id ?? ''} />;
}

function Contenuto({ id }: { id: string }) {
  const repo = useRepository();
  const [sistema, setSistema] = useState<SistemaAI | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [modifica, setModifica] = useState(false);
  const [classe, setClasse] = useState<Classe>('minimo');
  const [nota, setNota] = useState('');
  const [errNota, setErrNota] = useState<string | undefined>();
  const [inCorso, setInCorso] = useState(false);
  const bloccato = useRef(false);

  useEffect(() => {
    let attivo = true;
    (async () => {
      try {
        const s = await repo.getSistema(id);
        const ok = s && s.eliminatoIl === null ? s : null;
        const v = ok ? await repo.getValutazioneAttiva(id) : null;
        if (!attivo) return;
        setSistema(ok);
        setValutazione(v);
        if (v?.esito) setClasse(v.esito.classe);
      } catch (err) {
        if (attivo) setErrore((err as Error).message);
      } finally {
        if (attivo) setCaricato(true);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [repo, id]);

  if (errore && !sistema) return <div role="alert" className="avviso">{errore}</div>;
  if (!caricato) return <p>Caricamento…</p>;
  if (!sistema) {
    return (
      <section>
        <p>Sistema non trovato</p>
        <Link to="/">Torna ai clienti</Link>
      </section>
    );
  }
  if (!valutazione) return <Navigate to={`/sistemi/${id}`} replace />;

  const esito = valutazione.esito;
  const intestazione = (
    <>
      <p><Link to={`/sistemi/${id}`}>{sistema.nome}</Link></p>
      <h1>Esito della valutazione</h1>
      <p><Link to={`/sistemi/${id}/valutazione`}>Torna al questionario</Link></p>
    </>
  );

  if (valutazione.stato === 'in_corso' || !esito) {
    return (
      <section>
        {intestazione}
        <p>Questionario incompleto</p>
      </section>
    );
  }

  const valutazioneId = valutazione.id;
  const confermata = valutazione.stato === 'confermata';
  const domande = ERRORE_REGOLE ? [] : (REGOLE?.domande ?? []);
  const classeModificata =
    confermata && valutazione.classeConfermata !== null && valutazione.classeConfermata !== esito.classe
      ? valutazione.classeConfermata
      : null;

  async function salva(classeScelta: Classe, notaScelta: string | null) {
    if (bloccato.current) return;
    bloccato.current = true;
    setInCorso(true);
    setErrore(null);
    setErrNota(undefined);
    try {
      await repo.confermaValutazione(valutazioneId, classeScelta, notaScelta);
      const v = await repo.getValutazioneAttiva(id);
      setValutazione(v);
      setModifica(false);
      setNota('');
    } catch (err) {
      if (err instanceof ErroreValidazione) {
        setErrNota(err.errori.nota);
        const altri = Object.entries(err.errori).filter(([k]) => k !== 'nota').map(([, m]) => m);
        if (altri.length > 0) setErrore(altri.join('; '));
      } else {
        setErrore((err as Error).message);
      }
    } finally {
      bloccato.current = false;
      setInCorso(false);
    }
  }

  return (
    <section>
      {intestazione}
      {errore && <div role="alert" className="avviso">{errore}</div>}

      <p className="esito-classe" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
        {ETICHETTE_CLASSE[classeModificata ?? esito.classe]}
      </p>
      {classeModificata && (
        <>
          <p>Classe calcolata: {ETICHETTE_CLASSE[esito.classe]}</p>
          <p className="avviso">
            Classificazione modificata dal consulente: gli obblighi elencati si riferiscono alla classe calcolata.
          </p>
        </>
      )}
      {esito.trasparenza && <p>+ obblighi di trasparenza</p>}
      {esito.dataApplicazioneClasse && <p>Applicabile dal {formattaData(esito.dataApplicazioneClasse)}</p>}

      {esito.vociNonValidate > 0 && (
        <p className="avviso">
          Regole non ancora validate ({esito.vociNonValidate} di {esito.vociUsate.length}): verificare l'esito prima di consegnarlo.
        </p>
      )}
      {esito.ruoloEffettivo === 'da_definire' && (
        <p className="avviso">Ruolo del cliente da definire: sono mostrati gli obblighi di tutti i ruoli.</p>
      )}

      {esito.motivazione.length > 0 && (
        <>
          <h2>Motivazione</h2>
          <ul>
            {esito.motivazione.map((m, i) => (
              <li key={i}>{m.testo} — {m.riferimento}</li>
            ))}
          </ul>
        </>
      )}

      {esito.aperte.length > 0 && (
        <>
          <h2>Punti da approfondire</h2>
          <ul>
            {esito.aperte.map((a) => (
              <li key={a}>{domande.find((d) => d.id === a)?.testo ?? a}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Obblighi</h2>
      {esito.obblighi.length === 0 ? (
        <p>Nessun obbligo applicabile.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Obbligo</th><th>Riferimento</th><th>Dal</th></tr>
          </thead>
          <tbody>
            {esito.obblighi.map((o) => (
              <tr key={o.id}>
                <td>{o.testo}</td>
                <td>{o.riferimento}</td>
                <td>{formattaData(o.dataApplicazione)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p><small>{REGOLE?.meta.norma ?? ''}{REGOLE ? ' · ' : ''}Regole v{valutazione.versioneRegole}</small></p>

      {confermata && (
        <div className="esito-confermato">
          <p>Confermata il {formattaData(valutazione.confermatoIl ?? valutazione.modificatoIl)}</p>
          {valutazione.notaModifica && <p>{valutazione.notaModifica}</p>}
        </div>
      )}

      {!modifica && (
        <div className="azioni-modulo">
          {!confermata && (
            <button type="button" className="pulsante pulsante-primario" disabled={inCorso} onClick={() => void salva(esito.classe, null)}>
              Conferma classificazione
            </button>
          )}
          <button
            type="button"
            className="pulsante"
            disabled={inCorso}
            onClick={() => {
              setClasse(valutazione.classeConfermata ?? esito.classe);
              setModifica(true);
            }}
          >
            Modifica classificazione
          </button>
        </div>
      )}

      {modifica && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salva(classe, nota);
          }}
        >
          <div className="campo">
            <label htmlFor="classe-modifica">Classe</label>
            <select id="classe-modifica" value={classe} onChange={(e) => setClasse(e.target.value as Classe)}>
              {CLASSI.map((c) => (
                <option key={c} value={c}>{ETICHETTE_CLASSE[c]}</option>
              ))}
            </select>
          </div>
          <Campo etichetta="Motivo della modifica" errore={errNota}>
            {(p) => <textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} />}
          </Campo>
          <div className="azioni-modulo">
            <button type="submit" className="pulsante pulsante-primario" disabled={inCorso}>Salva modifica</button>
            <button type="button" className="pulsante" disabled={inCorso} onClick={() => { setModifica(false); setErrNota(undefined); setErrore(null); }}>
              Annulla
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
