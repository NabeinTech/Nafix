import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Typography, Button, Card, Table, InputNumber, Space, Tag,
  Alert, Input, Select, message, Empty, Switch
} from 'antd'
import {
  DeleteOutlined,
  CheckOutlined, CloseOutlined, SoundOutlined, SendOutlined,
  FileDoneOutlined, AudioOutlined, AudioMutedOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import NouveauClientModal from '../components/NouveauClientModal'
import NouveauProduitRapideModal from '../components/NouveauProduitRapideModal'
import { analyserCommande, etatInitial } from '../utils/voiceCommandParser'
import { demarrerCaptureAudio } from '../utils/voiceAudioCapture'

const { Title, Text } = Typography
const { Option } = Select
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function NafixVoice() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [domaineActive, setDomaineActive] = useState(null)

  const [saisieManuelle, setSaisieManuelle] = useState('')
  // Activée par défaut — un dialogue se joue dans les deux sens, pas
  // seulement en tapant/parlant vers Nafix.
  const [lireReponses, setLireReponses] = useState(true)
  const [ecoute, setEcoute] = useState(false)
  const [partiel, setPartiel] = useState('')
  const [erreurMicro, setErreurMicro] = useState(null)
  const arreterCaptureRef = useRef(null)

  const [historique, setHistorique] = useState([
    { role: 'nafix', texte: '🎙️ Cliquez sur le micro et parlez, ou tapez votre commande. Essayez : « Fais un devis pour Oumar avec 10 sacs de ciment à 6500 francs. »' }
  ])
  const [etat, setEtat] = useState(etatInitial())
  const [devisGenere, setDevisGenere] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)

  const [produitModalVisible, setProduitModalVisible] = useState(false)
  const [produitCibleIndex, setProduitCibleIndex] = useState(null)
  const [clientModalVisible, setClientModalVisible] = useState(false)

  // ── Chargement des données de référence ─────────────────────
  const chargerTout = useCallback(async () => {
    if (!ipcRenderer) return
    const [cl, pr, dom, cat] = await Promise.all([
      ipcRenderer.invoke('clients:getAll'),
      ipcRenderer.invoke('produits:getAll'),
      ipcRenderer.invoke('domaine:get'),
      ipcRenderer.invoke('categories:getAll')
    ])
    setClients(cl || [])
    setProduits(pr || [])
    if (dom?.type) setDomaineActive(dom.type)
    setCategories(cat || [])
  }, [])

  useEffect(() => { chargerTout() }, [chargerTout])

  const categoriesDomaineActif = useMemo(
    () => (!domaineActive || domaineActive === 'general')
      ? categories
      : categories.filter(c => c.domaine === domaineActive),
    [categories, domaineActive]
  )

  // ── Synthèse vocale ──────────────────────────────────────────
  const parler = useCallback((texte) => {
    if (!lireReponses || typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      const u = new window.SpeechSynthesisUtterance(texte)
      u.lang = 'fr-FR'
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch { /* synthèse vocale non disponible — silencieux */ }
  }, [lireReponses])

  // ── Traitement d'un énoncé (vocal ou tapé) ──────────────────
  const traiterEnonce = useCallback((texte) => {
    if (!texte?.trim()) return
    setHistorique(prev => [...prev, { role: 'utilisateur', texte }])
    setEtat(etatPrecedent => {
      const { etat: nouvelEtat, messages } = analyserCommande(texte, etatPrecedent, { clients, produits })
      const reponse = messages.join(' ')
      setHistorique(prev => [...prev, { role: 'nafix', texte: reponse }])
      parler(reponse)
      return nouvelEtat
    })
  }, [clients, produits, parler])

  const envoyerSaisieManuelle = () => {
    traiterEnonce(saisieManuelle)
    setSaisieManuelle('')
  }

  // ── Résultats de reconnaissance vocale (Vosk, processus principal) ──
  // Important : Vosk détecte des micro-pauses (hésitation, respiration) bien
  // avant que l'utilisateur ait fini sa phrase, et renvoie un résultat
  // "final" à chaque fois — on ne doit surtout pas répondre à ce moment-là.
  // On accumule donc tous les segments reconnus pendant l'écoute, et on ne
  // traite (et ne répond) qu'une fois que l'utilisateur clique pour arrêter
  // le micro — Nafix écoute vraiment jusqu'au bout avant de répondre.
  const accumulRef = useRef('')

  useEffect(() => {
    if (!ipcRenderer) return
    const handler = (_, resultat) => {
      if (!resultat) return
      if (resultat.erreur) { setErreurMicro(resultat.erreur); return }
      if (resultat.final) {
        if (resultat.texte?.trim()) {
          accumulRef.current = (accumulRef.current + ' ' + resultat.texte).trim()
        }
        setPartiel(accumulRef.current)
      } else {
        setPartiel((accumulRef.current + ' ' + (resultat.texte || '')).trim())
      }
    }
    ipcRenderer.on('voice:resultat', handler)
    return () => ipcRenderer.removeListener('voice:resultat', handler)
  }, [])

  const basculerEcoute = async () => {
    if (!ipcRenderer) return
    if (ecoute) {
      arreterCaptureRef.current?.()
      arreterCaptureRef.current = null
      const { texte } = await ipcRenderer.invoke('voice:arreter')
      const texteComplet = (accumulRef.current + ' ' + (texte || '')).trim()
      accumulRef.current = ''
      setPartiel('')
      setEcoute(false)
      if (texteComplet) traiterEnonce(texteComplet)
      return
    }
    setErreurMicro(null)
    accumulRef.current = ''
    const demarrage = await ipcRenderer.invoke('voice:demarrer')
    if (demarrage?.erreur) { setErreurMicro(demarrage.erreur); return }
    const arreterCapture = await demarrerCaptureAudio(
      (chunkInt16) => ipcRenderer.send('voice:audio', chunkInt16.buffer),
      (err) => setErreurMicro(err?.message?.includes('Permission')
        ? "Accès au microphone refusé — autorisez-le dans les paramètres de Windows."
        : `Erreur micro : ${err?.message || err}`)
    )
    arreterCaptureRef.current = arreterCapture
    setEcoute(true)
  }

  useEffect(() => () => { arreterCaptureRef.current?.() }, [])

  // ── Résolution manuelle des ambiguïtés / éléments introuvables ──
  const choisirProduitPourItem = (index, produit) => {
    setEtat(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === index
        ? { ...it, produitMatch: produit, ambigu: false }
        : it)
    }))
  }

  const choisirClient = (client) => {
    setEtat(prev => ({ ...prev, clientMatch: client, clientAmbigu: false, clientAlternatives: [] }))
  }

  const supprimerItem = (index) => {
    setEtat(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const majItem = (index, champ, valeur) => {
    setEtat(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === index ? { ...it, [champ]: valeur } : it)
    }))
  }

  // ── Totaux (calculés en code, jamais par le texte de l'IA) ──
  const sousTotal = useMemo(
    () => etat.items.reduce((s, it) => s + (it.quantite || 0) * (it.prixUnitaire || 0), 0),
    [etat.items]
  )
  const remiseMontant = useMemo(
    () => Math.round(sousTotal * (etat.remisePourcent || 0) / 100),
    [sousTotal, etat.remisePourcent]
  )
  const totalFinal = sousTotal - remiseMontant

  const tousItemsResolus = etat.items.length > 0 && etat.items.every(it => it.produitMatch && !it.ambigu)
  const clientResolu = !etat.clientAmbigu

  // ── Génération du devis — réutilise exactement le moteur existant ──
  const genererDevis = async () => {
    if (!ipcRenderer) return
    if (!tousItemsResolus) { message.error('Résolvez tous les produits avant de générer le devis.'); return }
    if (!clientResolu) { message.error('Choisissez le bon client avant de générer le devis.'); return }
    if (etat.items.length === 0) { message.error('Ajoutez au moins un article.'); return }

    setEnregistrement(true)
    try {
      const panier = etat.items.map(it => ({
        produit_id: it.produitMatch.id,
        nom: it.produitMatch.nom,
        unite: it.produitMatch.unite || 'pièce',
        quantite: it.quantite,
        prix_unitaire: it.prixUnitaire,
        prix_catalogue: it.produitMatch.prix_vente,
        total: it.quantite * it.prixUnitaire
      }))
      const notes = etat.remisePourcent > 0
        ? `[Créé par commande vocale] Remise appliquée : ${etat.remisePourcent}% (-${remiseMontant.toLocaleString('fr-FR')} FCFA)`
        : '[Créé par commande vocale]'

      const result = await ipcRenderer.invoke('devis:create', {
        client_id: etat.clientMatch?.id || null,
        validite: 30,
        notes,
        montant_total: totalFinal,
        panier: JSON.stringify(panier),
        statut: 'en_attente'
      })
      if (result?.erreur) { message.error(result.erreur); return }

      const nomClient = etat.clientMatch?.nom || etat.clientTexte || 'Client anonyme'
      setDevisGenere({ ...result, client_nom: nomClient })
      const succes = `Devis créé pour ${nomClient} — total ${totalFinal.toLocaleString('fr-FR')} FCFA.`
      setHistorique(prev => [...prev, { role: 'nafix', texte: `✅ ${succes}` }])
      parler(succes)
      message.success('✅ Devis créé avec succès !')
    } finally {
      setEnregistrement(false)
    }
  }

  const nouvelleCommande = () => {
    setEtat(etatInitial())
    setDevisGenere(null)
    setHistorique([{ role: 'nafix', texte: '🎙️ Prêt pour une nouvelle commande. Je vous écoute.' }])
  }

  // ── Colonnes du panier prévisualisé ──────────────────────────
  const colonnes = [
    {
      title: 'Produit', key: 'produit',
      render: (_, it, index) => {
        if (it.produitMatch && !it.ambigu) {
          return <Text strong>{it.produitMatch.nom}</Text>
        }
        return (
          <div>
            <Tag color={it.ambigu ? 'orange' : 'red'}>
              {it.ambigu ? 'Ambigu' : 'Introuvable'} : « {it.texteBrut} »
            </Tag>
            {it.ambigu && (
              <div style={{ marginTop: 6 }}>
                <Space wrap size={4}>
                  {it.alternatives.map(alt => (
                    <Button key={alt.id} size="small" onClick={() => choisirProduitPourItem(index, alt)}>
                      {alt.nom}
                    </Button>
                  ))}
                </Space>
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              <Space size={4}>
                <Select
                  size="small" showSearch placeholder="Choisir un produit existant"
                  style={{ width: 220 }}
                  optionFilterProp="children"
                  onChange={(id) => choisirProduitPourItem(index, produits.find(p => p.id === id))}
                >
                  {produits.map(p => (
                    <Option key={p.id} value={p.id}>{p.nom} — {p.prix_vente?.toLocaleString()} FCFA</Option>
                  ))}
                </Select>
                <Button size="small" type="dashed"
                  onClick={() => { setProduitCibleIndex(index); setProduitModalVisible(true) }}>
                  + Créer "{it.texteBrut}"
                </Button>
              </Space>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Qté', key: 'quantite', width: 90,
      render: (_, it, index) => (
        <InputNumber size="small" min={0.01} value={it.quantite}
          onChange={v => majItem(index, 'quantite', v || 0)} style={{ width: 70 }} />
      )
    },
    {
      title: 'Prix U.', key: 'prix', width: 130,
      render: (_, it, index) => (
        <InputNumber size="small" min={0} value={it.prixUnitaire}
          onChange={v => majItem(index, 'prixUnitaire', v || 0)} style={{ width: 110 }} />
      )
    },
    {
      title: 'Total', key: 'total', width: 110,
      render: (_, it) => <Text strong>{((it.quantite || 0) * (it.prixUnitaire || 0)).toLocaleString('fr-FR')} F</Text>
    },
    {
      title: '', key: 'action', width: 40,
      render: (_, it, index) => (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => supprimerItem(index)} />
      )
    }
  ]

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>🎙️ Nafix Voice</Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Le copilote commercial qui travaille avec votre voix — créez un devis en parlant
          </Text>
        </div>
        <Space>
          <SoundOutlined style={{ color: 'white' }} />
          <Switch checked={lireReponses} onChange={setLireReponses}
            checkedChildren="Réponses lues" unCheckedChildren="Silencieux" />
        </Space>
      </div>

      {erreurMicro && (
        <Alert type="error" showIcon closable style={{ marginBottom: 16, borderRadius: 8 }}
          message={erreurMicro} onClose={() => setErreurMicro(null)} />
      )}

      <div style={{ display: 'flex', gap: 20 }}>
        {/* ── Colonne gauche : conversation ── */}
        <Card style={{ flex: 1, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 16 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px 0', marginBottom: 16
          }}>
            <Button
              shape="circle" size="large"
              icon={ecoute ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={basculerEcoute}
              style={{
                width: 88, height: 88, fontSize: 32,
                background: ecoute ? 'linear-gradient(135deg,#ff4d4f,#cf1322)' : 'linear-gradient(135deg,#722ed1,#1890ff)',
                border: 'none', color: 'white',
                boxShadow: ecoute ? '0 0 0 8px rgba(255,77,79,0.15)' : '0 4px 16px rgba(114,46,209,0.3)',
                transition: 'all 0.2s'
              }}
            />
            <Text style={{ marginTop: 12, color: '#8c8c8c' }}>
              {ecoute ? 'Nafix vous écoute… (cliquez pour arrêter)' : 'Cliquez pour parler, ou tapez ci-dessous'}
            </Text>
            {partiel && <Text italic style={{ marginTop: 6, color: '#722ed1' }}>« {partiel}… »</Text>}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12, padding: '0 4px' }}>
            {historique.map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: h.role === 'utilisateur' ? 'flex-end' : 'flex-start',
                marginBottom: 8
              }}>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                  background: h.role === 'utilisateur' ? '#722ed1' : '#f0f0f0',
                  color: h.role === 'utilisateur' ? 'white' : '#333', fontSize: 13
                }}>
                  {h.texte}
                </div>
              </div>
            ))}
          </div>

          <Space.Compact block>
            <Input
              placeholder="Ou tapez votre commande ici..."
              value={saisieManuelle}
              onChange={e => setSaisieManuelle(e.target.value)}
              onPressEnter={envoyerSaisieManuelle}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={envoyerSaisieManuelle} />
          </Space.Compact>
        </Card>

        {/* ── Colonne droite : aperçu structuré du devis ── */}
        <Card style={{ flex: 1, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          title="📋 Aperçu du devis" bodyStyle={{ padding: 16 }}>
          {devisGenere ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <FileDoneOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
              <Title level={4}>Devis créé avec succès !</Title>
              <Text type="secondary">
                {devisGenere.client_nom} — {totalFinal.toLocaleString('fr-FR')} FCFA
              </Text>
              <div style={{ marginTop: 20 }}>
                <Space>
                  <Button type="primary" onClick={() => navigate('/devis')}>Voir dans Devis</Button>
                  <Button onClick={nouvelleCommande}>Nouvelle commande vocale</Button>
                </Space>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Client</Text>
                {etat.clientAmbigu ? (
                  <Space wrap size={4}>
                    {etat.clientAlternatives.map(c => (
                      <Button key={c.id} size="small" onClick={() => choisirClient(c)}>{c.nom}</Button>
                    ))}
                  </Space>
                ) : etat.clientMatch ? (
                  <Tag color="purple">{etat.clientMatch.nom}</Tag>
                ) : etat.clientTexte ? (
                  <Space size={4}>
                    <Tag>{etat.clientTexte} (nouveau)</Tag>
                    <Button size="small" type="dashed" onClick={() => setClientModalVisible(true)}>
                      + Créer ce client
                    </Button>
                  </Space>
                ) : (
                  <Text type="secondary" italic>Aucun client précisé (facultatif)</Text>
                )}
              </div>

              {etat.items.length === 0 ? (
                <Empty description="Aucun article pour l'instant" style={{ margin: '30px 0' }} />
              ) : (
                <Table
                  dataSource={etat.items.map((it, i) => ({ ...it, key: i }))}
                  columns={colonnes}
                  pagination={false} size="small" style={{ marginBottom: 12 }}
                />
              )}

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>Sous-total</Text>
                  <Text>{sousTotal.toLocaleString('fr-FR')} FCFA</Text>
                </div>
                {etat.remisePourcent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#fa8c16' }}>
                    <Text>Remise ({etat.remisePourcent}%)</Text>
                    <Text>-{remiseMontant.toLocaleString('fr-FR')} FCFA</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold' }}>
                  <Text strong>Total</Text>
                  <Text strong style={{ color: '#722ed1' }}>{totalFinal.toLocaleString('fr-FR')} FCFA</Text>
                </div>
              </div>

              <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button icon={<CloseOutlined />} onClick={nouvelleCommande}>Annuler</Button>
                <Button type="primary" icon={<CheckOutlined />} loading={enregistrement}
                  disabled={etat.items.length === 0 || !tousItemsResolus || !clientResolu}
                  onClick={genererDevis}
                  style={{ background: 'linear-gradient(135deg,#722ed1,#1890ff)', border: 'none' }}>
                  Générer le devis
                </Button>
              </Space>
            </>
          )}
        </Card>
      </div>

      <NouveauProduitRapideModal
        visible={produitModalVisible}
        onClose={() => setProduitModalVisible(false)}
        nomInitial={produitCibleIndex !== null ? etat.items[produitCibleIndex]?.texteBrut : ''}
        categoriesDomaine={categoriesDomaineActif}
        quantiteInitiale={produitCibleIndex !== null ? etat.items[produitCibleIndex]?.quantite : 1}
        onSuccess={async (nouveauProduit) => {
          const pr = await ipcRenderer.invoke('produits:getAll')
          setProduits(pr || [])
          if (produitCibleIndex !== null) choisirProduitPourItem(produitCibleIndex, nouveauProduit)
          setProduitModalVisible(false)
        }}
      />

      <NouveauClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSuccess={async (result) => {
          const cl = await ipcRenderer.invoke('clients:getAll')
          setClients(cl || [])
          if (result?.succes) choisirClient(result.succes)
        }}
      />
    </div>
  )
}

export default NafixVoice
