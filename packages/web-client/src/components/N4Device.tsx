import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { N4State, KnobState } from '@/hooks/useN4State'

const ROW1_KEYS = [11, 12, 13, 14, 15]
const ROW2_KEYS = [6, 7, 8, 9, 10]
const TOUCH_COUNT = 4

// Key: 112×112
function Key({ id, active, children }: { id: number; active: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0',
        'w-[112px] h-[112px] rounded-[7px] border border-white/[.045] transition-all duration-75',
        active ? 'scale-[0.96]' : 'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]',
      )}
      style={{
        background: active
          ? 'linear-gradient(145deg,#3355e8 0%,#1b33c0 100%)'
          : 'linear-gradient(145deg,#1c1d2c 0%,#10111a 100%)',
        boxShadow: active
          ? '0 0 18px rgba(80,120,240,.55),0 0 6px rgba(80,120,240,.3),inset 0 1px 0 rgba(255,255,255,.18)'
          : undefined,
      }}
    >
      {children ? (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {children}
        </div>
      ) : (
        <>
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              background: active
                ? 'linear-gradient(145deg,rgba(255,255,255,.12) 0%,transparent 55%)'
                : 'linear-gradient(145deg,rgba(255,255,255,.045) 0%,transparent 55%)',
            }}
          />
          <span className={cn('text-[10px] leading-none font-mono pointer-events-none z-10',
            active ? 'text-white/45' : 'text-white/10')}>
            {id}
          </span>
        </>
      )}
    </div>
  )
}

// TouchKey: 172×112
function TouchKey({ id, active, children }: { id: number; active: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0',
        'w-[172px] h-[112px] rounded-[6px] transition-all duration-75',
        active ? 'scale-[0.96]' : 'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]',
      )}
      style={{
        background: active
          ? 'linear-gradient(145deg,#0e7a80 0%,#065a60 100%)'
          : 'linear-gradient(145deg,#111820 0%,#0a0e14 100%)',
        boxShadow: active
          ? '0 0 14px rgba(20,200,220,.45),inset 0 1px 0 rgba(255,255,255,.15)'
          : undefined,
      }}
    >
      {children ? (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {children}
        </div>
      ) : (
        <>
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              background: active
                ? 'linear-gradient(145deg,rgba(255,255,255,.10) 0%,transparent 55%)'
                : 'linear-gradient(145deg,rgba(255,255,255,.03) 0%,transparent 55%)',
            }}
          />
          <span className={cn('text-[10px] leading-none font-mono pointer-events-none z-10',
            active ? 'text-cyan-200/80' : 'text-white/10')}>
            T{id}
          </span>
        </>
      )}
    </div>
  )
}

// ── Knob ─────────────────────────────────────────────────────────────────────

function Knob({ angle, pressed }: KnobState) {
  return (
    <div
      className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-100',
        pressed ? 'translate-y-0.5 scale-[.95]' : '',
      )}
      style={{
        background: 'radial-gradient(circle at 50% 105%,#3a3a3a 0%,#1c1c1c 55%,#111 100%)',
        boxShadow: pressed
          ? '0 2px 8px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.08),inset 0 3px 10px rgba(0,0,0,.65)'
          : '0 8px 18px rgba(0,0,0,.85),0 3px 6px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 4px rgba(0,0,0,.55)',
      }}
    >
      <div
        className="w-11 h-11 rounded-full flex justify-center items-start pt-1.5"
        style={{
          background: 'radial-gradient(circle at 38% 32%,#555 0%,#303030 38%,#1e1e1e 70%,#181818 100%)',
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,.2),inset 0 -2px 5px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.4)',
          transform: `rotate(${angle}deg)`,
          transition: 'transform .12s cubic-bezier(.25,.46,.45,.94)',
        }}
      >
        <span
          className="block w-[3px] h-[9px] rounded-sm"
          style={{ background: 'rgba(255,255,255,.78)', boxShadow: '0 0 4px rgba(255,255,255,.3)' }}
        />
      </div>
    </div>
  )
}

