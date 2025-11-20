# PureCare Air Purification System

A Progressive Web App (PWA) for monitoring and controlling IoT air purifiers using Firebase and React.

## Features

- **Real-time Device Monitoring**: Track PM2.5, PM10, VOC, CO2, temperature, and humidity
- **Device Control**: Adjust fan speed, auto mode, and sensitivity settings
- **Room Graph Visualization**: Interactive visualization of rooms and airflow using react-flow
- **Firebase Integration**: Real-time data sync with Firestore
- **PWA Support**: Installable on mobile and desktop with offline capabilities
- **Responsive Design**: Works seamlessly on all devices

## Tech Stack

- **Frontend**: React 19 + Next.js 16 + TypeScript
- **Styling**: TailwindCSS v4 + shadcn/ui
- **Backend**: Firebase (Auth + Firestore)
- **Visualization**: @xyflow/react (react-flow)
- **PWA**: Service Workers + Web App Manifest

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase account
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up Firebase environment variables:
   \`\`\`env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   \`\`\`

4. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open [http://localhost:3000](http://localhost:3000)

## Firestore Data Structure

### Devices Collection

\`\`\`typescript
devices/{deviceId}
{
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  fanSpeed: number;
  autoMode: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  lastSeen: string; // ISO timestamp
  userId: string;
  sensors: {
    pm25: number;
    pm10: number;
    voc: number;
    co2: number;
    temperature: number;
    humidity: number;
  };
}
\`\`\`

### Events Subcollection

\`\`\`typescript
devices/{deviceId}/events/{eventId}
{
  id: string;
  timestamp: string; // ISO timestamp
  type: 'mode_change' | 'alert' | 'offline' | 'online';
  message: string;
}
\`\`\`

## Project Structure

\`\`\`
├── src/
│   ├── app/                # Next.js App Router pages & layouts
│   │   ├── dashboard/      # Dashboard page
│   │   ├── devices/        # Device list + creation pages
│   │   ├── device/[id]/    # Device control page
│   │   ├── rooms/          # Room graph page
│   │   ├── settings/       # Settings page
│   │   ├── login/          # Login page
│   │   └── api/            # API routes
│   ├── components/         # Reusable UI and feature components
│   │   ├── auth/           # Authentication components
│   │   ├── devices/        # Device components
│   │   ├── rooms/          # Room graph components
│   │   ├── layout/         # Layout components
│   │   ├── pwa/            # PWA components
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # Global React contexts
│   │   └── auth-context.tsx
│   ├── hooks/              # Shared hooks
│   │   ├── use-pwa-install.ts
│   │   └── use-toast.ts
│   ├── lib/                # Utilities and Firebase integration
│   │   ├── firebase-config.ts
│   │   ├── firestore-hooks.ts
│   │   ├── api-client.ts
│   │   └── room-data.ts
│   └── types/              # Shared TypeScript types
│       ├── device.ts
│       └── room.ts
└── public/
    ├── manifest.json       # PWA manifest
    ├── service-worker.js   # Service worker
    └── icons/              # App icons

\`\`\`

## PWA Installation

The app can be installed on:
- **Desktop**: Chrome, Edge, Safari (macOS)
- **Mobile**: Chrome, Safari (iOS), Samsung Internet

Users will see an install prompt when visiting the app. The app works offline once installed.

## API Endpoints

### PATCH /api/devices/:id/settings

Update device settings (fan speed, auto mode, sensitivity)

**Request Body:**
\`\`\`json
{
  "fanSpeed": 60,
  "autoMode": true,
  "sensitivity": "medium"
}
\`\`\`

## License

MIT
