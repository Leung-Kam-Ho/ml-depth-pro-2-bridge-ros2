//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// Video gallery. All content comes from data.js (window.GALLERY).
// To add or change a clip, edit data.js (see the README).

// Icons for the video controls (svg is in ui.js).
const ICON_PLAY = svg('<path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z"/>');
const ICON_PAUSE = svg('<rect x="3.5" y="2.5" width="3" height="11" rx=".8"/><rect x="9.5" y="2.5" width="3" height="11" rx=".8"/>');
const ICON_RESTART = svg('<path d="M8 3a5 5 0 1 1-4.9 6h1.6A3.5 3.5 0 1 0 8 4.5v2L4.8 3.8 8 1z"/>');

let currentClip = null;
let currentMethod = null;
// Slider position, kept across clips, so the chosen view stays when the clip changes.
let viewPct = 0.5;

function methodLabel(id) {
    const m = GALLERY.methods.find(x => x.id === id);
    return m ? m.label : id;
}

// The page shows one set of clips. data.js lists sets, as the folders do.
const DATASET = GALLERY.datasets[0];
const CLIPS = DATASET.clips;

function clipOf(clipId) {
    return CLIPS.find(c => c.id === clipId);
}

// ?v= carries the clip's content tag, so a reused clip id never plays a cached video.
function videoPath(methodId, clipId) {
    return `assets/videos/${DATASET.id}/${clipId}/${methodId}.mp4?v=${clipOf(clipId).rev}`;
}

// The thumbnails, and one labelled row of baseline chips per group (video models, image models).
function buildPage() {
    buildThumbs(document.getElementById('thumbnails'),
                CLIPS.map((c, j) => ({ id: c.id, thumb: c.thumb, alt: `Clip ${j + 1}` })),
                selectClip);
    buildPicker(document.getElementById('methods'),
                GALLERY.groups.map(g => ({ label: g.label, methods: GALLERY.methods.filter(m => m.group === g.id) })),
                selectMethod);
}

function selectMethod(methodId) {
    setActive(document.getElementById('methods'), methodId);
    currentMethod = methodId;
    loadComparison(currentClip, methodId);
}

function selectClip(clipId) {
    setActive(document.getElementById('thumbnails'), clipId);
    currentClip = clipId;
    viewPct = newScenePct(viewPct);  // ui.js
    loadComparison(clipId, currentMethod);
}

// The next (by 1) or previous (by -1) clip, for a swipe or the arrows (swipeNav in ui.js).
function stepClip(by) {
    const i = CLIPS.findIndex(c => c.id === currentClip);
    selectClip(CLIPS[(i + by + CLIPS.length) % CLIPS.length].id);
}

