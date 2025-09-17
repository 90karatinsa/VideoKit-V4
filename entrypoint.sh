#!/bin/sh
# Hata durumunda script'i sonlandır
set -e

# PostgreSQL'in hazır olmasını bekle
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -q -U "${POSTGRES_USER:-videokit}"; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up - executing command"

# Veritabanı migration'larını çalıştır
echo "Running database migrations..."
npm run migrate up
echo "Migrations complete!"

# Ana uygulamayı başlat
echo "Starting application..."
exec node server.mjs