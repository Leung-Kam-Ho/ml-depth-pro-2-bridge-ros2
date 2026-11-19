//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// The credit of the clip or image on show, one line under each gallery's notes.
// Ids: the clip folders (data.js) and the image scenes (images.js).
(function () {
    const PEXELS_VIDEO = 'https://www.pexels.com/video/';
    const PEXELS_PHOTO = 'https://www.pexels.com/photo/';
    const VK = { text: 'Vladlen Koltun' };
    const CREDITS = {
        thumbnails: {  // video gallery
            lighthouse: VK, hot_air_balloons: VK, boat_cliffs: VK, mosque: VK, birds_plaza: VK, highland_cow: VK,
            monkeys: { text: 'Tom Fisk, Pexels', url: PEXELS_VIDEO + 'two-monkeys-interact-on-scenic-coastal-cliff-34703982/' },
            ostrich: { text: 'Magda Ehlers, Pexels', url: PEXELS_VIDEO + '13692991/' },
        },
        'image-compare': {
            img01: { text: 'Abhishek Navlakha, Pexels', url: PEXELS_PHOTO + '37596901/' },
            img02: { text: 'DIS5K (Qin et al., 2022)', url: 'https://arxiv.org/abs/2203.03041' },
            img03: { text: 'AM-2K (Li et al., 2022)', url: 'https://arxiv.org/abs/2010.16188' },
            img04: { text: 'Jackson Tee, Pexels', url: PEXELS_PHOTO + '14827001/' },
            img05: { text: 'Peiyun Hu' },
            img06: { text: 'Peiyun Hu' },
            img07: { text: 'DIS5K (Qin et al., 2022)', url: 'https://arxiv.org/abs/2203.03041' },
            img08: { text: 'Colin G, Pexels', url: PEXELS_PHOTO + '36673310/' },
        },
    };

    // The line goes inside the notes, so it moves with them (image_compare.js moves the image notes).
    // It is there from the start, so the galleries measure their height with it (stageHeight in ui.js).
    function setup(rootId, notes, kind) {
        const root = document.getElementById(rootId);
        if (!root || !notes) return;
        const line = document.createElement('span');
        line.className = 'credit-line';
        line.innerHTML = '&nbsp;';
        notes.append(line);
        let shown;
        const show = () => {
            const id = root.querySelector('.thumbnail-item.active')?.dataset.id;
            if (id === shown) return;  // also stops the loop: the image notes sit inside root
            shown = id;
            const c = CREDITS[rootId][id];
            if (!c) { line.innerHTML = '&nbsp;'; return; }
            line.textContent = kind + ' credit: ';
            const name = document.createElement(c.url ? 'a' : 'span');
            name.textContent = c.text;
            if (c.url) { name.href = c.url; name.target = '_blank'; name.rel = 'noopener'; }
            line.append(name);
        };
        new MutationObserver(show).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
        show();
    }
    setup('thumbnails', document.querySelector('#videos .gallery-notes'), 'Video');
    setup('image-compare', document.getElementById('image-notes'), 'Image');
})();
