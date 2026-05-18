import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Logs de debugging para variáveis de ambiente
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('SERVICE_KEY existe:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('SERVICE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length)

    // Criar cliente Supabase com service role key (contorna RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const { full_name, whatsapp, bi_front_url, bi_back_url, photo_4x4_url } = body

    console.log('Dados recebidos na API:', { full_name, whatsapp, bi_front_url, bi_back_url, photo_4x4_url })

    // Validações básicas no servidor
    if (!full_name || !whatsapp || !bi_front_url || !bi_back_url || !photo_4x4_url) {
      console.error('❌ Validação falhou: campos em branco')
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Inserir na tabela driver_applications (contornando RLS)
    const { error } = await supabase.from('driver_applications').insert({
      full_name,
      whatsapp,
      bi_front_url,
      bi_back_url,
      photo_4x4_url
    })

    if (error) {
      console.error('❌ Erro Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Candidatura salva com sucesso via API Route')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('❌ Erro inesperado na API Route:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
