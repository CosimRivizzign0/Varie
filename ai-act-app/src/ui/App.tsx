import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pagine/Dashboard';
import { SchedaCliente } from './pagine/SchedaCliente';
import { Segnaposto } from './pagine/Segnaposto';
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
          <Route path="/clienti/:id/sistemi/nuovo" element={<Segnaposto titolo="Nuovo sistema AI" />} />
          <Route path="/sistemi/:id" element={<Segnaposto titolo="Sistema AI" />} />
          <Route path="/cestino" element={<Segnaposto titolo="Cestino" />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
