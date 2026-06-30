import api from './axios';

export const getPurchases = () => api.get('/purchases').then(r => r.data);
export const createPurchase = (data) => api.post('/purchases', data).then(r => r.data);
export const receivePurchase = (id) => api.patch(`/purchases/${id}/receive`).then(r => r.data);
