import React, { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, GhostButton, SkeletonList } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { fetchRequestMessages, sendRequestMessage } from '../../services/requestService';
import { palette, spacing, styles } from '../../styles/theme';
import type { ChatMessage, RequestItem } from '../../types/domain';
import { getRequestPerson, getRequestTitle } from '../../utils/formatters';
import { cleanText, mergeServerErrors } from '../../utils/validation';

function requestId(request: RequestItem) {
  return request.id ?? request.SolicitudId ?? null;
}

function dayFromDate(value?: string) {
  return value?.split(' ')[0] || '';
}

export function ChatScreen({ request, onBack }: { request: RequestItem; onBack: () => void }) {
  const { apiFetch, currentUserType } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const id = requestId(request);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [counterpart, setCounterpart] = useState(getRequestPerson(request, currentUserType));
  const [service, setService] = useState(getRequestTitle(request));
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchRequestMessages(apiFetch, id);
      setMessages(data.mensajes ?? []);
      setCounterpart(data.contraparte || getRequestPerson(request, currentUserType));
      setService(data.servicio || getRequestTitle(request));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (loadError) {
      const parsed = mergeServerErrors(loadError, 'No pudimos cargar la conversación.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentUserType, id, request]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!id || sending) return;
    const message = cleanText(draft);
    if (!message) {
      setError('Escribe un mensaje para enviarlo.');
      return;
    }
    if (message.length > 1000) {
      setError('El mensaje debe tener máximo 1000 caracteres.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await sendRequestMessage(apiFetch, id, message);
      setDraft('');
      await loadMessages();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (sendError) {
      const parsed = mergeServerErrors(sendError, 'No pudimos enviar el mensaje.');
      setError(parsed.message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const previous = messages[index - 1];
    const showDay = dayFromDate(previous?.enviado_en) !== dayFromDate(item.enviado_en);
    if (item.es_sistema) {
      return (
        <View>
          {showDay && item.enviado_en ? <Text style={styles.chatDay}>{dayFromDate(item.enviado_en)}</Text> : null}
          <View style={styles.systemMessage}>
            <Ionicons name="information-circle-outline" size={16} color={palette.textSecondary} />
            <Text style={styles.systemMessageText}>{item.cuerpo}</Text>
          </View>
        </View>
      );
    }
    return (
      <View>
        {showDay && item.enviado_en ? <Text style={styles.chatDay}>{dayFromDate(item.enviado_en)}</Text> : null}
        <View style={[styles.chatBubbleRow, item.es_mio && styles.chatBubbleRowMine]}>
          <View style={[styles.chatBubble, item.es_mio && styles.chatBubbleMine]}>
            <Text style={[styles.chatBubbleText, item.es_mio && styles.chatBubbleTextMine]}>{item.cuerpo}</Text>
            {item.enviado_en ? <Text style={[styles.chatTime, item.es_mio && styles.chatTimeMine]}>{item.enviado_en.split(' ').slice(1).join(' ')}</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable style={styles.iconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver a solicitudes" hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={palette.primary} />
        </Pressable>
        <View style={styles.chatHeaderText}>
          <Text style={styles.chatTitle} numberOfLines={1}>{counterpart}</Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>{service}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={loadMessages} disabled={loading} accessibilityRole="button" accessibilityLabel="Actualizar mensajes" hitSlop={8}>
          <Ionicons name="refresh" size={20} color={palette.primary} />
        </Pressable>
      </View>

      {loading && !messages.length ? <SkeletonList count={3} /> : null}
      {error ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <EmptyState title="No pudimos completar la acción" text={error} />
          <GhostButton title="Reintentar" onPress={loadMessages} disabled={loading} />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderMessage}
        contentContainerStyle={[styles.chatListContent, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMessages} tintColor={palette.primary} />}
        ListEmptyComponent={!loading && !error ? (
          <EmptyState title="Sin mensajes" text="Cuando conversen sobre este servicio, los mensajes aparecerán aquí." />
        ) : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.chatInputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={palette.textMuted}
          style={styles.chatInput}
          multiline
          maxLength={1000}
          accessibilityLabel="Mensaje"
        />
        <Pressable
          style={({ pressed }) => [styles.chatSendButton, pressed && styles.pressed, (!draft.trim() || sending) && styles.disabled]}
          onPress={sendMessage}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          accessibilityState={{ disabled: !draft.trim() || sending }}
          hitSlop={8}
        >
          <Ionicons name="send" size={18} color={palette.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
