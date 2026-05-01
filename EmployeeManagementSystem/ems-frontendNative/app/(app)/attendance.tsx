// app/(app)/attendance.tsx — Attendance Screen with Admin/Manager tabs
import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Modal, ActivityIndicator, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { attendanceAPI } from '../../src/api'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import BellButton from '../../src/components/BellButton'
import dayjs from 'dayjs'
import { useFocusEffect } from 'expo-router'

// Convert "HH:MM" → total minutes since midnight, null if invalid
function toMins(hhmm: string): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

// Convert "HH:MM" → "9:00 AM" style
function to12hr(hhmm: string): string | null {
  const mins = toMins(hhmm)
  if (mins === null) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

// Format minute-diff → "Xh Ym"
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Returns { mins, overnight, error } for a check-in / check-out pair.
// overnight = checkout is next calendar day (checkout HH:MM < checkin HH:MM).
// error is set only for 0-duration or > 20h (data-entry mistake).
function calcShift(inMins: number | null, outMins: number | null): { mins: number; overnight: boolean; error: string | null } | null {
  if (inMins === null || outMins === null) return null
  let mins: number, overnight = false
  if (outMins > inMins) {
    mins = outMins - inMins
  } else if (outMins < inMins) {
    mins = (24 * 60 - inMins) + outMins   // crosses midnight → next-day checkout
    overnight = true
  } else {
    return { mins: 0, overnight: false, error: 'Check-in and check-out cannot be the same time' }
  }
  if (mins > 20 * 60) {
    return { mins, overnight, error: `Shift of ${fmtDuration(mins)} seems too long — please verify` }
  }
  return { mins, overnight, error: null }
}

function getStatusStyle(status: string, Colors: any) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    PRESENT:        { label: 'Present',        color: Colors.success, bg: Colors.successLight },
    LATE:           { label: 'Late',           color: Colors.warning, bg: Colors.warningLight },
    HALF_DAY:       { label: 'Half Day',       color: Colors.warning, bg: Colors.warningLight },
    ABSENT:         { label: 'Absent',         color: Colors.danger,  bg: Colors.dangerLight },
    ON_LEAVE:       { label: 'On Leave',       color: Colors.info,    bg: Colors.infoLight },
    WORK_FROM_HOME: { label: 'WFH',           color: Colors.accent,  bg: Colors.accentLight },
    HOLIDAY:        { label: 'Holiday',        color: Colors.info,    bg: Colors.infoLight },
    WEEKEND:        { label: 'Weekend',        color: Colors.textMuted, bg: Colors.bgTertiary },
  }
  return map[status] || { label: status, color: Colors.textMuted, bg: Colors.bgTertiary }
}

