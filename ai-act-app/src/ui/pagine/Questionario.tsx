import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { SistemaAI } from '../../domain/tipi';
import type { Valutazione } from '../../domain/valutazione';
import { ERRORE_REGOLE, REGOLE } from '../../regole/attive';
import { calcolaEsito, domandeVisibili } from '../../regole/motore';
import { SEZIONI, type Risposta, type Risposte } from '../../regole/tipi';
import { useRepository } from '../RepositoryContext';

const OPZIONI: { valore: Risposta; etichetta: string }[] = [
  { valore: 'si', etichetta: 'Sì' },
  { valore: 'no', etichetta: 'No' },
  { valore: 'non_so', etichetta: 'Non so' },
];

export function Questionario() {
  const { id } = useParams();
  return <Contenuto key={id} id={id ?? ''} />;
}

function Contenuto({ id }: { id: string }) {
  const repo = useRepository();
  const navigate = useNavigate();
  const [sistema, setSistema] = useState<SistemaAI | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [risposte, setRisposte] = useState<Risposte>({});
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  // Coda di salvataggio: si salva sempre l'ultimo stato, in sequenza.
  const ultime = useRef<Risposte>({});
  const sporco = useRef(false);
  const inVolo = useRef(false);
  const attivo = useRef(true);
  const ultimaSalvata = useRef<Valutazione | null>(null);

  useEffect(() => {
    attivo.current = true;
    (async () => {
      try {
        const s = await repo.getSistema(id);
        const v = s && s.eliminatoIl === null ? await repo.getValutazioneAttiva(id) : null;
        if (!attivo.current) return;
        setSistema(s && s.eliminatoIl === null ? s : null);
        setValutazione(v);
        ultimaSalvata.current = v;
        if (v) {
          ultime.current = v.risposte;
          setRisposte(v.risposte);
        }
        setCaricato(true);
      } catch (err) {
        if (attivo.current) {
          setErrore((err as Error).message);
          setCaricato(true);
        }
      }
    })();
    return () => {
      attivo.current = false;
    };
  }, [repo, id]);

  if (ERRORE_REGOLE || !REGOLE) {
    return (
      <section>
        <p role="alert" className="avviso">
          Regole non caricate: {ERRORE_REGOLE ? ERRORE_REGOLE.problemi.join('; ') : 'file regole assente'}
        </p>
        <Link to={`/sistemi/${id}`}>Torna al sistema</Link>
      </section>
    );
  }
  const regole = REGOLE;

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
  const valutazioneId = valutazione.id;
  const ruolo = sistema.ruoloCliente;

  async function svuotaCoda() {
    if (inVolo.current) return;
    inVolo.current = true;
    try {
      while (sporco.current) {
        sporco.current = false;
        const istantanea = ultime.current;
        const esito = calcolaEsito(regole, istantanea, ruolo);
        try {
          const v = await repo.salvaRisposte(valutazioneId, istantanea, esito);
          ultimaSalvata.current = v;
          if (attivo.current) {
            setValutazione(v);
            setErrore(null);
          }
        } catch (err) {
          sporco.current = false;
          if (attivo.current) {
            setErrore((err as Error).message);
            if (ultimaSalvata.current) {
              ultime.current = ultimaSalvata.current.risposte;
              setRisposte(ultimaSalvata.current.risposte);
            }
          }
        }
      }
    } finally {
      inVolo.current = false;
    }
  }

  function rispondi(domandaId: string, valore: Risposta) {
    const nuove = { ...ultime.current, [domandaId]: valore };
    ultime.current = nuove;
    sporco.current = true;
    setRisposte(nuove);
    void svuotaCoda();
  }

  const visibili = domandeVisibili(regole, risposte);
  const sezioni = SEZIONI.filter((s) => visibili.some((d) => d.sezione === s.id));
  const indice = Math.min(pagina, Math.max(sezioni.length - 1, 0));
  const sezione = sezioni[indice];
  const domandeSezione = sezione ? visibili.filter((d) => d.sezione === sezione.id) : [];
  const risposteDate = visibili.filter((d) => risposte[d.id] !== undefined).length;
  const ultima = indice >= sezioni.length - 1;

  return (
    <section>
      <p><Link to={`/sistemi/${id}`}>{sistema.nome}</Link></p>
      <h1>Valutazione AI Act</h1>
      {errore && <div role="alert" className="avviso">{errore}</div>}
      {sezione && <h2>Sezione {indice + 1} di {sezioni.length} — {sezione.etichetta}</h2>}
      <div className="avanzamento">
        <progress max={visibili.length} value={risposteDate} aria-label="Avanzamento" />
        <span>{risposteDate}/{visibili.length}</span>
      </div>
      {domandeSezione.map((d) => (
        <fieldset key={d.id} className="domanda">
          <legend>{d.testo}</legend>
          <p className="domanda-riferimento">{d.riferimento}</p>
          {d.aiuto && (
            <details>
              <summary>Aiuto</summary>
              <p>{d.aiuto}</p>
            </details>
          )}
          <div className="domanda-opzioni">
            {OPZIONI.map((o) => (
              <label key={o.valore}>
                <input
                  type="radio"
                  name={d.id}
                  value={o.valore}
                  checked={risposte[d.id] === o.valore}
                  onChange={() => rispondi(d.id, o.valore)}
                />{' '}
                {o.etichetta}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="azioni-modulo">
        <button type="button" className="pulsante" disabled={indice === 0} onClick={() => setPagina(indice - 1)}>
          Indietro
        </button>
        {ultima ? (
          <button
            type="button"
            className="pulsante pulsante-primario"
            onClick={() => navigate(`/sistemi/${id}/valutazione/esito`)}
          >
            Vai all'esito
          </button>
        ) : (
          <button type="button" className="pulsante pulsante-primario" onClick={() => setPagina(indice + 1)}>
            Avanti
          </button>
        )}
      </div>
    </section>
  );
}
