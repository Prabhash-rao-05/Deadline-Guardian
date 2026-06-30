import { createContext, useContext, useState, useEffect } from "react"
import { useGetMe } from "@workspace/api-client-react"
import { User } from "@workspace/api-client-react/src/generated/api.schemas"

type AuthContextType = {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  setAuth: () => {},
  clearAuth: () => {},
  isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    const t = localStorage.getItem("dg_token")
    if (t) {
      // Set global token for custom-fetch before anything else mounts
      // @ts-ignore
      window.__AUTH_TOKEN__ = t
    }
    return t
  })
  
  const { data: user, isLoading: isUserLoading, error } = useGetMe({ 
    query: { 
      enabled: !!token, 
      retry: false
    } 
  })

  useEffect(() => {
    if (error) {
      // Clear invalid token
      clearAuth()
    }
  }, [error])

  const setAuth = (newUser: User, newToken: string) => {
    localStorage.setItem("dg_token", newToken)
    // @ts-ignore
    window.__AUTH_TOKEN__ = newToken
    setTokenState(newToken)
  }

  const clearAuth = () => {
    localStorage.removeItem("dg_token")
    // @ts-ignore
    window.__AUTH_TOKEN__ = null
    setTokenState(null)
  }

  // Handle the case where we have a token but user hasn't loaded yet
  const isLoading = token ? isUserLoading : false

  return (
    <AuthContext.Provider value={{ user: user || null, token, setAuth, clearAuth, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
