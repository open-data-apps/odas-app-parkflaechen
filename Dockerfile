# Verwende das Nginx-Image
FROM nginx:1.25.2-alpine

# Kopiere deine Website-Dateien in das Container-Verzeichnis
COPY ./app /usr/share/nginx/html/app
COPY ./odas-config /usr/share/nginx/html/odas-config
COPY ./nginx.conf /etc/nginx/nginx.conf

# Exponiere Port 80
EXPOSE 80
