//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// UI shared by the video gallery (gallery.js) and the image gallery (image_compare.js).

// Icons for the buttons. Same 16x16 box, so a button never changes size.
const svg = d => `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">${d}</svg>`;
const ICON_FULLSCREEN = svg('<path d="M2 6V2h4v1.5H3.5V6zM10 2h4v4h-1.5V3.5H10zM14 10v4h-4v-1.5h2.5V10zM6 14H2v-4h1.5v2.5H6z"/>');

// Fullscreen shows our depth alone, as large as fits, at full size: no slider and no baseline.
// items: [{ media, aspect, thumb }], one per clip or image; media() makes a new <video> or <img>,
// aspect is its width/height, thumb its thumbnail. start is the one shown first. The arrow keys,
// the arrows at the screen edges, or the thumbnails along the bottom go to the others; nothing
// else loads meanwhile. A click elsewhere, or Esc, ends it, and
// onExit gets the index last shown, so the gallery can move there.
// A black box goes fullscreen, because nothing can be drawn over a fullscreen <video> itself. In it,
// a frame of the media's shape holds the media and the label, so the label sits on the picture,
// not on the black band a screen of another shape leaves. The box is on the page only while it is
// fullscreen. No button where the browser has no element fullscreen (iPhone).
const canFullscreen = document.fullscreenEnabled;
const fullscreenButton = () => canFullscreen
    ? `<button class="icon-btn fullscreen-btn" title="Fullscreen: Depth Pro 2 only" aria-label="Fullscreen: Depth Pro 2 only">${ICON_FULLSCREEN}</button>` : '';
function showFullscreen(items, start, onExit) {
    let index = start;
    const box = document.createElement('div');
    box.className = 'fullscreen-media';
    box.innerHTML = '<div class="fullscreen-frame"><div class="media-label">Depth Pro 2</div></div>' + (items.length < 2 ? '' :
        '<button class="fullscreen-nav prev" aria-label="Previous">&#8249;</button>' +
        '<button class="fullscreen-nav next" aria-label="Next">&#8250;</button>' +
        '<div class="thumbnail-row fullscreen-thumbs"></div>');
    const frame = box.firstChild;
    const thumbs = box.querySelector('.fullscreen-thumbs');
    if (thumbs) buildThumbs(thumbs, items.map((it, i) => ({ id: String(i), thumb: it.thumb, alt: `${i + 1}` })),
                            id => { index = +id; show(); });
    const show = () => {
        const old = frame.querySelector('video, img');
        if (old) { old.pause?.(); old.remove(); }
        frame.style.setProperty('--ar', items[index].aspect);
        frame.prepend(items[index].media());
        if (thumbs) setActive(thumbs, String(index));
    };
    const step = by => { index = (index + by + items.length) % items.length; show(); };
    const onKey = e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        if (items.length > 1) step(e.key === 'ArrowRight' ? 1 : -1);
    };
    box.addEventListener('click', e => {
        const nav = e.target.closest('.fullscreen-nav');
        if (nav) return step(nav.classList.contains('next') ? 1 : -1);
        if (e.target.closest('.fullscreen-thumbs')) return;
        document.exitFullscreen();
    });
    box.close = () => {
        document.removeEventListener('keydown', onKey, true);
        frame.querySelector('video')?.pause();
        box.remove();
        if (onExit) onExit(index);
    };
    show();
    document.body.appendChild(box);
    document.addEventListener('keydown', onKey, true);  // before the page's own arrow keys
    box.requestFullscreen().catch(() => box.close());
}
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) document.querySelectorAll('.fullscreen-media').forEach(box => box.close());
});

// Height for a gallery's stage: what the window has left once the rest of the section is shown,
// so the whole section fits in one window. At most a 4:3 clip at full column width.
// On a phone, also at most the media's own height (ratio: height / width) at full column width:
// a wide clip in a 4:3 stage left empty bands above and below it.
function stageHeight(row, colWidth, ratio) {
    const section = row.closest('section');
    const rest = section.offsetHeight - row.offsetHeight;
    const h = Math.max(240, Math.min(windowHeight() - 56 - rest, colWidth * 3 / 4));  // 56: top bar
    return phone.matches ? Math.min(h, colWidth * ratio) : h;
}

