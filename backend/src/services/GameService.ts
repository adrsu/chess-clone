import { Chess } from 'chess.js';
import { GameModel } from '../models/Game';

interface GameState {
  white_player_id: string;
  black_player_id: string;
  fen: string;
  turn: 'white' | 'black';
  status: 'active' | 'completed';
  result?: string;
  pgn?: string;
}

export class GameService {
  // In-memory cache for active games
  private static gameCache: Map<string, GameState> = new Map();

  static async createGame(whitePlayerId: string, blackPlayerId: string): Promise<string> {
    const game = await GameModel.create(whitePlayerId, blackPlayerId);
    
    // Cache the new game state in memory
    const initialGameState: GameState = {
      white_player_id: whitePlayerId,
      black_player_id: blackPlayerId,
      fen: new Chess().fen(),
      turn: 'white',
      status: 'active'
    };
    
    this.gameCache.set(game.id, initialGameState);
    console.log(`Game ${game.id} created and cached in memory`);

    return game.id;
  }

  static async getGameState(gameId: string): Promise<GameState | null> {
    // Check cache first
    if (this.gameCache.has(gameId)) {
      return this.gameCache.get(gameId)!;
    }
    
    // Fallback to database if not in cache
    const game = await GameModel.findById(gameId);
    if (game) {
      const chess = new Chess(game.fen);
      const gameState: GameState = {
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        fen: game.fen,
        turn: chess.turn() === 'w' ? 'white' : 'black',
        status: game.status as 'active' | 'completed',
        result: game.result,
        pgn: game.pgn
      };
      
      // Cache it for future use
      this.gameCache.set(gameId, gameState);
      console.log(`Game ${gameId} loaded from database and cached`);
      return gameState;
    }
    
    return null;
  }

  static async makeMove(gameId: string, playerId: string, move: string): Promise<{
    success: boolean;
    gameState?: any;
    error?: string;
  }> {
    try {
      // Get game state from cache or database
      const gameState = await this.getGameState(gameId);
      
      if (!gameState || gameState.status !== 'active') {
        return { success: false, error: 'Game not found or not active' };
      }
      
      const playerColor = gameState.white_player_id === playerId ? 'white' : 'black';
      
      if (gameState.turn !== playerColor) {
        return { success: false, error: 'Not your turn' };
      }

      const chess = new Chess(gameState.fen);
      const moveResult = chess.move(move);
      
      if (!moveResult) {
        return { success: false, error: 'Invalid move' };
      }

      const newFen = chess.fen();
      const newTurn = chess.turn() === 'w' ? 'white' : 'black';
      const isGameOver = chess.isGameOver();

      // Update cached game state
      const updatedGameState: GameState = {
        ...gameState,
        fen: newFen,
        turn: newTurn,
        status: isGameOver ? 'completed' : 'active',
        pgn: chess.pgn()
      };

      // Handle game end
      if (isGameOver) {
        let result = 'draw';
        if (chess.isCheckmate()) {
          result = chess.turn() === 'w' ? 'black_wins' : 'white_wins';
        } else if (chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
          result = 'draw';
        }
        
        updatedGameState.result = result;
        
        // Update database with final result
        await GameModel.endGame(gameId, result);
        console.log(`Game ${gameId} ended: ${result}`);
      } else {
        // Update database with current state
        await GameModel.updateGameState(gameId, newFen, chess.pgn());
      }

      // Update cache
      this.gameCache.set(gameId, updatedGameState);

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
      console.error('Error making move:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  // Clean up completed games from cache to prevent memory leaks
  static cleanupCompletedGame(gameId: string): void {
    const gameState = this.gameCache.get(gameId);
    if (gameState && gameState.status === 'completed') {
      this.gameCache.delete(gameId);
      console.log(`Cleaned up completed game ${gameId} from cache`);
    }
  }

  // Get cache status for debugging
  static getCacheStatus(): { activeGames: number; gameIds: string[] } {
    return {
      activeGames: this.gameCache.size,
      gameIds: Array.from(this.gameCache.keys())
    };
  }

  // Force refresh game state from database
  static async refreshGameFromDatabase(gameId: string): Promise<GameState | null> {
    // Remove from cache to force database lookup
    this.gameCache.delete(gameId);
    return await this.getGameState(gameId);
  }
}
