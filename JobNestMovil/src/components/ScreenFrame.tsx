import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from './TopBar';
import { LoadingPill, Notice } from './ui';
import { useAuth } from '../context/AuthContext';
import { styles } from '../styles/theme';

export function ScreenFrame({
  children,
  onHome,
  onSettings,
  scroll = true,
}: {
  children: React.ReactNode;
  onHome: () => void;
  onSettings: () => void;
  scroll?: boolean;
}) {
  const { user, isLoggedIn, loading, apiMessage } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.appHeader}>
        <TopBar isLoggedIn={isLoggedIn} user={user} onHome={onHome} onSettings={onSettings} />
      </View>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 120, 136) }]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {apiMessage ? <Notice text={apiMessage} /> : null}
          {loading ? <LoadingPill /> : null}
          {children}
        </ScrollView>
      ) : (
        <View style={styles.screenBody}>
          {apiMessage ? <Notice text={apiMessage} /> : null}
          {loading ? <LoadingPill /> : null}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
