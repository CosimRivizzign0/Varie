import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { validaCliente } from '../../domain/cliente';
import { calcolaRoadmap } from '../../domain/roadmap';
import { sintesiPerRoadmap, type SintesiValutazione } from '../../domain/valutazione';
import { REGOLE } from '../../regole/attive';
import { RUOLI, type Attivita, type Cliente, type SistemaAI } from '../../domain/tipi';
import { ErroreValidazione } from '../../archivio/errori';
import { useRepository } from '../RepositoryContext';
import { Campo } from '../componenti/Campo';
import { RoadmapBar } from '../componenti/RoadmapBar';
import { conferma } from '../conferma';

interface Valori {
  ragioneSociale: string;
  partitaIva: string;
  settore: string;
  referenteNome: string;
  referenteEmail: string;
  note: string;
  aiLiteracyDocumentata: boolean;
  aiLiteracyData: string;
}

const VUOTO: Valori = {
  ragioneSociale: '',
  partitaIva: '',
  settore: '',
  referenteNome: '',
  referenteEmail: '',
  note: '',
  aiLiteracyDocumentata: false,
  aiLiteracyData: '',
};

const daCliente = (c: Cliente): Valori => ({
  ragioneSociale: c.ragioneSociale,
  partitaIva: c.partitaIva,
  settore: c.settore,
  referenteNome: c.referenteNome,
  referenteEmail: c.referenteEmail ?? '',
  note: c.note ?? '',
  aiLiteracyDocumentata: c.aiLiteracyDocumentata,
  aiLiteracyData: c.aiLiteracyData ?? '',
});

const opz = (s: string) => (s.trim() === '' ? null : s);
const input = (v: Valori) => ({ ...v, referenteEmail: opz(v.referenteEmail), note: opz(v.note), aiLiteracyData: opz(v.aiLiteracyData) });

