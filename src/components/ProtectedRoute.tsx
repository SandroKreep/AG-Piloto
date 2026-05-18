import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Props = {
  requiredRole: 'admin'
  children: ReactNode
}

export default function ProtectedRoute({ requiredRole, children }: Props) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        if (mounted) {
          setAllowed(false)
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (mounted) {
        setAllowed(!error && data?.role === requiredRole)
        setLoading(false)
      }
    }

    void checkAccess()

    return () => {
      mounted = false
    }
  }, [requiredRole])

  if (loading) {
    return <p style={{ padding: '24px' }}>A validar permissões...</p>
  }

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return children
}
