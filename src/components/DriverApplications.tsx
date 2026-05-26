import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import DocumentModal from './DocumentModal'
import './DriverApplications.css'

interface DriverApplication {
  id: string
  full_name: string
  whatsapp: string
  bi_front_url: string
  bi_back_url: string
  photo_4x4_url: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at?: string
}

interface SignedUrls {
  [key: string]: string
}

export default function DriverApplications() {
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<{
    url: string
    title: string
  } | null>(null)
  const [signedUrls, setSignedUrls] = useState<SignedUrls>({})
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set())
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set())

  // Gerar URL assinada para um documento
  const getSignedUrl = async (filePath: string) => {
    if (signedUrls[filePath]) {
      return signedUrls[filePath]
    }

    setLoadingUrls(prev => new Set(prev).add(filePath))

    try {
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(filePath, 60 * 60) // 1 hora de validade

      if (error) {
        console.error('Erro ao gerar URL assinada:', error)
        return null
      }

      const signedUrl = data.signedUrl
      setSignedUrls(prev => ({ ...prev, [filePath]: signedUrl }))
      return signedUrl
    } catch (error) {
      console.error('Erro ao gerar URL assinada:', error)
      return null
    } finally {
      setLoadingUrls(prev => {
        const newSet = new Set(prev)
        newSet.delete(filePath)
        return newSet
      })
    }
  }

  // Abrir documento no modal
  const openDocument = async (filePath: string, title: string) => {
    const url = await getSignedUrl(filePath)
    if (url) {
      setSelectedDocument({ url, title })
    }
  }

  // Atualizar status da candidatura
  const updateApplicationStatus = async (applicationId: string, status: 'approved' | 'rejected') => {
    setUpdatingStatus(prev => new Set(prev).add(applicationId))

    try {
      const { error } = await supabase
        .from('driver_applications')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) {
        console.error('Erro ao atualizar status:', error)
        throw error
      }

      // Atualizar estado local
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId 
            ? { ...app, status, updated_at: new Date().toISOString() }
            : app
        )
      )

      // Limpar URLs assinadas se rejeitou (não precisa mais)
      if (status === 'rejected') {
        const application = applications.find(app => app.id === applicationId)
        if (application) {
          const urlsToRemove = [
            application.bi_front_url,
            application.bi_back_url,
            application.photo_4x4_url
          ]
          setSignedUrls(prev => {
            const newUrls = { ...prev }
            urlsToRemove.forEach(path => delete newUrls[path])
            return newUrls
          })
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status. Tente novamente.')
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev)
        newSet.delete(applicationId)
        return newSet
      })
    }
  }

  // Debug inicial - verificar sessão e dados
  useEffect(() => {
    const testQuery = async () => {
      console.log('🔍 INICIANDO DEBUG COMPLETO...')
      
      // Verificar sessão do utilizador
      const { data: session } = await supabase.auth.getSession()
      console.log('👤 SESSÃO:', JSON.stringify(session))
      
      // Query com count para debug
      const { data, error, count } = await supabase
        .from('driver_applications')
        .select('*', { count: 'exact' })
      
      console.log('📊 TOTAL registos:', count)
      console.log('📋 DATA:', JSON.stringify(data, null, 2))
      console.log('❌ ERROR:', JSON.stringify(error, null, 2))
      
      // Verificar política RLS
      if (error) {
        console.error('🚫 ERRO RLS:', error)
        if (error.message?.includes('row level security')) {
          console.error('🚫 BLOQUEADO POR RLS - Utilizador não autenticado!')
        }
      }
    }
    
    testQuery()
  }, [])

  // Carregar candidaturas
  useEffect(() => {
    const loadApplications = async () => {
      try {
        console.log('🔍 Carregando candidaturas do Supabase...')
        const { data, error } = await supabase
          .from('driver_applications')
          .select('*')
          .order('created_at', { ascending: false })

        console.log('📊 Candidaturas retornadas:', data)
        console.log('❌ Erro na query:', error)

        if (error) {
          console.error('Erro ao carregar candidaturas:', error)
          throw error
        }

        console.log('✅ Candidaturas carregadas:', data?.length || 0)
        setApplications(data || [])
      } catch (error) {
        console.error('Erro ao carregar candidaturas:', error)
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [])

  // Formatar WhatsApp para link
  const formatWhatsAppLink = (whatsapp: string) => {
    const cleanNumber = whatsapp.replace(/\D/g, '')
    return `https://wa.me/${cleanNumber}`
  }

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff6b35'
      case 'approved': return '#28a745'
      case 'rejected': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente'
      case 'approved': return 'Aprovado'
      case 'rejected': return 'Rejeitado'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="driver-applications-loading">
        <div className="spinner"></div>
        <p>Carregando candidaturas...</p>
      </div>
    )
  }

  return (
    <div className="driver-applications">
      <div className="applications-header">
        <h2>Candidaturas de Motoristas</h2>
        <div className="applications-stats">
          <div className="stat-card">
            <span className="stat-number">{applications.length}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {applications.filter(app => app.status === 'pending').length}
            </span>
            <span className="stat-label">Pendentes</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {applications.filter(app => app.status === 'approved').length}
            </span>
            <span className="stat-label">Aprovadas</span>
          </div>
        </div>
      </div>

      <div className="applications-list">
        {applications.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>Nenhuma candidatura encontrada</h3>
            <p>Não há candidaturas de motoristas no momento.</p>
          </div>
        ) : (
          applications.map(application => (
            <div key={application.id} className="application-card">
              <div className="application-header">
                <div className="applicant-info">
                  <h3>{application.full_name}</h3>
                  <a 
                    href={formatWhatsAppLink(application.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link"
                  >
                    💬 {application.whatsapp}
                  </a>
                </div>
                <div className="application-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(application.status) }}
                  >
                    {getStatusText(application.status)}
                  </span>
                </div>
              </div>

              <div className="application-documents">
                <div className="document-section">
                  <h4>Documentos</h4>
                  <div className="document-links">
                    <button
                      className="document-btn"
                      onClick={() => openDocument(application.bi_front_url, 'BI - Frente')}
                      disabled={loadingUrls.has(application.bi_front_url)}
                    >
                      {loadingUrls.has(application.bi_front_url) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <path d="M9 4h6l3 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zM9 10h6M9 14h4" />
                        </svg>
                      )} BI Frente
                    </button>
                    <button
                      className="document-btn"
                      onClick={() => openDocument(application.bi_back_url, 'BI - Verso')}
                      disabled={loadingUrls.has(application.bi_back_url)}
                    >
                      {loadingUrls.has(application.bi_back_url) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <path d="M9 4h6l3 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zM9 10h6M9 14h4" />
                        </svg>
                      )} BI Verso
                    </button>
                    <button
                      className="document-btn"
                      onClick={() => openDocument(application.photo_4x4_url, 'Foto 4x4')}
                      disabled={loadingUrls.has(application.photo_4x4_url)}
                    >
                      {loadingUrls.has(application.photo_4x4_url) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )} Foto 4x4
                    </button>
                  </div>
                </div>
              </div>

              <div className="application-footer">
                <div className="application-date">
                  <small>
                    Candidatura: {formatDate(application.created_at)}
                  </small>
                  {application.updated_at && (
                    <small>
                      Atualizado: {formatDate(application.updated_at)}
                    </small>
                  )}
                </div>

                {application.status === 'pending' && (
                  <div className="application-actions">
                    <button
                      className="approve-btn"
                      onClick={() => updateApplicationStatus(application.id, 'approved')}
                      disabled={updatingStatus.has(application.id)}
                    >
                      {updatingStatus.has(application.id) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )} Aprovar
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => updateApplicationStatus(application.id, 'rejected')}
                      disabled={updatingStatus.has(application.id)}
                    >
                      {updatingStatus.has(application.id) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                      )} Rejeitar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <DocumentModal
        isOpen={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument?.title || ''}
        imageUrl={selectedDocument?.url || ''}
      />
    </div>
  )
}