const due = (n: number) => String(n).padStart(2, '0');
function formattaQuando(iso: string): string {
  const d = new Date(iso);
  return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()} ${due(d.getHours())}:${due(d.getMinutes())}`;
}

export function SchedaCliente() {
  const { id } = useParams();
  return <Contenuto key={id ?? 'nuovo'} id={id} />;
}

function Contenuto({ id }: { id: string | undefined }) {
  const repo = useRepository();
  const navigate = useNavigate();
  const [valori, setValori] = useState<Valori>(VUOTO);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistemi, setSistemi] = useState<SistemaAI[]>([]);
  const [sintesi, setSintesi] = useState<SintesiValutazione[]>([]);
  const [log, setLog] = useState<Attivita[]>([]);
  const [caricato, setCaricato] = useState(id === undefined);
  const [toccati, setToccati] = useState<Set<string>>(new Set());
  const [tentato, setTentato] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const inCorso = useRef(false);
  const [avviso, setAvviso] = useState<string | null>(null);

  /** Rilegge cliente, sistemi e log; `aggiornaModulo: false` lascia intatti i valori del modulo. */
  const ricarica = useCallback(async ({ aggiornaModulo = true }: { aggiornaModulo?: boolean } = {}) => {
    if (!id) return;
    const c = await repo.getCliente(id);
    if (!c || c.eliminatoIl !== null) {
      setCliente(null);
      setCaricato(true);
      return;
    }
    const [s, a] = await Promise.all([repo.elencaSistemi(id), repo.elencaAttivita(id)]);
    setCliente(c);
    if (aggiornaModulo) setValori(daCliente(c));
    const attive = await Promise.all(s.map((x) => repo.getValutazioneAttiva(x.id)));
    const sint = sintesiPerRoadmap(s, attive, REGOLE?.meta.versione ?? '');
    setSintesi(REGOLE ? sint : sint.map((x) => ({ ...x, daRivedere: false })));
    setSistemi(s);
    setLog(a);
    setCaricato(true);
  }, [repo, id]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  if (!caricato) return <p>Caricamento…</p>;
  if (id && !cliente) {
    return (
      <section>
        <p>Cliente non trovato.</p>
        <Link to="/">Torna ai clienti</Link>
      </section>
    );
  }

  const esito = validaCliente(input(valori), new Date());
  const errori = (esito.ok ? {} : esito.errori) as Record<string, string | undefined>;
  const errore = (k: keyof Valori) => (tentato || toccati.has(k) ? errori[k] : undefined);
  const haErrori = Object.keys(errori).length > 0;

  const imposta = <K extends keyof Valori>(k: K, v: Valori[K]) => {
    setValori((prev) => ({ ...prev, [k]: v }));
    setToccati((prev) => new Set(prev).add(k));
  };

  async function salva(e: FormEvent) {
    e.preventDefault();
    setTentato(true);
    if (haErrori || inCorso.current) return;
    inCorso.current = true;
    setSalvataggio(true);
    setAvviso(null);
    try {
      if (id) {
        await repo.aggiornaCliente(id, input(valori));
        await ricarica();
      } else {
        const nuovo = await repo.creaCliente(input(valori));
        navigate(`/clienti/${nuovo.id}`);
        return;
      }
    } catch (err) {
      setAvviso(
        err instanceof ErroreValidazione ? Object.values(err.errori).join('; ') : (err as Error).message,
      );
    } finally {
      inCorso.current = false;
      setSalvataggio(false);
    }
  }

  async function confermaInventario() {
    if (!id) return;
    setAvviso(null);
    try {
      await repo.confermaInventario(id);
      // Modifiche non ancora salvate nel modulo: non vanno perse.
      const modificato = cliente !== null && JSON.stringify(valori) !== JSON.stringify(daCliente(cliente));
      await ricarica({ aggiornaModulo: !modificato });
    } catch (err) {
      setAvviso((err as Error).message);
    }
  }

  async function spostaNelCestino() {
    if (!id) return;
    if (!(await conferma('Spostare il cliente nel cestino?'))) return;
    try {
      await repo.eliminaCliente(id);
      navigate('/');
    } catch (err) {
      setAvviso((err as Error).message);
    }
  }

  const testo = (k: 'ragioneSociale' | 'partitaIva' | 'settore' | 'referenteNome', etichetta: string) => (
    <Campo etichetta={etichetta} errore={errore(k)}>
      {(p) => <input {...p} type="text" value={valori[k]} onChange={(e) => imposta(k, e.target.value)} />}
    </Campo>
  );

  return (
    <section>
      <p><Link to="/">← Clienti</Link></p>
      <h1>{cliente ? cliente.ragioneSociale : 'Nuovo cliente'}</h1>
      {cliente && (
        <RoadmapBar roadmap={calcolaRoadmap(cliente, sistemi, new Date(), sintesi)} variante="estesa" />
      )}
      {avviso && <div role="alert" className="avviso">{avviso}</div>}

      <form onSubmit={salva} noValidate className="modulo">
        {testo('ragioneSociale', 'Ragione sociale')}
        {testo('partitaIva', 'Partita IVA')}
        {testo('settore', 'Settore')}
        {testo('referenteNome', 'Referente')}
        <Campo etichetta="Email referente" errore={errore('referenteEmail')}>
          {(p) => (
            <input {...p} type="email" value={valori.referenteEmail} onChange={(e) => imposta('referenteEmail', e.target.value)} />
          )}
        </Campo>
        <Campo etichetta="Note" errore={errore('note')}>
          {(p) => <textarea {...p} value={valori.note} onChange={(e) => imposta('note', e.target.value)} />}
        </Campo>
        <Campo etichetta="Formazione AI documentata" errore={errore('aiLiteracyDocumentata')}>
          {(p) => (
            <input {...p} type="checkbox" checked={valori.aiLiteracyDocumentata} onChange={(e) => imposta('aiLiteracyDocumentata', e.target.checked)} />
          )}
        </Campo>
        <Campo etichetta="Data ultima formazione AI" errore={errore('aiLiteracyData')}>
          {(p) => (
            <input {...p} type="date" value={valori.aiLiteracyData} onChange={(e) => imposta('aiLiteracyData', e.target.value)} />
          )}
        </Campo>
        <div className="azioni-modulo">
          <button type="submit" className="pulsante pulsante-primario" disabled={haErrori || salvataggio}>
            Salva
          </button>
        </div>
      </form>

      {cliente && (
        <>
          <h2>Sistemi AI</h2>
          {sistemi.length === 0 ? (
            <p className="vuoto">Nessun sistema AI registrato.</p>
          ) : (
            <ul className="elenco-sistemi">
              {sistemi.map((s) => (
                <li key={s.id}>
                  <Link to={`/sistemi/${s.id}`}>{s.nome}</Link>
                  <span> — {s.fornitore} — {RUOLI[s.ruoloCliente]}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="barra-azioni">
            <Link className="pulsante" to={`/clienti/${cliente.id}/sistemi/nuovo`}>Aggiungi sistema AI</Link>
            <button type="button" className="pulsante" onClick={confermaInventario}>Conferma inventario</button>
            <button type="button" className="pulsante pulsante-pericolo" onClick={spostaNelCestino}>Sposta nel cestino</button>
          </div>

          <h2>Log attività</h2>
          <ul className="log">
            {log.map((a) => (
              <li key={a.id}>{formattaQuando(a.quando)} — {a.descrizione}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
