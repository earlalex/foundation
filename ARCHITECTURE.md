# Foundation Framework Architecture Diagram

## Overview
Foundation is a zero-build web framework built with vanilla JavaScript ES Modules, Firebase, and Cloudflare Workers. It provides a complete content management system with admin dashboard, AI chatbot, and integrations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE (Browser)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         index.html (Entry Point)                        │  │
│  │  - Service Worker Registration                                         │  │
│  │  - ES Module Boot (index.js)                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                            index.js (Bootstrap)                         │  │
│  │  - Config Manager Init                                                 │  │
│  │  - Test Suites (Dev Mode)                                              │  │
│  │  - Router Mount                                                        │  │
│  │  - Navbar Init                                                         │  │
│  │  - Setup Wizard Guard                                                  │  │
│  │  - Chat Widget Mount                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│          ┌─────────────────────────┼─────────────────────────┐             │
│          ▼                         ▼                         ▼             │
│  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐         │
│  │   CORE LAYER  │       │  ROUTER LAYER │       │ COMPONENTS    │         │
│  ├───────────────┤       ├───────────────┤       ├───────────────┤         │
│  │ • auth.js     │       │ router.js     │       │ • ChatWidget  │         │
│  │ • config.js   │       │ test-router.js│       │ • ContentCard │         │
│  │ • db.js       │       │               │       │ • AuthorCard  │         │
│  │ • store.js    │       │               │       │               │         │
│  │ • theme.js    │       │               │       │               │         │
│  │ • validator.js│       │               │       │               │         │
│  │ • navbar.js   │       │               │       │               │         │
│  │ • error-h.js  │       │               │       │               │         │
│  │ • logger.js   │       │               │       │               │         │
│  │ • google-sv.js│       │               │       │               │         │
│  │ • drive-up.js │       │               │       │               │         │
│  └───────────────┘       └───────────────┘       └───────────────┘         │
│          │                         │                         │             │
│          └─────────────────────────┼─────────────────────────┘             │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          PAGE CONTROLLERS                             │  │
│  ├───────────────┬───────────────┬───────────────┬──────────────────────┤  │
│  │ home.js       │ admin.js      │ about.js       │ events/contact/etc.  │  │
│  │               │ (1605 lines)  │               │                      │  │
│  └───────────────┴───────────────┴───────────────┴──────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          SCHEMA REGISTRY                              │  │
│  │  • blog, book, education, event, howto, podcast, portfolio, etc.     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
        │  FIREBASE        │ │ CLOUDFLARE   │ │ GOOGLE APIs  │
        │  • Firestore     │ │ WORKERS      │ │ • Calendar   │
        │  • Auth          │ │ • chat-bot   │ │ • Contacts   │
        │                  │ • sms-webhook │ │ • Gmail      │
        │                  │ • voice-webhk │ │ • Search C.  │
        │                  │ • stripe-*    │ │ • Analytics  │
        │                  │ • vt-scan     │ │ • Drive      │
        │                  │ • workflow    │ │              │
        └──────────────────┘ └──────────────┘ └──────────────┘
```

## Data Flow

### Authentication Flow
```
User → Google Sign-in → Firebase Auth → Auth Manager → Store → UI Updates
                                                      ↓
                                              Admin Guard Check
```

### Content Management Flow
```
Admin Dashboard → Content Form → Schema Validation → ContentDB → Firestore
                                                              ↓
                                                     LocalStorage Fallback
```

### Chatbot Flow
```
User Message → ChatWidget → /api/chat-bot → AI Provider (Gemini/OpenAI)
     ↓                                              ↓
Chat Log ← ContentDB ← Response ←──────────────────┘
```

### Routing Flow
```
URL Change → Router → Path Normalization → Auth Guard → Page Load
                                                      ↓
                                              Controller Init → UI Render
```

## Key Design Patterns

### 1. **State Management (Store Pattern)**
- Centralized immutable state with Redux-like dispatch
- Schema-validated state transitions
- Subscriber pattern for reactive updates

### 2. **Configuration Management**
- Dual-layer: LocalStorage + Firestore sync
- Setup wizard for initial configuration
- Runtime config updates with persistence

### 3. **Database Abstraction**
- Firestore primary with LocalStorage fallback
- Schema-validated data operations
- Automatic offline handling

### 4. **Component Architecture**
- Web Components (Custom Elements)
- Theme-aware styling with CSS variables
- Mobile-first responsive design

### 5. **Security Model**
- Google Workspace admin authentication
- Route guards for protected pages
- Dev bypass for local development

## Module Dependencies

### Core Layer
```
config.js → Firebase Firestore
auth.js → Firebase Auth
store.js → validator.js
db.js → schema registry, Firebase
theme.js → CSS variables
google-services.js → Google APIs
```

### Router Layer
```
router.js → auth.js, store.js, config.js, validator.js
```

### Page Controllers
```
admin.js → store.js, db.js, drive-upload.js, google-services.js, theme.js, config.js
home.js → db.js, store.js
other pages → db.js, store.js
```

### Components
```
ChatWidget → config.js, db.js, store.js
ContentCard → theme variables
AuthorCard → theme variables
```

## API Endpoints (Cloudflare Workers)

| Endpoint | Purpose | Authentication |
|----------|---------|----------------|
| `/api/chat-bot` | AI chatbot responses | Public |
| `/api/sms-webhook` | Telnyx SMS handling | Webhook signature |
| `/api/voice-webhook` | Telnyx voice handling | Webhook signature |
| `/api/stripe-checkout` | Stripe checkout sessions | Public |
| `/api/stripe-webhook` | Stripe payment events | Webhook signature |
| `/api/virustotal-scan` | File scanning | API key |
| `/api/workflow-trigger` | Cloudflare workflow triggers | API key |
| `/api/download` | File downloads | Authenticated |

## Content Types (Schema Registry)

- **blog** - Blog posts
- **book** - Book publications
- **education** - Educational content
- **event** - Events and webinars
- **howto** - How-to guides
- **podcast** - Podcast episodes
- **portfolio** - Portfolio items
- **sponsor** - Sponsor information
- **announcement** - Announcements

## Theme System

### Presets
- **Default** - Standard blue theme
- **Emerald Modern** - Green-focused
- **Midnight Dark** - Dark mode
- **Cyberpunk Neon** - Neon accent dark

### Customization
- Color palette (primary, surface, background, text, border, accent, danger)
- Typography (font family, sizes, weights)
- Layout (border radius, container width, box shadows)

## Deployment Architecture

```
Development → Local testing with dev bypass
     ↓
Production → Cloudflare Pages (Static hosting)
     ↓
Backend → Cloudflare Workers (Serverless functions)
     ↓
Database → Firebase Firestore (NoSQL)
     ↓
Auth → Firebase Authentication (OAuth)
```

## Security Considerations

1. **Authentication**: Google Workspace OAuth with admin email whitelist
2. **Route Guards**: Admin routes protected by auth check
3. **API Security**: Webhook signature validation, API key checks
4. **Data Validation**: Schema registry for all content operations
5. **CORS**: Configured for Cloudflare Workers
6. **Firestore Rules**: Role-based access control

## Performance Optimizations

1. **Code Splitting**: Dynamic imports for page controllers
2. **Service Worker**: Offline caching with sw.js
3. **LocalStorage Fallback**: Offline database operations
4. **Lazy Loading**: Components loaded on demand
5. **CSS Variables**: Theme changes without re-render
