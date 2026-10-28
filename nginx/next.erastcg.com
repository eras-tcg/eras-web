server {
    server_name next.erastcg.com;

    # Simulator WebSocket: the upgrade headers must reach the container (which proxies /ws to DriveManager)
    location /ws {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass         http://localhost:3002;
        proxy_redirect     default;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/next.erastcg.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/next.erastcg.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = next.erastcg.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    server_name next.erastcg.com;
    listen 80;
    return 404; # managed by Certbot
}
