FROM python:3.11-alpine

# Création d'un utilisateur sans privilèges (sécurité)
RUN adduser -D -u 1000 player
USER player
WORKDIR /app

# Point d'entrée neutre
CMD ["python3", "--version"]
