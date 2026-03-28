// mobile/App.tsx
// Entry point. Uses Expo Router via app/ directory convention.
// Run: npx expo start

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initApiClient } from '@schoolos/api-client';

export default function App() {
  useEffect(() => {
    // Point at your backend — override in .env
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
    initApiClient(apiUrl);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {/* Expo Router handles navigation via mobile/app/ directory */}
    </GestureHandlerRootView>
  );
}
