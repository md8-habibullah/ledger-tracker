# Ledger Tracker - Local Encrypted Vault

> **Your Finances. Zero Servers. 100% Local.**

A security-first, local-only financial vault application. All data remains encrypted in your browser using SQLite WASM with zero external network calls or telemetry. Built for users who demand complete control over their financial records.

---

## The Philosophy

**Zero Servers. Zero Tracking. 100% Local Ownership.**

Ledger Tracker operates entirely in-browser using SQLite compiled to WebAssembly (WASM). No transaction data ever leaves your device. No cloud syncing. No telemetry. No third-party integrations. Your financial data is yours alone.

This architecture represents a fundamental shift in how financial applications should be designed:
- Your data is stored locally in IndexedDB (not transmitted anywhere)
- Encryption is client-side via Web Crypto API (not managed by us)
- The SQLite engine runs in-process (not on a server)
- The app works offline (including new data entry and calculations)

---

## Architecture Overview

### Data Flow Visualization

```
┌────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                       │
│                    (React Components)                       │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                    REACT STATE LAYER                        │
│              (TanStack Query + React Hooks)                │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│              AES-256 ENCRYPTION (Optional)                 │
│              (Web Crypto API - Client-side)                │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│            SQL.JS WASM IN-MEMORY DATABASE                  │
│     (SQLite Engine Compiled to WebAssembly)                │
│  - Relational schema with triggers                         │
│  - Full SQL support (CREATE, INSERT, UPDATE, DELETE)       │
│  - Automatic budget calculation via triggers               │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│        LOCAL PERSISTENCE LAYER (IndexedDB)                 │
│     (Browser's Local Storage - Encrypted Optional)         │
│  - Binary database export via db.export()                  │
│  - Stored as Uint8Array under key: ledger_tracker.db       │
│  - Survives browser restarts                               │
└────────────────────────────────────────────────────────────┘
```

---

## Application Overview

### 1. Vault Initialization & Lock Screen
- **Route**: `/landing` → `/login`
- **Functionality**: First-time onboarding shows the Landing Page explaining zero-server architecture. Users register to create their encrypted vault.
- **Security**: Vault is locked by default. Auto-locks after configurable inactivity (5-60 minutes or disabled).
- **Destructive Reset**: Users can "Nuke" the vault via a 2-step confirmation dialog for complete data erasure.

### 2. Secure Authentication & Session Management
- **Route**: `/login`
- **Functionality**: Multi-user support with per-user data isolation via `user_id` foreign keys.
- **Features**: Password-based authentication (bcrypt recommended), persistent session tokens in localStorage.
- **Auto-Lock Timer**: Configurable inactivity timer locks the vault and clears session memory.

### 3. Financial Dashboard
- **Route**: `/`
- **Functionality**: Real-time overview of balance, income, expenses, and savings rate.
- **Live Calculations**: Budget progress visualized with automatic spent_amount updates via SQL triggers.
- **Quick Entry**: Rapid transaction logging with category-based shortcuts.

### 4. Transaction Ledger
- **Route**: `/ledger`
- **Functionality**: Comprehensive, searchable list of all transactions (filtered by user).
- **Trigger System**: All modifications (insert, update, delete) automatically recalculate budget totals.
- **Actions**: Edit, delete, and export transactions with full audit trails.

### 5. Budget Management & Tracking
- **Route**: `/budgets`
- **Functionality**: Category-specific budget limits with automatic progress calculation.
- **Real-Time Sync**: SQLite triggers instantly update `spent_amount` whenever transactions change.
- **Visualization**: Progress bars and notifications when approaching or exceeding budget limits.

### 6. Security & Privacy Settings
- **Route**: `/settings`
- **Auto-Lock Duration**: Configure vault lock timer (5/8/10/15/30/60 minutes or disabled).
- **Currency & Format**: Regional preferences for number formatting and currency display.
- **Destructive Reset**: One-click vault destruction for complete data erasure.

---

## Technical Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 18 + TypeScript | Type-safe UI layer with hooks |
| **Build Tool** | Vite | Lightning-fast bundling & HMR |
| **Database Engine** | sql.js (WASM) | SQLite compiled to WebAssembly |
| **Persistence** | localforage (IndexedDB) | Binary database export storage |
| **State Management** | TanStack React Query | Data synchronization & caching |
| **UI Components** | shadcn/ui | Accessible, composable components |
| **Styling** | Tailwind CSS | Utility-first design system |
| **Animations** | Framer Motion | Smooth transitions & interactions |
| **Icons** | Lucide React | Consistent icon library |
| **HTTP Client** | (Not used) | Zero external API calls |

---

## Core Features

### 1. **Auto-Lock Engine**
- Configurable inactivity timer (5, 8, 10, 15, 30, 60 minutes, or disabled)
- Automatically locks vault and clears session memory
- Monitors: mouse, keyboard, scroll, and touch events
- Timer resets on any user interaction

### 2. **Destructive Reset (Nuke Sequence)**
- Two-step confirmation dialog to prevent accidents
- Drops all database tables: users, transactions, budgets, categories
- Clears all localStorage data
- Returns app to initial state for complete data erasure
- 10-second countdown timer for final confirmation

### 3. **Budget Trigger System**
- SQLite triggers automatically recalculate `spent_amount` on transaction changes
- Eliminates stale budget calculations
- No application-layer sync logic required
- Maintains data integrity through database constraints

