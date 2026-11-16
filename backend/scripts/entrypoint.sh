#!/bin/sh
set -e

# Ensure uploads directory and avatars subfolder exist and are owned by appuser
mkdir -p /app/uploads/avatars
chown -R appuser:appgroup /app/uploads

# Run database migrations
if [ -f "alembic.ini" ]; then
  echo "Running database migrations..."
  gosu appuser alembic upgrade head
fi

# Execute command dropped to appuser privileges
exec gosu appuser "$@"
