import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { GameService } from './GameService';
import { UserModel } from '../models/User';
import { GameModel } from '../models/Game';

export class SocketService {
  private io: SocketIOServer;

  constructor(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
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

      socket.on('disconnect', () => {
        console.log(`User ${socket.data.user.username} disconnected`);
      });
    });
  }

  private async getPlayerColor(gameId: number, userId: number): Promise<string> {
    // Implementation to determine if user is white or black player
    const game = await GameModel.findById(gameId);
    if (!game) return '';
    
    return game.white_player_id === userId ? 'white' : 'black';
  }
}
