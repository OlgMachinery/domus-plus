import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Dimensions, TextInput, Pressable, ActivityIndicator, Modal, ScrollView } from 'react-native'
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { placeTree, RawNode } from './layout'
import {
  fetchAllocations,
  fetchCategories,
  fetchEntities,
  fetchFamily,
  fetchMembers,
  getStoredToken,
  login,
  logout,
} from '../api/client'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.6

export default function ArchitectureNative() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tree, setTree] = useState<RawNode | null>(null)
  const [showMembers, setShowMembers] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [usedCache, setUsedCache] = useState(false)

  useEffect(() => {
    getStoredToken().then((t) => {
      if (t) {
        setToken(t)
        loadData(t)
      } else {
        // intentar cache local
        loadCachedTree()
      }
    })
  }, [])

  const loadCachedTree = async () => {
    try {
      const raw = await AsyncStorage.getItem('domus-tree-cache')
      if (raw) {
        const parsed = JSON.parse(raw)
        setTree(parsed)
        setUsedCache(true)
      }
    } catch {}
  }

  const loadData = async (tok: string) => {
    try {
      setLoading(true)
      setError(null)
      setUsedCache(false)
      const [familyRes, entitiesRes, allocsRes, catsRes, membersRes] = await Promise.all([
        fetchFamily(tok),
        fetchEntities(tok),
        fetchAllocations(tok),
        fetchCategories(tok),
        fetchMembers(tok),
      ])
      const familyName = familyRes.family?.name || 'Familia'
      const entities = entitiesRes.entities || []
      const allocs = allocsRes.allocations || []
      const categories = catsRes.categories || []
      const members = membersRes.members || []

      const children = entities.map((e) => {
        const allocChildren = allocs
          .filter((a) => a.entity?.id === e.id)
          .map((a) => ({
            id: a.id,
            label: a.category?.name || 'Partida',
            type: a.category?.type || 'TYPE_OTHER',
            children: [],
          }))
        const catChildren = categories
          .filter((c) => c.entityId === e.id)
          .map((c) => ({ id: c.id, label: c.name || 'Partida', type: c.type || 'TYPE_OTHER', children: [] }))
        return {
          id: e.id,
          label: e.name || 'Entidad',
          type: e.type || 'TYPE_OTHER',
          children: [...allocChildren, ...catChildren],
        }
      })

      const memberNodes: RawNode[] = members.map((m) => ({
        id: m.id,
        label: m.name || 'Miembro',
        type: 'TYPE_PERSON',
        children: [],
      }))

      const root: RawNode = {
        id: 'root',
        label: familyName,
        type: 'ROOT',
        children: [...children, ...(showMembers ? memberNodes : [])],
      }
      setTree(root)
      await AsyncStorage.setItem('domus-tree-cache', JSON.stringify(root))
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar datos')
      await loadCachedTree()
    } finally {
      setLoading(false)
    }
  }

  const doLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const tok = await login(email.trim().toLowerCase(), password)
      setToken(tok)
      await loadData(tok)
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const { nodes, edges, bounds } = useMemo(() => {
    const t = tree || { id: 'demo', label: 'Organigrama', children: [] }
    return placeTree(t)
  }, [tree])

  useEffect(() => {
    translateX.value = SCREEN_W * 0.5 - bounds.width * 0.5
    translateY.value = 32
    scale.value = 0.9
  }, [bounds.width, bounds.height, scale, translateX, translateY])

  const translateX = useSharedValue(SCREEN_W * 0.5 - bounds.width * 0.5)
  const translateY = useSharedValue(32)
  const scale = useSharedValue(0.9)

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value += e.changeX
      translateY.value += e.changeY
    })

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = clamp(scale.value * e.scale, MIN_ZOOM, MAX_ZOOM)
      // opcional: ajustar pan para centrar en el gesto
      translateX.value += (1 - e.scale) * (e.focalX - SCREEN_W / 2)
      translateY.value += (1 - e.scale) * (e.focalY - SCREEN_H / 2)
      scale.value = next
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 0.8 : 1.3
      scale.value = withTiming(clamp(next, MIN_ZOOM, MAX_ZOOM), { duration: 160 })
    })

  const composed = Gesture.Simultaneous(pan, pinch, doubleTap)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Arquitectura (nativo iOS)</Text>

      {!token ? (
        <View style={styles.formRow}>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable style={styles.btn} onPress={doLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? '...' : 'Entrar'}</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {error && token ? (
        <Pressable style={styles.btnGhost} onPress={() => loadData(token)}>
          <Text style={styles.btnGhostText}>Reintentar</Text>
        </Pressable>
      ) : null}
      {loading && token ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Cargando datos…</Text>
        </View>
      ) : null}
      {!loading && usedCache ? <Text style={styles.cacheNote}>Mostrando datos en caché</Text> : null}

      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Svg width={bounds.width} height={bounds.height}>
            {edges.map((e) => {
              const stroke = colorForDepth(e.to.depth)
              return (
                <Line
                  key={e.id}
                  x1={e.from.x}
                  y1={e.from.y + e.from.height}
                  x2={e.to.x}
                  y2={e.to.y}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            })}
            {nodes.map((n) => {
              const fill = colorForType(n.type)
              const stroke = '#0f172a'
              const [line1, line2] = splitLabel(n.label)
              return (
                <React.Fragment key={n.id}>
                  <Rect
                    x={n.x - n.width / 2}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={12}
                    ry={12}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                  />
                  <SvgText x={n.x} y={n.y + n.height / 2 - 2} fontSize={16} fontWeight="700" fill="#0f172a" textAnchor="middle">
                    {line1}
                  </SvgText>
                  {line2 ? (
                    <SvgText x={n.x} y={n.y + n.height / 2 + 18} fontSize={13} fontWeight="600" fill="#0f172a" textAnchor="middle">
                      {line2}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              )
            })}
          </Svg>
        </Animated.View>
      </GestureDetector>
      <View style={styles.fabRow}>
        <Pressable style={styles.fab} onPress={() => flowApiReset(translateX, translateY, scale, bounds)}>
          <Text style={styles.fabText}>Ajustar</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => flowApiCenter(translateX, translateY, scale, bounds)}>
          <Text style={styles.fabText}>Centrar</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => setOptionsOpen(true)}>
          <Text style={styles.fabText}>Opciones</Text>
        </Pressable>
      </View>
      {!loading && token && nodes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sin datos de diagrama.</Text>
          <Pressable style={styles.btnGhost} onPress={() => loadData(token)}>
            <Text style={styles.btnGhostText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={optionsOpen} transparent animationType="slide" onRequestClose={() => setOptionsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOptionsOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Opciones</Text>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Mostrar miembros</Text>
              <Pressable
                style={[styles.toggle, showMembers && styles.toggleOn]}
                onPress={() => {
                  setShowMembers((v) => !v)
                  if (token) loadData(token)
                }}
              >
                <Text style={[styles.toggleText, showMembers && styles.toggleTextOn]}>{showMembers ? 'ON' : 'OFF'}</Text>
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.optionLabel}>Leyenda</Text>
              {legendEntries.map((l) => (
                <View key={l.label} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: l.color }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.btnSheet} onPress={() => flowApiReset(translateX, translateY, scale, bounds)}>
              <Text style={styles.btnSheetText}>Reset vista</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSheet, { backgroundColor: '#b91c1c', borderColor: '#b91c1c' }]}
              onPress={async () => {
                await logout()
                setToken(null)
                setTree(null)
                setOptionsOpen(false)
              }}
            >
              <Text style={styles.btnSheetText}>Cerrar sesión</Text>
            </Pressable>
            <Pressable style={styles.btnSheet} onPress={() => setOptionsOpen(false)}>
              <Text style={styles.btnSheetText}>Cerrar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

function clamp(v: number, min: number, max: number) {
  'worklet'
  return Math.min(max, Math.max(min, v))
}

function colorForDepth(depth: number) {
  if (depth === 0) return '#0f172a'
  if (depth === 1) return '#2563eb'
  if (depth === 2) return '#0ea5e9'
  return '#94a3b8'
}

function colorForType(type?: string) {
  switch (type) {
    case 'ROOT':
      return '#e2e8f0'
    case 'TYPE_PERSON':
      return '#fef3c7'
    case 'TYPE_HOUSE':
      return '#e2f0ff'
    case 'TYPE_VEHICLE':
      return '#e0f2fe'
    case 'TYPE_PROJECT':
      return '#e0f7f2'
    case 'TYPE_FUND':
      return '#f0f9ff'
    case 'TYPE_GROUP':
      return '#f1f5f9'
    default:
      return '#f8fafc'
  }
}

const legendEntries = [
  { label: 'Familia (root)', color: colorForType('ROOT') },
  { label: 'Persona', color: colorForType('TYPE_PERSON') },
  { label: 'Casa', color: colorForType('TYPE_HOUSE') },
  { label: 'Vehículo', color: colorForType('TYPE_VEHICLE') },
  { label: 'Proyecto', color: colorForType('TYPE_PROJECT') },
  { label: 'Fondo', color: colorForType('TYPE_FUND') },
  { label: 'Grupo', color: colorForType('TYPE_GROUP') },
  { label: 'Partida/Otro', color: colorForType('TYPE_OTHER') },
]

function splitLabel(label: string): [string, string | null] {
  if (label.length <= 16) return [label, null]
  const words = label.split(' ')
  let line1 = ''
  let line2 = ''
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 16) line1 = (line1 + ' ' + w).trim()
    else line2 = (line2 + ' ' + w).trim()
  }
  if (!line1) return [label.slice(0, 16), label.slice(16)]
  return [line1, line2 || null]
}

function flowApiReset(tx: any, ty: any, sc: any, bounds: { width: number; height: number }) {
  tx.value = withTiming(SCREEN_W * 0.5 - bounds.width * 0.5, { duration: 180 })
  ty.value = withTiming(32, { duration: 180 })
  sc.value = withTiming(0.9, { duration: 180 })
}

function flowApiCenter(tx: any, ty: any, sc: any, bounds: { width: number; height: number }) {
  tx.value = withTiming(SCREEN_W * 0.5 - bounds.width * 0.5, { duration: 180 })
  ty.value = withTiming(SCREEN_H * 0.5 - bounds.height * 0.5, { duration: 180 })
  sc.value = withTiming(1, { duration: 180 })
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  title: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  formRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    flexGrow: 1,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderRadius: 10,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    marginHorizontal: 12,
    marginBottom: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  loadingText: { color: '#475569' },
  cacheNote: { color: '#475569', paddingHorizontal: 12, paddingBottom: 4, fontSize: 13 },
  canvasWrapper: {
    flex: 1,
    alignSelf: 'center',
  },
  empty: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f8fafcaa',
    borderRadius: 12,
  },
  emptyText: { color: '#0f172a', fontWeight: '600' },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0f172a',
  },
  btnGhostText: { color: '#0f172a', fontWeight: '700' },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a55',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_H * 0.55,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 50,
    height: 5,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: { color: '#0f172a', fontSize: 15 },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  toggleOn: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  toggleText: { color: '#0f172a', fontWeight: '700' },
  toggleTextOn: { color: '#fff' },
  btnSheet: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#0f172a',
  },
  btnSheetText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#0f172a33' },
  legendText: { color: '#0f172a', fontSize: 14 },
  fabRow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  fab: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontWeight: '700' },
})
