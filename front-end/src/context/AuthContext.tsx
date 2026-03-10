import { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser } from '../types';
import {
  login as authLogin,
  logout as authLogout,
  getStoredToken,
  getStoredUser,
} from '../features/auth/auth.services';
import { getMyProfile } from '../features/users/users.services';
import { syncDisplayLanguageCookie } from '../utils/displayLanguage';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUserProfile: (profile: NonNullable<AuthUser['profile']>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        if (!storedUser.profile) {
          try {
            const { profile } = await getMyProfile();
            if (!cancelled) {
              setUser((prev) =>
                prev ? { ...prev, profile } : null
              );
              const lang = profile?.language === 'en' ? 'en' : 'ar';
              if (syncDisplayLanguageCookie(lang)) {
                window.location.reload();
                return;
              }
            }
          } catch {
            // keep storedUser without profile
          }
        } else if (storedUser.profile?.language) {
          const lang = storedUser.profile.language === 'en' ? 'en' : 'ar';
          if (syncDisplayLanguageCookie(lang)) {
            window.location.reload();
            return;
          }
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authLogin(username, password);
      const { token: newToken, user: newUser } = response;

      setToken(newToken);
      setUser(newUser);

      const lang = newUser?.profile?.language === 'en' ? 'en' : 'ar';
      if (syncDisplayLanguageCookie(lang)) {
        window.location.reload();
        return response;
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setToken(null);
      setUser(null);
    } catch (error) {
      // Even if the API call fails, clear local state
      setToken(null);
      setUser(null);
      throw error;
    }
  };

  const updateUserProfile = (profile: NonNullable<AuthUser['profile']>) => {
    setUser((prev) =>
      prev ? { ...prev, profile: { ...prev.profile, ...profile } as NonNullable<AuthUser['profile']> } : null
    );
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
