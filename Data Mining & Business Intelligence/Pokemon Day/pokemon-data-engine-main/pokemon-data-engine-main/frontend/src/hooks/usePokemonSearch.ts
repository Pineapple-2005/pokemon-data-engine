import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { Pokemon } from '@/types';

export function usePokemonSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.getPokemon();
        const filtered = data.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered.slice(0, 10));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs]);

  return { results, loading, error };
}
