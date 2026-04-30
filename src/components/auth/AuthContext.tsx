import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDb, execQuery, type User } from '@/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedUserId = localStorage.getItem('user_id');
      if (savedUserId) {
        try {
          const db = await getDb();
          const results = execQuery(db, 'SELECT id, username FROM users WHERE id = ?', [parseInt(savedUserId)]);
          if (results.length > 0) {
            setUser(results[0] as User);
          } else {
            localStorage.removeItem('user_id');
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
        }
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
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
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
