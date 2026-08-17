import React from 'react'

const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

export function journaliserErreurRenderer(source, error) {
  ipcRenderer?.send('systeme:journaliserErreur', {
    source,
    message: error?.message || String(error),
    stack: error?.stack || ''
  })
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { erreur: null }
  }

  static getDerivedStateFromError(erreur) {
    return { erreur }
  }

  componentDidCatch(erreur, infos) {
    journaliserErreurRenderer('react:componentDidCatch', erreur)
  }

  render() {
    if (this.state.erreur) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Une erreur est survenue</h2>
          <p>L'incident a été enregistré. Vous pouvez redémarrer Nafix.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
