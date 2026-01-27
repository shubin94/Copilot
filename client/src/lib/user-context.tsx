import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useAuth } from "./hooks";
import { api } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

type FavoriteServiceId = string;

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  favorites: FavoriteServiceId[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (serviceId: string) => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [favorites, setFavorites] = useState<FavoriteServiceId[]>([]);
  
  const user = data?.user || null;
  const isAuthenticated = !!user;

  useEffect(() => {
    const stored = localStorage.getItem("favorites");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed.filter((x: any) => typeof x === "string") : []);
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const isFavorite = (id: string) => {
    return favorites.some(favId => favId === id);
  };

  const toggleFavorite = (serviceId: string) => {
    setFavorites(prev => {
      const exists = prev.some(id => id === serviceId);
      const updated = exists 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      localStorage.setItem("favorites", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = async () => {
    try {
      await api.auth.logout();
      localStorage.removeItem("favorites");
      setFavorites([]);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.removeItem("favorites");
      setFavorites([]);
      queryClient.clear();
      window.location.href = "/";
    }
  };

  return (
    <UserContext.Provider value={{ user, isLoading, isAuthenticated, favorites, isFavorite, toggleFavorite, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export function useUserSafe(): UserContextType {
  try {
    return useUser();
  } catch {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      favorites: [],
      isFavorite: () => false,
      toggleFavorite: () => {},
      logout: async () => {}
    };
  }
}
