#!/usr/bin/env bash
# Avvio di prompts.chat self-hosted.
# Al primo giro crea .env con segreti casuali; ai giri successivi lo riusa.
set -euo pipefail
cd "$(dirname "$0")"

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose non disponibile. Installa Docker Desktop (Mac/Windows) o docker-ce (Linux)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Creo .env con segreti casuali..."
  cp .env.example .env
  # Solo esadecimale: la password finisce dentro una URL di connessione,
  # caratteri come / + = @ la romperebbero.
  PW="$(openssl rand -hex 24)"
  SECRET="$(openssl rand -base64 32)"
  # macOS e GNU sed si comportano diversamente su -i: uso un file temporaneo.
  awk -v pw="$PW" -v sec="$SECRET" '
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pw; next }
    /^AUTH_SECRET=/       { print "AUTH_SECRET=" sec;     next }
    { print }
  ' .env > .env.tmp && mv .env.tmp .env
  chmod 600 .env
  echo "Fatto: i segreti sono in .env (non committarlo)."
fi

PORT="$(grep -E '^PORT=' .env | cut -d= -f2)"
PORT="${PORT:-4444}"

docker compose up -d

echo
echo "Attendo che l'applicazione risponda su http://localhost:${PORT} ..."
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    echo "Pronta: http://localhost:${PORT}"
    exit 0
  fi
  sleep 5
done

echo "Non ha risposto entro 5 minuti. Guarda i log con: docker compose logs -f app" >&2
exit 1
