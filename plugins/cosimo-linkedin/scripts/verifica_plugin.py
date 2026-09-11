#!/usr/bin/env python3
"""Controlli strutturali sul plugin cosimo-linkedin.

Verifica che ogni skill abbia un frontmatter valido, che le descrizioni siano
utilizzabili per il matching, che i file citati nei SKILL.md esistano davvero
e che i manifest siano JSON validi e allineati su nome e versione.

Uso:  python3 scripts/verifica_plugin.py
Esce con codice 1 se trova almeno un errore.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
DESCRIZIONE_MIN = 120
DESCRIZIONE_MAX = 1024

errori: list[str] = []
avvisi: list[str] = []


def leggi_frontmatter(percorso: Path) -> dict[str, str] | None:
    testo = percorso.read_text(encoding="utf-8")
    if not testo.startswith("---\n"):
        return None
    fine = testo.find("\n---\n", 4)
    if fine == -1:
        return None
    campi: dict[str, str] = {}
    chiave = None
    for riga in testo[4:fine].splitlines():
        corrispondenza = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", riga)
        if corrispondenza:
            chiave = corrispondenza.group(1)
            campi[chiave] = corrispondenza.group(2).strip().strip('"')
        elif chiave and riga.strip():
            campi[chiave] += " " + riga.strip()
    return campi


def controlla_skill(cartella: Path) -> None:
    skill_md = cartella / "SKILL.md"
    if not skill_md.exists():
        errori.append(f"{cartella.name}: manca SKILL.md")
        return

    campi = leggi_frontmatter(skill_md)
    if campi is None:
        errori.append(f"{cartella.name}: frontmatter YAML assente o non chiuso")
        return

    nome = campi.get("name")
    if not nome:
        errori.append(f"{cartella.name}: manca il campo 'name' nel frontmatter")
    elif nome != cartella.name:
        errori.append(
            f"{cartella.name}: 'name' ({nome}) diverso dal nome della cartella"
        )

    descrizione = campi.get("description", "")
    if not descrizione:
        errori.append(f"{cartella.name}: manca il campo 'description'")
    elif len(descrizione) < DESCRIZIONE_MIN:
        avvisi.append(
            f"{cartella.name}: descrizione di {len(descrizione)} caratteri, "
            f"sotto i {DESCRIZIONE_MIN} consigliati per un matching affidabile"
        )
    elif len(descrizione) > DESCRIZIONE_MAX:
        errori.append(
            f"{cartella.name}: descrizione di {len(descrizione)} caratteri, "
            f"oltre il limite di {DESCRIZIONE_MAX}"
        )

    corpo = skill_md.read_text(encoding="utf-8")
    riferimenti = sorted(set(re.findall(r"`(references/[A-Za-z0-9_./-]+\.md)`", corpo)))
    for riferimento in riferimenti:
        if not (RADICE / riferimento).exists():
            errori.append(f"{cartella.name}: riferimento inesistente a {riferimento}")


def controlla_manifest() -> None:
    manifest = RADICE / ".claude-plugin" / "plugin.json"
    if not manifest.exists():
        errori.append("manca .claude-plugin/plugin.json")
        return
    try:
        dati = json.loads(manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as errore:
        errori.append(f"plugin.json non è JSON valido: {errore}")
        return

    if dati.get("name") != RADICE.name:
        errori.append(
            f"plugin.json: 'name' ({dati.get('name')}) diverso dalla cartella "
            f"({RADICE.name})"
        )

    mercato = RADICE.parent.parent / ".claude-plugin" / "marketplace.json"
    if not mercato.exists():
        avvisi.append("marketplace.json non trovato nella radice del repository")
        return
    try:
        voci = json.loads(mercato.read_text(encoding="utf-8")).get("plugins", [])
    except json.JSONDecodeError as errore:
        errori.append(f"marketplace.json non è JSON valido: {errore}")
        return

    voce = next((v for v in voci if v.get("name") == dati.get("name")), None)
    if voce is None:
        errori.append(f"marketplace.json non elenca il plugin {dati.get('name')}")
    elif voce.get("version") != dati.get("version"):
        errori.append(
            f"versione disallineata: plugin.json {dati.get('version')} contro "
            f"marketplace.json {voce.get('version')}"
        )


def main() -> int:
    controlla_manifest()

    cartella_skill = RADICE / "skills"
    if not cartella_skill.is_dir():
        errori.append("manca la cartella skills/")
    else:
        trovate = sorted(p for p in cartella_skill.iterdir() if p.is_dir())
        if not trovate:
            errori.append("la cartella skills/ è vuota")
        for cartella in trovate:
            controlla_skill(cartella)
        print(f"Skill esaminate: {len(trovate)}")

    for avviso in avvisi:
        print(f"  avviso: {avviso}")
    for errore in errori:
        print(f"  ERRORE: {errore}")

    if errori:
        print(f"\nFallito: {len(errori)} errori, {len(avvisi)} avvisi.")
        return 1
    print(f"\nOK: nessun errore, {len(avvisi)} avvisi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
