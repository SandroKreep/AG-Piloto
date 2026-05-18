import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dzqblmxulgekmzgchdzx.supabase.co'
const supabaseAnonKey = 'sb_publishable_XhmXWaJtxbkoG3j9XEoclQ_xeCkqcmG'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
