import { useState, useEffect } from 'react'

function App() {
  const [activeTab, setActiveTab] = useState('csv')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)

  // AI Settings
  const [provider, setProvider] = useState('openrouter') // 'openrouter' | 'ollama'
  // const [apiKey, setApiKey] = useState('') // API Key is now hardcoded in backend
  const [ollamaModels, setOllamaModels] = useState([])
  const [openRouterModels, setOpenRouterModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    word: '',
    definition: '',
    sentence: '',
    etymology: '',
    synonyms: ''
  })

  useEffect(() => {
    if (provider === 'ollama') {
      fetchModels()
    } else if (provider === 'openrouter') {
      fetchOpenRouterModels()
    }
  }, [provider])

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    let intervalId

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/batch/${jobId}/status`)
        if (!response.ok) {
          throw new Error('Failed to fetch batch status')
        }
        const data = await response.json()
        if (cancelled) return
        setJobStatus(data)

        if (data.status !== 'processing') {
          setLoading(false)
          setMessage(data.status === 'completed' ? 'Presentations generated successfully!' : null)
          if (intervalId) clearInterval(intervalId)
        }
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
        if (intervalId) clearInterval(intervalId)
      }
    }

    pollStatus()
    intervalId = setInterval(pollStatus, 1500)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [jobId])

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/models')
      if (response.ok) {
        const models = await response.json()
        setOllamaModels(models)
        if (models.length > 0) setSelectedModel(models[0])
      }
    } catch (err) {
      console.error("Failed to fetch Ollama models", err)
    }
  }

  const fetchOpenRouterModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/openrouter-models')
      if (response.ok) {
        const models = await response.json()
        setOpenRouterModels(models)
        // Set a default if available, preferably gemini-flash
        const defaultModel = models.find(m => m.id.includes('gemini-1.5-flash')) || models[0]
        if (defaultModel) setSelectedModel(defaultModel.id)
      }
    } catch (err) {
      console.error("Failed to fetch OpenRouter models", err)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setMessage(null)
      setError(null)
      setJobId(null)
      setJobStatus(null)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setMessage(null)
    setJobId(null)
    setJobStatus(null)

    const data = new FormData()
    data.append('file', file)
    data.append('provider', provider)
    // if (apiKey) data.append('api_key', apiKey) // API Key is hardcoded
    if (selectedModel) data.append('model', selectedModel)

    try {
      const response = await fetch('http://localhost:8000/api/batch/upload', {
        method: 'POST',
        body: data,
      })

      if (!response.ok) {
        throw new Error('Failed to start batch generation')
      }

      const result = await response.json()
      setJobId(result.job_id)
      setMessage('Batch started. Generating presentations...')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    // Prepare payload
    const payload = {
      ...formData,
      provider,
      // api_key: provider === 'openrouter' ? apiKey : undefined, // API Key is hardcoded
      model: selectedModel
    }

    try {
      const response = await fetch('http://localhost:8000/generate-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate presentation')
      }

      await downloadFile(response, `Generated_${formData.word}.pptx`)
      setMessage('Presentation generated successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async (response, filename) => {
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const isMagicReady = () => {
    if (provider === 'openrouter') return true // API Key is hardcoded
    if (provider === 'ollama') return true // Assuming Ollama is always ready if selected
    return false
  }

  const renderAISettings = () => (
    <div className="ai-settings-panel">
      <label className="ai-label">
        ✨ AI Settings
      </label>

      <div className="radio-group">
        <label className="radio-label">
          <input
            type="radio"
            name="provider"
            value="openrouter"
            checked={provider === 'openrouter'}
            onChange={(e) => setProvider(e.target.value)}
          />
          OpenRouter (Cloud)
        </label>
        <label className="radio-label">
          <input
            type="radio"
            name="provider"
            value="ollama"
            checked={provider === 'ollama'}
            onChange={(e) => setProvider(e.target.value)}
          />
          Ollama (Local)
        </label>
      </div>

      {provider === 'openrouter' ? (
        <div className="input-group">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Select OpenRouter Model:
          </p>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {openRouterModels.length === 0 && <option>Loading models...</option>}
            {openRouterModels.map(model => (
              <option key={model.id} value={model.id}>{model.name} ({model.id})</option>
            ))}
          </select>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            ✅ OpenRouter API Key is configured.
          </p>
        </div>
      ) : (
        <div className="input-group">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Select Local Model:
          </p>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {ollamaModels.length === 0 && <option>Loading models...</option>}
            {ollamaModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          {ollamaModels.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.5rem' }}>
              ⚠️ Could not find any Ollama models. Make sure Ollama is running!
            </p>
          )}
        </div>
      )}
    </div>
  )

  const renderBatchStatus = () => {
    if (!jobStatus) return null

    const { processed_items = 0, total_items = 0, status, files = [], error: jobError } = jobStatus
    const progressText = total_items ? `${processed_items}/${total_items}` : `${processed_items}`

    return (
      <div className="batch-status" style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <div className="status-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>Batch Status:</span>
          <span className={`status-chip ${status || ''}`} style={{ padding: '0.35rem 0.75rem', borderRadius: '999px', background: 'var(--muted)', textTransform: 'capitalize' }}>
            {status || 'processing'}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>Progress: {progressText}</span>
        </div>

        {jobError && (
          <div className="status error" style={{ marginTop: '0.75rem' }}>
            Batch error: {jobError}
          </div>
        )}

        <div className="file-list" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {files.length === 0 && (
            <p className="status" style={{ color: 'var(--text-secondary)' }}>
              Waiting for presentations to be generated...
            </p>
          )}
          {files.map((fileResult, idx) => (
            <div key={`${fileResult.word}-${idx}`} className="file-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{fileResult.word}</p>
                <p style={{ margin: '0.15rem 0', color: fileResult.status === 'success' ? 'var(--text-secondary)' : '#b91c1c' }}>
                  {fileResult.status === 'success' ? 'Ready to download' : 'Failed to generate'}
                </p>
                {fileResult.error_message && (
                  <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>{fileResult.error_message}</p>
                )}
              </div>
              {fileResult.status === 'success' && fileResult.download_url && (
                <a
                  href={`http://localhost:8000${fileResult.download_url}`}
                  download
                  className="download-link"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Download {fileResult.word}.pptx
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header>
        <h1>Spelling PowerPoint Generator</h1>
        <p className="subtitle">Turn your spelling lists into beautiful presentations in seconds.</p>
      </header>

      <div className="card">
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
          >
            Upload CSV
          </button>
          <button
            className={`tab-btn ${activeTab === 'word' ? 'active' : ''}`}
            onClick={() => setActiveTab('word')}
          >
            Single Word
          </button>
        </div>

        {activeTab === 'csv' ? (
          <div className="upload-section">
            {renderAISettings()}

            <label
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setFile(e.dataTransfer.files[0])
                }
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <div style={{ pointerEvents: 'none' }}>
                <span className="upload-icon">📄</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '500', color: 'var(--text-main)' }}>
                  {file ? file.name : "Click to upload or drag and drop CSV"}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Supported format: .csv
                </p>
              </div>
            </label>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <a
                href="/sample_spelling_data.csv"
                download
                className="download-link"
              >
                📥 Download Sample CSV
              </a>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button
                className="btn"
                onClick={handleUpload}
                disabled={!file || loading}
                style={{ maxWidth: '300px' }}
              >
                {loading ? 'Generating...' : 'Generate Presentation'}
              </button>
            </div>

            {renderBatchStatus()}
          </div>
        ) : (
          <form onSubmit={handleFormSubmit}>

            {renderAISettings()}

            <div className="input-group">
              <label>Word</label>
              <input
                type="text"
                name="word"
                value={formData.word}
                onChange={handleInputChange}
                required
                placeholder="e.g. Serendipity"
              />
            </div>

            {!isMagicReady() && (
              <>
                <div className="input-group">
                  <label>Definition</label>
                  <textarea
                    name="definition"
                    value={formData.definition}
                    onChange={handleInputChange}
                    required
                    style={{ minHeight: '80px' }}
                  />
                </div>
                <div className="input-group">
                  <label>Sentence</label>
                  <textarea
                    name="sentence"
                    value={formData.sentence}
                    onChange={handleInputChange}
                    required
                    style={{ minHeight: '80px' }}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className={`btn ${isMagicReady() ? 'btn-magic' : ''}`}
              disabled={loading}
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Generating...' : isMagicReady() ? '✨ Magic Generate' : 'Generate Presentation'}
            </button>
          </form>
        )}

        {message && (
          <div className="status">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="status error">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
