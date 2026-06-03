const C_MAJOR = [60, 64, 67] as const // C4, E4, G4
const G_MAJOR = [67, 71, 74] as const // G4, B4, D5

// Bbmaj7/C — arpeggio: C bass, Bb, D, F, A
const BBMAJ7_OVER_C_ARP = [48, 58, 62, 65, 69] as const

const STANDARD_RHYTHM = [1, 1, 3, 1, 2] as const
const EASTER_RHYTHM = [1, 1, 1, 1, 4] as const
const UNIT_SEC = 0.18

const EASTER_EGG_CHANCE = 0.1

/** Indices in the standard phrase with longer, softer decay */
const STANDARD_LEGATO_SLOTS = new Set([2, 4])

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function rhythmStartTimes(rhythm: readonly number[]): number[] {
  const starts: number[] = [0]
  let units = 0
  for (let i = 0; i < rhythm.length - 1; i++) {
    units += rhythm[i]
    starts.push(units * UNIT_SEC)
  }
  return starts
}

function slotDuration(rhythm: readonly number[], index: number): number {
  return rhythm[index] * UNIT_SEC
}

function invertTriad(notes: readonly number[], inversion: number): number[] {
  const stack = [...notes].sort((a, b) => a - b)
  for (let i = 0; i < inversion; i++) {
    const bottom = stack.shift()
    if (bottom === undefined) break
    stack.push(bottom + 12)
  }
  return stack
}

/** Lowest 1st-inversion G major (G on top) with G on or above the top of `cChord`. */
function lowestGMajorFirstInversionAbove(cChord: number[]): number[] {
  const threshold = Math.max(...cChord)
  for (let octaveShift = -2; octaveShift < 4; octaveShift++) {
    const voiced = invertTriad(G_MAJOR, 1).map((n) => n + octaveShift * 12)
    if (Math.max(...voiced) >= threshold) return voiced
  }
  return invertTriad(G_MAJOR, 1).map((n) => n + 24)
}

/** F and C+E in the same octave as the G in `gChord`. */
function fAndCEMatchingG(gChord: number[]): { f: number[]; ce: number[] } {
  const gMidi = gChord.find((n) => n % 12 === 7) ?? gChord[0]
  const octaveBase = Math.floor(gMidi / 12) * 12
  return {
    f: [octaveBase + 5],
    ce: [octaveBase, octaveBase + 4],
  }
}

function playNote(
  ctx: AudioContext,
  frequency: number,
  start: number,
  slotDur: number,
  options: { legato?: boolean; gainPeak?: number } = {},
) {
  const { legato = false, gainPeak = 0.11 } = options
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(frequency, start)

  const attack = legato ? 0.04 : 0.02
  const totalDur = legato ? slotDur * 1.2 : slotDur
  const releaseFrom = legato
    ? start + slotDur * 0.65
    : start + slotDur * 0.3

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + attack)
  if (legato) {
    gain.gain.setValueAtTime(gainPeak * 0.92, releaseFrom - 0.02)
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, start + totalDur)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(start)
  osc.stop(start + totalDur + 0.08)
}

function playMidiGroup(
  ctx: AudioContext,
  midis: number[],
  start: number,
  slotDur: number,
  legato: boolean,
) {
  for (const midi of midis) {
    playNote(ctx, midiToFreq(midi), start, slotDur, { legato })
  }
}

function playRhythmSequence(
  ctx: AudioContext,
  groups: number[][],
  rhythm: readonly number[],
  baseTime: number,
  legatoSlots: Set<number> = new Set(),
) {
  const starts = rhythmStartTimes(rhythm)
  groups.forEach((midis, i) => {
    const at = baseTime + starts[i]
    const dur = slotDuration(rhythm, i)
    playMidiGroup(ctx, midis, at, dur, legatoSlots.has(i))
  })
}

function playStandardFinish(ctx: AudioContext, baseTime: number) {
  const inversion = Math.floor(Math.random() * 3)
  const cChord = invertTriad(C_MAJOR, inversion)
  const gChord = lowestGMajorFirstInversionAbove(cChord)
  const { f, ce } = fAndCEMatchingG(gChord)

  playRhythmSequence(
    ctx,
    [cChord, cChord, gChord, f, ce],
    STANDARD_RHYTHM,
    baseTime,
    STANDARD_LEGATO_SLOTS,
  )
}

function playEasterEggArpeggio(ctx: AudioContext, baseTime: number) {
  const starts = rhythmStartTimes(EASTER_RHYTHM)
  BBMAJ7_OVER_C_ARP.forEach((midi, i) => {
    const slotDur = slotDuration(EASTER_RHYTHM, i)
    playNote(ctx, midiToFreq(midi), baseTime + starts[i], slotDur, {
      legato: true,
      gainPeak: 0.1,
    })
  })
}

let sharedContext: AudioContext | null = null

export function ensureAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext()
  }
  return sharedContext
}

export async function playTimerFinishChord(): Promise<void> {
  const ctx = ensureAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  const baseTime = ctx.currentTime + 0.01
  const easterEgg = Math.random() < EASTER_EGG_CHANCE

  if (easterEgg) {
    playEasterEggArpeggio(ctx, baseTime)
  } else {
    playStandardFinish(ctx, baseTime)
  }
}
