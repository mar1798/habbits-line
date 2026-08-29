"""Builds the tab-bar icon: assets/images/tab-habits@2x.png and @3x.png.

The mark is the one on the app icon (assets/images/icon.svg), in its adaptive form —
a single violet at four alphas rather than violet plus white — which is exactly what a
template image is: UIKit throws the color away and tints the alpha channel with the tab
bar's own icon color, so the "done" half stays solid and the "future" half stays faint
in both the default and the selected state.

No SVG rasteriser is available on this machine (no rsvg-convert, cairosvg, ImageMagick
or PIL), so the shapes — a rounded track, a rounded "done" segment and seven nodes — are
drawn straight from the geometry with 4x supersampling.

Run from the repo root: python3 scripts/build-tab-icon.py
"""
import math, struct, zlib

# Geometry, verbatim from icon.svg (viewBox 1024x1024) minus its background rect — a tab
# icon has to be transparent so UIKit can tint it — with the adaptive variant's alphas
# for the "future" half, which are set against transparency rather than against the
# icon's dark square.
TRACK_W = 26.0
SHAPES = [
    ('line', 142.0, 512.0, 882.0, 512.0, TRACK_W / 2, 0.18),
    ('line', 142.0, 512.0, 512.0, 512.0, TRACK_W / 2, 1.0),
    ('dot', 142.0, 512.0, 40.0, 1.0),
    ('dot', 265.3, 512.0, 40.0, 1.0),
    ('dot', 388.7, 512.0, 40.0, 1.0),
    ('dot', 512.0, 512.0, 66.0, 1.0),
    ('dot', 635.3, 512.0, 34.0, 0.22),
    ('dot', 758.7, 512.0, 34.0, 0.22),
    ('dot', 882.0, 512.0, 34.0, 0.22),
]

# Tight bounds of the drawn mark, not of the viewBox: the icon's square is mostly padding,
# and keeping it would shrink the glyph to nothing inside the tab bar's fixed box.
BBOX = (102.0, 446.0, 916.0, 578.0)

RGB = (0x7C, 0x5C, 0xFF)
POINT_W, POINT_H = 48, 32  # UIKit's maximum tab-bar icon box.
MARGIN = 1.0
SS = 4


def render(scale: int) -> bytes:
    w, h = POINT_W * scale, POINT_H * scale
    sw, sh = w * SS, h * SS

    x0, y0, x1, y1 = BBOX
    # Fitted on width: the mark is ~6.2:1, so the width is always the binding side.
    k = ((POINT_W - 2 * MARGIN) * scale * SS) / (x1 - x0)
    off_x = (sw - (x1 - x0) * k) / 2 - x0 * k
    off_y = (sh - (y1 - y0) * k) / 2 - y0 * k

    alpha = [0.0] * (sw * sh)

    def blend(px, py, pw, ph, inside, a):
        """Composites one shape over the buffer inside its own bounding box."""
        for y in range(max(0, py), min(sh, py + ph)):
            row = y * sw
            cy = y + 0.5
            for x in range(max(0, px), min(sw, px + pw)):
                if inside(x + 0.5, cy):
                    i = row + x
                    alpha[i] += a * (1.0 - alpha[i])

    for shape in SHAPES:
        if shape[0] == 'dot':
            _, cx, cy, r, a = shape
            cx, cy, r = cx * k + off_x, cy * k + off_y, r * k
            r2 = r * r
            blend(
                int(cx - r) - 1, int(cy - r) - 1, int(2 * r) + 3, int(2 * r) + 3,
                lambda x, y, cx=cx, cy=cy, r2=r2: (x - cx) ** 2 + (y - cy) ** 2 <= r2,
                a,
            )
        else:
            _, ax, ay, bx, by, r, a = shape
            ax, ay = ax * k + off_x, ay * k + off_y
            bx, by = bx * k + off_x, by * k + off_y
            r = r * k
            r2 = r * r
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy

            def inside(x, y, ax=ax, ay=ay, dx=dx, dy=dy, length2=length2, r2=r2):
                # Distance to the segment — round caps come for free from the clamp.
                t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
                px, py = x - (ax + t * dx), y - (ay + t * dy)
                return px * px + py * py <= r2

            blend(
                int(min(ax, bx) - r) - 1, int(min(ay, by) - r) - 1,
                int(abs(dx) + 2 * r) + 3, int(abs(dy) + 2 * r) + 3,
                inside, a,
            )

    # Box-downsample the supersampled coverage into the final alpha channel.
    rows = []
    inv = 1.0 / (SS * SS)
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            total = 0.0
            for sy in range(y * SS, y * SS + SS):
                base = sy * sw + x * SS
                total += sum(alpha[base:base + SS])
            row += bytes((RGB[0], RGB[1], RGB[2], min(255, round(total * inv * 255))))
        rows.append(bytes(row))

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
            + chunk(b'IEND', b''))


# No @1x: every iOS device runs at @2x (SE, XR, 11, the iPads) or @3x (Pro, Plus, Max),
# and React Native resolves `require('.../tab-habits.png')` through the scale suffixes
# without the base file ever existing.
for scale, name in ((2, 'tab-habits@2x.png'), (3, 'tab-habits@3x.png')):
    path = f'assets/images/{name}'
    with open(path, 'wb') as f:
        f.write(render(scale))
    print('wrote', path)
