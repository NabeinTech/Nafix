import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Card, Button, Modal, Form,
  Input, Select, Space, Popconfirm,
  Tag, message, Row, Col, Collapse, Empty,
  Alert, Divider, Statistic, Drawer
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  AppstoreOutlined, TagOutlined,
  ImportOutlined, BarChartOutlined
} from '@ant-design/icons'
import { CATEGORIES_PAR_DOMAINE, getDomaine } from '../utils/domainConfig'

const { Title, Text } = Typography
const { Option } = Select
const { Panel } = Collapse
const ipcRenderer = window.ipcRenderer

function Categories({ utilisateur }) {
  const [categories, setCategories] = useState([])
  const [catModalVisible, setCatModalVisible] = useState(false)
  const [scatModalVisible, setScatModalVisible] = useState(false)
  const [categorieSelectionnee, setCategorieSelectionnee] = useState(null)
  const [formCat] = Form.useForm()
  const [formScat] = Form.useForm()
  const [domaineActive, setDomaineActive] = useState(null)
  const [packModalVisible, setPackModalVisible] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [statsDrawerVisible, setStatsDrawerVisible] = useState(false)
  const [statsCategorie, setStatsCategorie] = useState(null)
  const [produits, setProduits] = useState([])
  const [editingCategory, setEditingCategory] = useState(null)
  const [editCatModalVisible, setEditCatModalVisible] = useState(false)

  // ── Chargement ──────────────────────────────────────────
  const chargerCategories = async () => {
    if (!ipcRenderer) return
    setCategories(await ipcRenderer.invoke('categories:getAll'))
  }

  const chargerProduits = async () => {
    if (!ipcRenderer) return
    setProduits(await ipcRenderer.invoke('produits:getAll'))
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    if (data?.type) setDomaineActive(data.type)
  }

  useEffect(() => {
    chargerCategories()
    chargerDomaine()
    chargerProduits()
  }, [])

  // On ne montre que les catégories du domaine d'activité actif — les autres
  // domaines (choisis puis abandonnés) restent masqués sans être supprimés.
  const categoriesDuDomaine = useMemo(
    () => domaineActive ? categories.filter(c => c.domaine === domaineActive) : categories,
    [categories, domaineActive]
  )

  // ── CRUD Catégories ──────────────────────────────────────
  const ajouterCategorie = async (values) => {
    if (!ipcRenderer) return
    const result = await ipcRenderer.invoke('categories:create', {
      nom: values.nom,
      icone: values.icone || '📦',
      couleur: values.couleur || 'blue',
      domaine: domaineActive || 'general'
    })
    if (result.erreur) { message.error(`❌ ${result.erreur}`); return }
    message.success('✅ Catégorie ajoutée !')
    formCat.resetFields()
    setCatModalVisible(false)
    chargerCategories()
  }

  const supprimerCategorie = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('categories:delete', id)
    message.success('✅ Catégorie supprimée !')
    chargerCategories()
  }

  const editerCategorie = (cat) => {
    setEditingCategory(cat)
    formCat.setFieldsValue({ nom: cat.nom, icone: cat.icone, couleur: cat.couleur })
    setEditCatModalVisible(true)
  }

  const sauvegarderCategorieEditee = async (values) => {
    if (!ipcRenderer) return
    const result = await ipcRenderer.invoke('categories:update', {
      id: editingCategory.id, ...values
    })
    if (result?.erreur) { message.error(`❌ ${result.erreur}`); return }
    message.success('✅ Catégorie modifiée !')
    formCat.resetFields()
    setEditCatModalVisible(false)
    setEditingCategory(null)
    chargerCategories()
  }

  // ── CRUD Sous-catégories ─────────────────────────────────
  const ajouterSousCategorie = async (values) => {
    if (!ipcRenderer) return
    const result = await ipcRenderer.invoke('sous_categories:create', {
      categorie_id: categorieSelectionnee.id,
      nom: values.nom
    })
    if (result.erreur) { message.error(`❌ ${result.erreur}`); return }
    message.success('✅ Sous-catégorie ajoutée !')
    formScat.resetFields()
    setScatModalVisible(false)
    chargerCategories()
  }

  const supprimerSousCategorie = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('sous_categories:delete', id)
    message.success('✅ Sous-catégorie supprimée !')
    chargerCategories()
  }

  // ── Stats ────────────────────────────────────────────────
  const afficherStats = (cat) => {
    const produitsCat = produits.filter(p => p.categorie === cat.nom)
    const stockTotal = produitsCat.reduce((acc, p) => acc + p.stock_actuel, 0)
    const valeurStock = produitsCat.reduce((acc, p) => acc + (p.stock_actuel * p.prix_achat), 0)
    const prixVenteTotal = produitsCat.reduce((acc, p) => acc + (p.stock_actuel * p.prix_vente), 0)
    setStatsCategorie({
      categorie: cat, produitsCat, stockTotal,
      valeurStock, prixVenteTotal,
      margeTotal: prixVenteTotal - valeurStock,
      nombreProduits: produitsCat.length,
      alertesStock: produitsCat.filter(p => p.stock_actuel <= p.stock_minimum).length
    })
    setStatsDrawerVisible(true)
  }

  // ── Import Pack Domaine ──────────────────────────────────
  const importerPackDomaine = async () => {
    if (!domaineActive || !ipcRenderer) return
    setImportLoading(true)
    const packCategories = CATEGORIES_PAR_DOMAINE[domaineActive] || []
    let importees = 0

    for (const packCat of packCategories) {
      const result = await ipcRenderer.invoke('categories:create', {
        nom: packCat.nom, icone: packCat.icone, couleur: packCat.couleur, domaine: domaineActive
      })
      if (!result.erreur) {
        importees++
        const toutesLesCategories = await ipcRenderer.invoke('categories:getAll')
        const catCreee = toutesLesCategories.find(c => c.nom === packCat.nom)
        if (catCreee) {
          for (const sc of packCat.sousCategories) {
            await ipcRenderer.invoke('sous_categories:create', {
              categorie_id: catCreee.id, nom: sc
            })
          }
        }
      }
    }

    message.success(`✅ ${importees} catégorie(s) importée(s) pour ${getDomaine(domaineActive)?.nom} !`)
    setPackModalVisible(false)
    setImportLoading(false)
    chargerCategories()
  }

  const fermerModalCat = () => {
    setCatModalVisible(false)
    setEditCatModalVisible(false)
    setEditingCategory(null)
    formCat.resetFields()
  }

  const icones = [
    '📦', '💻', '🏠', '🔧', '🛒', '📱', '👕', '🍎',
    '🚗', '💊', '📚', '🎮', '🛠️', '🌿', '💄', '🎵',
    '🖨️', '🌾', '🫙', '🥤', '🌶️', '🥬', '🔩', '⚡',
    '🚿', '🎨', '🏗️', '👔', '👗', '👶', '🧵', '👟', '👜'
  ]

  const couleurs = [
    { label: 'Bleu', value: 'blue' },
    { label: 'Vert', value: 'green' },
    { label: 'Orange', value: 'orange' },
    { label: 'Rouge', value: 'red' },
    { label: 'Violet', value: 'purple' },
    { label: 'Cyan', value: 'cyan' },
    { label: 'Or', value: 'gold' },
    { label: 'Rose', value: 'magenta' }
  ]

  // ── RENDU ────────────────────────────────────────────────
  return (
    <div>
      {/* Alerte domaine */}
      {!domaineActive && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="⚠️ Domaine non configuré"
          description="Allez dans Paramètres → Domaine pour sélectionner votre type de commerce." />
      )}

      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            🏷️ Catégories & Sous-catégories
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {domaineActive
              ? `${getDomaine(domaineActive)?.icone} ${getDomaine(domaineActive)?.nom}`
              : 'Organisez vos produits par catégories'}
          </Text>
        </div>
        <Space>
          {domaineActive && (
            <Button icon={<ImportOutlined />} size="large"
              onClick={() => setPackModalVisible(true)}
              style={{
                borderRadius: 10, fontWeight: 'bold', height: 44,
                background: '#52c41a', border: 'none', color: 'white'
              }}>
              Importer le Pack
            </Button>
          )}
          <Button icon={<PlusOutlined />} size="large"
            onClick={() => setCatModalVisible(true)}
            style={{
              borderRadius: 10, fontWeight: 'bold', height: 44,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)', color: 'white'
            }}>
            Nouvelle Catégorie
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { val: categoriesDuDomaine.length, lbl: 'Catégories', emoji: '🏷️', color: '#1890ff', bg: '#e6f7ff' },
          {
            val: categoriesDuDomaine.reduce((acc, c) => acc + (c.sous_categories?.length || 0), 0),
            lbl: 'Sous-catégories', emoji: '📂', color: '#52c41a', bg: '#f6ffed'
          },
          { val: produits.length, lbl: 'Produits', emoji: '📦', color: '#faad14', bg: '#fffbe6' }
        ].map((s, i) => (
          <Col span={8} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg, textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>{s.emoji}</div>
              <Title level={2} style={{ color: s.color, margin: '4px 0' }}>{s.val}</Title>
              <Text style={{ color: '#888' }}>{s.lbl}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Liste des catégories */}
      {categoriesDuDomaine.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <Empty description="Aucune catégorie" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => setCatModalVisible(true)} style={{ marginTop: 16 }}>
            Créer une catégorie
          </Button>
        </Card>
      ) : (
        <Collapse defaultActiveKey={categoriesDuDomaine.map(c => String(c.id))}
          style={{ borderRadius: 12, border: 'none' }}>
          {categoriesDuDomaine.map(cat => (
            <Panel key={String(cat.id)}
              header={
                <Space>
                  <span style={{ fontSize: 20 }}>{cat.icone}</span>
                  <Text strong style={{ fontSize: 15 }}>{cat.nom}</Text>
                  <Tag color={cat.couleur} style={{ borderRadius: 12 }}>
                    {cat.sous_categories?.length || 0} sous-catégorie(s)
                  </Tag>
                </Space>
              }
              extra={
                <Space onClick={e => e.stopPropagation()}>
                  <Button icon={<BarChartOutlined />} size="small"
                    onClick={() => afficherStats(cat)}>Stats</Button>
                  <Button icon={<EditOutlined />} size="small"
                    onClick={() => editerCategorie(cat)}>Éditer</Button>
                  <Button type="primary" icon={<PlusOutlined />} size="small"
                    onClick={() => { setCategorieSelectionnee(cat); setScatModalVisible(true) }}>
                    Sous-cat.
                  </Button>
                  <Popconfirm title="Supprimer cette catégorie ?"
                    description="Toutes ses sous-catégories seront supprimées !"
                    onConfirm={() => supprimerCategorie(cat.id)}
                    okText="Oui" cancelText="Non">
                    <Button danger icon={<DeleteOutlined />} size="small">Supprimer</Button>
                  </Popconfirm>
                </Space>
              }
              style={{ marginBottom: 8, borderRadius: 12, border: '1px solid #f0f0f0', background: 'white' }}
            >
              {cat.sous_categories?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#888' }}>
                  <TagOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
                  <p>Aucune sous-catégorie —
                    <Button type="link" onClick={() => {
                      setCategorieSelectionnee(cat); setScatModalVisible(true)
                    }}>Ajouter</Button>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
                  {cat.sous_categories.map(scat => (
                    <Tag key={scat.id} color={cat.couleur}
                      style={{ borderRadius: 20, padding: '4px 12px', fontSize: 13 }}
                      closable onClose={() => supprimerSousCategorie(scat.id)}>
                      {cat.icone} {scat.nom}
                    </Tag>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </Collapse>
      )}

      {/* Modal Catégorie (Ajouter / Éditer) */}
      <Modal
        title={<><AppstoreOutlined /> {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}</>}
        open={editCatModalVisible || catModalVisible}
        onCancel={fermerModalCat}
        footer={null} width={450}
      >
        <Form form={formCat} layout="vertical"
          onFinish={editingCategory ? sauvegarderCategorieEditee : ajouterCategorie}>
          <Form.Item name="nom" label="Nom de la catégorie"
            rules={[{ required: true, message: 'Nom obligatoire' }]}>
            <Input placeholder="Ex: Quincaillerie, Alimentaire..." size="large" />
          </Form.Item>
          <Form.Item name="icone" label="Icône" initialValue="📦">
            <Select size="large" placeholder="Choisir une icône">
              {icones.map(ic => <Option key={ic} value={ic}>{ic} {ic}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="couleur" label="Couleur" initialValue="blue">
            <Select size="large" placeholder="Choisir une couleur">
              {couleurs.map(c => (
                <Option key={c.value} value={c.value}>
                  <Tag color={c.value}>{c.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={fermerModalCat}>Annuler</Button>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                {editingCategory ? '✏️ Modifier' : '➕ Ajouter'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Sous-catégorie */}
      <Modal
        title={
          <><TagOutlined /> Nouvelle Sous-catégorie
            {categorieSelectionnee && (
              <Tag color={categorieSelectionnee.couleur} style={{ marginLeft: 8 }}>
                {categorieSelectionnee.icone} {categorieSelectionnee.nom}
              </Tag>
            )}
          </>
        }
        open={scatModalVisible}
        onCancel={() => { setScatModalVisible(false); formScat.resetFields() }}
        footer={null} width={400}
      >
        <Form form={formScat} layout="vertical" onFinish={ajouterSousCategorie}>
          <Form.Item name="nom" label="Nom de la sous-catégorie"
            rules={[{ required: true, message: 'Nom obligatoire' }]}>
            <Input placeholder="Ex: Ordinateurs portables, Outils..." size="large" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setScatModalVisible(false); formScat.resetFields() }}>
                Annuler
              </Button>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>Ajouter</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Stats */}
      <Drawer
        title={statsCategorie &&
          <><BarChartOutlined /> Stats: {statsCategorie.categorie.icone} {statsCategorie.categorie.nom}</>}
        placement="right"
        onClose={() => setStatsDrawerVisible(false)}
        open={statsDrawerVisible} width={400}
      >
        {statsCategorie && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { titre: 'Nombre de produits', val: statsCategorie.nombreProduits, color: '#1890ff', bg: '#e6f7ff', suffix: '' },
              { titre: 'Stock total', val: statsCategorie.stockTotal, color: '#52c41a', bg: '#f6ffed', suffix: 'unités' },
              { titre: 'Valeur stock (achat)', val: statsCategorie.valeurStock, color: '#faad14', bg: '#fffbe6', suffix: 'FCFA' },
              { titre: 'Valeur vente potentielle', val: statsCategorie.prixVenteTotal, color: '#722ed1', bg: '#f9f0ff', suffix: 'FCFA' },
              { titre: 'Marge potentielle', val: statsCategorie.margeTotal, color: '#52c41a', bg: '#f6ffed', suffix: 'FCFA' }
            ].map((s, i) => (
              <Card key={i} style={{ borderRadius: 8, background: s.bg }}>
                <Statistic title={s.titre} value={s.val} suffix={s.suffix}
                  valueStyle={{ color: s.color }} precision={0} />
              </Card>
            ))}

            <Card style={{ borderRadius: 8 }}>
              <Text strong>Alertes de stock</Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={statsCategorie.alertesStock > 0 ? 'red' : 'green'} style={{ fontSize: 13 }}>
                  {statsCategorie.alertesStock > 0 ? '⚠️' : '✅'} {statsCategorie.alertesStock} produit(s)
                </Tag>
              </div>
            </Card>

            <Divider />
            <Text strong>📦 Produits dans cette catégorie</Text>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
              {statsCategorie.produitsCat.length === 0 ? (
                <Text type="secondary">Aucun produit</Text>
              ) : statsCategorie.produitsCat.map((prod, i) => (
                <div key={i} style={{
                  padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <Text style={{ fontSize: 12 }}>{prod.nom}</Text>
                  <Tag>{Number(prod.stock_actuel)} unités</Tag>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Import Pack */}
      <Modal
        title={<><ImportOutlined /> Importer le Pack de Catégories</>}
        open={packModalVisible}
        onCancel={() => setPackModalVisible(false)}
        footer={null} width={520}
      >
        {domaineActive && getDomaine(domaineActive) && (
          <>
            <Card style={{ background: '#f0f5ff', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{getDomaine(domaineActive)?.icone}</div>
              <Title level={4} style={{ margin: 0 }}>{getDomaine(domaineActive)?.nom}</Title>
              <Text type="secondary">{getDomaine(domaineActive)?.description}</Text>
            </Card>

            <Text strong>📦 Catégories incluses :</Text>
            <div style={{ maxHeight: 300, overflowY: 'auto', margin: '12px 0' }}>
              {CATEGORIES_PAR_DOMAINE[domaineActive]?.map((cat, i) => (
                <div key={i} style={{
                  padding: 10, marginBottom: 8,
                  border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa'
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{cat.icone}</span>
                    <strong style={{ marginLeft: 8 }}>{cat.nom}</strong>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cat.sousCategories.map((sub, j) => (
                      <Tag key={j} color={cat.couleur} style={{ borderRadius: 8 }}>{sub}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Divider />
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setPackModalVisible(false)}>Annuler</Button>
              <Button type="primary" icon={<ImportOutlined />}
                loading={importLoading} onClick={importerPackDomaine}>
                Importer {CATEGORIES_PAR_DOMAINE[domaineActive]?.length} catégories
              </Button>
            </Space>
          </>
        )}
      </Modal>
    </div>
  )
}

export default Categories