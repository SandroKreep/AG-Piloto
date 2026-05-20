import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TripHistoryComponent from './TripHistoryComponent'

export default function TripHistoryWrapper() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
      setLoading(false)
    }

    getUser()
  }, [])

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 'clamp(20px, 5vw, 40px)',
        color: '#666',
        fontSize: 'clamp(14px, 2.5vw, 16px)'
      }}>
        A carregar histórico...
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 'clamp(20px, 5vw, 40px)',
        color: '#666',
        fontSize: 'clamp(14px, 2.5vw, 16px)'
      }}>
        Faça login para ver seu histórico
      </div>
    )
  }

  return <TripHistoryComponent userId={userId} userType="CUSTOMER" />
}
