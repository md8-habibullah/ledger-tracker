import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDb, execQuery, type User } from '@/db';

interface AuthContextType {
  user: User | null;
  isLocked: boolean;
  vaultInitialized: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  lockVault: () => void;
  unlockVault: () => void;
  initializeVault: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [vaultInitialized, setVaultInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Check if vault has been initialized
      const vaultInit = localStorage.getItem('vault_initialized');
      setVaultInitialized(vaultInit === 'true');

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
  };

  const unlockVault = () => {
    setIsLocked(false);
  };

  const initializeVault = () => {
    localStorage.setItem('vault_initialized', 'true');
    setVaultInitialized(true);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLocked,
      vaultInitialized,
      login, 
      register, 
      logout,
      lockVault,
      unlockVault,
      initializeVault,
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
