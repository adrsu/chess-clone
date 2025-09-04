import { GameModel } from '../models/Game';
import { GameService } from './GameService';

export class GameTimeoutService {
  private static readonly GAME_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
  private static timeoutChecks: Map<string, NodeJS.Timeout> = new Map();

  static startGameTimeout(gameId: string, io: any) {
    // Clear any existing timeout for this game
    this.clearGameTimeout(gameId);

    const timeout = setTimeout(async () => {
      try {
        await this.handleGameTimeout(gameId, io);
      } catch (error) {
        console.error(`Error handling timeout for game ${gameId}:`, error);
      }
    }, this.GAME_TIMEOUT);

    this.timeoutChecks.set(gameId, timeout);
    console.log(`Started 10-minute timeout for game ${gameId}`);
  }

  static clearGameTimeout(gameId: string) {
    const existingTimeout = this.timeoutChecks.get(gameId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.timeoutChecks.delete(gameId);
      console.log(`Cleared timeout for game ${gameId}`);
    }
  }

  private static async handleGameTimeout(gameId: string, io: any) {
    try {
      // Check if game is still active in cache first, then database
      const gameState = await GameService.getGameState(gameId);
      if (!gameState || gameState.status !== 'active') {
        console.log(`Game ${gameId} is no longer active, skipping timeout`);
        this.clearGameTimeout(gameId);
        return;
      }

      console.log(`Game ${gameId} timed out after 10 minutes, marking as draw`);

      // Update game status to draw in database
      await GameModel.endGame(gameId, 'draw');

      // Clean up the completed game from cache
      GameService.cleanupCompletedGame(gameId);

      // Notify players
      io.to(`game-${gameId}`).emit('game-over', {
        result: 'draw',
        reason: 'timeout',
        message: 'Game ended in a draw due to 10-minute time limit'
      });

      // Clean up timeout
      this.clearGameTimeout(gameId);

    } catch (error) {
      console.error(`Error in handleGameTimeout for game ${gameId}:`, error);
    }
  }

  static restartTimeoutForMove(gameId: string, io: any) {
    // Restart the timeout when a move is made
    this.startGameTimeout(gameId, io);
  }

  static stopAllTimeouts() {
    for (const [gameId, timeout] of this.timeoutChecks.entries()) {
      clearTimeout(timeout);
      console.log(`Stopped timeout for game ${gameId}`);
    }
    this.timeoutChecks.clear();
  }

  static getActiveTimeouts(): string[] {
    return Array.from(this.timeoutChecks.keys());
  }
}