import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ImpostazioniStudio } from '../../domain/report';
import { useRepository } from '../RepositoryContext';
import { Campo } from '../componenti/Campo';

const VUOTO: ImpostazioniStudio = { nome: '', indirizzo: '', piva: '', email: '', telefono: '' };

const CAMPI: { k: keyof ImpostazioniStudio; etichetta: string; tipo: 'text' | 'email' | 'tel' }[] = [
  { k: 'nome', etichetta: 'Nome dello studio', tipo: 'text' },
  { k: 'indirizzo', etichetta: 'Indirizzo', tipo: 'text' },
  { k: 'piva', etichetta: 'Partita IVA', tipo: 'text' },
  { k: 'email', etichetta: 'Email', tipo: 'email' },
  { k: 'telefono', etichetta: 'Telefono', tipo: 'tel' },
];

/** Dati dello studio stampati nell'intestazione dei report. */
export function Impostazioni() {
  const repo = useRepository();
  const [valori, setValori] = useState<ImpostazioniStudio>(VUOTO);
  const [caricato, setCaricato] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const inCorso = useRef(false);
  const [salvato, setSalvato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    (async () => {
      try {
        const i = await repo.getImpostazioniStudio();
        if (attivo) setValori(i);
      } catch (err) {
        if (attivo) setErrore((err as Error).message);
      } finally {
        if (attivo) setCaricato(true);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [repo]);

  if (!caricato) return <p>Caricamento…</p>;

  const imposta = (k: keyof ImpostazioniStudio, v: string) => {
    setValori((prev) => ({ ...prev, [k]: v }));
    setSalvato(false);
  };

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (inCorso.current) return;
    inCorso.current = true;
    setSalvataggio(true);
    setSalvato(false);
    setErrore(null);
    try {
      await repo.salvaImpostazioniStudio(valori);
      setValori(await repo.getImpostazioniStudio());
      setSalvato(true);
    } catch (err) {
      setErrore((err as Error).message);
    } finally {
      inCorso.current = false;
      setSalvataggio(false);
    }
  }

  return (
    <section>
      <p><Link to="/">← Clienti</Link></p>
      <h1>Impostazioni</h1>
      <p>Dati dello studio riportati nell'intestazione dei report.</p>
      {errore && <div role="alert" className="avviso">{errore}</div>}
      <form onSubmit={salva} noValidate className="modulo">
        {CAMPI.map(({ k, etichetta, tipo }) => (
          <Campo key={k} etichetta={etichetta}>
            {(p) => <input {...p} type={tipo} value={valori[k]} onChange={(e) => imposta(k, e.target.value)} />}
          </Campo>
        ))}
        <div className="azioni-modulo">
          <button type="submit" className="pulsante pulsante-primario" disabled={salvataggio}>Salva</button>
        </div>
      </form>
      {salvato && <p className="esito-salvataggio" role="status">Impostazioni salvate.</p>}
    </section>
  );
}
