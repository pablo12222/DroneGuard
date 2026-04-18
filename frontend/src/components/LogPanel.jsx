import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

const LEVEL_CONFIG = {
  success: { textColor: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-100', prefix: '✓', prefixColor: 'text-emerald-500' },
  error:   { textColor: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-100',    prefix: '✗', prefixColor: 'text-rose-500'    },
  warning: { textColor: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-100',   prefix: '⚠', prefixColor: 'text-amber-500'   },
  info:    { textColor: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-100',    prefix: '›', prefixColor: 'text-blue-400'    },
};

const DEFAULT_CFG = LEVEL_CONFIG.info;

export default function LogPanel({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <aside className="w-80 flex flex-col border-l border-black/6 bg-white flex-shrink-0 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/4 flex-shrink-0 bg-white">
        <Terminal size={13} className="text-black" />
        <span className="text-[10px] text-black uppercase tracking-widest font-mono">System Log</span>
        <span className="ml-auto text-[10px] text-black font-mono bg-[#f5f5f7] px-2 py-0.5 rounded-full">
          {logs.length}
        </span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto terminal-text p-2 space-y-1 bg-[#fafafa]">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Terminal size={20} className="text-[#d1d1d6]" />
            <p className="text-xs text-[#c7c7cc] font-mono">Waiting for events...</p>
          </div>
        )}

        {logs.map(log => {
          const cfg = LEVEL_CONFIG[log.level] || DEFAULT_CFG;
          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border text-xs ${cfg.bg} ${cfg.border}`}
            >
              {/* Prefix icon */}
              <span className={`${cfg.prefixColor} flex-shrink-0 mt-px w-3 font-bold`}>
                {cfg.prefix}
              </span>

              <div className="flex-1 min-w-0">
                {/* Timestamp */}
                {log.timestamp > 0 && (
                  <span className="text-[#aeaeb2] font-mono mr-1.5 text-[10px]">
                    T+{log.timestamp.toFixed(1)}s
                  </span>
                )}
                {/* Message */}
                <span className={`${cfg.textColor} break-words leading-relaxed font-mono`}>
                  {log.message}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Legend footer */}
      <div className="px-4 py-2.5 border-t border-black/5 bg-white flex-shrink-0">
        <div className="flex gap-4">
          {Object.entries(LEVEL_CONFIG).map(([level, cfg]) => (
            <div key={level} className="flex items-center gap-1">
              <span className={`text-xs ${cfg.prefixColor} font-bold`}>{cfg.prefix}</span>
              <span className="text-[10px] text-[#aeaeb2] font-mono capitalize">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
