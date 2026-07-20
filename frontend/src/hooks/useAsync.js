import { useCallback, useEffect, useState } from "react";

export function useAsync(callback, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const execute = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await callback();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error });
      throw error;
    }
  };

  const setData = useCallback((updater) => {
    setState((previous) => ({
      ...previous,
      data: typeof updater === "function" ? updater(previous.data) : updater
    }));
  }, []);

  useEffect(() => {
    let mounted = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    callback()
      .then((data) => mounted && setState({ data, loading: false, error: null }))
      .catch((error) => mounted && setState({ data: null, loading: false, error }));
    return () => {
      mounted = false;
    };
  }, dependencies);

  return { ...state, execute, setData };
}

