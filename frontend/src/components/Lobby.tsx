import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { config } from '../config';

interface QueueStatus {
  playersInQueue: number;
  estimatedWaitTime: number;
}

interface RecentGame {
  id: number;
  opponent: { username: string; rating: number };
  playerColor: 'white' | 'black';
  result: 'win' | 'loss' | 'draw' | 'ongoing';
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt?: string;
  timeControl: string;
  duration?: number;
}

export const Lobby: React.FC = () => {
  const [inQueue, setInQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ playersInQueue: 0, estimatedWaitTime: 0 });
  const [searching, setSearching] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [queueStartTime, setQueueStartTime] = useState<Date | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const { state: authState, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fetchRecentGames = async () => {
    try {
      setLoadingGames(true);
      const response = await axios.get(`${config.apiUrl}/games/my-games`, {
        headers: {
          Authorization: `Bearer ${authState.token}`
        }
      });
      setRecentGames(response.data.slice(0, 5)); // Show only last 5 games
    } catch (error) {
      console.error('Error fetching recent games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  // Fetch recent games on component mount and when returning to lobby
  useEffect(() => {
    if (authState.token) {
      fetchRecentGames();
    }
  }, [authState.token]);

  // Refresh games when user returns to lobby (using page visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && authState.token) {
        fetchRecentGames();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authState.token]);

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    socket.on('matchmaking-joined', (status: QueueStatus) => {
      setInQueue(true);
      setSearching(true);
      setQueueStatus(status);
      setQueueStartTime(new Date());
      setWaitTime(0);
    });

    socket.on('matchmaking-left', () => {
      setInQueue(false);
      setSearching(false);
      setQueueStartTime(null);
      setWaitTime(0);
    });

    socket.on('matchmaking-error', (data: { error: string }) => {
      console.error('Matchmaking error:', data.error);
      setInQueue(false);
      setSearching(false);
    });

    socket.on('match-found', (data: { gameId: number; opponent: { username: string; rating: number }; playerColor: string }) => {
      setInQueue(false);
      setSearching(false);
      setQueueStartTime(null);
      console.log('Match found!', data);
      navigate(`/game/${data.gameId}`);
    });

    socket.on('queue-status', (status: QueueStatus) => {
      setQueueStatus(status);
    });

    socket.on('queue-status-update', (status: QueueStatus) => {
      setQueueStatus(status);
    });

    // Cleanup listeners
    return () => {
      socket.off('matchmaking-joined');
      socket.off('matchmaking-left');
      socket.off('matchmaking-error');
      socket.off('match-found');
      socket.off('queue-status');
      socket.off('queue-status-update');
    };
  }, [socket, navigate]);

  // Timer for tracking actual wait time
  useEffect(() => {
    if (!inQueue || !queueStartTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - queueStartTime.getTime()) / 1000);
      setWaitTime(elapsedSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [inQueue, queueStartTime]);

  const handleJoinQueue = () => {
    if (!socket) return;
    socket.emit('join-matchmaking');
  };

  const handleLeaveQueue = () => {
    if (!socket) return;
    socket.emit('leave-matchmaking');
  };

  const handleLogout = () => {
    if (socket && inQueue) {
      socket.emit('leave-matchmaking');
    }
    logout();
    navigate('/login');
  };

  if (!authState.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {authState.user.username}!
              </h1>
              <p className="text-gray-600 mt-1">
                Rating: {authState.user.rating} • Ready to play chess?
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Queue Status</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{queueStatus.playersInQueue}</p>
              <p className="text-gray-600">Players in Queue</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Math.floor(waitTime / 60)}:{(waitTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-gray-600">{inQueue ? 'Current Wait Time' : 'Wait Time'}</p>
            </div>
          </div>
        </div>

        {/* Matchmaking Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {!inQueue ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Find a Match</h2>
              <p className="text-gray-600 mb-6">
                Click below to join the matchmaking queue and get paired with another player
              </p>
              <button
                onClick={handleJoinQueue}
                className="w-full max-w-md px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Find Match
              </button>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Searching for Opponent</h2>
              {searching && (
                <div className="flex justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              <p className="text-gray-600 mb-6">
                Looking for a suitable opponent... Please wait.
              </p>
              <button
                onClick={handleLeaveQueue}
                className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Cancel Search
              </button>
            </div>
          )}
        </div>

        {/* Recent Games */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Games</h2>
            <button
              onClick={fetchRecentGames}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Refresh
            </button>
          </div>
          
          {loadingGames ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : recentGames.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No recent games found. Play your first game!</p>
          ) : (
            <div className="space-y-3">
              {recentGames.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      game.result === 'win' ? 'bg-green-500' : 
                      game.result === 'loss' ? 'bg-red-500' : 
                      game.result === 'draw' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">
                        vs {game.opponent.username} ({game.opponent.rating})
                      </p>
                      <p className="text-sm text-gray-500">
                        {game.playerColor === 'white' ? '⚪' : '⚫'} • {game.timeControl}
                        {game.duration && ` • ${Math.floor(game.duration / 60)}:${(game.duration % 60).toString().padStart(2, '0')}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold capitalize ${
                      game.result === 'win' ? 'text-green-600' : 
                      game.result === 'loss' ? 'text-red-600' : 
                      game.result === 'draw' ? 'text-yellow-600' : 'text-blue-600'
                    }`}>
                      {game.result === 'ongoing' ? 'In Progress' : game.result}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(game.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};