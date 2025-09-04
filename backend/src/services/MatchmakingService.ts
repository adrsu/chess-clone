import { GameService } from './GameService';

interface WaitingPlayer {
  id: string;
  username: string;
  rating: number;
  socketId: string;
  joinedAt: Date;
}

export class MatchmakingService {
  // In-memory storage for matchmaking queue
  private static waitingPlayers: Map<string, WaitingPlayer> = new Map();
  private static queue: WaitingPlayer[] = [];

  static async joinQueue(player: WaitingPlayer): Promise<void> {
    // Check if player is already in queue
    if (this.waitingPlayers.has(player.id)) {
      console.log(`Player ${player.username} is already in matchmaking queue`);
      return;
    }
    
    // Add player to queue
    this.waitingPlayers.set(player.id, player);
    this.queue.push(player);
    
    // Sort queue by join time (oldest first)
    this.queue.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    console.log(`Player ${player.username} joined matchmaking queue (${this.queue.length} players in queue)`);
  }

  static async leaveQueue(playerId: string): Promise<void> {
    const player = this.waitingPlayers.get(playerId);
    if (player) {
      // Remove from both data structures
      this.waitingPlayers.delete(playerId);
      this.queue = this.queue.filter(p => p.id !== playerId);
      console.log(`Player ${player.username} left matchmaking queue (${this.queue.length} players remaining)`);
    }
  }

  static async findMatch(): Promise<{ player1: WaitingPlayer; player2: WaitingPlayer; gameId: string } | null> {
    // Need at least 2 players to make a match
    if (this.queue.length < 2) {
      return null;
    }

    // Get the two oldest players from queue
    const player1 = this.queue[0];
    const player2 = this.queue[1];

    // Remove both players from queue
    await this.leaveQueue(player1.id);
    await this.leaveQueue(player2.id);

    // Create game with random color assignment
    const isPlayer1White = Math.random() < 0.5;
    const whitePlayer = isPlayer1White ? player1.id : player2.id;
    const blackPlayer = isPlayer1White ? player2.id : player1.id;

    const gameId = await GameService.createGame(whitePlayer, blackPlayer);

    console.log(`Match found! Game ${gameId} created between ${player1.username} (${isPlayer1White ? 'White' : 'Black'}) and ${player2.username} (${isPlayer1White ? 'Black' : 'White'})`);

    return { player1, player2, gameId };
  }

  static async getQueueStatus(): Promise<{ playersInQueue: number; estimatedWaitTime: number }> {
    const queueLength = this.queue.length;
    
    // Simple estimate: assume 30 seconds per player ahead in queue
    const estimatedWaitTime = Math.max(0, (queueLength - 1)) * 30;

    return {
      playersInQueue: queueLength,
      estimatedWaitTime
    };
  }

  static async isPlayerInQueue(playerId: string): Promise<boolean> {
    return this.waitingPlayers.has(playerId);
  }

  // Utility method to get queue state for debugging
  static getQueueDebugInfo(): { players: WaitingPlayer[]; queueSize: number } {
    return {
      players: [...this.queue],
      queueSize: this.queue.length
    };
  }

  // Clean up disconnected players from queue
  static cleanupDisconnectedPlayer(socketId: string): void {
    const playerToRemove = this.queue.find(p => p.socketId === socketId);
    if (playerToRemove) {
      this.leaveQueue(playerToRemove.id);
      console.log(`Cleaned up disconnected player ${playerToRemove.username} from matchmaking queue`);
    }
  }
}