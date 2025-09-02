import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { GameService } from '../services/GameService';
import { GameModel } from '../models/Game';
import { UserModel } from '../models/User';

const router = express.Router();

router.use(authenticateToken);

router.post('/create', async (req: AuthRequest, res) => {
  try {
    const { opponentId } = req.body;
    const gameId = await GameService.createGame(req.user.id, opponentId);
    res.status(201).json({ gameId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.get('/my-games', async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const games = await GameModel.getPlayerGames(userId);
    
    // Get opponent information for each game
    const gamesWithOpponents = await Promise.all(
      games.map(async (game) => {
        const opponentId = game.white_player_id === userId ? game.black_player_id : game.white_player_id;
        const opponent = await UserModel.findById(opponentId);
        const playerColor = game.white_player_id === userId ? 'white' : 'black';
        
        // Determine result from player's perspective
        let playerResult = 'ongoing';
        if (game.status === 'completed') {
          if (game.result === 'draw') {
            playerResult = 'draw';
          } else if (
            (game.result === 'white_wins' && playerColor === 'white') ||
            (game.result === 'black_wins' && playerColor === 'black')
          ) {
            playerResult = 'win';
          } else {
            playerResult = 'loss';
          }
        }
        
        return {
          id: game.id,
          opponent: opponent ? { username: opponent.username, rating: opponent.rating } : { username: 'Unknown', rating: 0 },
          playerColor,
          result: playerResult,
          gameResult: game.result,
          status: game.status,
          startedAt: game.started_at,
          endedAt: game.ended_at,
          timeControl: game.time_control,
          duration: game.ended_at ? 
            Math.floor((new Date(game.ended_at).getTime() - new Date(game.started_at).getTime()) / 1000) : 
            null
        };
      })
    );
    
    res.json(gamesWithOpponents);
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

router.get('/:gameId', async (req: AuthRequest, res) => {
  try {
    const game = await GameModel.findById(parseInt(req.params.gameId));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

export default router;
