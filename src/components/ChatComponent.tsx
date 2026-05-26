import React, { useState, useEffect, useRef } from 'react'
import { Send, Phone, MapPin, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './ChatComponent.css'

interface Message {
  id: string
  tripId: string
  senderId: string
  senderType: 'CUSTOMER' | 'DRIVER'
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'LOCATION'
  isRead: boolean
  createdAt: Date
}

interface ChatComponentProps {
  tripId: string
  currentUserId: string
  currentUserType: 'CUSTOMER' | 'DRIVER'
  recipientName?: string
  onClose?: () => void
}

export default function ChatComponent({
  tripId,
  currentUserId,
  currentUserType,
  recipientName = 'Motorista',
  onClose
}: ChatComponentProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadMessages()
    
    // Inscrever para novas mensagens em tempo real
    const channel = supabase
      .channel(`chat:${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ChatMessage',
        filter: `tripId=eq.${tripId}`
      }, (payload) => {
        const newMsg = payload.new as Message
        if (newMsg.senderId !== currentUserId) {
          setMessages(prev => [...prev, newMsg])
          markAsRead(newMsg.id)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, currentUserId])

  const loadMessages = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/chat/trips/${tripId}/messages?userId=${currentUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setMessages(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/chat/messages/${messageId}/read`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify({ userId: currentUserId })
        }
      )
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return

    const messageData = {
      tripId,
      senderId: currentUserId,
      senderType: currentUserType,
      content: newMessage.trim(),
      messageType: 'TEXT' as const
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/chat/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify(messageData)
        }
      )

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.data])
        setNewMessage('')
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
    }
  }

  const sendLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada pelo seu navegador')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locationData = {
          tripId,
          senderId: currentUserId,
          senderType: currentUserType,
          content: `Localização: ${position.coords.latitude}, ${position.coords.longitude}`,
          messageType: 'LOCATION' as const
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/chat/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
              },
              body: JSON.stringify(locationData)
            }
          )

          if (response.ok) {
            const data = await response.json()
            setMessages(prev => [...prev, data.data])
          }
        } catch (error) {
          console.error('Erro ao enviar localização:', error)
        }
      },
      (error) => {
        console.error('Erro ao obter localização:', error)
        alert('Não foi possível obter sua localização')
      }
    )
  }

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('pt-AO', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const messageDate = new Date(date)
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Hoje'
    }
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ontem'
    }
    
    return messageDate.toLocaleDateString('pt-AO')
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <User size={20} />
          <div>
            <div className="chat-recipient-name">{recipientName}</div>
            <div className="chat-status">
              {isTyping ? 'Digitando...' : 'Online'}
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button 
            className="chat-action-btn"
            onClick={sendLocation}
            title="Enviar localização"
          >
            <MapPin size={18} />
          </button>
          {onClose && (
            <button 
              className="chat-action-btn"
              onClick={onClose}
              title="Fechar chat"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {isLoading ? (
          <div className="chat-loading">
            <div className="chat-loading-spinner"></div>
            <span>A carregar mensagens...</span>
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>Nenhuma mensagem ainda</p>
                <p>Seja o primeiro a cumprimentar!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.senderId === currentUserId
                const showDate = index === 0 || 
                  formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt)
                
                return (
                  <React.Fragment key={message.id}>
                    {showDate && (
                      <div className="chat-date-separator">
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                    )}
                    <div className={`chat-message ${isOwn ? 'own' : 'other'}`}>
                      <div className="chat-message-content">
                        {message.messageType === 'LOCATION' ? (
                          <div className="chat-location-message">
                            <MapPin size={16} />
                            <span>{message.content}</span>
                          </div>
                        ) : (
                          <p>{message.content}</p>
                        )}
                        <div className="chat-message-time">
                          {formatTime(message.createdAt)}
                          {isOwn && (
                            <span className={`chat-read-status ${message.isRead ? 'read' : 'unread'}`}>
                              {message.isRead ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                  <polyline points="20 12 9 23 4 18"></polyline>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className="chat-input-container" onSubmit={sendMessage}>
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="chat-input"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="chat-send-btn"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  )
}
