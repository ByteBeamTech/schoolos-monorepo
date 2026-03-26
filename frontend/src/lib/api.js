//const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api/v1';
const API_URL = '/api/v1';
const getHeaders = () => {
  const token = localStorage.getItem('sa_token');
  const tenantId = localStorage.getItem('tenant_id');

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId || 'primary',
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  // 🔥 401 handling
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  let data = {};
  try {
    data = await response.json();
  } catch (e) {}

  if (!response.ok) {
    throw new Error(data.message || `Error: ${response.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
	post: (path, body, options = {}) =>
  request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  }),
  //post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
