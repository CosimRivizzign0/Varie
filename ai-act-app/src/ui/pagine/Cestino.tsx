import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ElementoCestino } from '../../archivio/repository';
import { useRepository } from '../RepositoryContext';
import { conferma } from '../conferma';

const due = (n: number) => String(n).padStart(2, '0');
function formattaData(iso: string): string {
  const d = new Date(iso);
  return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function Cestino() {
  const repo = useRepository();
  const [elementi, setElementi] = useState<ElementoCestino[] | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  const ricarica = useCallback(async () => {
    try {
      setElementi(await repo.elencaCestino());
    } catch (err) {
      setAvviso((err as Error).message);
    }
  }, [repo]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  async function esegui(azione: () => Promise<void>) {
    setAvviso(null);
    try {
      await azione();
    } catch (err) {
      setAvviso((err as Error).message);
    }
    await ricarica();
  }

  const ripristina = (e: ElementoCestino) =>
    esegui(() => (e.tipo === 'cliente' ? repo.ripristinaCliente(e.id) : repo.ripristinaSistema(e.id)));

  const eliminaDef = async (e: ElementoCestino) => {
    if (!(await conferma("Eliminare definitivamente? L'operazione non si può annullare."))) return;
    await esegui(() => repo.eliminaDefinitivamente(e.tipo, e.id));
  };

  return (
    <section>
      <p><Link to="/">← Torna ai clienti</Link></p>
      <h1>Cestino</h1>
      {avviso && <div role="alert" className="avviso">{avviso}</div>}
      {elementi === null ? (
        !avviso && <p>Caricamento…</p>
      ) : elementi.length === 0 ? (
        <p className="vuoto">Il cestino è vuoto.</p>
      ) : (
        <table className="tabella">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nome</th>
              <th>Cliente</th>
              <th>Eliminato il</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {elementi.map((e) => (
              <tr key={`${e.tipo}-${e.id}`}>
                <td>{e.tipo === 'cliente' ? 'Cliente' : 'Sistema AI'}</td>
                <td>{e.nome}</td>
                <td>{e.clienteNome ?? '—'}</td>
                <td>{formattaData(e.eliminatoIl)}</td>
                <td>
                  <button type="button" className="pulsante" onClick={() => ripristina(e)}>Ripristina</button>{' '}
                  <button type="button" className="pulsante pulsante-pericolo" onClick={() => eliminaDef(e)}>
                    Elimina definitivamente
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="nota">Gli elementi vengono eliminati automaticamente dopo 30 giorni.</p>
    </section>
  );
}
