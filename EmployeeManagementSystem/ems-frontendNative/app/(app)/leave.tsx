// app/(app)/leave.tsx — Leave Screen with Manager Review
import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { leaveAPI, holidayAPI } from '../../src/api'
import { useAuth } from '../../src/context/AuthContext'
// ✅ FIX 1: Use useThemeColors hook (same as profile.tsx) so light/dark mode works app-wide
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import dayjs from 'dayjs'

const LEAVE_TYPES = [
  { value: 'ANNUAL',       label: 'Annual Leave' },
  { value: 'SICK',         label: 'Sick Leave' },
  { value: 'CASUAL',       label: 'Casual Leave' },
  { value: 'UNPAID',       label: 'Unpaid Leave' },
  { value: 'MATERNITY',    label: 'Maternity Leave' },
  { value: 'PATERNITY',    label: 'Paternity Leave' },
  { value: 'COMPENSATORY', label: 'Compensatory Leave' },
]

// ✅ FIX 2: BalanceCard now accepts Colors as a prop and uses flex: 1 instead of fixed width
function BalanceCard({ label, remaining, total, used, color, icon, hidden, colors }: any) {
  if (hidden) return null
  return (
    <View style={[
      balanceCardStyle.card,
      {
        borderTopColor: color,
        borderTopWidth: 3,
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
      }
    ]}>
      <View style={[balanceCardStyle.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[balanceCardStyle.label, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[balanceCardStyle.value, { color }]}>{remaining ?? used ?? '—'}</Text>
      <Text style={[balanceCardStyle.sub, { color: colors.textMuted }]}>
        {remaining != null ? 'remaining' : 'used this year'}
      </Text>
      {total != null && (
        <Text style={[balanceCardStyle.sub2, { color: colors.textSecondary }]}>of {total} total</Text>
      )}
    </View>
  )
}

// Extracted to a plain object (not StyleSheet) so we can merge dynamic colors above
const balanceCardStyle = {
  card:  { flex: 1, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' as const, gap: 4, borderWidth: 1 },
  icon:  { width: 36, height: 36, borderRadius: Radius.sm, justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 4 },
  label: { fontSize: 10, fontWeight: FontWeight.bold, textAlign: 'center' as const },
  value: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  sub:   { fontSize: 10 },
  sub2:  { fontSize: 10 },
}

// Count weekdays that are not public holidays
function countWorkingDays(start: string, end: string, holidaySet: Set<string>): number {
  if (!start || !end || end < start) return 0
  let count = 0
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur <= endDate) {
    const dow = cur.getDay()
    const dateStr = cur.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'my',      label: 'My Leaves',       icon: 'calendar-outline' as const },
  { key: 'pending', label: 'Pending Review',   icon: 'hourglass-outline' as const, adminOnly: true },
  { key: 'all',     label: 'All Requests',     icon: 'list-outline' as const,      adminOnly: true },
]

export default function LeaveScreen() {
  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin() || isManager()
  const qc = useQueryClient()

  // ✅ FIX 1: useThemeColors instead of static Colors import
  const Colors = useThemeColors()

  const [activeTab, setActiveTab] = useState('my')
  const [modalOpen, setModalOpen] = useState(false)
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [reason,    setReason]    = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Working-day preview — fetch holidays for the year the leave starts in
  const leaveYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear()
  const { data: holidayData } = useQuery({
    queryKey: ['holidays', leaveYear],
    queryFn: () => holidayAPI.getByYear(leaveYear),
    staleTime: 1000 * 60 * 10,
    enabled: modalOpen,
  })
  const holidaySet = useMemo(() => {
    const raw = holidayData?.data || []
    if (!Array.isArray(raw)) return new Set<string>()
    return new Set<string>(raw.map((h: any) => h?.holidayDate).filter(Boolean))
  }, [holidayData])
  const workingDays = countWorkingDays(startDate, endDate, holidaySet)

  // ── My leave data ──────────────────────────────────────────────────────────
  const { data: balData, refetch, isRefetching } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => leaveAPI.getMyBalance(),
  })

  const { data: myLeaves, refetch: refetchLeaves } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => leaveAPI.getMyLeaves({ page: 0, size: 20 }),
  })

  // ── Pending for review (manager/admin) ─────────────────────────────────────
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['pending-leaves'],
    queryFn: () => leaveAPI.getPending({ page: 0, size: 50 }),
    enabled: canManage && activeTab === 'pending',
  })

  // ── All requests (manager/admin) ───────────────────────────────────────────
  const { data: allData, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['all-leaves', filterStatus],
    queryFn: () => leaveAPI.getAll(undefined, filterStatus || undefined, { page: 0, size: 50 }),
    enabled: canManage && activeTab === 'all',
  })

  // ── Submit leave ───────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: () => leaveAPI.submit({ leaveType, startDate, endDate, reason }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Leave request submitted!' })
      setModalOpen(false); setLeaveType('ANNUAL'); setStartDate(''); setEndDate(''); setReason('')
      refetch(); refetchLeaves()
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.response?.data?.message || 'Something went wrong' })
    },
  })

  // ── Review leave (approve/reject) ──────────────────────────────────────────
  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      leaveAPI.review(id, action, reviewNotes || undefined),
    onSuccess: (_, { action }) => {
      Toast.show({ type: 'success', text1: `Leave ${action === 'APPROVED' ? 'approved' : 'rejected'}!` })
      setReviewNotes('')
      qc.invalidateQueries({ queryKey: ['pending-leaves'] })
      qc.invalidateQueries({ queryKey: ['all-leaves'] })
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Review failed', text2: err?.response?.data?.message || 'Try again' })
    },
  })

  const b = balData?.data
  const leaves = myLeaves?.data?.content || []
  const pendingLeaves = pendingData?.data?.content || []
  const allLeaves = allData?.data?.content || []

  const statusColor = (s: string) =>
    s === 'APPROVED' ? Colors.success : s === 'REJECTED' ? Colors.danger : Colors.warning

  const availableLeaveTypes = LEAVE_TYPES.filter(t => {
    if (t.value === 'MATERNITY' && b?.maternityTotal == null) return false
    if (t.value === 'PATERNITY' && b?.paternityTotal == null) return false
    return true
  })

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  const handleReview = (id: number, action: string) => {
    const isSelf = pendingLeaves.find((l: any) => l.id === id)?.empId === user?.empId
    if (isSelf) {
      Alert.alert('Cannot Review', 'You cannot approve/reject your own leave request.')
      return
    }
    Alert.alert(
      `${action === 'APPROVED' ? 'Approve' : 'Reject'} Leave?`,
      'Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action === 'APPROVED' ? 'Approve' : 'Reject', onPress: () => reviewMutation.mutate({ id, action }) },
      ]
    )
  }

  const doRefresh = () => {
    refetch(); refetchLeaves()
    if (canManage) { refetchPending(); refetchAll() }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Leave Management</Text>
        <TouchableOpacity style={[styles.requestBtn, { backgroundColor: Colors.accent }]} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.requestBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      {visibleTabs.length > 1 && (
        <View style={[styles.tabRow, { borderBottomColor: Colors.border }]}>
          {visibleTabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && { borderBottomColor: Colors.accent }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons name={t.icon} size={14} color={activeTab === t.key ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? Colors.accent : Colors.textMuted },
                activeTab === t.key && { fontWeight: FontWeight.bold }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={doRefresh} tintColor={Colors.accent} />}
      >
        {/* ════════════════ MY LEAVES TAB ════════════════ */}
        {activeTab === 'my' && (
          <>
            {/* Balance Cards */}
            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Leave Balances</Text>

            {/* 3-row 2-column balance grid */}
            <View style={{ paddingHorizontal: Spacing.md, gap: 10 }}>
              {/* Row 1: Annual | Sick */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <BalanceCard label="Annual" remaining={b?.annualRemaining} total={b?.annualTotal} color={Colors.accent}  icon="umbrella-outline" colors={Colors} />
                <BalanceCard label="Sick"   remaining={b?.sickRemaining}   total={b?.sickTotal}   color={Colors.danger}  icon="medkit-outline"   colors={Colors} />
              </View>
              {/* Row 2: Casual | Comp Off */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <BalanceCard label="Casual"   remaining={b?.casualRemaining}  total={b?.casualTotal}   color={Colors.info}    icon="cafe-outline"       colors={Colors} />
                <BalanceCard label="Comp Off" remaining={b?.compOffRemaining} total={b?.compOffEarned} color={Colors.warning} icon="trending-up-outline" colors={Colors} />
              </View>
              {/* Row 3: Paternity OR Maternity (based on gender) | Unpaid */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {b?.paternityTotal != null
                  ? <BalanceCard label="Paternity" remaining={b?.paternityRemaining} total={b?.paternityTotal} color={Colors.success} icon="people-outline" colors={Colors} />
                  : <BalanceCard label="Maternity" remaining={b?.maternityRemaining} total={b?.maternityTotal} color={Colors.success} icon="heart-outline"   colors={Colors} />
                }
                <BalanceCard label="Unpaid" used={b?.unpaidUsed} color={Colors.textMuted} icon="ban-outline" colors={Colors} />
              </View>
            </View>

            {/* My Leave Requests */}
            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>My Requests</Text>
            {leaves.length === 0
              ? <Text style={[styles.empty, { color: Colors.textMuted }]}>No leave requests found.</Text>
              : leaves.map((l: any) => (
                  <View key={l.id} style={[styles.leaveRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.leaveType, { color: Colors.textPrimary }]}>{l.leaveType?.replace('_', ' ')}</Text>
                      <Text style={[styles.leaveDates, { color: Colors.textSecondary }]}>
                        {dayjs(l.startDate).format('DD MMM')} → {dayjs(l.endDate).format('DD MMM YYYY')}
                        <Text style={{ color: Colors.accent }}> · {l.daysRequested}d</Text>
                      </Text>
                      {l.reason && <Text style={[styles.leaveReason, { color: Colors.textMuted }]} numberOfLines={1}>{l.reason}</Text>}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(l.status) + '22' }]}>
                      <Text style={[styles.statusTextSmall, { color: statusColor(l.status) }]}>{l.status}</Text>
                    </View>
                  </View>
                ))
            }
          </>
        )}

        {/* ════════════════ PENDING REVIEW TAB ════════════════ */}
        {activeTab === 'pending' && canManage && (
          <>
            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Awaiting Your Review</Text>
            {pendingLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
            ) : pendingLeaves.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="checkmark-circle-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>All Caught Up!</Text>
                <Text style={[styles.empty, { color: Colors.textMuted }]}>No pending leave requests to review.</Text>
              </View>
            ) : (
              pendingLeaves.map((l: any) => {
                const isSelf = l.empId === user?.empId
                return (
                  <View key={l.id} style={[styles.reviewCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewAvatar, { backgroundColor: Colors.accentLight }]}>
                        <Text style={[styles.reviewAvatarText, { color: Colors.accent }]}>
                          {l.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reviewName, { color: Colors.textPrimary }]}>{l.employeeName || l.empId}</Text>
                        <Text style={[styles.reviewEmpId, { color: Colors.textMuted }]}>{l.empId}</Text>
                      </View>
                      <View style={[styles.typeBadge, { backgroundColor: Colors.accentLight }]}>
                        <Text style={[styles.typeBadgeText, { color: Colors.accent }]}>{l.leaveType?.replace('_', ' ')}</Text>
                      </View>
                    </View>

                    <View style={styles.reviewDates}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                      <Text style={[styles.reviewDateText, { color: Colors.textSecondary }]}>
                        {dayjs(l.startDate).format('DD MMM')} → {dayjs(l.endDate).format('DD MMM YYYY')}
                      </Text>
                      {/* ✅ FIX 3: FontWeight.black → FontWeight.bold */}
                      <Text style={[styles.reviewDays, { color: Colors.accent, fontWeight: FontWeight.bold }]}>{l.daysRequested}d</Text>
                    </View>

                    {l.reason ? (
                      <Text style={[styles.reviewReason, { color: Colors.textSecondary }]} numberOfLines={2}>"{l.reason}"</Text>
                    ) : null}

                    {isSelf ? (
                      <View style={[styles.selfWarning, { backgroundColor: Colors.warningLight }]}>
                        <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                        <Text style={[styles.selfWarningText, { color: Colors.warning }]}>Must be reviewed by another manager</Text>
                      </View>
                    ) : (
                      <View style={styles.reviewActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: Colors.success }]}
                          onPress={() => handleReview(l.id, 'APPROVED')}
                          disabled={reviewMutation.isPending}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: Colors.danger }]}
                          onPress={() => handleReview(l.id, 'REJECTED')}
                          disabled={reviewMutation.isPending}
                        >
                          <Ionicons name="close" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )
              })
            )}
          </>
        )}

        {/* ════════════════ ALL REQUESTS TAB ════════════════ */}
        {activeTab === 'all' && canManage && (
          <>
            {/* Status Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 6, marginBottom: Spacing.md }}>
              {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterPill,
                    { backgroundColor: Colors.bgTertiary, borderColor: Colors.border },
                    filterStatus === s && { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
                  ]}
                  onPress={() => setFilterStatus(s)}
                >
                  <Text style={[styles.filterPillText,
                    { color: Colors.textSecondary },
                    filterStatus === s && { color: Colors.accent },
                  ]}>
                    {s || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {allLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
            ) : allLeaves.length === 0 ? (
              <Text style={[styles.empty, { color: Colors.textMuted }]}>No leave requests found.</Text>
            ) : (
              allLeaves.map((l: any) => (
                <View key={l.id} style={[styles.leaveRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.leaveType, { color: Colors.textPrimary }]}>{l.employeeName || l.empId}</Text>
                    </View>
                    <Text style={[styles.leaveDates, { color: Colors.textSecondary }]}>
                      {l.leaveType?.replace('_', ' ')} · {dayjs(l.startDate).format('DD MMM')} → {dayjs(l.endDate).format('DD MMM')}
                      <Text style={{ color: Colors.accent }}> · {l.daysRequested}d</Text>
                    </Text>
                    {l.reason && <Text style={[styles.leaveReason, { color: Colors.textMuted }]} numberOfLines={1}>{l.reason}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(l.status) + '22' }]}>
                    <Text style={[styles.statusTextSmall, { color: statusColor(l.status) }]}>{l.status}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Request Leave Modal ──────────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <View style={[styles.modal, { backgroundColor: Colors.bgPrimary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: Colors.border }]}>
            <Text style={[styles.modalTitle, { color: Colors.textPrimary }]}>Request Leave</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Leave Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {availableLeaveTypes.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typePill,
                    { backgroundColor: Colors.bgTertiary, borderColor: Colors.border },
                    leaveType === t.value && { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
                  ]}
                  onPress={() => setLeaveType(t.value)}
                >
                  <Text style={[styles.typePillText,
                    { color: Colors.textSecondary },
                    leaveType === t.value && { color: Colors.accent },
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
              placeholder="e.g. 2026-05-01"
              placeholderTextColor={Colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
              placeholder="e.g. 2026-05-03"
              placeholderTextColor={Colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Reason (optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top', backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
              placeholder="Brief reason for leave..."
              placeholderTextColor={Colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            {/* Working-day preview */}
            {workingDays > 0 && (
              <View style={[styles.dayPreview, { backgroundColor: Colors.accentLight }]}>
                <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                <Text style={[styles.dayPreviewText, { color: Colors.accent }]}>
                  {workingDays} working day{workingDays !== 1 ? 's' : ''} (weekends &amp; holidays excluded)
                </Text>
              </View>
            )}
            {startDate && endDate && endDate >= startDate && workingDays === 0 && (
              <View style={[styles.dayPreview, { backgroundColor: Colors.dangerLight ?? '#fee2e2' }]}>
                <Ionicons name="warning-outline" size={14} color={Colors.danger} />
                <Text style={[styles.dayPreviewText, { color: Colors.danger }]}>
                  Selected range falls entirely on weekends or public holidays
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: Colors.accent }, submitMutation.isPending && { opacity: 0.6 }]}
              onPress={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              <Text style={styles.submitBtnText}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Static styles (no colors here — all colors applied inline above) ─────────
const styles = StyleSheet.create({
  root:            { flex: 1 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title:           { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  requestBtn:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm, gap: 4 },
  requestBtnText:  { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Tabs
  tabRow:          { flexDirection: 'row', marginHorizontal: Spacing.md, gap: 4, borderBottomWidth: 1, marginBottom: Spacing.sm },
  tab:             { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:         { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  sectionTitle:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.sm },
  leaveRow:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: Spacing.sm },
  leaveType:       { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  leaveDates:      { fontSize: FontSize.xs, marginTop: 2 },
  leaveReason:     { fontSize: FontSize.xs, marginTop: 2 },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusTextSmall: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  empty:           { textAlign: 'center', padding: Spacing.lg },
  modal:           { flex: 1 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1 },
  modalTitle:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  fieldLabel:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  textInput:       { borderRadius: Radius.sm, borderWidth: 1, padding: 12, fontSize: FontSize.md },
  typePill:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  typePillText:    { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  submitBtn:       { borderRadius: Radius.sm, padding: 14, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText:   { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  dayPreview:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.sm },
  dayPreviewText:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },

  // Review card
  reviewCard:      { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: Spacing.sm },
  reviewHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText:{ fontWeight: FontWeight.bold, fontSize: FontSize.sm },  // ✅ FIX 3: was FontWeight.black
  reviewName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  reviewEmpId:     { fontSize: FontSize.xs },
  typeBadge:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  typeBadgeText:   { fontSize: 10, fontWeight: FontWeight.bold },           // ✅ FIX 3: was FontWeight.black
  reviewDates:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewDateText:  { flex: 1, fontSize: FontSize.sm },
  reviewDays:      { fontSize: FontSize.md },                               // ✅ FIX 3: fontWeight moved to inline
  reviewReason:    { fontSize: FontSize.sm, fontStyle: 'italic' },
  reviewActions:   { flexDirection: 'row', gap: 8 },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.sm },
  actionBtnText:   { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  selfWarning:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: Radius.sm },
  selfWarningText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  emptyBlock:      { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  // Filter pills
  filterPill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  filterPillText:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
})