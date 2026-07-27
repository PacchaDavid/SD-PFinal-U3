import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';

// Layouts
import UserLayout from './components/Layout/UserLayout';
import AdminLayout from './components/Layout/AdminLayout';

// User Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import MovieDetailPage from './pages/MovieDetailPage';
import RecommendationsPage from './pages/RecommendationsPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';

// Admin Pages
import DashboardPage from './pages/admin/DashboardPage';
import HeartbeatsPage from './pages/admin/HeartbeatsPage';
import ReplicationPage from './pages/admin/ReplicationPage';
import CircuitBreakersPage from './pages/admin/CircuitBreakersPage';
import LogsPage from './pages/admin/LogsPage';
import SimulationPage from './pages/admin/SimulationPage';
import CreateMoviePage from './pages/admin/CreateMoviePage';
import CreateUserPage from './pages/admin/CreateUserPage';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            {/* User Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/:id" element={<MovieDetailPage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Admin Routes */}
            <Route
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/heartbeats" element={<HeartbeatsPage />} />
              <Route path="/admin/replication" element={<ReplicationPage />} />
              <Route path="/admin/circuit-breakers" element={<CircuitBreakersPage />} />
              <Route path="/admin/logs" element={<LogsPage />} />
              <Route path="/admin/simulation" element={<SimulationPage />} />
              <Route path="/admin/create-movie" element={<CreateMoviePage />} />
              <Route path="/admin/create-user" element={<CreateUserPage />} />
            </Route>

            {/* Fallback - must be last */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
