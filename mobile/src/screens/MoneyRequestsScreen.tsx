import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  ScrollView,
} from 'react-native'
import { fetchMoneyRequests, getStoredToken } from '../api/client'
import type { MoneyRequestItem } from '../api/types'

const BASE_WEB = 'https://domus-fam.com'

function formatMoney(amount: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING': return 'Pendiente'
    case 'APPROVED': return 'Aprobada'
    case 'REJECTED': return 'Rechazada'
    case 'DELIVERED': return 'Entregada'
    default: return status
  }
}

function Row({
  item,
  onPress,
  isSelected,
}: {
  item: MoneyRequestItem
  onPress: () => void
  isSelected: boolean
}) {
  const amount = Number(item.amount)
  const name = item.createdBy?.name || item.createdBy?.email || '—'
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('es-MX') : '—'
  return (
    <Pressable
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={onPress}
    >
      <View style={styles.rowMain}>
        <Text style={styles.code}>{item.registrationCode ?? '—'}</Text>
        <Text style={styles.reason} numberOfLines={1}>{item.reason || '—'}</Text>
        <Text style={styles.amount}>{formatMoney(amount, item.currency)}</Text>
        <Text style={styles.muted}>{name} · {dateStr}</Text>
      </View>
      <View style={styles.statusWrap}>
        <View style={[styles.pill, item.status === 'PENDING' && styles.pillWarn, item.status === 'APPROVED' && styles.pillOk, item.status === 'DELIVERED' && styles.pillOk]}>
          <Text style={styles.pillText}>{statusLabel(item.status)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function MoneyRequestsScreen() {
  const [token, setToken] = useState<string | null>(null)
  const [list, setList] = useState<MoneyRequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (tok: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetchMoneyRequests(tok)
      setList(Array.isArray(res?.moneyRequests) ? res.moneyRequests : [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar solicitudes'
      setError(msg)
      setList([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    getStoredToken().then((t) => {
      if (t) {
        setToken(t)
        load(t)
      } else {
        setError('Inicia sesión en la app')
      }
    })
  }, [load])

  const onRefresh = useCallback(() => {
    if (token) load(token, true)
  }, [token, load])

  const selected = selectedId ? list.find((r) => r.id === selectedId) : null

  const openWebSolicitudes = () => {
    Linking.openURL(`${BASE_WEB}/ui`).catch(() => {})
  }

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Inicia sesión para ver solicitudes de efectivo o pago.</Text>
        <Text style={styles.muted}>Abre la web en el navegador para iniciar sesión.</Text>
      </View>
    )
  }

  if (loading && list.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.muted}>Cargando solicitudes de efectivo…</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Solicitudes de efectivo o pago</Text>
        <Text style={styles.subtitle}>Solicita dinero en efectivo o pago de servicios: colegiatura, cine, préstamo, mensualidades, etc. Crear y gestionar en domus-fam.com</Text>
        <Pressable style={styles.btnWeb} onPress={openWebSolicitudes}>
          <Text style={styles.btnWebText}>Abrir en navegador para crear o gestionar</Text>
        </Pressable>
      </View>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Row
            item={item}
            onPress={() => setSelectedId(selectedId === item.id ? null : item.id)}
            isSelected={selectedId === item.id}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>No hay solicitudes de efectivo o pago.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          selected ? (
            <ScrollView style={styles.detail} contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailTitle}>{selected.registrationCode} — {selected.reason}</Text>
              <Text style={styles.muted}>Solicitante: {selected.createdBy?.name ?? selected.createdBy?.email} · Monto: {formatMoney(Number(selected.amount), selected.currency)} · Fecha: {selected.date ? new Date(selected.date).toLocaleDateString('es-MX') : '—'}</Text>
              {selected.allocation ? (
                <Text style={styles.muted}>Partida: {selected.allocation.entity?.name} → {selected.allocation.category?.name}</Text>
              ) : null}
              <Pressable style={styles.closeDetail} onPress={() => setSelectedId(null)}>
                <Text style={styles.closeDetailText}>Cerrar detalle</Text>
              </Pressable>
            </ScrollView>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 16, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  btnWeb: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#0f172a', borderRadius: 8 },
  btnWebText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  errorBanner: { padding: 12, backgroundColor: '#fef2f2', margin: 16, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  retryBtn: { marginTop: 8 },
  retryBtnText: { color: '#0f172a', fontWeight: '600' },
  empty: { padding: 24, alignItems: 'center' },
  muted: { fontSize: 13, color: '#64748b', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowSelected: { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' },
  rowMain: { flex: 1 },
  code: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  reason: { fontSize: 14, color: '#334155', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  statusWrap: { marginLeft: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#e2e8f0' },
  pillWarn: { backgroundColor: '#fef3c7' },
  pillOk: { backgroundColor: '#d1fae5' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  detail: { margin: 16, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  detailContent: { padding: 16 },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeDetail: { marginTop: 12 },
  closeDetailText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
})