// ── N4Device ──────────────────────────────────────────────────────────────────
// Touch row: 4 × 172px + 3 × 12px gap = 724px content
// Screen: 724px + 2 × 10px padding = 744px
// Device: 744px + 2 × 14px padding = 772px
// Main key rows (584px + 4×12 = 632px) are centered within the 724px screen content

interface N4DeviceProps extends Partial<N4State> {
  key1?: ReactNode
  key2?: ReactNode
  key3?: ReactNode
  key4?: ReactNode
  key5?: ReactNode
  key6?: ReactNode
  key7?: ReactNode
  key8?: ReactNode
  key9?: ReactNode
  key10?: ReactNode
  touch1?: ReactNode
  touch2?: ReactNode
  touch3?: ReactNode
  touch4?: ReactNode
}

const DEFAULT_KNOBS = Array.from({ length: 4 }, () => ({ angle: 0, pressed: false }))

export function N4Device({
  activeKeys = {}, activeTouchKeys = {}, knobs = DEFAULT_KNOBS,
  key1, key2, key3, key4, key5,
  key6, key7, key8, key9, key10,
  touch1, touch2, touch3, touch4,
}: N4DeviceProps) {
  const row1Slots = [key1, key2, key3, key4, key5]
  const row2Slots = [key6, key7, key8, key9, key10]
  const touchSlots = [touch1, touch2, touch3, touch4]
  const touchKeys = Array.from({ length: TOUCH_COUNT }, (_, i) => i + 1)

  return (
    <div
      className="w-[772px] rounded-2xl pt-3.5 px-3.5 pb-0 select-none shrink-0"
      style={{
        background: 'linear-gradient(175deg,#2a2a2a 0%,#111 55%,#1a1a1a 100%)',
        boxShadow: '0 40px 100px rgba(0,0,0,.85),0 12px 30px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08),inset 0 0 0 1px rgba(255,255,255,.025)',
      }}
      aria-label="StreamDock N4"
    >
      {/* ── Screen ── */}
      <div
        className="rounded-lg p-2.5 flex flex-col gap-3"
        style={{
          background: '#040404',
          boxShadow: 'inset 0 2px 14px rgba(0,0,0,.95),inset 0 0 0 1px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.02)',
        }}
      >
        {/* Row 1 — keys 11–15: centered within the wider touch row */}
        <div className="flex justify-center gap-3">
          {ROW1_KEYS.map((id, i) => (
            <Key key={id} id={id} active={!!activeKeys[id]}>{row1Slots[i]}</Key>
          ))}
        </div>

        {/* Row 2 — keys 6–10 */}
        <div className="flex justify-center gap-3">
          {ROW2_KEYS.map((id, i) => (
            <Key key={id} id={id} active={!!activeKeys[id]}>{row2Slots[i]}</Key>
          ))}
        </div>

        {/* Row 3 — touch panel: 4 × 172px + gap-3 = 706px, fills screen exactly */}
        <div className="flex gap-3">
          {touchKeys.map((id, i) => (
            <TouchKey key={id} id={id} active={!!activeTouchKeys[id]}>{touchSlots[i]}</TouchKey>
          ))}
        </div>
      </div>

      {/* ── LED accent strip ── */}
      <div
        className="h-0.5 mx-1.5 mt-2.5 rounded-sm"
        style={{
          background: 'linear-gradient(90deg,transparent 0%,rgba(60,110,255,.18) 15%,rgba(100,170,255,.38) 40%,rgba(140,200,255,.42) 50%,rgba(100,170,255,.38) 60%,rgba(60,110,255,.18) 85%,transparent 100%)',
          boxShadow: '0 0 10px rgba(100,160,255,.28)',
        }}
      />

      {/* ── Knobs ── */}
      <div className="flex justify-around items-center px-7 pt-4 pb-[22px]">
        {knobs.map((k, i) => <Knob key={i} {...k} />)}
      </div>
    </div>
  )
}
