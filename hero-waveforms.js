// ========================
// HERO WAVEFORM BACKGROUND
// Generates a small population of animated SVG waveforms (sine, triangle,
// sawtooth, square, sample-and-hold) behind the hero title. Each waveform
// is a "voice" with its own independent, randomized lifecycle: spawn in a
// fixed vertical band, fade in, drift/flow/breathe while alive, fade out,
// then either respawn (in the same band, possibly a new shape) or retire
// for a while before a replacement takes over.
//
// Loaded on index.html and demo/index.html. Targets #hero-waveforms, an
// empty <svg> inside .hero-bg -- see the HERO SECTION markup and the
// HERO BACKGROUND rules in style.css.
// ========================
(() => {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const WIDTH = 1200;
    const HEIGHT = 600;

    // ---- waveform path generators (kept mathematically clean; only the
    // voice lifecycle around them is randomized) ----
    function sinePath(amp, cycles, yOffset, phaseOffset, points = 240) {
        let d = '';
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * WIDTH;
            const y = yOffset + amp * Math.sin(((i / points) * cycles + phaseOffset) * Math.PI * 2);
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
        }
        return d.trim();
    }

    function trianglePath(amp, cycles, yOffset, phaseOffset, points = 240) {
        let d = '';
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * WIDTH;
            const phase = (((i / points) * cycles + phaseOffset) % 1 + 1) % 1;
            const tri = phase < 0.5 ? (phase * 4 - 1) : (3 - phase * 4);
            const y = yOffset + amp * tri;
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
        }
        return d.trim();
    }

    function sawtoothPath(amp, cycles, yOffset, phaseOffset, points = 480) {
        let d = '';
        let started = false;
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * WIDTH;
            const phase = (((i / points) * cycles + phaseOffset) % 1 + 1) % 1;
            const eased = phase < 0.04 ? phase / 0.04 * 0.04 : phase;
            const y = yOffset + amp * (eased * 2 - 1);
            d += (!started ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            started = true;
        }
        return d.trim();
    }

    // Uses a smooth continuous function (steep tanh) for the corners instead
    // of piecewise-linear segments stitched at hand-picked phase thresholds.
    // A stitched version glitches: because phase drifts continuously, the
    // exact x where two segments meet shifts frame to frame, and can land
    // between two sampled points in a way that makes the interpolated line
    // briefly overshoot. A single smooth formula has no seams to glitch at.
    function squarePath(amp, cycles, yOffset, phaseOffset, points = 480) {
        let d = '';
        let started = false;
        const sharpness = 60; // higher = closer to a true hard-edged square
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * WIDTH;
            const phase = (((i / points) * cycles + phaseOffset) % 1 + 1) % 1;
            const s = Math.sin(phase * Math.PI * 2);
            const y = yOffset + amp * Math.tanh(sharpness * s);
            d += (!started ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            started = true;
        }
        return d.trim();
    }

    // Generates the fixed set of held random values for a sample-and-hold
    // voice, once, at spawn time -- these never change during the voice's
    // life, only how many of them fit on screen (stepsVisible) breathes,
    // which stretches/compresses the steps smoothly instead of re-rolling
    // them (re-rolling every frame reads as constant jitter).
    function makeSampleHoldValues(count, seed) {
        let rand = seed;
        const rng = () => { rand = (rand * 9301 + 49297) % 233280; return rand / 233280; };
        const values = [];
        for (let s = 0; s < count; s++) values.push(rng() * 2 - 1);
        return values;
    }

    // stepsVisible is a continuous (non-integer) count of how many held
    // values fit across the screen -- it breathes slowly as the voice's
    // wavelength drifts. phaseOffset scrolls a read window through the
    // fixed values array, at the same pixel-rate every other shape uses
    // (one phaseOffset unit = one visible step, matching WIDTH/cycles for
    // the others) -- scaling by the full values pool instead made
    // sample-and-hold scroll far faster than every other shape.
    function sampleHoldPath(amp, values, stepsVisible, phaseOffset, yOffset, points = 480) {
        let d = '';
        let started = false;
        const rounding = 0.12;
        const n = values.length;
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * WIDTH;
            const stepPos = (i / points) * stepsVisible + phaseOffset;
            const stepIdx = Math.floor(stepPos);
            const within = stepPos - stepIdx;
            const idx = ((stepIdx % n) + n) % n;
            const nextIdx = (idx + 1) % n;
            const curr = values[idx];
            const next = values[nextIdx];
            let y;
            if (within > 1 - rounding) {
                const t = (within - (1 - rounding)) / rounding;
                y = yOffset + amp * (curr + (next - curr) * t);
            } else {
                y = yOffset + amp * curr;
            }
            d += (!started ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            started = true;
        }
        return d.trim();
    }

    // Weighted, not a flat pick: sawtooth's sharp diagonal ramps and
    // square's hard plateaus read as visually louder than a smooth sine at
    // the same opacity, so a uniform random pick under-represents sine and
    // over-represents sawtooth/square by feel even though the odds are
    // equal. These weights compensate for that perceptual difference.
    const SHAPE_WEIGHTS = [
        ['sine', 2.2],
        ['triangle', 1.1],
        ['sawtooth', 0.45],
        ['square', 0.55],
        ['samplehold', 0.9],
    ];
    const SHAPE_TOTAL = SHAPE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    function pickShape() {
        let r = Math.random() * SHAPE_TOTAL;
        for (const [shape, w] of SHAPE_WEIGHTS) {
            if (r < w) return shape;
            r -= w;
        }
        return SHAPE_WEIGHTS[0][0];
    }

    function buildPath(shape, amp, cycles, yOffset, phaseOffset, sampleHoldValues) {
        switch (shape) {
            case 'sine': return sinePath(amp, cycles, yOffset, phaseOffset);
            case 'triangle': return trianglePath(amp, cycles, yOffset, phaseOffset);
            case 'sawtooth': return sawtoothPath(amp, cycles, yOffset, phaseOffset);
            case 'square': return squarePath(amp, cycles, yOffset, phaseOffset);
            case 'samplehold': return sampleHoldPath(amp, sampleHoldValues, cycles * 4, phaseOffset, yOffset);
        }
    }

    const rand = (min, max) => min + Math.random() * (max - min);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Tracks the shape most recently handed out, across ALL voices/bands --
    // "don't repeat the last shape" means the last shape to appear anywhere
    // on screen, not just in one band. A per-band memory would still let
    // two different bands independently roll the same shape back to back,
    // which reads as "triangle, triangle, triangle" to someone watching the
    // whole scene even though no single band ever repeated itself.
    let lastSpawnedShape = null;
    function pickShapeAvoiding() {
        let next = pickShape();
        for (let tries = 0; tries < 8 && next === lastSpawnedShape; tries++) {
            next = pickShape();
        }
        lastSpawnedShape = next;
        return next;
    }

    // ---- voice: one waveform's full lifecycle (spawn -> fade in -> live,
    // drifting/flowing/breathing -> fade out -> despawn) ----
    class Voice {
        // bandIndex/bandCount give this voice a fixed vertical slice of the
        // hero for its entire lifetime (every respawn re-rolls within the
        // same band) -- without this, positions drift back to fully random
        // after the first spawn and voices end up piling on top of each other.
        constructor(svg, bandIndex, bandCount, allVoices, opts) {
            this.svg = svg;
            this.bandIndex = bandIndex;
            this.bandHeight = HEIGHT / bandCount;
            this.allVoices = allVoices; // shared registry, so a voice can see its band-neighbors
            this.g = document.createElementNS(SVG_NS, 'g');
            this.g.setAttribute('class', 'hero-waveform');
            this.path = document.createElementNS(SVG_NS, 'path');
            this.g.appendChild(this.path);
            svg.appendChild(this.g);
            this.alive = false;
            this.raf = null;
            this.spawn(opts || {});
        }

        // The voice(s) whose band sits directly above/below this one -- used
        // so a freshly spawned waveform doesn't land at nearly the same
        // opacity as a neighbor it visually touches, which would read as one
        // blob instead of two distinct layered waves.
        _neighbors() {
            if (!this.allVoices) return [];
            return this.allVoices.filter(v => v && v !== this && v.alive && Math.abs(v.bandIndex - this.bandIndex) === 1);
        }

        _bandY() {
            const center = this.bandHeight * this.bandIndex + this.bandHeight / 2;
            return center + rand(-this.bandHeight * 0.32, this.bandHeight * 0.32);
        }

        // opts lets the initial population force a few voices to be
        // immediately visible, instead of every voice rolling a fully
        // random (and possibly invisible) opacity
        spawn(opts = {}) {
            if (this._respawnTimer) { clearTimeout(this._respawnTimer); this._respawnTimer = null; }
            this.shape = pickShapeAvoiding();
            this.baseYOffset = this._bandY();
            this.baseAmp = rand(20, 55);
            this.cycles = Math.round(rand(1, 6)); // whole cycles so re-renders stay phase-stable
            this.phase0 = Math.random();
            // magnitude floored so nothing ever reads as "frozen", ceiling
            // capped so nothing ever reads as "too fast" -- sign picked
            // separately so direction still varies
            this.phaseSpeed = pick([-1, 1]) * rand(0.0006, 0.0014); // slow horizontal flow (cycles/sec)
            this.cycleDrift = pick([-1, 1]) * rand(0.012, 0.03); // slow wavelength stretch/compress (cycles/sec)

            // Organic multi-axis drift: the vertical position wanders using
            // two layered sine waves at unrelated (non-integer-ratio)
            // frequencies, so the combined path never exactly retraces
            // itself -- a single sine would just be simple back-and-forth,
            // which reads as mechanical. Small relative to the band height
            // so it stays within the voice's own lane.
            this.driftYAmp1 = rand(4, 10);
            this.driftYFreq1 = rand(0.03, 0.07);
            this.driftYPhase1 = rand(0, Math.PI * 2);
            this.driftYAmp2 = rand(2, 6);
            this.driftYFreq2 = rand(0.11, 0.19); // deliberately not a clean multiple of freq1
            this.driftYPhase2 = rand(0, Math.PI * 2);

            // Amplitude breathing: how tall the waveform's peaks are slowly
            // swells and shrinks, echoing how the original hero's orbs
            // pulsed in size -- same two-layered-sine approach so it
            // doesn't feel like a metronome.
            this.breatheAmp1 = rand(0.08, 0.16); // fraction of baseAmp
            this.breatheFreq1 = rand(0.025, 0.05);
            this.breathePhase1 = rand(0, Math.PI * 2);
            this.breatheAmp2 = rand(0.04, 0.09);
            this.breatheFreq2 = rand(0.08, 0.14);
            this.breathePhase2 = rand(0, Math.PI * 2);

            if (this.shape === 'samplehold') {
                this.sampleHoldValues = makeSampleHoldValues(28, Math.floor(Math.random() * 10000) + 1);
            }

            // Depth: random opacity ceiling + stroke width pair, correlated
            // so fainter/thinner reads as "further back", bold/thick reads
            // as "closer". opts.forceProminent guarantees a couple of
            // voices land clearly visible right away instead of everything
            // being a dice roll that can come up all-faint.
            let depth;
            if (opts.forceProminent) {
                depth = rand(0.5, 0.68);
            } else {
                const depthRoll = Math.random();
                depth = depthRoll * depthRoll * depthRoll; // skew toward faint
            }

            // If a neighboring band already has a voice at nearly this same
            // depth, push this one clearly away from it so two touching
            // waveforms read as distinct layers, not one blob.
            const neighborDepths = this._neighbors().map(v => (v.opacityMax - 0.05) / 0.4);
            const tooClose = neighborDepths.find(nd => Math.abs(nd - depth) < 0.25);
            if (tooClose !== undefined) {
                depth = tooClose < 0.5 ? rand(0.7, 0.95) : rand(0.05, 0.3);
            }

            this.opacityMax = 0.05 + depth * 0.4;  // 0.05 - 0.45 max
            this.strokeWidth = 0.8 + depth * 2.2;   // 0.8 - 3.0

            this.birth = performance.now();
            // The very first population on page load appears instantly (no
            // fade at all) so the hero isn't empty while waiting -- every
            // fade after that, including a voice's own first respawn, takes
            // noticeably longer (2-4s) so the motion reads as deliberate.
            this.fadeInMs = opts.instant ? 0 : rand(2000, 4000);
            this.holdMs = rand(6000, 14000);
            this.fadeOutMs = rand(3000, 6000);
            this.lifeMs = this.fadeInMs + this.holdMs + this.fadeOutMs;

            // Most voices come back after a pause; a minority retire
            // permanently (a fresh one eventually takes the slot so the
            // population still turns over).
            this.willRespawn = Math.random() < 0.72;
            this.silenceMs = rand(1500, 8000);

            // Instant spawns (initial page load) start already at their
            // target opacity/width with nothing to ease -- a genuine "no
            // fade" appearance. Every other spawn starts from 0 so its
            // fade-in has something to ease up from.
            this.currentOpacity = opts.instant ? this.opacityMax : 0;
            this.currentStrokeWidth = opts.instant ? this.strokeWidth : 0;

            this.alive = true;
            this._tick();
        }

        // TARGET opacity for the current lifecycle phase (fade-in / hold /
        // fade-out). Not rendered directly -- see currentOpacity in _tick,
        // which eases toward this value, so a mid-flight change to
        // opacityMax (the prominence booster, the neighbor-separation
        // sweep) transitions smoothly instead of popping.
        _targetOpacityAt(elapsed) {
            if (elapsed < this.fadeInMs) {
                return this.opacityMax * (elapsed / this.fadeInMs);
            }
            const afterHold = elapsed - this.fadeInMs - this.holdMs;
            if (afterHold < 0) return this.opacityMax;
            if (afterHold < this.fadeOutMs) {
                return this.opacityMax * (1 - afterHold / this.fadeOutMs);
            }
            return 0;
        }

        _tick = () => {
            if (!this.alive) return;
            const now = performance.now();
            const elapsed = now - this.birth;

            if (elapsed >= this.lifeMs) {
                this.g.style.opacity = 0;
                this.alive = false;
                const pause = this.willRespawn ? this.silenceMs : rand(8000, 20000);
                this._respawnTimer = setTimeout(() => this.spawn(), pause);
                return;
            }

            const elapsedSec = elapsed / 1000;
            // Sample-and-hold's discrete steps are far more sensitive to
            // density change than a continuous curve is -- the same drift
            // rate that's an imperceptibly smooth stretch for a sine shifts
            // step boundaries by whole pixels-per-step fast enough to read
            // as values flickering, so its effective drift is slowed way down.
            const driftScale = this.shape === 'samplehold' ? 0.12 : 1;
            const liveCycles = Math.max(0.5, this.cycles + this.cycleDrift * driftScale * elapsedSec);
            const phase = this.phase0 + this.phaseSpeed * elapsedSec * 60;

            // Multi-axis organic drift: two layered sines at unrelated
            // frequencies per axis, so the waveform's vertical position and
            // peak height wander without ever retracing the same path.
            const liveYOffset = this.baseYOffset
                + this.driftYAmp1 * Math.sin(elapsedSec * this.driftYFreq1 + this.driftYPhase1)
                + this.driftYAmp2 * Math.sin(elapsedSec * this.driftYFreq2 + this.driftYPhase2);
            const breatheFactor = 1
                + this.breatheAmp1 * Math.sin(elapsedSec * this.breatheFreq1 + this.breathePhase1)
                + this.breatheAmp2 * Math.sin(elapsedSec * this.breatheFreq2 + this.breathePhase2);
            const liveAmp = this.baseAmp * breatheFactor;

            const d = buildPath(this.shape, liveAmp, liveCycles, liveYOffset, phase, this.sampleHoldValues);

            this.path.setAttribute('d', d);

            // Stroke-width and rendered opacity both EASE toward their
            // current target rather than snapping to it -- matters most
            // when opacityMax/strokeWidth change mid-flight (the
            // prominence booster, the neighbor-separation sweep).
            const targetOpacity = this._targetOpacityAt(elapsed);
            const ease = 0.04; // per-frame easing factor -- smooths over roughly half a second at 60fps
            this.currentOpacity += (targetOpacity - this.currentOpacity) * ease;
            this.currentStrokeWidth += (this.strokeWidth - this.currentStrokeWidth) * ease;
            if (Math.abs(targetOpacity - this.currentOpacity) < 0.002) this.currentOpacity = targetOpacity;

            this.g.style.opacity = this.currentOpacity;
            this.path.style.strokeWidth = this.currentStrokeWidth;

            this.raf = requestAnimationFrame(this._tick);
        };
    }

    function initHeroWaveforms() {
        const svg = document.getElementById('hero-waveforms');
        if (!svg) return;

        // Respect reduced-motion preference: render one static, faint
        // waveform per band instead of an animating population.
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Variable concurrency: 2-6 voices, each independently
        // spawning/despawning on its own randomized clock, so the total
        // count breathes over time too.
        //
        // The initial population is seeded deliberately rather than left
        // fully random: split the hero height into bands so voices start
        // spread out (not clustered/overlapping), force the first couple to
        // be immediately prominent, and have every voice in that initial
        // population appear instantly with no fade -- the hero is never
        // empty on first paint. Every voice after that (including these
        // same slots' own first respawn once they later cycle out) fades in
        // normally, over a longer 2-4s window.
        const VOICE_COUNT = 6;
        const voices = [];
        for (let i = 0; i < VOICE_COUNT; i++) {
            const opts = {
                instant: true,
                forceProminent: i < 2, // first two voices guaranteed clearly visible
            };
            voices.push(new Voice(svg, i, VOICE_COUNT, voices, opts));
        }

        if (reducedMotion) {
            // freeze everything in place at its initial pose
            voices.forEach(v => { if (v.raf) cancelAnimationFrame(v.raf); });
            return;
        }

        // Checks the scene's ACTUAL rendered presence, not just each
        // voice's `alive` flag -- a voice deep in its fade-out is still
        // "alive" but can be rendering near-zero, so if several voices
        // happen to fade out around the same time an alive-only check could
        // see "some voices alive" and do nothing while the screen was, in
        // practice, going black. Runs often and rescues as many voices as
        // needed in one pass, rather than capping the intervention at one
        // voice per tick -- a cluster of simultaneous fade-outs needs more
        // than one rescue to recover from before the gap is visible.
        setInterval(() => {
            const now = performance.now();
            const totalVisible = voices.reduce((sum, v) => sum + (v.alive ? parseFloat(v.g.style.opacity || 0) : 0), 0);
            const prominentCount = voices.filter(v => v.alive && parseFloat(v.g.style.opacity || 0) >= 0.5).length;

            if (prominentCount >= 2 && totalVisible >= 0.7) return;

            const deficit = totalVisible < 0.15 ? 3 : (prominentCount < 2 ? 1 : 0);
            if (deficit === 0) return;

            for (let n = 0; n < deficit; n++) {
                const holding = voices.filter(v => {
                    if (!v.alive) return false;
                    const elapsed = now - v.birth;
                    const inEarlyHold = elapsed >= v.fadeInMs && elapsed < v.fadeInMs + v.holdMs * 0.6;
                    return inEarlyHold && parseFloat(v.g.style.opacity || 0) < 0.5;
                });
                if (holding.length) {
                    const v = pick(holding);
                    const neighborDepths = v._neighbors().map(nb => (nb.opacityMax - 0.05) / 0.4);
                    let boostDepth = rand(0.82, 1);
                    if (neighborDepths.some(nd => Math.abs(nd - boostDepth) < 0.25)) {
                        boostDepth = rand(0.4, 0.55);
                    }
                    v.opacityMax = 0.05 + boostDepth * 0.4;
                    v.strokeWidth = 0.8 + boostDepth * 2.2;
                    continue;
                }

                const dead = voices.filter(v => !v.alive);
                if (dead.length) {
                    const v = pick(dead);
                    if (v._respawnTimer) clearTimeout(v._respawnTimer);
                    v.spawn({ forceProminent: true });
                }
            }
        }, 800);

        // Continuously enforces neighbor-opacity separation. The check
        // inside spawn() only looks at neighbors that existed at that
        // moment -- if a neighbor spawns in afterward with its own
        // independent roll, nothing retroactively fixes the collision.
        // This periodic sweep catches that case.
        setInterval(() => {
            for (const v of voices) {
                if (!v.alive) continue;
                for (const n of v._neighbors()) {
                    if (v.bandIndex > n.bandIndex) continue; // check each pair once
                    const vd = (v.opacityMax - 0.05) / 0.4;
                    const nd = (n.opacityMax - 0.05) / 0.4;
                    if (Math.abs(vd - nd) < 0.28) {
                        const pushDepth = vd <= nd ? Math.max(0.05, nd - 0.32) : Math.min(1, nd + 0.32);
                        v.opacityMax = 0.05 + pushDepth * 0.4;
                        v.strokeWidth = 0.8 + pushDepth * 2.2;
                    }
                }
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroWaveforms);
    } else {
        initHeroWaveforms();
    }
})();
