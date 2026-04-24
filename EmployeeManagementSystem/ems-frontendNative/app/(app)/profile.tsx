// app/(app)/profile.tsx — Profile Screen
import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { authAPI, employeeAPI } from '../../src/api'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value?: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.bgTertiary }]}>
        <Ionicons name={icon as any} size={14} color={colors.textMuted} />
      </View>
      <View>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value || '—'}</Text>
      </View>
    </View>
  )
}

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const Colors = useThemeColors()
  
  const [showPwdForm, setShowPwdForm]     = useState(false)
  const [currentPwd, setCurrentPwd]       = useState('')
  const [newPwd, setNewPwd]               = useState('')
  const [confirmPwd, setConfirmPwd]       = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd]         = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => employeeAPI.getProfile(),
  })

  const profile = profileData?.data || user

  const changePwdMutation = useMutation({
    mutationFn: () => authAPI.changePassword({ currentPassword: currentPwd, newPassword: newPwd }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Password changed successfully!' })
      setShowPwdForm(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to change password' }),
  })

  const handleChangePassword = () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Toast.show({ type: 'error', text1: 'All fields are required' }); return
    }
    if (newPwd !== confirmPwd) {
      Toast.show({ type: 'error', text1: 'New passwords do not match' }); return
    }
    if (newPwd.length < 6) {
      Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' }); return
    }
    changePwdMutation.mutate()
  }

  const handleLogout = () => setShowLogoutModal(true)

  const initials = profile?.name?.split(' ')?.map((n: string) => n[0])?.join('')?.slice(0, 2).toUpperCase() || '??'

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Avatar + name card */}
        <View style={[styles.heroCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: Colors.accentLight }]}>
            <Text style={[styles.avatarText, { color: Colors.accent }]}>{initials}</Text>
          </View>
          <Text style={[styles.heroName, { color: Colors.textPrimary }]}>{profile?.name}</Text>
          <Text style={[styles.heroEmail, { color: Colors.textMuted }]}>{profile?.companyEmail}</Text>
          <View style={styles.rolesRow}>
            {profile?.roles?.map((r: string) => (
              <View key={r} style={[styles.rolePill, { backgroundColor: Colors.accentLight }]}>
                <Text style={[styles.roleText, { color: Colors.accent }]}>{r}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Appearance</Text>
          <TouchableOpacity style={styles.themeRow} onPress={toggleTheme}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.infoIcon, { backgroundColor: Colors.bgTertiary }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={14} color={Colors.accent} />
              </View>
              <Text style={[styles.infoValue, { color: Colors.textPrimary }]}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <View style={[styles.toggleTrack, { backgroundColor: isDark ? Colors.accent : Colors.bgTertiary }]}>
              <View style={[styles.toggleThumb, { left: isDark ? 20 : 2 }]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Personal Information</Text>
          <InfoRow icon="person-outline"     label="Employee ID"     value={profile?.empId} colors={Colors} />
          <InfoRow icon="mail-outline"       label="Company Email"   value={profile?.companyEmail} colors={Colors} />
          <InfoRow icon="mail-open-outline"  label="Personal Email"  value={profile?.personalEmail} colors={Colors} />
          <InfoRow icon="call-outline"       label="Phone"           value={profile?.phoneNumber} colors={Colors} />
          <InfoRow icon="location-outline"   label="Address"         value={profile?.address} colors={Colors} />
          <InfoRow icon="male-female-outline" label="Gender"         value={profile?.gender} colors={Colors} />
        </View>

        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Employment Details</Text>
          <InfoRow icon="business-outline"   label="Department"    value={profile?.department} colors={Colors} />
          <InfoRow icon="briefcase-outline"  label="Designation"   value={profile?.designation} colors={Colors} />
          <InfoRow icon="calendar-outline"   label="Date of Join"  value={profile?.dateOfJoin} colors={Colors} />
          <InfoRow icon="gift-outline"       label="Date of Birth" value={profile?.dateOfBirth} colors={Colors} />
        </View>

        {/* Change Password */}
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <TouchableOpacity style={styles.cardTitleRow} onPress={() => setShowPwdForm(v => !v)}>
            <Text style={[styles.cardTitle, { color: Colors.textPrimary }]}>Change Password</Text>
            <Ionicons name={showPwdForm ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {showPwdForm && (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
              <View style={[styles.pwdWrapper, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
                <TextInput style={[styles.pwdInput, { color: Colors.textPrimary }]} placeholder="Current password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showCurrentPwd} value={currentPwd} onChangeText={setCurrentPwd} />
                <TouchableOpacity onPress={() => setShowCurrentPwd(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showCurrentPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={[styles.pwdWrapper, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
                <TextInput style={[styles.pwdInput, { color: Colors.textPrimary }]} placeholder="New password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showNewPwd} value={newPwd} onChangeText={setNewPwd} />
                <TouchableOpacity onPress={() => setShowNewPwd(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={[styles.pwdWrapper, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
                <TextInput style={[styles.pwdInput, { color: Colors.textPrimary }]} placeholder="Confirm new password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showConfirmPwd} value={confirmPwd} onChangeText={setConfirmPwd} />
                <TouchableOpacity onPress={() => setShowConfirmPwd(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.accent }, changePwdMutation.isPending && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={changePwdMutation.isPending}>
                <Text style={styles.btnText}>{changePwdMutation.isPending ? 'Saving…' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: Colors.dangerLight }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={[styles.logoutText, { color: Colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sign-out confirmation modal ─────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showLogoutModal} onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>

            {/* Icon badge */}
            <View style={[styles.modalIconWrap, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="log-out-outline" size={30} color={Colors.danger} />
            </View>

            <Text style={[styles.modalTitle, { color: Colors.textPrimary }]}>Sign Out</Text>
            <Text style={[styles.modalBody, { color: Colors.textMuted }]}>
              Are you sure you want to sign out of your account?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border, borderWidth: 1 }]}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnLabel, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, { backgroundColor: Colors.danger }]}
                onPress={() => { setShowLogoutModal(false); logout() }}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text style={[styles.modalBtnLabel, { color: '#fff' }]}>Sign Out</Text>
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
  header:       { padding: Spacing.md },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  heroCard:     { alignItems: 'center', margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, gap: Spacing.sm },
  avatar:       { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 28, fontWeight: FontWeight.bold },
  heroName:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  heroEmail:    { fontSize: FontSize.sm },
  rolesRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  rolePill:     { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  roleText:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  card:         { borderRadius: Radius.md, margin: Spacing.md, marginTop: 0, padding: Spacing.md, borderWidth: 1, gap: Spacing.md },
  cardTitle:    { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoIcon:     { width: 32, height: 32, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  infoLabel:    { fontSize: FontSize.xs, marginBottom: 2 },
  infoValue:    { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  input:        { borderRadius: Radius.sm, borderWidth: 1, padding: 12, fontSize: FontSize.md },
  pwdWrapper:   { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1 },
  pwdInput:     { flex: 1, fontSize: FontSize.md, padding: 12 },
  eyeBtn:       { paddingHorizontal: 12, paddingVertical: 12 },
  btn:          { borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: FontWeight.bold },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: 14, borderWidth: 1 },
  logoutText:   { fontWeight: FontWeight.bold, fontSize: FontSize.md },
  themeRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleTrack:  { width: 42, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleThumb:  { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

  // ── Logout modal ────────────────────────────────────────────────────────────
  modalOverlay:   {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard:      {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalIconWrap:  {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  modalBody:      { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.sm },
  modalActions:   { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: Spacing.xs },
  modalBtn:       { flex: 1, borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  modalBtnDanger: {},
  modalBtnLabel:  { fontWeight: FontWeight.bold, fontSize: FontSize.md },
})