function fmtTime(v: string | null | undefined) {
  if (!v) return '—'
  if (v.includes('T')) return dayjs(v).format('hh:mm A')
  const [h, m] = v.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`
}

function computeDur(inVal: string | null | undefined, outVal: string | null | undefined) {
  if (!inVal || !outVal) return null
  const parseM = (s: string) => {
    if (s.includes('T')) { const d = new Date(s); return d.getHours() * 60 + d.getMinutes() }
    const [h, m] = s.split(':').map(Number); return h * 60 + m
  }
  let diff = parseM(outVal) - parseM(inVal)
  if (diff <= 0) diff += 24 * 60  // overnight shift: checkout is next calendar day
  if (diff <= 0 || diff > 24 * 60) return null
  const h = Math.floor(diff / 60), m = diff % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const TABS = [
  { key: 'my',    label: 'My Attendance',  icon: 'person-outline' as const },
  { key: 'daily', label: 'Daily Roster',   icon: 'today-outline' as const, adminOnly: true },
  { key: 'team',  label: 'Team Report',    icon: 'people-outline' as const, adminOnly: true },
]

export default function AttendanceScreen() {
  const { user, isAdmin, isManager } = useAuth()
  const Colors = useThemeColors()
  const canManage = isAdmin() || isManager()
  const qc = useQueryClient()

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['attendance'] })
  }, [qc]))

  const [activeTab, setActiveTab] = useState('my')
  const [overrideOpen, setOverrideOpen] = useState(false)

  // ovEmpId is always locked to a specific employee — set when opening the modal
  const [ovEmpId, setOvEmpId]         = useState('')
  const [ovDate, setOvDate]           = useState(dayjs().format('YYYY-MM-DD'))
  const [ovCheckIn,    setOvCheckIn]  = useState('09:00')   // canonical 24h
  const [ovCheckIn12,  setOvCheckIn12]  = useState('9:00 AM') // display 12h
  const [ovCheckInErr24,  setOvCheckInErr24]  = useState('')
  const [ovCheckInErr12,  setOvCheckInErr12]  = useState('')
  const [ovCheckOut,   setOvCheckOut] = useState('18:00')
  const [ovCheckOut12, setOvCheckOut12] = useState('6:00 PM')
  const [ovCheckOutErr24, setOvCheckOutErr24] = useState('')
  const [ovCheckOutErr12, setOvCheckOutErr12] = useState('')
  const [ovStatus, setOvStatus]       = useState('PRESENT')
  const [ovNotes, setOvNotes]         = useState('')

  const [rosterDate, setRosterDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [teamStart, setTeamStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [teamEnd, setTeamEnd]     = useState(dayjs().format('YYYY-MM-DD'))

  // ── Dual-format time sync helpers ──────────────────────────────────────────
  const parse24local = (v: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
    if (!m) return null
    const h = parseInt(m[1], 10), min = parseInt(m[2], 10)
    if (h > 23 || min > 59) return null
    return { h, m: min }
  }
  const parse12local = (v: string) => {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(v.trim())
    if (!m) return null
    let h = parseInt(m[1], 10), min = parseInt(m[2], 10)
    const period = m[3].toUpperCase()
    if (h < 1 || h > 12 || min > 59) return null
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return { h, m: min }
  }
  const to24str = (h: number, m: number) =>
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  const to12str = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${period}`
  }

  const handleIn24 = (v: string) => {
    setOvCheckIn(v)
    if (!v) { setOvCheckInErr24(''); setOvCheckIn12(''); return }
    const p = parse24local(v)
    if (p) { setOvCheckInErr24(''); setOvCheckIn12(to12str(p.h, p.m)) }
    else setOvCheckInErr24('Invalid — use HH:MM (00:00 – 23:59)')
  }
  const handleIn12 = (v: string) => {
    setOvCheckIn12(v)
    if (!v) { setOvCheckInErr12(''); setOvCheckIn(''); return }
    const p = parse12local(v)
    if (p) { setOvCheckInErr12(''); setOvCheckIn(to24str(p.h, p.m)) }
    else setOvCheckInErr12('Use H:MM AM or H:MM PM')
  }
  const handleOut24 = (v: string) => {
    setOvCheckOut(v)
    if (!v) { setOvCheckOutErr24(''); setOvCheckOut12(''); return }
    const p = parse24local(v)
    if (p) { setOvCheckOutErr24(''); setOvCheckOut12(to12str(p.h, p.m)) }
    else setOvCheckOutErr24('Invalid — use HH:MM (00:00 – 23:59)')
  }
  const handleOut12 = (v: string) => {
    setOvCheckOut12(v)
    if (!v) { setOvCheckOutErr12(''); setOvCheckOut(''); return }
    const p = parse12local(v)
    if (p) { setOvCheckOutErr12(''); setOvCheckOut(to24str(p.h, p.m)) }
    else setOvCheckOutErr12('Use H:MM AM or H:MM PM')
  }

  // Open override modal: empId from context (roster row or self), date from context or today
  const openOverride = (empId: string, date?: string) => {
    setOvEmpId(empId)
    setOvDate(date || dayjs().format('YYYY-MM-DD'))
    setOvCheckIn('09:00');   setOvCheckIn12('9:00 AM')
    setOvCheckOut('18:00');  setOvCheckOut12('6:00 PM')
    setOvCheckInErr24('');   setOvCheckInErr12('')
    setOvCheckOutErr24('');  setOvCheckOutErr12('')
    setOvStatus('PRESENT')
    setOvNotes('')
    setOverrideOpen(true)
  }

  const { data: todayData, refetch, isRefetching } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceAPI.getToday(),
    retry: 1,
  })

  const { data: historyData } = useQuery({
    queryKey: ['attendance', 'history'],
    queryFn: () => attendanceAPI.getMyHistory({ page: 0, size: 15 }),
    enabled: activeTab === 'my',
  })

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['attendance', 'daily', rosterDate],
    queryFn: () => attendanceAPI.getDaily(rosterDate),
    enabled: canManage && activeTab === 'daily',
  })

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['attendance', 'team', teamStart, teamEnd],
    queryFn: () => attendanceAPI.getTeam(teamStart, teamEnd),
    enabled: canManage && activeTab === 'team',
  })

  const checkInMutation = useMutation({
    mutationFn: (notes: string | undefined = undefined) => attendanceAPI.checkIn(notes),
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Checked in!' }); qc.invalidateQueries({ queryKey: ['attendance'] }) },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Check-in failed. Please try again.' }),
  })

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceAPI.checkOut(),
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Checked out!' }); qc.invalidateQueries({ queryKey: ['attendance'] }) },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Check-out failed. Please try again.' }),
  })

  const overrideMutation = useMutation({
    mutationFn: () => attendanceAPI.override({
      empId: ovEmpId,
      attendanceDate: ovDate,
      checkInTime: ovCheckIn,
      checkOutTime: ovCheckOut,
      status: ovStatus,
      notes: ovNotes,
    }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Attendance override saved!' })
      setOverrideOpen(false)
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not save attendance record. Check the times and try again.' }),
  })

  const today = todayData?.data
  const hasIn  = !!(today?.checkInTime || today?.checkIn)
  const hasOut = !!(today?.checkOutTime || today?.checkOut)
  const dur = computeDur(today?.checkInTime || today?.checkIn, today?.checkOutTime || today?.checkOut)
  const history = historyData?.data?.content || []
  const dailyList = dailyData?.data || []
  const teamList = teamData?.data?.content || teamData?.data || []

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Attendance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {canManage && (
            <TouchableOpacity
              style={[styles.overrideBtn, { backgroundColor: Colors.accent }]}
              onPress={() => openOverride(user?.empId || '')}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.overrideBtnText}>Override</Text>
            </TouchableOpacity>
          )}
          <BellButton />
        </View>
      </View>

      {visibleTabs.length > 1 && (
        <View style={[styles.tabRow, { borderBottomColor: Colors.border }]}>
          {visibleTabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && { borderBottomColor: Colors.accent }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons name={t.icon} size={14} color={activeTab === t.key ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? Colors.accent : Colors.textMuted }, activeTab === t.key && { fontWeight: FontWeight.bold }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
      >
        {activeTab === 'my' && (
          <>
            <View style={[styles.todayCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <Text style={[styles.todayDate, { color: Colors.textMuted }]}>{dayjs().format('dddd, D MMMM YYYY')}</Text>
              <View style={styles.todayRow}>
                <View style={styles.todayStat}>
                  <View style={[styles.todayStatIcon, { backgroundColor: Colors.successLight }]}>
                    <Ionicons name="log-in-outline" size={18} color={Colors.success} />
                  </View>
                  <Text style={[styles.todayStatLabel, { color: Colors.textMuted }]}>Check In</Text>
                  <Text style={[styles.todayStatValue, { color: Colors.success }]}>
                    {fmtTime(today?.checkInTime || today?.checkIn)}
                  </Text>
                </View>
                <View style={styles.todayStat}>
                  <View style={[styles.todayStatIcon, { backgroundColor: Colors.infoLight }]}>
                    <Ionicons name="log-out-outline" size={18} color={Colors.info} />
                  </View>
                  <Text style={[styles.todayStatLabel, { color: Colors.textMuted }]}>Check Out</Text>
                  <Text style={[styles.todayStatValue, { color: Colors.info }]}>
                    {fmtTime(today?.checkOutTime || today?.checkOut)}
                  </Text>
                </View>
                <View style={styles.todayStat}>
                  <View style={[styles.todayStatIcon, { backgroundColor: Colors.accentLight }]}>
                    <Ionicons name="timer-outline" size={18} color={Colors.accent} />
                  </View>
                  <Text style={[styles.todayStatLabel, { color: Colors.textMuted }]}>Duration</Text>
                  <Text style={[styles.todayStatValue, { color: Colors.accent }]}>
                    {dur ?? (today?.totalHours ? `${today.totalHours}h` : '—')}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                {!hasIn && (
                  <TouchableOpacity
                    style={[styles.checkBtn, { backgroundColor: Colors.success }]}
                    onPress={() => checkInMutation.mutate(undefined)}
                    disabled={checkInMutation.isPending}
                  >
                    <Ionicons name="log-in-outline" size={18} color="#fff" />
                    <Text style={styles.checkBtnText}>{checkInMutation.isPending ? 'Checking in…' : 'Check In'}</Text>
                  </TouchableOpacity>
                )}
                {hasIn && !hasOut && (
                  <TouchableOpacity
                    style={[styles.checkBtn, { backgroundColor: Colors.danger }]}
                    onPress={() => checkOutMutation.mutate()}
                    disabled={checkOutMutation.isPending}
                  >
                    <Ionicons name="log-out-outline" size={18} color="#fff" />
                    <Text style={styles.checkBtnText}>{checkOutMutation.isPending ? 'Checking out…' : 'Check Out'}</Text>
                  </TouchableOpacity>
                )}
                {hasIn && hasOut && (
                  <View style={styles.completeBadge}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={[styles.completeText, { color: Colors.success }]}>Day Complete</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Recent History</Text>
            {history.length === 0
              ? <Text style={[styles.empty, { color: Colors.textMuted }]}>No attendance records yet.</Text>
              : history.map((r: any, i: number) => {
                  const d    = r.attendanceDate || r.date
                  const s    = getStatusStyle(r.status, Colors)
                  const rDur = computeDur(r.checkInTime || r.checkIn, r.checkOutTime || r.checkOut)
                  return (
                    <View key={r.id ?? i} style={[styles.historyRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyDate, { color: Colors.textPrimary }]}>
                          {d ? dayjs(d).format('ddd, DD MMM YYYY') : '—'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <Text style={[styles.historyTime, { color: Colors.success }]}>
                            {fmtTime(r.checkInTime || r.checkIn)}
                          </Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 10 }}>→</Text>
                          <Text style={[styles.historyTime, { color: Colors.info }]}>
                            {fmtTime(r.checkOutTime || r.checkOut)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.historyDur, { color: rDur ? Colors.accent : Colors.textMuted }]}>
                        {rDur ?? '—'}
                      </Text>
                      <View style={[styles.historyBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: s.color }]}>{s.label}</Text>
                      </View>
                    </View>
                  )
                })
            }
          </>
        )}

        {activeTab === 'daily' && canManage && (
          <>
            <View style={[styles.filterCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Date</Text>
              <TextInput
                style={[styles.filterInput, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
                value={rosterDate}
                onChangeText={setRosterDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={[styles.dateQuickBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]} onPress={() => setRosterDate(dayjs().format('YYYY-MM-DD'))}>
                  <Text style={[styles.dateQuickText, { color: Colors.textSecondary }]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateQuickBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]} onPress={() => setRosterDate(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))}>
                  <Text style={[styles.dateQuickText, { color: Colors.textSecondary }]}>Yesterday</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>
              Roster for {dayjs(rosterDate).format('DD MMM YYYY')}
            </Text>

            {dailyLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
            ) : dailyList.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="calendar-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>No Records</Text>
                <Text style={[styles.empty, { color: Colors.textMuted }]}>No attendance data for this date.</Text>
              </View>
            ) : (
              dailyList.map((r: any, i: number) => {
                const s = getStatusStyle(r.status, Colors)
                return (
                  <View key={r.id ?? i} style={[styles.rosterRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                    <View style={[styles.rosterAvatar, { backgroundColor: Colors.accentLight }]}>
                      <Text style={[styles.rosterAvatarText, { color: Colors.accent }]}>
                        {r.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rosterName, { color: Colors.textPrimary }]}>{r.employeeName || r.empId}</Text>
                      <Text style={[styles.rosterTimes, { color: Colors.textSecondary }]}>
                        {fmtTime(r.checkInTime || r.checkIn)} → {fmtTime(r.checkOutTime || r.checkOut)}
                      </Text>
                    </View>
                    <View style={[styles.rosterBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.rosterBadgeText, { color: s.color }]}>{s.label}</Text>
                    </View>
                    {/* Override shortcut for this employee on this date */}
                    <TouchableOpacity
                      style={[styles.rowOverrideBtn, { backgroundColor: Colors.accentLight }]}
                      onPress={() => openOverride(r.empId, rosterDate)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="create-outline" size={14} color={Colors.accent} />
                    </TouchableOpacity>
                  </View>
                )
              })
            )}
          </>
        )}

        {activeTab === 'team' && canManage && (
          <>
            <View style={[styles.filterCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>From</Text>
                  <TextInput style={[styles.filterInput, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]} value={teamStart} onChangeText={setTeamStart} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>To</Text>
                  <TextInput style={[styles.filterInput, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]} value={teamEnd} onChangeText={setTeamEnd} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
              <TouchableOpacity style={[styles.dateQuickBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]} onPress={() => { setTeamStart(dayjs().startOf('month').format('YYYY-MM-DD')); setTeamEnd(dayjs().format('YYYY-MM-DD')) }}>
                <Text style={[styles.dateQuickText, { color: Colors.textSecondary }]}>This Month</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Team Attendance</Text>

            {teamLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
            ) : teamList.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="people-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>No Data</Text>
                <Text style={[styles.empty, { color: Colors.textMuted }]}>No team attendance records for this period.</Text>
              </View>
            ) : (
              teamList.map((r: any, i: number) => {
                const s = getStatusStyle(r.status, Colors)
                const rDur = computeDur(r.checkInTime || r.checkIn, r.checkOutTime || r.checkOut)
                return (
                  <View key={r.id ?? i} style={[styles.rosterRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                    <View style={[styles.rosterAvatar, { backgroundColor: Colors.accentLight }]}>
                      <Text style={[styles.rosterAvatarText, { color: Colors.accent }]}>
                        {r.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rosterName, { color: Colors.textPrimary }]}>{r.employeeName || r.empId}</Text>
                      <Text style={[styles.rosterTimes, { color: Colors.textSecondary }]}>
                        {r.attendanceDate ? dayjs(r.attendanceDate).format('DD MMM') + ' · ' : ''}
                        {fmtTime(r.checkInTime || r.checkIn)} → {fmtTime(r.checkOutTime || r.checkOut)}
                      </Text>
                    </View>
                    {rDur && <Text style={[styles.rosterDur, { color: Colors.accent }]}>{rDur}</Text>}
                    <View style={[styles.rosterBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.rosterBadgeText, { color: s.color }]}>{s.label}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ── Manual Override Modal ─────────────────────────────────────────── */}
      <Modal visible={overrideOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverrideOpen(false)}>
        <View style={[styles.modal, { backgroundColor: Colors.bgPrimary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: Colors.border }]}>
            <Text style={[styles.modalTitle, { color: Colors.textPrimary }]}>Manual Override</Text>
            <TouchableOpacity onPress={() => setOverrideOpen(false)}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>

            {/* Employee ID — auto-filled, non-editable */}
            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Employee ID</Text>
            <View style={[styles.readonlyField, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
              <Text style={[styles.readonlyText, { color: Colors.textPrimary }]}>{ovEmpId || '—'}</Text>
              <View style={[styles.lockedBadge, { backgroundColor: Colors.accentLight }]}>
                <Ionicons name="lock-closed-outline" size={11} color={Colors.accent} />
                <Text style={[styles.lockedText, { color: Colors.accent }]}>Auto</Text>
              </View>
            </View>

            {/* Date — auto-filled from context, non-editable */}
            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Date</Text>
            <View style={[styles.readonlyField, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              <Text style={[styles.readonlyText, { color: Colors.textPrimary }]}>
                {dayjs(ovDate).format('ddd, DD MMM YYYY')}
              </Text>
              <View style={[styles.lockedBadge, { backgroundColor: Colors.accentLight }]}>
                <Ionicons name="lock-closed-outline" size={11} color={Colors.accent} />
                <Text style={[styles.lockedText, { color: Colors.accent }]}>Auto</Text>
              </View>
            </View>

            {/* ── Check-in time — 24h + 12h editable, bidirectional sync ── */}
            {(() => {
              const inM   = toMins(ovCheckIn)
              const outM  = toMins(ovCheckOut)
              const shift = calcShift(inM, outM)

              return (
                <>
                  {/* Check-in row */}
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Check-in Time</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' }}>24-hour (HH:MM)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: ovCheckInErr24 ? Colors.danger : Colors.border, color: Colors.textPrimary }]}
                        placeholder="09:00"
                        placeholderTextColor={Colors.textMuted}
                        value={ovCheckIn}
                        onChangeText={handleIn24}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      {ovCheckInErr24
                        ? <Text style={{ fontSize: 10, color: Colors.danger, marginTop: 2 }}>{ovCheckInErr24}</Text>
                        : ovCheckIn && !ovCheckInErr24 && parse24local(ovCheckIn) && (
                          <Text style={{ fontSize: 10, color: Colors.success, marginTop: 2, fontWeight: '600' }}>✓ Valid</Text>
                        )
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' }}>12-hour (H:MM AM/PM)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: ovCheckInErr12 ? Colors.danger : Colors.border, color: Colors.textPrimary }]}
                        placeholder="9:00 AM"
                        placeholderTextColor={Colors.textMuted}
                        value={ovCheckIn12}
                        onChangeText={handleIn12}
                        maxLength={8}
                      />
                      {ovCheckInErr12
                        ? <Text style={{ fontSize: 10, color: Colors.danger, marginTop: 2 }}>{ovCheckInErr12}</Text>
                        : ovCheckIn12 && !ovCheckInErr12 && parse12local(ovCheckIn12) && (
                          <Text style={{ fontSize: 10, color: Colors.success, marginTop: 2, fontWeight: '600' }}>✓ Valid</Text>
                        )
                      }
                    </View>
                  </View>

                  {/* Check-out row */}
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted, marginTop: Spacing.sm }]}>Check-out Time</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' }}>24-hour (HH:MM)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: (ovCheckOutErr24 || shift?.error) ? Colors.danger : Colors.border, color: Colors.textPrimary }]}
                        placeholder="18:00"
                        placeholderTextColor={Colors.textMuted}
                        value={ovCheckOut}
                        onChangeText={handleOut24}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      {ovCheckOutErr24
                        ? <Text style={{ fontSize: 10, color: Colors.danger, marginTop: 2 }}>{ovCheckOutErr24}</Text>
                        : ovCheckOut && !ovCheckOutErr24 && parse24local(ovCheckOut) && (
                          <Text style={{ fontSize: 10, color: Colors.success, marginTop: 2, fontWeight: '600' }}>✓ Valid</Text>
                        )
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' }}>12-hour (H:MM AM/PM)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: Colors.bgTertiary, borderColor: (ovCheckOutErr12 || shift?.error) ? Colors.danger : Colors.border, color: Colors.textPrimary }]}
                        placeholder="6:00 PM"
                        placeholderTextColor={Colors.textMuted}
                        value={ovCheckOut12}
                        onChangeText={handleOut12}
                        maxLength={8}
                      />
                      {ovCheckOutErr12
                        ? <Text style={{ fontSize: 10, color: Colors.danger, marginTop: 2 }}>{ovCheckOutErr12}</Text>
                        : ovCheckOut12 && !ovCheckOutErr12 && parse12local(ovCheckOut12) && (
                          <Text style={{ fontSize: 10, color: Colors.success, marginTop: 2, fontWeight: '600' }}>✓ Valid</Text>
                        )
                      }
                    </View>
                  </View>

                  {/* Duration / overnight / error badge */}
                  {shift && (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: shift.error
                        ? Colors.dangerLight
                        : shift.overnight ? Colors.warningLight : Colors.infoLight,
                      padding: 10, borderRadius: Radius.sm, marginTop: 4,
                    }}>
                      <Ionicons
                        name={shift.error ? 'warning-outline' : shift.overnight ? 'moon-outline' : 'timer-outline'}
                        size={14}
                        color={shift.error ? Colors.danger : shift.overnight ? Colors.warning : Colors.info}
                      />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: shift.error ? Colors.danger : shift.overnight ? Colors.warning : Colors.info }}>
                        {shift.error
                          ? shift.error
                          : shift.overnight
                          ? `🌙 Overnight · ${fmtDuration(shift.mins)} (checkout next day)`
                          : `Duration: ${fmtDuration(shift.mins)}`}
                      </Text>
                    </View>
                  )}
                </>
              )
            })()}

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'WORK_FROM_HOME'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusPill, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }, ovStatus === s && { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]}
                  onPress={() => setOvStatus(s)}
                >
                  <Text style={[styles.statusPillText, { color: Colors.textSecondary }, ovStatus === s && { color: Colors.accent }]}>
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: 'top', backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
              placeholder="Admin override note..."
              placeholderTextColor={Colors.textMuted}
              value={ovNotes}
              onChangeText={setOvNotes}
              multiline
            />

            {(() => {
              const inM     = toMins(ovCheckIn)
              const outM    = toMins(ovCheckOut)
              const shift   = calcShift(inM, outM)
              const hasFieldErr = !!ovCheckInErr24 || !!ovCheckInErr12 || !!ovCheckOutErr24 || !!ovCheckOutErr12
              const blocked = hasFieldErr || !!shift?.error
              return (
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    { backgroundColor: Colors.accent },
                    (overrideMutation.isPending || blocked) && { opacity: 0.5 },
                  ]}
                  onPress={() => {
                    if (hasFieldErr) {
                      Toast.show({ type: 'error', text1: 'Fix invalid time fields before saving' })
                      return
                    }
                    if (shift?.error) {
                      Toast.show({ type: 'error', text1: shift.error })
                      return
                    }
                    overrideMutation.mutate()
                  }}
                  disabled={overrideMutation.isPending || !ovEmpId}
                >
                  <Text style={styles.submitBtnText}>
                    {overrideMutation.isPending ? 'Saving…' : 'Save Override'}
                  </Text>
                </TouchableOpacity>
              )
            })()}
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  overrideBtn:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm, gap: 4 },
  overrideBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  tabRow:       { flexDirection: 'row', marginHorizontal: Spacing.md, gap: 4, borderBottomWidth: 1, marginBottom: Spacing.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:      { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  todayCard:    { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md, gap: Spacing.sm },
  todayDate:    { fontSize: FontSize.sm, marginBottom: 4 },
  todayRow:     { flexDirection: 'row', gap: 8 },
  todayStat:    { flex: 1, alignItems: 'center', gap: 4 },
  todayStatIcon:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  todayStatLabel:{ fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  todayStatValue:{ fontSize: FontSize.md, fontWeight: FontWeight.bold },
  actionRow:    { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  checkBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.sm },
  checkBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  completeBadge:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  completeText: { fontWeight: FontWeight.bold, fontSize: FontSize.md },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.md },
  empty:        { textAlign: 'center', padding: Spacing.lg },
  historyRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: 8 },
  historyDate:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  historyTime:     { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  historyDur:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  historyBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  historyBadgeText:{ fontSize: 10, fontWeight: FontWeight.bold },
  rosterRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: 10 },
  rosterAvatar:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  rosterAvatarText:{ fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  rosterName:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rosterTimes:    { fontSize: FontSize.xs, marginTop: 2 },
  rosterDur:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rosterBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  rosterBadgeText:{ fontSize: 10, fontWeight: FontWeight.bold },
  rowOverrideBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  filterCard:      { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md, gap: Spacing.sm },
  filterInput:     { borderRadius: Radius.sm, borderWidth: 1, padding: 10, fontSize: FontSize.md },
  dateQuickBtn:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  dateQuickText:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  fieldLabel:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  modal:        { flex: 1 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1 },
  modalTitle:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  readonlyField:{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.sm, borderWidth: 1, padding: 12 },
  readonlyText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  lockedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  lockedText:   { fontSize: 10, fontWeight: FontWeight.bold },
  textInput:    { borderRadius: Radius.sm, borderWidth: 1, padding: 12, fontSize: FontSize.md },
  statusPill:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  statusPillText:   { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  submitBtn:    { borderRadius: Radius.sm, padding: 14, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText:{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  emptyBlock:   { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
})
