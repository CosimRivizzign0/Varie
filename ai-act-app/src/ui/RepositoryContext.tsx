import { createContext, useContext, type ReactNode } from 'react';
import type { Repository } from '../archivio/repository';

const Contesto = createContext<Repository | null>(null);

export function RepositoryProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  return <Contesto.Provider value={repository}>{children}</Contesto.Provider>;
}

export function useRepository(): Repository {
  const repo = useContext(Contesto);
  if (!repo) throw new Error('RepositoryProvider mancante');
  return repo;
}
