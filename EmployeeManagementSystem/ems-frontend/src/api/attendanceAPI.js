// ── Attendance APIs ────────────────────────────────────────────────────────────
// Add this block to src/api/index.js alongside the existing authAPI, employeeAPI, roleAPI exports.

export const attendanceAPI = {
  // Employee self-service
  checkIn:      (notes)                  => api.post('/ems/attendance/check-in', { notes }),
  checkOut:     ()                        => api.post('/ems/attendance/check-out'),
  getToday:     ()                        => api.get('/ems/attendance/today'),
  getMyHistory: (params)                  => api.get('/ems/attendance/my', { params }),
  getMyRange:   (start, end)              => api.get('/ems/attendance/my/range', { params: { start, end } }),
  getMySummary: (month, year)             => api.get('/ems/attendance/my/summary', { params: { month, year } }),

  // Admin / Manager
  override:         (data)               => api.post('/ems/attendance/override', data),
  update:           (id, data)           => api.put(`/ems/attendance/${id}`, data),
  delete:           (id)                 => api.delete(`/ems/attendance/${id}`),
  getTeam:          (start, end, empId, params) =>
                      api.get('/ems/attendance/team', { params: { start, end, empId, ...params } }),
  getDaily:         (date, department)   => api.get('/ems/attendance/daily', { params: { date, department } }),
  getEmployeeSummary: (empId, month, year) =>
                      api.get(`/ems/attendance/summary/${empId}`, { params: { month, year } }),
}
