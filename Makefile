#
# ODAS Parkflächen App
# (C) Ondics, 2025
#

# aktuelles Dir ist docker-compose project name
mkfile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
current_dir := $(notdir $(patsubst %/,%,$(dir $(mkfile_path))))

DC_BIN = docker compose
DC_FILES = -f docker-compose.yml #-f docker-compose-prod.yml

DC_PROJECT = ${current_dir}
DC = ${DC_BIN} ${DC_FILES}

# für Backups...
#DATE := $(shell date '+%Y%m%d-%H%M%S')
DATE := $(shell date '+%Y%m%d')

# help-systematik
# build muss phony sein (forcierter build), weil es
# als verzeichnis existiert und sonst nie gebaut werden w�rde
.PHONY: help build stats

help:
	@echo "# ODAS Parkflächen App"
	@echo "# Ondics, 2025"
	@echo "# dir = ${current_dir}"
	@echo Befehle: make ...
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

# allgemeine Befehle
up: ## Alle kontainer starten
	${DC} up -d --remove-orphans

down: ##Alle Container stoppen
	${DC} down

down-volumes: ## Container stopen, Volumes löschen
	${DC} down --volumes

logs: ## Show logs of all containers (stop with ctrl-c)
	${DC} logs -f -t --tail=100

build:  ## Build all containers
	${DC} build

bash: ## Bash in frontend-container
	${DC} exec web sh

restart-backend: ## Restart backend-container
	${DC} restart backend

ps: ## what's up?
	${DC} ps

config: ## show docker-compose config 
	${DC} config

zip: ## Pack den Ordner odas-app-parkflaechen in eine ZIP-Datei
	zip -r odas-app-parkflaechen.zip \
	 	app assets app-package.json CHANGELOG.md 