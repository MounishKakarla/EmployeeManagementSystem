// src/api/index.ts
// Full API layer — mirrors ems-frontend/src/api/index.js

import client from './client'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data: { username: string; password: string }) =>
                    client.post('/auth/login', data),
  logout:         () => client.post('/auth/logout'),
  me:             () => client.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
                    client.put('/auth/changePassword', { oldPassword: data.currentPassword, newPassword: data.newPassword }),
  resetPassword:  (empId: string) => client.post(`/auth/reset-password/${empId}`),
}

// ── Employee ──────────────────────────────────────────────────────────────────
export const employeeAPI = {
  create:          (data: Record<string, unknown>) => client.post('/ems/employee', data),
  getProfile:      () => client.get('/ems/profile'),
  getById:         (empId: string) => client.get(`/ems/employee/${empId}`),
  search:          (params: Record<string, unknown>) => client.get('/ems/employees', { params }),
  getInactiveById: (empId: string) => client.get(`/ems/employee/inactive/${empId}`),
  getInactive:     (params: Record<string, unknown>) => client.get('/ems/employees/inactive', { params }),
  delete:          (empId: string) => client.delete(`/ems/employee/${empId}`),
  update:          (empId: string, data: Record<string, unknown>) => client.patch(`/ems/update/${empId}`, data),
}

// ── Leave ─────────────────────────────────────────────────────────────────────
export const leaveAPI = {
  submit:       (data: Record<string, unknown>) => client.post('/ems/leaves', data),
  cancel:       (id: number) => client.delete(`/ems/leaves/${id}`),
  getMyLeaves:  (params?: Record<string, unknown>) => client.get('/ems/leaves/my', { params }),
  getMyBalance: () => client.get('/ems/leaves/balance'),
  getPending:   (params?: Record<string, unknown>) => client.get('/ems/leaves/pending', { params }),
  getAll:       (empId?: string, status?: string, params?: Record<string, unknown>) =>
                  client.get('/ems/leaves/all', { params: { empId, status, ...params } }),
  review:       (id: number, action: string, notes?: string) =>
                  client.put(`/ems/leaves/${id}/review`, { reviewNotes: notes }, { params: { action } }),
  getBalance:   (empId: string) => client.get(`/ems/leaves/balance/${empId}`),
  grantLeave:   (empId: string, data: Record<string, unknown>) =>
                  client.post(`/ems/leaves/grant/${empId}`, data),
}

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceAPI = {
  checkIn:            (notes?: string) => client.post('/ems/attendance/check-in', { notes }),
  checkOut:           () => client.post('/ems/attendance/check-out'),
  getToday:           () => client.get('/ems/attendance/today'),
  getMyHistory:       (params?: Record<string, unknown>) => client.get('/ems/attendance/my', { params }),
  getMySummary:       (month: number, year: number) =>
                        client.get('/ems/attendance/my/summary', { params: { month, year } }),
  getMyRange:         (start: string, end: string) =>
                        client.get('/ems/attendance/my/range', { params: { start, end } }),
  // Manager / Admin endpoints
  override:           (data: Record<string, unknown>) => client.post('/ems/attendance/override', data),
  update:             (id: number, data: Record<string, unknown>) => client.put(`/ems/attendance/${id}`, data),
  delete:             (id: number) => client.delete(`/ems/attendance/${id}`),
  getTeam:            (start: string, end: string, empId?: string, params?: Record<string, unknown>) =>
                        client.get('/ems/attendance/team', { params: { start, end, empId, ...params } }),
  getDaily:           (date: string, department?: string) =>
                        client.get('/ems/attendance/daily', { params: { date, department } }),
  getEmployeeSummary: (empId: string, month: number, year: number) =>
                        client.get(`/ems/attendance/summary/${empId}`, { params: { month, year } }),
}

// ── Timesheet ─────────────────────────────────────────────────────────────────
export const timesheetAPI = {
  getCurrentWeek:  () => client.get('/ems/timesheets/current-week'),
  getWeek:         (date: string) => client.get('/ems/timesheets/week', { params: { date } }),
  saveEntry:       (data: Record<string, unknown>) => client.post('/ems/timesheets', data),
  submitWeek:      (weekStartDate: string) =>
                     client.post('/ems/timesheets/submit', null, { params: { weekStartDate } }),
  getMyTimesheets: (params?: Record<string, unknown>) => client.get('/ems/timesheets/my', { params }),
  // Manager / Admin endpoints
  getPending:      (params?: Record<string, unknown>) => client.get('/ems/timesheets/pending', { params }),
  getTeam:         (empId?: string, status?: string, params?: Record<string, unknown>) =>
                     client.get('/ems/timesheets/team', { params: { empId, status, ...params } }),
  review:          (id: number, action: string, notes?: string) =>
                     client.put(`/ems/timesheets/${id}/review`, { reviewNotes: notes }, { params: { action } }),
}

// ── Holidays ──────────────────────────────────────────────────────────────────
export const holidayAPI = {
  getByYear: (year: number) => client.get('/ems/holidays', { params: { year } }),
}
