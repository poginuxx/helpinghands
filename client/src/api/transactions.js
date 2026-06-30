import api from './axios';

export const getTransactions   = (params) => api.get('/transactions', { params }).then(r => r.data);
export const getTransaction    = (id)     => api.get(`/transactions/${id}`).then(r => r.data);
export const createTransaction = (data)   => api.post('/transactions', data).then(r => r.data);
export const bulkDeleteTransactions = (ids) => api.delete('/transactions/bulk', { data: { ids } });
