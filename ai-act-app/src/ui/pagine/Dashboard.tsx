import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cliente } from '../../domain/tipi';
import { calcolaRoadmap, type Roadmap } from '../../domain/roadmap';
import { normalizzaPartitaIva } from '../../domain/partitaIva';
import { useRepository } from '../RepositoryContext';
import { RoadmapBar } from '../componenti/RoadmapBar';

interface Riga {
  cliente: Cliente;
  roadmap: Roadmap;
}

const TAPPE = ['Anagrafica', 'Inventario', 'Questionario', 'Classificazione', 'Report'] as const;

export function Dashboard() {
  const repo = useRepository();
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [tappa, setTappa] = useState('');

  useEffect(() => {
    let attivo = true;
    (async () => {
      const clienti = await repo.elencaClienti();
      const oggi = new Date();
      const caricate = await Promise.all(
        clienti.map(async (cliente) => ({
          cliente,
          roadmap: calcolaRoadmap(cliente, await repo.elencaSistemi(cliente.id), oggi),
        })),
      );
      if (attivo) setRighe(caricate);
    })();
    return () => {
      attivo = false;
    };
  }, [repo]);

  const q = ricerca.trim().toLowerCase();
  const qPiva = normalizzaPartitaIva(ricerca.trim());
  const visibili = (righe ?? []).filter(({ cliente, roadmap }) => {
    const okRicerca =
      q === '' ||
      cliente.ragioneSociale.toLowerCase().includes(q) ||
      (qPiva !== '' && cliente.partitaIva.includes(qPiva));
    const okTappa = tappa === '' || roadmap.tappe.some((t) => t.stato === 'in_corso' && t.etichetta === tappa);
    return okRicerca && okTappa;
  });

  return (
    <section>
      <div className="barra-azioni">
        <h1>Clienti</h1>
        <Link className="pulsante pulsante-primario" to="/clienti/nuovo">Nuovo cliente</Link>
        <Link className="pulsante" to="/cestino">Cestino</Link>
      </div>
      <div className="filtri">
        <input
          type="search"
          aria-label="Cerca"
          placeholder="Cerca per ragione sociale o P.IVA"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <label>
          Filtra per tappa{' '}
          <select value={tappa} onChange={(e) => setTappa(e.target.value)}>
            <option value="">Tutte</option>
            {TAPPE.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {righe === null ? (
        <p>Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="vuoto">Nessun cliente. Inizia con «Nuovo cliente».</p>
      ) : visibili.length === 0 ? (
        <p className="vuoto">Nessun cliente corrisponde ai filtri.</p>
      ) : (
        <ul className="elenco-clienti">
          {visibili.map(({ cliente, roadmap }) => (
            <li key={cliente.id} className="riga-cliente">
              <div className="riga-testa">
                <Link to={`/clienti/${cliente.id}`} className="nome-cliente">{cliente.ragioneSociale}</Link>
                {cliente.aiLiteracyDocumentata ? (
                  <span className="badge badge-ok">AI literacy ✓</span>
                ) : (
                  <span className="badge badge-attenzione">AI literacy da documentare</span>
                )}
              </div>
              <RoadmapBar roadmap={roadmap} variante="compatta" />
              <p className="prossima-azione">{roadmap.prossimaAzione}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
