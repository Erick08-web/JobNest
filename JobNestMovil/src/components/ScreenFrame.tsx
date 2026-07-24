import React from 'react';
import { ScrollView, View } from 'react-native';
import { TopBar } from './TopBar';
import { LoadingPill, Notice } from './ui';
import { useAuth } from '../context/AuthContext';
import { styles } from '../styles/theme';

export function ScreenFrame({
  children,
  onHome,
  onSettings,
}: {
  children: React.ReactNode;
  onHome: () => void;
  onSettings: () => void;
}) {
  const { user, isLoggedIn, logout, loading, apiMessage } = useAuth();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <TopBar isLoggedIn={isLoggedIn} user={user} onHome={onHome} onSettings={onSettings} onLogout={logout} />
        {apiMessage ? <Notice text={apiMessage} /> : null}
        {loading ? <LoadingPill /> : null}
        {children}
      </ScrollView>
    </View>
  );
}
