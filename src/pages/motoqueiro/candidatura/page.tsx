'use client'

import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { enviarEmailAdmin } from '../../../lib/sendEmail'
import './candidatura.css'

export default function CandidaturaPage() {

  const [formData, setFormData] = useState({
    full_name: '',
    whatsapp: ''
  })
  
  const [uploading, setUploading] = useState({
    bi_front: false,
    bi_back: false,
    photo_4x4: false
  })
  
  const [uploadProgress, setUploadProgress] = useState({
    bi_front: 0,
    bi_back: 0,
    photo_4x4: 0
  })
  
  const [previewImages, setPreviewImages] = useState({
    bi_front: null as string | null,
    bi_back: null as string | null,
    photo_4x4: null as string | null
  })
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Máscara para WhatsApp +244
  const formatWhatsApp = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
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

  // Upload de arquivo para o bucket privado
  const uploadFile = async (file: File, type: 'bi_front' | 'bi_back' | 'photo_4x4') => {
    if (!file) return null

    setUploading(prev => ({ ...prev, [type]: true }))
    setUploadProgress(prev => ({ ...prev, [type]: 0 }))

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `applications/${fileName}`

      console.log(`🚀 Iniciando upload ${type}:`, { fileName, filePath, fileSize: file.size })

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

      // Verificar erro de upload imediatamente
      if (error) {
        console.error(`❌ Erro no upload ${type}:`, error)
        throw new Error(`Falha no upload do ${type}: ${error.message}`)
      }

      console.log(`✅ Upload ${type} concluído:`, data)

      // Obter URL pública do arquivo
      const { data: urlData, error: urlError } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(filePath)

      if (urlError) {
        console.error(`❌ Erro ao obter URL ${type}:`, urlError)
        throw new Error(`Falha ao obter URL do ${type}: ${urlError.message}`)
      }

      if (!urlData?.publicUrl) {
        console.error(`❌ URL inválida para ${type}:`, urlData)
        throw new Error(`URL inválida retornada para ${type}`)
      }

      console.log(`🔗 URL obtida ${type}:`, urlData.publicUrl)
      return urlData.publicUrl
    } catch (error) {
      console.error(`❌ Erro ao fazer upload ${type}:`, error)
      throw error
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
      setUploadProgress(prev => ({ ...prev, [type]: 0 }))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'bi_front' | 'bi_back' | 'photo_4x4') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validação de tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      setMessage('Apenas arquivos JPG e PNG são permitidos')
      setMessageType('error')
      return
    }

    // Validação de tamanho
    if (file.size > 5 * 1024 * 1024) {
      setMessage('O tamanho máximo do arquivo é 5MB')
      setMessageType('error')
      return
    }

    // Criar preview local imediatamente
    const previewUrl = URL.createObjectURL(file)
    setPreviewImages(prev => ({
      ...prev,
      [type]: previewUrl
    }))

    try {
      console.log(`📤 Iniciando upload do arquivo ${type}:`, file.name)
      const publicUrl = await uploadFile(file, type)
      
      if (publicUrl) {
        console.log(`✅ URL recebida para ${type}:`, publicUrl)
        setFormData(prev => ({
          ...prev,
          [`${type}_url`]: publicUrl
        }))
        setMessage('Arquivo enviado com sucesso!')
        setMessageType('success')
      } else {
        throw new Error('URL não recebida do upload')
      }
    } catch (error: any) {
      console.error(`❌ Erro no upload ${type}:`, error)
      
      // Limpar preview em caso de erro
      setPreviewImages(prev => ({
        ...prev,
        [type]: null
      }))
      
      // Limpar formData URL
      setFormData(prev => ({
        ...prev,
        [`${type}_url`]: undefined
      }))
      
      // Limpar input file
      const input = document.getElementById(type) as HTMLInputElement
      if (input) {
        input.value = ''
      }
      
      // Mostrar mensagem de erro específica
      const errorMessage = error?.message || 'Erro ao enviar arquivo. Tente novamente.'
      setMessage(errorMessage)
      setMessageType('error')
    }
  }

  // Função para remover preview
  const removePreview = (type: 'bi_front' | 'bi_back' | 'photo_4x4') => {
    // Limpar URL.createObjectURL para evitar memory leaks
    if (previewImages[type]) {
      URL.revokeObjectURL(previewImages[type]!)
    }
    
    setPreviewImages(prev => ({
      ...prev,
      [type]: null
    }))
    
    // Limpar formData URL
    setFormData(prev => ({
      ...prev,
      [`${type}_url`]: undefined
    }))
    
    // Limpar input file
    const input = document.getElementById(type) as HTMLInputElement
    if (input) {
      input.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.full_name.trim()) {
      setMessage('Por favor, informe seu nome completo')
      setMessageType('error')
      return
    }

    if (!formData.whatsapp || formData.whatsapp.length < 13) {
      setMessage('Por favor, informe um número de WhatsApp válido')
      setMessageType('error')
      return
    }

    // Verificação rigorosa das URLs
    if (!formData.bi_front_url || !formData.bi_back_url || !formData.photo_4x4_url) {
      console.error('❌ URLs inválidas detectadas:', {
        bi_front_url: formData.bi_front_url,
        bi_back_url: formData.bi_back_url,
        photo_4x4_url: formData.photo_4x4_url
      })
      setMessage('Por favor, envie todos os documentos solicitados')
      setMessageType('error')
      return
    }

    // Verificação se URLs são strings válidas
    const urlsValidas = [
      formData.bi_front_url,
      formData.bi_back_url,
      formData.photo_4x4_url
    ].every(url => typeof url === 'string' && url.length > 0 && url.startsWith('http'))

    if (!urlsValidas) {
      console.error('❌ URLs não são strings válidas:', {
        bi_front_url: typeof formData.bi_front_url,
        bi_back_url: typeof formData.bi_back_url,
        photo_4x4_url: typeof formData.photo_4x4_url
      })
      setMessage('Erro nos documentos. Por favor, envie todos os arquivos novamente.')
      setMessageType('error')
      return
    }

    setSubmitting(true)
    setMessage('')

    // Objeto que será inserido - para debug (sem user_id)
    const insertData = {
      full_name: formData.full_name,
      whatsapp: formData.whatsapp,
      bi_front_url: formData.bi_front_url,
      bi_back_url: formData.bi_back_url,
      photo_4x4_url: formData.photo_4x4_url
    }

    console.log('🔍 DEBUG: Objeto completo para inserção:', insertData)

    try {
      console.log('💾 Iniciando inserção direta no Supabase...')
      
      // Inserir diretamente no Supabase usando o mesmo objeto do DEBUG
      const { error } = await supabase.from('driver_applications').insert(insertData)
      
      if (error) {
        console.error('❌ Erro ao salvar candidatura:', error)
        throw new Error(error.message)
      }

      console.log('✅ Candidatura salva com sucesso')

      // Enviar email para admin
      try {
        await enviarEmailAdmin({
          full_name: insertData.full_name,
          whatsapp: insertData.whatsapp,
          bi_front_url: insertData.bi_front_url,
          bi_back_url: insertData.bi_back_url,
          photo_4x4_url: insertData.photo_4x4_url
        })
        console.log('📧 Email enviado para admin com sucesso')
      } catch (emailError) {
        console.error('❌ Erro ao enviar email:', emailError)
        // Não falhar a candidatura se o email falhar
      }

      // Limpar formulário
      setFormData({
        full_name: '',
        whatsapp: ''
      })
      
      // Limpar previews
      setPreviewImages({
        bi_front: null,
        bi_back: null,
        photo_4x4: null
      })
      
      // Limpar inputs de arquivo
      const fileInputs = document.querySelectorAll('input[type="file"]')
      fileInputs.forEach(input => (input as HTMLInputElement).value = '')

      setMessage('Candidatura enviada com sucesso! Entraremos em contacto via WhatsApp.')
      setMessageType('success')
    } catch (error: any) {
      console.error('❌ Erro ao enviar candidatura:', error)
      const errorMessage = error?.message || 'Erro ao enviar candidatura. Tente novamente.'
      setMessage(errorMessage)
      setMessageType('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="candidatura-page">
      <div className="candidatura-container">
        <div className="candidatura-header">
          <h1>Candidatura para Motorista</h1>
          <p>Junta-se à equipa AG-PILOTO como motorista profissional</p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="candidatura-form">
          <div className="form-section">
            <h2>Informações Pessoais</h2>
            
            <div className="form-group">
              <label htmlFor="full_name">Nome Completo *</label>
              <input
                type="text"
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
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
          </div>

          <div className="form-section">
            <h2>Documentos</h2>
            
            <div className="documents-grid">
              <div className="form-group">
                <label>BI Frente *</label>
                <div className="file-upload">
                  <input
                    type="file"
                    id="bi_front"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => handleFileUpload(e, 'bi_front')}
                    disabled={uploading.bi_front || submitting}
                  />
                  <label htmlFor="bi_front" className="file-label">
                    {uploading.bi_front ? (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress.bi_front}%` }}
                          />
                        </div>
                        <span>{uploadProgress.bi_front}%</span>
                      </div>
                    ) : previewImages.bi_front ? (
                      <div className="image-preview">
                        <img 
                          src={previewImages.bi_front} 
                          alt="BI Frente" 
                          className="preview-image"
                        />
                        <button 
                          type="button"
                          className="remove-preview"
                          onClick={() => removePreview('bi_front')}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="upload-placeholder">
                        <span className="upload-icon">📄</span>
                        <span>BI Frente</span>
                        <small>JPG ou PNG (máx. 5MB)</small>
                      </div>
                    )}
                  </label>
                </div>
                {formData.bi_front_url && (
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
                    id="bi_back"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => handleFileUpload(e, 'bi_back')}
                    disabled={uploading.bi_back || submitting}
                  />
                  <label htmlFor="bi_back" className="file-label">
                    {uploading.bi_back ? (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress.bi_back}%` }}
                          />
                        </div>
                        <span>{uploadProgress.bi_back}%</span>
                      </div>
                    ) : previewImages.bi_back ? (
                      <div className="image-preview">
                        <img 
                          src={previewImages.bi_back} 
                          alt="BI Verso" 
                          className="preview-image"
                        />
                        <button 
                          type="button"
                          className="remove-preview"
                          onClick={() => removePreview('bi_back')}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="upload-placeholder">
                        <span className="upload-icon">📄</span>
                        <span>BI Verso</span>
                        <small>JPG ou PNG (máx. 5MB)</small>
                      </div>
                    )}
                  </label>
                </div>
                {formData.bi_back_url && (
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
                    id="photo_4x4"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => handleFileUpload(e, 'photo_4x4')}
                    disabled={uploading.photo_4x4 || submitting}
                  />
                  <label htmlFor="photo_4x4" className="file-label">
                    {uploading.photo_4x4 ? (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress.photo_4x4}%` }}
                          />
                        </div>
                        <span>{uploadProgress.photo_4x4}%</span>
                      </div>
                    ) : previewImages.photo_4x4 ? (
                      <div className="image-preview">
                        <img 
                          src={previewImages.photo_4x4} 
                          alt="Foto 4x4" 
                          className="preview-image"
                        />
                        <button 
                          type="button"
                          className="remove-preview"
                          onClick={() => removePreview('photo_4x4')}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="upload-placeholder">
                        <span className="upload-icon">👤</span>
                        <span>Foto 4x4</span>
                        <small>JPG ou PNG (máx. 5MB)</small>
                      </div>
                    )}
                  </label>
                </div>
                {formData.photo_4x4_url && (
                  <div className="file-success">
                    ✅ Foto 4x4 enviada
                  </div>
                )}
              </div>
            </div>
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
