import type { Cliente, SistemaAI } from '../domain/tipi';
import { giornoDiDate } from '../domain/formatoData';

const MAX_PARTE = 80;
const VIETATI = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RISERVATI = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Parte di nome file valida su Windows e macOS: niente caratteri vietati, spazi come `-`,
 * al massimo 80 caratteri (senza spezzare le coppie surrogate), mai vuota.
 */
export function ripulisci(s: string): string {
  let r = s.normalize('NFC').replace(/\s+/g, '-').replace(VIETATI, '').replace(/-{2,}/g, '-');
  r = [...r].slice(0, MAX_PARTE).join('');
  r = r.replace(/^[-.]+|[-.]+$/g, '');
  if (r === '') return 'senza-nome';
  return RISERVATI.test(r) ? `${r}_` : r;
}

/** `oggi` è il giorno di calendario locale. */
export function nomeFileWord(cliente: Cliente, sistema: SistemaAI, oggi: Date): string {
  return `AI-Act_${ripulisci(cliente.ragioneSociale)}_${ripulisci(sistema.nome)}_${giornoDiDate(oggi)}.docx`;
}

export function nomeFileExcel(cliente: Cliente, oggi: Date): string {
  return `AI-Act_${ripulisci(cliente.ragioneSociale)}_inventario_${giornoDiDate(oggi)}.xlsx`;
}
