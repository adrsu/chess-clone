import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';

interface ChessBoardProps {
  gameId: string;
  playerColor?: 'white' | 'black';
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ gameId, playerColor: initialPlayerColor }) => {
  const [chess] = useState(new Chess());
  const [position, setPosition] = useState(chess.fen());
  const [gameStatus, setGameStatus] = useState('Connecting to game...');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>(initialPlayerColor || 'white');
  const [gameJoined, setGameJoined] = useState(false);
  const [drawOffer, setDrawOffer] = useState<{ from: string; pending: boolean } | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<{ result: string; reason?: string; winner?: string } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [isViewingMode, setIsViewingMode] = useState(false);
  const [gameData, setGameData] = useState<any>(null);
  const [opponentInfo, setOpponentInfo] = useState<{ username: string; rating: number } | null>(null);
  const { socket } = useSocket();
  const { state: authState } = useAuth();
  const navigate = useNavigate();

  const fetchGameData = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/games/${gameId}`, {
        headers: {
          Authorization: `Bearer ${authState.token}`
        }
      });
      const game = response.data;
      setGameData(game);
      setOpponentInfo(game.opponent);
      
      // Determine if this is a viewing mode (completed game)
      if (game.status === 'completed') {
        setIsViewingMode(true);
        setGameOver(true);
        
        // Load the final position
        if (game.fen) {
          chess.load(game.fen);
          setPosition(chess.fen());
        }
        
        // Set game result
        let resultMessage = '';
        if (game.result === 'draw') {
          resultMessage = 'Draw';
        } else if (game.result === 'white_wins') {
          resultMessage = 'White wins';
        } else if (game.result === 'black_wins') {
          resultMessage = 'Black wins';
        }
        setGameStatus(`Game Over: ${resultMessage}`);
        setPlayerColor(game.playerColor);
      } else if (game.status === 'active') {
        // Game is still in progress, allow resuming
        setIsViewingMode(false);
        setPlayerColor(game.playerColor);
        if (game.fen) {
          chess.load(game.fen);
          setPosition(chess.fen());
        }
        
        // Set initial game status - will be updated when component mounts
        
        console.log('Resuming active game:', gameId);
      } else {
        // Game is abandoned or other status
        setIsViewingMode(true);
        setGameStatus('Game no longer active');
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
      setGameStatus('Error loading game');
    }
  };

  // Fetch game data on mount
  useEffect(() => {
    if (authState.token) {
      fetchGameData();
    }
  }, [gameId, authState.token]);

  useEffect(() => {
    if (socket && !isViewingMode && gameData && gameData.status === 'active') {
      socket.emit('join-game', { gameId });

      socket.on('game-joined', ({ gameId: joinedGameId, playerColor: assignedColor, gameState, opponent }) => {
        console.log('Joined game:', joinedGameId, 'as', assignedColor);
        setPlayerColor(assignedColor);
        setGameJoined(true);
        
        // Set opponent info if provided
        if (opponent) {
          setOpponentInfo(opponent);
        }
        
        // Load the current position if resuming
        if (gameState && gameState.fen) {
          chess.load(gameState.fen);
          setPosition(gameState.fen);
        }
        
        updateGameStatus();
      });

      socket.on('move-made', ({ move, gameState }) => {
        chess.load(gameState.fen);
        setPosition(gameState.fen);
        updateGameStatus();
      });

      socket.on('game-over', ({ result, winner, reason }) => {
        setGameOver(true);
        setGameResult({ result, winner, reason });
        if (reason === 'resignation') {
          setGameStatus(`Game Over: ${winner} wins by resignation`);
        } else if (reason === 'agreement') {
          setGameStatus('Game Over: Draw by agreement');
        } else if (result === 'draw') {
          setGameStatus('Game Over: Draw');
        } else {
          setGameStatus(`Game Over: ${winner} wins`);
        }
      });

      socket.on('opponent-disconnected', ({ opponentName }) => {
        setOpponentLeft(true);
        setGameStatus(`${opponentName} has left the game`);
      });

      socket.on('opponent-reconnected', ({ opponentName }) => {
        setOpponentLeft(false);
        updateGameStatus();
      });

      socket.on('move-error', ({ error }) => {
        console.error('Move error:', error);
        setGameStatus(`Move error: ${error}`);
      });

      socket.on('draw-offered', ({ from }) => {
        setDrawOffer({ from, pending: true });
      });

      socket.on('draw-accepted', () => {
        setGameStatus('Game drawn by agreement');
        setDrawOffer(null);
      });

      socket.on('draw-declined', () => {
        setDrawOffer(null);
      });
    }

    return () => {
      if (socket) {
        socket.off('game-joined');
        socket.off('move-made');
        socket.off('game-over');
        socket.off('move-error');
        socket.off('draw-offered');
        socket.off('draw-accepted');
        socket.off('draw-declined');
        socket.off('opponent-disconnected');
        socket.off('opponent-reconnected');
      }
    };
  }, [socket, gameId, chess, isViewingMode, gameData]);

  const updateGameStatus = () => {
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        setGameStatus(`Checkmate - ${chess.turn() === 'w' ? 'Black' : 'White'} wins`);
      } else if (chess.isDraw()) {
        setGameStatus('Draw');
      }
    } else if (chess.inCheck()) {
      setGameStatus(`${chess.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${chess.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    // Don't allow moves in viewing mode
    if (isViewingMode) {
      return false;
    }

    // Check if it's the player's turn
    const currentTurn = chess.turn();
    const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                        (currentTurn === 'b' && playerColor === 'black');
    
    if (!isPlayerTurn) {
      setGameStatus(`Not your turn! It's ${currentTurn === 'w' ? 'White' : 'Black'}'s turn`);
      return false;
    }

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      });

      if (move === null) return false;

      // Send move to server first, don't update local state yet
      // The server will send back the confirmed move
      if (socket) {
        socket.emit('make-move', {
          gameId,
          move: move.san
        });
      }

      // Revert the local move, wait for server confirmation
      chess.undo();
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleOfferDraw = () => {
    if (socket) {
      socket.emit('offer-draw', { gameId });
      setDrawOffer({ from: 'You', pending: true });
    }
  };

  const handleAcceptDraw = () => {
    if (socket) {
      socket.emit('accept-draw', { gameId });
      setDrawOffer(null);
    }
  };

  const handleDeclineDraw = () => {
    if (socket) {
      socket.emit('decline-draw', { gameId });
      setDrawOffer(null);
    }
  };

  const handleResign = () => {
    if (socket) {
      socket.emit('resign', { gameId });
      setShowResignConfirm(false);
    }
  };

  const handleReturnToLobby = () => {
    navigate('/lobby');
  };

  return (
    <div className="flex flex-col items-center relative">
      {/* Game Over Dialog - Positioned at top right */}
      {gameOver && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs border border-gray-300">
            <h3 className="text-lg font-semibold mb-2">Game Over</h3>
            <p className="mb-4 text-sm">
              {gameResult?.reason === 'resignation' && `${gameResult.winner} wins by resignation`}
              {gameResult?.reason === 'agreement' && 'Draw by agreement'}
              {gameResult?.reason === 'timeout' && 'Draw by timeout'}
              {gameResult?.result === 'draw' && gameResult.reason !== 'agreement' && gameResult.reason !== 'timeout' && 'Draw'}
              {gameResult?.result !== 'draw' && gameResult?.reason !== 'resignation' && gameResult?.reason !== 'agreement' && gameResult?.reason !== 'timeout' && `${gameResult?.winner} wins`}
            </p>
            <button
              onClick={handleReturnToLobby}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Opponent Left Dialog - Positioned at top right */}
      {opponentLeft && !gameOver && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs border border-yellow-300 bg-yellow-50">
            <h3 className="text-lg font-semibold mb-2">Opponent Disconnected</h3>
            <p className="mb-4 text-sm">Your opponent has left the game. You can wait for them to return or leave.</p>
            <button
              onClick={handleReturnToLobby}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Draw Offer Modal */}
      {drawOffer && drawOffer.from !== 'You' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Draw Offer</h3>
            <p className="mb-6">{drawOffer.from} offers a draw</p>
            <div className="flex space-x-4">
              <button
                onClick={handleAcceptDraw}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={handleDeclineDraw}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Resign Game</h3>
            <p className="mb-6">Are you sure you want to resign?</p>
            <div className="flex space-x-4">
              <button
                onClick={handleResign}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Yes, Resign
              </button>
              <button
                onClick={() => setShowResignConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver ? (
        <div className="mb-4 text-lg font-semibold text-center">
          {gameStatus}
        </div>
      ) : !isViewingMode && (
        <div className="mb-4 text-center">
          <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {chess.turn() === 'w' ? "White's turn" : "Black's turn"}
            {chess.inCheck() && ' - Check!'}
          </div>
        </div>
      )}

      {/* Draw Offer Status */}
      {drawOffer && drawOffer.from === 'You' && (
        <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800">
          Draw offer sent. Waiting for opponent's response...
        </div>
      )}

      <div className="chess-board-container relative">
        {/* Opponent Name (Top) - Always show even if opponentInfo is not loaded yet */}
        <div className={`flex ${playerColor === 'white' ? 'justify-start' : 'justify-end'} mb-2`}>
          <div className={`px-4 py-2 rounded-lg shadow-md transition-colors ${
            !isViewingMode && chess.turn() === (playerColor === 'white' ? 'b' : 'w')
              ? 'bg-yellow-400 text-gray-900 border-2 border-yellow-500' // Their turn
              : 'bg-gray-700 text-white' // Not their turn
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full border ${
                playerColor === 'white' 
                  ? 'bg-gray-800 border-gray-600' // Black pieces for opponent when player is white
                  : 'bg-white border-gray-300' // White pieces for opponent when player is black
              }`}></div>
              <span className="font-semibold">
                {opponentInfo?.username || 'Opponent'}
              </span>
              <span className="text-sm opacity-75">
                {opponentInfo?.rating ? `(${opponentInfo.rating})` : '(-)'}
              </span>
              {!isViewingMode && chess.turn() === (playerColor === 'white' ? 'b' : 'w') && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              )}
            </div>
          </div>
        </div>

        {/* Chess Board */}
        <div className="chess-board border-4 border-gray-800 rounded-lg shadow-xl">
          <Chessboard
            position={position}
            onPieceDrop={onDrop}
            boardOrientation={playerColor}
            arePiecesDraggable={!isViewingMode}
            boardWidth={600}
          />
        </div>

        {/* Player Name (Bottom) - Always show */}
        <div className={`flex ${playerColor === 'white' ? 'justify-end' : 'justify-start'} mt-2`}>
          <div className={`px-4 py-2 rounded-lg shadow-md transition-colors ${
            !isViewingMode && chess.turn() === (playerColor === 'white' ? 'w' : 'b')
              ? 'bg-green-400 text-gray-900 border-2 border-green-500' // Your turn
              : 'bg-green-700 text-white' // Not your turn
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full border ${
                playerColor === 'white' 
                  ? 'bg-white border-gray-300' // White pieces
                  : 'bg-gray-800 border-gray-600' // Black pieces
              }`}></div>
              <span className="font-semibold">
                {authState.user?.username || 'You'}
              </span>
              <span className="text-sm opacity-75">
                {authState.user?.rating ? `(${authState.user.rating})` : '(-)'}
              </span>
              {!isViewingMode && chess.turn() === (playerColor === 'white' ? 'w' : 'b') && (
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {isViewingMode ? (
        <div className="mt-4 flex flex-col items-center space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Game completed</p>
            {gameData && (
              <p className="text-sm text-gray-500">
                vs {gameData.opponent?.username} ({gameData.opponent?.rating}) • {gameData.timeControl}
              </p>
            )}
          </div>
          <button
            onClick={handleReturnToLobby}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Lobby
          </button>
        </div>
      ) : (
        <div className="mt-4 flex space-x-4">
          <button
            onClick={handleOfferDraw}
            disabled={drawOffer !== null}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {drawOffer?.from === 'You' ? 'Draw Offered' : 'Offer Draw'}
          </button>
          <button
            onClick={() => setShowResignConfirm(true)}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Resign
          </button>
        </div>
      )}
    </div>
  );
};
