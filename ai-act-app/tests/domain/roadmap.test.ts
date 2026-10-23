import { describe, expect, it } from 'vitest';
import { calcolaRoadmap } from '../../src/domain/roadmap';
import type { Cliente, SistemaAI } from '../../src/domain/tipi';

const oggi = new Date(2026, 9, 23, 15, 30);
const cliente: Cliente = {
  id: 'c1',
  ragioneSociale: 'Officina Rossi Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: 'mario@rossi.it',
  note: null,
  aiLiteracyDocumentata: true,
  aiLiteracyData: '2026-01-10',
  inventarioConfermato: false,
  creatoIl: '2026-01-01T00:00:00.000Z',
  modificatoIl: '2026-01-01T00:00:00.000Z',
  eliminatoIl: null,
};
function sistemi(n: number): SistemaAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    clienteId: 'c1',
    nome: `Sistema ${i}`,
    fornitore: 'Acme',
    scopo: 'Test',
    reparto: null,
    dataAvvio: null,
    ruoloCliente: 'deployer' as const,
    creatoIl: '2026-01-01T00:00:00.000Z',
    modificatoIl: '2026-01-01T00:00:00.000Z',
    eliminatoIl: null,
  }));
}
const stati = (r: ReturnType<typeof calcolaRoadmap>) => r.tappe.map((t) => t.stato);

describe('calcolaRoadmap', () => {
  it('cliente valido, 0 sistemi', () => {
    const r = calcolaRoadmap(cliente, [], oggi);
    expect(r.percentuale).toBe(20);
    expect(stati(r)).toEqual(['completata', 'in_corso', 'bloccata', 'bloccata', 'bloccata']);
    expect(r.prossimaAzione).toBe('Aggiungi il primo sistema AI');
    expect(r.tappe.map((t) => t.etichetta)).toEqual(['Anagrafica', 'Inventario', 'Questionario', 'Classificazione', 'Report']);
    expect(r.tappe[1].dettaglio).toBe('0 sistemi');
    expect(r.tappe[2].dettaglio).toBe('disponibile dalla Fase 2');
    expect(r.tappe[0].dettaglio).toBeNull();
  });

  it('3 sistemi non confermato', () => {
    const r = calcolaRoadmap(cliente, sistemi(3), oggi);
    expect(r.percentuale).toBe(20);
    expect(r.prossimaAzione).toBe("Conferma l'inventario (3 sistemi)");
    expect(r.tappe[1].dettaglio).toBe('3 sistemi');
  });

  it('1 sistema non confermato', () => {
    const r = calcolaRoadmap(cliente, sistemi(1), oggi);
    expect(r.prossimaAzione).toBe("Conferma l'inventario (1 sistema)");
    expect(r.tappe[1].dettaglio).toBe('1 sistema');
  });

  it('2 sistemi confermato', () => {
    const r = calcolaRoadmap({ ...cliente, inventarioConfermato: true }, sistemi(2), oggi);
    expect(r.percentuale).toBe(40);
    expect(stati(r)).toEqual(['completata', 'completata', 'bloccata', 'bloccata', 'bloccata']);
    expect(r.prossimaAzione).toBe('In attesa della Fase 2');
  });

  it('confermato ma 0 sistemi attivi', () => {
    const r = calcolaRoadmap({ ...cliente, inventarioConfermato: true }, [], oggi);
    expect(r.percentuale).toBe(20);
    expect(r.tappe[1].stato).toBe('in_corso');
    expect(r.prossimaAzione).toBe('Aggiungi il primo sistema AI');
  });

  it('settore vuoto', () => {
    const r = calcolaRoadmap({ ...cliente, settore: '' }, sistemi(2), oggi);
    expect(r.percentuale).toBe(0);
    expect(stati(r)).toEqual(['in_corso', 'da_fare', 'bloccata', 'bloccata', 'bloccata']);
    expect(r.prossimaAzione).toBe("Completa l'anagrafica: manca il settore");
  });

  it('altri campi non validi', () => {
    expect(calcolaRoadmap({ ...cliente, ragioneSociale: '' }, [], oggi).prossimaAzione).toBe("Completa l'anagrafica: manca la ragione sociale");
    expect(calcolaRoadmap({ ...cliente, partitaIva: '123' }, [], oggi).prossimaAzione).toBe("Completa l'anagrafica: manca la Partita IVA");
    expect(calcolaRoadmap({ ...cliente, referenteNome: '' }, [], oggi).prossimaAzione).toBe("Completa l'anagrafica: manca il referente");
    expect(calcolaRoadmap({ ...cliente, referenteEmail: 'x' }, [], oggi).prossimaAzione).toBe("Completa l'anagrafica: manca l'email del referente");
    expect(calcolaRoadmap({ ...cliente, aiLiteracyData: '2999-01-01' }, [], oggi).prossimaAzione).toBe("Completa l'anagrafica: manca la data della formazione AI");
  });
});
