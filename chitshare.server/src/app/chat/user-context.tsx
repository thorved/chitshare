"use client";

import { createContext, useContext, ReactNode } from "react";
import { User } from "@prisma/client";

// We'll use a subset of the User type that we actually need/have
type UserContextType = Pick<User, "id" | "username" | "email" | "avatarUrl" | "isAdmin">;

const UserContext = createContext<UserContextType | null>(null);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

interface UserProviderProps {
  user: UserContextType;
  children: ReactNode;
}

export function UserProvider({ user, children }: UserProviderProps) {
  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
}
