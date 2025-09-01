# Chess.com Clone - System Design & Architecture

![Chess Architecture](chess-arch.png)

## Project Overview

This document outlines the system design architecture for building a chess.com clone with basic player-to-player playing functionality. The architecture focuses on real-time multiplayer chess games with scalable, maintainable components.

## System Architecture

### High-Level Architecture

The system follows a modern web application architecture with the following key components:

- **Frontend**: React-based single-page application
- **Backend**: Node.js/Express server with WebSocket support
- **Database**: PostgreSQL for persistent data, Redis for session management
- **Chess Engine**: Stockfish integration for AI opponents (future enhancement)
- **Real-time Communication**: Socket.IO for WebSocket connections

### Component Breakdown

#### 1. Frontend Architecture (React)

**Core Components:**
- `ChessBoard`: Main game board component using react-chessboard
- `GameRoom`: Manages game state and player interactions
- `Authentication`: User login/registration components
- `Lobby`: Matchmaking and room creation interface
- `GameHistory`: Display past games and moves

**Key Libraries:**
- **React 18**: Modern React with hooks and concurrent features
- **react-chessboard**: Professional chess board visualization
- **chess.js**: Chess game logic and move validation
- **Socket.IO Client**: Real-time communication
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first styling framework

**Why These Choices:**
- **React over Vue/Angular**: Largest ecosystem, excellent TypeScript support, best performance for interactive UIs
- **react-chessboard over custom**: Proven, accessible, and battle-tested component
- **chess.js over custom logic**: Comprehensive chess rules implementation, PGN support, FEN handling

#### 2. Backend Architecture (Node.js)

**Core Modules:**
- **Game Manager**: Handles game lifecycle, state management
- **WebSocket Handler**: Manages real-time connections via Socket.IO
- **Authentication Service**: JWT-based user authentication
- **Matchmaking Service**: Player pairing and room management
- **Move Validator**: Server-side move validation for security

**Technology Stack:**
- **Node.js with Express**: Fast, JavaScript ecosystem consistency
- **Socket.IO**: Reliable WebSocket implementation with fallbacks
- **JWT**: Stateless authentication tokens
- **bcrypt**: Password hashing
- **Express Rate Limiting**: DoS protection

**Why These Choices:**
- **Node.js over Python/Java**: JavaScript full-stack consistency, excellent WebSocket support, large chess.js ecosystem
- **Socket.IO over raw WebSockets**: Automatic reconnection, room management, browser compatibility
- **JWT over sessions**: Stateless, scalable, microservice-friendly

#### 3. Database Design

**Primary Database: PostgreSQL**

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rating INTEGER DEFAULT 1200,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    white_player_id INTEGER REFERENCES users(id),
    black_player_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned
    result VARCHAR(20), -- white_wins, black_wins, draw, ongoing
    pgn TEXT, -- Portable Game Notation
    fen TEXT, -- Current position in FEN notation
    time_control VARCHAR(20), -- e.g., "10+0", "5+3"
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Moves table
CREATE TABLE moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    move_number INTEGER,
    player_color VARCHAR(5), -- white or black
    move_san VARCHAR(10), -- Standard Algebraic Notation
    move_uci VARCHAR(10), -- UCI notation
    time_spent INTEGER, -- milliseconds
    position_fen TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Session Store: Redis**
- Active game sessions
- WebSocket connection mapping
- Temporary matchmaking queues
- Rate limiting data

**Why These Choices:**
- **PostgreSQL over MongoDB**: ACID compliance for game integrity, complex queries for statistics, mature ecosystem
- **Redis over Memcached**: Rich data structures, pub/sub for real-time features, persistence options
- **Separate moves table**: Query flexibility, game analysis capabilities, better normalization

#### 4. Real-Time Communication

**WebSocket Architecture:**
- Each game creates a unique room in Socket.IO
- Players join their game room for move synchronization
- Broadcast moves to all players in the room
- Handle disconnections with reconnection logic

**Event Types:**
```javascript
// Client to Server
'join-game': { gameId, playerId }
'make-move': { gameId, move, timeSpent }
'offer-draw': { gameId }
'resign': { gameId }

// Server to Client  
'game-joined': { gameData, playerColor }
'move-made': { move, gameState, timeRemaining }
'game-over': { result, reason }
'opponent-disconnected': { reconnectTime }
```

**Why Socket.IO:**
- Automatic fallback to polling if WebSockets fail
- Built-in room management
- Reconnection handling
- Cross-browser compatibility

#### 5. Deployment Architecture

**Containerized Deployment:**
```
Frontend (React) → Nginx → Docker Container
Backend (Node.js) → PM2 → Docker Container  
Database (PostgreSQL) → Docker Container
Cache (Redis) → Docker Container
```

