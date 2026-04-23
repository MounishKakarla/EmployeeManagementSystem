// app/(auth)/login.tsx
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { Spacing, FontSize, FontWeight, Radius } from '../../src/theme'
import { Image } from 'react-native'

export default function LoginScreen() {
  const { login } = useAuth()
  const { isDark } = useTheme()
  const Colors = useThemeColors()
  
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  // LOGO ASSETS (using relative paths for the local assets)
  const LOGO_DARK = require('../../src/assets/Tektalis_Logo_White.png')
  const LOGO_LIGHT = require('../../src/assets/Tektalis_Logo_Dark.png')

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your email and password' })
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password.trim())
    } catch (err: any) {
      const isNetworkError = !err?.response
      const msg = isNetworkError
        ? 'Cannot reach server. Check you are on the correct WiFi network.'
        : err?.response?.data?.message || err?.response?.data?.error || 'Invalid credentials. Please try again.'
      Toast.show({ type: 'error', text1: 'Login Failed', text2: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: Colors.bgPrimary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo / Brand */}
        <View style={styles.brand}>
          <Image 
            source={isDark ? LOGO_DARK : LOGO_LIGHT} 
            style={{ width: 220, height: 60, marginBottom: Spacing.sm }} 
            resizeMode="contain" 
          />
          <Text style={[styles.brandSub, { color: Colors.textMuted }]}>Employee Management System</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <Text style={[styles.title, { color: Colors.textPrimary }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: Colors.textMuted }]}>Sign in to your account</Text>

          {/* Email / ID */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: Colors.textSecondary }]}>Company Email or Employee ID</Text>
            <View style={[styles.inputWrapper, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: Colors.textPrimary }]}
                placeholder="name@tektalis.com or TT0001"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: Colors.textSecondary }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: Colors.bgTertiary, borderColor: Colors.border }]}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: Colors.textPrimary, paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: Colors.accent }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: Colors.textMuted }]}>© 2026 Tektalis. All rights reserved.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  brand:       { alignItems: 'center', marginBottom: Spacing.xl },
  brandSub:    { fontSize: FontSize.sm, marginTop: 4 },
  card:        {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  title:       { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
  subtitle:    { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  fieldGroup:  { marginBottom: Spacing.md },
  label:       { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  inputWrapper:{ flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1 },
  inputIcon:   { paddingLeft: 12 },
  input:       { flex: 1, fontSize: FontSize.md, paddingVertical: 12, paddingHorizontal: 10 },
  eyeBtn:      { position: 'absolute', right: 12 },
  btn:         {
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  footer:      { textAlign: 'center', fontSize: FontSize.xs },
})
