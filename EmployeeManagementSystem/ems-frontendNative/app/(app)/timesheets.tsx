// app/(app)/timesheets.tsx — Timesheet Screen with Team Review
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { timesheetAPI } from '../../src/api'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useState } from 'react'

dayjs.extend(isoWeek)

const DAYS = [
  { key: 'mondayHours',    label: 'Mon' },
  { key: 'tuesdayHours',   label: 'Tue' },
  { key: 'wednesdayHours', label: 'Wed' },
  { key: 'thursdayHours',  label: 'Thu' },
  { key: 'fridayHours',    label: 'Fri' },
  { key: 'saturdayHours',  label: 'Sat' },
  { key: 'sundayHours',    label: 'Sun' },
]

function getStatusStyle(status: string, Colors: any) {
  const map: Record<string, { color: string; bg: string }> = {
    DRAFT:     { color: Colors.textMuted,  bg: Colors.bgTertiary },
    SUBMITTED: { color: Colors.warning,    bg: Colors.warningLight },
    APPROVED:  { color: Colors.success,    bg: Colors.successLight },
    REJECTED:  { color: Colors.danger,     bg: Colors.dangerLight },
  }
  return map[status] || map.DRAFT
}

const TABS = [
  { key: 'my',   label: 'My Timesheets', icon: 'document-text-outline' as const },
  { key: 'team', label: 'Team Review',   icon: 'people-outline' as const, adminOnly: true },
]

