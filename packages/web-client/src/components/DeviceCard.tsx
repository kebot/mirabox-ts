import { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/api/client'
import type { DeviceInfo } from '@/hooks/useStreamDock'

interface Props {
  device: DeviceInfo
}

export function DeviceCard({ device }: Props) {
  const [brightness, setBrightness] = useState(80)
  const [led, setLed] = useState({ r: 255, g: 255, b: 255 })
  const [busy, setBusy] = useState<string | null>(null)

  const call = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key)
      try { await fn() } finally { setBusy(null) }
    },
    [],
  )

  const path = device.path

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="secondary" className="mb-1.5 text-xs">
              {device.type}
            </Badge>
            <CardTitle className="text-base">{device.product}</CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <span>S/N: {device.serialNumber || '—'}</span>
            <span>FW: {device.firmwareVersion || '—'}</span>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-5">
        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Brightness
            </span>
            <span className="text-xs font-mono">{brightness}</span>
          </div>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[brightness]}
              onValueChange={([v]) => setBrightness(v)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-3"
              disabled={busy === 'brightness'}
              onClick={() => call('brightness', () =>
                apiClient.POST('/devices/{path}/brightness', {
                  params: { path: { path } },
                  body: { brightness },
                })
              )}
            >
              Set
            </Button>
          </div>
        </div>

        {/* LED Color */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              LED Color
            </span>
            <span
              className="inline-block w-4 h-4 rounded border border-border flex-shrink-0"
              style={{ background: `rgb(${led.r},${led.g},${led.b})` }}
            />
          </div>
          {(['r', 'g', 'b'] as const).map((ch) => {
            const colors = { r: '#ef4444', g: '#22c55e', b: '#3b82f6' }
            return (
              <div key={ch} className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold w-3">{ch.toUpperCase()}</span>
                <Slider
                  min={0}
                  max={255}
                  step={1}
                  value={[led[ch]]}
                  onValueChange={([v]) => setLed((prev) => ({ ...prev, [ch]: v }))}
                  className="flex-1"
                  style={{ '--tw-slider-color': colors[ch] } as React.CSSProperties}
                />
                <span className="text-xs font-mono w-7 text-right">{led[ch]}</span>
              </div>
            )
          })}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-3"
              disabled={busy === 'led-color'}
              onClick={() => call('led-color', () =>
                apiClient.POST('/devices/{path}/led-color', {
                  params: { path: { path } },
                  body: { r: led.r, g: led.g, b: led.b },
                })
              )}
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-3"
              disabled={busy === 'led-reset'}
              onClick={() => call('led-reset', () =>
                apiClient.POST('/devices/{path}/led-reset', {
                  params: { path: { path } },
                })
              )}
            >
              Reset LED
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Actions
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-3"
              disabled={busy === 'clear-all-icons'}
              onClick={() => call('clear-all-icons', () =>
                apiClient.POST('/devices/{path}/clear-all-icons', {
                  params: { path: { path } },
                })
              )}
            >
              Clear all icons
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-3"
              disabled={busy === 'refresh'}
              onClick={() => call('refresh', () =>
                apiClient.POST('/devices/{path}/refresh', {
                  params: { path: { path } },
                })
              )}
            >
              Refresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
