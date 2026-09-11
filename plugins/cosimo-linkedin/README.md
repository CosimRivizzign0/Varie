# cosimo-linkedin

Sei skill Claude Code per LinkedIn, in italiano, scritte sulla voce di Cosimo
Rivizzigno.

**Non pubblica niente.** Il plugin non ha token, non chiama API e non accede a
LinkedIn: produce bozze, la pubblicazione resta manuale. Dove serve il testo di
un post o di un commento altrui, lo incolla l'utente.

## Skill

| Skill | Cosa fa |
|---|---|
| `/cosimo-linkedin:linkedin-post` | Scrive un post da zero: tre domande preliminari, scelta dell'apertura, sviluppo, chiusa secca. Consegna il post più due aperture alternative. |
| `/cosimo-linkedin:linkedin-commento` | Commenta il post di un altro (testo incollato). Tre modalità: dato mancante, caso limite, esperienza specifica. |
| `/cosimo-linkedin:linkedin-risposta` | Risponde a un commento ricevuto. Prima classifica il commento, poi risponde — inclusa l'opzione "non rispondere". |
| `/cosimo-linkedin:linkedin-piano-editoriale` | Piano da una a quattro settimane. Parte dall'inventario del materiale reale: senza materiale l'uscita non entra nel piano. |
| `/cosimo-linkedin:linkedin-profilo` | Diagnosi e riscrittura del profilo sezione per sezione. |
| `/cosimo-linkedin:cosimo-humanize` | Il riscrittore anti-stile-AI. Le altre cinque skill ci passano prima di consegnare. |

## Riferimenti condivisi

- `references/voce.md` — lessico vietato, i sei tratti stilistici, cosa cambia su LinkedIn.
- `references/ganci.md` — sei aperture (A1-A6), ciascuna con la sua controindicazione, e quelle da non usare.
- `references/checklist-pubblicazione.md` — verifica dei dati, riservatezza dei clienti, forma, consegna.

## Installazione

Il plugin è distribuito dal marketplace `cosimo-plugins` in questo stesso
repository. In una sessione Claude Code:

```
/plugin marketplace add CosimRivizzign0/Varie
/plugin install cosimo-linkedin@cosimo-plugins
```

Il file `.claude/settings.json` del repository registra già marketplace e
plugin: aprendo il progetto e dando fiducia alla cartella, l'installazione
avviene senza comandi.

## Sviluppo

Prova le modifiche senza installare nulla:

```bash
claude --plugin-dir ./plugins/cosimo-linkedin
```

Poi `/reload-plugins` per ricaricare senza riavviare.

Controlli strutturali (frontmatter, allineamento dei manifest, riferimenti ai
file citati nei SKILL.md):

```bash
python3 plugins/cosimo-linkedin/scripts/verifica_plugin.py
claude plugin validate ./plugins/cosimo-linkedin
```

## Convivenza con la skill personale

Se la skill personale `cosimo-humanize` è attiva, Claude vede due voci
distinte: `cosimo-humanize` e `/cosimo-linkedin:cosimo-humanize`. Sono
equivalenti — tenendo il plugin conviene disattivare quella personale.

## Licenza

MIT.
