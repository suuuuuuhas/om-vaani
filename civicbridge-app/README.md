# Civic Sathi application

This folder contains the current Next.js Civic Sathi app. See the [repository README](../README.md) for the product overview, architecture, setup, credentials, development checks and limitations.

The latest voice implementation is on `codex/vaani-streaming`.

```bash
npm ci
# Copy .env.example to .env.local and configure server-side credentials.
npm run dev
```

Plain Next.js development previews the interface and REST routes. Verify the streaming WebSocket session in a compatible Vercel environment. Cases are stored in the current browser; demo references do not mean a complaint has been officially filed.
