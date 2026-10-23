import { useId, type ReactNode } from 'react';

interface Props {
  etichetta: string;
  errore?: string;
  children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

export function Campo({ etichetta, errore, children }: Props) {
  const id = useId();
  const idErrore = `${id}-errore`;
  return (
    <div className="campo">
      <label htmlFor={id}>{etichetta}</label>
      {children({
        id,
        'aria-describedby': errore ? idErrore : undefined,
        'aria-invalid': errore ? true : undefined,
      })}
      {errore && (
        <span id={idErrore} className="errore-campo">
          {errore}
        </span>
      )}
    </div>
  );
}