function loadComparison(clipId, methodId) {
    const area = document.getElementById('comparison');
    const clip = clipOf(clipId);
    if (!clip.methods.includes(methodId)) {
        releaseVideos(area);
        area.innerHTML = `<div class="loading-message">${methodLabel(methodId)} is not available for this clip</div>`;
        return;
    }

    // Same clip, new baseline: keep the source and our video, and load only the baseline.
    if (swapBaseline(area, clipId, methodId)) return;
    area.dataset.clip = clipId;

    const containerId = `tt-${Date.now()}`;

    releaseVideos(area);
    area.innerHTML = `
        <div id="comparison-container">
            <div class="buffering"><div class="spinner-border text-secondary" role="status"></div></div>
            <div class="row g-3 align-items-center w-100">
                <div class="col-12 col-lg-6 stage-col">
                    <div class="source-wrap">
                        <video class="source-video" loop muted playsinline preload="auto" poster="${clip.thumb}">
                            <source data-src="${clip.source}" type="video/mp4">
                        </video>
                        <div class="media-label">Source</div>
                        ${navArrows()}
                    </div>
                </div>
                <div class="col-12 col-lg-6 stage-col">
                    <div id="${containerId}">
                        <video class="video" loop muted playsinline preload="auto">
                            <source data-src="${videoPath(GALLERY.ours, clipId)}" type="video/mp4">
                        </video>
                        <video class="video" loop muted playsinline preload="auto">
                            <source data-src="${videoPath(methodId, clipId)}" type="video/mp4">
                        </video>
                    </div>
                </div>
            </div>
            <div class="row gx-3 gy-2 w-100 video-controls">
                <div class="col-lg-6 d-none d-lg-block"></div>
                <div class="middle-controls">
                    <button class="icon-btn play-toggle" title="Play" aria-label="Play" onclick="togglePlay('${area.id}')">${ICON_PLAY}</button>
                    <button class="icon-btn" title="Restart" aria-label="Restart" onclick="resetVideos('${area.id}')">${ICON_RESTART}</button>
                    ${fullscreenButton()}
                </div>
                <div class="col-12 col-lg-6 d-flex justify-content-center">
                    ${viewToggle(GALLERY.oursLabel, methodLabel(methodId))}
                </div>
            </div>
        </div>
    `;
    const container = $(`#${containerId}`);

    const column = container.parent();
    const ratio = clip.height / clip.width;

    // Fit the whole section in one window, so a clip click never pushes the thumbnails out of view.
    // Every clip gets the same stage height, and each clip fits inside it, centred, so nothing
    // below moves when the clip changes. Tall clips get narrower instead. Runs again on resize.
    function fit() {
        pairColumns(area, null);
        const row = area.querySelector('.row');
        const colWidth = column.width();
        const stage = stageHeight(row, colWidth, ratio);
        const width = Math.floor(Math.min(colWidth, stage / ratio));
        const narrow = width < colWidth;
        container.css('max-width', narrow ? width + 'px' : '100%');
        // Keep the input RGB the same width as the comparison.
        $(area).find('.source-wrap').css('max-width', narrow ? width + 'px' : '100%');
        pairColumns(area, narrow ? width : null);  // ui.js
        setStage(area, stage);  // ui.js
    }

    function initialize() {
        $(area).find('.source-video').css('aspect-ratio', `${clip.width} / ${clip.height}`);
        fit();

        container.twentytwenty({
            before_label: GALLERY.oursLabel,
            after_label: methodLabel(methodId),
            default_offset_pct: viewPct,
            ratio: ratio
        });

        // The buttons show one model, or both. Dragging the handle updates which one is lit.
        const buttons = area.querySelectorAll('.view-toggle .btn');
        buttons.forEach(b => b.addEventListener('click', () => container.trigger('slideto.twentytwenty', [parseFloat(b.dataset.pct)])));
        container.on('slid.twentytwenty', (e, pct) => {
            viewPct = pct;
            lightToggle(buttons, pct);
        });
        container.trigger('slideto.twentytwenty', [viewPct]);

        // Only one comparison is on the page at a time; this replaces the handler of the last one.
        onResize('video', () => {
            if (!area.contains(container[0])) return;  // user already switched clips
            fit();
            container.trigger('refit.twentytwenty');  // the slider height follows the new width
        });

        area.querySelector('.fullscreen-btn')?.addEventListener('click', fullscreenOurs);
        setupVideoSync(area.id);
        playWhenBuffered(area, prefetch);
    }

    // Size the slider before any video loads. If the box changes size after a video has
    // drawn a frame, Safari draws the next frames stretched to the old size, then snaps back.
    // The depth videos can differ from the source by a few pixels, because each model rounds
    // the frame to its own patch size; both are stretched to fill this box (see index.html).
    initialize();
    whenGalleryNear(() => area.querySelectorAll('video').forEach(v => v.isConnected && attachWhole(v, v.querySelector('source').dataset.src)));
}

// The first clip is about 20 MB. Download it only when the user scrolls near the gallery,
// not on page load. After that, fn runs at once.
let galleryNear = false;
const galleryWaiting = [];
function whenGalleryNear(fn) {
    if (galleryNear) return fn();
    galleryWaiting.push(fn);
    if (galleryWaiting.length > 1) return;
    const observer = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        observer.disconnect();
        galleryNear = true;
        galleryWaiting.splice(0).forEach(f => f());
    }, { threshold: 0.2 });
    observer.observe(document.getElementById('comparison'));
}

