import React, { useState, useEffect, useCallback } from 'react'
import {
  Typography, Card, Form, Input, Button, message,
  Row, Col, Avatar, Tabs, Table, Modal, Select,
  Space, Popconfirm, Tag, Alert, Divider, Badge, Statistic, Spin, Progress, Tooltip
} from 'antd'
import {
  UserAddOutlined, DeleteOutlined, KeyOutlined,
  UserOutlined, GlobalOutlined, SaveOutlined,
  ShopOutlined, TeamOutlined, PhoneOutlined,
  MailOutlined, EnvironmentOutlined, RobotOutlined,
  UploadOutlined, PictureOutlined, DatabaseOutlined,
  ReloadOutlined, CheckCircleOutlined, TableOutlined,
  BgColorsOutlined, CheckOutlined, EditOutlined,
  CloseOutlined, LockOutlined, WarningOutlined,
  ExclamationCircleOutlined, CloudDownloadOutlined
} from '@ant-design/icons'
import { getTousDomaines, getDomaine } from '../utils/domainConfig'
import { PERMISSIONS_DEFAUT_PAR_ROLE } from '../utils/permissions'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function Parametres({ utilisateur }) {
  const [formEntreprise] = Form.useForm()
  const [formUser] = Form.useForm()
  const [formPassword] = Form.useForm()

  const [parametres, setParametres] = useState({})
  const [utilisateurs, setUtilisateurs] = useState([])
  const [domaine, setDomaine] = useState(null)
  const [domaineLoading, setDomaineLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [userModalVisible, setUserModalVisible] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [userSelectionne, setUserSelectionne] = useState(null)
  const [roleChoisi, setRoleChoisi] = useState(null)
  const [permissionsEditees, setPermissionsEditees] = useState(null)
  const [savePermsLoading, setSavePermsLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [dbLoading, setDbLoading] = useState(false)
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetOptions, setResetOptions] = useState({
    ventes: true, tresorerie: true, clients: true,
    produits: true, fournisseurs: true, retours: true, commandes: true
  })
  const [couleurTheme, setCouleurTheme] = useState(
    () => localStorage.getItem('nafix_couleur_theme') || '#1890ff'
  )
  const [couleurPersonnalisee, setCouleurPersonnalisee] = useState('')
  const [themeLoading, setThemeLoading] = useState(false)

  // ── Chargement ──────────────────────────────────────────
  const chargerParametres = useCallback(async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('parametres:get') || {}
    setParametres(data)
    formEntreprise.setFieldsValue({
      ...data,
      activites: data.activites ? JSON.parse(data.activites) : [],
      sous_activites: data.sous_activites ? JSON.parse(data.sous_activites) : []
    })
    setLogoPreview(data.logo_base64 || null)
    if (data.couleur_theme) {
      setCouleurTheme(data.couleur_theme)
      localStorage.setItem('nafix_couleur_theme', data.couleur_theme)
      window.dispatchEvent(new CustomEvent('nafix-theme-change', { detail: { couleur: data.couleur_theme } }))
    }
  }, [formEntreprise])

  const chargerUtilisateurs = useCallback(async () => {
    if (!ipcRenderer) return
    setUtilisateurs(await ipcRenderer.invoke('utilisateurs:getAll') || [])
  }, [])

  const chargerDomaine = useCallback(async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    setDomaine(data?.type || null)
  }, [])

  useEffect(() => {
    chargerParametres()
    chargerUtilisateurs()
    chargerDomaine()
  }, [chargerParametres, chargerUtilisateurs, chargerDomaine])

  // ── Sauvegarder entreprise ───────────────────────────────
  const sauvegarderEntreprise = async (values) => {
    if (!ipcRenderer) return
    setSaveLoading(true)
    try {
      const payload = {
        ...values,
        logo_base64: logoPreview,
        activites: JSON.stringify(values.activites || []),
        sous_activites: JSON.stringify(values.sous_activites || [])
      }
      await ipcRenderer.invoke('parametres:save', payload)
      setParametres(payload)
      message.success('✅ Paramètres sauvegardés !')
    } catch (e) {
      message.error('❌ Erreur lors de la sauvegarde')
    }
    setSaveLoading(false)
  }

  // ── Logo ─────────────────────────────────────────────────
  const importerLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      message.error('❌ Logo trop lourd ! Maximum 2MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      message.error('❌ Fichier invalide ! PNG, JPG ou SVG uniquement')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target.result
      setLogoPreview(base64)
      const params = await ipcRenderer.invoke('parametres:get') || {}
      await ipcRenderer.invoke('parametres:save', { ...params, logo_base64: base64 })
      message.success('✅ Logo importé et sauvegardé !')
    }
    reader.readAsDataURL(file)
  }

  const supprimerLogo = async () => {
    setLogoPreview(null)
    const params = await ipcRenderer.invoke('parametres:get') || {}
    await ipcRenderer.invoke('parametres:save', { ...params, logo_base64: null })
    message.success('✅ Logo supprimé !')
  }

  // ── Domaine ──────────────────────────────────────────────
  const sauvegarderDomaine = async (type) => {
    if (!ipcRenderer) return
    setDomaineLoading(true)
    const noms = {
      informatique:  'Informatique & Électroménager',
      alimentaire:   'Alimentaire & Épicerie',
      restauration:  'Restauration & Café',
      quincaillerie: 'Quincaillerie & Matériaux',
      btp:           'BTP & Construction',
      textile:       'Textile & Prêt-à-porter',
      general:       'Commerce Général'
    }
    await ipcRenderer.invoke('domaine:save', { type, nom: noms[type] })
    setDomaine(type)
    message.success(`✅ Domaine changé : ${noms[type]} ! Catégories installées.`)
    setDomaineLoading(false)
  }

  // ── Utilisateurs ─────────────────────────────────────────
  const ajouterUtilisateur = async (values) => {
    if (!ipcRenderer) return
    const { confirm: _, ...payload } = values
    try {
      const result = await ipcRenderer.invoke('utilisateurs:create', payload)
      if (result?.erreur) { message.error(`❌ ${result.erreur}`); return }
      message.success('✅ Utilisateur ajouté !')
      formUser.resetFields()
      setUserModalVisible(false)
      chargerUtilisateurs()
    } catch (err) {
      message.error(`❌ ${err.message}`)
    }
  }

  const supprimerUtilisateur = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('utilisateurs:delete', id)
    message.success('✅ Utilisateur supprimé !')
    chargerUtilisateurs()
  }

  const ouvrirRoleModal = (record) => {
    setUserSelectionne(record)
    setRoleChoisi(record.role)
    // Initialiser les permissions depuis les custom existantes, sinon depuis le rôle
    const permsInit = record.permissions_custom
      ? (typeof record.permissions_custom === 'string'
          ? JSON.parse(record.permissions_custom)
          : record.permissions_custom)
      : JSON.parse(JSON.stringify(PERMISSIONS_DEFAUT_PAR_ROLE[record.role] || PERMISSIONS_DEFAUT_PAR_ROLE.caissier))
    setPermissionsEditees(permsInit)
    setRoleModalVisible(true)
  }

  const onRoleChange = (nouveauRole) => {
    setRoleChoisi(nouveauRole)
    // Réinitialiser les permissions aux defaults du nouveau rôle
    setPermissionsEditees(JSON.parse(JSON.stringify(PERMISSIONS_DEFAUT_PAR_ROLE[nouveauRole] || PERMISSIONS_DEFAUT_PAR_ROLE.caissier)))
  }

  const togglePermission = (module, action) => {
    setPermissionsEditees(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }))
  }

  const appliquerRole = async () => {
    if (!ipcRenderer || !userSelectionne || !roleChoisi) return
    // Sauvegarder le rôle
    const resultRole = await ipcRenderer.invoke('utilisateurs:updateRole', {
      id: userSelectionne.id, role: roleChoisi
    })
    if (resultRole?.erreur) { message.error(`❌ ${resultRole.erreur}`); return }

    // Sauvegarder les permissions custom
    setSavePermsLoading(true)
    await ipcRenderer.invoke('utilisateurs:updatePermissions', {
      id: userSelectionne.id, permissions: permissionsEditees
    })
    setSavePermsLoading(false)

    message.success(`✅ Rôle et permissions mis à jour pour ${userSelectionne.nom}`)
    setRoleModalVisible(false)
    chargerUtilisateurs()
  }

  const changerMotDePasse = async (values) => {
    if (!ipcRenderer || !userSelectionne) return
    await ipcRenderer.invoke('utilisateurs:updatePassword', {
      id: userSelectionne.id, password: values.password
    })
    message.success('✅ Mot de passe modifié !')
    formPassword.resetFields()
    setPasswordModalVisible(false)
  }

  // ── Thème ────────────────────────────────────────────────
  const appliquerTheme = async (couleur) => {
    if (!couleur || !/^#[0-9a-fA-F]{6}$/.test(couleur)) {
      message.error('❌ Couleur invalide ! Format attendu : #RRGGBB')
      return
    }
    setThemeLoading(true)
    localStorage.setItem('nafix_couleur_theme', couleur)
    setCouleurTheme(couleur)
    window.dispatchEvent(new CustomEvent('nafix-theme-change', { detail: { couleur } }))
    if (ipcRenderer) {
      const params = await ipcRenderer.invoke('parametres:get') || {}
      await ipcRenderer.invoke('parametres:save', { ...params, couleur_theme: couleur })
    }
    message.success('✅ Thème appliqué avec succès !')
    setThemeLoading(false)
  }

  // ── Réinitialisation données ──────────────────────────────
  const executerReinitialisation = async () => {
    if (!ipcRenderer) return
    setResetLoading(true)
    try {
      const result = await ipcRenderer.invoke('db:reinitialiser', resetOptions)
      if (result?.succes) {
        message.success('✅ Données réinitialisées avec succès ! L\'application va se recharger.')
        setResetModalVisible(false)
        setResetConfirmText('')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        message.error('❌ Erreur lors de la réinitialisation')
      }
    } catch (e) {
      message.error(`❌ Erreur : ${e.message}`)
    }
    setResetLoading(false)
  }

  // ── Stats DB ─────────────────────────────────────────────
  const chargerDbStats = useCallback(async () => {
    if (!ipcRenderer) return
    setDbLoading(true)
    try {
      const data = await ipcRenderer.invoke('db:getStats')
      setDbStats(data)
    } catch (e) {
      message.error('❌ Impossible de charger les stats de la base')
    }
    setDbLoading(false)
  }, [])

  // ── Sauvegarde complète (dump base + config, en .zip) ─────
  const exporterSauvegarde = async () => {
    if (!ipcRenderer) return
    setSauvegardeEnCours(true)
    try {
      const resultat = await ipcRenderer.invoke('parametres:exporterSauvegarde')
      if (resultat?.annule) return
      if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
      message.success('✅ Sauvegarde complète enregistrée !')
    } finally {
      setSauvegardeEnCours(false)
    }
  }

  // ── Config rôles ─────────────────────────────────────────
  const roleConfig = {
    administrateur: { color: 'red',    label: '👑 Administrateur' },
    gerant:         { color: 'blue',   label: '🏢 Gérant' },
    comptable:      { color: 'green',  label: '📊 Comptable' },
    caissier:       { color: 'orange', label: '🛒 Caissier' }
  }

  const colonnesUsers = [
    {
      title: 'Utilisateur', dataIndex: 'nom', key: 'nom',
      render: (val, record) => (
        <Space>
          <Avatar size={36} icon={<UserOutlined />}
            style={{ background: 'linear-gradient(135deg, #1890ff, #722ed1)' }} />
          <div>
            <Text strong style={{ display: 'block' }}>{val}</Text>
            <Text style={{ color: '#888', fontSize: 12 }}>@{record.username}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Rôle', dataIndex: 'role', key: 'role',
      render: (role) => {
        const cfg = roleConfig[role]
        return <Tag color={cfg?.color || 'default'} style={{ borderRadius: 12 }}>
          {cfg?.label || role}
        </Tag>
      }
    },
    {
      title: 'Actions', key: 'actions', width: 260,
      render: (_, record) => (
        <Space wrap>
          {record.username !== 'admin' && (
            <Button icon={<EditOutlined />} size="small"
              style={{ borderRadius: 6, borderColor: '#722ed1', color: '#722ed1' }}
              onClick={() => ouvrirRoleModal(record)}>
              Rôle
            </Button>
          )}
          <Button icon={<KeyOutlined />} size="small" style={{ borderRadius: 6 }}
            onClick={() => { setUserSelectionne(record); setPasswordModalVisible(true) }}>
            Mot de passe
          </Button>
          {record.username !== 'admin' && (
            <Popconfirm title="Supprimer cet utilisateur ?"
              description="Cette action est irréversible."
              okText="Supprimer" okType="danger" cancelText="Annuler"
              onConfirm={() => supprimerUtilisateur(record.id)}>
              <Button danger icon={<DeleteOutlined />} size="small" style={{ borderRadius: 6 }} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]


  // ════════════════════════════════════════════════════════
  // ONGLET ENTREPRISE
  // ════════════════════════════════════════════════════════
  const tabEntreprise = (
    <div>
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Form form={formEntreprise} layout="vertical" onFinish={sauvegarderEntreprise}>

          {/* ── Zone Logo ── */}
          <div style={{
            background: '#f8faff',
            border: '2px dashed #d6e4ff',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            marginBottom: 28
          }}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#1890ff', fontSize: 14 }}>
              🖼️ Logo de l'entreprise
            </Text>

            {logoPreview ? (
              <div>
                <img src={logoPreview} alt="Logo"
                  style={{
                    maxHeight: 100, maxWidth: 280,
                    objectFit: 'contain', borderRadius: 8,
                    border: '1px solid #d6e4ff', padding: 8,
                    background: 'white', display: 'block',
                    margin: '0 auto 16px'
                  }}
                />
                <Space>
                  <Button icon={<UploadOutlined />} size="small"
                    style={{ borderRadius: 8 }}
                    onClick={() => document.getElementById('logo-upload').click()}>
                    Changer le logo
                  </Button>
                  <Button danger size="small" style={{ borderRadius: 8 }}
                    onClick={supprimerLogo}>
                    Supprimer
                  </Button>
                </Space>
              </div>
            ) : (
              <div>
                <PictureOutlined style={{ fontSize: 48, color: '#c5d8ff', marginBottom: 8 }} />
                <Text style={{ display: 'block', color: '#888', marginBottom: 12, fontSize: 13 }}>
                  PNG, JPG ou SVG — Max 2MB
                </Text>
                <Button icon={<UploadOutlined />} type="primary"
                  style={{ borderRadius: 8 }}
                  onClick={() => document.getElementById('logo-upload').click()}>
                  Importer un logo
                </Button>
              </div>
            )}

            {/* Input file caché */}
            <input id="logo-upload" type="file" accept="image/*"
              style={{ display: 'none' }} onChange={importerLogo} />
          </div>

          <Row gutter={24}>
            {/* ── Colonne gauche ── */}
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <Text style={{
                  color: '#1890ff', fontWeight: 700, fontSize: 12,
                  textTransform: 'uppercase', letterSpacing: 1
                }}>
                  🏢 Informations Générales
                </Text>
                <Divider style={{ margin: '8px 0' }} />
              </div>

              <Form.Item name="nom_entreprise" label="Nom de l'entreprise"
                rules={[{ required: true, message: 'Obligatoire' }]}>
                <Input prefix={<ShopOutlined style={{ color: '#1890ff' }} />}
                  placeholder="Ex: Nafimax Store SARL" size="large" />
              </Form.Item>

              <Form.Item name="slogan" label="Slogan / Description">
                <Input placeholder="Ex: Votre partenaire tech en Afrique"
                  size="large" />
              </Form.Item>

              <Form.Item name="ninea" label="NINEA / N° Identification">
                <Input placeholder="Ex: 12345678901" size="large" />
              </Form.Item>

              <Form.Item name="registre_commerce" label="Registre de Commerce (RC)">
                <Input placeholder="Ex: SN-DKR-2024-B-12345" size="large" />
              </Form.Item>

              <Form.Item
                name="activites"
                label={
                  <Tooltip title="Tapez une activité et appuyez sur Entrée pour l'ajouter">
                    Domaines d'activités <span style={{ color: '#888', fontSize: 11 }}>(appuyez Entrée pour ajouter)</span>
                  </Tooltip>
                }
              >
                <Select
                  mode="tags"
                  size="large"
                  placeholder="Ex: Commerce de gros, Importation..."
                  tokenSeparators={[',']}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="sous_activites"
                label={
                  <Tooltip title="Tapez une sous-activité et appuyez sur Entrée pour l'ajouter">
                    Sous-domaines d'activités <span style={{ color: '#888', fontSize: 11 }}>(optionnel)</span>
                  </Tooltip>
                }
              >
                <Select
                  mode="tags"
                  size="large"
                  placeholder="Ex: Téléphonie mobile, Accessoires, Réparation..."
                  tokenSeparators={[',']}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item name="adresse" label="Adresse complète">
                <Input prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
                  placeholder="Ex: Rue 10, Pikine, Dakar" size="large" />
              </Form.Item>

              <Form.Item name="tva_taux" label="Taux TVA (%)">
                <Input placeholder="Ex: 18" size="large" addonAfter="%" />
              </Form.Item>
            </Col>

            {/* ── Colonne droite ── */}
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <Text style={{
                  color: '#52c41a', fontWeight: 700, fontSize: 12,
                  textTransform: 'uppercase', letterSpacing: 1
                }}>
                  📞 Contact & Communication
                </Text>
                <Divider style={{ margin: '8px 0' }} />
              </div>

              <Form.Item name="telephone" label="Téléphone principal">
                <Input prefix={<PhoneOutlined style={{ color: '#52c41a' }} />}
                  placeholder="Ex: +221 77 000 00 00" size="large" />
              </Form.Item>

              <Form.Item name="telephone_secondaire" label="Téléphone secondaire (optionnel)">
                <Input prefix={<PhoneOutlined style={{ color: '#faad14' }} />}
                  placeholder="Ex: +221 70 000 00 00" size="large" />
              </Form.Item>

              <Form.Item name="email" label="Email professionnel"
                rules={[{ type: 'email', message: 'Email invalide' }]}>
                <Input prefix={<MailOutlined style={{ color: '#1890ff' }} />}
                  placeholder="contact@nafimax.sn" size="large" />
              </Form.Item>

              <Form.Item name="mention_facture" label="Mention pied de facture">
                <TextArea rows={4}
                  placeholder="Ex: Merci pour votre confiance. Paiement sous 30 jours." />
              </Form.Item>

              <Form.Item name="format_facture" label="Format de facture" initialValue="auto"
                tooltip="« Automatique » choisit le format selon le domaine d'activité (ticket pour l'alimentaire/restauration, A4 pour les autres). Vous pouvez forcer un format précis ici.">
                <Select size="large">
                  <Option value="auto">🔄 Automatique — selon le domaine d'activité</Option>
                  <Option value="standard">📄 A4 — facture standard complète</Option>
                  <Option value="a5">📑 A5 — format compact</Option>
                  <Option value="ticket">🧾 Ticket — imprimante thermique (80mm)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" loading={saveLoading}
              icon={<SaveOutlined />} size="large"
              style={{
                borderRadius: 10, height: 44, paddingInline: 32,
                background: 'linear-gradient(135deg, #1890ff, #722ed1)',
                border: 'none', fontWeight: 'bold'
              }}>
              Sauvegarder les paramètres
            </Button>
          </div>
        </Form>
      </Card>

      {/* ── Aperçu Facture ── */}
      {parametres.nom_entreprise && (
        <Card style={{
          borderRadius: 12, border: '2px solid #1890ff',
          background: 'linear-gradient(135deg, #f0f5ff, #f9f0ff)'
        }}>
          <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: 12 }}>
            👁️ Aperçu sur les factures
          </Text>
          <div style={{
            background: 'white', borderRadius: 10, padding: '20px 24px',
            border: '1px solid #d6e4ff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              {logoPreview && (
                <img src={logoPreview} alt="Logo"
                  style={{ height: 60, objectFit: 'contain', borderRadius: 6 }} />
              )}
              <div>
                <Text strong style={{ fontSize: 20, color: '#1890ff', display: 'block' }}>
                  {parametres.nom_entreprise}
                </Text>
                {parametres.slogan && (
                  <Text style={{ color: '#888', fontSize: 13 }}>{parametres.slogan}</Text>
                )}
              </div>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={[16, 8]}>
              {parametres.adresse && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    📍 {parametres.adresse}
                  </Text>
                </Col>
              )}
              {parametres.telephone && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    📞 {parametres.telephone}
                  </Text>
                </Col>
              )}
              {parametres.telephone_secondaire && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    📞 {parametres.telephone_secondaire}
                  </Text>
                </Col>
              )}
              {parametres.email && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    ✉️ {parametres.email}
                  </Text>
                </Col>
              )}
              {parametres.registre_commerce && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    🏢 RC: {parametres.registre_commerce}
                  </Text>
                </Col>
              )}
              {parametres.ninea && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    🏛️ NINEA: {parametres.ninea}
                  </Text>
                </Col>
              )}
              {parametres.activites && (() => {
                try {
                  const acts = JSON.parse(parametres.activites)
                  return acts.length > 0 ? (
                    <Col span={24}>
                      <Text style={{ fontSize: 12, color: '#555' }}>
                        💼 Activités : {acts.map((a, i) => (
                          <Tag key={i} color="blue" style={{ borderRadius: 10, fontSize: 11 }}>{a}</Tag>
                        ))}
                      </Text>
                    </Col>
                  ) : null
                } catch { return null }
              })()}
              {parametres.sous_activites && (() => {
                try {
                  const sacts = JSON.parse(parametres.sous_activites)
                  return sacts.length > 0 ? (
                    <Col span={24}>
                      <Text style={{ fontSize: 12, color: '#555' }}>
                        🔖 Sous-activités : {sacts.map((a, i) => (
                          <Tag key={i} color="purple" style={{ borderRadius: 10, fontSize: 11 }}>{a}</Tag>
                        ))}
                      </Text>
                    </Col>
                  ) : null
                } catch { return null }
              })()}
              {parametres.tva_taux && (
                <Col span={12}>
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    🧾 TVA: {parametres.tva_taux}%
                  </Text>
                </Col>
              )}
            </Row>
          </div>
        </Card>
      )}
    </div>
  )

  // ════════════════════════════════════════════════════════
  // ONGLET UTILISATEURS
  // ════════════════════════════════════════════════════════
  const tabUtilisateurs = (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {Object.entries(roleConfig).map(([key, cfg]) => (
          <Col span={6} key={key}>
            <Card style={{ borderRadius: 12, border: 'none', background: '#fafafa', textAlign: 'center' }}
              bodyStyle={{ padding: '12px' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{cfg.label.split(' ')[0]}</div>
              <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                {utilisateurs.filter(u => u.role === key).length}
              </Text>
              <Text style={{ display: 'block', color: '#888', fontSize: 11 }}>
                {cfg.label.split(' ').slice(1).join(' ')}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title={<Space><TeamOutlined style={{ color: '#1890ff' }} /><Text strong>Membres de l'équipe</Text></Space>}
        extra={
          <Button type="primary" icon={<UserAddOutlined />}
            onClick={() => setUserModalVisible(true)}
            style={{
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none'
            }}>
            Ajouter un utilisateur
          </Button>
        }
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <Table dataSource={utilisateurs} columns={colonnesUsers} rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: 'Aucun utilisateur enregistré' }} />
      </Card>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // ONGLET DOMAINE
  // ════════════════════════════════════════════════════════
  const tabDomaine = (
    <div>
      {/* Domaine actuel */}
      {domaine && (
        <Card style={{
          borderRadius: 12, marginBottom: 20,
          background: 'linear-gradient(135deg, #f0f5ff, #f9f0ff)',
          border: '2px solid #1890ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56,
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28, flexShrink: 0
            }}>
              {getDomaine(domaine)?.icone}
            </div>
            <div>
              <Text strong style={{ fontSize: 16, display: 'block' }}>
                Domaine actuel : {getDomaine(domaine)?.nom}
              </Text>
              <Text style={{ color: '#888' }}>{getDomaine(domaine)?.description}</Text>
              <div style={{ marginTop: 6 }}>
                <Badge status="success" text={
                  <Text style={{ color: '#52c41a', fontSize: 12 }}>✅ Actif et configuré</Text>
                } />
              </div>
            </div>
          </div>
        </Card>
      )}

      <Alert type="info" showIcon style={{ borderRadius: 10, marginBottom: 20 }}
        message="Cliquez sur un domaine pour l'activer. Les catégories seront installées automatiquement." />

      {/* Grille des domaines */}
      <Row gutter={[16, 16]}>
        {getTousDomaines().map((d) => (
          <Col span={12} key={d.type}>
            <Card hoverable
              onClick={() => !domaineLoading && sauvegarderDomaine(d.type)}
              style={{
                borderRadius: 16, cursor: 'pointer',
                border: domaine === d.type ? '2px solid #1890ff' : '1px solid #f0f0f0',
                background: domaine === d.type ? '#f0f5ff' : 'white',
                transition: 'all .2s'
              }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 52, height: 52, flexShrink: 0,
                  background: domaine === d.type
                    ? 'linear-gradient(135deg, #1890ff, #722ed1)'
                    : '#f5f5f5',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 26
                }}>
                  {d.icone}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 14 }}>{d.nom}</Text>
                    {domaine === d.type && (
                      <Tag color="blue" style={{ borderRadius: 12 }}>✅ Actif</Tag>
                    )}
                  </div>
                  <Text style={{ color: '#888', fontSize: 12, display: 'block', marginTop: 4 }}>
                    {d.description}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // ONGLET À PROPOS
  // ════════════════════════════════════════════════════════
  const tabAPropos = (
    <div>
      <Card style={{
        borderRadius: 16, border: 'none',
        background: 'linear-gradient(135deg, #0a0e1a, #1a2340)',
        marginBottom: 20, textAlign: 'center', padding: 20
      }}>
        <div style={{
          width: 80, height: 80, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #1890ff, #722ed1)',
          borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 36
        }}>
          🤖
        </div>
        <Title level={2} style={{ color: 'white', margin: 0, letterSpacing: 3 }}>
          NAFIX
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          Gestion Commerciale Intelligente
        </Text>
        <div style={{ marginTop: 12 }}>
          <Tag color="blue" style={{ borderRadius: 12 }}>Version 1.0.0</Tag>
          <Tag color="green" style={{ borderRadius: 12 }}>Made in Africa 🌍</Tag>
          <Tag color="purple" style={{ borderRadius: 12 }}>© 2025 Nafimax Store</Tag>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Modules', val: '10+', emoji: '📦', color: '#1890ff', bg: '#e6f7ff' },
          { label: 'Algorithmes IA', val: '6', emoji: '🤖', color: '#722ed1', bg: '#f9f0ff' },
          { label: 'Rôles Utilisateurs', val: '4', emoji: '👥', color: '#52c41a', bg: '#f6ffed' },
          { label: '100% Hors Ligne', val: '✓', emoji: '🔒', color: '#faad14', bg: '#fffbe6' }
        ].map((s, i) => (
          <Col span={6} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg, textAlign: 'center' }}
              bodyStyle={{ padding: '16px 8px' }}>
              <div style={{ fontSize: 28 }}>{s.emoji}</div>
              <Text strong style={{ fontSize: 22, color: s.color, display: 'block' }}>{s.val}</Text>
              <Text style={{ color: '#888', fontSize: 12 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>🔧 Technologies utilisées</Text>
            {[
              { nom: 'Electron',    detail: 'Application desktop',   color: '#1890ff' },
              { nom: 'React',       detail: 'Interface utilisateur',  color: '#52c41a' },
              { nom: 'SQLite',      detail: 'Base de données locale', color: '#faad14' },
              { nom: 'Ant Design',  detail: 'Composants UI',          color: '#722ed1' },
              { nom: 'ML Engine',   detail: 'Intelligence Artificielle', color: '#ff4d4f' }
            ].map((t, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '8px 0',
                borderBottom: i < 4 ? '1px solid #f0f0f0' : 'none'
              }}>
                <Space>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
                  <Text strong>{t.nom}</Text>
                </Space>
                <Text style={{ color: '#888', fontSize: 12 }}>{t.detail}</Text>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>🌍 Adapté pour l'Afrique</Text>
            {[
              { emoji: '💵', texte: 'Devise FCFA intégrée' },
              { emoji: '🌊', texte: 'Wave & Orange Money' },
              { emoji: '📱', texte: 'Interface simple en français' },
              { emoji: '📡', texte: '100% hors ligne' },
              { emoji: '🏪', texte: 'Multi-domaines commerciaux' }
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < 4 ? '1px solid #f0f0f0' : 'none'
              }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <Text>{item.texte}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // ONGLET THÈME & COULEURS
  // ════════════════════════════════════════════════════════
  const palettes = [
    { couleur: '#1890ff', nom: 'Bleu Nafix',       defaut: true },
    { couleur: '#722ed1', nom: 'Violet Royal'                   },
    { couleur: '#52c41a', nom: 'Vert Émeraude'                  },
    { couleur: '#fa8c16', nom: 'Orange Flamme'                  },
    { couleur: '#ff4d4f', nom: 'Rouge Vif'                      },
    { couleur: '#eb2f96', nom: 'Rose Élégant'                   },
    { couleur: '#13c2c2', nom: 'Cyan Océan'                     },
    { couleur: '#2f54eb', nom: 'Indigo Nuit'                    },
    { couleur: '#08979c', nom: 'Vert Sauge'                     },
    { couleur: '#d4b106', nom: 'Or Africain'                    },
    { couleur: '#531dab', nom: 'Pourpre Profond'                },
    { couleur: '#c41d7f', nom: 'Fuchsia'                        }
  ]

  const tabTheme = (
    <div>
      <Alert
        type="info" showIcon style={{ borderRadius: 10, marginBottom: 20 }}
        message="Choisissez une couleur principale pour personnaliser l'apparence de Nafix. Le changement s'applique immédiatement."
      />

      {/* Palettes prédéfinies */}
      <Card
        title={<Space><BgColorsOutlined style={{ color: couleurTheme }} />Palettes prédéfinies</Space>}
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}
      >
        <Row gutter={[12, 12]}>
          {palettes.map((p) => {
            const actif = couleurTheme === p.couleur
            return (
              <Col span={6} key={p.couleur}>
                <div
                  onClick={() => appliquerTheme(p.couleur)}
                  style={{
                    borderRadius: 12,
                    border: actif ? `3px solid ${p.couleur}` : '3px solid transparent',
                    padding: 3,
                    cursor: 'pointer',
                    transition: 'all .2s',
                    boxShadow: actif ? `0 0 0 2px ${p.couleur}44` : 'none'
                  }}
                >
                  <div style={{
                    background: p.couleur,
                    borderRadius: 8,
                    height: 56,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {actif && (
                      <CheckOutlined style={{
                        color: 'white', fontSize: 22,
                        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))'
                      }} />
                    )}
                  </div>
                  <div style={{
                    textAlign: 'center', marginTop: 6,
                    fontSize: 11, color: actif ? p.couleur : '#555',
                    fontWeight: actif ? 700 : 400
                  }}>
                    {p.nom}
                    {p.defaut && <span style={{ color: '#aaa', fontWeight: 400 }}> (défaut)</span>}
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>
      </Card>

      {/* Couleur personnalisée */}
      <Card
        title={<Space><BgColorsOutlined />Couleur personnalisée</Space>}
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}
      >
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              prefix={
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  background: couleurPersonnalisee || couleurTheme,
                  border: '1px solid #ddd', flexShrink: 0
                }} />
              }
              placeholder="Ex: #e91e63"
              value={couleurPersonnalisee}
              onChange={(e) => setCouleurPersonnalisee(e.target.value)}
              size="large"
              maxLength={7}
              onPressEnter={() => {
                const c = couleurPersonnalisee.trim()
                if (c) appliquerTheme(c)
              }}
            />
          </Col>
          <Col>
            <input
              type="color"
              value={couleurPersonnalisee || couleurTheme}
              onChange={(e) => setCouleurPersonnalisee(e.target.value)}
              style={{
                width: 48, height: 48, borderRadius: 8, border: '2px solid #f0f0f0',
                cursor: 'pointer', padding: 2
              }}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              loading={themeLoading}
              size="large"
              style={{ borderRadius: 8, minWidth: 120 }}
              onClick={() => {
                const c = (couleurPersonnalisee || '').trim()
                if (c) appliquerTheme(c)
                else message.warning('Saisissez une couleur hexadécimale')
              }}
            >
              Appliquer
            </Button>
          </Col>
        </Row>
        <Text style={{ color: '#aaa', fontSize: 11, marginTop: 8, display: 'block' }}>
          Entrez un code hexadécimal (#RRGGBB) ou utilisez le sélecteur de couleur.
        </Text>
      </Card>

      {/* Aperçu live */}
      <Card
        title="👁️ Aperçu du thème"
        style={{ borderRadius: 12, border: `2px solid ${couleurTheme}`, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <Button type="primary" style={{ background: couleurTheme, border: 'none', borderRadius: 8 }}>
            Bouton Principal
          </Button>
          <Button style={{ borderColor: couleurTheme, color: couleurTheme, borderRadius: 8 }}>
            Bouton Secondaire
          </Button>
          <Tag color={couleurTheme} style={{ borderRadius: 12 }}>Tag coloré</Tag>
          <Tag color={couleurTheme} style={{ borderRadius: 12 }}>Catégorie</Tag>
          <Badge count={5} style={{ background: couleurTheme }} />
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${couleurTheme}, ${couleurTheme}bb)`,
          borderRadius: 10, padding: '16px 20px', color: 'white'
        }}>
          <Text strong style={{ color: 'white', fontSize: 15, display: 'block' }}>
            En-tête avec votre couleur
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            Aperçu du rendu sur les bannières et titres de section
          </Text>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{
            height: 6, borderRadius: 3,
            background: `linear-gradient(90deg, ${couleurTheme}, ${couleurTheme}55)`
          }} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
          {['Ventes', 'Produits', 'Clients'].map((m) => (
            <div key={m} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              borderRadius: 8, background: '#f9f9f9',
              border: `2px solid ${couleurTheme}33`,
              cursor: 'default'
            }}>
              <Text style={{ color: couleurTheme, fontWeight: 600, fontSize: 13 }}>{m}</Text>
            </div>
          ))}
        </div>
      </Card>

      {/* Couleur active */}
      <Card style={{
        borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        background: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: couleurTheme, flexShrink: 0,
            boxShadow: `0 4px 12px ${couleurTheme}66`
          }} />
          <div>
            <Text strong style={{ display: 'block', color: couleurTheme, fontSize: 16 }}>
              Thème actuel
            </Text>
            <Text style={{ color: '#888', fontFamily: 'monospace' }}>{couleurTheme}</Text>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Button
              size="small"
              style={{ borderRadius: 6 }}
              onClick={() => appliquerTheme('#1890ff')}
            >
              Réinitialiser
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // ONGLET BASE DE DONNÉES
  // ════════════════════════════════════════════════════════
  const tableLabels = {
    produits:       { label: 'Produits',       emoji: '📦' },
    clients:        { label: 'Clients',         emoji: '👤' },
    ventes:         { label: 'Ventes',          emoji: '🛒' },
    devis:          { label: 'Devis',           emoji: '📋' },
    tresorerie:     { label: 'Trésorerie',      emoji: '💰' },
    fournisseurs:   { label: 'Fournisseurs',    emoji: '🏭' },
    achats:         { label: 'Achats',          emoji: '📥' },
    categories:     { label: 'Catégories',      emoji: '🏷️' },
    sous_categories:{ label: 'Sous-catégories', emoji: '🔖' },
    utilisateurs:   { label: 'Utilisateurs',    emoji: '👥' },
    parametres:     { label: 'Paramètres',      emoji: '⚙️' },
    domaine:        { label: 'Domaine',         emoji: '🌐' }
  }

  const totalLignes = dbStats?.tables?.reduce((s, t) => s + t.count, 0) || 0

  const tabDB = (
    <div>
      {/* Bouton actualiser */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={chargerDbStats}
          loading={dbLoading}
          type="primary"
          style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none' }}
        >
          {dbStats ? 'Actualiser' : 'Charger les stats'}
        </Button>
      </div>

      {!dbStats && !dbLoading && (
        <Alert
          type="info" showIcon
          message="Cliquez sur « Charger les stats » pour afficher les informations de la base de données."
          style={{ borderRadius: 10, marginBottom: 20 }}
        />
      )}

      {dbLoading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#888' }}>Connexion à PostgreSQL...</div>
        </div>
      )}

      {dbStats && !dbLoading && (
        <>
          {/* Carte connexion */}
          <Card style={{
            borderRadius: 12, marginBottom: 20,
            background: 'linear-gradient(135deg, #f6ffed, #e6f7ff)',
            border: '2px solid #52c41a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <Text strong style={{ fontSize: 16, color: '#52c41a' }}>Connexion PostgreSQL active</Text>
            </div>
            <Row gutter={[24, 8]}>
              {[
                { label: 'Hôte',     val: dbStats.host },
                { label: 'Port',     val: dbStats.port },
                { label: 'Base',     val: dbStats.database },
                { label: 'Utilisateur', val: dbStats.user },
                { label: 'Taille',   val: dbStats.dbSize || '—' }
              ].map((item) => (
                <Col span={8} key={item.label}>
                  <Text style={{ color: '#888', fontSize: 12, display: 'block' }}>{item.label}</Text>
                  <Text strong style={{ fontSize: 14 }}>{item.val}</Text>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Résumé chiffres */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#f0f5ff', textAlign: 'center' }}
                bodyStyle={{ padding: '16px 8px' }}>
                <Statistic
                  title={<Text style={{ color: '#888', fontSize: 12 }}>Total enregistrements</Text>}
                  value={totalLignes}
                  valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 'bold' }}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#f9f0ff', textAlign: 'center' }}
                bodyStyle={{ padding: '16px 8px' }}>
                <Statistic
                  title={<Text style={{ color: '#888', fontSize: 12 }}>Tables</Text>}
                  value={dbStats.tables.length}
                  valueStyle={{ color: '#722ed1', fontSize: 28, fontWeight: 'bold' }}
                  prefix={<TableOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#fff7e6', textAlign: 'center' }}
                bodyStyle={{ padding: '16px 8px' }}>
                <Statistic
                  title={<Text style={{ color: '#888', fontSize: 12 }}>Taille base</Text>}
                  value={dbStats.dbSize || '—'}
                  valueStyle={{ color: '#fa8c16', fontSize: 28, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Tableau des tables */}
          <Card
            title={<Space><TableOutlined style={{ color: '#1890ff' }} /><Text strong>Contenu des tables</Text></Space>}
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <Row gutter={[12, 12]}>
              {dbStats.tables.map((t) => {
                const cfg = tableLabels[t.table] || { label: t.table, emoji: '📄' }
                const pct = totalLignes > 0 ? Math.round((t.count / totalLignes) * 100) : 0
                return (
                  <Col span={12} key={t.table}>
                    <div style={{
                      background: '#fafafa', borderRadius: 10,
                      padding: '12px 16px', border: '1px solid #f0f0f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text strong style={{ fontSize: 13 }}>
                          {cfg.emoji} {cfg.label}
                        </Text>
                        <Tag color={t.count > 0 ? 'blue' : 'default'} style={{ borderRadius: 10 }}>
                          {t.count.toLocaleString('fr-FR')} lignes
                        </Tag>
                      </div>
                      <Progress
                        percent={pct} showInfo={false} size="small"
                        strokeColor={{ from: '#1890ff', to: '#722ed1' }}
                      />
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </>
      )}

      {/* ── Sauvegarde complète ───────────────────────────── */}
      <Card
        style={{
          borderRadius: 14, marginTop: 24,
          border: '2px solid #b7eb8f',
          background: 'linear-gradient(135deg, #f6ffed, #f0fff4)'
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #52c41a, #389e0d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CloudDownloadOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <Text strong style={{ color: '#389e0d', fontSize: 16, display: 'block' }}>
              Sauvegarde complète
            </Text>
            <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
              Exporte toutes les données de Nafix (produits, ventes, clients, trésorerie, catégories,
              utilisateurs, paramètres et logo) dans un seul fichier .zip — à garder sur une clé USB
              ou un espace cloud, en plus de ce PC.
            </Text>
          </div>
        </div>

        <Button
          type="primary"
          icon={<CloudDownloadOutlined />}
          size="large"
          loading={sauvegardeEnCours}
          onClick={exporterSauvegarde}
          style={{ borderRadius: 10, fontWeight: 'bold', background: '#52c41a', borderColor: '#52c41a' }}
        >
          Télécharger la sauvegarde complète
        </Button>
      </Card>

      {/* ── Zone Danger ───────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 14, marginTop: 24,
          border: '2px solid #ff4d4f',
          background: 'linear-gradient(135deg, #fff2f0, #fff1f0)'
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #ff4d4f, #cf1322)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <WarningOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <Text strong style={{ color: '#cf1322', fontSize: 16, display: 'block' }}>
              Zone de Danger — Réinitialisation des données
            </Text>
            <Text style={{ color: '#888', fontSize: 12 }}>
              Cette action supprime définitivement les données commerciales sélectionnées. Les paramètres,
              utilisateurs, catégories et domaine sont préservés.
            </Text>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 10,
          border: '1px solid #ffa39e', padding: '12px 16px',
          marginBottom: 16
        }}>
          <Text style={{ color: '#888', fontSize: 12 }}>
            ✅ Préservés : <strong>Paramètres entreprise</strong>, <strong>Utilisateurs</strong>,{' '}
            <strong>Catégories</strong>, <strong>Domaine</strong>
            <br />
            ❌ Supprimés (selon sélection) : Ventes, Devis, Trésorerie, Clients, Produits, Fournisseurs, Achats, Retours, Commandes, Avoirs, Clôtures
          </Text>
        </div>

        <Button
          danger
          type="primary"
          icon={<DeleteOutlined />}
          size="large"
          onClick={() => {
            setResetConfirmText('')
            setResetOptions({ ventes: true, tresorerie: true, clients: true, produits: true, fournisseurs: true, retours: true, commandes: true })
            setResetModalVisible(true)
          }}
          style={{ borderRadius: 10, fontWeight: 'bold' }}
        >
          Réinitialiser les données
        </Button>
      </Card>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ════════════════════════════════════════════════════════
  return (
    <div>
      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            ⚙️ Paramètres du Système
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Configurez votre application Nafix selon vos besoins
          </Text>
        </div>
        {domaine && (
          <Tag style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', borderRadius: 12, fontSize: 13, padding: '4px 14px'
          }}>
            {getDomaine(domaine)?.icone} {getDomaine(domaine)?.nom}
          </Tag>
        )}
      </div>

      {/* Tabs */}
      <Tabs type="card" defaultActiveKey="1" size="large" items={[
        {
          key: '1',
          label: <Space><ShopOutlined />Entreprise</Space>,
          children: tabEntreprise
        },
        {
          key: '2',
          label: <Space><TeamOutlined />Utilisateurs</Space>,
          children: tabUtilisateurs
        },
        {
          key: '3',
          label: <Space><GlobalOutlined />Domaine</Space>,
          children: tabDomaine
        },
        {
          key: '6',
          label: (
            <Space>
              <BgColorsOutlined style={{ color: couleurTheme }} />
              <span>Thème & Couleurs</span>
            </Space>
          ),
          children: tabTheme
        },
        {
          key: '4',
          label: <Space><DatabaseOutlined />Base de données</Space>,
          children: tabDB
        },
        {
          key: '5',
          label: <Space><RobotOutlined />À propos</Space>,
          children: tabAPropos
        }
      ]} />

      {/* ── Modal Ajouter Utilisateur ── */}
      <Modal
        title={<Space><UserAddOutlined style={{ color: '#1890ff' }} />Ajouter un utilisateur</Space>}
        open={userModalVisible}
        onCancel={() => { setUserModalVisible(false); formUser.resetFields() }}
        onOk={() => formUser.submit()}
        okText="Ajouter" cancelText="Annuler" width={480}
        okButtonProps={{
          style: { background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none' }
        }}
      >
        <Form form={formUser} layout="vertical" onFinish={ajouterUtilisateur}>
          <Form.Item name="nom" label="Nom complet"
            rules={[{ required: true, message: 'Obligatoire' }]}>
            <Input prefix={<UserOutlined />}
              placeholder="Ex: Moussa Diallo" size="large" />
          </Form.Item>
          <Form.Item name="username" label="Identifiant de connexion"
            rules={[{ required: true, message: 'Obligatoire' }]}>
            <Input placeholder="Ex: moussa.diallo" size="large" />
          </Form.Item>
          <Form.Item name="role" label="Rôle"
            rules={[{ required: true, message: 'Obligatoire' }]}>
            <Select placeholder="Choisir un rôle" size="large">
              <Option value="administrateur">👑 Administrateur — Accès total</Option>
              <Option value="gerant">🏢 Gérant — Gestion complète</Option>
              <Option value="comptable">📊 Comptable — Finance uniquement</Option>
              <Option value="caissier">🛒 Caissier — Ventes uniquement</Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" label="Mot de passe"
            rules={[{ required: true, message: 'Obligatoire' }, { min: 6, message: 'Min 6 caractères' }]}>
            <Input.Password placeholder="Minimum 6 caractères" size="large" />
          </Form.Item>
          <Form.Item name="confirm" label="Confirmer le mot de passe"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Obligatoire' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('Mots de passe différents'))
                }
              })
            ]}>
            <Input.Password placeholder="Répéter le mot de passe" size="large" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Mot de passe ── */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#faad14' }} />
            Mot de passe — {userSelectionne?.nom}
          </Space>
        }
        open={passwordModalVisible}
        onCancel={() => { setPasswordModalVisible(false); formPassword.resetFields() }}
        onOk={() => formPassword.submit()}
        okText="Modifier" cancelText="Annuler" width={400}
      >
        <Form form={formPassword} layout="vertical" onFinish={changerMotDePasse}>
          <Form.Item name="password" label="Nouveau mot de passe"
            rules={[{ required: true, message: 'Obligatoire' }, { min: 6, message: 'Min 6 caractères' }]}>
            <Input.Password placeholder="Minimum 6 caractères" size="large" />
          </Form.Item>
          <Form.Item name="confirm" label="Confirmer"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Obligatoire' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('Mots de passe différents'))
                }
              })
            ]}>
            <Input.Password placeholder="Répéter le mot de passe" size="large" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal gestion des permissions ── */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#722ed1' }} />
            <span>Permissions — {userSelectionne?.nom}</span>
            <Tag color={roleConfig[roleChoisi]?.color} style={{ borderRadius: 8 }}>
              {roleConfig[roleChoisi]?.label}
            </Tag>
          </Space>
        }
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={appliquerRole}
        okText="Sauvegarder" cancelText="Annuler"
        confirmLoading={savePermsLoading}
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #722ed1, #1890ff)', border: 'none' } }}
        width={680}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Sélecteur de rôle */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Rôle de base :</Text>
          <Select
            value={roleChoisi}
            onChange={onRoleChange}
            style={{ width: '100%' }}
            size="large"
          >
            {Object.entries(roleConfig).filter(([k]) => k !== 'administrateur').map(([key, cfg]) => (
              <Option key={key} value={key}>
                <Tag color={cfg.color} style={{ borderRadius: 8, margin: 0 }}>{cfg.label}</Tag>
              </Option>
            ))}
          </Select>
          <Text style={{ color: '#aaa', fontSize: 11, display: 'block', marginTop: 6 }}>
            Changer le rôle réinitialise les permissions aux valeurs par défaut du rôle.
          </Text>
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Matrice interactive */}
        {permissionsEditees && (() => {
          const modules = [
            { key: 'ventes',       label: '🛒 Ventes',        actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'devis',        label: '📋 Devis',         actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'factures',     label: '🧾 Factures',      actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'clients',      label: '👥 Clients',       actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'produits',     label: '📦 Produits',      actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'fournisseurs', label: '🏭 Fournisseurs',  actions: ['voir','ajouter','modifier','supprimer'] },
            { key: 'commandes',    label: '📬 Commandes',     actions: ['voir','ajouter'] },
            { key: 'categories',   label: '🏷️ Catégories',   actions: ['voir','ajouter','supprimer'] },
            { key: 'comptabilite', label: '💰 Comptabilité',  actions: ['voir'] },
            { key: 'statistiques', label: '📊 Statistiques',  actions: ['voir'] },
            { key: 'ai',           label: '🤖 Nafix AI',      actions: ['voir'] },
          ]
          const labelAction = { voir: 'Voir', ajouter: 'Ajouter', modifier: 'Modifier', supprimer: 'Supprimer' }

          return (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>
                Autorisations par module — cliquez pour changer :
              </Text>
              {modules.map((mod, i) => (
                <div key={mod.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  background: i % 2 === 0 ? '#fafafa' : 'white',
                  borderRadius: 8, marginBottom: 4,
                  border: '1px solid #f0f0f0'
                }}>
                  <Text style={{ width: 130, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {mod.label}
                  </Text>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mod.actions.map(action => {
                      const autorise = permissionsEditees[mod.key]?.[action] || false
                      return (
                        <Button
                          key={action}
                          size="small"
                          onClick={() => togglePermission(mod.key, action)}
                          style={{
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            height: 28,
                            paddingInline: 12,
                            background: autorise ? '#f6ffed' : '#fff2f0',
                            borderColor: autorise ? '#52c41a' : '#ff4d4f',
                            color: autorise ? '#52c41a' : '#ff4d4f',
                            transition: 'all 0.2s'
                          }}
                        >
                          {autorise ? <CheckOutlined /> : <CloseOutlined />} {labelAction[action]}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>

      {/* ── Modal Réinitialisation ── */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
            <Text strong style={{ color: '#cf1322', fontSize: 16 }}>Réinitialisation des données</Text>
          </Space>
        }
        open={resetModalVisible}
        onCancel={() => { setResetModalVisible(false); setResetConfirmText('') }}
        footer={null}
        width={560}
        centered
      >
        {/* Sélection des tables */}
        <div style={{
          background: '#fafafa', borderRadius: 10,
          border: '1px solid #f0f0f0', padding: '16px', marginBottom: 20
        }}>
          <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>
            Sélectionnez les données à supprimer :
          </Text>
          <Row gutter={[8, 8]}>
            {[
              { key: 'ventes',       label: '🛒 Ventes & Devis',           desc: 'Toutes les ventes, devis, factures' },
              { key: 'tresorerie',   label: '💰 Trésorerie & Clôtures',    desc: 'Opérations et clôtures journalières' },
              { key: 'clients',      label: '👤 Clients & Avoirs',         desc: 'Clients + comptes prépayés' },
              { key: 'produits',     label: '📦 Produits & Stock',         desc: 'Catalogue produits complet' },
              { key: 'fournisseurs', label: '🏭 Fournisseurs & Achats',    desc: 'Fournisseurs et bons d\'achat' },
              { key: 'retours',      label: '↩️ Retours',                  desc: 'Demandes de retour' },
              { key: 'commandes',    label: '📬 Commandes clients',        desc: 'Commandes en cours' },
            ].map(opt => {
              const checked = resetOptions[opt.key]
              return (
                <Col span={24} key={opt.key}>
                  <div
                    onClick={() => setResetOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${checked ? '#ffa39e' : '#f0f0f0'}`,
                      background: checked ? '#fff2f0' : 'white',
                      transition: 'all .15s'
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${checked ? '#ff4d4f' : '#d9d9d9'}`,
                      background: checked ? '#ff4d4f' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {checked && <CheckOutlined style={{ color: 'white', fontSize: 11 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13, color: checked ? '#cf1322' : '#333' }}>
                        {opt.label}
                      </Text>
                      <Text style={{ display: 'block', color: '#aaa', fontSize: 11 }}>{opt.desc}</Text>
                    </div>
                  </div>
                </Col>
              )
            })}
          </Row>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Button size="small" style={{ borderRadius: 6 }}
              onClick={() => setResetOptions({ ventes: true, tresorerie: true, clients: true, produits: true, fournisseurs: true, retours: true, commandes: true })}>
              Tout sélectionner
            </Button>
            <Button size="small" style={{ borderRadius: 6 }}
              onClick={() => setResetOptions({ ventes: false, tresorerie: false, clients: false, produits: false, fournisseurs: false, retours: false, commandes: false })}>
              Tout désélectionner
            </Button>
          </div>
        </div>

        {/* Confirmation par saisie */}
        <div style={{
          background: '#fff2f0', borderRadius: 10,
          border: '1px solid #ffa39e', padding: '16px', marginBottom: 20
        }}>
          <Text style={{ color: '#cf1322', display: 'block', marginBottom: 10, fontWeight: 600 }}>
            ⚠️ Cette action est irréversible. Tapez <strong>RÉINITIALISER</strong> pour confirmer :
          </Text>
          <Input
            value={resetConfirmText}
            onChange={e => setResetConfirmText(e.target.value)}
            placeholder='Tapez : RÉINITIALISER'
            size="large"
            style={{
              borderRadius: 8,
              borderColor: resetConfirmText === 'RÉINITIALISER' ? '#52c41a' : '#ffa39e',
              fontWeight: 'bold'
            }}
          />
          {resetConfirmText === 'RÉINITIALISER' && (
            <Text style={{ color: '#52c41a', fontSize: 12, marginTop: 6, display: 'block' }}>
              ✅ Confirmation acceptée
            </Text>
          )}
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button
            size="large"
            style={{ borderRadius: 8 }}
            onClick={() => { setResetModalVisible(false); setResetConfirmText('') }}
          >
            Annuler
          </Button>
          <Button
            danger type="primary"
            size="large"
            loading={resetLoading}
            disabled={resetConfirmText !== 'RÉINITIALISER' || !Object.values(resetOptions).some(Boolean)}
            icon={<DeleteOutlined />}
            onClick={executerReinitialisation}
            style={{ borderRadius: 8, fontWeight: 'bold', minWidth: 200 }}
          >
            Supprimer les données sélectionnées
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Parametres