// The window height with the browser's bars shown (CSS 100svh). On a phone, innerHeight grows
// while a scroll hides the address bar; the stages then grew and flipped side by side to stacked.
const heightProbe = Object.assign(document.createElement('div'), { ariaHidden: 'true' });
heightProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
function windowHeight() {
    if (!heightProbe.isConnected) document.body.appendChild(heightProbe);
    return heightProbe.offsetHeight || window.innerHeight;
}

// Every clip or scene gets the same height, side by side or stacked, so the page under it never
// moves: each media column (.stage-col) is stage px high, its media centered in it. On a phone
// the page moves a little when the shape changes (stageHeight).
function setStage(area, stage) {
    area.querySelectorAll('.stage-col').forEach(col => { col.style.minHeight = stage + 'px'; });
}

// Tall media leave a gap between a gallery's two columns. pairColumns shrinks both columns, and
// the controls under them, to colPx and centers them, so the pair sits together. With colPx null
// they fill their halves again: call that before measuring a column. A narrow pair can leave no
// room between the middle buttons and the view toggle; then the toggle moves right. Not on a phone:
// there the buttons sit left of the toggle, on one line (index.html).
// On a phone the pair always stays stacked: two narrow columns fit side by side there, so the
// layout, and everything under it, jumped between a wide and a tall clip.
const phone = matchMedia('(max-width: 767px)');
function pairColumns(area, colPx) {
    if (phone.matches) colPx = null;
    area.querySelectorAll('.row').forEach(row => {
        row.classList.toggle('justify-content-center', colPx !== null);
        for (const col of row.children) {
            Object.assign(col.style, colPx === null ? { flex: '', width: '', maxWidth: '' }
                                                    : { flex: '0 0 auto', width: colPx + 'px', maxWidth: '100%' });
        }
    });
    const toggle = area.querySelector('.view-toggle');
    const last = area.querySelector('.middle-controls').lastElementChild;
    toggle.style.transform = '';
    if (!last) return;  // no fullscreen button (iPhone), and no play buttons in the image gallery
    const p = last.getBoundingClientRect(), t = toggle.getBoundingClientRect();
    const gap = 12 + p.right - t.left;
    const sameLine = p.top < t.bottom && t.top < p.bottom;  // not stacked
    if (gap > 0 && sameLine && !phone.matches) toggle.style.transform = `translateX(${gap}px)`;
}

// On a phone the thumbnails are out of view under the media. A sideways swipe on the media, or
// its small arrows (navArrows, shown on a phone only), go to the next or previous clip or image:
// onStep gets 1 or -1. A swipe that starts on the slider handle moves the handle instead.
const navArrows = () => '<button type="button" class="swipe-nav prev" aria-label="Previous">&#8249;</button>' +
                        '<button type="button" class="swipe-nav next" aria-label="Next">&#8250;</button>';
function swipeNav(area, onStep) {
    let x0 = null, y0 = 0;
    area.addEventListener('touchstart', e => {
        const t = e.touches[0];
        const onMedia = e.target.closest('.stage-col') && !e.target.closest('.twentytwenty-handle, .swipe-nav');
        x0 = e.touches.length === 1 && onMedia ? t.clientX : null;
        y0 = t.clientY;
    }, { passive: true });
    area.addEventListener('touchend', e => {
        if (x0 === null) return;
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) onStep(dx < 0 ? 1 : -1);
    });
    area.addEventListener('click', e => {
        const nav = e.target.closest('.swipe-nav');
        if (nav) onStep(nav.classList.contains('next') ? 1 : -1);
    });
}

