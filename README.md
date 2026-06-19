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
# Setează SESSION_SECRET (minim 32 caractere): openssl rand -hex 32
npm start
```

Deschide http://localhost:3005/login

**Utilizator implicit:** plescagheorghe07@gmail.com / georgie6699

## Configurare (.env)

| Variabilă | Descriere |
|-----------|-----------|
| `PORT` | Port server (default 3005, doar localhost) |
| `SESSION_SECRET` | Secret JWT (minim 32 caractere) |
| `NODE_ENV` | `production` pe server |
| `POLL_INTERVAL_MINUTES` | Interval verificare automată (default 2) |
| `COOKIE` | Cookie eservicii.gov.md din browser |

## Deploy

Vezi `deploy/README.md` pentru nginx (`programari.visio.md`) și systemd NixOS.

## Flux API

1. `GET /api/fod/request/{tip}/{id}` — date cerere
2. `GET /api/qmatic/dates/{serviceId}/{locationId}` — date disponibile
3. `GET /api/qmatic/times/{serviceId}/{locationId}/{data}` — ore disponibile
4. `POST /api/apo-request/validate-appointment` — validare
5. `POST /api/qmatic/confirm` — confirmare programare

## Notă

Unele cereri pot necesita cookie de autentificare din browser. Copiază header-ul `Cookie` din DevTools → Network și pune-l în `.env`.
