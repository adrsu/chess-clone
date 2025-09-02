import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { GameService } from './GameService';
import { MatchmakingService } from './MatchmakingService';
import { GameTimeoutService } from './GameTimeoutService';
import { UserModel } from '../models/User';
import { GameModel } from '../models/Game';
import redis from '../config/redis';

export class SocketService {
  private io: SocketIOServer;
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private activeGames: Map<number, Set<string>> = new Map(); // gameId -> Set of socketIds

  constructor(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startMatchmaking();
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, config.jwtSecret) as any;
        const user = await UserModel.findById(decoded.id);
        
        if (!user) {
          return next(new Error('Authentication error'));
        }

        socket.data.user = user;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.user.username} connected`);

      // Join lobby room for queue updates
      socket.join('lobby');

      // Matchmaking events
      socket.on('join-matchmaking', async () => {
        const user = socket.data.user;
        const isAlreadyInQueue = await MatchmakingService.isPlayerInQueue(user.id);
        
        if (isAlreadyInQueue) {
          socket.emit('matchmaking-error', { error: 'Already in queue' });
          return;
        }

        await MatchmakingService.joinQueue({
          id: user.id,
          username: user.username,
          rating: user.rating,
          socketId: socket.id,
          joinedAt: new Date()
        });

        const queueStatus = await MatchmakingService.getQueueStatus();
        socket.emit('matchmaking-joined', queueStatus);
        
        // Broadcast updated queue status to all lobby users
        this.io.to('lobby').emit('queue-status-update', queueStatus);
      });

      socket.on('leave-matchmaking', async () => {
        await MatchmakingService.leaveQueue(socket.data.user.id);
        socket.emit('matchmaking-left');
        
        // Broadcast updated queue status to all lobby users
        const queueStatus = await MatchmakingService.getQueueStatus();
        this.io.to('lobby').emit('queue-status-update', queueStatus);
      });

      socket.on('get-queue-status', async () => {
        const queueStatus = await MatchmakingService.getQueueStatus();
        socket.emit('queue-status', queueStatus);
      });

      socket.on('join-game', async (data) => {
        const { gameId } = data;
        socket.join(`game-${gameId}`);
        
        // Track this player in the game
        if (!this.activeGames.has(gameId)) {
          this.activeGames.set(gameId, new Set());
        }
        this.activeGames.get(gameId)!.add(socket.id);
        socket.data.currentGameId = gameId;
        
        const playerColor = await this.getPlayerColor(gameId, socket.data.user.id);
        
        // Get current game state from Redis for resuming
        const gameData = await redis.hmget(`game:${gameId}`, 
          'fen', 'turn', 'status'
        );
        
        // Get game and opponent information
        const game = await GameModel.findById(gameId);
        let opponentInfo = null;
        if (game) {
          const opponentId = game.white_player_id === socket.data.user.id ? game.black_player_id : game.white_player_id;
          const opponent = await UserModel.findById(opponentId);
          if (opponent) {
            opponentInfo = {
              username: opponent.username,
              rating: opponent.rating
            };
          }
        }

        socket.emit('game-joined', {
          gameId,
          playerColor,
          opponent: opponentInfo,
          gameState: gameData[0] ? {
            fen: gameData[0],
            turn: gameData[1],
            status: gameData[2]
          } : null
        });

        // Start timeout for this game if it's active
        if (game && game.status === 'active') {
          GameTimeoutService.startGameTimeout(gameId, this.io);
        }
      });

      socket.on('make-move', async (data) => {
        const { gameId, move } = data;
        const result = await GameService.makeMove(gameId, socket.data.user.id, move);
        
        if (result.success) {
          this.io.to(`game-${gameId}`).emit('move-made', {
            move,
            gameState: result.gameState
          });
          
          // Restart timeout for the game (reset the 10-minute timer)
          if (result.gameState && !result.gameState.isGameOver) {
            GameTimeoutService.restartTimeoutForMove(gameId, this.io);
          } else {
            // Game ended, clear timeout
            GameTimeoutService.clearGameTimeout(gameId);
          }
        } else {
          socket.emit('move-error', { error: result.error });
        }
      });

      socket.on('offer-draw', (data) => {
        const { gameId } = data;
        socket.to(`game-${gameId}`).emit('draw-offered', {
          from: socket.data.user.username
        });
      });

      socket.on('accept-draw', async (data) => {
        const { gameId } = data;
        GameTimeoutService.clearGameTimeout(gameId);
        
        // Update game in database as draw
        await GameModel.endGame(gameId, 'draw');
        
        // Update Redis
        await redis.hmset(`game:${gameId}`, {
          status: 'completed',
          result: 'draw'
        });
        
        this.io.to(`game-${gameId}`).emit('draw-accepted');
        this.io.to(`game-${gameId}`).emit('game-over', {
          result: 'draw',
          reason: 'agreement'
        });
      });

      socket.on('decline-draw', (data) => {
        const { gameId } = data;
        socket.to(`game-${gameId}`).emit('draw-declined');
      });

      socket.on('resign', async (data) => {
        const { gameId } = data;
        const game = await GameModel.findById(gameId);
        if (!game) return;
        
        const resigningPlayer = socket.data.user;
        const winner = game.white_player_id === resigningPlayer.id ? 'Black' : 'White';
        
        // Clear timeout and update game in database
        GameTimeoutService.clearGameTimeout(gameId);
        await GameModel.endGame(gameId, winner === 'White' ? 'white_wins' : 'black_wins');
        
        this.io.to(`game-${gameId}`).emit('game-over', {
          result: winner === 'White' ? 'white_wins' : 'black_wins',
          winner,
          reason: 'resignation'
        });
      });

      socket.on('disconnect', async () => {
        console.log(`User ${socket.data.user.username} disconnected`);
        
        // Remove from matchmaking queue if disconnected
        await MatchmakingService.leaveQueue(socket.data.user.id);
        
        // Handle game disconnection
        if (socket.data.currentGameId) {
          const gameId = socket.data.currentGameId;
          const gameRoom = this.activeGames.get(gameId);
          
          if (gameRoom) {
            gameRoom.delete(socket.id);
            
            // Notify other players in the game
            socket.to(`game-${gameId}`).emit('opponent-disconnected', {
              opponentName: socket.data.user.username
            });
            
            // If no players left in game, clean up
            if (gameRoom.size === 0) {
              this.activeGames.delete(gameId);
            }
          }
        }
        
        // Broadcast updated queue status
        const queueStatus = await MatchmakingService.getQueueStatus();
        this.io.to('lobby').emit('queue-status-update', queueStatus);
      });
    });
  }

  private startMatchmaking() {
    // Check for matches every 2 seconds
    this.matchmakingInterval = setInterval(async () => {
      try {
        const match = await MatchmakingService.findMatch();
        if (match) {
          const { player1, player2, gameId } = match;
          
          // Get player colors
          const game = await GameModel.findById(gameId);
          if (!game) return;
          
          const player1Color = game.white_player_id === player1.id ? 'white' : 'black';
          const player2Color = game.white_player_id === player2.id ? 'white' : 'black';

          // Notify both players about the match
          this.io.to(player1.socketId).emit('match-found', {
            gameId,
            opponent: { username: player2.username, rating: player2.rating },
            playerColor: player1Color
          });

          this.io.to(player2.socketId).emit('match-found', {
            gameId,
            opponent: { username: player1.username, rating: player1.rating },
            playerColor: player2Color
          });

          // Start timeout for the new game
          GameTimeoutService.startGameTimeout(gameId, this.io);

          // Broadcast updated queue status after match is made
          const queueStatus = await MatchmakingService.getQueueStatus();
          this.io.to('lobby').emit('queue-status-update', queueStatus);
        }
      } catch (error) {
        console.error('Matchmaking error:', error);
      }
    }, 2000);
  }

  public stopMatchmaking() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
  }

  private async getPlayerColor(gameId: number, userId: number): Promise<string> {
    // Implementation to determine if user is white or black player
    const game = await GameModel.findById(gameId);
    if (!game) return '';
    
    return game.white_player_id === userId ? 'white' : 'black';
  }
}
