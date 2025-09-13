import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import { auth } from '../firebase/config';

// 認証状態の型定義
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

// 認証コンテキストの型定義
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
}

// 認証コンテキスト作成
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 認証プロバイダーコンポーネント
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null
  });
  const [loading, setLoading] = useState(true);

  // Firebase Auth状態監視
  useEffect(() => {
    console.log('🔥 Initializing Firebase Auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔥 Auth state changed:', user ? `User: ${user.email}` : 'No user');
      
      setAuthState({
        isAuthenticated: !!user,
        user: user
      });
      
      setLoading(false);
    });

    // クリーンアップ
    return () => {
      console.log('🔥 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Firebase認証ログイン機能
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔥 Attempting Firebase login...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase login successful:', userCredential.user.email);
      return true;
    } catch (error: any) {
      console.error('❌ Firebase login failed:', error.message);
      return false;
    }
  };

  // Firebase認証ログアウト機能
  const logout = async (): Promise<void> => {
    try {
      console.log('🔥 Firebase logout...');
      await signOut(auth);
      console.log('✅ Firebase logout successful');
    } catch (error: any) {
      console.error('❌ Firebase logout failed:', error.message);
    }
  };

  // IDトークン取得機能（API呼び出し用）
  const getIdToken = async (): Promise<string | null> => {
    try {
      if (!authState.user) {
        console.warn('⚠️ No authenticated user for token');
        return null;
      }
      
      const token = await authState.user.getIdToken(true); // forceRefresh
      console.log('🔑 ID token obtained');
      return token;
    } catch (error: any) {
      console.error('❌ Failed to get ID token:', error.message);
      return null;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    login,
    logout,
    loading,
    getIdToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 認証コンテキストを使用するためのカスタムフック
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 