// "Compare Depth Pro 2 against", then one labelled row of chips per group: [{label, methods}].
function buildPicker(picker, groups, onPick) {
    const title = document.createElement('div');
    title.className = 'method-picker-title';
    title.innerHTML = 'Compare <strong>Depth Pro 2</strong> against';
    picker.appendChild(title);
    groups = groups.filter(g => g.methods.length);
    title.style.setProperty('--rows', groups.length);
    for (const g of groups) {
        const label = document.createElement('div');
        label.className = 'method-group-label';
        label.textContent = g.label;
        const chips = document.createElement('div');
        chips.className = 'method-chips';
        for (const m of g.methods) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'method-chip';
            b.dataset.id = m.id;
            b.textContent = m.label;
            b.addEventListener('click', () => onPick(m.id));
            chips.appendChild(b);
        }
        picker.append(label, chips);
    }
}

// One thumbnail per item: [{id, thumb, alt}].
function buildThumbs(row, items, onPick) {
    for (const it of items) {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.dataset.id = it.id;
        item.innerHTML = `<img src="${it.thumb}" alt="${it.alt}" loading="lazy">`;
        item.addEventListener('click', () => onPick(it.id));
        row.appendChild(item);
    }
}

// The Ours / Split View / baseline buttons under a slider. data-pct is the handle position each one sets.
function viewToggle(ours, baseline) {
    return `<div class="btn-group view-toggle" role="group" aria-label="Show">
        <button type="button" class="btn btn-outline-secondary" data-pct="1">${ours}</button>
        <button type="button" class="btn btn-outline-secondary active" data-pct="0.5">Split View</button>
        <button type="button" class="btn btn-outline-secondary view-baseline" data-pct="0">${baseline}</button>
    </div>`;
}

// Mark the chip or thumbnail with this id as the selected one.
function setActive(parent, id) {
    parent.querySelectorAll('[data-id]').forEach(e => e.classList.toggle('active', e.dataset.id === id));
}

// Light the Ours / Split View / baseline button that matches the handle position (0 to 1).
function lightToggle(buttons, pct) {
    buttons.forEach(b => {
        const p = parseFloat(b.dataset.pct);
        b.classList.toggle('active', p === 0.5 ? pct > 0 && pct < 1 : pct === p);
    });
}

// The handle position for a new clip or scene: Split View starts at the center again, while a view
// of one model alone stays on that model.
function newScenePct(pct) {
    return pct > 0 && pct < 1 ? 0.5 : pct;
}

// Hide a slider label once the handle (x px from the left) covers it.
function coverLabels(before, after, x) {
    before.classList.toggle('covered', x < before.offsetLeft + before.offsetWidth);
    after.classList.toggle('covered', x > after.offsetLeft);
}

// Slider input, shared by both galleries. Only a drag on the handle (.twentytwenty-handle) moves
// it: onPct gets the new position, 0 to 1. Uses the move events of jquery.event.move.
function sliderInput(box, onPct) {
    const $box = $(box);
    let left = 0, width = 0, dragging = false;
    // A press must not start a text or image selection: a fast drag would light the pictures up.
    $box.on('mousedown', e => e.preventDefault());
    // On a phone, a drag on the handle must not scroll the page too.
    $box.find('.twentytwenty-handle').on('touchmove', e => e.preventDefault());
    $box.on('movestart', e => {
        dragging = $(e.target).closest('.twentytwenty-handle').length > 0;
        left = $box.offset().left;
        width = $box.width();
    });
    $box.on('move', e => {
        if (dragging) onPct(Math.max(0, Math.min(1, (e.pageX - left) / width)));
    });
    $box.on('moveend', () => { dragging = false; });
}

// Run fn once per frame at most while the window resizes. A later call with the same key
// replaces the earlier fn: the video gallery rebuilds its comparison on every clip.
const resizers = {};
let resizeFrame = 0;
function onResize(key, fn) {
    resizers[key] = fn;
}
window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => Object.values(resizers).forEach(f => f()));
});
