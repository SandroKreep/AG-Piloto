import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminComida.css'

export default function AdminComida() {
  const [refeicoes, setRefeicoes] = useState<any[]>([])
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = async () => {
    const { data } = await supabase
      .from('refeicoes')
      .select('*')
      .order('created_at', { ascending: false })
    setRefeicoes(data ?? [])
  }

  useEffect(() => { carregar() }, [])

  const adicionar = async () => {
    if (!nome || !preco || !whatsapp) {
      setMsg('Preenche nome, preço e whatsapp.')
      return
    }
    setLoading(true)
    let foto_url = ''
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}` 
      const { error: upErr } = await supabase.storage
        .from('refeicoes')
        .upload(path, file, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage
          .from('refeicoes')
          .getPublicUrl(path)
        foto_url = urlData.publicUrl
      }
    }
    await supabase.from('refeicoes').insert([{
      nome, descricao, preco: Number(preco), whatsapp, foto_url
    }])
    setNome(''); setDescricao(''); setPreco('')
    setWhatsapp(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setMsg('Refeição adicionada!')
    await carregar()
    setLoading(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const toggleDisponivel = async (id: string, atual: boolean) => {
    await supabase.from('refeicoes')
      .update({ disponivel: !atual }).eq('id', id)
    setMsg('Estado actualizado!')
    setMsgType('success')
    await carregar()
    setTimeout(() => setMsg(''), 3000)
  }

  const remover = async (id: string) => {
    console.log('A tentar remover id:', id)
    const { data, error } = await supabase
      .from('refeicoes')
      .delete()
      .eq('id', id)
      .select()
    console.log('Resultado delete:', { data, error })
    if (error) {
      setMsg('Erro ao remover: ' + error.message)
      setMsgType('error')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    setMsg('Refeição removida com sucesso!')
    setMsgType('success')
    await carregar()
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="admin-comida">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#ff6b00" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2a5 5 0 00-5 5v6h3v7"/>
        </svg>
        Gerir Comida
      </h1>

      <div className="admin-comida__form">
        <h2>Adicionar Refeição</h2>
        <input type="file" accept="image/*" ref={fileRef}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input placeholder="Nome da refeição" value={nome}
          onChange={(e) => setNome(e.target.value)} />
        <textarea placeholder="Descrição" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} />
        <input type="number" placeholder="Preço (Kz)" value={preco}
          onChange={(e) => setPreco(e.target.value)} />
        <input type="tel" placeholder="WhatsApp (+244...)" value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)} />
        {msg && (
          <p className={`admin-comida__msg ${msgType === 'error' ? 'admin-comida__msg--error' : ''}`}>
            {msg}
          </p>
        )}
        <button onClick={adicionar} disabled={loading}>
          {loading ? 'A adicionar...' : 'Adicionar Refeição'}
        </button>
      </div>

      <div className="admin-comida__lista">
        <h2>Refeições ({refeicoes.length})</h2>
        {refeicoes.map((r) => (
          <div key={r.id} className="admin-comida__item">
            {r.foto_url && (
              <img src={r.foto_url} alt={r.nome}
                className="admin-comida__img" />
            )}
            <div className="admin-comida__info">
              <strong>{r.nome}</strong>
              <span>{Number(r.preco).toLocaleString('pt-AO')} Kz</span>
              <span>{r.descricao}</span>
              <span>{r.whatsapp}</span>
            </div>
            <div className="admin-comida__actions">
              <button onClick={() => toggleDisponivel(r.id, r.disponivel)}
                className={r.disponivel ? 'btn-green' : 'btn-gray'}>
                {r.disponivel ? 'Disponível' : 'Indisponível'}
              </button>
              <button onClick={() => remover(r.id)} className="btn-red">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
