# MVP Architecture

## Stack
- React + TypeScript + Vite
- Static deployment on Vercel
- Local mock data for first release

## App sections
- landing / explanation layer
- interactive product demo

## Core front-end modules
- `App.tsx` — page composition
- `data/demo.ts` — sample workspace, transactions, docs, statuses
- `components/` (future)
  - dashboard cards
  - transactions table
  - detail drawer
  - filters
  - activity timeline

## State approach
Use simple React state first.
No backend required for the first public demo.

## Future backend path
When validated:
- Supabase / Postgres
- file storage for docs
- auth
- import parsers
- document extraction / matching layer

## Design goals
- finance-tool clarity without enterprise ugliness
- dense but readable table UI
- status-first workflow
- fast scanning of unresolved items

## MVP definition of done
- docs committed
- React app shows a believable product concept
- build passes
- deployable to Vercel
- shareable GitHub repo
