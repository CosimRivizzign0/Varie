import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import { creaRepository, type Repository } from '../../src/archivio/repository';
import { RepositoryProvider } from '../../src/ui/RepositoryContext';

afterEach(cleanup);

export async function nuovoRepository(): Promise<Repository> {
  const d = await creaSqlJsDriver();
  await migra(d);
  return creaRepository(d);
}

export function renderizza(ui: ReactElement, repo: Repository, percorso = '/') {
  return render(
    <RepositoryProvider repository={repo}>
      <MemoryRouter initialEntries={[percorso]}>{ui}</MemoryRouter>
    </RepositoryProvider>,
  );
}

export const clienteValido = (o: Record<string, unknown> = {}) => ({
  ragioneSociale: 'Acme Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: null,
  note: null,
  aiLiteracyDocumentata: false,
  aiLiteracyData: null,
  ...o,
});
