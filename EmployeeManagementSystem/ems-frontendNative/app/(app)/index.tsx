// app/(app)/index.tsx — Dashboard Screen
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../src/context/AuthContext'
import { useRouter, useFocusEffect } from 'expo-router'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { attendanceAPI, leaveAPI } from '../../src/api'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import BellButton from '../../src/components/BellButton'
import dayjs from 'dayjs'
import { useCallback } from 'react'

function StatCard({ label, value, sub, color, icon, colors }: {
  label: string; value: string | number; sub?: string; color: string; icon: string; colors: any
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
        {sub && <Text style={[styles.statSub, { color: colors.textSecondary }]}>{sub}</Text>}
      </View>
    </View>
  )
}

function QuickAction({ icon, label, color, onPress, colors }: {
  icon: string; label: string; color: string; onPress?: () => void; colors: any
}) {
  return (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function DashboardScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const Colors = useThemeColors()
  const qc = useQueryClient()

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['attendance-today'] })
    qc.invalidateQueries({ queryKey: ['leave-balance'] })
  }, [qc]))

  const { data: todayData, refetch: refetchToday, isRefetching: r1 } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceAPI.getToday(),
  })
  const { data: balanceData, refetch: refetchBalance, isRefetching: r2 } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => leaveAPI.getMyBalance(),
  })

  const today   = todayData?.data
  const balance = balanceData?.data
  const now     = dayjs()
  const isRefreshing = false

  const onRefresh = () => { refetchToday(); refetchBalance() }

  const greeting = now.hour() < 12 ? 'Good morning' : now.hour() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: Colors.textMuted }]}>{greeting},</Text>
          <Text style={[styles.userName, { color: Colors.textPrimary }]}>{user?.name?.split(' ')[0]} 👋</Text>
        </View>
        <BellButton />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Date banner */}
        <View style={[styles.dateBanner, { backgroundColor: Colors.bgCard }]}>
          <Text style={[styles.dateText, { color: Colors.textSecondary }]}>{now.format('dddd, MMMM D, YYYY')}</Text>
          <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          <Text style={[styles.dotLabel, { color: Colors.success }]}>Active</Text>
        </View>

        {/* Attendance Today */}
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Today's Attendance</Text>
        <View style={styles.row}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/attendance')}>
            <StatCard
              label="Check In"
              value={today?.checkInTime ? today.checkInTime.slice(0, 5) : '—'}
              sub={today?.checkInTime ? 'On time' : 'Not checked in'}
              color={Colors.success}
              icon="log-in-outline"
              colors={Colors}
            />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/attendance')}>
            <StatCard
              label="Check Out"
              value={today?.checkOutTime ? today.checkOutTime.slice(0, 5) : '—'}
              sub={today?.checkOutTime ? 'Completed' : 'Still working'}
              color={Colors.info}
              icon="log-out-outline"
              colors={Colors}
            />
          </TouchableOpacity>
        </View>

        {/* Leave Summary */}
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Leave Balance</Text>
        <View style={styles.row}>
          <StatCard
            label="Annual Leave"
            value={balance?.annualRemaining ?? '—'}
            sub={`of ${balance?.annualTotal ?? '?'} total`}
            color={Colors.accent}
            icon="umbrella-outline"
            colors={Colors}
          />
          <StatCard
            label="Sick / Casual"
            value={balance?.sickCasualRemaining ?? '—'}
            sub={`of ${balance?.sickCasualTotal ?? 10} total`}
            color={Colors.danger}
            icon="medkit-outline"
            colors={Colors}
          />
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon="log-in-outline"       label="Check In"      color={Colors.success} onPress={() => router.push('/attendance')} colors={Colors} />
          <QuickAction icon="log-out-outline"      label="Check Out"     color={Colors.danger}  onPress={() => router.push('/attendance')} colors={Colors} />
          <QuickAction icon="calendar-outline"     label="Request Leave" color={Colors.accent}  onPress={() => router.push('/leave')} colors={Colors} />
          <QuickAction icon="document-text-outline" label="Timesheets"   color={Colors.info}    onPress={() => router.push('/timesheets')} colors={Colors} />
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingTop: Spacing.sm },
  greeting:    { fontSize: FontSize.sm },
  userName:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  dateBanner:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, gap: 8 },
  dateText:    { fontSize: FontSize.sm, flex: 1 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  dotLabel:    { fontSize: FontSize.xs },
  sectionTitle:{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.md },
  row:         { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard:    { flex: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1 },
  statIcon:    { width: 40, height: 40, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  statValue:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel:   { fontSize: FontSize.xs, marginTop: 2 },
  statSub:     { fontSize: FontSize.xs },
  quickGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  quickAction: { width: '47%', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1 },
  quickIcon:   { width: 48, height: 48, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  quickLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
})
