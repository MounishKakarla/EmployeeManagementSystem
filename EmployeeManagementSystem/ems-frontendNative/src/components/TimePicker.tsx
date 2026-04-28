// src/components/TimePicker.tsx — Custom time picker modal, no native dependencies
import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColors } from '../hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (time: string) => void  // returns 'HH:mm' 24-hr format
  value?: string                    // 'HH:mm' 24-hr
  title?: string
}

function parseHHmm(v?: string): { h: number; m: number } {
  if (!v) return { h: 9, m: 0 }
  const [hStr, mStr] = v.split(':')
  return { h: parseInt(hStr) || 0, m: parseInt(mStr) || 0 }
}

export default function TimePicker({ visible, onClose, onSelect, value, title = 'Select Time' }: Props) {
  const Colors = useThemeColors()

  const [is24hr, setIs24hr] = useState(true)
  const [h, setH] = useState(parseHHmm(value).h)
  const [m, setM] = useState(parseHHmm(value).m)

  useEffect(() => {
    if (visible) {
      const parsed = parseHHmm(value)
      setH(parsed.h)
      setM(parsed.m)
    }
  }, [visible, value])

  const isPM  = h >= 12
  const h12   = h % 12 === 0 ? 12 : h % 12
  const dispH = is24hr ? h : h12

  const incH = () => {
    if (is24hr) {
      setH(p => (p + 1) % 24)
    } else {
      const next12 = h12 === 12 ? 1 : h12 + 1
      setH(isPM ? (next12 === 12 ? 12 : next12 + 12) : (next12 === 12 ? 0 : next12))
    }
  }
  const decH = () => {
    if (is24hr) {
      setH(p => (p - 1 + 24) % 24)
    } else {
      const prev12 = h12 === 1 ? 12 : h12 - 1
      setH(isPM ? (prev12 === 12 ? 12 : prev12 + 12) : (prev12 === 12 ? 0 : prev12))
    }
  }
  const incM = () => setM(p => (p + 5) % 60)
  const decM = () => setM(p => (p - 5 + 60) % 60)

  const togglePeriod = () => setH(p => p < 12 ? p + 12 : p - 12)

  const handleConfirm = () => {
    onSelect(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    onClose()
  }

  const s = StyleSheet.create({
    overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    sheet:      { width: '100%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
    header:     { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    titleTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    fmtToggle:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
    fmtTxt:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    display:    { alignItems: 'center' as const, paddingVertical: Spacing.md, borderRadius: Radius.md },
    dispTxt:    { fontSize: 42, fontWeight: FontWeight.bold, letterSpacing: 2 },
    dispPeriod: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginLeft: 8 },
    pickers:    { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: Spacing.xl },
    col:        { alignItems: 'center' as const, gap: Spacing.sm },
    colLabel:   { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase' as const, letterSpacing: 1 },
    arrowBtn:   { padding: 6 },
    valBox:     { width: 68, height: 68, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    valTxt:     { fontSize: 30, fontWeight: FontWeight.bold },
    colon:      { fontSize: 30, fontWeight: FontWeight.bold, marginTop: 20 },
    periodCol:  { alignItems: 'center' as const, gap: 8 },
    periodBtn:  { width: 56, height: 36, borderRadius: Radius.sm, borderWidth: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    periodTxt:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    actions:    { flexDirection: 'row' as const, gap: Spacing.sm },
    cancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center' as const },
    cancelTxt:  { fontWeight: FontWeight.bold, fontSize: FontSize.md },
    confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: Radius.sm, alignItems: 'center' as const },
    confirmTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[s.sheet, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]} activeOpacity={1}>

          {/* Header */}
          <View style={s.header}>
            <Text style={[s.titleTxt, { color: Colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity
              style={[s.fmtToggle, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}
              onPress={() => setIs24hr(p => !p)}
            >
              <Text style={[s.fmtTxt, { color: Colors.accent }]}>{is24hr ? '24-hr' : '12-hr'}</Text>
            </TouchableOpacity>
          </View>

          {/* Large time display */}
          <View style={[s.display, { backgroundColor: Colors.bgTertiary }]}>
            <Text style={[s.dispTxt, { color: Colors.textPrimary }]}>
              {String(dispH).padStart(2, '0')}:{String(m).padStart(2, '0')}
              {!is24hr && (
                <Text style={[s.dispPeriod, { color: Colors.accent }]}> {isPM ? 'PM' : 'AM'}</Text>
              )}
            </Text>
          </View>

          {/* Pickers row */}
          <View style={s.pickers}>

            {/* Hour column */}
            <View style={s.col}>
              <Text style={[s.colLabel, { color: Colors.textMuted }]}>Hour</Text>
              <TouchableOpacity onPress={incH} style={s.arrowBtn}>
                <Ionicons name="chevron-up" size={24} color={Colors.accent} />
              </TouchableOpacity>
              <View style={[s.valBox, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
                <Text style={[s.valTxt, { color: Colors.textPrimary }]}>{String(dispH).padStart(2, '0')}</Text>
              </View>
              <TouchableOpacity onPress={decH} style={s.arrowBtn}>
                <Ionicons name="chevron-down" size={24} color={Colors.accent} />
              </TouchableOpacity>
            </View>

            <Text style={[s.colon, { color: Colors.textMuted }]}>:</Text>

            {/* Minute column */}
            <View style={s.col}>
              <Text style={[s.colLabel, { color: Colors.textMuted }]}>Min</Text>
              <TouchableOpacity onPress={incM} style={s.arrowBtn}>
                <Ionicons name="chevron-up" size={24} color={Colors.accent} />
              </TouchableOpacity>
              <View style={[s.valBox, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
                <Text style={[s.valTxt, { color: Colors.textPrimary }]}>{String(m).padStart(2, '0')}</Text>
              </View>
              <TouchableOpacity onPress={decM} style={s.arrowBtn}>
                <Ionicons name="chevron-down" size={24} color={Colors.accent} />
              </TouchableOpacity>
            </View>

            {/* AM/PM column — 12-hr mode only */}
            {!is24hr && (
              <View style={s.periodCol}>
                <Text style={[s.colLabel, { color: Colors.textMuted }]}>Period</Text>
                <TouchableOpacity
                  style={[s.periodBtn, { backgroundColor: !isPM ? Colors.accent : Colors.bgTertiary, borderColor: Colors.border }]}
                  onPress={() => isPM && togglePeriod()}
                >
                  <Text style={[s.periodTxt, { color: !isPM ? '#fff' : Colors.textMuted }]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.periodBtn, { backgroundColor: isPM ? Colors.accent : Colors.bgTertiary, borderColor: Colors.border }]}
                  onPress={() => !isPM && togglePeriod()}
                >
                  <Text style={[s.periodTxt, { color: isPM ? '#fff' : Colors.textMuted }]}>PM</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]} onPress={onClose}>
              <Text style={[s.cancelTxt, { color: Colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirmBtn, { backgroundColor: Colors.accent }]} onPress={handleConfirm}>
              <Text style={s.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
