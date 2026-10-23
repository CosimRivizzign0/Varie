import type { Roadmap } from '../../domain/roadmap';

export function RoadmapBar({ roadmap, variante }: { roadmap: Roadmap; variante: 'compatta' | 'estesa' }) {
  return (
    <div className={`roadmap roadmap-${variante}`}>
      <ol className="roadmap-tappe">
        {roadmap.tappe.map((t) => (
          <li key={t.id} className={`tappa tappa-${t.stato}`} aria-label={`${t.etichetta}: ${t.stato}`}>
            <span className="tappa-etichetta">{t.etichetta}</span>
            {t.dettaglio && <span className="tappa-dettaglio">{t.dettaglio}</span>}
          </li>
        ))}
      </ol>
      <span className="roadmap-percentuale">{roadmap.percentuale}%</span>
      {variante === 'estesa' && (
        <p className="roadmap-azione">▶ Prossima azione: {roadmap.prossimaAzione}</p>
      )}
    </div>
  );
}
