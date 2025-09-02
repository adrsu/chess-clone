import pool from '../config/database';
import { Chess } from 'chess.js';

export interface Game {
  id: number;
  white_player_id: number;
  black_player_id: number;
  status: 'active' | 'completed' | 'abandoned';
  result: 'white_wins' | 'black_wins' | 'draw' | 'ongoing';
  pgn: string;
  fen: string;
  time_control: string;
  started_at: Date;
  ended_at?: Date;
}

export class GameModel {
  static async create(whitePlayerId: number, blackPlayerId: number, timeControl: string = '10+0'): Promise<Game> {
    const chess = new Chess();
    const result = await pool.query(
      `INSERT INTO games (white_player_id, black_player_id, fen, time_control) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [whitePlayerId, blackPlayerId, chess.fen(), timeControl]
    );
    return result.rows[0];
  }

  static async findById(id: number): Promise<Game | null> {
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async updateGameState(id: number, fen: string, pgn: string): Promise<void> {
    await pool.query(
      'UPDATE games SET fen = $1, pgn = $2 WHERE id = $3',
      [fen, pgn, id]
    );
  }

  static async endGame(id: number, result: string): Promise<void> {
    await pool.query(
      'UPDATE games SET status = $1, result = $2, ended_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['completed', result, id]
    );
  }

  static async getPlayerGames(playerId: number): Promise<Game[]> {
    const result = await pool.query(
      'SELECT * FROM games WHERE white_player_id = $1 OR black_player_id = $1 ORDER BY started_at DESC',
      [playerId]
    );
    return result.rows;
  }
}
