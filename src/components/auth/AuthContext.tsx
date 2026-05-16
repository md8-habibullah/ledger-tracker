import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDb, execQuery, type User } from '@/db';

export type AutoLockDuration = 5 | 8 | 10 | 15 | 30 | 60 | 'never';

interface AuthContextType {
  user: User | null;
  isLocked: boolean;
  vaultInitialized: boolean;
  autoLockDuration: AutoLockDuration;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  lockVault: () => void;
  unlockVault: () => void;
  initializeVault: () => void;
  setAutoLockDuration: (duration: AutoLockDuration) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [vaultInitialized, setVaultInitialized] = useState(false);
  const [autoLockDuration, setAutoLockDurationState] = useState<AutoLockDuration>(15);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize auth and load settings
  useEffect(() => {
    const initAuth = async () => {
      // Check if vault has been initialized
      const vaultInit = localStorage.getItem('vault_initialized');
      setVaultInitialized(vaultInit === 'true');

      // Load auto-lock duration
      const savedDuration = localStorage.getItem('auto_lock_duration');
      if (savedDuration) {
        const duration = savedDuration === 'never' 
          ? 'never' 
          : parseInt(savedDuration) as AutoLockDuration;
        setAutoLockDurationState(duration);
      }

      // Check for saved user session
      const savedUserId = localStorage.getItem('user_id');
      if (savedUserId && vaultInit === 'true') {
        try {
          const db = await getDb();
          const results = execQuery(db, 'SELECT id, username FROM users WHERE id = ?', [parseInt(savedUserId)]);
          if (results.length > 0) {
            setUser(results[0] as User);
            // If we have a user, the vault is unlocked
            setIsLocked(false);
          } else {
            localStorage.removeItem('user_id');
            setIsLocked(true);
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          setIsLocked(true);
        }
      } else {
        setIsLocked(true);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Auto-lock timer effect
  useEffect(() => {
    if (isLocked || autoLockDuration === 'never' || !user) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      // Clear existing timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      // Set new timer
      const durationMs = autoLockDuration === 'never' ? Infinity : autoLockDuration * 60 * 1000;
      inactivityTimerRef.current = setTimeout(() => {
        lockVault();
      }, durationMs);
    };

    // Reset timer on user activity
    const handleActivity = () => {
      resetInactivityTimer();
    };

    resetInactivityTimer();

    // Track user activity
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isLocked, autoLockDuration, user]);

  const login = async (username: string, password: string) => {
    const db = await getDb();
    const results = execQuery(db, 'SELECT id, username FROM users WHERE username = ? AND password = ?', [username, password]);
    
    if (results.length > 0) {
      const loggedInUser = results[0] as User;
      setUser(loggedInUser);
      localStorage.setItem('user_id', loggedInUser.id.toString());
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const register = async (username: string, password: string) => {
    const db = await getDb();
    try {
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
      const result = execQuery(db, 'SELECT id, username FROM users WHERE username = ?', [username]);
      if (result.length > 0) {
        const newUser = result[0] as User;
        setUser(newUser);
        localStorage.setItem('user_id', newUser.id.toString());
        localStorage.setItem('vault_initialized', 'true');
        setVaultInitialized(true);
        setIsLocked(false);
        const { saveDb } = await import('@/db');
        await saveDb();
        return true;
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user_id');
    setIsLocked(true);
  };

  const lockVault = () => {
    setIsLocked(true);
    setUser(null);
    localStorage.removeItem('user_id');
    // Clear sensitive data from memory
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  const unlockVault = () => {
    setIsLocked(false);
  };

  const initializeVault = () => {
    localStorage.setItem('vault_initialized', 'true');
    setVaultInitialized(true);
  };

  const setAutoLockDuration = (duration: AutoLockDuration) => {
    setAutoLockDurationState(duration);
    localStorage.setItem('auto_lock_duration', duration.toString());
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLocked,
      vaultInitialized,
      autoLockDuration,
      login, 
      register, 
      logout,
      lockVault,
      unlockVault,
      initializeVault,
      setAutoLockDuration,
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
