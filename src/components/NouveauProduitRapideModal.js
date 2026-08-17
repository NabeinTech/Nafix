import React, { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Button, Space, message, Alert } from 'antd'
import { PlusCircleOutlined } from '@ant-design/icons'

const { Option } = Select
const ipcRenderer = window.ipcRenderer

// Création rapide d'un produit directement depuis la caisse — pour ne jamais
// interrompre une vente en cours quand un article n'existe pas encore au
// catalogue. Le produit créé est aussitôt ajouté au panier par l'appelant
// (voir onSuccess), sans quitter l'écran de vente.
function NouveauProduitRapideModal({
  visible, onClose, onSuccess,
  nomInitial = '', categoriesDomaine = [], uniteParDefaut = 'pièce', quantiteInitiale = 1
}) {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        nom: nomInitial,
        categorie: categoriesDomaine[0]?.nom,
        unite: uniteParDefaut,
        stock_actuel: quantiteInitiale,
        stock_minimum: 1
      })
    }
  }, [visible, nomInitial, categoriesDomaine, uniteParDefaut, quantiteInitiale, form])

  const sauvegarder = async (values) => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('produits:create', {
        ...values,
        prix_achat: values.prix_achat || 0
      })
      if (result.erreur) {
        message.error(`❌ ${result.erreur}`)
        return
      }
      message.success('✅ Produit créé et ajouté à la vente !')
      form.resetFields()
      onSuccess(result.succes)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><PlusCircleOutlined /> Nouveau produit rapide</>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
        message="Le produit sera ajouté au catalogue puis directement à la vente en cours."
      />
      <Form form={form} layout="vertical" onFinish={sauvegarder}>
        <Form.Item
          name="nom"
          label="Nom du produit"
          rules={[{ required: true, message: 'Nom obligatoire' }]}
        >
          <Input placeholder="Ex: Peinture blanche 5L" autoFocus />
        </Form.Item>

        <Form.Item
          name="categorie"
          label="Catégorie"
          rules={[{ required: true, message: 'Catégorie obligatoire' }]}
        >
          {categoriesDomaine.length > 0 ? (
            <Select placeholder="Choisir une catégorie">
              {categoriesDomaine.map(c => (
                <Option key={c.id} value={c.nom}>{c.icone} {c.nom}</Option>
              ))}
            </Select>
          ) : (
            <Input placeholder="Ex: Divers" />
          )}
        </Form.Item>

        <Space.Compact block>
          <Form.Item
            name="prix_achat" label="Prix d'achat" style={{ width: '50%' }}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
          </Form.Item>
          <Form.Item
            name="prix_vente" label="Prix de vente"
            style={{ width: '50%' }}
            rules={[{ required: true, message: 'Prix de vente obligatoire' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Space.Compact>

        <Space.Compact block>
          <Form.Item
            name="stock_actuel" label="Stock actuel" style={{ width: '50%' }}
            rules={[{ required: true, message: 'Stock obligatoire' }]}
            tooltip="Doit couvrir au moins la quantité vendue maintenant"
          >
            <InputNumber style={{ width: '100%' }} min={0} step={1} />
          </Form.Item>
          <Form.Item name="unite" label="Unité" style={{ width: '50%' }}>
            <Input placeholder="pièce, kg, sac..." />
          </Form.Item>
        </Space.Compact>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Annuler</Button>
            <Button type="primary" htmlType="submit" icon={<PlusCircleOutlined />} loading={loading}>
              Créer et ajouter à la vente
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default NouveauProduitRapideModal
