#!/bin/bash

echo "Starting LMS in Development Mode with Hot Reloading..."
echo ""
echo "This will:"
echo "- Mount source code as volumes for instant updates"
echo "- Enable auto-reload for Python services"
echo "- Enable hot reload for Next.js frontend"
echo "- No need to rebuild containers for code changes"
echo ""

docker-compose -f docker-compose.dev.yml up --build

