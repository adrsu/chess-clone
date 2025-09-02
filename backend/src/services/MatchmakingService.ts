import redis from '../config/redis';
import { GameService } from './GameService';

interface WaitingPlayer {
  id: number;
  username: string;
  rating: number;
  socketId: string;
  joinedAt: Date;
}

export class MatchmakingService {
  private static readonly QUEUE_KEY = 'matchmaking:queue';
  private static readonly PLAYER_PREFIX = 'matchmaking:player:';

  static async joinQueue(player: WaitingPlayer): Promise<void> {
    // Add player to queue
    await redis.zadd(this.QUEUE_KEY, Date.now(), player.id);
    
    // Store player details
    await redis.hset(`${this.PLAYER_PREFIX}${player.id}`, {
      id: player.id,
      username: player.username,
      rating: player.rating,
      socketId: player.socketId,
      joinedAt: player.joinedAt.toISOString()
    });

    console.log(`Player ${player.username} joined matchmaking queue`);
  }

  static async leaveQueue(playerId: number): Promise<void> {
    // Remove from queue
    await redis.zrem(this.QUEUE_KEY, playerId);
    
    // Remove player details
    await redis.del(`${this.PLAYER_PREFIX}${playerId}`);

    console.log(`Player ${playerId} left matchmaking queue`);
  }

  static async findMatch(): Promise<{ player1: WaitingPlayer; player2: WaitingPlayer; gameId: number } | null> {
    // Get oldest two players from queue
    const playerIds = await redis.zrange(this.QUEUE_KEY, 0, 1);
    
    if (playerIds.length < 2) {
      return null;
    }

    // Get player details
    const player1Data = await redis.hgetall(`${this.PLAYER_PREFIX}${playerIds[0]}`);
    const player2Data = await redis.hgetall(`${this.PLAYER_PREFIX}${playerIds[1]}`);

    if (!player1Data.id || !player2Data.id) {
      // Clean up corrupted data
      await this.leaveQueue(parseInt(playerIds[0]));
      await this.leaveQueue(parseInt(playerIds[1]));
      return null;
    }

    const player1: WaitingPlayer = {
      id: parseInt(player1Data.id),
      username: player1Data.username,
      rating: parseInt(player1Data.rating),
      socketId: player1Data.socketId,
      joinedAt: new Date(player1Data.joinedAt)
    };

    const player2: WaitingPlayer = {
      id: parseInt(player2Data.id),
      username: player2Data.username,
      rating: parseInt(player2Data.rating),
      socketId: player2Data.socketId,
      joinedAt: new Date(player2Data.joinedAt)
    };

    // Remove both players from queue
    await this.leaveQueue(player1.id);
    await this.leaveQueue(player2.id);

    // Create game (randomly assign colors)
    const isPlayer1White = Math.random() < 0.5;
    const whitePlayer = isPlayer1White ? player1.id : player2.id;
    const blackPlayer = isPlayer1White ? player2.id : player1.id;

    const gameId = await GameService.createGame(whitePlayer, blackPlayer);

    console.log(`Match found! Game ${gameId} created between ${player1.username} and ${player2.username}`);

    return { player1, player2, gameId };
  }

  static async getQueueStatus(): Promise<{ playersInQueue: number; estimatedWaitTime: number }> {
    const queueLength = await redis.zcard(this.QUEUE_KEY);
    
    // Simple estimate: assume 30 seconds per player ahead in queue
    const estimatedWaitTime = Math.max(0, (queueLength - 1)) * 30;

    return {
      playersInQueue: queueLength,
      estimatedWaitTime
    };
  }

  static async isPlayerInQueue(playerId: number): Promise<boolean> {
    const score = await redis.zscore(this.QUEUE_KEY, playerId);
    return score !== null;
  }
}