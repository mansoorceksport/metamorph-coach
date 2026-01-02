# Metamorph Coach

A Progressive Web Application (PWA) for fitness coaches to manage client sessions, plan workouts, and track member progress.

## Features

### 🏠 Command Center (Dashboard)
- **Today's Schedule**: View all sessions for the day with status indicators
- **Session Cards**: Click to navigate to session details based on status
- **Member Analytics**: Rising Stars, Consistent Members, Intervention Needed, Churn Risk, Package Health, Strength Wins
- **Real-time Status**: Offline indicator, sync status, pending changes count

### 📅 Schedule Management
- View all scheduled sessions across any date
- Filter by date and status (Scheduled, In Progress, Completed, Cancelled, No Show)
- Color-coded status indicators
- Click any session to view/edit details

### 💪 Session Workflow

#### 1. Preview Mode (Scheduled Sessions)
- Plan workouts before the session starts
- Add/remove exercises from the workout plan
- Set target sets, reps, and rest periods per exercise
- Add notes/goals for each exercise
- Searchable exercise library

#### 2. Active Workout Mode (In Progress Sessions)
- Start session with one click
- Log weights and reps for each set
- Personal Best (PB) detection with celebrations
- Progress bar showing completed sets
- Add exercises on-the-fly

#### 3. Session Summary (Completed Sessions)
- View completed workout summary
- Coach remarks and notes
- Session statistics and achievements

### 📚 Exercise Library
- Searchable exercise database
- Syncs from Metamorph API
- Cached locally in IndexedDB for offline access

### 🔄 Offline-First Architecture
- All data stored in IndexedDB using Dexie.js
- Works fully offline
- Automatic sync when back online
- Optimistic UI updates

## Tech Stack

- **Framework**: Nuxt 4 with Vue 3
- **UI Components**: Nuxt UI (v3)
- **Styling**: Tailwind CSS
- **Database**: IndexedDB via Dexie.js
- **Authentication**: Firebase Auth with Google Sign-In
- **Icons**: Heroicons

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd metamorph-coach

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file with your Firebase configuration:

```env
NUXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NUXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NUXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Development

```bash
# Start development server
pnpm dev

# Start with network access (for mobile testing)
pnpm dev --host
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
app/
├── assets/css/          # Global styles
├── composables/         # Vue composables
│   ├── useAuth.ts       # Firebase authentication
│   ├── useDatabase.ts   # IndexedDB operations
│   └── useExerciseLibrary.ts
├── layouts/
│   └── default.vue      # Main app layout with sidebar
├── pages/
│   ├── index.vue        # Command Center dashboard
│   ├── login.vue        # Google Sign-In
│   ├── schedule.vue     # Schedule management
│   ├── sessions/
│   │   └── [id].vue     # Session detail (preview/workout/summary)
│   ├── clients/
│   │   ├── index.vue    # Client list
│   │   └── [id].vue     # Client profile
│   └── library.vue      # Exercise library
├── plugins/
│   └── seed-data.client.ts  # Demo data seeder
└── utils/
    └── db.ts            # Dexie.js database schema
```

## Demo Mode

The app automatically seeds demo data for testing:
- 4 sample members with scheduled sessions
- Pre-planned exercises for each session
- Sample exercise library

Demo data is reset on each page load but preserves session status changes (completed, in-progress).

## License

© 2024 House of Metamorfit. All rights reserved.
