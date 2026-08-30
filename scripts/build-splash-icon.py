"""Builds the launch-screen mark: assets/images/splash-icon.png.

The splash used to be a white checkmark on violet while the app icon was the violet
"habits line" on a dark square — tapping the icon opened a screen that shared nothing
with it. This draws the icon's own mark instead, on transparency, so that over the
`backgroundColor` configured in app.json (the icon's own background) the launch screen
is the inside of the app icon, at rest, and the two read as one identity.

Same situation as scripts/build-tab-icon.py: no SVG rasteriser on this machine, so the
shapes are drawn from the geometry with supersampling. Unlike the tab icon this one is
not a template image — it keeps the icon's two-colour treatment, violet for the days
already closed and translucent white for the ones still ahead — so every shape carries
its own RGB as well as its own alpha.

Run from the repo root: python3 scripts/build-splash-icon.py
"""
import struct, zlib

VIOLET = (0x7C, 0x5C, 0xFF)
WHITE = (0xFF, 0xFF, 0xFF)

# Verbatim from icon.svg (viewBox 1024x1024) minus its background rect. All seven nodes,
# unlike the tab icon: nothing here has to hold its own next to an SF Symbol, and the
# full run is the mark as the app icon draws it.
TRACK_W = 26.0
SHAPES = [
    ('line', 142.0, 512.0, 882.0, 512.0, TRACK_W / 2, WHITE, 0.10),
    ('line', 142.0, 512.0, 512.0, 512.0, TRACK_W / 2, VIOLET, 1.0),
    ('dot', 142.0, 512.0, 40.0, VIOLET, 1.0),
    ('dot', 265.3, 512.0, 40.0, VIOLET, 1.0),
    ('dot', 388.7, 512.0, 40.0, VIOLET, 1.0),
    ('dot', 512.0, 512.0, 66.0, VIOLET, 1.0),
    ('dot', 635.3, 512.0, 34.0, WHITE, 0.16),
    ('dot', 758.7, 512.0, 34.0, WHITE, 0.16),
    ('dot', 882.0, 512.0, 34.0, WHITE, 0.16),
]

# 4x the 180pt width app.json asks the splash to draw the mark at, so it stays sharp on
# a @3x screen with room to spare.
WIDTH, HEIGHT = 720, 160
MARGIN = 8.0
SS = 3


def bbox():
    xs, ys = [], []
    for shape in SHAPES:
        if shape[0] == 'dot':
            _, cx, cy, r, _, _ = shape
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]
        else:
            _, ax, ay, bx, by, r, _, _ = shape
            xs += [ax - r, bx + r]
            ys += [ay - r, by + r]
    return min(xs), min(ys), max(xs), max(ys)


def render():
    sw, sh = WIDTH * SS, HEIGHT * SS
    x0, y0, x1, y1 = bbox()
    k = (WIDTH - 2 * MARGIN) * SS / (x1 - x0)
    off_x = (sw - (x1 - x0) * k) / 2 - x0 * k
    off_y = (sh - (y1 - y0) * k) / 2 - y0 * k

    # Premultiplied source-over, in SHAPES order, exactly as the SVG paints: the violet
    # track is listed after the faint one and has to cover it, not mix under it. The
    # tab-icon script gets away with `a += a * (1 - a)` because an alpha-only mask makes
    # painting order irrelevant; with two colours in play it is the whole difference
    # between a track that matches its nodes and one that reads a shade lighter.
    acc_r = [0.0] * (sw * sh)
    acc_g = [0.0] * (sw * sh)
    acc_b = [0.0] * (sw * sh)
    acc_a = [0.0] * (sw * sh)

    def blend(px, py, pw, ph, inside, rgb, a):
        r, g, b = rgb
        for y in range(max(0, py), min(sh, py + ph)):
            row = y * sw
            cy = y + 0.5
            for x in range(max(0, px), min(sw, px + pw)):
                if not inside(x + 0.5, cy):
                    continue
                i = row + x
                inv_a = 1.0 - a
                acc_r[i] = r * a + acc_r[i] * inv_a
                acc_g[i] = g * a + acc_g[i] * inv_a
                acc_b[i] = b * a + acc_b[i] * inv_a
                acc_a[i] = a + acc_a[i] * inv_a

    for shape in SHAPES:
        if shape[0] == 'dot':
            _, cx, cy, r, rgb, a = shape
            cx, cy, r = cx * k + off_x, cy * k + off_y, r * k
            r2 = r * r
            blend(
                int(cx - r) - 1, int(cy - r) - 1, int(2 * r) + 3, int(2 * r) + 3,
                lambda x, y, cx=cx, cy=cy, r2=r2: (x - cx) ** 2 + (y - cy) ** 2 <= r2,
                rgb, a,
            )
        else:
            _, ax, ay, bx, by, r, rgb, a = shape
            ax, ay = ax * k + off_x, ay * k + off_y
            bx, by = bx * k + off_x, by * k + off_y
            r = r * k
            r2 = r * r
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy

            def inside(x, y, ax=ax, ay=ay, dx=dx, dy=dy, length2=length2, r2=r2):
                t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
                px, py = x - (ax + t * dx), y - (ay + t * dy)
                return px * px + py * py <= r2

            blend(
                int(min(ax, bx) - r) - 1, int(min(ay, by) - r) - 1,
                int(abs(dx) + 2 * r) + 3, int(abs(dy) + 2 * r) + 3,
                inside, rgb, a,
            )

    rows = []
    inv = 1.0 / (SS * SS)
    for y in range(HEIGHT):
        row = bytearray([0])
        for x in range(WIDTH):
            sr = sg = sb = sa = 0.0
            for sy in range(y * SS, y * SS + SS):
                base = sy * sw + x * SS
                for i in range(base, base + SS):
                    sr += acc_r[i]; sg += acc_g[i]; sb += acc_b[i]; sa += acc_a[i]
            a = sa * inv
            if a <= 0.0005:
                row += b'\x00\x00\x00\x00'
                continue
            # Un-premultiply back to straight alpha, which is what PNG stores.
            row += bytes((
                min(255, round(sr * inv / a)),
                min(255, round(sg * inv / a)),
                min(255, round(sb * inv / a)),
                min(255, round(a * 255)),
            ))
        rows.append(bytes(row))

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
            + chunk(b'IEND', b''))


path = 'assets/images/splash-icon.png'
with open(path, 'wb') as f:
    f.write(render())
print('wrote', path)
