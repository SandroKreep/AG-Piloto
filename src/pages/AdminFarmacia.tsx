import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminFarmacia.css'

type Medicamento = {
  id: string
  nome: string
  descricao: string
  preco: number
  categoria: string
  imagem_url: string | null
  disponivel: boolean
}

type FormData = {
  nome: string
  descricao: string
  preco: string
  categoria: string
  imagem: File | null
  disponivel: boolean
}

const CATEGORIAS = ['Analgésico', 'Antibiótico', 'Vitaminas', 'Higiene', 'Outros']

export default function AdminFarmacia() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    descricao: '',
    preco: '',
    categoria: 'Analgésico',
    imagem: null,
    disponivel: true
  })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchMedicamentos()
  }, [])

  const fetchMedicamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('medicamentos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMedicamentos(data || [])
    } catch (error) {
      console.error('Error fetching medicamentos:', error)
      showMessage('error', 'Erro ao carregar medicamentos')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, imagem: e.target.files![0] }))
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('farmacia')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('farmacia')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let imageUrl = null

      if (formData.imagem) {
        imageUrl = await uploadImage(formData.imagem)
        if (!imageUrl) {
          showMessage('error', 'Erro ao fazer upload da imagem')
          setUploading(false)
          return
        }
      }

      const medicamentoData: any = {
        nome: formData.nome,
        descricao: formData.descricao,
        preco: parseFloat(formData.preco),
        categoria: formData.categoria,
        disponivel: formData.disponivel
      }

      // Only include imagem_url if a new image was uploaded
      if (imageUrl !== null) {
        medicamentoData.imagem_url = imageUrl
      }

      if (editingId) {
        const { error } = await supabase
          .from('medicamentos')
          .update(medicamentoData)
          .eq('id', editingId)

        if (error) throw error
        showMessage('success', 'Medicamento atualizado com sucesso')
      } else {
        const { error } = await supabase
          .from('medicamentos')
          .insert([medicamentoData])

        if (error) throw error
        showMessage('success', 'Medicamento adicionado com sucesso')
      }

      resetForm()
      fetchMedicamentos()
    } catch (error) {
      console.error('Error saving medicamento:', error)
      showMessage('error', 'Erro ao salvar medicamento')
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (medicamento: Medicamento) => {
    setFormData({
      nome: medicamento.nome,
      descricao: medicamento.descricao,
      preco: medicamento.preco.toString(),
      categoria: medicamento.categoria,
      imagem: null,
      disponivel: medicamento.disponivel
    })
    setEditingId(medicamento.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este medicamento?')) return

    try {
      const { error } = await supabase
        .from('medicamentos')
        .delete()
        .eq('id', id)

      if (error) throw error
      showMessage('success', 'Medicamento removido com sucesso')
      fetchMedicamentos()
    } catch (error) {
      console.error('Error deleting medicamento:', error)
      showMessage('error', 'Erro ao remover medicamento')
    }
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      preco: '',
      categoria: 'Analgésico',
      imagem: null,
      disponivel: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="admin-farmacia">
      <header className="admin-farmacia__header">
        <span className="admin-farmacia__badge">AG-PILOTO</span>
        <h1>Gestão de Farmácia</h1>
        <p>Adicione, edite e remova medicamentos do catálogo</p>
      </header>

      {message && (
        <div className={`admin-farmacia__message admin-farmacia__message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="admin-farmacia__actions">
        <button
          className="admin-farmacia__btn admin-farmacia__btn--primary"
          onClick={() => setShowForm(true)}
        >
          + Adicionar Medicamento
        </button>
      </div>

      {showForm && (
        <div className="admin-farmacia__modal-overlay">
          <div className="admin-farmacia__modal">
            <div className="admin-farmacia__modal-header">
              <h2>{editingId ? 'Editar Medicamento' : 'Adicionar Medicamento'}</h2>
              <button
                className="admin-farmacia__close-btn"
                onClick={resetForm}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="admin-farmacia__form">
              <div className="admin-farmacia__form-group">
                <label htmlFor="nome">Nome do Medicamento *</label>
                <input
                  type="text"
                  id="nome"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  required
                  placeholder="Ex: Paracetamol 500mg"
                />
              </div>

              <div className="admin-farmacia__form-group">
                <label htmlFor="descricao">Descrição</label>
                <textarea
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Descrição do medicamento..."
                />
              </div>

              <div className="admin-farmacia__form-row">
                <div className="admin-farmacia__form-group">
                  <label htmlFor="preco">Preço (AOA) *</label>
                  <input
                    type="number"
                    id="preco"
                    name="preco"
                    value={formData.preco}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>

                <div className="admin-farmacia__form-group">
                  <label htmlFor="categoria">Categoria *</label>
                  <select
                    id="categoria"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleInputChange}
                    required
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-farmacia__form-group">
                <label htmlFor="imagem">Imagem</label>
                <input
                  type="file"
                  id="imagem"
                  name="imagem"
                  onChange={handleImageChange}
                  accept="image/*"
                />
                {formData.imagem && (
                  <p className="admin-farmacia__file-name">
                    {formData.imagem.name}
                  </p>
                )}
              </div>

              <div className="admin-farmacia__form-group">
                <label className="admin-farmacia__checkbox-label">
                  <input
                    type="checkbox"
                    name="disponivel"
                    checked={formData.disponivel}
                    onChange={handleInputChange}
                  />
                  <span>Disponível para venda</span>
                </label>
              </div>

              <div className="admin-farmacia__modal-actions">
                <button
                  type="button"
                  className="admin-farmacia__btn admin-farmacia__btn--secondary"
                  onClick={resetForm}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-farmacia__btn admin-farmacia__btn--primary"
                  disabled={uploading}
                >
                  {uploading ? 'A salvar...' : (editingId ? 'Atualizar' : 'Adicionar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-farmacia__loading">A carregar...</div>
      ) : (
        <div className="admin-farmacia__list">
          {medicamentos.length === 0 ? (
            <div className="admin-farmacia__empty">
              <p>Nenhum medicamento cadastrado</p>
            </div>
          ) : (
            medicamentos.map(medicamento => (
              <div key={medicamento.id} className="admin-farmacia__card">
                {medicamento.imagem_url && (
                  <img
                    src={medicamento.imagem_url}
                    alt={medicamento.nome}
                    className="admin-farmacia__card-image"
                  />
                )}
                <div className="admin-farmacia__card-content">
                  <h3 className="admin-farmacia__card-title">{medicamento.nome}</h3>
                  <p className="admin-farmacia__card-desc">{medicamento.descricao}</p>
                  <div className="admin-farmacia__card-meta">
                    <span className="admin-farmacia__card-category">{medicamento.categoria}</span>
                    <span className="admin-farmacia__card-price">
                      {medicamento.preco.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}
                    </span>
                  </div>
                  <div className="admin-farmacia__card-status">
                    <span className={`admin-farmacia__status admin-farmacia__status--${medicamento.disponivel ? 'available' : 'unavailable'}`}>
                      {medicamento.disponivel ? 'Disponível' : 'Indisponível'}
                    </span>
                  </div>
                </div>
                <div className="admin-farmacia__card-actions">
                  <button
                    className="admin-farmacia__btn admin-farmacia__btn--edit"
                    onClick={() => handleEdit(medicamento)}
                  >
                    Editar
                  </button>
                  <button
                    className="admin-farmacia__btn admin-farmacia__btn--delete"
                    onClick={() => handleDelete(medicamento.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
