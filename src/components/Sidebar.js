import React, { useState } from 'react'
import { Layout, Menu, Avatar, Typography, Button, Popconfirm } from 'antd'
import {
  DashboardOutlined, ShoppingOutlined, TeamOutlined,
  FileTextOutlined, ShoppingCartOutlined, FileDoneOutlined,
  AccountBookOutlined, BarChartOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined, AppstoreOutlined, RobotOutlined,
  FundProjectionScreenOutlined, BulbOutlined, InboxOutlined,
  TruckOutlined, CalendarOutlined, WalletOutlined, AudioOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { utilisateurPeutAcceder } from '../utils/permissions'

const { Sider } = Layout
const { Text } = Typography

function Sidebar({ utilisateur, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const role = utilisateur?.role || 'caissier'

  const tousLesItems = [
    // ── 1. Tableau de bord ───────────────────────────────────────────
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Tableau de bord',
      module: '/'
    },

    // ── 2. Commercial ────────────────────────────────────────────────
    {
      key: 'commercial',
      icon: <ShoppingCartOutlined />,
      label: 'Commercial',
      module: null,
      children: [
        { key: '/ventes',            icon: <ShoppingCartOutlined />, label: 'Ventes',           module: '/ventes'            },
        { key: '/devis',             icon: <FileDoneOutlined />,     label: 'Devis',            module: '/devis'             },
        { key: '/factures',          icon: <FileTextOutlined />,     label: 'Factures',         module: '/factures'          },
        { key: '/clients',           icon: <TeamOutlined />,         label: 'Clients',          module: '/clients'           },
        { key: '/commandes',         icon: <CalendarOutlined />,     label: 'Commandes',        module: '/commandes'         },
        { key: '/comptes-prepayes',  icon: <WalletOutlined />,       label: 'Comptes Prépayés', module: '/comptes-prepayes'  }
      ]
    },

    // ── 3. Inventaire ────────────────────────────────────────────────
    {
      key: 'inventaire',
      icon: <InboxOutlined />,
      label: 'Inventaire',
      module: null,
      children: [
        { key: '/produits',     icon: <ShoppingOutlined />, label: 'Produits',     module: '/produits'     },
        { key: '/categories',   icon: <AppstoreOutlined />, label: 'Catégories',   module: '/categories'   },
        { key: '/fournisseurs', icon: <TruckOutlined />,    label: 'Fournisseurs', module: '/fournisseurs' }
      ]
    },

    // ── 4. Finances & Reporting ──────────────────────────────────────
    {
      key: 'finances',
      icon: <FundProjectionScreenOutlined />,
      label: 'Finances & Reporting',
      module: null,
      children: [
        { key: '/comptabilite',  icon: <AccountBookOutlined />, label: 'Comptabilité',          module: '/comptabilite'  },
        { key: '/statistiques',  icon: <BarChartOutlined />,    label: 'Statistiques',           module: '/statistiques'  }
      ]
    },

    // ── 5. Intelligence IA ───────────────────────────────────────────
    {
      key: 'ia',
      icon: <BulbOutlined />,
      label: 'Intelligence IA',
      module: null,
      children: [
        { key: '/ai',           icon: <RobotOutlined />, label: 'Nafix AI',  module: '/ai' },
        { key: '/ai-assistant', icon: <RobotOutlined />, label: 'Aide IA',   module: '/ai' },
        { key: '/voice',        icon: <AudioOutlined />, label: 'Nafix Voice', module: '/voice' }
      ]
    },

    // ── 6. Paramètres ────────────────────────────────────────────────
    {
      key: '/parametres',
      icon: <SettingOutlined />,
      label: 'Paramètres',
      module: '/parametres'
    }
  ]

  // ✅ Filtrer les items selon le rôle (+ permissions custom)
  const filtrerItems = (items) => {
    return items
      .filter(item => {
        if (item.module === null) return true
        return utilisateurPeutAcceder(utilisateur, item.module)
      })
      .map(item => {
        if (item.children) {
          const enfantsFiltres = item.children.filter(
            child => utilisateurPeutAcceder(utilisateur, child.module)
          )
          if (enfantsFiltres.length === 0) return null
          return { ...item, children: enfantsFiltres }
        }
        return item
      })
      .filter(Boolean)
  }

  const itemsFiltres = filtrerItems(tousLesItems)

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={220}
    >
      {/* Logo */}
      <div style={{
        textAlign: 'center',
        padding: collapsed ? '12px 8px' : '12px 16px',
        borderBottom: '1px solid #ffffff20',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src="nafix-logo.png"
          alt="Nafix"
          style={{
            width: collapsed ? 40 : 140,
            height: collapsed ? 40 : 140,
            objectFit: 'contain',
            borderRadius: collapsed ? 8 : 16,
            transition: 'all 0.2s ease'
          }}
        />
      </div>

      {/* Infos utilisateur */}
      {!collapsed && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #ffffff20',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Avatar
            size={32}
            style={{ background: '#1890ff', flexShrink: 0 }}
            icon={<UserOutlined />}
          />
          <div style={{ overflow: 'hidden' }}>
            <Text style={{
              color: 'white',
              fontSize: 12,
              fontWeight: 'bold',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {utilisateur?.nom || 'Utilisateur'}
            </Text>
            <Text style={{
              color: '#ffffff60',
              fontSize: 11,
              display: 'block',
              textTransform: 'capitalize'
            }}>
              {role}
            </Text>
          </div>
        </div>
      )}

      {/* Menu filtré */}
      <Menu
        theme="dark"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={['commercial', 'inventaire', 'finances', 'ia']}
        mode="inline"
        items={itemsFiltres}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1 }}
      />

      {/* Bouton Déconnexion */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #ffffff20'
      }}>
        <Popconfirm
          title="Se déconnecter ?"
          description="Voulez-vous vraiment vous déconnecter ?"
          onConfirm={onLogout}
          okText="Oui"
          cancelText="Non"
          placement="rightTop"
        >
          <Button
            danger
            icon={<LogoutOutlined />}
            style={{ width: '100%' }}
          >
            {!collapsed && 'Déconnexion'}
          </Button>
        </Popconfirm>
      </div>
    </Sider>
  )
}

export default Sidebar