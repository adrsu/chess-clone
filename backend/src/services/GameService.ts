import { Chess } from 'chess.js';
import { GameModel } from '../models/Game';
import { safeRedis } from '../config/redis';

export class GameService {
  static async createGame(whitePlayerId: number, blackPlayerId: number): Promise<number> {
    const game = await GameModel.create(whitePlayerId, blackPlayerId);
    
    // Store active game in Redis
    await safeRedis.hset(`game:${game.id}`, {
      white_player_id: whitePlayerId,
      black_player_id: blackPlayerId,
      fen: new Chess().fen(),
      turn: 'white',
      status: 'active'
    });

    return game.id;
  }

  static async makeMove(gameId: number, playerId: number, move: string): Promise<{
    success: boolean;
    gameState?: any;
    error?: string;
  }> {
    try {
      const gameData = await safeRedis.hmget(`game:${gameId}`, 
        'fen', 'turn', 'white_player_id', 'black_player_id', 'status'
      );
      
      if (!gameData[0] || gameData[4] !== 'active') {
        return { success: false, error: 'Game not found or not active' };
      }

      const [fen, turn, whitePlayerId, blackPlayerId] = gameData;
      
      if (!whitePlayerId || !blackPlayerId) {
        return { success: false, error: 'Game data corrupted' };
      }
      
      const playerColor = parseInt(whitePlayerId!) === playerId ? 'white' : 'black';
      
      if (turn !== playerColor) {
        return { success: false, error: 'Not your turn' };
      }

      const chess = new Chess(fen);
      const moveResult = chess.move(move);
      
      if (!moveResult) {
        return { success: false, error: 'Invalid move' };
      }

      const newFen = chess.fen();
      const newTurn = chess.turn() === 'w' ? 'white' : 'black';
      const isGameOver = chess.isGameOver();

      // Update Redis
      await safeRedis.hmset(`game:${gameId}`, {
        fen: newFen,
        turn: newTurn,
        status: isGameOver ? 'completed' : 'active'
      });

      // Update database
      await GameModel.updateGameState(gameId, newFen, chess.pgn());

      if (isGameOver) {
        let result = 'draw';
        if (chess.isCheckmate()) {
          result = chess.turn() === 'w' ? 'black_wins' : 'white_wins';
        } else if (chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
          result = 'draw';
        }
        
        await GameModel.endGame(gameId, result);
        
        // Update Redis status
        await safeRedis.hmset(`game:${gameId}`, {
          status: 'completed',
          result: result
        });
      }

      return {
        success: true,
        gameState: {
          fen: newFen,
          turn: newTurn,
          isGameOver,
          lastMove: moveResult,
          pgn: chess.pgn()
        }
      };
    } catch (error) {
      return { success: false, error: 'Internal server error' };
    }
  }
}
