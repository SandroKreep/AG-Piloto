import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@2.0.0'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { full_name, whatsapp, bi_front_url, bi_back_url, photo_4x4_url } = await req.json()

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    const { data, error } = await resend.emails.send({
      from: 'AG-PILOTO <onboarding@resend.dev>',
      to: ['ageumacedo07@gmail.com'],
      subject: 'Nova Candidatura - AG-PILOTO',
      html: `
        <h2>Nova Candidatura Recebida</h2>
        <p><strong>Nome:</strong> ${full_name}</p>
        <p><strong>WhatsApp:</strong> ${whatsapp}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-AO')}</p>
        <hr/>
        <h3>Documentos:</h3>
        <p><a href="${bi_front_url}">Ver BI Frente</a></p>
        <p><a href="${bi_back_url}">Ver BI Verso</a></p>
        <p><a href="${photo_4x4_url}">Ver Foto 4x4</a></p>
      `
    })

    if (error) {
      console.error('Erro ao enviar email:', error)
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
