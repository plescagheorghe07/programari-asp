# Deploy pe server

## 1. Pregătire proiect

```bash
cd /home/f3rdxpz/Projects/reprogramari-dimtcca   # sau calea ta
npm install
cp .env.example .env
```

Editează `.env`:
- `SESSION_SECRET` — generează cu: `openssl rand -hex 32`
- `PORT=3005`
- `NODE_ENV=production`

## 2. Utilizator implicit

La prima pornire se creează automat:
- **Email:** plescagheorghe07@gmail.com
- **Parolă:** georgie6699

Schimbă parola după primul login (funcționalitate de schimbare poate fi adăugată ulterior).

## 3. Systemd (NixOS)

Vezi `deploy/nixos-service.nix` — copiază fragmentul în `configuration.nix`, ajustează calea, apoi:

```bash
sudo nixos-rebuild switch
sudo systemctl enable --now reprogramari-dimtcca
```

## 4. Nginx

### Variantă fișier config (Ubuntu/Debian)

```bash
sudo cp deploy/nginx/programari.visio.md.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/programari.visio.md.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d programari.visio.md
sudo nginx -t && sudo systemctl reload nginx
```

### Variantă NixOS

Vezi comentariul din `deploy/nixos-service.nix` pentru `services.nginx.virtualHosts`.

## 5. DNS

Adaugă record **A** sau **CNAME** pentru `programari.visio.md` → IP-ul serverului.

## Securitate

- JWT + cookie HttpOnly
- Parole hashuite cu bcrypt
- Rate limit pe login (10 încercări / 15 min)
- Helmet security headers
- App ascultă doar pe `127.0.0.1:3005` (nginx face proxy public)
- Fără autentificare nu se accesează panoul sau API-ul
