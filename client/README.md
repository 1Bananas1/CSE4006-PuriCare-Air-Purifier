# PureCare Client (Next.js App Router)

Progressive Web App for the PureCare ecosystem. After the latest refactor the UI runs on Next.js 16 + React 19 with a component-driven architecture, Firebase-first data access, and a room-graph workflow aligned with the indoor spatial model.

## Highlights
- **Dashboard & Device Ops**: `src/app/dashboard` plus `src/app/devices` surface live telemetry, firmware status, and quick actions. Device UI primitives live in `src/components/devices`.
- **Room Graph Studio**: `@xyflow/react` renders the editor at `src/app/rooms`, backed by helpers in `src/lib/firestore-rooms.ts` for syncing room nodes, airflow edges, and device bindings with Firestore.
- **Auth + Guarded Layouts**: Firebase Auth flows through `src/contexts/auth-context.tsx`; protected routes sit behind the App Router layout while `src/app/login` handles onboarding.
- **PWA Shell**: Service worker registration (`src/lib/register-service-worker.ts`), manifest/icons in `public/`, and install prompts handled by `src/hooks/use-pwa-install.ts`.
- **UI Stack**: TailwindCSS v4 (PostCSS-only pipeline), shadcn/ui components generated via `components.json`, Radix primitives, lucide-react icons, Sonner toasts, and theme switching with `src/components/theme-provider.tsx`.

## Requirements
- Node.js 20+ (Next.js 16 baseline)
- pnpm 9+ (repo ships with `pnpm-lock.yaml`; npm/yarn work but pnpm keeps lockfile in sync)
- Firebase project (Auth + Firestore) registered as a Web App

## Setup
```bash
cd client
pnpm install
cp .env.example .env.local   # or create the file manually
```

Populate `.env.local` with Firebase config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxxxxxxxxx:web:xxxxxxxx
```

Start the app:
```bash
pnpm dev
# open http://localhost:3000
```

Other scripts:
- `pnpm build` – production bundle + typecheck
- `pnpm start` – run the built output locally
- `pnpm lint` – ESLint across `src`

## Firestore Touchpoints
- `devices/{deviceId}` feeds dashboard/detail views via hooks in `src/lib/firestore-hooks.ts`.
- `houseGraphs/{graphId}` (or `users/{uid}/houseGraphs`) powers the room editor (`src/lib/firestore-rooms.ts`) by storing rooms, adjacency, and mapped device IDs.
- Optional `appSettings/global` doc can host feature flags or PWA config consumed by `src/lib/api-client.ts`.

Keep Firebase security rules scoped so users can only read/write their own devices and graphs—`auth-context` expects a signed-in user for every route except `/login`.

## Project Layout
```
client/
├── src/
│   ├── app/                  # App Router (dashboard, rooms, devices, settings, login, root page)
│   ├── components/           # Feature + UI building blocks (auth, layout, devices, rooms, ui, pwa)
│   ├── contexts/             # Auth provider
│   ├── hooks/                # PWA install, toast, mobile detection
│   ├── lib/                  # Firebase config, Firestore helpers, API utilities, SW helpers
│   ├── styles/               # Tailwind globals
│   └── types/                # Device + room DTOs
├── public/                   # Manifest, icons, service worker stub
├── components.json           # shadcn/ui generator config
├── next.config.mjs / tsconfig.json / postcss.config.mjs
└── pnpm-lock.yaml            # Lockfile (use pnpm for deterministic installs)
```

## Development Notes
- App Router uses Server Components; co-locate `loading.tsx`/`error.tsx` inside route segments when adding new flows.
- Global styles are defined in `src/styles/globals.css` and imported once in `src/app/layout.tsx`. Add custom layers there rather than duplicating Tailwind directives.
- Service worker caching can be toggled in `register-service-worker.ts`; comment out registration during heavy local debugging if necessary.
- When extending the room graph feature, update `src/lib/firestore-rooms.ts` and the backend `/api/house-graph` contract together so node/edge schemas stay in sync.

## License
MIT (inherits from repository root)
