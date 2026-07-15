#!/bin/bash
set -e
cd "$1/packages/portifo-api"
set -a
source "$2/shared/.env"
set +a
./node_modules/.bin/drizzle-kit migrate
