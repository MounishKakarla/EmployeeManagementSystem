// src/components/CalendarPicker.tsx — Pure JS calendar modal, no native dependencies
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  FlatList, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColors } from '../hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../theme'
import dayjs from 'dayjs'

const { width: SCREEN_W } = Dimensions.get('window')

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (date: string) => void   // returns 'YYYY-MM-DD'
  selectedDate?: string              // 'YYYY-MM-DD'
  minDate?: string                   // 'YYYY-MM-DD' — dates before this are disabled
  rangeStart?: string                // highlight range from rangeStart to hovered/selected
  title?: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function CalendarPicker({
  visible, onClose, onSelect, selectedDate, minDate, rangeStart, title = 'Select Date',
}: Props) {
  const Colors = useThemeColors()

  const today = dayjs().startOf('day')
  const initMonth = selectedDate
    ? dayjs(selectedDate).startOf('month')
    : (minDate ? dayjs(minDate).startOf('month') : today.startOf('month'))

  const [viewMonth, setViewMonth] = useState(initMonth)

  // Rebuild when modal opens so month resets sensibly
  React.useEffect(() => {
    if (visible) {
      setViewMonth(
        selectedDate
          ? dayjs(selectedDate).startOf('month')
          : (minDate ? dayjs(minDate).startOf('month') : today.startOf('month'))
      )
    }
  }, [visible])

  const prevMonth = () => setViewMonth(m => m.subtract(1, 'month'))
  const nextMonth = () => setViewMonth(m => m.add(1, 'month'))

  // Build 6-row × 7-col grid — pad with nulls for leading/trailing days
  const firstDayOfMonth = viewMonth.day() // 0=Sun … 6=Sat
  // Convert to Mon-first: Mon=0, Tue=1, … Sun=6
  const leadingBlanks = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1)
  const daysInMonth = viewMonth.daysInMonth()
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - leadingBlanks - daysInMonth).fill(null),
  ]

  const minDay = minDate ? dayjs(minDate).startOf('day') : null
  const selDay = selectedDate ? dayjs(selectedDate).startOf('day') : null
  const rangeStartDay = rangeStart ? dayjs(rangeStart).startOf('day') : null

  // overlay paddingHorizontal 24*2=48, sheet padding 16*2=32, gaps between 7 cols = 6*2=12
  const CELL_SIZE = Math.floor((SCREEN_W - 48 - 32 - 12) / 7)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[styles.sheet, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.accent} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: Colors.textPrimary }]}>
              {viewMonth.format('MMMM YYYY')}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels — Sa/Su tinted to signal non-workdays */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={d} style={[styles.weekLabel, { color: i >= 5 ? Colors.danger : Colors.textMuted, width: CELL_SIZE, opacity: i >= 5 ? 0.6 : 1 }]}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) return <View key={`blank-${idx}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />

              const cellDay = viewMonth.date(day).startOf('day')
              const isToday = cellDay.isSame(today, 'day')
              const isSelected = selDay ? cellDay.isSame(selDay, 'day') : false
              const dow = cellDay.day() // 0=Sun, 6=Sat
              const isWeekend = dow === 0 || dow === 6
              const isDisabled = isWeekend || (minDay ? cellDay.isBefore(minDay, 'day') : false)
              const inRange = rangeStartDay && selDay
                ? (cellDay.isAfter(rangeStartDay, 'day') && cellDay.isBefore(selDay, 'day'))
                  || (cellDay.isAfter(selDay, 'day') && cellDay.isBefore(rangeStartDay, 'day'))
                : false
              const isRangeStart = rangeStartDay ? cellDay.isSame(rangeStartDay, 'day') : false

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  disabled={isDisabled}
                  onPress={() => {
                    onSelect(cellDay.format('YYYY-MM-DD'))
                    onClose()
                  }}
                  style={[
                    styles.cell,
                    { width: CELL_SIZE, height: CELL_SIZE },
                    inRange && { backgroundColor: Colors.accentLight },
                    isSelected && { backgroundColor: Colors.accent, borderRadius: CELL_SIZE / 2 },
                    isRangeStart && !isSelected && { borderRadius: CELL_SIZE / 2, borderWidth: 2, borderColor: Colors.accent },
                  ]}
                >
                  <Text style={[
                    styles.dayText,
                    { color: isWeekend ? Colors.danger : (isDisabled ? Colors.textMuted : Colors.textPrimary) },
                    isToday && !isSelected && { color: Colors.accent, fontWeight: FontWeight.bold },
                    isSelected && { color: '#fff', fontWeight: FontWeight.bold },
                    isDisabled && { opacity: isWeekend ? 0.4 : 0.35 },
                  ]}>
                    {day}
                  </Text>
                  {isToday && !isSelected && (
                    <View style={[styles.todayDot, { backgroundColor: Colors.accent }]} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Today shortcut — only shown when today is a working weekday */}
          {today.day() !== 0 && today.day() !== 6 && (!minDate || !dayjs(minDate).isAfter(today, 'day')) && (
            <TouchableOpacity
              style={[styles.todayBtn, { borderColor: Colors.border }]}
              onPress={() => {
                onSelect(today.format('YYYY-MM-DD'))
                onClose()
              }}
            >
              <Text style={[styles.todayBtnText, { color: Colors.accent }]}>Today</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  sheet:       { width: '100%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:       { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  monthNav:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  monthLabel:  { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  navBtn:      { padding: 6 },
  weekRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  weekLabel:   { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center', textTransform: 'uppercase' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 },
  cell:        { justifyContent: 'center', alignItems: 'center' },
  dayText:     { fontSize: FontSize.sm },
  todayDot:    { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 3 },
  todayBtn:    { marginTop: Spacing.xs, borderTopWidth: 1, paddingTop: Spacing.sm, alignItems: 'center' },
  todayBtnText:{ fontSize: FontSize.sm, fontWeight: FontWeight.bold },
})
