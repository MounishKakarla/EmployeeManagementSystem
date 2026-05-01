// app/(app)/leave.tsx — Leave Screen with Manager Review
import { useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, RefreshControl, ActivityIndicator, Image } from 'react-native'
import CalendarPicker from '../../src/components/CalendarPicker'
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
import { useFocusEffect } from 'expo-router'
import BellButton from '../../src/components/BellButton'

const LEAVE_TYPES = [
  { value: 'ANNUAL',      label: 'Annual / Earned Leave' },
  { value: 'SICK_CASUAL', label: 'Sick / Casual Leave'   },
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

type ConfirmLeave = { id: number; action: string; name: string; leaveType: string; dates: string; days: number } | null

export default function LeaveScreen() {
  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin() || isManager()
  const qc = useQueryClient()

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['leave-balance'] })
    qc.invalidateQueries({ queryKey: ['my-leaves'] })
  }, [qc]))

  // ✅ FIX 1: useThemeColors instead of static Colors import
  const Colors = useThemeColors()

  const [activeTab, setActiveTab] = useState('my')
  const [modalOpen, setModalOpen] = useState(false)
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate]           = useState('')
  const [endDate,   setEndDate]             = useState('')
  const [reason,    setReason]              = useState('')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker,   setShowEndPicker]   = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [leaveConfirm, setLeaveConfirm] = useState<ConfirmLeave>(null)
  const [infoMsg, setInfoMsg]           = useState<string | null>(null)
  const [modalNotes, setModalNotes]     = useState('')
  const [formError, setFormError]       = useState<string | null>(null)

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
      setShowStartPicker(false); setShowEndPicker(false); setFormError(null)
      qc.invalidateQueries({ queryKey: ['leave-balance'] })
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again.'
      setFormError(msg)
    },
  })

  // ── Review leave (approve/reject) ──────────────────────────────────────────
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: string; notes?: string }) =>
      leaveAPI.review(id, action, notes),
    onSuccess: (_, { action }) => {
      Toast.show({ type: 'success', text1: `Leave ${action === 'APPROVED' ? 'approved' : 'rejected'}!` })
      setLeaveConfirm(null); setModalNotes('')
      qc.invalidateQueries({ queryKey: ['pending-leaves'] })
      qc.invalidateQueries({ queryKey: ['all-leaves'] })
      qc.invalidateQueries({ queryKey: ['leave-balance'] })
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Could not submit review.', text2: err?.response?.data?.message || 'Please try again.' })
    },
  })

  const b = balData?.data
  const leaves = myLeaves?.data?.content || []
  const pendingLeaves = pendingData?.data?.content || []
  const allLeaves = allData?.data?.content || []

  const statusColor = (s: string) =>
    s === 'APPROVED' ? Colors.success : s === 'REJECTED' ? Colors.danger : Colors.warning

  const availableLeaveTypes = LEAVE_TYPES

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  const handleReview = (id: number, action: string) => {
    const req = pendingLeaves.find((l: any) => l.id === id)
    if (!req) return
    if (req.empId === user?.empId) {
      setInfoMsg('You cannot approve or reject your own leave request.')
      return
    }
    setModalNotes('')
    setLeaveConfirm({
      id, action,
      name:      req.employeeName || req.empId,
      leaveType: req.leaveType?.replace(/_/g, ' ') || '',
      dates:     `${dayjs(req.startDate).format('DD MMM')} → ${dayjs(req.endDate).format('DD MMM YYYY')}`,
      days:      req.daysRequested,
    })
  }

  const doConfirmReview = () => {
    if (!leaveConfirm) return
    reviewMutation.mutate({ id: leaveConfirm.id, action: leaveConfirm.action, notes: modalNotes || undefined })
  }

  const doRefresh = () => {
    refetch(); refetchLeaves()
    if (canManage) { refetchPending(); refetchAll() }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Leave Management</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BellButton />
        <TouchableOpacity style={[styles.requestBtn, { backgroundColor: Colors.accent }]} onPress={() => { setFormError(null); setModalOpen(true) }}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.requestBtnText}>Request</Text>
        </TouchableOpacity>
        </View>
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

            {/* 1-row 2-column balance grid */}
            <View style={{ paddingHorizontal: Spacing.md, gap: 10 }}>
              {/* Row 1: Annual | Sick/Casual */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <BalanceCard label="Annual / Earned" remaining={b?.annualRemaining}     total={b?.annualTotal}      color={Colors.accent}  icon="umbrella-outline" colors={Colors} />
                <BalanceCard label="Sick / Casual"   remaining={b?.sickCasualRemaining} total={b?.sickCasualTotal}  color={Colors.danger}  icon="medkit-outline"   colors={Colors} />
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
                      {l.profileImage ? (
                        <Image source={{ uri: l.profileImage }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={[styles.reviewAvatar, { backgroundColor: Colors.accentLight }]}>
                          <Text style={[styles.reviewAvatarText, { color: Colors.accent }]}>
                            {l.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                          </Text>
                        </View>
                      )}
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

          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} keyboardShouldPersistTaps="handled">
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

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Start Date</Text>
            <TouchableOpacity
              style={[styles.dateBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
              <Text style={[styles.dateBtnText, { color: startDate ? Colors.textPrimary : Colors.textMuted }]}>
                {startDate ? dayjs(startDate).format('DD MMM YYYY') : 'Select start date'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>End Date</Text>
            <TouchableOpacity
              style={[styles.dateBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
              <Text style={[styles.dateBtnText, { color: endDate ? Colors.textPrimary : Colors.textMuted }]}>
                {endDate ? dayjs(endDate).format('DD MMM YYYY') : 'Select end date'}
              </Text>
            </TouchableOpacity>

            {/* Calendar pickers */}
            <CalendarPicker
              visible={showStartPicker}
              onClose={() => setShowStartPicker(false)}
              onSelect={(d) => { setStartDate(d); if (endDate && endDate < d) setEndDate('') }}
              selectedDate={startDate}
              minDate={dayjs().format('YYYY-MM-DD')}
              title="Select Start Date"
            />
            <CalendarPicker
              visible={showEndPicker}
              onClose={() => setShowEndPicker(false)}
              onSelect={(d) => setEndDate(d)}
              selectedDate={endDate}
              minDate={startDate || dayjs().format('YYYY-MM-DD')}
              rangeStart={startDate}
              title="Select End Date"
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

            {/* Inline error — visible even when modal is open (unlike Toast) */}
            {formError && (
              <View style={[styles.inlineError, { backgroundColor: Colors.dangerLight ?? '#fee2e2', borderColor: Colors.danger }]}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={[styles.inlineErrorText, { color: Colors.danger }]}>{formError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: Colors.accent }, submitMutation.isPending && { opacity: 0.6 }]}
              onPress={() => {
                if (!startDate) { setFormError('Please select a start date.'); return }
                if (!endDate)   { setFormError('Please select an end date.'); return }
                setFormError(null)
                submitMutation.mutate()
              }}
              disabled={submitMutation.isPending}
            >
              <Text style={styles.submitBtnText}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      {/* ── Review Confirmation Modal ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={!!leaveConfirm} onRequestClose={() => setLeaveConfirm(null)}>
        <View style={styles.overlayBg}>
          <View style={[styles.confirmCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: leaveConfirm?.action === 'APPROVED' ? Colors.successLight : Colors.dangerLight }]}>
              <Ionicons name={leaveConfirm?.action === 'APPROVED' ? 'checkmark-circle-outline' : 'close-circle-outline'} size={32} color={leaveConfirm?.action === 'APPROVED' ? Colors.success : Colors.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: Colors.textPrimary }]}>
              {leaveConfirm?.action === 'APPROVED' ? 'Approve Leave?' : 'Reject Leave?'}
            </Text>
            <View style={[styles.confirmInfo, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textPrimary }]}>{leaveConfirm?.name}</Text>
              </View>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="briefcase-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textSecondary }]}>{leaveConfirm?.leaveType}</Text>
              </View>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textSecondary }]}>
                  {leaveConfirm?.dates}<Text style={{ color: Colors.accent }}> · {leaveConfirm?.days}d</Text>
                </Text>
              </View>
            </View>
            <TextInput
              style={[styles.confirmNotes, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
              placeholder={leaveConfirm?.action === 'APPROVED' ? 'Optional note to employee…' : 'Reason for rejection (optional)…'}
              placeholderTextColor={Colors.textMuted}
              value={modalNotes}
              onChangeText={setModalNotes}
              multiline
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, borderWidth: 1 }]} onPress={() => setLeaveConfirm(null)} activeOpacity={0.8}>
                <Text style={[styles.confirmBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: leaveConfirm?.action === 'APPROVED' ? Colors.success : Colors.danger, opacity: reviewMutation.isPending ? 0.6 : 1 }]} onPress={doConfirmReview} disabled={reviewMutation.isPending} activeOpacity={0.8}>
                {reviewMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name={leaveConfirm?.action === 'APPROVED' ? 'checkmark' : 'close'} size={16} color="#fff" /><Text style={[styles.confirmBtnText, { color: '#fff' }]}>{leaveConfirm?.action === 'APPROVED' ? 'Approve' : 'Reject'}</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Cannot-review-self info Modal ─────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={!!infoMsg} onRequestClose={() => setInfoMsg(null)}>
        <View style={styles.overlayBg}>
          <View style={[styles.confirmCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.warning} />
            </View>
            <Text style={[styles.confirmTitle, { color: Colors.textPrimary }]}>Not Allowed</Text>
            <Text style={[styles.confirmSubtitle, { color: Colors.textMuted }]}>{infoMsg}</Text>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.accent, width: '100%' }]} onPress={() => setInfoMsg(null)} activeOpacity={0.8}>
              <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Got It</Text>
            </TouchableOpacity>
          </View>
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
  dateBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.sm, borderWidth: 1, padding: 12 },
  dateBtnText:     { fontSize: FontSize.md, flex: 1 },
  typePill:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  typePillText:    { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  submitBtn:       { borderRadius: Radius.sm, padding: 14, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText:   { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  dayPreview:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.sm },
  dayPreviewText:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  inlineError:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.sm, borderWidth: 1 },
  inlineErrorText: { fontSize: FontSize.sm, flex: 1, fontWeight: FontWeight.medium },

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

  // ── Confirm / info modals ─────────────────────────────────────────────────
  overlayBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  confirmCard:     { width: '100%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  confirmIcon:     { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  confirmTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  confirmSubtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  confirmInfo:     { width: '100%', borderRadius: Radius.sm, padding: Spacing.md, borderWidth: 1, gap: 8 },
  confirmInfoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmInfoText: { fontSize: FontSize.sm },
  confirmNotes:    { width: '100%', borderRadius: Radius.sm, borderWidth: 1, padding: 12, fontSize: FontSize.sm, minHeight: 60, textAlignVertical: 'top' },
  confirmActions:  { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: Spacing.xs },
  confirmBtn:      { flex: 1, borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmBtnText:  { fontWeight: FontWeight.bold, fontSize: FontSize.md },
})