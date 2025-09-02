import pool from '../config/database';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  rating: number;
  games_played: number;
  created_at: Date;
}

export class UserModel {
  static async create(username: string, email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) RETURNING *`,
      [username, email, hashedPassword]
    );
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async updateRating(userId: number, newRating: number): Promise<void> {
    await pool.query(
      'UPDATE users SET rating = $1, games_played = games_played + 1 WHERE id = $2',
      [newRating, userId]
    );
  }
}
