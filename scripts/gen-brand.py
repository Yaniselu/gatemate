"""Builds every app icon / splash / in-app logo from branding/logo-source.jpg. Run: python3 scripts/gen-brand.py"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

SRC = 'branding/logo-source.jpg'
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)

# Mark = everything clearly darker than the white page.
dark = 255 - a.min(axis=2)
ys, xs = np.where(dark > 20)
pad = 6
box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height))
crop = a[box[1]:box[3], box[0]:box[2]]

# Transparent version: alpha from distance to white, colour un-premultiplied so edges stay crisp.
alpha = np.clip((255 - crop.min(axis=2)) / 255 * 1.6, 0, 1)
rgb = np.where(alpha[..., None] > 0.02, 255 - (255 - crop) / np.maximum(alpha[..., None], 0.02), 255)
rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
mark = Image.fromarray(rgba, 'RGBA')

def square(size, scale, bg=(255, 255, 255, 255), round_mask=False):
    """Mark centred on a square canvas; `scale` = share of the canvas the mark's longer side takes."""
    canvas = Image.new('RGBA', (size, size), bg)
    m = mark.copy()
    s = scale * size / max(m.size)
    m = m.resize((max(1, round(m.width * s)), max(1, round(m.height * s))), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    if round_mask:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        canvas.putalpha(mask)
    return canvas

def save(img, path, opaque=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (img.convert('RGB') if opaque else img).save(path, optimize=True)

# In-app logo (transparent) and web icons
mark_web = mark.copy(); mark_web.thumbnail((512, 512), Image.LANCZOS)
save(mark_web, 'public/logo.png', opaque=False)
save(square(512, 0.72), 'public/icon-512.png')
save(square(192, 0.72), 'public/icon-192.png')
save(square(512, 0.56), 'public/icon-maskable-512.png')
save(square(180, 0.72), 'public/apple-touch-icon.png')
save(square(64, 0.86), 'public/favicon.png')

# iOS: single 1024 icon, opaque, no rounded corners (iOS masks it)
save(square(1024, 0.70), 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
# iOS splash (white with the mark in the middle)
for name in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
    save(square(2732, 0.22), f'ios/App/App/Assets.xcassets/Splash.imageset/{name}')

# Android launcher icons
res = 'android/app/src/main/res'
for d, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    save(square(px, 0.72), f'{res}/mipmap-{d}/ic_launcher.png')
    save(square(px, 0.66, round_mask=True), f'{res}/mipmap-{d}/ic_launcher_round.png', opaque=False)
    fg = px * 108 // 48  # adaptive foreground layer is 108dp; keep the mark inside the 66dp safe zone
    save(square(fg, 0.50, bg=(0, 0, 0, 0)), f'{res}/mipmap-{d}/ic_launcher_foreground.png', opaque=False)
# Android splash drawables: keep each file's size, white with the mark centred
for root, _, files in os.walk(res):
    for f in files:
        if f == 'splash.png':
            p = os.path.join(root, f)
            w, h = Image.open(p).size
            c = Image.new('RGB', (w, h), 'white')
            m = mark.copy(); s = 0.28 * min(w, h) / max(m.size)
            m = m.resize((round(m.width * s), round(m.height * s)), Image.LANCZOS)
            c.paste(m, ((w - m.width) // 2, (h - m.height) // 2), m)
            c.save(p, optimize=True)
print('done', mark.size)
