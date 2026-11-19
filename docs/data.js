//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//
// The clips, baselines and labels of the video gallery (gallery.js). See the README to edit it.
window.GALLERY = {
  "ours": "ours",
  "oursLabel": "Depth Pro 2 (Ours)",
  "groups": [
    {
      "id": "multi",
      "label": "Video models"
    },
    {
      "id": "single",
      "label": "Image models"
    }
  ],
  "methods": [
    {
      "id": "pi3",
      "label": "\u03c0\u00b3",
      "group": "multi"
    },
    {
      "id": "video_depth_anything",
      "label": "Video Depth Anything",
      "group": "multi"
    },
    {
      "id": "depth_anything_3",
      "label": "Depth Anything 3",
      "group": "multi"
    },
    {
      "id": "velodepth",
      "label": "VeloDepth",
      "group": "multi"
    },
    {
      "id": "dage",
      "label": "DAGE",
      "group": "multi"
    },
    {
      "id": "vggt_omega",
      "label": "VGGT-\u03a9",
      "group": "multi"
    },
    {
      "id": "infinidepth",
      "label": "InfiniDepth",
      "group": "single"
    },
    {
      "id": "moge3",
      "label": "MoGe-3",
      "group": "single"
    },
    {
      "id": "depth_pro",
      "label": "Depth Pro",
      "group": "single"
    },
    {
      "id": "lotus2",
      "label": "Lotus-2",
      "group": "single"
    }
  ],
  "datasets": [
    {
      "id": "clips",
      "label": "clips",
      "clips": [
        {
          "id": "lighthouse",
          "rev": "ad1a453e",
          "width": 1280,
          "height": 720,
          "thumb": "assets/thumbnails/clips/lighthouse.jpg?v=ad1a453e",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "full": "assets/videos/clips/lighthouse/full/ours.mp4?v=ad1a453e",
          "source": "assets/videos/clips/lighthouse/source.mp4?v=ad1a453e"
        },
        {
          "id": "hot_air_balloons",
          "rev": "0ea52c28",
          "width": 1280,
          "height": 960,
          "thumb": "assets/thumbnails/clips/hot_air_balloons.jpg?v=0ea52c28",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "source": "assets/videos/clips/hot_air_balloons/source.mp4?v=0ea52c28"
        },
        {
          "id": "monkeys",
          "rev": "9843290a",
          "width": 1280,
          "height": 720,
          "thumb": "assets/thumbnails/clips/monkeys.jpg?v=9843290a",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "full": "assets/videos/clips/monkeys/full/ours.mp4?v=9843290a",
          "source": "assets/videos/clips/monkeys/source.mp4?v=9843290a"
        },
        {
          "id": "boat_cliffs",
          "rev": "d8332036",
          "width": 960,
          "height": 1280,
          "thumb": "assets/thumbnails/clips/boat_cliffs.jpg?v=d8332036",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "source": "assets/videos/clips/boat_cliffs/source.mp4?v=d8332036"
        },
        {
          "id": "mosque",
          "rev": "9089c6d9",
          "width": 1280,
          "height": 960,
          "thumb": "assets/thumbnails/clips/mosque.jpg?v=9089c6d9",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "source": "assets/videos/clips/mosque/source.mp4?v=9089c6d9"
        },
        {
          "id": "ostrich",
          "rev": "7a64b678",
          "width": 1280,
          "height": 720,
          "thumb": "assets/thumbnails/clips/ostrich.jpg?v=7a64b678",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "full": "assets/videos/clips/ostrich/full/ours.mp4?v=7a64b678",
          "source": "assets/videos/clips/ostrich/source.mp4?v=7a64b678"
        },
        {
          "id": "birds_plaza",
          "rev": "515a763c",
          "width": 1280,
          "height": 670,
          "thumb": "assets/thumbnails/clips/birds_plaza.jpg?v=515a763c",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "source": "assets/videos/clips/birds_plaza/source.mp4?v=515a763c"
        },
        {
          "id": "highland_cow",
          "rev": "12aaae5e",
          "width": 1280,
          "height": 720,
          "thumb": "assets/thumbnails/clips/highland_cow.jpg?v=12aaae5e",
          "methods": [
            "dage",
            "depth_anything_3",
            "depth_pro",
            "infinidepth",
            "lotus2",
            "moge3",
            "ours",
            "pi3",
            "velodepth",
            "vggt_omega",
            "video_depth_anything"
          ],
          "full": "assets/videos/clips/highland_cow/full/ours.mp4?v=12aaae5e",
          "source": "assets/videos/clips/highland_cow/source.mp4?v=12aaae5e"
        }
      ]
    }
  ]
};
