import { useStreamDock } from '@/hooks/useStreamDock'
import { DeviceCard } from '@/components/DeviceCard'
import { EventLog } from '@/components/EventLog'
import { N4Panel } from '@/panels/N4Panel'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const STATUS_CONFIG = {
  connecting: { label: 'Connecting…', dot: 'bg-yellow-400' },
  connected: { label: 'Connected', dot: 'bg-green-400' },
  disconnected: { label: 'Disconnected', dot: 'bg-red-400' },
}

const N4_TYPES = new Set(['N4', 'N4Pro'])

export default function App() {
  const { status, devices, events, clearEvents } = useStreamDock()

  const deviceList = Object.values(devices)
  const n4Device = deviceList.find((d) => N4_TYPES.has(d.type))
  const { label, dot } = STATUS_CONFIG[status]

  return (
    <div className="flex flex-col h-svh">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">StreamDock Demo</h1>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          {label}
        </Badge>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: device controls */}
        <aside className="w-72 flex-shrink-0 border-r flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Devices ({deviceList.length})
            </span>
          </div>
          <Separator />
          <div className="p-4 space-y-3 flex-1">
            {deviceList.length === 0 ? (
              <div className="border border-dashed rounded-lg px-4 py-10 text-center text-sm text-muted-foreground leading-relaxed">
                No devices found.
                <br />
                Connect a StreamDock device
                <br />
                and start the server.
              </div>
            ) : (
              deviceList.map((device) => (
                <DeviceCard key={device.path} device={device} />
              ))
            )}
          </div>
        </aside>

        {/* Center: N4 virtual device (when connected) */}
        {n4Device && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-muted/20 overflow-auto p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {n4Device.product}
              </p>
              <N4Panel devicePath={n4Device.path} events={events} />
              <p className="text-xs text-muted-foreground mt-2">
                Press keys or turn knobs to see them light up
              </p>
            </div>
            <Separator orientation="vertical" />
          </>
        )}

        {/* Right: event log */}
        <div className={`flex flex-col overflow-hidden ${n4Device ? 'w-100 flex-shrink-0' : 'flex-1'}`}>
          <EventLog events={events} onClear={clearEvents} />
        </div>
      </div>
    </div>
  )
}
