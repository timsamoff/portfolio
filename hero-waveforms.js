// ========================
// HERO WAVEFORM BACKGROUND
// Animated sine waves behind the hero title, drawn on three stacked
// canvases (far / mid / near depth planes). Each plane has its own CSS blur
// for depth of field, and dark-theme lines are drawn as additive light with
// a short phosphor afterglow.
//
// A wave is not a curve scrolled sideways. Each one is an oscillator just
// off the left or right edge that emits its signal across the hero at a
// propagation speed; what's drawn at distance d from the edge is what the
// oscillator was doing d/c seconds ago, read from a ring buffer of its
// recent output. So every change (frequency drift, amplitude drift, source
// height) starts at the edge and travels down the line, a wave's birth is
// a wavefront crossing the screen, and its death is a tail running off it.
// Every so often a light runs out along a wave, faster than the wave moves.
// Moving the pointer over the hero plucks nearby waves and shifts the
// planes slightly (parallax).
//
// Loaded on index.html, share.html, and their demo/ copies. Targets
// #hero-waveforms (the .hero-bg div inside .hero-section) -- see the HERO
// SECTION markup and the HERO BACKGROUND rules in style.css. Tuned in the
// scratch/hero-proto prototypes (1d).
// ========================
(() => {
    const TAU = Math.PI * 2;
    const PAD = 24;        // canvases overhang the hero so pointer parallax never reveals an edge
    const RATE = 120;      // oscillator samples per second of history
    const STEP = 3;        // px between drawn points

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const frac = (v) => v - Math.floor(v);

    const CFG = {
        propagation: 0.25,  // scales every wave's travel speed
        freqDrift: 0.25,    // how much each wave's wavelength wanders
        ampDrift: 0.3,      // how much each wave's height wanders
        sourceWobble: 16,   // px the source drifts up and down
        echoLines: 2,       // main line plus faint copies of the same signal, slightly older
        echoSec: 0.04,
        echoOffset: 1.5,    // px
        lineAlpha: 0.55,
        lineWidth: 1.1,
        glow: 0.6,
        glowWidth: 10,
        persistence: 0.6,   // phosphor afterglow: fraction of the previous frame kept, per 60fps frame
        light: 1,
        lightSpeed: Math.round(rand(2, 4) * 20) / 20, // multiple of wave speed, picked per load
        lightSize: 22,
        lightTail: 140,
        lightGap: 8,        // average seconds between lights on one wave
        cursor: 1,
        cursorReach: 120,   // px
        parallax: 12,       // px
    };

    // blur is in px; res renders blurred planes at lower resolution, since
    // the detail is lost to the blur anyway
    const PLANES = [
        { depth: 0.15, blur: 5, alpha: 0.45, amp: 0.6, speed: 0.45, stroke: 0.8, res: 0.5, count: 3 },
        { depth: 0.5, blur: 1.8, alpha: 0.75, amp: 0.85, speed: 0.75, stroke: 0.9, res: 0.75, count: 2 },
        { depth: 1, blur: 0, alpha: 1, amp: 1, speed: 1, stroke: 1, res: 1, count: 2 },
    ];

    // Cheap smooth 1D noise: three sines at unrelated frequencies, so it
    // never visibly repeats. Output roughly -1..1.
    function makeNoise() {
        const f = [rand(0.7, 1.3), rand(1.9, 2.6), rand(3.7, 4.9)];
        const p = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
        return (x) => Math.sin(x * f[0] + p[0]) * 0.55 + Math.sin(x * f[1] + p[1]) * 0.3 + Math.sin(x * f[2] + p[2]) * 0.15;
    }

    // ========================
    // WAVE
    // One "note": attack, hold, release at the source. Dead once the last
    // of its signal has traveled past the far edge, then respawned.
    // ========================
    class Wave {
        constructor(scene, plane) {
            this.scene = scene;
            this.plane = plane;
            this.spawn();
        }

        spawn() {
            const s = this.scene, P = this.plane;
            const W = s.W;
            this.dead = false;
            this.y0 = s.pickY(this);

            // Character: most waves are regular, some are wide (long and
            // low), a few are tall enough to run past the top or bottom edge
            // (clipped there). ampFrac is half-height as a fraction of the
            // hero; cycles is how many full waves span the screen.
            const roll = Math.random();
            if (roll < 0.3) { this.ampFrac = rand(0.035, 0.08); this.cycles = rand(0.5, 1.2); }     // wide
            else if (roll < 0.85) { this.ampFrac = rand(0.05, 0.11); this.cycles = rand(1.5, 4); } // regular
            else { this.ampFrac = rand(0.18, 0.3); this.cycles = rand(1, 2.5); }                     // tall

            this.c = rand(140, 240) * P.speed * CFG.propagation; // px/sec
            const fromLeft = Math.random() < 0.5;
            this.ex = fromLeft ? 0 : W;
            this.dir = fromLeft ? 1 : -1;
            this.falloff = rand(0.15, 0.4); // brightness lost by the far edge

            // Hold is always long enough for the wavefront to cross the whole
            // screen before the note releases, even on the slow far plane.
            this.cross = W / this.c;
            this.attack = rand(1.5, 3);
            this.hold = this.cross + rand(4, 10);
            this.release = rand(2, 4);

            this.fNoise = makeNoise();
            this.aNoise = makeNoise();
            this.yNoise = makeNoise();
            this.phase = Math.random();

            // Amplitude only changes at the sine's zero crossings, so a
            // ramping envelope never leaves a kink partway up a peak.
            this.latchIdx = null;
            this.latchedAmp = 0;

            this.lightD = null; // traveling light: null while waiting for the next pass
            this.lightAt = s.t + rand(0.5, CFG.lightGap);

            // 1.5x headroom so a window resized wider doesn't outrun the history
            this.len = Math.ceil((W * 1.5 / this.c + 1) * RATE);
            this.val = new Float32Array(this.len);
            this.base = new Float32Array(this.len);
            this.inten = new Float32Array(this.len);
            this.head = 0;
            this.filled = 0;
            this.noteT = 0;
            this.acc = 0;
        }

        envAt(t) {
            if (t < this.attack) return smooth(t / this.attack);
            if (t < this.attack + this.hold) return 1;
            return smooth(1 - (t - this.attack - this.hold) / this.release);
        }

        pushSample() {
            const s = this.scene, P = this.plane;
            const t = this.noteT;
            const innerH = s.H - PAD * 2;
            const env = this.envAt(t);

            const freq = (this.cycles * this.c / s.W) * (1 + CFG.freqDrift * this.fNoise(t * 0.12));
            this.phase += freq / RATE;

            const idx = Math.floor(this.phase * 2);
            if (idx !== this.latchIdx) {
                this.latchIdx = idx;
                this.latchedAmp = this.ampFrac * innerH * P.amp * env * (1 + CFG.ampDrift * this.aNoise(t * 0.18));
            }

            this.val[this.head] = Math.sin(this.phase * TAU) * this.latchedAmp;
            this.base[this.head] = PAD + this.y0 * innerH + CFG.sourceWobble * P.amp * this.yNoise(t * 0.1);
            this.inten[this.head] = env;
            this.head = (this.head + 1) % this.len;
            this.filled = Math.min(this.filled + 1, this.len);
            this.noteT += 1 / RATE;
        }

        update(dt) {
            const s = this.scene;
            if (this.dead) {
                if (s.t >= this.respawnAt) this.spawn();
                return;
            }
            this.acc += dt;
            while (this.acc >= 1 / RATE) {
                this.pushSample();
                this.acc -= 1 / RATE;
            }

            // the light runs out from the source at a multiple of the wave's
            // own speed, and finishes at the wavefront or the far edge
            const front = Math.min(s.W, (this.filled - 2) * this.c / RATE);
            if (this.lightD === null) {
                if (s.t >= this.lightAt) this.lightD = 0;
            } else {
                this.lightD += this.c * CFG.lightSpeed * dt;
                if (this.lightD > front) {
                    this.lightD = null;
                    this.lightAt = s.t + rand(CFG.lightGap * 0.5, CFG.lightGap * 1.5);
                }
            }

            if (this.noteT > this.attack + this.hold + this.release + s.W / this.c + 0.5) {
                this.dead = true;
                this.respawnAt = s.t + rand(0.5, 4);
            }
        }

        // History lookup, `ago` in samples (fractional). Writes into out.
        sample(ago, out) {
            const k0 = Math.floor(ago);
            const f = ago - k0;
            const i0 = (this.head - 1 - k0 + this.len * 2) % this.len;
            const i1 = (i0 - 1 + this.len) % this.len;
            out.y = mix(this.base[i0], this.base[i1], f) + mix(this.val[i0], this.val[i1], f);
            out.i = mix(this.inten[i0], this.inten[i1], f);
            return out;
        }

        draw(ctx) {
            if (this.dead) return;
            const s = this.scene, P = this.plane;
            const W = s.W, ex = this.ex, dir = this.dir;
            const perPx = RATE / this.c; // samples of history per px of distance
            const fade = (d) => 1 - this.falloff * (d / W);
            const S = CFG.echoLines;
            const echoSamples = CFG.echoSec * RATE;
            const dMax = Math.min(W, (this.filled - 2 - (S - 1) * echoSamples) / perPx);
            if (dMax < 4) return;

            // Strand and glow brightness is tuned at persistence 0.6; this
            // keeps steady-state brightness the same if persistence changes.
            const comp = Math.min(2.5, (1 - CFG.persistence) / 0.4);
            const theme = s.dark ? { line: 1, glow: 1 } : { line: 1.1, glow: 0.35 };
            const pt = { y: 0, i: 0 };

            // Cursor plucks near this wave (vertically): a damped ripple that
            // spreads outward along the line from where the pointer crossed it.
            const plucks = [];
            const yRest = PAD + this.y0 * (s.H - PAD * 2);
            for (const q of s.disturbances) {
                const age = s.t - q.t0;
                const dy = (yRest - q.y) / CFG.cursorReach;
                const a = q.s * Math.exp(-dy * dy) * Math.exp(-age * 1.5) * CFG.cursor * P.depth * 40;
                if (Math.abs(a) > 0.2) plucks.push({ x: q.x, age, a, r: 50 + age * 240 });
            }
            const pluckAt = (x) => {
                let d = 0;
                for (const q of plucks) {
                    const ddx = (x - q.x) / q.r;
                    d += q.a * Math.exp(-ddx * ddx) * Math.sin(q.age * 10 - Math.abs(x - q.x) * 0.035);
                }
                return d;
            };

            // brightness follows the signal's own intensity history and
            // falls off gently with distance from the source
            const grad = ctx.createLinearGradient(ex, 0, ex + dir * dMax, 0);
            for (let k = 0; k <= 16; k++) {
                const d = (k / 16) * dMax;
                this.sample(d * perPx, pt);
                grad.addColorStop(k / 16, `rgba(${s.rgb},${clamp(pt.i * fade(d) * P.alpha, 0, 1).toFixed(3)})`);
            }
            ctx.strokeStyle = grad;

            const trace = (o, delay, from = 0, to = dMax) => {
                ctx.beginPath();
                const steps = Math.max(1, Math.ceil((to - from) / STEP));
                for (let j = 0; j <= steps; j++) {
                    const d = from + (to - from) * (j / steps);
                    const x = ex + dir * d;
                    this.sample(d * perPx + delay, pt);
                    ctx.lineTo(x, pt.y + o * CFG.echoOffset * P.amp + (plucks.length ? pluckAt(x) * (1 + o * 0.8) : 0));
                }
                ctx.stroke();
            };

            ctx.globalAlpha = clamp(CFG.glow * 0.16 * comp * theme.glow, 0, 1);
            ctx.lineWidth = CFG.glowWidth * P.stroke;
            trace(0, 0);

            ctx.globalAlpha = clamp(CFG.lineAlpha * comp * theme.line, 0, 1);
            ctx.lineWidth = CFG.lineWidth * P.stroke;
            for (let k = 0; k < S; k++) {
                // each echo line is the same signal slightly older, so it
                // lags behind rather than running parallel
                trace(S === 1 ? 0 : k / (S - 1) - 0.5, k * echoSamples);
            }

            // Traveling light: a bright head riding the line, with a short
            // streak behind it (toward the source) that fades out.
            if (this.lightD === null) return;
            const hd = Math.min(this.lightD, dMax);
            this.sample(hd * perPx, pt);
            const level = clamp(pt.i * fade(hd) * P.alpha * CFG.light, 0, 1);
            if (level <= 0.01) return;

            const tail = Math.max(0, hd - CFG.lightTail);
            if (hd - tail > 1) {
                const lg = ctx.createLinearGradient(ex + dir * tail, 0, ex + dir * hd, 0);
                lg.addColorStop(0, `rgba(${s.rgb},0)`);
                lg.addColorStop(1, `rgba(${s.rgb},${level.toFixed(3)})`);
                ctx.strokeStyle = lg;
                ctx.globalAlpha = clamp(0.35 * theme.glow, 0, 1);
                ctx.lineWidth = CFG.glowWidth * P.stroke * 0.8;
                trace(0, 0, tail, hd);
                ctx.globalAlpha = 1;
                ctx.lineWidth = CFG.lineWidth * P.stroke * 1.8;
                trace(0, 0, tail, hd);
            }
            this.sample(hd * perPx, pt);
            const hx = ex + dir * hd;
            const hy = pt.y + (plucks.length ? pluckAt(hx) : 0);
            const r = CFG.lightSize * P.stroke;
            const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
            g.addColorStop(0, `rgba(${s.rgb},${level.toFixed(3)})`);
            g.addColorStop(0.25, `rgba(${s.rgb},${(level * 0.45).toFixed(3)})`);
            g.addColorStop(1, `rgba(${s.rgb},0)`);
            ctx.globalAlpha = theme.glow;
            ctx.fillStyle = g;
            ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
        }
    }

    // ========================
    // SCENE
    // ========================
    class Scene {
        constructor(bg, reducedMotion) {
            this.bg = bg;
            this.hero = bg.closest('.hero-section') || bg.parentElement;
            this.t = 0;
            this.disturbances = [];
            this.pointer = { tx: 0.5, ty: 0.5, sx: 0.5, sy: 0.5, lastX: null, lastY: null, lastT: 0 };
            this.readTheme();

            this.planes = PLANES.map(def => {
                const P = Object.assign({}, def);
                P.canvas = document.createElement('canvas');
                P.canvas.className = 'hero-plane';
                if (P.blur > 0) P.canvas.style.filter = `blur(${P.blur}px)`;
                P.ctx = P.canvas.getContext('2d');
                bg.appendChild(P.canvas);
                P.waves = [];
                return P;
            });
            this.resize();

            // Pre-run each oscillator past one full crossing, so the waves on
            // screen at load already span the width, each at a different
            // point in its life.
            for (const P of this.planes) {
                for (let k = 0; k < P.count; k++) {
                    const w = new Wave(this, P);
                    const prewarm = w.attack + w.cross + rand(0, 3) + (k / P.count) * 4;
                    for (let n = 0; n < prewarm * RATE; n++) w.pushSample();
                    P.waves.push(w);
                }
            }

            new MutationObserver(() => this.readTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

            if (reducedMotion) {
                // one still frame, redrawn only when the size or theme changes
                this.drawStill();
                new ResizeObserver(() => { this.resize(); this.drawStill(); }).observe(this.hero);
                new MutationObserver(() => this.drawStill()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
                return;
            }

            new ResizeObserver(() => this.resize()).observe(this.hero);
            this.hero.addEventListener('pointermove', (ev) => this.onPointer(ev));
            this.hero.addEventListener('pointerleave', () => { this.pointer.tx = 0.5; this.pointer.ty = 0.5; this.pointer.lastX = null; });

            // only animate while the hero is on screen
            this.running = false;
            new IntersectionObserver((entries) => {
                const visible = entries.some(e => e.isIntersecting);
                if (visible && !this.running) {
                    this.running = true;
                    this.last = performance.now();
                    this.raf = requestAnimationFrame(this.frame);
                } else if (!visible && this.running) {
                    // cancel the pending frame too, or a quick hide/show would start a second loop
                    this.running = false;
                    cancelAnimationFrame(this.raf);
                }
            }).observe(this.hero);
        }

        readTheme() {
            this.dark = document.documentElement.getAttribute('data-theme') !== 'light';
            this.rgb = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-rgb').trim() || '229, 72, 77';
        }

        // Best of several random candidates: the y farthest from every other
        // live wave (same-plane neighbors count more), so waves spread over
        // the full height by construction. Centers can sit just past either edge.
        pickY(wave) {
            let best = 0.5, bestScore = -1;
            for (let k = 0; k < 10; k++) {
                const y = rand(-0.02, 1.02);
                let score = Infinity;
                for (const P of this.planes) {
                    for (const w of P.waves) {
                        if (w === wave || w.dead) continue;
                        score = Math.min(score, Math.abs(w.y0 - y) * (P === wave.plane ? 1 : 2.5));
                    }
                }
                if (score > bestScore) { bestScore = score; best = y; }
            }
            return best;
        }

        resize() {
            const r = this.hero.getBoundingClientRect();
            this.W = r.width + PAD * 2;
            this.H = r.height + PAD * 2;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            for (const P of this.planes) {
                P.scale = dpr * P.res;
                P.canvas.width = Math.round(this.W * P.scale);
                P.canvas.height = Math.round(this.H * P.scale);
            }
        }

        // Moving across the hero drops a disturbance every 40px or so, and
        // the pointer position drives parallax.
        onPointer(ev) {
            const r = this.hero.getBoundingClientRect();
            const x = ev.clientX - r.left, y = ev.clientY - r.top;
            const p = this.pointer;
            p.tx = x / r.width;
            p.ty = y / r.height;
            if (p.lastX === null) { p.lastX = x; p.lastY = y; p.lastT = this.t; return; }
            const dist = Math.hypot(x - p.lastX, y - p.lastY);
            if (dist > 40 && this.t - p.lastT > 0.05) {
                this.disturbances.push({ x: x + PAD, y: y + PAD, t0: this.t, s: clamp(dist / 120, 0.3, 1) * (Math.random() < 0.5 ? -1 : 1) });
                if (this.disturbances.length > 20) this.disturbances.shift();
                p.lastX = x; p.lastY = y; p.lastT = this.t;
            }
        }

        prepare(P, retain) {
            const ctx = P.ctx;
            ctx.setTransform(P.scale, 0, 0, P.scale, 0, 0);
            ctx.globalAlpha = 1;
            if (retain <= 0) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.clearRect(0, 0, this.W, this.H);
            } else {
                // phosphor afterglow: fade the previous frame instead of clearing it
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = `rgba(0,0,0,${(1 - retain).toFixed(3)})`;
                ctx.fillRect(0, 0, this.W, this.H);
            }
            ctx.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
            return ctx;
        }

        drawStill() {
            for (const P of this.planes) {
                const ctx = this.prepare(P, 0);
                for (const w of P.waves) {
                    const lightD = w.lightD;
                    w.lightD = null; // no traveling light in a still frame
                    w.draw(ctx);
                    w.lightD = lightD;
                }
            }
        }

        frame = (now) => {
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.t += dt;
            this.disturbances = this.disturbances.filter(q => this.t - q.t0 < 3.5);

            const p = this.pointer;
            const k = Math.min(1, dt * 3);
            p.sx += (p.tx - p.sx) * k;
            p.sy += (p.ty - p.sy) * k;

            const retain = Math.pow(CFG.persistence, dt * 60);
            for (const P of this.planes) {
                const ctx = this.prepare(P, retain);
                for (const w of P.waves) w.update(dt);
                for (const w of P.waves) w.draw(ctx);
                const ox = (p.sx - 0.5) * CFG.parallax * P.depth * 2;
                const oy = (p.sy - 0.5) * CFG.parallax * P.depth;
                P.canvas.style.transform = `translate3d(${(-ox).toFixed(2)}px, ${(-oy).toFixed(2)}px, 0)`;
            }
            this.raf = requestAnimationFrame(this.frame);
        };
    }

    function initHeroWaveforms() {
        const bg = document.getElementById('hero-waveforms');
        if (!bg) return;
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        new Scene(bg, reducedMotion);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroWaveforms);
    } else {
        initHeroWaveforms();
    }
})();