### 4. **Multi-User Isolation**
- Each user's data is isolated via `user_id` foreign keys
- SQL queries filtered by user context
- Password-based authentication with bcrypt support
- Per-user sessions with persistent tokens

### 5. **Vault Initialization Flow**
- Landing page explains zero-server architecture
- Guided registration creates encrypted vault
- Vault state persisted in IndexedDB
- Auto-lock enforced after initialization

---

## Database Architecture

The schema includes 4 core tables with 3 intelligent triggers:

**Tables:**
- `users`: Authentication credentials with bcrypt hashing
- `categories`: Global transaction categories with UI metadata
- `transactions`: Per-user financial records with type/category classification
- `budgets`: Per-user budget limits with auto-calculated spending totals

**Triggers:**
- `tr_after_insert_transactions`: Updates budget.spent_amount on new expense
- `tr_after_update_transactions`: Recalculates budgets when transaction changes
- `tr_after_delete_transactions`: Adjusts budgets when transaction is deleted

See `schema.sql` for complete trigger definitions and performance indexes.

---

## Data Flow Architecture

### Initialization (App Load)
```
Browser starts
  ↓
sqlite-setup.ts loads sql.js WASM
  ↓
Retrieve ledger_tracker.db from IndexedDB
  ↓
Reconstruct in-memory database from Uint8Array
  ↓
Verify vault_initialized state
  ↓
Load user session (if exists)
  ↓
App ready
```

### Transaction Create/Update/Delete
```
User modifies transaction
  ↓
React component calls CRUD hook
  ↓
Hook executes SQL query (INSERT/UPDATE/DELETE)
  ↓
SQLite trigger fires automatically
  ↓
Budget.spent_amount recalculated
  ↓
In-memory database updated
  ↓
db.export() → Uint8Array
  ↓
Save to IndexedDB under 'ledger_tracker.db'
  ↓
Invalidate React Query cache
  ↓
UI refreshes with new data
```

### Auto-Lock Trigger
```
User inactive for N minutes
  ↓
Inactivity timer fires
  ↓
AuthContext.lockVault() executes
  ↓
isLocked = true
  ↓
user_id removed from localStorage
  ↓
Session memory cleared
  ↓
VaultGateway redirects to /login
  ↓
User must re-authenticate
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+ (with pnpm 8+)
- Modern browser with IndexedDB support

### Step 1: Clone & Install
```bash
git clone https://github.com/md8-habibullah/ledger-tracker.git
cd ledger-tracker
pnpm install
```

### Step 2: Development Server
```bash
pnpm dev
```
The app will be available at `http://localhost:5173`

### Step 3: Production Build
```bash
pnpm build
pnpm start
```

The static build will be in `dist/`. Deploy to any static hosting (Vercel, Netlify, GitHub Pages, etc.).

---

## Project Structure

```
ledger-tracker/
├── src/
│   ├── components/
│   │   ├── auth/              # AuthContext, ProtectedRoute, VaultGateway
│   │   ├── vault/             # Vault lock/unlock UI components
│   │   ├── dashboard/         # Dashboard cards & charts
│   │   ├── layout/            # MainLayout, Navigation
│   │   ├── transactions/      # Transaction dialogs & forms
│   │   └── ui/                # shadcn/ui base components
│   ├── db/
│   │   ├── index.ts           # Database exports & TypeScript interfaces
│   │   └── sqlite-setup.ts    # sql.js WASM initialization & persistence
│   ├── hooks/                 # React Query hooks (useTransactions, etc.)
│   ├── pages/                 # Route pages (Landing, Login, Dashboard, etc.)
│   ├── lib/                   # Utilities (cn, date formatting, etc.)
│   ├── App.tsx                # Router configuration
│   └── main.tsx               # Entry point
├── schema.sql                 # Advanced SQLite schema with triggers
├── README.md                  # This file
├── LICENSE                    # MIT License
├── package.json               # Dependencies & scripts
├── vite.config.ts             # Vite bundler config
├── tailwind.config.ts         # Tailwind CSS customization
└── tsconfig.json              # TypeScript configuration
```

---

## Security Model

### Data at Rest
- Binary SQLite database exported from sql.js
- Stored in IndexedDB (browser's encrypted local storage)
- Optional: User can encrypt with Web Crypto API before IndexedDB storage

### Data in Transit
- **Zero**: No data leaves your device
- No external API calls
- No telemetry or analytics
- No third-party integrations

### Data in Use
- Runs in isolated browser context
- Password hashing with bcrypt (server-side recommendations)
- Session tokens in localStorage (not httpOnly due to WASM requirement)
- Auto-lock clears memory after inactivity

### Threat Model
This app protects against:
- ✅ Server-side data breaches (no servers exist)
- ✅ Network eavesdropping (no network calls)
- ✅ Unauthorized physical access (auto-lock, password protection)
- ✅ Accidental data exposure (Nuke sequence for complete erasure)

This app does NOT protect against:
- ❌ Browser compromises (malware, extensions)
- ❌ Physical attacks during active session
- ❌ Weak passwords (use bcrypt with high cost factor)

---

## License
MIT License. See [LICENSE](./LICENSE) file for details.

---

## Contributing
Security-first contributions welcome. Please review the architecture documentation before submitting PRs.

---

**Built with ❤️ for users who value privacy and control over their financial data.**
