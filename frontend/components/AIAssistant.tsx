'use client'

import { useState, useRef, useEffect } from 'react'
import api from '@/lib/api'
import { XIcon, SendIcon, HelpIcon } from '@/lib/icons'
import { useTranslation, type Language } from '@/lib/i18n'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIAssistantProps {
  language: Language
}

export default function AIAssistant({ language }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const t = useTranslation(language)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Mensaje de bienvenida
      setMessages([{
        role: 'assistant',
        content: language === 'es' 
          ? '¡Hola! Soy tu asistente financiero de DOMUS+. ¿En qué puedo ayudarte hoy? Puedo ayudarte con:\n\n• Cómo usar el sistema\n• Consejos de presupuesto\n• Análisis de tus gastos\n• Categorización de transacciones'
          : 'Hello! I\'m your DOMUS+ financial assistant. How can I help you today? I can help with:\n\n• How to use the system\n• Budget advice\n• Expense analysis\n• Transaction categorization',
        timestamp: new Date()
      }])
    }
  }, [isOpen, language])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    
    // Agregar mensaje del usuario
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])
    setLoading(true)

    try {
      const response = await api.post('/api/ai-assistant/chat', {
        message: userMessage,
        conversation_id: conversationId
      })

      // Actualizar conversation_id si es nuevo
      if (response.data.conversation_id && !conversationId) {
        setConversationId(response.data.conversation_id)
      }

      // Agregar respuesta del asistente
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      console.error('Error al enviar mensaje:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: language === 'es'
          ? 'Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.'
          : 'Sorry, an error occurred while processing your query. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-sap-primary hover:bg-sap-primary-dark text-white rounded-full shadow-2xl flex items-center justify-center z-[9999] transition-all hover:scale-110 animate-pulse"
        style={{ 
          boxShadow: '0 4px 20px rgba(0, 112, 242, 0.4)',
        }}
        title={language === 'es' ? 'Abrir asistente de IA' : 'Open AI assistant'}
      >
        <HelpIcon size={28} />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-[9999] border border-sap-border" style={{ maxHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sap-border bg-sap-primary text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <HelpIcon size={20} />
          <h3 className="font-semibold">
            {language === 'es' ? 'Asistente de IA' : 'AI Assistant'}
          </h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <XIcon size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-sap-bg">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-sap-primary text-white'
                  : 'bg-white border border-sap-border text-sap-text'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-white/70' : 'text-sap-text-secondary'
              }`}>
                {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-sap-border rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-sap-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-sap-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-sap-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-sap-border bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={language === 'es' ? 'Escribe tu pregunta...' : 'Type your question...'}
            className="flex-1 sap-input text-sm"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="sap-button-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon size={18} />
          </button>
        </div>
        <p className="text-xs text-sap-text-secondary mt-2">
          {language === 'es' 
            ? 'Presiona Enter para enviar'
            : 'Press Enter to send'}
        </p>
      </div>
    </div>
  )
}
