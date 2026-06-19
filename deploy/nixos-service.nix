# Fragment NixOS — adaugă în configuration.nix (services section)
# Ajustează WorkingDirectory la calea reală de pe server

systemd.services.reprogramari-dimtcca = {
  description = "Reprogramări automate DIMTCCA (programari.visio.md)";
  after = [ "network-online.target" ];
  wantedBy = [ "multi-user.target" ];

  path = with pkgs; [
    nodejs_22
    bash
    coreutils
  ];

  serviceConfig = {
    Type = "simple";
    WorkingDirectory = "/home/f3rdxpz/Projects/reprogramari-dimtcca";
    Restart = "always";
    RestartSec = "15s";
    User = "f3rdxpz";
    Group = "users";

    ExecStart = "${pkgs.bash}/bin/bash -c 'cd /home/f3rdxpz/Projects/reprogramari-dimtcca && ${pkgs.nodejs_22}/bin/npm start'";

    Environment = [
      "PORT=3005"
      "NODE_ENV=production"
      "HOME=/home/f3rdxpz"
      "PATH=/run/current-system/sw/bin"
      "POLL_INTERVAL_MINUTES=2"
      "SESSION_SECRET=INLOCUIESTE_CU_SECRET_GENERAT_MINIM_32_CARACTERE"
      "COOKIE=current-context=%7B%22ContextId%22%3A%22%22%2C%22IsSelected%22%3Afalse%7D"
    ];
  };
};

# După rebuild:
#   sudo nixos-rebuild switch
#   sudo systemctl enable --now reprogramari-dimtcca
#   sudo systemctl status reprogramari-dimtcca

# Nginx (dacă folosești nginx pe NixOS):
# services.nginx.virtualHosts."programari.visio.md" = {
#   forceSSL = true;
#   enableACME = true;
#   locations."/" = {
#     proxyPass = "http://127.0.0.1:3005";
#     proxyWebsockets = true;
#     extraConfig = ''
#       proxy_set_header X-Real-IP $remote_addr;
#       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#       proxy_set_header X-Forwarded-Proto $scheme;
#     '';
#   };
# };
