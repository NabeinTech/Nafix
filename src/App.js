import React, { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ConfigProvider } from 'antd'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Produits from './pages/Produits'
import Clients from './pages/Clients'
import Factures from './pages/Factures'
import Ventes from './pages/Ventes'
import Devis from './pages/Devis'
import Comptabilite from './pages/Comptabilite'
import Statistiques from './pages/Statistiques'
import Parametres from './pages/Parametres'
import Login from './pages/Login'
import SetupWizard from './pages/SetupWizard'
import Categories from './pages/Categories'
import NafixAI from './pages/NafixAI'
import NafixVoice from './pages/NafixVoice'
import Fournisseurs from './pages/Fournisseurs'
import Commandes from './pages/Commandes'
import ComptesPrepayes from './pages/ComptesPrepayes'
import { peutAcceder } from './utils/permissions'
import 'antd/dist/reset.css'

const { Content } = Layout

// ✅ Route protégée par rôle
function RouteProtegee({ utilisateur, module, children }) {
  if (!peutAcceder(utilisateur?.role, module)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '60vh', color: '#888', textAlign: 'center'
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h2 style={{ color: '#333' }}>Accès refusé</h2>
        <p>Vous n'avez pas les droits pour accéder à cette page.</p>
        <p style={{ color: '#1890ff' }}>Contactez votre administrateur.</p>
      </div>
    )
  }
  return children
}

const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function App() {
  const [configStatus, setConfigStatus] = useState('verification') // verification | absente | ok
  const [utilisateur, setUtilisateur] = useState(() => {
    // Supprimer l'ancienne session persistante si elle existe
    localStorage.removeItem('nafix_session')
    try {
      const saved = sessionStorage.getItem('nafix_session')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [couleurTheme, setCouleurTheme] = useState(
    () => localStorage.getItem('nafix_couleur_theme') || '#1890ff'
  )

  useEffect(() => {
    const handler = (e) => {
      const couleur = e.detail?.couleur
      if (couleur) setCouleurTheme(couleur)
    }
    window.addEventListener('nafix-theme-change', handler)
    return () => window.removeEventListener('nafix-theme-change', handler)
  }, [])

  useEffect(() => {
    if (!ipcRenderer) { setConfigStatus('ok'); return }
    ipcRenderer.invoke('setup:status')
      .then(res => setConfigStatus(res.configured ? 'ok' : 'absente'))
      .catch(() => setConfigStatus('ok'))
  }, [])

  const handleLoginSuccess = (user) => {
    sessionStorage.setItem('nafix_session', JSON.stringify(user))
    setUtilisateur(user)
  }

  const handleLogout = () => {
    ipcRenderer?.invoke('auth:logout')
    sessionStorage.removeItem('nafix_session')
    setUtilisateur(null)
  }

  // ── Assistant de première configuration ──────────────────
  if (configStatus === 'verification') {
    return null
  }
  if (configStatus === 'absente') {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: couleurTheme } }}>
        <SetupWizard />
      </ConfigProvider>
    )
  }

  // ── Page Login si non connecté ───────────────────────────
  if (!utilisateur) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: couleurTheme } }}>
        <Login onLoginSuccess={handleLoginSuccess} />
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: couleurTheme } }}>
    <HashRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar
          utilisateur={utilisateur}
          onLogout={handleLogout}
        />
        <Layout>
          <Content style={{ margin: '24px' }}>
            <Routes>

              {/* ── Dashboard ── */}
              <Route path="/" element={
                <Dashboard utilisateur={utilisateur} />
              } />

              {/* ── Ventes ── */}
              <Route path="/ventes" element={
                <RouteProtegee utilisateur={utilisateur} module="/ventes">
                  <Ventes utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Devis ── */}
              <Route path="/devis" element={
                <RouteProtegee utilisateur={utilisateur} module="/devis">
                  <Devis utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Factures ── */}
              <Route path="/factures" element={
                <RouteProtegee utilisateur={utilisateur} module="/factures">
                  <Factures utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Clients ── */}
              <Route path="/clients" element={
                <RouteProtegee utilisateur={utilisateur} module="/clients">
                  <Clients utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Produits ── */}
              <Route path="/produits" element={
                <RouteProtegee utilisateur={utilisateur} module="/produits">
                  <Produits utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Comptabilité ── */}
              <Route path="/comptabilite" element={
                <RouteProtegee utilisateur={utilisateur} module="/comptabilite">
                  <Comptabilite utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Statistiques ── */}
              <Route path="/statistiques" element={
                <RouteProtegee utilisateur={utilisateur} module="/statistiques">
                  <Statistiques utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Catégories ── */}
              <Route path="/categories" element={
                <RouteProtegee utilisateur={utilisateur} module="/categories">
                  <Categories utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Fournisseurs ── */}
              <Route path="/fournisseurs" element={
                <RouteProtegee utilisateur={utilisateur} module="/fournisseurs">
                  <Fournisseurs utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Commandes Intelligentes ── */}
              <Route path="/commandes" element={
                <RouteProtegee utilisateur={utilisateur} module="/commandes">
                  <Commandes utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Comptes Prépayés ── */}
              <Route path="/comptes-prepayes" element={
                <RouteProtegee utilisateur={utilisateur} module="/comptes-prepayes">
                  <ComptesPrepayes utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Nafix AI ── */}
              <Route path="/ai" element={
                <RouteProtegee utilisateur={utilisateur} module="/ai">
                  <NafixAI utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Nafix Voice ── */}
              <Route path="/voice" element={
                <RouteProtegee utilisateur={utilisateur} module="/voice">
                  <NafixVoice utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Paramètres ── */}
              <Route path="/parametres" element={
                <RouteProtegee utilisateur={utilisateur} module="/parametres">
                  <Parametres utilisateur={utilisateur} />
                </RouteProtegee>
              } />

              {/* ── Redirection par défaut ── */}
              <Route path="*" element={<Navigate to="/" />} />

            </Routes>
          </Content>
        </Layout>
      </Layout>
    </HashRouter>
    </ConfigProvider>
  )
}

export default App