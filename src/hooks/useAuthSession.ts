import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthSessionState = {
  token: string
  userId: string | null
  loading: boolean
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    token: '',
    userId: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setState({
        token: data.session?.access_token ?? '',
        userId: data.session?.user.id ?? null,
        loading: false,
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setState({
        token: session?.access_token ?? '',
        userId: session?.user.id ?? null,
        loading: false,
      })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
