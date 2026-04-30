'use client'

import { useState, useRef } from 'react'
import {
  Plus, Database, Loader2, Trash2, Edit3,
  Upload, X, Check, AlertCircle,
} from 'lucide-react'
import type { KnowledgeSource } from '@/types'

const TEAL = '#1D9E75'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  empty:      { label: 'Leeg',       color: '#9CA3AF', bg: '#F3F4F6' },
  processing: { label: 'Verwerken',  color: '#F59E0B', bg: '#FFFBEB' },
  ready:      { label: 'Gereed',     color: TEAL,      bg: '#ECFDF5' },
  error:      { label: 'Fout',       color: '#EF4444', bg: '#FEF2F2' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px',
  borderRadius: 7, border: '0.5px solid #E2E8F0',
  fontSize: 12, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', color: '#0F172A', background: '#fff',
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function EditModal({
  isNew,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSave,
  onClose,
  isSaving,
}: {
  isNew: boolean
  name: string
  description: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onSave: () => void
  onClose: () => void
  isSaving: boolean
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, width: 420, maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: 0 }}>
            {isNew ? 'Nieuwe kennisbron' : 'Kennisbron bewerken'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ModalField label="Naam *">
            <input value={name} onChange={(e) => onNameChange(e.target.value)}
              placeholder="Bijv. Handleidingen" style={inputStyle} />
          </ModalField>
          <ModalField label="Beschrijving">
            <input value={description} onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Korte omschrijving" style={inputStyle} />
          </ModalField>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '0.5px solid #F1F5F9' }}>
          <button onClick={onClose} style={{
            height: 32, padding: '0 14px', borderRadius: 7,
            border: '0.5px solid #E2E8F0', background: '#fff',
            fontSize: 12, cursor: 'pointer', color: '#64748B', fontFamily: 'inherit',
          }}>
            Annuleren
          </button>
          <button onClick={onSave} disabled={isSaving} style={{
            height: 32, padding: '0 16px', borderRadius: 7,
            background: TEAL, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: isSaving ? 0.6 : 1, fontFamily: 'inherit',
          }}>
            {isSaving
              ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan...</>
              : <><Check size={11} /> Opslaan</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailPanel({
  source,
  onClose,
  onDelete,
  onUpload,
  uploadStatus,
  uploadError,
}: {
  source: KnowledgeSource
  onClose: () => void
  onDelete: () => void
  onUpload: (file: File) => void
  uploadStatus: 'idle' | 'uploading' | 'error'
  uploadError: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 300,
        paddingTop: '10vh',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, width: 560, maxWidth: '92vw',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: 0 }}>
              {source.name}
            </h3>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
              {source.description || 'Geen beschrijving'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '0 20px 16px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            padding: '8px 12px', borderRadius: 8, background: STATUS_META[source.status]?.bg ?? '#F3F4F6',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: STATUS_META[source.status]?.color ?? '#9CA3AF',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: STATUS_META[source.status]?.color ?? '#9CA3AF', fontWeight: 500 }}>
              {STATUS_META[source.status]?.label ?? source.status}
            </span>
            <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
              {source.documentCount} document{source.documentCount !== 1 ? 'en' : ''}
            </span>
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? TEAL : '#E2E8F0'}`,
              borderRadius: 10, padding: '28px 20px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#ECFDF5' : '#FAFBFC',
              transition: 'all 0.15s', marginBottom: 16,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {uploadStatus === 'uploading' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={14} color={TEAL} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>Uploaden...</span>
              </div>
            ) : (
              <>
                <Upload size={18} color="#9CA3AF" style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                  Sleep bestanden hierheen of klik om te uploaden
                </p>
                <p style={{ fontSize: 10, color: '#C4C9D4', margin: '4px 0 0' }}>
                  PDF, DOCX, TXT — max 50 MB
                </p>
              </>
            )}
            {uploadError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                <AlertCircle size={12} color="#EF4444" />
                <span style={{ fontSize: 11, color: '#EF4444' }}>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Placeholder voor documentenlijst */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Documenten
            </p>
            {source.documentCount === 0 ? (
              <p style={{ fontSize: 12, color: '#C4C9D4', textAlign: 'center', padding: '16px 0' }}>
                Nog geen documenten geupload
              </p>
            ) : (
              <p style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>
                {source.documentCount} document{source.documentCount !== 1 ? 'en' : ''} geindexeerd
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '0.5px solid #F1F5F9' }}>
          <button onClick={onDelete} style={{
            height: 32, padding: '0 14px', borderRadius: 7,
            border: '0.5px solid #FECACA', background: '#FEF2F2',
            fontSize: 12, cursor: 'pointer', color: '#EF4444', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Trash2 size={11} />
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

interface KnowledgeSourcesViewProps {
  sources: KnowledgeSource[]
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export function KnowledgeSourcesView({ sources }: KnowledgeSourcesViewProps) {
  const [list, setList] = useState(sources)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const openNew = () => {
    setEditName('')
    setEditDescription('')
    setEditingId('new')
  }

  const openEdit = (s: KnowledgeSource) => {
    setEditName(s.name)
    setEditDescription(s.description)
    setEditingId(s.id)
  }

  const handleSave = async () => {
    if (!editName.trim()) { showToast('Naam is verplicht', false); return }
    setLoading('save')
    try {
      if (editingId === 'new') {
        const res = await fetch('/api/knowledge-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName, description: editDescription }),
        })
        if (!res.ok) throw new Error()
        const created = await res.json() as KnowledgeSource
        setList((prev) => [created, ...prev])
        showToast(`${created.name} aangemaakt`)
      } else if (editingId) {
        const res = await fetch(`/api/knowledge-sources/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName, description: editDescription }),
        })
        if (!res.ok) throw new Error()
        setList((prev) => prev.map((s) =>
          s.id === editingId ? { ...s, name: editName, description: editDescription } : s
        ))
        showToast(`${editName} opgeslagen`)
      }
      setEditingId(null)
    } catch {
      showToast('Opslaan mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    const s = list.find((x) => x.id === id)
    if (!s) return
    if (!confirm(`Weet je zeker dat je "${s.name}" wilt verwijderen?`)) return
    setDetailId(null)
    setLoading(id + '_del')
    try {
      const res = await fetch(`/api/knowledge-sources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setList((prev) => prev.filter((x) => x.id !== id))
      showToast(`${s.name} verwijderd`)
    } catch {
      showToast('Verwijderen mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  const handleUpload = async (file: File) => {
    if (!detailId) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Ongeldig bestandstype. Toegestaan: PDF, DOCX, TXT')
      return
    }

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setUploadError('Bestand te groot (max 50 MB)')
      return
    }

    setUploadStatus('uploading')
    setUploadError(null)

    try {
      // 1. Get presigned URL
      const urlRes = await fetch('/api/rag/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeSourceId: detailId,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      })
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({ error: 'Upload URL aanvraag mislukt' }))
        throw new Error((err as { error: string }).error ?? 'Upload URL aanvraag mislukt')
      }

      const { uploadUrl, documentId } = await urlRes.json() as { uploadUrl: string; documentId: string }

      // 2. Upload to S3
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error('S3 upload mislukt')

      // 3. Confirm upload
      const confirmRes = await fetch('/api/rag/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({ error: 'Confirm mislukt' }))
        throw new Error((err as { error: string }).error ?? 'Confirm mislukt')
      }

      // Update local state
      setList((prev) => prev.map((s) =>
        s.id === detailId
          ? { ...s, status: 'processing' as const, documentCount: s.documentCount + 1 }
          : s
      ))
      showToast(`${file.name} wordt verwerkt`)

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      setUploadError(msg)
    } finally {
      setUploadStatus('idle')
    }
  }

  const activeSources = list.filter((s) => s.status === 'ready')
  const detailSource = detailId ? list.find((s) => s.id === detailId) ?? null : null

  return (
    <div style={{
      flex: 1,
      padding: '28px 32px',
      overflowY: 'auto',
      background: '#F7F8FA',
      fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: '#0F172A', margin: 0 }}>
              Kennisbronnen
            </h1>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
              Beheer vector databases die je aan AI-assistenten koppelt
            </p>
          </div>
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 16px', borderRadius: 8,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Nieuwe kennisbron
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Totaal', value: list.length, color: '#0F172A' },
            { label: 'Gereed', value: activeSources.length, color: TEAL },
            { label: 'Verwerken', value: list.filter((s) => s.status === 'processing').length, color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#fff', border: '0.5px solid #EAECEF',
              borderRadius: 10, padding: '14px 20px', flex: 1,
            }}>
              <p style={{ fontSize: 22, fontWeight: 500, color, margin: 0 }}>{value}</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Grid */}
        {list.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 14, border: '0.5px solid #EAECEF',
            padding: '48px 32px', textAlign: 'center',
          }}>
            <Database size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px' }}>
              Nog geen kennisbronnen
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Maak een kennisbron aan om documenten te uploaden en te koppelen aan assistenten
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10,
          }}>
            {list.map((source) => {
              const meta = STATUS_META[source.status] ?? STATUS_META['empty']!
              return (
                <div
                  key={source.id}
                  onClick={() => setDetailId(source.id)}
                  style={{
                    background: '#fff', border: '0.5px solid #EAECEF',
                    borderRadius: 12, padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#EAECEF'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: '#ECFDF5', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Database size={14} color={TEAL} strokeWidth={1.75} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(source) }}
                        title="Bewerken"
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: '0.5px solid #EAECEF', background: '#F8FAFC',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Edit3 size={10} color="#6B7280" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(source.id) }}
                        disabled={loading === source.id + '_del'}
                        title="Verwijderen"
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: '0.5px solid #FECACA', background: '#FEF2F2',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: loading === source.id + '_del' ? 0.5 : 1,
                        }}
                      >
                        {loading === source.id + '_del'
                          ? <Loader2 size={10} color="#EF4444" style={{ animation: 'spin 1s linear infinite' }} />
                          : <Trash2 size={10} color="#EF4444" />
                        }
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.description || 'Geen beschrijving'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      color: meta.color, background: meta.bg,
                      padding: '2px 7px', borderRadius: 5,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#C4C9D4' }}>
                      {source.documentCount} doc
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingId !== null && (
        <EditModal
          isNew={editingId === 'new'}
          name={editName}
          description={editDescription}
          onNameChange={setEditName}
          onDescriptionChange={setEditDescription}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
          isSaving={loading === 'save'}
        />
      )}

      {/* Detail panel */}
      {detailSource && (
        <DetailPanel
          source={detailSource}
          onClose={() => { setDetailId(null); setUploadError(null); }}
          onDelete={() => handleDelete(detailSource.id)}
          onUpload={handleUpload}
          uploadStatus={uploadStatus}
          uploadError={uploadError}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 400,
          background: toast.ok ? '#111827' : '#EF4444',
          color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
