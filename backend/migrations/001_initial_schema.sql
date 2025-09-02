CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rating INTEGER DEFAULT 1200,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    white_player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    black_player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    result VARCHAR(20) CHECK (result IN ('white_wins', 'black_wins', 'draw', 'ongoing')),
    pgn TEXT DEFAULT '',
    fen TEXT NOT NULL,
    time_control VARCHAR(20) DEFAULT '10+0',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Moves table
CREATE TABLE moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    move_number INTEGER NOT NULL,
    player_color VARCHAR(5) NOT NULL CHECK (player_color IN ('white', 'black')),
    move_san VARCHAR(10) NOT NULL,
    move_uci VARCHAR(10) NOT NULL,
    time_spent INTEGER DEFAULT 0, -- in milliseconds
    position_fen TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_games_players ON games(white_player_id, black_player_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
