import api from './axios';

export const getSummary      = ()       => api.get('/reports/summary').then(r => r.data);
export const getChart        = (period) => api.get('/reports/chart', { params: { period } }).then(r => r.data);
export const getTopMedicines = ()       => api.get('/reports/top-medicines').then(r => r.data);
export const getExportUrl    = ()       => `${api.defaults.baseURL}/reports/export`;
