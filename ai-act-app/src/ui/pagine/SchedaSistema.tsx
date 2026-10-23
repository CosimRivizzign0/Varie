import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom';
import { validaSistema } from '../../domain/sistema';
import { RUOLI, type Cliente, type RuoloCliente, type SistemaAI } from '../../domain/tipi';
import { ErroreValidazione } from '../../archivio/errori';
import { useRepository } from '../RepositoryContext';
import { Campo } from '../componenti/Campo';
import { conferma } from '../conferma';

interface Valori {
  nome: string;
  fornitore: string;
  scopo: string;
  reparto: string;
  dataAvvio: string;
  ruoloCliente: RuoloCliente | '';
}

const VUOTO: Valori = { nome: '', fornitore: '', scopo: '', reparto: '', dataAvvio: '', ruoloCliente: '' };

const daSistema = (s: SistemaAI): Valori => ({
  nome: s.nome,
  fornitore: s.fornitore,
  scopo: s.scopo,
  reparto: s.reparto ?? '',
  dataAvvio: s.dataAvvio ?? '',
  ruoloCliente: s.ruoloCliente,
});

const opz = (s: string) => (s.trim() === '' ? null : s);
const input = (v: Valori) => ({ ...v, reparto: opz(v.reparto), dataAvvio: opz(v.dataAvvio) });

export function SchedaSistema() {
  // /sistemi/:id modifica un sistema; /clienti/:id/sistemi/nuovo usa :id come id del cliente
  const { id: param } = useParams();
  const esistente = useMatch('/sistemi/:id') !== null;
  return (
    <Contenuto
      key={esistente ? `s-${param}` : `nuovo-${param}`}
      id={esistente ? param : undefined}
      clienteIdRotta={esistente ? undefined : param}
    />
  );
}

function Contenuto({ id, clienteIdRotta }: { id: string | undefined; clienteIdRotta: string | undefined }) {
  const repo = useRepository();
  const navigate = useNavigate();
  const [valori, setValori] = useState<Valori>(VUOTO);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [toccati, setToccati] = useState<Set<string>>(new Set());
  const [tentato, setTentato] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const inCorso = useRef(false);
  const [avviso, setAvviso] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    (async () => {
      try {
        let cid = clienteIdRotta;
        if (id) {
          const s = await repo.getSistema(id);
          if (!s || s.eliminatoIl !== null) {
            if (attivo) setCaricato(true);
            return;
          }
          cid = s.clienteId;
          if (attivo) setValori(daSistema(s));
        }
        const c = cid ? await repo.getCliente(cid) : null;
        if (attivo) {
          setCliente(c && c.eliminatoIl === null ? c : null);
          setCaricato(true);
        }
      } catch (err) {
        if (attivo) {
          setErroreCaricamento((err as Error).message);
          setCaricato(true);
        }
      }
    })();
    return () => {
      attivo = false;
    };
  }, [repo, id, clienteIdRotta]);

  if (erroreCaricamento) return <div role="alert" className="avviso">{erroreCaricamento}</div>;
  if (!caricato) return <p>Caricamento…</p>;
  if (!cliente) {
    return (
      <section>
        <p>{id ? 'Sistema non trovato' : 'Cliente non trovato'}</p>
        <Link to="/">Torna ai clienti</Link>
      </section>
    );
  }

  const esito = validaSistema(input(valori));
  const errori = (esito.ok ? {} : esito.errori) as Record<string, string | undefined>;
  const errore = (k: keyof Valori) => (tentato || toccati.has(k) ? errori[k] : undefined);
  const haErrori = Object.keys(errori).length > 0;
  const vaiAlCliente = () => navigate(`/clienti/${cliente.id}`);

  const imposta = <K extends keyof Valori>(k: K, v: Valori[K]) => {
    setValori((prev) => ({ ...prev, [k]: v }));
    setToccati((prev) => new Set(prev).add(k));
  };

  async function salva(e: FormEvent) {
    e.preventDefault();
    setTentato(true);
    if (haErrori || inCorso.current || !cliente) return;
    inCorso.current = true;
    setSalvataggio(true);
    setAvviso(null);
    try {
      if (id) await repo.aggiornaSistema(id, input(valori));
      else await repo.creaSistema(cliente.id, input(valori));
      vaiAlCliente();
      return;
    } catch (err) {
      setAvviso(
        err instanceof ErroreValidazione ? Object.values(err.errori).join('; ') : (err as Error).message,
      );
    } finally {
      inCorso.current = false;
      setSalvataggio(false);
    }
  }

  async function spostaNelCestino() {
    if (!id) return;
    if (!(await conferma('Spostare il sistema nel cestino?'))) return;
    try {
      await repo.eliminaSistema(id);
      vaiAlCliente();
    } catch (err) {
      setAvviso((err as Error).message);
    }
  }

  const testo = (k: 'nome' | 'fornitore' | 'reparto', etichetta: string) => (
    <Campo etichetta={etichetta} errore={errore(k)}>
      {(p) => <input {...p} type="text" value={valori[k]} onChange={(e) => imposta(k, e.target.value)} />}
    </Campo>
  );

  return (
    <section>
      <p><Link to={`/clienti/${cliente.id}`}>{cliente.ragioneSociale}</Link></p>
      <h1>{id ? valori.nome || 'Sistema AI' : 'Nuovo sistema AI'}</h1>
      {avviso && <div role="alert" className="avviso">{avviso}</div>}

      <form onSubmit={salva} noValidate className="modulo">
        {testo('nome', 'Nome del sistema')}
        {testo('fornitore', 'Fornitore')}
        <Campo etichetta="Scopo d'uso" errore={errore('scopo')}>
          {(p) => <textarea {...p} value={valori.scopo} onChange={(e) => imposta('scopo', e.target.value)} />}
        </Campo>
        {testo('reparto', 'Reparto')}
        <Campo etichetta="Data di avvio" errore={errore('dataAvvio')}>
          {(p) => <input {...p} type="date" value={valori.dataAvvio} onChange={(e) => imposta('dataAvvio', e.target.value)} />}
        </Campo>
        <Campo etichetta="Ruolo del cliente" errore={errore('ruoloCliente')}>
          {(p) => (
            <select {...p} value={valori.ruoloCliente} onChange={(e) => imposta('ruoloCliente', e.target.value as RuoloCliente | '')}>
              <option value="">Seleziona…</option>
              {(Object.keys(RUOLI) as RuoloCliente[]).map((r) => (
                <option key={r} value={r}>{RUOLI[r]}</option>
              ))}
            </select>
          )}
        </Campo>
        <div className="azioni-modulo">
          <button type="submit" className="pulsante pulsante-primario" disabled={haErrori || salvataggio}>
            Salva
          </button>
          {id && (
            <button type="button" className="pulsante pulsante-pericolo" onClick={spostaNelCestino}>
              Sposta nel cestino
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
