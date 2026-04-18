import { Wind, Droplets, Thermometer, CloudSun, ShieldCheck, ShieldAlert } from 'lucide-react';

function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export default function WeatherPanel({ weather }) {
  if (!weather) return null;

  return (
    <div className="flex items-center gap-5 text-xs font-mono">
      <div className="flex items-center gap-1.5 text-black/60">
        <Thermometer size={12} className="text-orange-400" />
        <span className="text-black">{weather.temperature?.toFixed(1)}°C</span>
      </div>
      <div className="flex items-center gap-1.5 text-black/60">
        <Wind size={12} className="text-blue-400" />
        <span className="text-black">{weather.windSpeed?.toFixed(1)} m/s</span>
        <span className="text-black/30">{windDir(weather.windDirection)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-black/60">
        <Droplets size={12} className="text-cyan-400" />
        <span className="text-black">{weather.humidity}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        {weather.flightSafe ? (
          <>
            <ShieldCheck size={12} className="text-emerald-400" />
            <span className="text-emerald-400">Flight Safe</span>
          </>
        ) : (
          <>
            <ShieldAlert size={12} className="text-red-400" />
            <span className="text-red-400">Wind Warning</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-black">
        <CloudSun size={12} />
        <span>{weather.condition}</span>
      </div>
    </div>
  );
}
