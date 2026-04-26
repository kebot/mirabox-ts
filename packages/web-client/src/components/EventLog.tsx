import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { InputEvent } from '@/hooks/useStreamDock'

const TYPE_VARIANTS: Record<string, string> = {
  BUTTON:   'bg-blue-500',
  TOUCH:    'bg-green-500',
  KNOB_ROT: 'bg-orange-500',
  KNOB_BTN: 'bg-yellow-500',
  SWIPE:    'bg-purple-500',
}

const TYPE_LABELS: Record<string, string> = {
  BUTTON:   'BTN',
  TOUCH:    'TOUCH',
  KNOB_ROT: 'KNOB↻',
  KNOB_BTN: 'KNOB●',
  SWIPE:    'SWIPE',
}

interface Props {
  events: InputEvent[]
  onClear: () => void
}

export function EventLog({ events, onClear }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Event Log
          </span>
          {events.length > 0 && (
            <Badge variant="secondary" className="text-xs font-mono h-5 px-2">
              {events.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-3"
          onClick={onClear}
          disabled={events.length === 0}
        >
          Clear
        </Button>
      </div>

      <Separator />

      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Waiting for input events…
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <ul className="py-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="grid items-center gap-3 px-5 py-1.5 hover:bg-muted/40 font-mono text-xs"
                style={{ gridTemplateColumns: '86px 58px 1fr 56px' }}
              >
                <span className="text-muted-foreground">{ev.timestamp.slice(0, 8)}</span>
                <span
                  className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${TYPE_VARIANTS[ev.type]}`}
                >
                  {TYPE_LABELS[ev.type]}
                </span>
                <span className="text-foreground truncate">{ev.detail}</span>
                <span
                  className="text-muted-foreground text-right truncate"
                  title={ev.path}
                >
                  {ev.path.slice(0, 8)}…
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
