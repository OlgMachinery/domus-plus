import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { AppState, Platform, View, Text, StyleSheet } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import ArchitectureNative from './src/diagram/ArchitectureNative'
import MoneyRequestsScreen from './src/screens/MoneyRequestsScreen'

const Tab = createBottomTabNavigator()
const queryClient = new QueryClient()

function useReactQueryAppStateBridge() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active')
    })
    return () => subscription.remove()
  }, [])
}

function ScreenPlaceholder({ title }: { title: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>En construcción para iPhone.</Text>
    </View>
  )
}

export default function App() {
  useReactQueryAppStateBridge()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={navTheme}>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarLabelStyle: { fontSize: 12 },
              }}
            >
              <Tab.Screen name="Inicio" children={() => <ScreenPlaceholder title="Inicio" />} />
              <Tab.Screen name="Arquitectura" component={ArchitectureNative} />
              <Tab.Screen name="Presupuesto" children={() => <ScreenPlaceholder title="Presupuesto" />} />
              <Tab.Screen name="Solicitudes" component={MoneyRequestsScreen} />
              <Tab.Screen name="Recibos" children={() => <ScreenPlaceholder title="Recibos" />} />
              <Tab.Screen name="Ajustes" children={() => <ScreenPlaceholder title="Ajustes" />} />
            </Tab.Navigator>
          </NavigationContainer>
          <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
  },
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
})
