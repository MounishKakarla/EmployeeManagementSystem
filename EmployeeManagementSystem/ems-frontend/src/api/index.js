// src/api/index.js
// Single Axios instance + all API groups for the Tektalis EMS frontend.

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ── Axios instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 60000,
})

// ── Refresh-storm guard ────────────────────────────────────────────────────────
let isRefreshing = false
let pendingQueue = []

function processQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  )
  pendingQueue = []
}

// ── Response interceptor (auto token refresh) ──────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const skipRetry =
      original?._retry ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login')   ||
      original?.url?.includes('/auth/logout')

    if (error.response?.status === 401 && !skipRetry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then(() => api(original))
      }
      original._retry  = true
      isRefreshing     = true
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        processQueue(null)
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ── Auth APIs ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data)  => api.post('/auth/login', data),
  logout:         ()      => api.post('/auth/logout'),
  refresh:        ()      => api.post('/auth/refresh'),
  me:             ()      => api.get('/auth/me'),
  changePassword: (data)  => api.put('/auth/changePassword', data),
  resetPassword:  (empId) => api.post(`/auth/reset-password/${empId}`),
}

// ── Employee APIs ──────────────────────────────────────────────────────────────
export const employeeAPI = {
  create:          (data)        => api.post('/ems/employee', data),
  getProfile:      ()            => api.get('/ems/profile'),
  getById:         (empId)       => api.get(`/ems/employee/${empId}`),
  search:          (params)      => api.get('/ems/employees', { params }),
  getInactiveById: (empId)       => api.get(`/ems/employee/inactive/${empId}`),
  getInactive:     (params)      => api.get('/ems/employees/inactive', { params }),
  delete:          (empId)       => api.delete(`/ems/employee/${empId}`),
  update:          (empId, data) => api.patch(`/ems/update/${empId}`, data),
}

// ── Role APIs ──────────────────────────────────────────────────────────────────
export const roleAPI = {
  assign:   (empId, grantRole)  => api.post(`/ems/assign/${empId}`, null, { params: { grantRole } }),
  remove:   (empId, revokeRole) => api.post(`/ems/remove/${empId}`, null, { params: { revokeRole } }),
  getRoles: (empId)             => api.get(`/ems/roles/${empId}`),
}

// ── Attendance APIs ────────────────────────────────────────────────────────────
export const attendanceAPI = {
  checkIn:            (notes)                  => api.post('/ems/attendance/check-in', { notes }),
  checkOut:           ()                       => api.post('/ems/attendance/check-out'),
  getToday:           ()                       => api.get('/ems/attendance/today'),
  getMyHistory:       (params)                 => api.get('/ems/attendance/my', { params }),
  getMyRange:         (start, end)             => api.get('/ems/attendance/my/range', { params: { start, end } }),
  getMySummary:       (month, year)            => api.get('/ems/attendance/my/summary', { params: { month, year } }),
  override:           (data)                   => api.post('/ems/attendance/override', data),
  update:             (id, data)               => api.put(`/ems/attendance/${id}`, data),
  delete:             (id)                     => api.delete(`/ems/attendance/${id}`),
  getTeam:            (start, end, empId, p)   => api.get('/ems/attendance/team', { params: { start, end, empId, ...p } }),
  getDaily:           (date, department)       => api.get('/ems/attendance/daily', { params: { date, department } }),
  getEmployeeSummary: (empId, month, year)     => api.get(`/ems/attendance/summary/${empId}`, { params: { month, year } }),
}

// ── Leave APIs ─────────────────────────────────────────────────────────────────
export const leaveAPI = {
  submit:       (data)                    => api.post('/ems/leaves', data),
  cancel:       (id)                      => api.delete(`/ems/leaves/${id}`),
  getMyLeaves:  (params)                  => api.get('/ems/leaves/my', { params }),
  getMyBalance: ()                        => api.get('/ems/leaves/balance'),
  getPending:   (params)                  => api.get('/ems/leaves/pending', { params }),
  getAll:       (empId, status, params)   => api.get('/ems/leaves/all', { params: { empId, status, ...params } }),
  review:       (id, action, notes)       => api.put(`/ems/leaves/${id}/review`, { reviewNotes: notes }, { params: { action } }),
  getBalance:   (empId)                   => api.get(`/ems/leaves/balance/${empId}`),
}

// ── Timesheet APIs ─────────────────────────────────────────────────────────────
export const timesheetAPI = {
  getCurrentWeek:  ()                          => api.get('/ems/timesheets/current-week'),
  saveEntry:       (data)                      => api.post('/ems/timesheets', data),
  submitWeek:      (weekStartDate)             => api.post('/ems/timesheets/submit', null, { params: { weekStartDate } }),
  getMyTimesheets: (params)                    => api.get('/ems/timesheets/my', { params }),
  getPending:      (params)                    => api.get('/ems/timesheets/pending', { params }),
  getTeam:         (empId, status, params)     => api.get('/ems/timesheets/team', { params: { empId, status, ...params } }),
  review:          (id, action, notes)         => api.put(`/ems/timesheets/${id}/review`, { reviewNotes: notes }, { params: { action } }),
}

// ── Holiday Calendar APIs ──────────────────────────────────────────────────────
export const holidayAPI = {
  getByYear:       (year)        => api.get('/ems/holidays', { params: { year } }),
  add:             (data)        => api.post('/ems/holidays', data),
  update:          (id, data)    => api.put(`/ems/holidays/${id}`, data),
  delete:          (id)          => api.delete(`/ems/holidays/${id}`),
  getNonWorking:   (start, end)  => api.get('/ems/holidays/non-working', { params: { start, end } }),
}

// ── Excel Import API ───────────────────────────────────────────────────────────
export const importAPI = {
  importEmployees: (formData) => api.post('/ems/employees/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// ── Audit Log APIs ─────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs:    (params)                       => api.get('/ems/audit/logs', { params }),
  searchLogs: (user, action, target, params) => api.get('/ems/audit/logs/search', { params: { user, action, target, ...params } }),
  getByUser:  (empId, params)                => api.get(`/ems/audit/logs/user/${empId}`, { params }),
}
