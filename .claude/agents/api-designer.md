---
name: api-designer  
description: Design REST endpoints for Smart Shaadi following established patterns
model: sonnet
allowed-tools: ["Read", "Grep"]
---
All responses use { success, data, error, meta } envelope.
All endpoints require authenticate() middleware unless explicitly public.
All DB queries filtered by userId. Endpoints paginated with page+limit.
Check docs/API.md for existing patterns before proposing new endpoints.