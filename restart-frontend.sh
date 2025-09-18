#!/bin/bash

echo "Restarting frontend container with hot reloading fixes..."
echo

echo "Stopping frontend container..."
docker-compose -f docker-compose.dev.yml stop frontend

echo "Removing frontend container..."
docker-compose -f docker-compose.dev.yml rm -f frontend

echo "Rebuilding frontend container..."
docker-compose -f docker-compose.dev.yml build frontend

echo "Starting frontend container with hot reloading..."
docker-compose -f docker-compose.dev.yml up -d frontend

echo
echo "Frontend container restarted with hot reloading enabled!"
echo "You can now make changes to the frontend code and they should reload automatically."
echo
echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f frontend"
echo


