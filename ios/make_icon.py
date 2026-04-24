#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import math, os

SIZE = 1024

def make_gradient(size):
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    # Blue-purple gradient (top-left → bottom-right)
    c1 = (64, 89, 230)   # #4059E6
    c2 = (115, 64, 204)  # #7340CC
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            img.putpixel((x, y), (r, g, b, 255))
    return img

def draw_chart(draw, cx, cy, w, h):
    # Subtle rising candlestick bars
    bars = [
        (0.0,  0.65, 0.40),
        (0.18, 0.50, 0.28),
        (0.36, 0.72, 0.48),
        (0.54, 0.35, 0.18),
        (0.72, 0.20, 0.05),
        (0.90, 0.30, 0.12),
    ]
    bar_w = int(w * 0.10)
    for bx, top, bot in bars:
        x = int(cx - w/2 + bx * w)
        y1 = int(cy + h/2 - top * h)
        y2 = int(cy + h/2 - bot * h)
        draw.rectangle([x, y1, x + bar_w, y2], fill=(255, 255, 255, 80))

    # Rising trend line
    pts = [
        (cx - w*0.48, cy + h*0.38),
        (cx - w*0.25, cy + h*0.15),
        (cx,          cy - h*0.05),
        (cx + w*0.25, cy - h*0.22),
        (cx + w*0.48, cy - h*0.42),
    ]
    for i in range(len(pts)-1):
        x0,y0 = pts[i]; x1,y1 = pts[i+1]
        draw.line([x0,y0,x1,y1], fill=(255,255,255,200), width=10)

    # Dot at end
    ex, ey = pts[-1]
    r = 18
    draw.ellipse([ex-r, ey-r, ex+r, ey+r], fill=(255,255,255,230))

def make_icon(size=1024):
    img = make_gradient(size)
    draw = ImageDraw.Draw(img)

    scale = size / 1024

    # Chart area
    draw_chart(draw, size*0.50, size*0.42, size*0.72, size*0.38)

    # "FD" main text
    try:
        font_fd = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", int(260*scale))
    except:
        font_fd = ImageFont.load_default()

    try:
        font_sub = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", int(72*scale))
    except:
        font_sub = ImageFont.load_default()

    # "FD" — bold, centered, lower half
    text_fd = "FD"
    bbox = draw.textbbox((0,0), text_fd, font=font_fd)
    tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = int(size * 0.60) - bbox[1]
    draw.text((tx+4, ty+4), text_fd, font=font_fd, fill=(0,0,0,60))
    draw.text((tx, ty), text_fd, font=font_fd, fill=(255,255,255,245))

    # "JUN & SOO" subtitle
    text_sub = "JUN & SOO"
    bbox2 = draw.textbbox((0,0), text_sub, font=font_sub)
    sw = bbox2[2]-bbox2[0]
    sx = (size - sw) // 2 - bbox2[0]
    sy = ty + th + int(18*scale)
    draw.text((sx, sy), text_sub, font=font_sub, fill=(255,255,255,180))

    return img

# Generate 1024x1024 master
out_dir = "Sources/Assets.xcassets/AppIcon.appiconset"
os.makedirs(out_dir, exist_ok=True)

icon = make_icon(1024)
icon.save(f"{out_dir}/icon_1024.png")

# iOS sizes
sizes = [20,29,38,40,60,76,83,87,120,152,167,180,1024]
for s in sizes:
    resized = icon.resize((s,s), Image.LANCZOS)
    resized.save(f"{out_dir}/icon_{s}.png")

print("아이콘 생성 완료!")
print(f"  위치: {out_dir}/")
