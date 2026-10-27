import { describe, expect, it } from 'vitest';
import { validaSistema } from '../../src/domain/sistema';

const valido = {
  nome: 'Chatbot assistenza',
  fornitore: 'Acme AI',
  scopo: "Risposte ai clienti sull'ordine",
  reparto: 'Customer care',
  dataAvvio: '2026-03-01',
  ruoloCliente: 'deployer',
};

function errori(patch: Record<string, unknown>) {
  const r = validaSistema({ ...valido, ...patch });
  if (r.ok) throw new Error('atteso errore');
  return r.errori as Record<string, string>;
}

describe('validaSistema', () => {
  it('accetta un sistema valido', () => {
    expect(validaSistema(valido)).toEqual({ ok: true, valore: valido });
  });

  it('scarta proprietà extra', () => {
    expect(validaSistema({ ...valido, id: '1', clienteId: '2' })).toEqual({ ok: true, valore: valido });
  });

  it('nome', () => {
    const m = 'Inserisci il nome del sistema (2–200 caratteri)';
    expect(errori({ nome: 'X' }).nome).toBe(m);
    expect(errori({ nome: 'X'.repeat(201) }).nome).toBe(m);
  });

  it('fornitore', () => {
    expect(errori({ fornitore: '' }).fornitore).toBe('Inserisci il fornitore');
  });

  it('scopo', () => {
    expect(errori({ scopo: '' }).scopo).toBe("Descrivi lo scopo d'uso");
  });

  it('ruoloCliente', () => {
    expect(errori({ ruoloCliente: 'altro' }).ruoloCliente).toBe('Seleziona il ruolo del cliente');
  });

  it('dataAvvio malformata', () => {
    expect(errori({ dataAvvio: 'ieri' }).dataAvvio).toBe('Data non valida');
  });

  it('opzionali vuoti diventano null', () => {
    const r = validaSistema({ ...valido, reparto: ' ', dataAvvio: '' });
    expect(r.ok && r.valore.reparto).toBeNull();
    expect(r.ok && r.valore.dataAvvio).toBeNull();
  });
});
