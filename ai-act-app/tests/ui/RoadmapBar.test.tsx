// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoadmapBar } from '../../src/ui/componenti/RoadmapBar';
import type { Roadmap } from '../../src/domain/roadmap';
import './aiuti';

const roadmap: Roadmap = {
  percentuale: 40,
  prossimaAzione: 'In attesa della Fase 2',
  tappe: [
    { id: 'anagrafica', etichetta: 'Anagrafica', stato: 'completata', dettaglio: null },
    { id: 'inventario', etichetta: 'Inventario', stato: 'completata', dettaglio: '2 sistemi' },
    { id: 'questionario', etichetta: 'Questionario', stato: 'bloccata', dettaglio: 'disponibile dalla Fase 2' },
    { id: 'classificazione', etichetta: 'Classificazione', stato: 'bloccata', dettaglio: 'disponibile dalla Fase 2' },
    { id: 'report', etichetta: 'Report', stato: 'bloccata', dettaglio: 'disponibile dalla Fase 2' },
  ],
};

describe('RoadmapBar', () => {
  it('mostra 5 tappe, 2 completate, 3 bloccate e il 40%', () => {
    render(<RoadmapBar roadmap={roadmap} variante="estesa" />);
    const voci = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(voci).toHaveLength(5);
    expect(voci.filter((v) => v.getAttribute('aria-label')?.includes('completata'))).toHaveLength(2);
    expect(screen.getAllByText('disponibile dalla Fase 2')).toHaveLength(3);
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('▶ Prossima azione: In attesa della Fase 2')).toBeInTheDocument();
  });

  it('la variante compatta non mostra la prossima azione', () => {
    render(<RoadmapBar roadmap={roadmap} variante="compatta" />);
    expect(screen.queryByText(/Prossima azione/)).toBeNull();
  });
});
