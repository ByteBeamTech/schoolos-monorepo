import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

export function useApi(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api.get(url));
    } catch (e) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  // eslint-disable-next-line
  }, deps);

  return { data, loading, error, refetch: load };
}
