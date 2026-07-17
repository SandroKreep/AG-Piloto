import { useEffect, useState } from 'react'
import './ToastNotification.css'

type ToastType = 'success' | 'error' | 'info'

interface ToastNotificationProps {
  message: string
  type?: ToastType
  duration?: number
  onClose?: () => void
}

export default function ToastNotification({
  message,
  type = 'info',
  duration = 3000,
  onClose
}: ToastNotificationProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(), 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onClose?.(), 300)
  }

  return (
    <div className={`toast-notification toast-notification--${type} ${visible ? 'toast-notification--visible' : ''}`}>
      <div className="toast-notification__content">
        <span className="toast-notification__message">{message}</span>
        <button 
          className="toast-notification__close"
          onClick={handleClose}
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
