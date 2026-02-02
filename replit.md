# Overview

Compete & Earn Real Money is a gaming application that enables players to participate in competitive games with real money entry fees and prizes. The platform facilitates game lobbies where players can join contests, compete against each other, and win monetary rewards. The application provides a complete gaming ecosystem with user account management, transaction tracking, and game state management.

# Recent Changes (October 24, 2025)

## Fixed Critical Prize Pool Bug
- **Issue**: All games were being created with $0.00 prize pool (hardcoded value), preventing winners from receiving payouts
- **Fix**: Prize amount is now calculated dynamically when a game is created
- **Formula**: `prizeAmount = entryFee × maxPlayers × (1 - 0.20 commission)`
- **Example**: 2-player game with $2 entry fee → $4 total × 0.80 = **$3.20 prize pool**
- **Commission Rate**: 20% platform commission on all games
- **Location**: `server/firestore-storage.ts` in the `createGame()` function
- **Note**: Existing Firestore games with $0.00 prize amounts will need to be recreated or manually backfilled

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built using React with TypeScript and follows a modern component-based architecture. The UI is styled with Tailwind CSS and uses shadcn/ui for consistent component design. The application uses Wouter for client-side routing and TanStack Query for server state management with real-time polling capabilities.

Key frontend decisions:
- **React with TypeScript**: Provides type safety and modern development experience
- **Wouter routing**: Lightweight alternative to React Router for client-side navigation
- **TanStack Query**: Manages server state with built-in caching, background updates, and real-time polling
- **shadcn/ui + Tailwind CSS**: Ensures consistent, accessible UI components with utility-first styling
- **Custom dark theme**: Implements a gaming-focused color scheme with browns and teals

## Backend Architecture
The server is built with Express.js and follows a RESTful API design pattern. It uses an in-memory storage system during development with plans for PostgreSQL integration. The architecture separates concerns through distinct layers for routing, storage, and business logic.

Key backend decisions:
- **Express.js**: Provides robust HTTP server capabilities with middleware support
- **RESTful API design**: Ensures predictable and standardized endpoints
- **Memory storage with PostgreSQL ready**: Allows rapid development while being prepared for production database
- **Shared schema validation**: Uses Drizzle-Zod for consistent data validation between client and server

## Data Storage Strategy
The application uses **Firebase/Firestore** as the primary cloud database, providing persistent storage that survives deployments and restarts. The setup uses Firebase Admin SDK for server-side operations with modular ESM imports.

Storage design considerations:
- **Firestore Cloud Database**: Provides persistent, scalable NoSQL storage with real-time capabilities
- **Firebase Admin SDK**: Server-side SDK using modular API (firebase-admin/app, firebase-admin/firestore)
- **Secure credential management**: Firebase credentials stored as environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
- **Fallback to FileStorage**: Development fallback to JSON files if Firebase credentials are not configured
- **UUID primary keys**: Ensures globally unique identifiers across distributed systems

### Firebase Configuration
The app is configured with Firebase project "realanima-ai" (Project ID: realanima-ai). All data is stored in Firestore collections including:
- users (14 documents migrated)
- games  
- transactions (394 documents migrated)
- game_participants
- yahtzee_player_states
- match_results
- and more...

**Recent Migration (Oct 15, 2025)**:
- Successfully migrated all JSON database files to Firestore cloud storage
- Fixed Firestore queries to work without composite indexes by filtering in-memory
- All database operations now fully functional with persistent cloud storage

## Real-time Features
The application implements real-time functionality through aggressive polling strategies rather than WebSocket connections. This approach provides simpler implementation while maintaining responsive user experience for game state updates.

Real-time implementation:
- **Polling-based updates**: Games list polls every 5 seconds, active games every 2 seconds
- **Optimistic updates**: UI responds immediately to user actions before server confirmation
- **Query invalidation**: Ensures data consistency across related queries after mutations

## Authentication and User Management
The system uses a simplified authentication model with hardcoded user IDs for development, designed to integrate with external authentication providers in production. User profiles include gaming statistics, balance management, and transaction history.

User management features:
- **Profile management**: Handles user avatars, usernames, and gaming statistics
- **Balance system**: Tracks user funds with decimal precision for monetary transactions
- **Transaction history**: Maintains detailed records of all financial activities
- **Gaming statistics**: Tracks games played, games won, and total winnings

# External Dependencies

## UI and Styling
- **@radix-ui/react-***: Provides accessible, unstyled UI primitives for complex components
- **tailwindcss**: Utility-first CSS framework for rapid UI development
- **class-variance-authority**: Manages component variant styling patterns
- **lucide-react**: Consistent icon library with gaming-appropriate iconography

## State Management and Data Fetching
- **@tanstack/react-query**: Handles server state management with caching and background synchronization
- **wouter**: Lightweight client-side routing solution

## Database and Cloud Storage
- **firebase-admin**: Server-side Firebase Admin SDK for Firestore database operations
- **Firebase/Firestore**: Cloud-based NoSQL database providing persistent, scalable storage
- **drizzle-orm**: Type-safe ORM for PostgreSQL schema validation
- **drizzle-kit**: Database migration and introspection tooling

## Development and Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Provides static type checking and enhanced developer experience
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay for Replit environment