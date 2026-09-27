# CalLaw - Frontend Application

Modern, authoritative California legal information assistant interface built with Next.js 14, TypeScript, Tailwind CSS, and Clerk Authentication.

---

## 🏛️ Features

- **Date-Grouped Conversation History**: Persistent sidebar grouping legal inquiries into *Today*, *Yesterday*, *Previous 7 Days*, and *Older*.
- **Interactive Clarification Workflows**: Highlights missing factual predicates with dedicated UI badges when additional context is required.
- **Authoritative Legal Source Cards**: Renders verified California statutory citations (`Cal. Civ. Code § ...`, `Cal. Lab. Code § ...`), statutory titles, relevance summaries, and direct links to official California Legislative Information text.
- **Uncertainty & Fact Dependency Callouts**: Differentiates objective statutory rules from factual uncertainties.
- **Responsive Layout**: Clean desktop view with collapsible mobile drawer.
- **Clerk Authentication**: Hardware/social login with automated bearer token injection into backend API requests.

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 9+

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure Clerk credentials if available:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_BACKEND_API_URL="http://localhost:8000/api/v1"
```
*(Note: If Clerk keys are omitted in development, CalLaw will automatically operate with a default California Citizen session for frictionless local testing).*

### 3. Installation
```bash
npm install
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Key File Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout with ClerkProvider
│   ├── page.tsx                    # Landing page
│   ├── (auth)/                     # Sign-in & Sign-up routes
│   └── chat/
│       ├── layout.tsx              # Sidebar + Disclaimer container
│       ├── page.tsx                # New inquiry landing screen
│       └── [conversationId]/       # Active conversation thread
├── components/
│   ├── chat/                       # MessageBubble, ChatInput, ResearchProgress
│   ├── sidebar/                    # Sidebar, ConversationList
│   └── legal/                      # LegalSourceCard, UncertaintySection, Disclaimer
├── lib/
│   ├── api.ts                      # REST client with Bearer token injector
│   └── utils.ts                    # Date grouping & styling utilities
└── types/
    └── index.ts                    # Shared TypeScript data models
```
