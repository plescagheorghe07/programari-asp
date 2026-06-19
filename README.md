# Reprogramări automate DIMTCCA

Aplicație Node.js cu panou admin pentru reprogramări automate la examen pe [eservicii.gov.md](https://eservicii.gov.md).

## Funcționalități

- Adaugi link-ul cererii (`.../cerere/APO01/uuid`)
- Serverul verifică automat la fiecare X minute datele disponibile
- Rezervă prima dată eligibilă (respectând **zilele minime** de la data curentă)
- Status: **Finalizat** / **În așteptare** / **Eroare**
- Switch **Plătită** (manual)
- Switch **Activă** (oprește/pornește monitorizarea)
- Jurnal activitate per programare

## Instalare

```bash
npm install
cp .env.example .env
# Editează .env — setează ADMIN_PASSWORD și opțional COOKIE
npm start
```

Deschide http://localhost:3000

## Configurare (.env)

| Variabilă | Descriere |
|-----------|-----------|
| `PORT` | Port server (default 3000) |
| `ADMIN_PASSWORD` | Parola panou admin |
| `POLL_INTERVAL_MINUTES` | Interval verificare automată (default 2) |
| `COOKIE` | Cookie de sesiune eservicii.gov.md (opțional, copiat din browser) |

## Flux API

1. `GET /api/fod/request/{tip}/{id}` — date cerere
2. `GET /api/qmatic/dates/{serviceId}/{locationId}` — date disponibile
3. `GET /api/qmatic/times/{serviceId}/{locationId}/{data}` — ore disponibile
4. `POST /api/apo-request/validate-appointment` — validare
5. `POST /api/qmatic/confirm` — confirmare programare

## Notă

Unele cereri pot necesita cookie de autentificare din browser. Copiază header-ul `Cookie` din DevTools → Network și pune-l în `.env`.
