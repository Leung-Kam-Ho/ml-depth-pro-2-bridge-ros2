//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// Interactive trade-off chart: Depth Pro 2 against prior work on sharpness and temporal
// consistency, as in the paper's Figure (fig:tradeoff). Data: tradeoff.js.

(() => {
    const GROUPS = {
        ours: { label: 'Depth Pro 2', color: '#F08A3C' },
        single: { label: 'Single-frame', color: '#2E7FBF' },
        multi: { label: 'Multi-frame', color: '#2E9E5B' },
    };
    // higher: whether a larger value is better. Axes put "better" to the right and to the top.
    const METRICS = {
        sharpness: { label: 'Boundary sharpness (F1)', tip: 'Boundary F1', higher: true, fmt: v => v.toFixed(3) },
        jitter: { label: 'Temporal consistency (Jitter)', tip: 'Jitter', higher: false, fmt: v => v.toFixed(4) },
    };
    // The axes the paper's main text plots.
    const view = { x: 'jitter', y: 'sharpness' };
    // The SVG scales with its box, so on a phone 12 units of text shrink to about 5 px.
    // k scales text, dots and margins back up so names stay readable (see fit()).
    const W = 900;
    let H = 575, k = 1, M = { l: 70, r: 24, t: 30, b: 58 }, narrow = false;
    const NS = 'http://www.w3.org/2000/svg';

    const root = document.getElementById('tradeoff');
    if (!root || !window.TRADEOFF) return;
    const data = window.TRADEOFF;
    const hidden = new Set();

    const el = (tag, attrs = {}, parent) => {
        const e = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        if (parent) parent.appendChild(e);
        return e;
    };

    root.innerHTML = `
        <div class="tradeoff-plot"><div class="tradeoff-tip" hidden></div></div>
        <div class="tradeoff-legend"></div>`;
    const plot = root.querySelector('.tradeoff-plot');
    const tip = root.querySelector('.tradeoff-tip');
    const legend = root.querySelector('.tradeoff-legend');

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tradeoff-svg', role: 'img',
                            'aria-label': 'Scatter plot of depth estimation methods' });
    plot.prepend(svg);
    const axes = el('g', {}, svg);
    const dots = el('g', {}, svg);

    // One group per method. Ours goes last, so it draws on top.
    const order = [...data].sort((a, b) => (a.group === 'ours') - (b.group === 'ours'));
    const nodes = order.map(d => {
        const g = el('g', { class: `tradeoff-point group-${d.group}`, tabindex: 0 }, dots);
        const c = GROUPS[d.group].color;
        // A line from the dot to its name, shown when the name had to move away from the dot.
        const leader = el('line', { class: 'tradeoff-leader', stroke: c }, g);
        el('circle', { fill: d.trainedOn ? 'var(--bs-body-bg)' : c, stroke: c }, g);
        const t = el('text', { class: 'tradeoff-name' }, g);
        t.textContent = d.name;
        g.addEventListener('pointerenter', () => showTip(d, g));
        g.addEventListener('pointerleave', hideTip);
        g.addEventListener('focus', () => showTip(d, g));
        g.addEventListener('blur', hideTip);
        return { d, g, t, leader, circle: g.querySelector('circle') };
    });

    // Set k, the height and the margins from the width the SVG has on screen.
    function fit() {
        const px = svg.getBoundingClientRect().width || W;
        // Names render at 11 px or more.
        k = Math.max(1, (W / px) * 11 / 12);
        // A narrow window (a phone) gets a taller plot, so the names have more room, and a wider
        // left margin: there the y-axis title ran into the tick labels.
        narrow = px < 600;
        H = Math.round(narrow ? W * 1.3 : 575);
        M = { l: narrow ? 48 * k : 50 + 20 * k, r: 24, t: 30, b: 34 + 24 * k };
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.style.setProperty('--k', k);
        for (const n of nodes) {
            n.circle.setAttribute('r', (n.d.group === 'ours' ? 8 : 6.5) * k);
            n.circle.setAttribute('stroke-width', (n.d.trainedOn ? 2 : 1) * k);
            n.leader.setAttribute('stroke-width', k);
        }
    }

    function scale(metric, values, lo, hi) {
        const m = METRICS[metric];
        let min = Math.min(...values), max = Math.max(...values);
        const pad = (max - min) * 0.06;
        min -= pad; max += pad;
        if (min > 0 && min < (max - min) * 0.5) min = 0;  // start at 0 when it is near
        const [a, b] = m.higher ? [lo, hi] : [hi, lo];
        const map = v => a + (v - min) / (max - min) * (b - a);
        return { map, min, max };
    }

    function ticks(s) {
        const span = s.max - s.min, raw = span / 6, mag = 10 ** Math.floor(Math.log10(raw));
        const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(v => v >= raw);
        const out = [];
        for (let v = Math.ceil(s.min / step) * step; v <= s.max + 1e-9; v += step) out.push(+v.toFixed(6));
        return out;
    }

    function drawAxes(sx, sy) {
        axes.replaceChildren();
        const x0 = M.l, x1 = W - M.r, y0 = H - M.b, y1 = M.t;
        for (const v of ticks(sx)) {
            const x = sx.map(v);
            el('line', { x1: x, x2: x, y1, y2: y0, class: 'tradeoff-grid' }, axes);
            el('text', { x, y: y0 + 20 * k, class: 'tradeoff-tick', 'text-anchor': 'middle' }, axes).textContent = +v.toPrecision(3);
        }
        for (const v of ticks(sy)) {
            const y = sy.map(v);
            el('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'tradeoff-grid' }, axes);
            el('text', { x: x0 - 10 * k, y: y + 4 * k, class: 'tradeoff-tick', 'text-anchor': 'end' }, axes).textContent = +v.toPrecision(3);
        }
        el('rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1, class: 'tradeoff-frame' }, axes);
        el('text', { x: (x0 + x1) / 2, y: H - 12, class: 'tradeoff-axis', 'text-anchor': 'middle' }, axes)
            .textContent = `${METRICS[view.x].label}  →`;
        const ax = 14 * k;
        el('text', { x: ax, y: (y0 + y1) / 2, class: 'tradeoff-axis', 'text-anchor': 'middle',
                     transform: `rotate(-90 ${ax} ${(y0 + y1) / 2})` }, axes)
            .textContent = `${METRICS[view.y].label}  →`;
    }

    // Put each name beside its dot, in the first spot that overlaps no other name or dot. If no
    // spot beside the dot is free, try spots farther out and draw a line to the dot. If none is
    // free, take the spot with the least overlap.
    function placeLabels(pos) {
        const NEAR = [[11, 4, 'start'], [-11, 4, 'end'], [0, -12, 'middle'], [0, 20, 'middle'],
                      [10, -9, 'start'], [-10, -9, 'end'], [10, 16, 'start'], [-10, 16, 'end']];
        const FAR = [[26, 4, 'start'], [-26, 4, 'end'], [22, -16, 'start'], [-22, -16, 'end'],
                     [22, 24, 'start'], [-22, 24, 'end'], [0, -26, 'middle'], [0, 34, 'middle']];
        const SPOTS = [...NEAR.map(s => [...s, false]), ...FAR.map(s => [...s, true])]
            .map(([dx, dy, a, far]) => [dx * k, dy * k, a, far]);
        const fs = 12 * k, h = 1.05 * fs, ascent = 0.8 * fs;
        // On a phone, keep a gap around each name: two names side by side read as one.
        const pad = narrow ? 2.5 * k : 0;
        const boxes = [];
        const circles = pos.map(p => {
            const r = +p.n.circle.getAttribute('r') + k;
            return { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
        });
        const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
                                * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        // Ours first, so its names get the best spots.
        const byPriority = pos.map((p, i) => i).sort((a, b) => (pos[b].n.d.group === 'ours') - (pos[a].n.d.group === 'ours'));
        for (const i of byPriority) {
            const { n, x, y } = pos[i];
            const w = n.t.getComputedTextLength() || n.d.name.length * 7 * k;
            const r = +n.circle.getAttribute('r');
            // The leader ends at the edge of the name nearest the dot.
            const end = s => [s[2] === 'middle' ? 0 : s[0] - Math.sign(s[0]) * 2 * k,
                              s[2] === 'middle' ? (s[1] < 0 ? s[1] + 0.3 * fs : s[1] - ascent) : s[1] - 0.35 * fs];
            const leaderBox = ([ex, ey]) => ({ x: x + Math.min(0, ex) - k, y: y + Math.min(0, ey) - k,
                                               w: Math.abs(ex) + 2 * k, h: Math.abs(ey) + 2 * k });
            let best = null;
            for (const s of SPOTS) {
                const bx = s[2] === 'start' ? x + s[0] : s[2] === 'end' ? x + s[0] - w : x - w / 2;
                const box = { x: bx - pad, y: y + s[1] - ascent - pad / 2, w: w + 2 * pad, h: h + pad };
                const inside = bx > M.l && bx + w < W - M.r && box.y > M.t && box.y + box.h < H - M.b;
                if (!inside) continue;
                const lb = s[3] ? leaderBox(end(s)) : null;
                const cost = boxes.reduce((t, b) => t + overlap(b, box) + (lb ? overlap(b, lb) : 0), 0)
                           + circles.reduce((t, c, j) => t + (j === i ? 0 : overlap(c, box) + (lb ? overlap(c, lb) : 0)), 0);
                if (!best || cost < best.cost) best = { s, box, cost };
                if (cost === 0) break;
            }
            const s = best ? best.s : SPOTS[0];
            if (best) boxes.push(best.box);
            n.t.setAttribute('x', s[0]);
            n.t.setAttribute('y', s[1]);
            n.t.setAttribute('text-anchor', s[2]);
            const [ex, ey] = end(s);
            const len = Math.hypot(ex, ey) || 1;
            n.leader.setAttribute('x1', ex / len * r);
            n.leader.setAttribute('y1', ey / len * r);
            n.leader.setAttribute('x2', ex);
            n.leader.setAttribute('y2', ey);
            n.leader.style.display = s[3] ? '' : 'none';
            // Later names keep off the leader too.
            if (s[3]) boxes.push(leaderBox([ex, ey]));
        }
    }

    function render() {
        fit();
        const shown = nodes.filter(n => !hidden.has(n.d.group));
        const pool = shown.length ? shown : nodes;
        const sx = scale(view.x, pool.map(n => n.d[view.x]), M.l, W - M.r);
        const sy = scale(view.y, pool.map(n => n.d[view.y]), H - M.b, M.t);
        drawAxes(sx, sy);
        const pos = [];
        for (const n of nodes) {
            const x = sx.map(n.d[view.x]), y = sy.map(n.d[view.y]);
            // An SVG attribute, in viewBox units. A CSS translate in px put the dots off the axes
            // in Safari at some zoom levels.
            n.g.setAttribute('transform', `translate(${x} ${y})`);
            n.g.classList.toggle('off', hidden.has(n.d.group));
            if (!hidden.has(n.d.group)) pos.push({ n, x, y });
        }
        placeLabels(pos);
    }

    function showTip(d, g) {
        const rows = Object.keys(METRICS)
            .map(k => `<div><span>${METRICS[k].tip}</span><b>${METRICS[k].fmt(d[k])}</b></div>`)
            .join('');
        tip.innerHTML = `<div class="tradeoff-tip-name" style="color:${GROUPS[d.group].color}">${d.name}</div>
            <div class="tradeoff-tip-group">${GROUPS[d.group].label}${d.trainedOn ? ` · trained on ${d.trainedOn}` : ''}</div>
            ${rows}`;
        tip.hidden = false;
        const box = plot.getBoundingClientRect(), dot = g.getBoundingClientRect();
        const left = dot.left - box.left + dot.width / 2, top = dot.top - box.top;
        tip.style.left = Math.min(Math.max(left, 110), box.width - 110) + 'px';
        tip.style.top = (top < 170 ? top + dot.height + 12 : top - 12) + 'px';
        tip.classList.toggle('below', top < 170);
        g.classList.add('hover');
    }
    function hideTip() {
        tip.hidden = true;
        nodes.forEach(n => n.g.classList.remove('hover'));
    }

    for (const [id, g] of Object.entries(GROUPS)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tradeoff-key';
        b.innerHTML = `<i style="background:${g.color}"></i>${g.label}`;
        b.title = 'Show or hide';
        b.addEventListener('click', () => {
            hidden.has(id) ? hidden.delete(id) : hidden.add(id);
            b.classList.toggle('off', hidden.has(id));
            hideTip();
            render();
        });
        legend.appendChild(b);
    }
    const hollow = document.createElement('span');
    hollow.className = 'tradeoff-key static';
    hollow.innerHTML = '<i class="hollow"></i>Trained on Spring';
    legend.appendChild(hollow);

    render();
    // Text size and layout depend on the width on screen.
    let lastWidth = plot.clientWidth;
    new ResizeObserver(() => {
        if (plot.clientWidth === lastWidth) return;
        lastWidth = plot.clientWidth;
        hideTip();
        render();
    }).observe(plot);
})();