export default function TimesheetScreen() {
  const { user, isAdmin, isManager } = useAuth()
  const Colors = useThemeColors()
  const canManage = isAdmin() || isManager()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('my')
  const [projectName, setProjectName] = useState('')
  const [hours, setHours]             = useState('')
  const [taskDesc, setTaskDesc]       = useState('')
  const [selectedDay, setSelectedDay] = useState(DAYS[dayjs().day() === 0 ? 6 : dayjs().day() - 1].key)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [teamFilter, setTeamFilter]   = useState('')
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['timesheet-week', selectedDate],
    queryFn: () => timesheetAPI.getWeek(selectedDate),
  })

  const { data: myData } = useQuery({
    queryKey: ['my-timesheets'],
    queryFn: () => timesheetAPI.getMyTimesheets({ page: 0, size: 20 }),
    enabled: activeTab === 'my',
  })

  const { data: teamData, isLoading: teamLoading, refetch: refetchTeam } = useQuery({
    queryKey: ['team-timesheets', teamFilter],
    queryFn: () => timesheetAPI.getTeam(undefined, teamFilter || undefined, { page: 0, size: 50 }),
    enabled: canManage && activeTab === 'team',
  })

  const monday = dayjs(selectedDate).startOf('isoWeek')
  const currentWeekStart = monday.format('YYYY-MM-DD')

  const saveMutation = useMutation({
    mutationFn: () => timesheetAPI.saveEntry({
      id:              editingId,
      weekStartDate:   currentWeekStart,
      project:         projectName,
      taskDescription: taskDesc,
      [selectedDay]:   parseFloat(hours) || 0,
    }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Entry saved!' })
      setHours(''); setTaskDesc(''); setEditingId(null); refetch()
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to save entry' }),
  })

  const changeWeek = (offset: number) => {
    setSelectedDate(dayjs(currentWeekStart).add(offset, 'week').format('YYYY-MM-DD'))
  }

  const submitMutation = useMutation({
    mutationFn: () => timesheetAPI.submitWeek(currentWeekStart),
    onSuccess: () => { Toast.show({ type: 'success', text1: 'Timesheet submitted for review!' }); refetch() },
    onError:   () => Toast.show({ type: 'error', text1: 'Submit failed. Try again.' }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => timesheetAPI.review(id, action),
    onSuccess: (_, { action }) => {
      Toast.show({ type: 'success', text1: `Timesheet ${action === 'APPROVED' ? 'approved' : 'rejected'}!` })
      qc.invalidateQueries({ queryKey: ['team-timesheets'] })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Review failed' }),
  })

  const handleEdit = (e: any) => {
    setEditingId(e.id)
    setProjectName(e.project)
    setTaskDesc(e.taskDescription)
    const firstDay = DAYS.find(d => (e[d.key] || 0) > 0)
    if (firstDay) {
      setSelectedDay(firstDay.key)
      setHours(String(e[firstDay.key]))
    } else {
      setHours('')
    }
  }

  const resetForm = () => {
    setEditingId(null); setProjectName(''); setHours(''); setTaskDesc('')
  }

  const entries   = Array.isArray(data?.data) ? data.data : (data?.data?.entries || [])
  const totalH    = entries.reduce((s: number, e: any) => s + (e.totalHours || 0), 0)
  const weekStatus = entries.length > 0 ? entries[0].status : 'DRAFT'
  const canSubmit = weekStatus === 'DRAFT' && entries.length > 0
  const myHistory = myData?.data?.content || []
  const teamList  = teamData?.data?.content || []

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Timesheets</Text>
        {weekStatus && (
          <View style={[styles.statusPill, { backgroundColor: getStatusStyle(weekStatus, Colors).bg }]}>
            <Text style={[styles.statusText, { color: getStatusStyle(weekStatus, Colors).color }]}>{weekStatus}</Text>
          </View>
        )}
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

      {activeTab === 'my' && (
        <View style={[styles.weekSwitcher, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.weekNavBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))} style={styles.weekDisplay}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
            <Text style={[styles.weekDisplayText, { color: Colors.textPrimary }]}>Week of {dayjs(currentWeekStart).format('DD MMM')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeWeek(1)} style={styles.weekNavBtn}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
      >
        {activeTab === 'my' && (
          <>
            <View style={[styles.weekBanner, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
              <Text style={[styles.weekText, { color: Colors.textSecondary }]}>
                Week: {dayjs(currentWeekStart).format('DD MMM')} → {dayjs(currentWeekStart).add(6, 'day').format('DD MMM YYYY')}
              </Text>
              <Text style={[styles.weekHours, { color: Colors.accent }]}>{totalH.toFixed(1)}h</Text>
            </View>

            {weekStatus !== 'SUBMITTED' && weekStatus !== 'APPROVED' && (
              <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Add Entry</Text>
                <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Project Name</Text>
                <TextInput style={[styles.input, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]} placeholder="e.g. EMS Backend" placeholderTextColor={Colors.textMuted} value={projectName} onChangeText={setProjectName} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Day</Text>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Hours Worked</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {DAYS.map((d, idx) => {
                      const pillDate = dayjs(currentWeekStart).add(idx, 'day')
                      const isActive = selectedDay === d.key
                      return (
                        <TouchableOpacity key={d.key} style={[styles.dayPill, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }, isActive && { backgroundColor: Colors.accentLight, borderColor: Colors.accent }]} onPress={() => setSelectedDay(d.key)}>
                          <Text style={[styles.dayPillText, { color: Colors.textSecondary }, isActive && { color: Colors.accent, fontWeight: FontWeight.bold }]}>{d.label}</Text>
                          <Text style={{ fontSize: 8, color: isActive ? Colors.accent : Colors.textMuted, textAlign: 'center' }}>{pillDate.format('D MMM')}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <TextInput style={[styles.input, { width: 80, marginTop: 0, backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]} placeholder="0.0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
                </View>
                <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Task Description</Text>
                <TextInput style={[styles.input, { height: 68, textAlignVertical: 'top', backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]} placeholder="What did you work on?" placeholderTextColor={Colors.textMuted} value={taskDesc} onChangeText={setTaskDesc} multiline />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: Colors.accent }, saveMutation.isPending && { opacity: 0.6 }]} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Text style={styles.btnText}>{saveMutation.isPending ? 'Saving…' : (editingId ? 'Update Entry' : 'Save Entry')}</Text>
                  </TouchableOpacity>
                  {editingId && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.bgTertiary, width: 60, borderColor: Colors.border, borderWidth: 1 }]} onPress={resetForm}>
                      <Text style={[styles.btnText, { color: Colors.textSecondary }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>This Week's Entries</Text>
            {entries.length === 0
              ? <Text style={[styles.empty, { color: Colors.textMuted }]}>No entries yet this week.</Text>
              : entries.map((e: any, i: number) => (
                  <TouchableOpacity key={e.id || i} style={[styles.entryRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }, editingId === e.id && { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]} onPress={() => handleEdit(e)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.entryProject, { color: Colors.textPrimary }]}>{e.project}</Text>
                        {editingId === e.id && <Ionicons name="pencil" size={12} color={Colors.accent} />}
                      </View>
                      <Text style={[styles.entryTask, { color: Colors.textSecondary }]} numberOfLines={1}>{e.taskDescription || 'No description'}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        {DAYS.map(d => {
                          const val = e[d.key] || 0
                          if (val === 0) return null
                          return (
                            <View key={d.key} style={[styles.dayMiniBadge, { backgroundColor: Colors.bgTertiary }]}>
                              <Text style={[styles.dayMiniText, { color: Colors.textMuted }]}>{d.label}: {val}h</Text>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                    <Text style={[styles.entryHours, { color: Colors.accent }]}>{e.totalHours}h</Text>
                  </TouchableOpacity>
                ))
            }

            {canSubmit && (
              <TouchableOpacity style={[styles.greenBtn, { backgroundColor: Colors.success }, submitMutation.isPending && { opacity: 0.6 }]} onPress={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                <Ionicons name="send-outline" size={16} color="#fff" />
                <Text style={styles.greenBtnText}>{submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}</Text>
              </TouchableOpacity>
            )}

            {myHistory.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Past Timesheets</Text>
                {myHistory.map((t: any) => {
                  const sc = getStatusStyle(t.status, Colors)
                  return (
                    <View key={t.id} style={[styles.historyRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.entryProject, { color: Colors.textPrimary }]}>{t.project || t.projectName || '—'}</Text>
                        <Text style={[styles.entryDate, { color: Colors.textMuted }]}>Week of {dayjs(t.weekStartDate).format('DD MMM YYYY')}</Text>
                      </View>
                      <Text style={[styles.historyHours, { color: Colors.accent }]}>{t.totalHours ?? 0}h</Text>
                      <View style={[styles.historyBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: sc.color }]}>{t.status}</Text>
                      </View>
                    </View>
                  )
                })}
              </>
            )}
          </>
        )}

        {activeTab === 'team' && canManage && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 6, marginBottom: Spacing.md }}>
              {['', 'SUBMITTED', 'APPROVED', 'REJECTED'].map(s => (
                <TouchableOpacity key={s} style={[styles.filterPill, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }, teamFilter === s && { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]} onPress={() => setTeamFilter(s)}>
                  <Text style={[styles.filterPillText, { color: Colors.textSecondary }, teamFilter === s && { color: Colors.accent }]}>{s || 'All'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {teamLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
            ) : teamList.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="clipboard-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>No Timesheets</Text>
                <Text style={[styles.empty, { color: Colors.textMuted }]}>No timesheets found for the selected filter.</Text>
              </View>
            ) : (
              teamList.map((t: any) => {
                const sc = getStatusStyle(t.status, Colors)
                const isSelf = t.empId === user?.empId
                return (
                  <View key={t.id} style={[styles.reviewCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewAvatar, { backgroundColor: Colors.accentLight }]}>
                        <Text style={[styles.reviewAvatarText, { color: Colors.accent }]}>{t.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reviewName, { color: Colors.textPrimary }]}>{t.employeeName || t.empId}</Text>
                        <Text style={[styles.reviewEmpId, { color: Colors.textMuted }]}>{t.empId} · Week of {dayjs(t.weekStartDate).format('DD MMM')}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.color }]}>{t.status}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewStats}>
                      <View style={[styles.reviewStatBlock, { backgroundColor: Colors.bgTertiary }]}>
                        <Text style={[styles.reviewStatLabel, { color: Colors.textMuted }]}>Project</Text>
                        <Text style={[styles.reviewStatValue, { color: Colors.textPrimary }]}>{t.project || t.projectName || '—'}</Text>
                      </View>
                      <View style={[styles.reviewStatBlock, { backgroundColor: Colors.bgTertiary }]}>
                        <Text style={[styles.reviewStatLabel, { color: Colors.textMuted }]}>Total Hours</Text>
                        <Text style={[styles.reviewStatValue, { color: Colors.accent }]}>{t.totalHours ?? 0}h</Text>
                      </View>
                    </View>
                    {t.status === 'SUBMITTED' && (
                      isSelf ? (
                        <View style={[styles.selfWarning, { backgroundColor: Colors.warningLight }]}>
                          <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                          <Text style={[styles.selfWarningText, { color: Colors.warning }]}>Must be reviewed by another manager</Text>
                        </View>
                      ) : (
                        <View style={styles.reviewActions}>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => Alert.alert('Approve?', 'Are you sure?', [{text:'Cancel'}, {text:'Approve', onPress:()=>reviewMutation.mutate({id:t.id, action:'APPROVED'})}])} disabled={reviewMutation.isPending}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger }]} onPress={() => Alert.alert('Reject?', 'Are you sure?', [{text:'Cancel'}, {text:'Reject', onPress:()=>reviewMutation.mutate({id:t.id, action:'REJECTED'})}])} disabled={reviewMutation.isPending}>
                            <Ionicons name="close" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </View>
                )
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statusPill:   { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  statusText:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  tabRow:       { flexDirection: 'row', marginHorizontal: Spacing.md, gap: 4, borderBottomWidth: 1, marginBottom: Spacing.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:      { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  weekBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },
  weekText:     { flex: 1, fontSize: FontSize.sm },
  weekHours:    { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  card:         { borderRadius: Radius.md, padding: Spacing.md, marginHorizontal: Spacing.md, borderWidth: 1, marginBottom: Spacing.md, gap: Spacing.sm },
  cardTitle:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 4 },
  fieldLabel:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  input:        { borderRadius: Radius.sm, borderWidth: 1, padding: 10, fontSize: FontSize.md },
  btn:          { borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: FontWeight.bold },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.md },
  empty:        { textAlign: 'center', padding: Spacing.lg },
  entryRow:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1 },
  entryProject: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  entryTask:    { fontSize: FontSize.xs, marginTop: 2 },
  entryDate:    { fontSize: FontSize.xs, marginTop: 2 },
  entryHours:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  greenBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, margin: Spacing.md, padding: 14 },
  greenBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  historyRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: 8 },
  historyHours:    { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  historyBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  historyBadgeText:{ fontSize: 10, fontWeight: FontWeight.bold },
  dayPill:           { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1 },
  dayPillText:       { fontSize: 12 },
  dayMiniBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dayMiniText:       { fontSize: 10 },
  reviewCard:      { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: Spacing.sm },
  reviewHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText:{ fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  reviewName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  reviewEmpId:     { fontSize: FontSize.xs },
  reviewStats:     { flexDirection: 'row', gap: 12 },
  reviewStatBlock: { flex: 1, borderRadius: Radius.sm, padding: 10 },
  reviewStatLabel: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  reviewStatValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 2 },
  reviewActions:   { flexDirection: 'row', gap: 8 },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.sm },
  actionBtnText:   { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  selfWarning:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: Radius.sm },
  selfWarningText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  emptyBlock:      { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  filterPill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  filterPillText:   { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  weekSwitcher:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: Spacing.md, marginVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, padding: 4 },
  weekNavBtn:       { padding: 8 },
  weekDisplay:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  weekDisplayText:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
})
