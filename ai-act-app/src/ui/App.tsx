import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pagine/Dashboard';
import { SchedaCliente } from './pagine/SchedaCliente';
import { SchedaSistema } from './pagine/SchedaSistema';
import { Cestino } from './pagine/Cestino';
import './stile.css';

export default function App() {
  return (
    <HashRouter>
      <header className="intestazione">
        <Link to="/">AI Act Assessment</Link>
      </header>
      <main className="contenuto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clienti/nuovo" element={<SchedaCliente />} />
          <Route path="/clienti/:id" element={<SchedaCliente />} />
          <Route path="/clienti/:id/sistemi/nuovo" element={<SchedaSistema />} />
          <Route path="/sistemi/:id" element={<SchedaSistema />} />
          <Route path="/cestino" element={<Cestino />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
