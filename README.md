# Ledger Tracker

[![Framework](https://img.shields.io/badge/Framework-React_18-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Build Tool](https://img.shields.io/badge/Build_Tool-Vite-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Database](<https://img.shields.io/badge/Database-IndexedDB_(Dexie)-333333?style=flat-square&logo=icloud>)](https://dexie.org/)
[![Language](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Styling](https://img.shields.io/badge/Styling-Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

**Ledger Tracker** is a secure, offline-first personal finance tracker designed to help users take full control of their financial journey with a privacy-focused approach. Built specifically with modern web technologies, it provides a seamless experience for tracking income, expenses, and budgets without ever sending your sensitive data to a server.

---

## Screenshots

|              Dashboard Overview               |              Fully Customizable               |
| :-------------------------------------------: | :-------------------------------------------: |
| ![Dashboard Overview](/public/s-overview.png) | ![Fully Customizable](/public/s-settings.png) |

|             Filter & Sort              |             Founder - Developer             |
| :------------------------------------: | :-----------------------------------------: |
| ![Filter & Sort](/public/s-ledger.png) | ![Founder - Developer](/public/s-about.png) |

---

## Key Features

- **Privacy First:** Your financial data stays exclusively on your device. We use **IndexedDB** technology to ensure records are secure and accessible even without an internet connection.
- **Comprehensive Dashboard:** Get an immediate overview of your Total Balance, Monthly Income, Expenses, and Savings Rate.
- **Quick Transaction Entry:** Effortlessly add new income or expenses with a streamlined interface.
- **Visual Analytics:** Understand your spending habits through interactive **Spending Trends** and **Category Breakdown** charts.
- **Intelligent Ledger:** View, edit, and manage your entire transaction history with ease.
- **Budget Management:** Set and track financial goals across different categories and periods (Weekly, Monthly, Yearly).
- **Halal-Friendly Design:** Includes a thoughtful set of default categories with positive, Halal-friendly icons like "Charity", "Education", and "Family".

---

## Tech Stack

- **Frontend:** React 18 with TypeScript.
- **State Management:** TanStack React Query (v5).
- **Database:** Dexie.js (IndexedDB wrapper) for robust offline storage.
- **Styling:** Tailwind CSS with Shadcn/UI components.
- **Icons:** Lucide React.
- **Charts:** Recharts for data visualization.
- **Form Handling:** React Hook Form & Zod for schema validation.
- **Animations:** Framer Motion for smooth UI transitions.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [Bun](https://bun.sh/) or [pnpm](https://pnpm.io/) / [npm](https://www.npmjs.com/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/md8-habibullah/pocket-ledger-bd.git](https://github.com/md8-habibullah/pocket-ledger-bd.git)
    cd pocket-ledger-bd
    ```

2.  **Install dependencies:**

    ```bash
    bun install
    # OR
    pnpm install
    # OR
    npm install
    ```

3.  **Start the development server:**

    ```bash
    bun dev
    ```

4.  **Build for production:**
    ```bash
    bun run build
    ```

---

## Project Structure

```text
src/
├── components/       # Reusable UI components (Shadcn/UI)
│   ├── dashboard/    # Cards and Charts
│   ├── layout/       # Sidebar and Main Wrappers
│   └── transactions/ # Dialogs and Ledger components
├── db/               # Dexie Database configuration and schemas
├── hooks/            # Custom React hooks (Transactions, Currency, Theme)
├── lib/              # Utility functions
└── pages/            # Main application views (Index, Ledger, Budgets, About)
```