// Swap the baseline video in place. The source and our video stay loaded, so a
// method click downloads one video instead of three. The element is reused, so
// the sync listeners from setupVideoSync still apply to it.
function swapBaseline(area, clipId, methodId) {
    if (area.dataset.clip !== clipId) return false;
    const container = area.querySelector('.twentytwenty-container');
    if (!container) return false;
    const target = container.querySelectorAll('video')[1];
    if (!target) return false;

    const videos = Array.from(area.querySelectorAll('video'));
    const lead = videos[0];
    const wasPlaying = !lead.paused;
    const time = lead.currentTime;
    videos.forEach(v => v.pause());

    const spinner = document.createElement('div');
    spinner.className = 'buffering';
    spinner.innerHTML = '<div class="spinner-border text-secondary" role="status"></div>';
    area.querySelector('#comparison-container').prepend(spinner);

    target.addEventListener('loadedmetadata', () => { target.currentTime = time; }, { once: true });
    target.addEventListener('canplaythrough', () => {
        if (!target.isConnected) return;  // user already switched clips
        spinner.remove();
        if (wasPlaying) playVideos(area.id);
    }, { once: true });
    attachWhole(target, videoPath(methodId, clipId));

    container.querySelector('.twentytwenty-after-label').textContent = methodLabel(methodId);
    area.querySelector('.view-baseline').textContent = methodLabel(methodId);
    $(container).trigger('refit.twentytwenty');  // the new label has a new width
    resizers.video?.();  // and so has the toggle: lay the controls out again (onResize in ui.js)
    return true;
}

// Download a video completely, then play it from memory. Over a slow link a streamed video can
// run dry mid-play while the others keep going, so the three drift apart. A whole file cannot.
// Browsers block fetch() over file://, so the local preview streams as before.
// Some hosts (GitHub Enterprise Pages) forbid blob: in their media-src CSP. There we play the
// URL itself once the download is done; the browser cache then serves the file it just fetched.
let blobMediaBlocked = false;
document.addEventListener('securitypolicyviolation', e => {
    if (!e.blockedURI.startsWith('blob') || !/^media-src|^default-src/.test(e.effectiveDirective)) return;
    blobMediaBlocked = true;
    document.querySelectorAll('video').forEach(v => {
        const source = v.querySelector('source');
        if (source?.src.startsWith('blob:') && v.dataset.want) {
            const time = v.currentTime;
            URL.revokeObjectURL(source.src);
            source.src = v.dataset.want;
            v.addEventListener('loadedmetadata', () => { v.currentTime = time; }, { once: true });
            v.load();
        }
    });
});

// Downloaded videos, by URL. A clip seen before plays at once, and prefetch() fills this ahead.
const downloads = new Map();
function download(url) {
    if (!downloads.has(url)) {
        downloads.set(url, fetch(url)
            .then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.blob(); })
            .catch(err => { downloads.delete(url); throw err; }));
    }
    return downloads.get(url);
}

// Once a comparison plays, download the next clip's source, ours and current baseline (~35 MB),
// so a click on the next thumbnail plays at once. Only one clip ahead, to keep the traffic small.
// Not on phones, or when the user asked to save data: there a click waits for its own download.
function prefetch() {
    if (location.protocol === 'file:') return;
    if (matchMedia('(max-width: 767px)').matches || navigator.connection?.saveData) return;
    const next = CLIPS[(CLIPS.findIndex(c => c.id === currentClip) + 1) % CLIPS.length];
    const urls = [next.source, videoPath(GALLERY.ours, next.id)];
    if (next.methods.includes(currentMethod)) urls.push(videoPath(currentMethod, next.id));
    urls.forEach(url => download(url).catch(() => {}));
}

function attachWhole(video, url) {
    video.dataset.want = url;
    const attach = src => {
        const source = video.querySelector('source');
        const old = source.src;
        source.src = src;
        video.load();
        if (old.startsWith('blob:')) URL.revokeObjectURL(old);  // free the file it replaces
    };
    if (location.protocol === 'file:') return attach(url);
    download(url)
        .then(blob => {
            if (blobMediaBlocked) {
                if (video.isConnected && video.dataset.want === url) attach(url);
                return;
            }
            const src = URL.createObjectURL(blob);
            // The user moved on while it downloaded: another clip, or another baseline.
            if (!video.isConnected || video.dataset.want !== url) return URL.revokeObjectURL(src);
            attach(src);
        })
        .catch(err => {
            console.error('Video download failed, streaming instead:', err);
            if (video.isConnected && video.dataset.want === url) attach(url);
        });
}

