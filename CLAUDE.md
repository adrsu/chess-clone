# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a full-stack chess.com clone with real-time multiplayer functionality:

- **Backend** (`/backend`): Node.js/Express server with TypeScript
- **Frontend** (`/frontend`): React application with TypeScript  
- **Database**: PostgreSQL with Redis for session management
- **Real-time**: Socket.IO for WebSocket communication

## Common Development Commands

### Backend Commands
```bash
cd backend
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run migrate      # Run database migrations
npm run test         # Run Jest tests
npm run lint         # ESLint code checking
npm run format       # Format code with Prettier
```

### Frontend Commands
```bash
cd frontend
npm start           # Start development server
npm run build       # Build for production
npm run test        # Run React testing suite
```

## Key Architecture Components

### Backend Architecture
- **Express Application**: Main app setup in `src/app.ts`
- **WebSocket Service**: Socket.IO integration in `src/services/SocketService.ts`
- **Game Logic**: Chess game management in `src/services/GameService.ts`
- **Authentication**: JWT-based auth in `src/middleware/auth.ts`
- **Database Models**: PostgreSQL models in `src/models/`
- **API Routes**: RESTful endpoints in `src/routes/`

### Frontend Architecture
- **Context Providers**: 
  - `AuthContext`: User authentication and JWT management
  - `SocketContext`: WebSocket connection management
- **Core Components**:
  - `ChessBoard`: Main game interface using react-chessboard
  - `LoginForm`/`RegistrationForm`: Authentication forms
- **Real-time Game State**: Managed via Socket.IO events

### Database Schema
- **users**: User accounts with ratings and game history
- **games**: Game sessions with FEN positions and PGN notation  
- **moves**: Individual move history for analysis

### Technology Stack
- **Chess Logic**: chess.js library for move validation and game rules
- **UI Framework**: React with Tailwind CSS
- **Real-time**: Socket.IO with room-based game sessions
- **Database**: PostgreSQL with Redis for active game sessions
- **Security**: bcrypt for passwords, JWT for sessions, helmet for Express security

## Development Setup Requirements

1. **Database Setup**: 
   - PostgreSQL 14+ running on port 5432
   - Redis 6+ running on port 6379
   - Database named `chess_db` must exist

2. **Environment Variables**: 
   - Backend requires `.env` with DATABASE_URL, REDIS_URL, JWT_SECRET
   - Frontend requires `.env.local` with API endpoints

3. **Migration**: Always run `npm run migrate` after database changes

## Testing Strategy

- **Backend**: Jest tests for API endpoints and game logic
- **Frontend**: React Testing Library for component testing
- **Integration**: Socket.IO events should be tested for real-time functionality

## Real-time Game Flow

1. Players join game rooms via Socket.IO
2. Moves validated server-side using chess.js
3. Game state stored in both PostgreSQL (persistence) and Redis (active sessions)
4. Move broadcasts to all players in game room
5. Game over conditions handled automatically

## Security Considerations

- All moves validated server-side to prevent cheating
- JWT tokens used for WebSocket authentication
- Rate limiting applied to prevent spam
- Input validation on all API endpoints