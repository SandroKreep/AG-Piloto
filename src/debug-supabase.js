// Script de debug para testar conexão Supabase
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
const supabaseUrl = 'https://your-project.supabase.co' // Substitua com sua URL
const supabaseAnonKey = 'your-anon-key' // Substitua com sua key

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabaseConnection() {
  console.log('🔍 Testando conexão com Supabase...')
  
  try {
    // Test 1: Conexão básica
    const { data, error } = await supabase
      .from('trips')
      .select('id, status')
      .limit(1)
    
    if (error) {
      console.error('❌ Erro na conexão:', error)
      return false
    }
    
    console.log('✅ Conexão OK! Dados:', data)
    
    // Test 2: Listener em tempo real
    console.log('🔍 Testando listener em tempo real...')
    
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'trips' }, 
        (payload) => {
          console.log('📡 Mudança recebida:', payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Listener OK! Inscrevido no canal')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no listener:', status)
        }
      })
    
    return true
    
  } catch (error) {
    console.error('❌ Erro geral:', error)
    return false
  }
}

// Testar atualização de status
async function testStatusUpdate() {
  console.log('🔍 Testando atualização de status...')
  
  // Primeiro, criar uma viagem de teste
  const { data: newTrip, error: createError } = await supabase
    .from('trips')
    .insert({
      origin_address: 'Teste Origem',
      destination_address: 'Teste Destino',
      status: 'REQUESTED',
      service_type: 'moto',
      quoted_price: 1000
    })
    .select('id')
  
  if (createError) {
    console.error('❌ Erro ao criar viagem de teste:', createError)
    return
  }
  
  const tripId = newTrip[0].id
  console.log('✅ Viagem de teste criada:', tripId)
  
  // Aguardar 2 segundos
  setTimeout(async () => {
    // Atualizar status
    const { error: updateError } = await supabase
      .from('trips')
      .update({ status: 'ASSIGNED' })
      .eq('id', tripId)
    
    if (updateError) {
      console.error('❌ Erro ao atualizar status:', updateError)
    } else {
      console.log('✅ Status atualizado para ASSIGNED')
    }
    
    // Limpar viagem de teste
    setTimeout(async () => {
      await supabase
        .from('trips')
        .delete()
        .eq('id', tripId)
      console.log('🧹 Viagem de teste removida')
    }, 2000)
  }, 2000)
}

// Executar testes
testSupabaseConnection()
testStatusUpdate()

console.log('🔍 Abra o console do navegador e execute este script para ver os logs')
console.log('🔍 Verifique se aparecem as mensagens de sucesso e os listeners em tempo real')