// Free the blob URLs of the comparison that is about to be replaced. The files stay in downloads.
function releaseVideos(area) {
    area.querySelectorAll('video source').forEach(src => {
        if (src.src.startsWith('blob:')) URL.revokeObjectURL(src.src);
    });
}

// Keep every video in one comparison on the same frame. The source leads; the others follow it.
function setupVideoSync(areaId) {
    const [lead, ...followers] = document.querySelectorAll(`#${areaId} video`);

    lead.addEventListener('play', () => followers.forEach(v => v.play()));
    lead.addEventListener('pause', () => followers.forEach(v => v.pause()));
    // The one play/pause button follows the lead video's state.
    const toggle = document.querySelector(`#${areaId} .play-toggle`);
    const show = (icon, label) => { toggle.innerHTML = icon; toggle.title = label; toggle.ariaLabel = label; };
    lead.addEventListener('play', () => show(ICON_PAUSE, 'Pause'));
    lead.addEventListener('pause', () => show(ICON_PLAY, 'Play'));
    followers.forEach(v => {
        v.addEventListener('play', () => lead.play());
        v.addEventListener('pause', () => lead.pause());
    });

    let syncing = false;
    lead.addEventListener('timeupdate', () => {
        if (syncing) return;
        const drifted = followers.filter(v => Math.abs(v.currentTime - lead.currentTime) > 0.1);
        if (!drifted.length) return;
        syncing = true;
        drifted.forEach(v => { v.currentTime = lead.currentTime; });
        setTimeout(() => { syncing = false; }, 100);
    });
}

// Over a slow link, playing before the videos have buffered makes the sync
// seeks stall again and again. Hold a spinner until every video can play
// through, then start them together.
function playWhenBuffered(area, onStart) {
    const videos = Array.from(area.querySelectorAll('video'));
    const start = () => {
        if (!videos[0].isConnected) return;  // user already switched clips
        area.querySelector('.buffering')?.remove();
        playVideos(area.id);
        onStart();
    };
    const pending = videos.filter(v => v.readyState < 4);
    if (!pending.length) return start();
    let left = pending.length;
    pending.forEach(v => v.addEventListener('canplaythrough', () => {
        if (--left === 0) start();
    }, { once: true }));
}

// Our depth alone, fullscreen (showFullscreen in ui.js). The current clip starts from the moment
// the comparison is at; the arrows step through the others. On exit, the gallery moves to the clip
// last shown. clip.full is the full-size file where the page plays a smaller one.
// It streams: a whole 4K file would keep the screen black too long.
function fullscreenOurs() {
    const lead = document.querySelector('#comparison video');
    const start = CLIPS.findIndex(c => c.id === currentClip);
    const items = CLIPS.map((clip, i) => ({
        aspect: clip.width / clip.height,
        thumb: clip.thumb,
        media: () => {
            const video = document.createElement('video');
            Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true });
            video.src = clip.full || videoPath(GALLERY.ours, clip.id);
            if (i === start) {
                const time = lead.currentTime;
                video.addEventListener('loadedmetadata', () => { video.currentTime = time; }, { once: true });
            }
            return video;
        },
    }));
    showFullscreen(items, start, i => {
        if (CLIPS[i].id !== currentClip) selectClip(CLIPS[i].id);
    });
}

function playVideos(areaId) {
    document.querySelectorAll(`#${areaId} video`).forEach(v => {
        v.play().catch(err => console.log('Autoplay prevented:', err));
    });
}

function pauseVideos(areaId) {
    document.querySelectorAll(`#${areaId} video`).forEach(v => v.pause());
}

function togglePlay(areaId) {
    const lead = document.querySelector(`#${areaId} video`);
    if (lead.paused) playVideos(areaId); else pauseVideos(areaId);
}

// Restart: back to the first frame, and play from there.
function resetVideos(areaId) {
    document.querySelectorAll(`#${areaId} video`).forEach(v => { v.currentTime = 0; });
    playVideos(areaId);
}

$(document).ready(function() {
    buildPage();
    swipeNav(document.getElementById('comparison'), stepClip);
    // Start on the first clip, and on the first baseline that it has.
    const first = CLIPS[0];
    currentMethod = (GALLERY.methods.find(m => first.methods.includes(m.id)) || GALLERY.methods[0]).id;
    setActive(document.getElementById('methods'), currentMethod);
    selectClip(first.id);
});
