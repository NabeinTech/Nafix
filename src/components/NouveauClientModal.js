import React from 'react'
import { Modal, Form, Input, Select, Button, Space, message } from 'antd'
import { UserAddOutlined } from '@ant-design/icons'

const { Option } = Select
const ipcRenderer = window.ipcRenderer

function NouveauClientModal({ visible, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)

  const sauvegarder = async (values) => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('clients:create', values)
      if (result.erreur) {
        message.error(`❌ ${result.erreur}`)
        return
      }
      message.success('✅ Client ajouté avec succès !')
      form.resetFields()
      onSuccess(result)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><UserAddOutlined /> Nouveau Client</>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Form form={form} layout="vertical" onFinish={sauvegarder}>
        <Form.Item
          name="nom"
          label="Nom complet"
          rules={[{ required: true, message: 'Nom obligatoire' }]}
        >
          <Input placeholder="Ex: Nabei Diallo" />
        </Form.Item>

        <Form.Item name="type" label="Type de client" initialValue="particulier">
          <Select>
            <Option value="particulier">👤 Particulier</Option>
            <Option value="entreprise">🏢 Entreprise</Option>
          </Select>
        </Form.Item>

        <Form.Item name="telephone" label="Téléphone">
          <Input placeholder="Ex: +221 77 000 00 00" />
        </Form.Item>

        <Form.Item name="email" label="Email">
          <Input placeholder="Ex: contact@email.com" />
        </Form.Item>

        <Form.Item name="adresse" label="Adresse">
          <Input placeholder="Ex: Dakar, Senegal" />
        </Form.Item>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Annuler</Button>
            <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} loading={loading}>
              Ajouter le Client
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default NouveauClientModal
