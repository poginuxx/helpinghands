import api from './axios';

export const getMedicines = () => api.get('/medicines').then(r => r.data);
export const createMedicine = (data) => api.post('/medicines', data).then(r => r.data);
export const updateMedicine = (id, data) => api.put(`/medicines/${id}`, data).then(r => r.data);
export const deleteMedicine = (id) => api.delete(`/medicines/${id}`);