**Infrastructure:**
- **Frontend**: Deployed on Vercel/Netlify for CDN benefits
- **Backend**: AWS ECS or Digital Ocean Droplets
- **Database**: AWS RDS PostgreSQL with read replicas
- **Cache**: AWS ElastiCache Redis
- **Load Balancer**: AWS ALB with sticky sessions for WebSockets

## Alternative Technologies Considered

### Frontend Alternatives

**Vue.js vs React:**
- **Rejected Vue**: Smaller ecosystem for chess-specific libraries, less TypeScript adoption
- **Chosen React**: Mature ecosystem, excellent chess libraries, better performance for frequent updates

**Angular vs React:**
- **Rejected Angular**: Heavy framework for chess game, complex setup, overkill for this use case
- **Chosen React**: Lightweight, component-based, perfect for interactive games

**Custom Canvas vs react-chessboard:**
- **Rejected Custom**: High development time, accessibility issues, maintenance burden
- **Chosen react-chessboard**: Professional appearance, accessibility built-in, touch support

### Backend Alternatives

**Python Flask/Django vs Node.js:**
- **Rejected Python**: Different language from frontend, slower for I/O intensive operations
- **Chosen Node.js**: Same language as frontend, excellent WebSocket performance, event-driven

**Socket.IO vs Native WebSockets:**
- **Rejected Native**: No automatic reconnection, no room management, browser compatibility issues
- **Chosen Socket.IO**: Production-ready, handles edge cases, extensive documentation

**Express vs Fastify:**
- **Rejected Fastify**: Smaller ecosystem, fewer Socket.IO examples
- **Chosen Express**: Mature, extensive middleware, better Socket.IO integration

### Database Alternatives

**MongoDB vs PostgreSQL:**
- **Rejected MongoDB**: No ACID transactions, complex queries difficult, rating calculations harder
- **Chosen PostgreSQL**: ACID compliance, mature JSON support, better for analytics

**MySQL vs PostgreSQL:**
- **Rejected MySQL**: Weaker JSON support, licensing concerns, less advanced features
- **Chosen PostgreSQL**: Superior JSON operations, better full-text search, open source

## Security Considerations

1. **Move Validation**: All moves validated server-side using chess.js
2. **Rate Limiting**: Prevent spam moves and DoS attacks
3. **Authentication**: JWT tokens with short expiration
4. **Input Sanitization**: All user inputs sanitized and validated
5. **WebSocket Security**: Origin validation, authenticated connections only

## Performance Optimizations

1. **Frontend**: 
   - React.memo for board components
   - Debounced move input
   - Optimistic UI updates

2. **Backend**:
   - Redis caching for active games
   - Database connection pooling
   - Efficient WebSocket event handling

3. **Database**:
   - Indexed queries on game lookups
   - Partitioned moves table for large datasets
   - Read replicas for statistics

## Scalability Plan

### Phase 1: Single Server (0-1K concurrent users)
- Single Node.js instance
- Single PostgreSQL database
- Redis for sessions

### Phase 2: Horizontal Scaling (1K-10K concurrent users)
- Multiple Node.js instances behind load balancer
- Redis pub/sub for cross-instance communication
- Database read replicas

### Phase 3: Microservices (10K+ concurrent users)
- Separate services for authentication, matchmaking, game logic
- Message queue (RabbitMQ/Kafka) for service communication
- Dedicated WebSocket gateway service

## Development Roadmap

### MVP Features (Month 1)
- [x] Basic chess board with piece movement
- [x] Real-time multiplayer gameplay
- [x] User authentication
- [x] Simple matchmaking

### Phase 2 Features (Month 2-3)
- [ ] Game history and analysis
- [ ] Rating system (Elo)
- [ ] Time controls
- [ ] Draw offers and resignation

### Phase 3 Features (Month 4-6)
- [ ] AI opponent integration (Stockfish)
- [ ] Tournament system
- [ ] Chat functionality
- [ ] Mobile responsive design

### Future Enhancements
- [ ] Video chat integration
- [ ] Puzzle solving
- [ ] Opening database
- [ ] Advanced analytics

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/chess-clone.git
cd chess-clone

# Backend setup
cd backend
npm install
cp .env.example .env
# Configure database and Redis in .env
npm run migrate
npm run dev

# Frontend setup (new terminal)
cd ../frontend
npm install
npm start
```

### Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/chess_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=5000

# Frontend (.env.local)
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow code style guidelines
4. Add tests for new features
5. Submit a pull request

## License

MIT License - see LICENSE file for details

---

This architecture provides a solid foundation for a chess.com clone while maintaining flexibility for future enhancements and scaling requirements.