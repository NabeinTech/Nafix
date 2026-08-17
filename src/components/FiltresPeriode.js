import React, { useState } from 'react'
import { Button, Tag } from 'antd'
import {
  CalendarOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

function FiltresPeriode({ onFiltreChange }) {
  const [periodeActive, setPeriodeActive] = useState(null)

  const periodes = [
    {
      key: 'aujourd_hui',
      label: "Aujourd'hui",
      icone: '📅',
      couleur: '#1890ff',
      getRange: () => [dayjs().startOf('day'), dayjs().endOf('day')]
    },
    {
      key: 'cette_semaine',
      label: 'Cette semaine',
      icone: '📆',
      couleur: '#722ed1',
      getRange: () => [dayjs().startOf('week'), dayjs().endOf('week')]
    },
    {
      key: 'ce_mois',
      label: 'Ce mois',
      icone: '🗓️',
      couleur: '#52c41a',
      getRange: () => [dayjs().startOf('month'), dayjs().endOf('month')]
    },
    {
      key: 'ce_semestre',
      label: 'Ce semestre',
      icone: '📊',
      couleur: '#faad14',
      getRange: () => {
        const mois = dayjs().month()
        const debutSemestre = mois < 6
          ? dayjs().startOf('year')
          : dayjs().month(6).startOf('month')
        const finSemestre = mois < 6
          ? dayjs().month(5).endOf('month')
          : dayjs().endOf('year')
        return [debutSemestre, finSemestre]
      }
    },
    {
      key: 'cette_annee',
      label: 'Cette année',
      icone: '📈',
      couleur: '#ff4d4f',
      getRange: () => [dayjs().startOf('year'), dayjs().endOf('year')]
    }
  ]

  const appliquerFiltre = (periode) => {
    if (periodeActive === periode.key) {
      // Désactiver si déjà actif
      setPeriodeActive(null)
      onFiltreChange(null)
    } else {
      setPeriodeActive(periode.key)
      onFiltreChange(periode.getRange())
    }
  }

  const reinitialiser = () => {
    setPeriodeActive(null)
    onFiltreChange(null)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      padding: '8px 0'
    }}>
      <ClockCircleOutlined style={{ color: '#888' }} />
      {periodes.map(periode => (
        <Button
          key={periode.key}
          size="small"
          type={periodeActive === periode.key ? 'primary' : 'default'}
          onClick={() => appliquerFiltre(periode)}
          style={{
            borderRadius: 20,
            fontWeight: periodeActive === periode.key ? 'bold' : 'normal',
            background: periodeActive === periode.key ? periode.couleur : 'white',
            borderColor: periode.couleur,
            color: periodeActive === periode.key ? 'white' : periode.couleur
          }}
        >
          {periode.icone} {periode.label}
        </Button>
      ))}
      {periodeActive && (
        <Button
          size="small"
          onClick={reinitialiser}
          style={{ borderRadius: 20, color: '#888', borderColor: '#d9d9d9' }}
        >
          ✕ Réinitialiser
        </Button>
      )}
      {periodeActive && (
        <Tag color="blue" style={{ borderRadius: 12, marginLeft: 4 }}>
          <CalendarOutlined /> {periodes.find(p => p.key === periodeActive)?.label}
        </Tag>
      )}
    </div>
  )
}

export default FiltresPeriode