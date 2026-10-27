import { beforeAll, describe, expect, it } from 'vitest';
import type { Cliente, SistemaAI } from '../../src/domain/tipi';
import { nomeFileExcel, nomeFileWord, ripulisci } from '../../src/report/nomiFile';

beforeAll(() => {
  process.env.TZ = 'Europe/Rome';
});

const VIETATI = /[\\/:*?"<>|\u0000-\u001f]/;
const cliente = { ragioneSociale: 'Officina Rossi Srl' } as Cliente;
const sistema = { nome: 'Assistente HR' } as SistemaAI;

describe('ripulisci', () => {
  it('toglie i caratteri vietati e sostituisce gli spazi con -', () => {
    const r = ripulisci('A/B:C*"x"');
    expect(r).not.toMatch(VIETATI);
    expect(r).toBe('ABCx');
    expect(ripulisci('Officina  Rossi\tSrl')).toBe('Officina-Rossi-Srl');
    expect(ripulisci('a\\b?c<d>e|f')).toBe('abcdef');
  });

  it('al massimo 80 caratteri', () => {
    expect(ripulisci('x'.repeat(200)).length).toBe(80);
    expect(ripulisci('ab '.repeat(60)).length).toBeLessThanOrEqual(80);
  });

  it('non spezza le coppie surrogate e non lascia - o . finali', () => {
    const r = ripulisci('😀'.repeat(100));
    expect([...r].length).toBe(80);
    expect(ripulisci('nome. ')).toBe('nome');
  });

  it('mantiene accenti e apostrofi', () => {
    expect(ripulisci("L'Officina è già")).toBe("L'Officina-è-già");
  });

  it('valore vuoto o solo vietato: segnaposto', () => {
    expect(ripulisci('')).toBe('senza-nome');
    expect(ripulisci('///')).toBe('senza-nome');
  });

  it('nomi riservati di Windows', () => {
    expect(ripulisci('CON')).toBe('CON_');
    expect(ripulisci('com1')).toBe('com1_');
  });
});

describe('nomi dei file', () => {
  const oggi = () => new Date(2026, 9, 3, 23, 50);

  it('Word', () => {
    expect(nomeFileWord(cliente, sistema, oggi())).toBe('AI-Act_Officina-Rossi-Srl_Assistente-HR_2026-10-03.docx');
  });

  it('Excel', () => {
    expect(nomeFileExcel(cliente, oggi())).toBe('AI-Act_Officina-Rossi-Srl_inventario_2026-10-03.xlsx');
  });

  it('Review Focus #1: caratteri vietati e nomi lunghi, estensione corretta', () => {
    const c = { ragioneSociale: 'A/B:C*"x"' + 'y'.repeat(150) } as Cliente;
    const s = { nome: '<Sis|tema>?' + 'z'.repeat(150) } as SistemaAI;
    const w = nomeFileWord(c, s, oggi());
    const x = nomeFileExcel(c, oggi());
    expect(w).not.toMatch(VIETATI);
    expect(x).not.toMatch(VIETATI);
    expect(w.endsWith('.docx')).toBe(true);
    expect(x.endsWith('.xlsx')).toBe(true);
    const parti = w.slice(0, -5).split('_');
    expect(parti).toHaveLength(4);
    expect(parti[1].length).toBeLessThanOrEqual(80);
    expect(parti[2].length).toBeLessThanOrEqual(80);
  });

  it('la data è il giorno di calendario locale', () => {
    expect(nomeFileExcel(cliente, new Date(2026, 0, 1, 0, 5))).toContain('_2026-01-01.xlsx');
  });
});
