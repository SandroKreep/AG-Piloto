import React from 'react'
import './DocumentModal.css'

interface DocumentModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  imageUrl: string
  alt?: string
}

export default function DocumentModal({ isOpen, onClose, title, imageUrl, alt = 'Documento' }: DocumentModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div 
      className="document-modal-backdrop" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="document-modal">
        <div className="document-modal-header">
          <h3>{title}</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="document-modal-content">
          <img 
            src={imageUrl} 
            alt={alt}
            className="document-image"
            loading="lazy"
          />
        </div>
        <div className="document-modal-footer">
          <button 
            className="download-btn"
            onClick={() => {
              const link = document.createElement('a')
              link.href = imageUrl
              link.download = alt || 'documento'
              link.target = '_blank'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
          >
            📥 Baixar
          </button>
          <button 
            className="close-footer-btn"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
