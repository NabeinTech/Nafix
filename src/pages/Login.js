import React, { useState } from 'react'
import { Form, Input, Button, Typography, message, Divider } from 'antd'
import {
  UserOutlined, LockOutlined,
  ShopOutlined, SafetyOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('connexion') // 'connexion' | 'inscription'
  const [form] = Form.useForm()
  const [formInscription] = Form.useForm()

  const seConnecter = async (values) => {
    if (!ipcRenderer) {
      message.error('❌ Lancez l\'application via Electron (npm run dev), pas dans un navigateur.')
      return
    }
    setLoading(true)
    const result = await ipcRenderer.invoke('auth:login', values)

    if (result.erreur) {
      message.error(`❌ ${result.erreur}`)
      setLoading(false)
      return
    }

    message.success('✅ Connexion réussie !')
    setLoading(false)
    onLoginSuccess(result.utilisateur)
  }

  const creerOrganisation = async (values) => {
    if (!ipcRenderer) {
      message.error('❌ Lancez l\'application via Electron (npm run dev), pas dans un navigateur.')
      return
    }
    setLoading(true)
    const result = await ipcRenderer.invoke('organisations:creerAvecAdmin', {
      nom: values.nomOrganisation,
      adminNom: values.adminNom,
      username: values.username,
      password: values.password
    })

    if (result.erreur) {
      message.error(`❌ ${result.erreur}`)
      setLoading(false)
      return
    }

    message.success('✅ Organisation créée !')
    setLoading(false)
    onLoginSuccess(result.utilisateur)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#f0f2f5'
    }}>
      {/* Panneau gauche — Branding */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        color: 'white'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <img
            src="nafix-logo.png"
            alt="Nafix"
            style={{
              width: 200,
              height: 200,
              objectFit: 'contain',
              borderRadius: 24,
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))'
            }}
          />
        </div>

        <Title level={3} style={{
          color: 'white',
          margin: '0 0 8px',
          textAlign: 'center'
        }}>
          Gestion Commerciale
        </Title>

        <Text style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 48
        }}>
          Nafimax Store — Votre partenaire tech
        </Text>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '0 0 32px' }} />

        {[
          { icone: '📦', texte: 'Gestion des stocks en temps réel' },
          { icone: '🛒', texte: 'Suivi des ventes et devis' },
          { icone: '📊', texte: 'Statistiques et rapports' },
          { icone: '👥', texte: 'Gestion clients et utilisateurs' }
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            width: '100%',
            maxWidth: 320
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 20
            }}>
              {item.icone}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>
              {item.texte}
            </Text>
          </div>
        ))}

        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: '50%',
          textAlign: 'center'
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            Version 1.0.0 — Nafix © 2025
          </Text>
        </div>
      </div>

      {/* Panneau droit — Formulaire */}
      <div style={{
        width: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        background: 'white',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1890ff, #722ed1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(24,144,255,0.3)'
        }}>
          <ShopOutlined style={{ fontSize: 32, color: 'white' }} />
        </div>

        <Title level={2} style={{ margin: '0 0 8px', color: '#1a1a2e' }}>
          {mode === 'connexion' ? 'Connexion' : 'Créer mon organisation'}
        </Title>
        <Text style={{ color: '#888', marginBottom: 40, display: 'block' }}>
          {mode === 'connexion'
            ? 'Entrez vos identifiants pour accéder à Nafix'
            : 'Nouvelle entreprise sur Nafix — créez votre espace et votre compte administrateur'}
        </Text>

        {mode === 'connexion' ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={seConnecter}
            style={{ width: '100%' }}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Identifiant obligatoire' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                placeholder="Identifiant"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Mot de passe obligatoire' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                placeholder="Mot de passe"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                style={{
                  width: '100%', height: 50,
                  borderRadius: 10, fontSize: 16,
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #1890ff, #722ed1)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(24,144,255,0.4)'
                }}
              >
                {loading ? 'Connexion...' : 'Se Connecter'}
              </Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}>
              <a href="https://nafix.digital/mot-de-passe-oublie.html" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                Mot de passe oublié ?
              </a>
            </div>
          </Form>
        ) : (
          <Form
            form={formInscription}
            layout="vertical"
            onFinish={creerOrganisation}
            style={{ width: '100%' }}
          >
            <Form.Item
              name="nomOrganisation"
              rules={[{ required: true, message: 'Nom de l\'entreprise obligatoire' }]}
            >
              <Input
                prefix={<ShopOutlined style={{ color: '#1890ff' }} />}
                placeholder="Nom de votre entreprise"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="adminNom"
              rules={[{ required: true, message: 'Votre nom obligatoire' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                placeholder="Votre nom complet"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Identifiant obligatoire' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                placeholder="Choisissez un identifiant"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Mot de passe obligatoire' }, { min: 6, message: 'Au moins 6 caractères' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                placeholder="Choisissez un mot de passe"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="passwordConfirm"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Confirmation obligatoire' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve()
                    return Promise.reject(new Error('Les mots de passe ne correspondent pas'))
                  }
                })
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                placeholder="Confirmez le mot de passe"
                size="large"
                style={{ borderRadius: 10, height: 50, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                style={{
                  width: '100%', height: 50,
                  borderRadius: 10, fontSize: 16,
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #1890ff, #722ed1)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(24,144,255,0.4)'
                }}
              >
                {loading ? 'Création...' : 'Créer mon organisation'}
              </Button>
            </Form.Item>
          </Form>
        )}

        <Button
          type="link"
          onClick={() => setMode(mode === 'connexion' ? 'inscription' : 'connexion')}
          style={{ marginBottom: 24, padding: 0 }}
        >
          {mode === 'connexion' ? "Nouvelle entreprise ? Créer mon organisation" : '← Retour à la connexion'}
        </Button>

        {mode === 'connexion' && (
          <div style={{
            width: '100%',
            background: '#f6f8ff',
            border: '1px solid #d6e4ff',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <SafetyOutlined style={{ color: '#1890ff', fontSize: 18 }} />
            <div>
              <Text style={{
                color: '#1890ff', fontWeight: 'bold',
                display: 'block', fontSize: 13
              }}>
                Accès sécurisé
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>
                Contactez votre administrateur en cas de problème de connexion.
              </Text>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login