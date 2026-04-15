// ─────────────────────────────────────────────────────────────────────────────
// Add these exports to src/api/index.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Leave APIs ────────────────────────────────────────────────────────────────
export const leaveAPI = {
  submit:        (data)                     => api.post('/ems/leaves', data),
  cancel:        (id)                       => api.delete(`/ems/leaves/${id}`),
  getMyLeaves:   (params)                   => api.get('/ems/leaves/my', { params }),
  getMyBalance:  ()                         => api.get('/ems/leaves/balance'),
  getPending:    (params)                   => api.get('/ems/leaves/pending', { params }),
  getAll:        (empId, status, params)    => api.get('/ems/leaves/all', { params: { empId, status, ...params } }),
  review:        (id, action, notes)        => api.put(`/ems/leaves/${id}/review`, { reviewNotes: notes }, { params: { action } }),
  getBalance:    (empId)                    => api.get(`/ems/leaves/balance/${empId}`),
}

// ── Timesheet APIs ────────────────────────────────────────────────────────────
export const timesheetAPI = {
  getCurrentWeek:  ()                            => api.get('/ems/timesheets/current-week'),
  saveEntry:       (data)                        => api.post('/ems/timesheets', data),
  submitWeek:      (weekStartDate)               => api.post('/ems/timesheets/submit', null, { params: { weekStartDate } }),
  getMyTimesheets: (params)                      => api.get('/ems/timesheets/my', { params }),
  getPending:      (params)                      => api.get('/ems/timesheets/pending', { params }),
  getTeam:         (empId, status, params)       => api.get('/ems/timesheets/team', { params: { empId, status, ...params } }),
  review:          (id, action, notes)           => api.put(`/ems/timesheets/${id}/review`, { reviewNotes: notes }, { params: { action } }),
}

// ── Excel Import API ──────────────────────────────────────────────────────────
export const importAPI = {
  importEmployees: (formData) => api.post('/ems/employees/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// ── Audit Log APIs ────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs:    (params)                       => api.get('/ems/audit/logs', { params }),
  searchLogs: (user, action, target, params) => api.get('/ems/audit/logs/search', { params: { user, action, target, ...params } }),
  getByUser:  (empId, params)                => api.get(`/ems/audit/logs/user/${empId}`, { params }),
}
