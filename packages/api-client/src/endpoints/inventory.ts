import { getClient } from '../client';
export const inventoryApi = {
  stats:          ()                         => getClient().get('/inventory/stats').then(r => r.data),
  listAssets:     (p?: { category?: string }) => getClient().get('/inventory/assets', { params: p }).then(r => r.data),
  createAsset:    (d: any)                   => getClient().post('/inventory/assets', d).then(r => r.data),
  addMaintenance: (id: string, d: any)       => getClient().post(`/inventory/assets/${id}/maintenance`, d).then(r => r.data),
  listStock:      ()                         => getClient().get('/inventory/stock').then(r => r.data),
  lowStock:       ()                         => getClient().get('/inventory/stock/low').then(r => r.data),
  addStock:       (d: any)                   => getClient().post('/inventory/stock', d).then(r => r.data),
  updateQuantity: (id: string, d: any)       => getClient().patch(`/inventory/stock/${id}/quantity`, d).then(r => r.data),
};
