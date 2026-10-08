# Original 60 s soundtrack for the Short (120 BPM, A minor), synthesised with numpy only.
# One bar = 2 s, so every robot (4 s) gets exactly two bars and a hit on its first beat.
import sys, wave
import numpy as np

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(t0, sig, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N: return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) / 2 * 2 ** 0.5
    r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) / 2 * 2 ** 0.5
    L[i:i + len(sig)] += sig * gain * l
    R[i:i + len(sig)] += sig * gain * r

def tt(d): return np.arange(int(d * SR)) / SR
def hz(midi): return 440.0 * 2 ** ((midi - 69) / 12)
def saw(f, t, fmax=4000, phase=0.0):
    out = np.zeros_like(t); k = 1
    while k * f < fmax:
        out += np.sin(2 * np.pi * k * f * t + phase * k) / k; k += 1
    return out * 0.6
def square(f, t, fmax=5000):
    out = np.zeros_like(t); k = 1
    while k * f < fmax:
        out += np.sin(2 * np.pi * k * f * t) / k; k += 2
    return out * 0.8
def env(t, a, d, s=0.0, r=None, dur=None):
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if dur is not None and r:
        e = e * np.clip(1 - (t - dur) / r, 0, 1) ** 1.0 * (t < dur + r) + 0 * (t >= dur + r)
    return e
def hp(x):   # crude high-pass (first difference)
    return np.diff(x, prepend=0.0)
def band(n, lo, hi, tilt=0.0):   # band-limited noise via FFT mask (soft edges)
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4) * (np.maximum(f, 1) / 1000) ** tilt
    y = np.fft.irfft(X * m, n); return y / (np.std(y) + 1e-9)

# ---------------- drums
def kick():
    t = tt(0.45)
    f = 48 + 120 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16)
    s[:150] += band(150, 1500, 6000) * np.linspace(0.3, 0, 150)
    return np.tanh(s * 1.6)
def clap():
    t = tt(0.3)
    n = band(len(t), 900, 5000)
    e = np.exp(-t / 0.07) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) / 0.02) * (t > 0.012)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return (n * 0.55 * e + tone * 0.4)
def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = band(len(t), 7000, 12000)
    return n * np.exp(-t / (0.07 if open_ else 0.018)) * 0.22
def boom():   # impact on every robot change
    t = tt(1.4)
    f = 38 + 60 * np.exp(-t / 0.08)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    n = band(len(t), 200, 4000) * np.exp(-t / 0.25) * 0.3
    return np.tanh(1.3 * s) + n
def whoosh(d):   # rising noise into a transition
    t = tt(d)
    k = (t / d) ** 2   # sweep: from low, dull noise to bright noise as it rises
    s = (1 - k) * band(len(t), 300, 1500) + k * band(len(t), 2000, 9000)
    return s * (t / d) ** 2.2 * 0.6

# ---------------- harmony: Am - F - C - G (one chord per bar)
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]
def chord_at(bar): return PROG[bar % 4]

BARS = int(DUR / (4 * BEAT))   # 30
DROP = 2                       # bar where the first robot appears (t = 4 s)
END_BAR = 29                   # last bar: final hit

# sidechain envelope (duck on each kick)
duck = np.ones(N)
for b in range(int(DUR / BEAT)):
    tb = b * BEAT
    if tb >= 58.0: break
    i = int(tb * SR); m = min(N - i, int(0.45 * SR)); x = np.arange(m) / SR
    duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.65 * np.exp(-x / 0.11))

pad_L = np.zeros(N); pad_R = np.zeros(N); bass = np.zeros(N)
for bar in range(BARS):
    t0 = bar * 4 * BEAT
    root, notes = chord_at(bar)
    if bar == END_BAR: break
    # pad: three detuned voices per note, slow attack, filtered by limiting harmonics
    t = tt(4 * BEAT + 0.25)
    e = np.clip(t / 0.25, 0, 1) * np.clip((4 * BEAT + 0.25 - t) / 0.3, 0, 1)
    fmax = 1400 if bar < DROP else 2600
    for n in notes:
        for det, side in ((-0.09, -1), (0.0, 0), (0.09, 1)):
            v = saw(hz(n + 12) * 2 ** (det / 12), t, fmax=fmax, phase=rng.uniform(0, 6.28)) * e * 0.06
            i = int(t0 * SR); m = min(N - i, len(v))
            pad_L[i:i + m] += v[:m] * (1.0 - 0.45 * side); pad_R[i:i + m] += v[:m] * (1.0 + 0.45 * side)
    # bass: off-beat 8ths from the drop
    if bar >= DROP:
        for k in range(8):
            ts = t0 + k * BEAT / 2
            tn = tt(BEAT / 2)
            f = hz(root - 12)
            v = (saw(f, tn, fmax=1200) * 0.8 + np.sin(2 * np.pi * f * tn) * 0.6) * env(tn, 0.004, 0.12, 0.35) * np.clip((BEAT / 2 - tn) / 0.02, 0, 1)
            i = int(ts * SR); m = min(N - i, len(v))
            bass[i:i + m] += v[:m] * (0.55 if k % 2 else 0.35)
L += (pad_L + bass) * duck; R += (pad_R + bass) * duck

# arp: 16ths over the chord tones, from the drop
ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 0, 2]
for bar in range(DROP, END_BAR):
    t0 = bar * 4 * BEAT
    root, notes = chord_at(bar)
    tones = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24]
    for k in range(16):
        tn = tt(0.22)
        v = square(hz(tones[ARP[k]]), tn, fmax=3500) * env(tn, 0.002, 0.07) * 0.08
        add(t0 + k * BEAT / 4, v, 1.0, pan=(-0.5 if k % 2 else 0.5))

# drums
K, C, HC, HO, BM = kick(), clap(), hat(), hat(True), boom()
for b in range(int(DUR / BEAT)):
    tb = b * BEAT
    if tb >= 58.0: break
    bar, beat = divmod(b, 4)
    add(tb, K, 0.95)
    if bar >= DROP and beat in (1, 3): add(tb, C, 0.55, pan=0.05)
    add(tb + BEAT / 2, HO if bar >= DROP else HC, 0.45 if bar >= DROP else 0.3, pan=0.2)
    if bar >= DROP:
        for s16 in (1, 3): add(tb + s16 * BEAT / 4, HC, 0.22, pan=-0.25)

# transitions: a whoosh into, and an impact on, every robot change
for k in range(1, 14):
    tb = 4.0 * k
    d = 1.9 if k == 1 else 0.55
    add(tb - d, whoosh(d), 0.35 if k == 1 else 0.22)
    add(tb, BM, 0.55 if k in (1, 13) else 0.32)

# intro riser (pitch sweep) into the first robot
t = tt(3.6)
f = 220 * 2 ** (t / 3.6 * 2)
add(0.4, np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / 3.6) ** 2 * 0.12, 1.0)
# hit on frame one so the Short starts with energy
add(0.0, BM, 0.45)

# ending: final A minor hit at 58 s, ringing out
t = tt(2.0)
e = np.exp(-t / 0.7)
for n in (45, 57, 60, 64, 69):
    add(58.0, saw(hz(n), t, fmax=3000) * e * 0.09, 1.0, pan=0.0)
add(58.0, K, 1.0); add(58.0, BM, 0.6)

# master: soft clip, fade the last 0.6 s, normalise
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 0.9)
fade = np.ones(N); fl = int(0.6 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], pcm.shape)
