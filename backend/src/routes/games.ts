import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { GameService } from '../services/GameService';
import { GameModel } from '../models/Game';

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
    const games = await GameModel.getPlayerGames(req.user.id);
    res.json(games);
  } catch (error) {
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
