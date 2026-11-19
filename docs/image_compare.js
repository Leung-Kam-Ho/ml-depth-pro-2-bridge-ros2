//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// Image gallery: the source image on the left, a slider between our depth and a baseline's on
// the right. Same UI as the video gallery (shared parts in ui.js), but the slider is CSS: the
// handle and the clip follow --pos. The handle takes the drag (sliderInput), and a transparent
// range input over the box takes the keys only.
// Data: images.js.

(() => {
    const root = document.getElementById('image-compare');
    if (!root || !window.IMAGES) return;
    const { methods, scenes } = window.IMAGES;
    const OURS = GALLERY.oursLabel;
    let scene = scenes[0], method = methods[0], pct = 0.5;

    const path = (id, name) => `assets/images/${id}/${name}.jpg`;

    root.innerHTML = `
        <div class="row g-3 align-items-center w-100 mx-0 image-stage">
            <div class="col-12 col-lg-6 image-col stage-col">
                <div class="image-box">
                    <img class="image-input" alt="Source image">
                    <div class="media-label">Source</div>
                    ${navArrows()}
                </div>
            </div>
            <div class="col-12 col-lg-6 image-col stage-col">
                <div class="image-box image-slider">
                    <img class="image-after" alt="">
                    <img class="image-before" alt="Depth Pro 2 depth">
                    <div class="twentytwenty-overlay">
                        <div class="twentytwenty-before-label">${OURS}</div>
                        <div class="twentytwenty-after-label"></div>
                    </div>
                    <div class="twentytwenty-handle"><span class="twentytwenty-left-arrow"></span><span class="twentytwenty-right-arrow"></span></div>
                    <input type="range" min="0" max="1" step="0.001" value="0.5" aria-label="Slide between our depth and the baseline's">
                </div>
            </div>
        </div>
        <div class="row gx-3 w-100 mx-0 video-controls">
            <div class="col-lg-6 d-none d-lg-block"></div>
            <div class="middle-controls">${fullscreenButton()}</div>
            <div class="col-12 col-lg-6 d-flex justify-content-center">
                ${viewToggle(OURS, '')}
            </div>
        </div>
        <div class="method-picker" role="group" aria-label="Compare against"></div>
        <div class="thumbnail-container"><div class="thumbnail-row"></div></div>`;

    // The notes sit under the thumbnails, as in the video gallery.
    const notes = document.getElementById('image-notes');
    root.querySelector('.thumbnail-container').after(notes);

    const stage = root.querySelector('.image-stage');
    const input = root.querySelector('.image-input');
    const before = root.querySelector('.image-before');
    const after = root.querySelector('.image-after');
    const slider = root.querySelector('.image-slider');
    const range = slider.querySelector('input');
    const beforeLabel = slider.querySelector('.twentytwenty-before-label');
    const afterLabel = slider.querySelector('.twentytwenty-after-label');
    const buttons = root.querySelectorAll('.view-toggle .btn');
    const picker = root.querySelector('.method-picker');
    const thumbs = root.querySelector('.thumbnail-row');

    function setPct(p) {
        pct = p;
        range.value = p;
        slider.style.setProperty('--pos', p * 100 + '%');
        lightToggle(buttons, p);
        coverLabels(beforeLabel, afterLabel, p * slider.clientWidth);
    }
    range.addEventListener('input', () => setPct(+range.value));
    // Fullscreen shows our depth alone, at full size (showFullscreen in ui.js). The arrows step
    // through the scenes; on exit, the gallery moves to the scene last shown.
    const fullscreen = () => showFullscreen(scenes.map(s => ({
        aspect: s.width / s.height,
        thumb: `assets/thumbnails/images/${s.id}.jpg`,
        media: () => {
            const img = new Image();
            img.src = path(s.id, 'full/ours');
            img.alt = 'Depth Pro 2 depth';
            return img;
        },
    })), scenes.indexOf(scene), i => {
        if (scenes[i] !== scene) { scene = scenes[i]; pct = newScenePct(pct); show(); }
    });
    sliderInput(slider, setPct);
    root.querySelector('.fullscreen-btn')?.addEventListener('click', fullscreen);
    buttons.forEach(b => b.addEventListener('click', () => setPct(parseFloat(b.dataset.pct))));

    // Size both boxes from the scene's shape before the images load, so nothing jumps. Every
    // scene gets the same stage height; tall images get narrower instead of taller, and the
    // pair moves together in the middle (pairColumns in ui.js).
    function fit() {
        pairColumns(root, null);
        const column = root.querySelector('.image-col');
        const pad = parseFloat(getComputedStyle(column).paddingLeft) * 2;  // the gutter
        const col = column.clientWidth - pad;
        const h = stageHeight(stage, col, scene.height / scene.width);
        const width = Math.floor(Math.min(col, h * scene.width / scene.height));
        root.querySelectorAll('.image-box').forEach(b => {
            b.style.width = width + 'px';
            b.style.aspectRatio = `${scene.width} / ${scene.height}`;
        });
        setStage(root, h);  // ui.js
        pairColumns(root, width < col ? width + pad : null);
        setPct(pct);
    }

    function show() {
        fit();
        input.src = path(scene.id, 'input');
        before.src = path(scene.id, 'ours');
        after.src = path(scene.id, method.id);
        after.alt = `${method.label} depth`;
        afterLabel.textContent = method.label;
        root.querySelector('.view-baseline').textContent = method.label;
        setActive(picker, method.id);
        setActive(thumbs, scene.id);
        setPct(pct);  // the new label has a new width
    }

    buildPicker(picker, [{ label: 'Image models', methods }], id => {
        method = methods.find(m => m.id === id);
        show();
    });
    function pickScene(next) {
        scene = next;
        pct = newScenePct(pct);  // ui.js
        show();
    }
    buildThumbs(thumbs, scenes.map((s, i) => ({ id: s.id, thumb: `assets/thumbnails/images/${s.id}.jpg`, alt: `Image ${i + 1}` })),
                id => pickScene(scenes.find(s => s.id === id)));
    swipeNav(root, by => pickScene(scenes[(scenes.indexOf(scene) + by + scenes.length) % scenes.length]));
    onResize('image', fit);
    show();
})();
