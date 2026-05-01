// app/(app)/notifications.tsx — Notification Centre
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { notificationAPI } from '../../src/api'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const CATEGORY_ICON: Record<string, string> = {
  LEAVE:     'calendar-outline',
  TIMESHEET: 'document-text-outline',
  ATTENDANCE:'time-outline',
  SYSTEM:    'information-circle-outline',
}

const CATEGORY_COLOR = (c: string, Colors: any) => ({
  LEAVE:     Colors.accent,
  TIMESHEET: Colors.info,
  ATTENDANCE:Colors.success,
  SYSTEM:    Colors.textMuted,
}[c] ?? Colors.textMuted)

function NotifItem({ item, onRead, colors }: { item: any; onRead: (id: number) => void; colors: any }) {
  const icon  = CATEGORY_ICON[item.category] ?? 'notifications-outline'
  const color = CATEGORY_COLOR(item.category, colors)
  const time  = item.createdAt ? dayjs(item.createdAt).fromNow() : ''

  return (
    <TouchableOpacity
      style={[
        styles.item,
        { backgroundColor: item.read ? colors.bgCard : colors.accentLight, borderColor: colors.border },
      ]}
      onPress={() => !item.read && onRead(item.id)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
          {!item.read && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>{item.body}</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{time}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const Colors = useThemeColors()
  const qc = useQueryClient()

  // Refresh and mark-all-read when this tab is focused
  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notif-count'] })
  }, [qc]))

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationAPI.getMy({ page: 0, size: 50 }),
  })

  const markReadMut = useMutation({
    mutationFn: (id: number) => notificationAPI.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-count'] })
    },
  })

  const markAllMut = useMutation({
    mutationFn: () => notificationAPI.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-count'] })
    },
  })

  const items: any[] = data?.data?.content ?? []
  const hasUnread = items.some((n: any) => !n.read)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.border }]}>
        <Text style={[styles.heading, { color: Colors.textPrimary }]}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity
            onPress={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            style={[styles.markAllBtn, { borderColor: Colors.border }]}
          >
            <Text style={[styles.markAllText, { color: Colors.accent }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>All caught up</Text>
          <Text style={[styles.emptySub, { color: Colors.textMuted }]}>
            Leave and timesheet updates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NotifItem item={item} onRead={(id) => markReadMut.mutate(id)} colors={Colors} />
          )}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                padding: Spacing.md, borderBottomWidth: 1 },
  heading:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  markAllText:{ fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  item:       { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 14,
                borderBottomWidth: 1 },
  iconWrap:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
                marginTop: 2, flexShrink: 0 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1 },
  dot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  body:       { fontSize: FontSize.sm, lineHeight: 18 },
  time:       { fontSize: FontSize.xs },
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptySub:   { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
})
