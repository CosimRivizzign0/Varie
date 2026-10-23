export function normalizzaPartitaIva(raw: string): string {
  return raw.replace(/[\s.\-]/g, '').replace(/^IT/i, '');
}

export function validaPartitaIva(raw: string): boolean {
  const p = normalizzaPartitaIva(raw);
  if (!/^\d{11}$/.test(p)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    let cifra = Number(p[i]);
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return somma % 10 === 0;
}
