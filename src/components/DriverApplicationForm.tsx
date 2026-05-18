import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import './DriverApplicationForm.css'

interface DriverApplicationData {
  fullName: string
  whatsapp: string
  biFrontPath?: string
  biBackPath?: string
  photo4x4Path?: string
}

export default function DriverApplicationForm() {
  const [formData, setFormData] = useState<DriverApplicationData>({
    fullName: '',
    whatsapp: ''
  })
  
  const [uploading, setUploading] = useState({
    biFront: false,
    biBack: false,
    photo4x4: false
  })
  
  const [uploadProgress, setUploadProgress] = useState({
    biFront: 0,
    biBack: 0,
    photo4x4: 0
  })
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Máscara para WhatsApp +244
  const formatWhatsApp = (value: string) => {
    // Remove todos os caracteres não numéricos
    const cleaned = value.replace(/\D/g, '')
    
    // Adiciona o prefixo +244 se não existir
    if (cleaned && !cleaned.startsWith('244')) {
      return `+244${cleaned}`
    }
    
    return cleaned ? `+244${cleaned.slice(3)}` : ''
  }

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value)
    setFormData(prev => ({
      ...prev,
      whatsapp: formatted
    }))
  }

  const uploadFile = async (file: File, type: 'biFront' | 'biBack' | 'photo4x4') => {
    if (!file) return null

    setUploading(prev => ({ ...prev, [type]: true }))
    setUploadProgress(prev => ({ ...prev, [type]: 0 }))

    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `applications/${fileName}`

      // Upload para o bucket privado
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = (progress.loaded / progress.total) * 100
            setUploadProgress(prev => ({ ...prev, [type]: Math.round(percent) }))
          }
        })

      if (error) {
        console.error(`Erro no upload ${type}:`, error)
        throw error
      }

      return filePath
    } catch (error) {
      console.error(`Erro ao fazer upload ${type}:`, error)
      throw error
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
      setUploadProgress(prev => ({ ...prev, [type]: 0 }))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'biFront' | 'biBack' | 'photo4x4') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      setMessage('Apenas arquivos JPG e PNG são permitidos')
      setMessageType('error')
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('O tamanho máximo do arquivo é 5MB')
      setMessageType('error')
      return
    }

    try {
      const filePath = await uploadFile(file, type)
      if (filePath) {
        setFormData(prev => ({
          ...prev,
          [`${type}Path`]: filePath
        }))
        setMessage('Arquivo enviado com sucesso!')
        setMessageType('success')
      }
    } catch (error) {
      setMessage('Erro ao enviar arquivo. Tente novamente.')
      setMessageType('error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.fullName.trim()) {
      setMessage('Por favor, informe seu nome completo')
      setMessageType('error')
      return
    }

    if (!formData.whatsapp || formData.whatsapp.length < 13) {
      setMessage('Por favor, informe um número de WhatsApp válido')
      setMessageType('error')
      return
    }

    if (!formData.biFrontPath || !formData.biBackPath || !formData.photo4x4Path) {
      setMessage('Por favor, envie todos os documentos solicitados')
      setMessageType('error')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      // Salvar no banco de dados
      const { error } = await supabase
        .from('driver_applications')
        .insert({
          full_name: formData.fullName,
          whatsapp: formData.whatsapp,
          bi_front_path: formData.biFrontPath,
          bi_back_path: formData.biBackPath,
          photo_4x4_path: formData.photo4x4Path,
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Erro ao salvar candidatura:', error)
        throw error
      }

      // Limpar formulário
      setFormData({
        fullName: '',
        whatsapp: ''
      })
      
      // Limpar inputs de arquivo
      const fileInputs = document.querySelectorAll('input[type="file"]')
      fileInputs.forEach(input => (input as HTMLInputElement).value = '')

      setMessage('Candidatura enviada com sucesso! Entraremos em contato em breve.')
      setMessageType('success')
    } catch (error) {
      console.error('Erro ao enviar candidatura:', error)
      setMessage('Erro ao enviar candidatura. Tente novamente.')
      setMessageType('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="driver-application-form">
      <div className="form-container">
        <div className="form-header">
          <h1>Candidatura para Motorista</h1>
          <p>Preencha o formulário abaixo para se candidatar a motorista na AG-PILOTO</p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="application-form">
          <div className="form-group">
            <label htmlFor="fullName">Nome Completo *</label>
            <input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Digite seu nome completo"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="whatsapp">WhatsApp *</label>
            <input
              type="tel"
              id="whatsapp"
              value={formData.whatsapp}
              onChange={handleWhatsAppChange}
              placeholder="+244 9xx xxx xxx"
              required
              disabled={submitting}
            />
            <small>Formato: +244 seguido do número</small>
          </div>

          <div className="form-group">
            <label>BI Frente *</label>
            <div className="file-upload">
              <input
                type="file"
                id="biFront"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileUpload(e, 'biFront')}
                disabled={uploading.biFront || submitting}
              />
              <label htmlFor="biFront" className="file-label">
                {uploading.biFront ? (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress.biFront}%` }}
                      />
                    </div>
                    <span>{uploadProgress.biFront}%</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📄</span>
                    <span>Clique para enviar BI Frente</span>
                    <small>JPG ou PNG (máx. 5MB)</small>
                  </div>
                )}
              </label>
            </div>
            {formData.biFrontPath && (
              <div className="file-success">
                ✅ BI Frente enviado
              </div>
            )}
          </div>

          <div className="form-group">
            <label>BI Verso *</label>
            <div className="file-upload">
              <input
                type="file"
                id="biBack"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileUpload(e, 'biBack')}
                disabled={uploading.biBack || submitting}
              />
              <label htmlFor="biBack" className="file-label">
                {uploading.biBack ? (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress.biBack}%` }}
                      />
                    </div>
                    <span>{uploadProgress.biBack}%</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📄</span>
                    <span>Clique para enviar BI Verso</span>
                    <small>JPG ou PNG (máx. 5MB)</small>
                  </div>
                )}
              </label>
            </div>
            {formData.biBackPath && (
              <div className="file-success">
                ✅ BI Verso enviado
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Foto 4x4 *</label>
            <div className="file-upload">
              <input
                type="file"
                id="photo4x4"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileUpload(e, 'photo4x4')}
                disabled={uploading.photo4x4 || submitting}
              />
              <label htmlFor="photo4x4" className="file-label">
                {uploading.photo4x4 ? (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress.photo4x4}%` }}
                      />
                    </div>
                    <span>{uploadProgress.photo4x4}%</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">👤</span>
                    <span>Clique para enviar Foto 4x4</span>
                    <small>JPG ou PNG (máx. 5MB)</small>
                  </div>
                )}
              </label>
            </div>
            {formData.photo4x4Path && (
              <div className="file-success">
                ✅ Foto 4x4 enviada
              </div>
            )}
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={submitting || Object.values(uploading).some(u => u)}
          >
            {submitting ? 'Enviando...' : 'Enviar Candidatura'}
          </button>
        </form>
      </div>
    </div>
  )
}
