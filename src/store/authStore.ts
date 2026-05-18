import { create } from 'zustand'
import { supabase } from '../lib/supabase'

type User = {
  id: string
  email: string
  name?: string
}

type AuthState = {
  user: User | null
  isLoading: boolean
  showAuthModal: boolean
  pendingAction: (() => void) | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setShowAuthModal: (show: boolean, pendingAction?: () => void) => void
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  showAuthModal: false,
  pendingAction: null,

  setUser: (user) => set({ user, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  setShowAuthModal: (show, pendingAction) => {
    set({ showAuthModal: show, pendingAction: pendingAction || null })
  },

  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.user.id)
          .single()

        set({
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: profileData?.name || data.user.user_metadata?.name,
          },
          showAuthModal: false,
        })

        // Execute pending action after successful login
        const { pendingAction } = get()
        if (pendingAction) {
          pendingAction()
          set({ pendingAction: null })
        }

        return { success: true }
      }

      return { success: false, error: 'Login failed' }
    } catch (error: any) {
      console.error('Login error:', error)
      return { success: false, error: error.message || 'Erro ao fazer login' }
    }
  },

  register: async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })

      if (error) throw error

      if (data.user) {
        // Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              name,
            },
          ])

        if (profileError) {
          console.error('Profile creation error:', profileError)
          // Don't fail registration if profile creation fails
        }

        set({
          user: {
            id: data.user.id,
            email: data.user.email!,
            name,
          },
          showAuthModal: false,
        })

        // Execute pending action after successful registration
        const { pendingAction } = get()
        if (pendingAction) {
          pendingAction()
          set({ pendingAction: null })
        }

        return { success: true }
      }

      return { success: false, error: 'Registration failed' }
    } catch (error: any) {
      console.error('Registration error:', error)
      return { success: false, error: error.message || 'Erro ao criar conta' }
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null })
    } catch (error) {
      console.error('Logout error:', error)
    }
  },

  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', session.user.id)
          .single()

        set({
          user: {
            id: session.user.id,
            email: session.user.email!,
            name: profileData?.name || session.user.user_metadata?.name,
          },
          isLoading: false,
        })
      } else {
        set({ user: null, isLoading: false })
      }
    } catch (error) {
      console.error('Session check error:', error)
      set({ user: null, isLoading: false })
    }
  },
}))
