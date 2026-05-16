import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isLocked, vaultInitialized } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // State machine logic:
  // 1. If vault is not initialized, redirect to landing
  if (!vaultInitialized) {
    return <Navigate to="/landing" replace />;
  }

  // 2. If vault is locked, redirect to login (lock screen)
  if (isLocked) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If vault is initialized and unlocked but no user, also redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. All checks passed - allow access
  return <>{children}</>;
};
