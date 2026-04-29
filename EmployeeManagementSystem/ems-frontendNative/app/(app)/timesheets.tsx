// app/(app)/timesheets.tsx — Timesheet Screen with Team Review
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, ActivityIndicator } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { timesheetAPI, leaveAPI } from '../../src/api'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import CalendarPicker from '../../src/components/CalendarPicker'
import TimePicker from '../../src/components/TimePicker'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'

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
    PARTIAL:   { color: Colors.warning,    bg: Colors.warningLight },
    APPROVED:  { color: Colors.success,    bg: Colors.successLight },
    REJECTED:  { color: Colors.danger,     bg: Colors.dangerLight },
  }
  return map[status] || map.DRAFT
}

const TABS = [
  { key: 'my',   label: 'My Timesheets', icon: 'document-text-outline' as const },
  { key: 'team', label: 'Team Review',   icon: 'people-outline' as const, adminOnly: true },
]

type ConfirmTS = { id: number; action: string; name: string; project: string; week: string } | null

export default function TimesheetScreen() {
  const { user, isAdmin, isManager } = useAuth()
  const Colors = useThemeColors()
  const canManage = isAdmin() || isManager()
  const qc = useQueryClient()

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['timesheet-week'] })
    qc.invalidateQueries({ queryKey: ['my-timesheets'] })
  }, [qc]))

  const [activeTab, setActiveTab] = useState('my')
  const [projectName, setProjectName] = useState('')
  const [dayHoursMap, setDayHoursMap] = useState<Record<string, string>>({})
  const [taskDesc, setTaskDesc]       = useState('')
  const _todayIdx = dayjs().day() === 0 ? 6 : dayjs().day() - 1
  const [selectedDay, setSelectedDay] = useState(DAYS[_todayIdx].key)
  const [editingId, setEditingId]         = useState<number | null>(null)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [startTime, setStartTime] = useState('')
  const [endTime,   setEndTime]   = useState('')
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker,   setShowEndTimePicker]   = useState(false)
  const [teamFilter, setTeamFilter]   = useState('')
  const [teamSearch, setTeamSearch]   = useState('')
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [tsConfirm, setTsConfirm]       = useState<ConfirmTS>(null)

  // Date range state for My History
  const [myFrom, setMyFrom] = useState('')
  const [myTo,   setMyTo]   = useState('')
  const [showMyFrom, setShowMyFrom] = useState(false)
  const [showMyTo,   setShowMyTo]   = useState(false)

  // Date range state for Team
  const [teamFrom, setTeamFrom] = useState('')
  const [teamTo,   setTeamTo]   = useState('')
  const [showTeamFrom, setShowTeamFrom] = useState(false)
  const [showTeamTo,   setShowTeamTo]   = useState(false)

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['timesheet-week', selectedDate],
    queryFn: () => timesheetAPI.getWeek(selectedDate),
  })

  // Normalize to Monday so backend weekStartDate comparisons include the right week
  const toWeekStart = (d: string) => dayjs(d).startOf('isoWeek').format('YYYY-MM-DD')

  const { data: myData } = useQuery({
    queryKey: ['my-timesheets', myFrom, myTo],
    queryFn: () => timesheetAPI.getMyTimesheets({
      page: 0, size: 30,
      ...(myFrom && { from: toWeekStart(myFrom) }),
      ...(myTo   && { to: myTo }),
    }),
    enabled: activeTab === 'my',
  })

  const { data: teamData, isLoading: teamLoading, isFetching: teamFetching } = useQuery({
    queryKey: ['team-timesheets', teamFilter, teamSearch, teamFrom, teamTo],
    queryFn: () => timesheetAPI.getTeam(teamSearch.trim() || undefined, teamFilter || undefined, {
      page: 0, size: 50,
      ...(teamFrom && { from: toWeekStart(teamFrom) }),
      ...(teamTo   && { to: teamTo }),
    }),
    enabled: canManage && activeTab === 'team',
  })

  // Approved leaves for weekly target calculation
  const { data: leaveData } = useQuery({
    queryKey: ['leaves-approved-all'],
    queryFn: () => leaveAPI.getMyLeaves({ status: 'APPROVED', size: 100 }),
  })

  const monday = dayjs(selectedDate).startOf('isoWeek')
  const currentWeekStart = monday.format('YYYY-MM-DD')

  // Auto-calculate hours for the selected day from start/end times
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      let diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff < 0) diff += 24 * 60
      if (diff > 0) setDayHoursMap(prev => ({ ...prev, [selectedDay]: (diff / 60).toFixed(1) }))
    }
  }, [startTime, endTime])

  const fmt12hr = (t: string) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
  }

  const handleExportPDF = async () => {
    if (entries.length === 0) {
      Toast.show({ type: 'error', text1: 'No entries to export' }); return
    }

    const emp     = entries[0]
    const weekEnd = dayjs(currentWeekStart).add(6, 'day').format('DD MMM YYYY')
    const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

    const rowsHtml = entries.flatMap((e: any) =>
      DAYS.map((d, i) => {
        const h = e[d.key] || 0
        if (h === 0) return ''
        const timeCell = (e.startTime && e.endTime)
          ? `${e.startTime}–${e.endTime}<br><span style="color:#888;font-size:10px">${fmt12hr(e.startTime)} – ${fmt12hr(e.endTime)}</span>`
          : '—'
        const statusBg = e.status === 'APPROVED' ? '#d4edda' : e.status === 'SUBMITTED' ? '#fff3cd' : e.status === 'REJECTED' ? '#f8d7da' : '#e9ecef'
        const statusFg = e.status === 'APPROVED' ? '#155724' : e.status === 'SUBMITTED' ? '#856404' : e.status === 'REJECTED' ? '#721c24' : '#555'
        return `<tr>
          <td>${DAYS_FULL[i]}</td>
          <td><strong>${e.project}</strong></td>
          <td>${e.taskDescription || '—'}</td>
          <td style="text-align:center">${timeCell}</td>
          <td style="text-align:center;font-weight:700;color:#4361ee">${h}h</td>
          <td style="text-align:center"><span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${e.status}</span></td>
        </tr>`
      })
    ).filter(Boolean).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Timesheet — ${currentWeekStart}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 12px }
  .logo { font-size: 18px; font-weight: 700; color: #4361ee; margin-bottom: 4px }
  h1 { font-size: 16px; margin-bottom: 16px; color: #222 }
  .meta { background: #f4f4f8; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; line-height: 1.9 }
  .meta strong { color: #111 }
  table { width: 100%; border-collapse: collapse; font-size: 11px }
  th { background: #4361ee; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: middle }
  tr:nth-child(even) td { background: #fafafa }
  .totals { margin-top: 16px; text-align: right; font-size: 13px }
  .totals strong { color: #4361ee; font-size: 16px }
  .bar-track { height: 8px; background: #e9ecef; border-radius: 4px; margin-top: 8px; overflow: hidden }
  .bar-fill { height: 100%; border-radius: 4px; background: ${totalH >= 32 ? '#28a745' : totalH >= 16 ? '#4361ee' : '#ffc107'} }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #aaa }
</style></head>
<body>
  <div class="logo">Tektalis EMS</div>
  <h1>Timesheet Report</h1>
  <div class="meta">
    <strong>Employee:</strong> ${emp?.employeeName || '—'} &nbsp;(${emp?.empId || '—'})<br>
    <strong>Department:</strong> ${emp?.department || '—'}<br>
    <strong>Week:</strong> ${dayjs(currentWeekStart).format('DD MMM YYYY')} — ${weekEnd}<br>
    <strong>Status:</strong> ${weekStatus}
  </div>
  <table>
    <thead><tr><th>Day</th><th>Project</th><th>Task</th><th style="text-align:center">Time</th><th style="text-align:center">Hours</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No entries</td></tr>'}
    </tbody>
  </table>
  <div class="totals">
    Week total: <strong>${totalH.toFixed(1)}h</strong> logged
    <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,(totalH/40)*100)}%"></div></div>
  </div>
  <div class="footer">Generated by Tektalis EMS &bull; ${dayjs().format('DD MMM YYYY, HH:mm')}</div>
</body></html>`

    try {
      Toast.show({ type: 'info', text1: 'Generating PDF…', visibilityTime: 1500 })
      const { uri } = await Print.printToFileAsync({ html, base64: false })

      // Build filename for share dialog: EmpId_W{isoWeek}.pdf
      const empId    = entries[0]?.empId || user?.empId || 'EMP'
      const weekNo   = dayjs(currentWeekStart).isoWeek()
      const fileName = `${empId}_W${weekNo}.pdf`

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType:    'application/pdf',
          dialogTitle: fileName,
          UTI:         'com.adobe.pdf',
        })
      } else {
        Toast.show({ type: 'error', text1: 'Sharing not available on this device' })
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'PDF export failed' })
    }
  }

  const handleSave = () => {
    setSaveAttempted(true)
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project name is required' }); return
    }
    if (!taskDesc.trim()) {
      Toast.show({ type: 'error', text1: 'Task description is required' }); return
    }
    const anyHours = DAYS.some(d => parseFloat(dayHoursMap[d.key] || '0') > 0)
    if (!anyHours) {
      Toast.show({ type: 'error', text1: 'Enter hours for at least one day' }); return
    }
    saveMutation.mutate()
  }

  const saveMutation = useMutation({
    mutationFn: () => timesheetAPI.saveEntry({
      id:              editingId ?? undefined,
      weekStartDate:   currentWeekStart,
      project:         projectName.trim(),
      taskDescription: taskDesc.trim(),
      startTime:       startTime || undefined,
      endTime:         endTime   || undefined,
      // Send ALL days so other days' hours are never wiped on update
      ...Object.fromEntries(DAYS.map(d => [d.key, parseFloat(dayHoursMap[d.key] || '0') || 0])),
    }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Entry saved!' })
      setDayHoursMap({}); setTaskDesc(''); setProjectName(''); setStartTime(''); setEndTime('')
      setEditingId(null); setSaveAttempted(false)
      qc.invalidateQueries({ queryKey: ['timesheet-week'] })
      qc.invalidateQueries({ queryKey: ['my-timesheets'] })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to save entry' }),
  })

  const changeWeek = (offset: number) => {
    setSelectedDate(dayjs(currentWeekStart).add(offset, 'week').format('YYYY-MM-DD'))
  }

  const submitMutation = useMutation({
    mutationFn: () => timesheetAPI.submitWeek(currentWeekStart),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Timesheet submitted for review!' })
      qc.invalidateQueries({ queryKey: ['timesheet-week'] })
      qc.invalidateQueries({ queryKey: ['my-timesheets'] })
    },
    onError:   (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Submit failed. Please fill all working days.', visibilityTime: 4000 }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => timesheetAPI.review(id, action),
    onSuccess: (_, { action }) => {
      Toast.show({ type: 'success', text1: `Timesheet ${action === 'APPROVED' ? 'approved' : 'rejected'}!` })
      setTsConfirm(null)
      qc.invalidateQueries({ queryKey: ['team-timesheets'] })
      qc.invalidateQueries({ queryKey: ['timesheet-week'] })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Review failed' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => timesheetAPI.deleteEntry(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Entry deleted' })
      setDeleteConfirmId(null)
      resetForm()
      qc.invalidateQueries({ queryKey: ['timesheet-week'] })
      qc.invalidateQueries({ queryKey: ['my-timesheets'] })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Delete failed' }),
  })

  const handleTsReview = (t: any, action: string) => {
    setTsConfirm({
      id:      t.id,
      action,
      name:    t.employeeName || t.empId,
      project: t.project || t.projectName || '—',
      week:    fmtWeek(t),
    })
  }

  const doConfirmTsReview = () => {
    if (!tsConfirm) return
    reviewMutation.mutate({ id: tsConfirm.id, action: tsConfirm.action })
  }

  const exportSinglePDF = async (t: any) => {
    const empId  = t.empId || 'EMP'
    const weekNo = dayjs(t.weekStartDate).isoWeek()
    const fileName = `${empId}_W${weekNo}.pdf`
    const weekEnd  = dayjs(t.weekStartDate).add(6, 'day').format('DD MMM YYYY')
    const statusBg = t.status === 'APPROVED' ? '#d4edda' : t.status === 'SUBMITTED' ? '#fff3cd' : t.status === 'REJECTED' ? '#f8d7da' : '#e9ecef'
    const statusFg = t.status === 'APPROVED' ? '#155724' : t.status === 'SUBMITTED' ? '#856404' : t.status === 'REJECTED' ? '#721c24' : '#555'

    // Group all loaded entries for this employee + week (multi-project)
    const weekEntries = teamList.filter((e: any) => e.empId === t.empId && e.weekStartDate === t.weekStartDate)
    const DAYS_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    const HOURS_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
    const totalH = weekEntries.reduce((s: number, e: any) => s + (e.totalHours || 0), 0)
    const rowsHtml = weekEntries.flatMap((e: any) =>
      HOURS_KEYS.map((hk, i) => {
        const h = parseFloat(e[hk]) || 0
        if (h === 0) return ''
        const timeCell = (e.startTime && e.endTime) ? `${e.startTime}–${e.endTime}` : e.startTime ? `From ${e.startTime}` : '—'
        return `<tr><td>${DAYS_FULL[i]}</td><td><strong>${e.project || '—'}</strong></td><td>${e.taskDescription || '—'}</td><td style="text-align:center;font-size:10px;color:#555">${timeCell}</td><td style="text-align:center;font-weight:700;color:#4361ee">${h}h</td></tr>`
      }).filter(Boolean)
    ).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Timesheet — ${empId} W${weekNo}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:28px;color:#111;font-size:12px}
.logo{font-size:18px;font-weight:700;color:#4361ee;margin-bottom:4px}h1{font-size:16px;margin-bottom:16px;color:#222}
.meta{background:#f4f4f8;border-radius:8px;padding:12px 16px;margin-bottom:20px;line-height:1.9}.meta strong{color:#111}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#4361ee;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
.total{text-align:right;font-size:13px;font-weight:700;color:#333;margin-top:12px}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#aaa}</style></head><body>
<div class="logo">Tektalis EMS</div>
<h1>Employee Timesheet</h1>
<div class="meta">
<strong>Employee:</strong> ${t.employeeName || '—'} (${empId})<br>
<strong>Department:</strong> ${t.department || '—'}<br>
<strong>Week:</strong> ${dayjs(t.weekStartDate).format('DD MMM YYYY')} — ${weekEnd} &nbsp;(W${weekNo})<br>
<strong>Status:</strong> <span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${t.status}</span>
${t.approvedBy ? `<br><strong>Reviewed by:</strong> ${t.approvedBy}` : ''}
</div>
<table>
<thead><tr><th>Day</th><th>Project</th><th>Task</th><th style="text-align:center">Time</th><th style="text-align:center">Hours</th></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#888;padding:16px">No entries</td></tr>'}</tbody>
</table>
<p class="total">Week Total: ${totalH.toFixed(1)}h across ${weekEntries.length} project${weekEntries.length !== 1 ? 's' : ''}</p>
<div class="footer">Generated by Tektalis EMS &bull; ${dayjs().format('DD MMM YYYY, HH:mm')}</div>
</body></html>`
    try {
      Toast.show({ type: 'info', text1: `Exporting ${fileName}…`, visibilityTime: 1500 })
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' })
      } else {
        Toast.show({ type: 'error', text1: 'Sharing not available' })
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Export failed' })
    }
  }

  const handleEdit = (e: any) => {
    setEditingId(e.id)
    setProjectName(e.project)
    setTaskDesc(e.taskDescription)
    setStartTime(e.startTime || '')
    setEndTime(e.endTime || '')
    // Load ALL day hours so editing one day never wipes another
    const map: Record<string, string> = {}
    DAYS.forEach(d => { if ((e[d.key] || 0) > 0) map[d.key] = String(e[d.key]) })
    setDayHoursMap(map)
    const firstDay = DAYS.find(d => (e[d.key] || 0) > 0)
    if (firstDay) setSelectedDay(firstDay.key)
  }

  const resetForm = () => {
    setEditingId(null); setProjectName(''); setDayHoursMap({}); setTaskDesc('')
    setStartTime(''); setEndTime('')
  }

  const entries   = Array.isArray(data?.data) ? data.data : (data?.data?.entries || [])
  const totalH    = entries.reduce((s: number, e: any) => s + (e.totalHours || 0), 0)
  const TS_DAY_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
  const hasHoursInRange = (entry: any, from: string, to: string) => {
    if (!from && !to) return true
    const ws = dayjs(entry.weekStartDate)
    for (let i = 0; i < TS_DAY_KEYS.length; i++) {
      if ((entry[TS_DAY_KEYS[i]] || 0) > 0) {
        const ds = ws.add(i, 'day').format('YYYY-MM-DD')
        if ((!from || ds >= from) && (!to || ds <= to)) return true
      }
    }
    return false
  }

  const weekApproved = entries.some((e: any) => e.status === 'APPROVED')
  const weekInReview = !weekApproved && entries.some((e: any) => e.status === 'SUBMITTED')
  const hasDraft     = entries.some((e: any) => e.status === 'DRAFT')
  const weekStatus   = weekApproved ? 'APPROVED'
                     : entries.some((e: any) => e.status === 'REJECTED') ? 'REJECTED'
                     : weekInReview && hasDraft ? 'PARTIAL'
                     : weekInReview ? 'SUBMITTED'
                     : entries.length > 0 ? 'DRAFT' : ''
  const canSubmit    = !weekApproved && hasDraft && entries.length > 0
  const myHistory = (myData?.data?.content || []).filter((r: any) => hasHoursInRange(r, myFrom, myTo))
  const teamList  = teamData?.data?.content || []

  // Leave days in current week (informational only)
  const myLeaves = (leaveData?.data?.content || []) as any[]
  const leaveWorkdays = myLeaves.reduce((count: number, leave: any) => {
    for (let d = 0; d < 5; d++) {
      const wd = dayjs(currentWeekStart).add(d, 'day').format('YYYY-MM-DD')
      if (leave.startDate && leave.endDate && wd >= leave.startDate && wd <= leave.endDate) count++
    }
    return count
  }, 0)
  const activityPct   = Math.min(100, (totalH / 40) * 100)
  const progressColor = totalH === 0 ? Colors.textMuted : totalH < 16 ? Colors.warning : totalH < 32 ? Colors.accent : Colors.success
  const weekGreeting  =
    totalH === 0 ? null
    : totalH < 8  ? 'Good start! Every hour counts.'
    : totalH < 16 ? 'Making progress! Keep it up.'
    : totalH < 24 ? 'Great work! Building momentum.'
    : totalH < 32 ? "Solid week! You're doing great."
    : totalH < 40 ? 'Finishing strong! Almost there.'
    : 'Outstanding week! Great dedication.'

  const DAY_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
  const fmtWeek = (t: any) => {
    const monday = dayjs(t.weekStartDate)
    let d = monday
    for (let i = 0; i < DAY_KEYS.length; i++) {
      if ((t[DAY_KEYS[i]] || 0) > 0) { d = monday.add(i, 'day'); break }
    }
    return `Wk ${monday.isoWeek()} · ${d.format('ddd, DD MMM')}`
  }

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

            {/* ── Weekly Activity Bar ─────────────────────────────────── */}
            <View style={[styles.progressCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>
                  Hours Logged{leaveWorkdays > 0 ? ` · ${leaveWorkdays} leave day${leaveWorkdays > 1 ? 's' : ''}` : ''}
                </Text>
                <Text style={[styles.progressLabel, { color: progressColor }]}>
                  {totalH.toFixed(1)}h
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: Colors.bgTertiary }]}>
                <View style={[styles.progressFill, { width: `${activityPct}%` as any, backgroundColor: progressColor }]} />
              </View>
              {weekGreeting && (
                <Text style={{ fontSize: 11, color: progressColor, fontStyle: 'italic', marginTop: 6 }}>
                  {weekGreeting}
                </Text>
              )}
            </View>

            {weekInReview && (
              <View style={{ backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm }}>
                <Text style={{ color: Colors.warning, fontSize: FontSize.xs, textAlign: 'center' }}>
                  {hasDraft
                    ? 'Some entries are under review. Save new entries then tap Submit Remaining.'
                    : 'Under Review — you can still edit entries. Changes stay in review.'}
                </Text>
              </View>
            )}

            {!weekApproved && (
              <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Add Entry</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Project Name</Text>
                  <Text style={{ color: Colors.danger, fontSize: FontSize.sm }}>*</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors.bgTertiary, color: Colors.textPrimary,
                    borderColor: saveAttempted && !projectName.trim() ? Colors.danger : Colors.border }]}
                  placeholder="e.g. EMS Backend" placeholderTextColor={Colors.textMuted}
                  value={projectName} onChangeText={setProjectName} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Day</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Hours Worked</Text>
                    <Text style={{ color: Colors.danger, fontSize: FontSize.sm }}>*</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {DAYS.map((d, idx) => {
                      const pillDate = dayjs(currentWeekStart).add(idx, 'day')
                      const isActive = selectedDay === d.key
                      return (
                        <TouchableOpacity
                          key={d.key}
                          style={[
                            styles.dayPill,
                            { backgroundColor: Colors.bgTertiary, borderColor: Colors.border },
                            isActive && { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
                          ]}
                          onPress={() => setSelectedDay(d.key)}
                        >
                          <Text style={[styles.dayPillText, { color: Colors.textSecondary }, isActive && { color: Colors.accent, fontWeight: FontWeight.bold }]}>{d.label}</Text>
                          <Text style={{ fontSize: 8, color: isActive ? Colors.accent : Colors.textMuted, textAlign: 'center' }}>{pillDate.format('D MMM')}</Text>
                          {parseFloat(dayHoursMap[d.key] || '0') > 0 && (
                            <Text style={{ fontSize: 8, color: Colors.success, fontWeight: FontWeight.bold }}>{dayHoursMap[d.key]}h</Text>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <TextInput
                    style={[styles.input, { width: 80, marginTop: 0, backgroundColor: Colors.bgTertiary, borderColor: Colors.border, color: Colors.textPrimary }]}
                    placeholder="0.0" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad"
                    value={dayHoursMap[selectedDay] || ''}
                    onChangeText={v => setDayHoursMap(prev => ({ ...prev, [selectedDay]: v }))}
                  />
                </View>
                {/* Time range row */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textMuted, marginBottom: 4 }]}>Start Time</Text>
                    <TouchableOpacity
                      style={[styles.timeBtn, { backgroundColor: Colors.bgTertiary, borderColor: startTime ? Colors.accent : Colors.border }]}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={14} color={startTime ? Colors.accent : Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.sm, color: startTime ? Colors.textPrimary : Colors.textMuted }}>
                        {startTime || 'Start'}
                      </Text>
                      {startTime && (
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                          {'  ' + fmt12hr(startTime)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textMuted, marginBottom: 4 }]}>End Time</Text>
                    <TouchableOpacity
                      style={[styles.timeBtn, { backgroundColor: Colors.bgTertiary, borderColor: endTime ? Colors.accent : Colors.border }]}
                      onPress={() => setShowEndTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={14} color={endTime ? Colors.accent : Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.sm, color: endTime ? Colors.textPrimary : Colors.textMuted }}>
                        {endTime || 'End'}
                      </Text>
                      {endTime && (
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                          {'  ' + fmt12hr(endTime)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {(startTime || endTime) && (
                    <TouchableOpacity
                      style={[styles.timeClear, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                      onPress={() => { setStartTime(''); setEndTime('') }}
                    >
                      <Ionicons name="close" size={14} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textMuted }]}>Task Description</Text>
                  <Text style={{ color: Colors.danger, fontSize: FontSize.sm }}>*</Text>
                </View>
                <TextInput
                  style={[styles.input, { height: 68, textAlignVertical: 'top', backgroundColor: Colors.bgTertiary, color: Colors.textPrimary,
                    borderColor: saveAttempted && !taskDesc.trim() ? Colors.danger : Colors.border }]}
                  placeholder="What did you work on?" placeholderTextColor={Colors.textMuted}
                  value={taskDesc} onChangeText={setTaskDesc} multiline />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: Colors.accent }, saveMutation.isPending && { opacity: 0.6 }]} onPress={handleSave} disabled={saveMutation.isPending}>
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
                  <View key={e.id || i} style={[styles.entryRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }, editingId === e.id && { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => !weekApproved && handleEdit(e)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.entryProject, { color: Colors.textPrimary }]}>{e.project}</Text>
                          {editingId === e.id && <Ionicons name="pencil" size={12} color={Colors.accent} />}
                        </View>
                        <Text style={[styles.entryTask, { color: Colors.textSecondary }]} numberOfLines={1}>{e.taskDescription || 'No description'}</Text>
                        {(e.startTime || e.endTime) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Ionicons name="time-outline" size={11} color={Colors.accent} />
                            <Text style={{ fontSize: 11, color: Colors.accent }}>
                              {e.startTime || '?'} – {e.endTime || '?'}
                              {'  '}
                              <Text style={{ color: Colors.textMuted }}>
                                ({fmt12hr(e.startTime || '')} – {fmt12hr(e.endTime || '')})
                              </Text>
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
                    {!weekApproved && (
                      <TouchableOpacity onPress={() => setDeleteConfirmId(e.id)} style={{ padding: 8, marginLeft: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
            }

            {/* Action buttons row */}
            <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
              {canSubmit && (
                <TouchableOpacity style={[styles.greenBtn, { flex: 1, margin: 0, backgroundColor: Colors.success }, submitMutation.isPending && { opacity: 0.6 }]} onPress={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  <Ionicons name="send-outline" size={16} color="#fff" />
                  <Text style={styles.greenBtnText}>
                    {submitMutation.isPending ? 'Submitting…' : weekInReview ? 'Submit Remaining' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              )}
              {entries.length > 0 && (
                <TouchableOpacity style={[styles.shareBtn, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]} onPress={handleExportPDF}>
                  <Ionicons name="document-outline" size={16} color={Colors.accent} />
                  <Text style={[styles.shareBtnText, { color: Colors.accent }]}>Export PDF</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Past Timesheets with date filter ──────────────────── */}
            <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Past Timesheets</Text>

            {/* Date range filter for My History */}
            <View style={[styles.dateFilterRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <TouchableOpacity
                style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                onPress={() => setShowMyFrom(true)}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: myFrom ? Colors.textPrimary : Colors.textMuted }}>
                  {myFrom ? dayjs(myFrom).format('DD MMM YY') : 'From'}
                </Text>
              </TouchableOpacity>
              <Text style={[{ fontSize: FontSize.xs, color: Colors.textMuted }]}>→</Text>
              <TouchableOpacity
                style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                onPress={() => setShowMyTo(true)}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: myTo ? Colors.textPrimary : Colors.textMuted }}>
                  {myTo ? dayjs(myTo).format('DD MMM YY') : 'To'}
                </Text>
              </TouchableOpacity>
              {(myFrom || myTo) && (
                <TouchableOpacity
                  style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                  onPress={() => { setMyFrom(''); setMyTo('') }}
                >
                  <Ionicons name="close-circle-outline" size={13} color={Colors.textMuted} />
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {myHistory.length === 0
              ? <Text style={[styles.empty, { color: Colors.textMuted }]}>No past timesheets found.</Text>
              : myHistory.map((t: any) => {
                  const sc = getStatusStyle(t.status, Colors)
                  return (
                    <View key={t.id} style={[styles.historyRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.entryProject, { color: Colors.textPrimary }]}>{t.project || t.projectName || '—'}</Text>
                        <Text style={[styles.entryDate, { color: Colors.textMuted }]}>{fmtWeek(t)}</Text>
                      </View>
                      <Text style={[styles.historyHours, { color: Colors.accent }]}>{t.totalHours ?? 0}h</Text>
                      <View style={[styles.historyBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: sc.color }]}>{t.status}</Text>
                      </View>
                    </View>
                  )
                })
            }
          </>
        )}

        {activeTab === 'team' && canManage && (
          <>
            {/* Employee search */}
            <View style={[styles.searchRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: Colors.textPrimary }]}
                placeholder="Search by name or ID…"
                placeholderTextColor={Colors.textMuted}
                value={teamSearch}
                onChangeText={setTeamSearch}
                autoCapitalize="none"
              />
              {teamSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTeamSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status filter pills + date range */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 6, marginBottom: Spacing.sm }}>
              {['', 'SUBMITTED', 'APPROVED', 'REJECTED'].map(s => (
                <TouchableOpacity key={s} style={[styles.filterPill, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }, teamFilter === s && { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]} onPress={() => setTeamFilter(s)}>
                  <Text style={[styles.filterPillText, { color: Colors.textSecondary }, teamFilter === s && { color: Colors.accent }]}>{s || 'All'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date range filter for Team */}
            <View style={[styles.dateFilterRow, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <TouchableOpacity
                style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                onPress={() => setShowTeamFrom(true)}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: teamFrom ? Colors.textPrimary : Colors.textMuted }}>
                  {teamFrom ? dayjs(teamFrom).format('DD MMM YY') : 'From'}
                </Text>
              </TouchableOpacity>
              <Text style={[{ fontSize: FontSize.xs, color: Colors.textMuted }]}>→</Text>
              <TouchableOpacity
                style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                onPress={() => setShowTeamTo(true)}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: teamTo ? Colors.textPrimary : Colors.textMuted }}>
                  {teamTo ? dayjs(teamTo).format('DD MMM YY') : 'To'}
                </Text>
              </TouchableOpacity>
              {(teamFrom || teamTo) && (
                <TouchableOpacity
                  style={[styles.dateFilterBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
                  onPress={() => { setTeamFrom(''); setTeamTo('') }}
                >
                  <Ionicons name="close-circle-outline" size={13} color={Colors.textMuted} />
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {(teamLoading || teamFetching) ? (
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
                        <Text style={[styles.reviewEmpId, { color: Colors.textMuted }]}>{t.empId} · {fmtWeek(t)}</Text>
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
                    {/* Export button — always visible */}
                    <TouchableOpacity
                      style={[styles.reviewActions, { justifyContent: 'flex-start', marginBottom: 6 }]}
                      onPress={() => exportSinglePDF(t)}
                    >
                      <View style={[styles.actionBtn, { backgroundColor: Colors.accent }]}>
                        <Ionicons name="download-outline" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Export PDF</Text>
                      </View>
                    </TouchableOpacity>
                    {t.status === 'SUBMITTED' && (
                      isSelf ? (
                        <View style={[styles.selfWarning, { backgroundColor: Colors.warningLight }]}>
                          <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                          <Text style={[styles.selfWarningText, { color: Colors.warning }]}>Must be reviewed by another manager</Text>
                        </View>
                      ) : (
                        <View style={styles.reviewActions}>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleTsReview(t, 'APPROVED')} disabled={reviewMutation.isPending}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger }]} onPress={() => handleTsReview(t, 'REJECTED')} disabled={reviewMutation.isPending}>
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

      {/* ── Time pickers ─────────────────────────────────────────────── */}
      <TimePicker
        visible={showStartTimePicker} title="Start Time"
        onClose={() => setShowStartTimePicker(false)}
        onSelect={t => { setStartTime(t); setShowStartTimePicker(false) }}
        value={startTime || undefined}
      />
      <TimePicker
        visible={showEndTimePicker} title="End Time"
        onClose={() => setShowEndTimePicker(false)}
        onSelect={t => { setEndTime(t); setShowEndTimePicker(false) }}
        value={endTime || undefined}
      />

      {/* ── Calendar pickers ─────────────────────────────────────────── */}
      <CalendarPicker
        visible={showMyFrom} title="History From"
        onClose={() => setShowMyFrom(false)}
        onSelect={d => { setMyFrom(d); setShowMyFrom(false) }}
        selectedDate={myFrom || undefined}
        disableWeekends={false}
      />
      <CalendarPicker
        visible={showMyTo} title="History To"
        onClose={() => setShowMyTo(false)}
        onSelect={d => { setMyTo(d); setShowMyTo(false) }}
        selectedDate={myTo || undefined}
        minDate={myFrom || undefined}
        disableWeekends={false}
      />
      <CalendarPicker
        visible={showTeamFrom} title="Team From"
        onClose={() => setShowTeamFrom(false)}
        onSelect={d => { setTeamFrom(d); setShowTeamFrom(false) }}
        selectedDate={teamFrom || undefined}
        disableWeekends={false}
      />
      <CalendarPicker
        visible={showTeamTo} title="Team To"
        onClose={() => setShowTeamTo(false)}
        onSelect={d => { setTeamTo(d); setShowTeamTo(false) }}
        selectedDate={teamTo || undefined}
        minDate={teamFrom || undefined}
        disableWeekends={false}
      />

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={deleteConfirmId !== null} onRequestClose={() => setDeleteConfirmId(null)}>
        <View style={styles.overlayBg}>
          <View style={[styles.confirmCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="trash-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: Colors.textPrimary }]}>Delete Entry?</Text>
            <Text style={[{ fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm }]}>
              This entry will be permanently removed — including from the review queue if it was submitted.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, borderWidth: 1 }]} onPress={() => setDeleteConfirmId(null)}>
                <Text style={[styles.confirmBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.danger, opacity: deleteMutation.isPending ? 0.6 : 1 }]} onPress={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="trash-outline" size={16} color="#fff" /><Text style={[styles.confirmBtnText, { color: '#fff' }]}>Delete</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Timesheet Review Confirmation Modal ──────────────────────── */}
      <Modal transparent animationType="fade" visible={!!tsConfirm} onRequestClose={() => setTsConfirm(null)}>
        <View style={styles.overlayBg}>
          <View style={[styles.confirmCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: tsConfirm?.action === 'APPROVED' ? Colors.successLight : Colors.dangerLight }]}>
              <Ionicons name={tsConfirm?.action === 'APPROVED' ? 'checkmark-circle-outline' : 'close-circle-outline'} size={32} color={tsConfirm?.action === 'APPROVED' ? Colors.success : Colors.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: Colors.textPrimary }]}>
              {tsConfirm?.action === 'APPROVED' ? 'Approve Timesheet?' : 'Reject Timesheet?'}
            </Text>
            <View style={[styles.confirmInfo, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textPrimary }]}>{tsConfirm?.name}</Text>
              </View>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="briefcase-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textSecondary }]}>{tsConfirm?.project}</Text>
              </View>
              <View style={styles.confirmInfoRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.confirmInfoText, { color: Colors.textSecondary }]}>{tsConfirm?.week}</Text>
              </View>
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, borderWidth: 1 }]} onPress={() => setTsConfirm(null)} activeOpacity={0.8}>
                <Text style={[styles.confirmBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: tsConfirm?.action === 'APPROVED' ? Colors.success : Colors.danger, opacity: reviewMutation.isPending ? 0.6 : 1 }]} onPress={doConfirmTsReview} disabled={reviewMutation.isPending} activeOpacity={0.8}>
                {reviewMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name={tsConfirm?.action === 'APPROVED' ? 'checkmark' : 'close'} size={16} color="#fff" /><Text style={[styles.confirmBtnText, { color: '#fff' }]}>{tsConfirm?.action === 'APPROVED' ? 'Approve' : 'Reject'}</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  weekBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.sm },
  weekText:     { flex: 1, fontSize: FontSize.sm },
  weekHours:    { fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Progress bar
  progressCard:   { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  progressTrack:  { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 4 },

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

  // Date range filter
  dateFilterRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1 },
  dateFilterBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 1 },

  // Team search
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Spacing.md },
  searchInput:  { flex: 1, fontSize: FontSize.sm, paddingVertical: 6 },

  // Time buttons
  timeBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: Radius.sm, borderWidth: 1 },
  timeClear:    { width: 36, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1, alignSelf: 'flex-end', height: 38 },

  // Share button
  shareBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1 },
  shareBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  overlayBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  confirmCard:     { width: '100%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  confirmIcon:     { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  confirmTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  confirmInfo:     { width: '100%', borderRadius: Radius.sm, padding: Spacing.md, borderWidth: 1, gap: 8 },
  confirmInfoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmInfoText: { fontSize: FontSize.sm },
  confirmActions:  { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: Spacing.xs },
  confirmBtn:      { flex: 1, borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmBtnText:  { fontWeight: FontWeight.bold, fontSize: FontSize.md },
})
