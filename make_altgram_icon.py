import os
import math
from PIL import Image, ImageDraw

def cubic_bezier(p0, p1, p2, p3, steps=180):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1.0 - t
        x = (mt**3)*p0[0] + 3*(mt**2)*t*p1[0] + 3*mt*(t**2)*p2[0] + (t**3)*p3[0]
        y = (mt**3)*p0[1] + 3*(mt**2)*t*p1[1] + 3*mt*(t**2)*p2[1] + (t**3)*p3[1]
        pts.append((x, y))
    return pts

def draw_smooth_stroke(draw, pts, width, color):
    r = width / 2.0
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=int(round(width)))
    for x, y in pts:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

def render_monogram(canvas_sz, mono=False):
    # Supersample 4x for razor-sharp anti-aliased Bezier strokes
    ss = 4
    S = canvas_sz * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    color = (255, 255, 255, 255) if mono else (13, 122, 122, 255)
    stroke_w = S * 0.036

    # Normalized coordinates mapped into safe adaptive icon center zone (0.24 .. 0.76)
    def P(nx, ny):
        return (S * (0.23 + nx * 0.54), S * (0.22 + ny * 0.56))

    # Continuous cursive "a" -> tall "l" loop -> "t" upward hook
    stroke1 = (
        cubic_bezier(P(0.24, 0.34), P(0.03, 0.34), P(0.01, 0.68), P(0.15, 0.67)) +
        cubic_bezier(P(0.15, 0.67), P(0.24, 0.66), P(0.27, 0.44), P(0.26, 0.32)) +
        cubic_bezier(P(0.26, 0.32), P(0.23, 0.48), P(0.21, 0.69), P(0.32, 0.69)) +
        cubic_bezier(P(0.32, 0.69), P(0.45, 0.69), P(0.62, 0.24), P(0.61, 0.08)) +
        cubic_bezier(P(0.61, 0.08), P(0.60, 0.03), P(0.45, 0.36), P(0.47, 0.56)) +
        cubic_bezier(P(0.47, 0.56), P(0.49, 0.71), P(0.75, 0.70), P(0.84, 0.47)) +
        cubic_bezier(P(0.84, 0.47), P(0.86, 0.41), P(0.85, 0.37), P(0.82, 0.36))
    )

    # Descending "t" stem crossing the loop tail
    stroke2 = cubic_bezier(P(0.66, 0.44), P(0.66, 0.62), P(0.63, 0.79), P(0.56, 0.94))

    draw_smooth_stroke(draw, stroke1, stroke_w, color)
    draw_smooth_stroke(draw, stroke2, stroke_w, color)

    return img.resize((canvas_sz, canvas_sz), Image.LANCZOS)

res = "android/app/src/main/res"
for d, sz, fg_sz in [
    ("mdpi", 48, 108),
    ("hdpi", 72, 162),
    ("xhdpi", 96, 216),
    ("xxhdpi", 144, 324),
    ("xxxhdpi", 192, 432),
]:
    os.makedirs(f"{res}/mipmap-{d}", exist_ok=True)
    os.makedirs(f"{res}/drawable-{d}", exist_ok=True)
    render_monogram(sz, mono=False).save(f"{res}/mipmap-{d}/ic_launcher.png")
    render_monogram(sz, mono=False).save(f"{res}/mipmap-{d}/ic_launcher_round.png")
    render_monogram(fg_sz, mono=False).save(f"{res}/drawable-{d}/ic_launcher_foreground.png")
    render_monogram(fg_sz, mono=True).save(f"{res}/drawable-{d}/ic_launcher_monochrome.png")

os.makedirs(f"{res}/values", exist_ok=True)
os.makedirs(f"{res}/values-night", exist_ok=True)
open(f"{res}/values/ic_launcher_background.xml", "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F4F1EA</color>\n</resources>\n'
)
open(f"{res}/values-night/ic_launcher_background.xml", "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1C1C1E</color>\n</resources>\n'
)

os.makedirs(f"{res}/mipmap-anydpi-v26", exist_ok=True)
adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
'''
open(f"{res}/mipmap-anydpi-v26/ic_launcher.xml", "w").write(adaptive_xml)
open(f"{res}/mipmap-anydpi-v26/ic_launcher_round.xml", "w").write(adaptive_xml)
print("Generated smooth Bezier AltGram adaptive icons.")
