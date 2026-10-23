import { describe, expect, test } from 'vitest';
import { normalizzaPartitaIva, validaPartitaIva } from '../../src/domain/partitaIva';

describe('partitaIva', () => {
  test.each(['00488410010', '00905811006', 'IT 00488410010', ' 004 884 100 10 ', 'it00488410010'])('valida %s', p => expect(validaPartitaIva(p)).toBe(true));
  test.each(['12345678901', '0048841001', '004884100100', 'ABCDEFGHIJK', ''])('rifiuta %s', p => expect(validaPartitaIva(p)).toBe(false));
  test('normalizza', () => expect(normalizzaPartitaIva('IT 004.884-100 10')).toBe('00488410010'));
});
