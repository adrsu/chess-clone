import express, { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import { config } from '../config';

const router = express.Router();

router.post('/register', [
  body('username').isLength({ min: 3 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;
    
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await UserModel.create(username, email, password);
    const jwtOptions: SignOptions = { expiresIn: config.jwtExpiry };
    const token = jwt.sign({ id: user.id }, config.jwtSecret as string, jwtOptions);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error 1' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await UserModel.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const jwtOptions: SignOptions = { expiresIn: config.jwtExpiry };
    const token = jwt.sign({ id: user.id }, config.jwtSecret as string, jwtOptions);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error 2' });
  }
});

export default router;
