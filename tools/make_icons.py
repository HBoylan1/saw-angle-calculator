"""Draw the app icon (a saw blade crossing a mitered board) as PNGs, no dependencies."""
import math, struct, sys, zlib, os

def png(path, size, pixels):
    raw = b''.join(b'\x00' + bytes(pixels[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

BG = (224, 97, 26); BOARD = (246, 225, 196); EDGE = (150, 98, 48); WHITE = (255, 255, 255)

def color_at(u, v):
    # u, v in [0,1] across the icon
    # board: horizontal band with a 45° mitered right end
    if 0.52 < v < 0.74 and u > 0.12 and (u - 0.12) < 0.5 + (0.74 - v):
        if v < 0.545 or v > 0.715 or u < 0.145:
            return EDGE
        return BOARD
    # blade circle with teeth
    cx, cy = 0.62, 0.38
    dx, dy = u - cx, v - cy
    r = math.hypot(dx, dy)
    a = math.atan2(dy, dx)
    tooth = 0.235 + 0.02 * (((a * 24 / (2 * math.pi)) % 1.0))
    if r < tooth:
        if r < 0.05:
            return BG
        return WHITE
    return BG

def render(size, path):
    ss = 3
    px = []
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((x + (sx + .5) / ss) / size, (y + (sy + .5) / ss) / size)
                    for i in range(3): acc[i] += c[i]
            px.extend(int(a / (ss * ss)) for a in acc)
    png(path, size, px)

out = sys.argv[1]
for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    render(size, os.path.join(out, name))
print('ok')
