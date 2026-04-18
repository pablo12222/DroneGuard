import { useEffect, useRef } from 'react';
import { api } from '../utils/api';

export function useSSE(missionId, handlers) {
  const esRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!missionId) return;

    const es = new EventSource(api.sseUrl(missionId));
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const handler = handlersRef.current[event.type];
        if (handler) handler(event);
        const catchAll = handlersRef.current['*'];
        if (catchAll) catchAll(event);
      } catch (_) {}
    };

    es.onerror = () => {
      const onErr = handlersRef.current['error'];
      if (onErr) onErr();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [missionId]);
}
