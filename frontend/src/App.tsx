import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { ChessBoard } from './components/ChessBoard';
import { Lobby } from './components/Lobby';
// import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (state.loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  return state.user ? <>{children}</> : <Navigate to="/login" />;
};

const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  
  if (!gameId) {
    return <Navigate to="/lobby" />;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Chess Game #{gameId}</h1>
      <ChessBoard gameId={gameId} />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App min-h-screen bg-gray-100">
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />
            <Route
              path="/lobby"
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <Lobby />
                  </SocketProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:gameId"
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <GamePage />
                  </SocketProvider>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/lobby" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
