import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User, FamilyRole } from '../types'

const STORAGE_KEYS = {
  USERS: 'housework_users',
  CURRENT_USER: 'housework_currentUser',
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (name: string) => boolean
  logout: () => void
  register: (name: string, role: FamilyRole) => void
  getUsers: () => User[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
      }
    }
  }, [])

  const getUsers = (): User[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
    } catch {
      return []
    }
  }

  const register = (name: string, role: FamilyRole) => {
    const users = getUsers()
    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      role,
      createdAt: new Date().toISOString(),
    }
    users.push(newUser)
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
    setUser(newUser)
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser))
  }

  const login = (name: string): boolean => {
    const users = getUsers()
    const foundUser = users.find((u: User) => u.name === name)
    if (foundUser) {
      setUser(foundUser)
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(foundUser))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        getUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
