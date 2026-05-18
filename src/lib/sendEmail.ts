import { supabase } from './supabase'

export async function enviarEmailAdmin(dados: {
  full_name: string
  whatsapp: string
  bi_front_url: string
  bi_back_url: string
  photo_4x4_url: string
}) {
  const { error } = await supabase.functions.invoke('send-candidatura-email', {
    body: dados,
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` 
    }
  })
  if (error) console.error('Erro ao enviar email:', error)
  else console.log('Email enviado com sucesso')
}
