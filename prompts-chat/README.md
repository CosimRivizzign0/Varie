# prompts.chat self-hosted

Kit pronto per far girare una tua istanza privata di [prompts.chat](https://github.com/f/prompts.chat)
(libreria di prompt con categorie, tag, versioning, utenti) su un tuo computer o su un tuo server.

Riferimenti a monte: [SELF-HOSTING.md](https://github.com/f/prompts.chat/blob/main/SELF-HOSTING.md) e
[DOCKER.md](https://github.com/f/prompts.chat/blob/main/DOCKER.md).
Questo kit è allineato al commit upstream `f78a1c5` (9 settembre 2026).

## Cosa c'è in questa cartella

| File | A cosa serve |
|---|---|
| `compose.yml` | Definisce i due container: l'app (`ghcr.io/f/prompts.chat:latest`) e PostgreSQL 17 |
| `.env.example` | Modello di configurazione: segreti, porta, branding, lingue, login |
| `avvia.sh` | Crea `.env` con segreti casuali, avvia lo stack e aspetta che risponda |
| `.gitignore` | Tiene `.env` e i dump `.sql` fuori dal repository |

Non c'è il codice sorgente dell'applicazione: si usa l'immagine ufficiale già compilata.
Aggiornare vuol dire scaricare l'immagine nuova, non rifare merge di codice.

## 1. Prerequisiti

- **Docker Desktop** (Mac/Windows) o `docker` + plugin `compose` (Linux).
- **Almeno 2 GB di RAM** liberi per Docker (4 GB se decidi di compilare l'immagine da sorgente:
  in quel caso upstream segnala kill per OOM con memoria bassa).
- ~2 GB di disco.

Non servono Node.js né PostgreSQL installati sulla macchina: stanno dentro i container.

## 2. Avvio

```bash
cd prompts-chat
./avvia.sh
```

Lo script, al primo giro: copia `.env.example` in `.env`, ci scrive una password DB (`openssl rand -hex 24`)
e un `AUTH_SECRET` (`openssl rand -base64 32`), poi lancia `docker compose up -d` e attende la risposta
di `/api/health`. Alla fine l'istanza è su **http://localhost:4444** (cambia `PORT` in `.env` se occupata).

Se preferisci a mano:

```bash
cp .env.example .env      # poi compila POSTGRES_PASSWORD e AUTH_SECRET
docker compose up -d
docker compose logs -f app
```

Il primo avvio richiede qualche minuto: l'entrypoint aspetta il database e applica le migrazioni Prisma
(`prisma migrate deploy`) prima di servire le pagine.

Comandi utili:

```bash
docker compose ps              # stato dei container
docker compose logs -f app     # log dell'applicazione
docker compose down            # ferma tutto (i dati restano nel volume postgres_data)
docker compose down -v         # ferma E CANCELLA il database. Usalo solo se vuoi ripartire da zero.
```

## 3. Primo utente e permessi di amministratore

1. Apri `http://localhost:4444` e registrati (provider `credentials`: email + password).
2. Il primo utente **non** diventa admin da solo: il campo `role` nasce a `USER`.
   Promuoviti a mano:

```bash
docker compose exec db psql -U prompts -d prompts \
  -c "UPDATE \"User\" SET role='ADMIN' WHERE email='tua@email.it';"
```

3. Se l'istanza deve restare solo tua, metti `PCHAT_ALLOW_REGISTRATION=false` in `.env`
   e riavvia con `docker compose up -d`. Da quel momento nessuno può più iscriversi.

**Prompt di esempio (opzionale).** Upstream documenta `docker compose exec app npx prisma db seed`.
Attenzione: nell'immagine di runtime il seed è `npx tsx prisma/seed.ts` e `tsx` non è preinstallato,
quindi `npx` prova a scaricarlo al volo — se la macchina non ha accesso a npm il comando fallisce.
Non è un problema: l'istanza funziona anche vuota, i prompt li inserisci tu dall'interfaccia.

## 4. Personalizzazione

Tutta la personalizzazione passa da `.env` (variabili `PCHAT_*`, lette a runtime: non serve ricompilare).
Dopo ogni modifica: `docker compose up -d`.

| Variabile | Effetto |
|---|---|
| `PCHAT_NAME` / `PCHAT_DESCRIPTION` | Nome e descrizione mostrati nell'interfaccia |
| `PCHAT_COLOR` | Colore primario (esadecimale) |
| `PCHAT_LOCALES` / `PCHAT_DEFAULT_LOCALE` | Lingue attive e lingua predefinita (il kit parte con `it,en` e default `it`) |
| `PCHAT_AUTH_PROVIDERS` | `credentials`, `github`, `google` (anche combinati) |
| `PCHAT_ALLOW_REGISTRATION` | `true`/`false`: registrazione pubblica aperta o chiusa |
| `PCHAT_FEATURE_AI_SEARCH`, `PCHAT_FEATURE_AI_GENERATION` | Ricerca semantica e generazione: richiedono `OPENAI_API_KEY` e sono **a consumo a tuo carico** |

Lingue disponibili a monte: ar, az, de, el, en, es, fa, fr, he, **it**, ja, ko, nl, pt, ru, tr, zh.

Per il login con GitHub o Google: crea l'OAuth App sul provider, usa come callback
`http(s)://TUO-DOMINIO/api/auth/callback/github` (o `/google`), e metti ID e secret in `.env`.

## 5. Backup e aggiornamento

I dati stanno nel volume Docker `postgres_data` e sopravvivono a riavvii e aggiornamenti.
Il volume però vive sulla macchina: **non è un backup**.

```bash
# Backup (il file resta in questa cartella, già escluso da git)
docker compose exec db pg_dump -U prompts prompts > backup-$(date +%F).sql

# Ripristino
docker compose exec -T db psql -U prompts prompts < backup-2026-09-11.sql

# Aggiornamento all'ultima versione pubblicata
docker compose pull && docker compose up -d
```

Fai un backup **prima** di ogni `docker compose pull`: le migrazioni Prisma girano in automatico
all'avvio e non hanno un rollback pronto.

## 6. Metterlo online

L'app non gestisce HTTPS: se la esponi su Internet, mettici davanti un reverse proxy.

Caddy (certificato automatico):

```caddyfile
prompts.tuodominio.it {
    reverse_proxy localhost:4444
}
```

Nginx: `proxy_pass http://localhost:4444;` con gli header `X-Forwarded-*` e il certificato Let's Encrypt.

Alternativa senza server tuo: deploy su **Vercel** (build da fork del repo upstream) con database
PostgreSQL gestito, es. Neon. In quel caso questo kit non serve: servono `DATABASE_URL`, `DIRECT_URL`
e `AUTH_SECRET` nelle variabili d'ambiente del progetto Vercel. Costo: piano gratuito per volumi piccoli,
poi a consumo.

## 7. Sicurezza — punti da non saltare

| Rischio | Livello | Cosa fare |
|---|---|---|
| `AUTH_SECRET` non impostato | Alto | L'immagine ne genera uno nuovo a ogni riavvio: sessioni invalidate di continuo. Questo `compose.yml` si rifiuta di partire senza. |
| Password DB di default (`prompts/prompts` nell'esempio upstream) | Alto | Qui è obbligatoria e generata casuale. Non riusarla altrove. |
| Registrazione pubblica aperta su istanza esposta | Medio | `PCHAT_ALLOW_REGISTRATION=false` dopo aver creato i tuoi utenti. |
| HTTP in chiaro su Internet | Alto | Reverse proxy con HTTPS, sempre. |
| Database pubblicato sull'host | Medio | In questo `compose.yml` la porta 5432 **non** è esposta: il DB è raggiungibile solo dall'app. |
| `.env` committato per errore | Alto | Già coperto da `.gitignore`. Controlla con `git status` prima di ogni commit. |

## 8. Cosa è stato verificato e cosa no

Verificato in questa sessione:

- `compose.yml` valido e interpolato correttamente (`docker compose config`);
- fail-fast se mancano `POSTGRES_PASSWORD` o `AUTH_SECRET`;
- `avvia.sh` genera `.env` con segreti casuali e sintassi corretta;
- nomi di tabella/campo usati nella query di promozione ad admin (`"User"."role"`, enum `UserRole`)
  letti dallo `schema.prisma` upstream.

**Non** verificato: l'avvio effettivo dei container. L'ambiente in cui è stato preparato questo kit
blocca il download delle immagini dai registry (ghcr.io e Docker Hub), quindi `docker compose up`
non ha potuto scaricare né `ghcr.io/f/prompts.chat:latest` né `postgres:17-bookworm`.
Il primo `./avvia.sh` sulla tua macchina è quindi anche il primo test reale.

## Licenza

Applicazione: MIT. Prompt della libreria upstream: CC0.
