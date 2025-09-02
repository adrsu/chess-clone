import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { GameService } from './GameService';
import { MatchmakingService } from './MatchmakingService';
import { UserModel } from '../models/User';
import { GameModel } from '../models/Game';

export class SocketService {
  private io: SocketIOServer;
  private matchmakingInterval: NodeJS.Timeout | null = null;

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
      });

      socket.on('leave-matchmaking', async () => {
        await MatchmakingService.leaveQueue(socket.data.user.id);
        socket.emit('matchmaking-left');
      });

      socket.on('get-queue-status', async () => {
        const queueStatus = await MatchmakingService.getQueueStatus();
        socket.emit('queue-status', queueStatus);
      });

      socket.on('join-game', async (data) => {
        const { gameId } = data;
        socket.join(`game-${gameId}`);
        
        socket.emit('game-joined', {
          gameId,
          playerColor: await this.getPlayerColor(gameId, socket.data.user.id)
        });
      });

      socket.on('make-move', async (data) => {
        const { gameId, move } = data;
        const result = await GameService.makeMove(gameId, socket.data.user.id, move);
        
        if (result.success) {
          this.io.to(`game-${gameId}`).emit('move-made', {
            move,
            gameState: result.gameState
          });
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

      socket.on('resign', async (data) => {
        const { gameId } = data;
        this.io.to(`game-${gameId}`).emit('game-over', {
          result: 'resignation',
          winner: 'opponent'
        });
      });

      socket.on('disconnect', async () => {
        console.log(`User ${socket.data.user.username} disconnected`);
        // Remove from matchmaking queue if disconnected
        await MatchmakingService.leaveQueue(socket.data.user.id);
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
