import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pagine/Dashboard';
import { SchedaCliente } from './pagine/SchedaCliente';
import { SchedaSistema } from './pagine/SchedaSistema';
import { Questionario } from './pagine/Questionario';
import { Cestino } from './pagine/Cestino';
import './stile.css';

interface Props {
  /** Errore del backup automatico all'avvio: avviso non bloccante. */
  erroreBackup?: string | null;
  /** Primo caricamento dopo un ripristino di backup: avviso non bloccante. */
  ripristinato?: boolean;
}

export default function App({ erroreBackup = null, ripristinato = false }: Props) {
  return (
    <HashRouter>
      <header className="intestazione">
        <Link to="/">AI Act Assessment</Link>
      </header>
      {erroreBackup && (
        <p className="avviso avviso-avvio" role="alert">
          Backup automatico non riuscito: {erroreBackup}
        </p>
      )}
      {ripristinato && (
        <p className="esito-avvio" role="status">
          Backup ripristinato. Gli elementi nel cestino da oltre 30 giorni verranno eliminati al prossimo avvio.
        </p>
      )}
      <main className="contenuto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clienti/nuovo" element={<SchedaCliente />} />
          <Route path="/clienti/:id" element={<SchedaCliente />} />
          <Route path="/clienti/:id/sistemi/nuovo" element={<SchedaSistema />} />
          <Route path="/sistemi/:id" element={<SchedaSistema />} />
          <Route path="/sistemi/:id/valutazione" element={<Questionario />} />
          <Route path="/cestino" element={<Cestino />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
