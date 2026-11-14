"""맵 그림 도구: 1600×900 장면을 SVG 조각으로 그린다. tools/make_maps.py가 사용."""
import math, random

W, H = 1600, 900
def f(v): return f'{v:.1f}'.rstrip('0').rstrip('.')

class Defs:
    """그라데이션·필터를 모아 두는 곳. id는 맵 이름으로 앞을 붙여 겹치지 않게"""
    def __init__(self, pre): self.pre, self.items = pre, []
    @staticmethod
    def _stops(stops):  # (위치, 색) 또는 (위치, 색, 불투명도)
        return ''.join(f'<stop offset="{s[0]}" stop-color="{s[1]}"' + (f' stop-opacity="{s[2]}"' if len(s) > 2 else '') + '/>' for s in stops)
    def lin(self, name, stops, x2=0, y2=1, x1=0, y1=0):
        self.items.append(f'<linearGradient id="{self.pre}{name}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{self._stops(stops)}</linearGradient>')
        return f'url(#{self.pre}{name})'
    def rad(self, name, stops, cx=.5, cy=.5, r=.5):
        self.items.append(f'<radialGradient id="{self.pre}{name}" cx="{cx}" cy="{cy}" r="{r}">{self._stops(stops)}</radialGradient>')
        return f'url(#{self.pre}{name})'
    def blur(self, name, sd):
        self.items.append(f'<filter id="{self.pre}{name}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{sd}"/></filter>')
        return f'url(#{self.pre}{name})'
    def svg(self): return f'<defs>{"".join(self.items)}</defs>'

def rect(fill, x=0, y=0, w=W, h=H, extra=''): return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"{extra}/>'
def circle(x, y, r, fill, extra=''):  # extra가 '<'로 시작하면 속에 넣을 움직임(<animate>)
    if extra.startswith('<'): return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}">{extra}</circle>'
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}"{extra}/>'

# ---------- 움직임 (SVG 안의 SMIL 애니메이션: <img>로 띄워도 돌아간다) ----------
def anim(attr, values, dur, begin=0):
    return f'<animate attributeName="{attr}" values="{values}" dur="{f(dur)}s" begin="{f(begin)}s" repeatCount="indefinite"/>'
def anim_t(kind, values, dur, begin=0, additive=''):
    return f'<animateTransform attributeName="transform" type="{kind}" values="{values}" dur="{f(dur)}s" begin="{f(begin)}s" repeatCount="indefinite"{additive}/>'
def animg(inner, *anims): return f'<g>{inner}{"".join(anims)}</g>'
def drift_g(inner, dx, dur):
    """천천히 옆으로 갔다 돌아오는 무리 (구름 등)"""
    return animg(inner, anim_t('translate', f'0 0;{f(dx)} 0;0 0', dur))
def twinkles(rnd, n, color, y1=0, y2=H * .7, x1=0, x2=W):
    """반짝이는 별: 셋 중 하나는 깜빡인다"""
    out = []
    for i in range(n):
        x, y, r = rnd.uniform(x1, x2), rnd.uniform(y1, y2), rnd.choice([.8, 1.2, 1.8])
        out.append(circle(x, y, r, color, anim('opacity', '.2;1;.2', rnd.uniform(2.5, 6), -rnd.uniform(0, 6)) if i % 3 == 0 else f' opacity="{rnd.choice([.35, .6, .9])}"'))
    return ''.join(out)
def falling(rnd, n, color, kind, x1, x2, dur):
    """떨어지는 잎·꽃잎·별가루: 위에서 아래로 흔들리며 내려오고, 끝에서 사라진다"""
    out = []
    for _ in range(n):
        x, d, s = rnd.uniform(x1, x2), rnd.uniform(-120, 120), rnd.uniform(.7, 1.3)
        shape = {'leaf': f'<rect x="-5" y="-5" width="10" height="10" fill="{color}" shape-rendering="crispEdges"/>',
                 'petal': f'<ellipse rx="7" ry="4" fill="{color}"/>',
                 'star': sparkle(0, 0, 7, color)}[kind]
        t, start = dur * rnd.uniform(.8, 1.4), 0
        start = -rnd.uniform(0, t)  # 처음부터 화면 곳곳에 흩어져 있게
        spin = f'<g transform="scale({f(s)})">{animg(shape, anim_t("rotate", "0;360", t / 2))}</g>'
        out.append(f'<g opacity="0" transform="translate({f(x)} -20)">{spin}'
                   f'{anim_t("translate", f"{f(x)} -20;{f(x + d / 2)} 450;{f(x + d)} 940", t, start)}{anim("opacity", "0;.9;.9;0", t, start)}</g>')
    return ''.join(out)
def fireflies(rnd, n, colors, area):
    """깜빡이며 떠다니는 반딧불"""
    x1, y1, x2, y2 = area; out = []
    for _ in range(n):
        x, y, c, r = rnd.uniform(x1, x2), rnd.uniform(y1, y2), rnd.choice(colors), rnd.uniform(1.4, 2.8)
        t = rnd.uniform(3, 7)
        out.append(animg(circle(x, y, r * 4, c, ' opacity=".18"') + circle(x, y, r, c), anim('opacity', '0;1;.3;1;0', t, -rnd.uniform(0, t)),
                         anim_t('translate', f'0 0;{f(rnd.uniform(-30, 30))} {f(rnd.uniform(-30, 10))};0 0', t * 2, -rnd.uniform(0, t))))
    return ''.join(out)
def birds(rnd, color, n):
    """줄지어 날아가는 새: 화면을 가로질러 천천히, 날갯짓"""
    out = []
    for i in range(n):
        y, t, s = rnd.uniform(120, 360), rnd.uniform(38, 60), rnd.uniform(.7, 1.3)
        wing = f'<path d="M-14 0Q-7 -8 0 0Q7 -8 14 0" fill="none" stroke="{color}" stroke-width="3.4" stroke-linecap="round">{anim("d", "M-14 0Q-7 -8 0 0Q7 -8 14 0;M-14 -4Q-7 4 0 0Q7 4 14 -4;M-14 0Q-7 -8 0 0Q7 -8 14 0", rnd.uniform(.6, .9))}</path>'
        out.append(f'<g><g transform="scale({f(s)})">{wing}</g>{anim_t("translate", f"-60 {f(y)};1660 {f(y - rnd.uniform(40, 120))}", t, -rnd.uniform(0, t))}</g>')
    return ''.join(out)

# ---------- 사진 넣기: tools/map_assets/의 손질한 그림을 SVG 안에 담는다 (<img>로 띄운 SVG는 밖의 파일을 못 읽는다) ----------
import base64, pathlib as _pl
ASSETS = _pl.Path(__file__).resolve().parent / 'map_assets'
PIX = ' style="image-rendering:pixelated"'
def img_tag(name, x, y, w, h, extra='', fit='xMidYMid slice'):
    data = base64.b64encode((ASSETS / name).read_bytes()).decode()
    mime = 'image/png' if name.endswith('.png') else 'image/jpeg'
    return f'<image href="data:{mime};base64,{data}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" preserveAspectRatio="{fit}"{extra}/>'
def g(inner, extra=''): return f'<g{extra}>{inner}</g>'
def path(d, fill='none', extra=''): return f'<path d="{d}" fill="{fill}"{extra}/>'
def P(d, extra=''): return f'<path d="{d}"{extra}/>'  # 색은 감싸는 g에서 받는다

def stars(rnd, n, color='#fff', y1=0, y2=H * .7, sizes=(.8, 1.2, 1.8), x1=0, x2=W):
    return ''.join(circle(rnd.uniform(x1, x2), rnd.uniform(y1, y2), rnd.choice(sizes), color, f' opacity="{rnd.choice([.35, .6, .9])}"') for _ in range(n))

def sparkle(x, y, r, c, op=1):
    k = r * .18
    return path(f'M{f(x)} {f(y - r)}L{f(x + k)} {f(y - k)} {f(x + r)} {f(y)} {f(x + k)} {f(y + k)} {f(x)} {f(y + r)} {f(x - k)} {f(y + k)} {f(x - r)} {f(y)} {f(x - k)} {f(y - k)}Z', c, f' opacity="{op}"')

def glowdots(rnd, n, colors, area, rmax=3, d=None):
    """반딧불·빛 알갱이: 작은 점 + 흐린 빛 번짐"""
    x1, y1, x2, y2 = area; out = []
    for _ in range(n):
        x, y, c = rnd.uniform(x1, x2), rnd.uniform(y1, y2), rnd.choice(colors)
        r = rnd.uniform(1, rmax)
        out.append(circle(x, y, r * 4, c, ' opacity=".18"') + circle(x, y, r, c))
    return ''.join(out)

def wavy(x1, y, x2, amp, n, rnd):
    """울퉁불퉁한 가로선 경로 (언덕·물가)"""
    pts = [(x1 + (x2 - x1) * i / n, y + rnd.uniform(-amp, amp)) for i in range(n + 1)]
    d = f'M{f(pts[0][0])} {f(pts[0][1])}'
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        d += f'Q{f(ax + (bx - ax) / 2)} {f(ay)} {f(bx)} {f(by)}'
    return d

def ground(y, color, rnd, amp=20, n=10):
    return path(wavy(-20, y, W + 20, amp, n, rnd) + f'V{H + 20}H-20Z', color)

def trunk(x, base, h, w, color, lean=0, flare=1.6, extra=''):
    """나무 기둥: 아래가 넓게 퍼지는 굽은 줄기"""
    top = base - h
    return path(f'M{f(x - w * flare)} {f(base)}C{f(x - w * .6)} {f(base - h * .25)} {f(x - w / 2 + lean * .5)} {f(base - h * .6)} {f(x - w / 2 + lean)} {f(top)}'
                f'H{f(x + w / 2 + lean)}C{f(x + w / 2 + lean * .5)} {f(base - h * .6)} {f(x + w * .6)} {f(base - h * .25)} {f(x + w * flare)} {f(base)}Z', color, extra)

def branches(x, y, ang, length, width, depth, color, rnd, spread=.5, out=None):
    """앙상한 가지: 재귀로 갈라지는 선"""
    out = [] if out is None else out
    if depth == 0 or length < 6: return out
    x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
    cx, cy = (x + x2) / 2 + rnd.uniform(-length * .15, length * .15), (y + y2) / 2 + rnd.uniform(-length * .15, length * .15)
    out.append(path(f'M{f(x)} {f(y)}Q{f(cx)} {f(cy)} {f(x2)} {f(y2)}', 'none', f' stroke="{color}" stroke-width="{f(width)}" stroke-linecap="round"'))
    for s in (-1, 1):
        if rnd.random() < .9:
            branches(x2, y2, ang + s * spread * rnd.uniform(.6, 1.2), length * rnd.uniform(.6, .78), width * .66, depth - 1, color, rnd, spread, out)
    return out

def bare_tree(x, base, h, w, color, rnd, depth=5, lean=0):
    return trunk(x, base, h, w, color, lean) + ''.join(branches(x + lean, base - h + 2, -math.pi / 2 + rnd.uniform(-.2, .2), h * .32, w * .8, depth, color, rnd, .55))

def canopy(cx, cy, rw, rh, color, rnd, n=14, rmin=.25, rmax=.42, extra=''):
    """둥근 잎 덩어리: 겹친 원"""
    out = []
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0, .75)
        out.append(circle(cx + math.cos(a) * rw * d, cy + math.sin(a) * rh * d * .8, rnd.uniform(rmin, rmax) * min(rw, rh) * 1.6, color))
    return g(''.join(out), extra)

def leaf(x, y, l, w, ang, color, extra=''):
    """뾰족한 잎 하나"""
    ca, sa = math.cos(ang), math.sin(ang)
    tx, ty = x + ca * l, y + sa * l
    nx, ny = -sa * w, ca * w
    mx, my = x + ca * l * .5, y + sa * l * .5
    return path(f'M{f(x)} {f(y)}Q{f(mx + nx)} {f(my + ny)} {f(tx)} {f(ty)}Q{f(mx - nx)} {f(my - ny)} {f(x)} {f(y)}Z', color, extra)

def fern(x, y, l, ang, color, rnd, n=9, extra=''):
    """고사리 잎: 휘어진 줄기 양옆으로 잎"""
    out = []
    for i in range(n):
        t = (i + 1) / (n + 1)
        px, py = x + math.cos(ang) * l * t, y + math.sin(ang) * l * t - math.sin(t * math.pi) * l * .12
        ll = l * .32 * (1 - t * .7)
        for s in (-1, 1):
            out.append(leaf(px, py, ll, ll * .22, ang + s * 1.0, color))
    out.append(path(f'M{f(x)} {f(y)}Q{f(x + math.cos(ang) * l * .5)} {f(y + math.sin(ang) * l * .5 - l * .12)} {f(x + math.cos(ang) * l)} {f(y + math.sin(ang) * l)}', 'none', f' stroke="{color}" stroke-width="2"'))
    return g(''.join(out), extra)

def bush(cx, base, w, h, color, rnd, n=10):
    return canopy(cx, base - h * .4, w / 2, h / 2, color, rnd, n, .3, .5)

def vine(x1, y1, x2, y2, sag, color, width=3, extra=''):
    return path(f'M{f(x1)} {f(y1)}Q{f((x1 + x2) / 2)} {f(max(y1, y2) + sag)} {f(x2)} {f(y2)}', 'none', f' stroke="{color}" stroke-width="{width}" stroke-linecap="round"{extra}')

def hang(x, y, l, color, width=2.4, rnd=None):
    """늘어진 덩굴 한 가닥"""
    wob = rnd.uniform(-20, 20) if rnd else 0
    return path(f'M{f(x)} {f(y)}C{f(x + wob)} {f(y + l * .3)} {f(x - wob)} {f(y + l * .7)} {f(x + wob * .3)} {f(y + l)}', 'none', f' stroke="{color}" stroke-width="{width}" stroke-linecap="round"')

def rays(x, y, angs, length, width, color, op):
    """비스듬히 내리는 빛줄기"""
    out = []
    for a in angs:
        ca, sa = math.cos(a), math.sin(a)
        nx, ny = -sa * width / 2, ca * width / 2
        ex, ey = x + ca * length, y + sa * length
        out.append(path(f'M{f(x - nx * .2)} {f(y - ny * .2)}L{f(x + nx * .2)} {f(y + ny * .2)} {f(ex + nx)} {f(ey + ny)} {f(ex - nx)} {f(ey - ny)}Z', color, f' opacity="{op}"'))
    return ''.join(out)

def cloud(cx, cy, w, h, color, rnd, n=8, extra=''):
    """부드러운 구름 (원 겹침)"""
    out = [rect(color, cx - w / 2, cy, w, h * .35, ' rx="' + f(h * .17) + '"')]
    for i in range(n):
        t = i / (n - 1)
        x = cx - w / 2 + w * (.1 + .8 * t)
        r = h * (.3 + .3 * math.sin(t * math.pi)) * rnd.uniform(.85, 1.15)
        out.append(circle(x, cy + h * .1 - r * .4, r, color))
    return g(''.join(out), extra)

def silhouette_city(x1, x2, base, color, rnd, hmin, hmax, wmin=30, wmax=80, spire=.3, lit=None):
    """멀리 보이는 건물 줄: 사각 건물 + 가끔 첨탑, 불 켜진 창"""
    out, x = [], x1
    while x < x2:
        w = rnd.uniform(wmin, wmax); h = rnd.uniform(hmin, hmax)
        out.append(rect(color, x, base - h, w, h + 2))
        if rnd.random() < spire:
            out.append(path(f'M{f(x)} {f(base - h)}L{f(x + w / 2)} {f(base - h - w * rnd.uniform(.6, 1.4))} {f(x + w)} {f(base - h)}Z', color))
        if lit:
            for _ in range(int(w * h / 1800)):
                out.append(rect(lit, x + rnd.uniform(4, w - 8), base - h + rnd.uniform(8, h - 10), 3, 4, ' opacity=".85"'))
        x += w + rnd.uniform(-6, 10)
    return ''.join(out)

def pagoda(x, base, w, h, color, tiers=3, lit=None):
    """처마가 휘어진 동양식 지붕 건물"""
    out, y, tw = [], base, w
    for i in range(tiers):
        th = h / tiers
        out.append(rect(color, x - tw * .32, y - th * .6, tw * .64, th * .6))
        if lit: out.append(rect(lit, x - tw * .2, y - th * .45, tw * .4, th * .2, ' opacity=".7"'))
        ry = y - th * .6
        out.append(path(f'M{f(x - tw * .62)} {f(ry + 6)}Q{f(x - tw * .45)} {f(ry - 2)} {f(x - tw * .3)} {f(ry - th * .35)}H{f(x + tw * .3)}Q{f(x + tw * .45)} {f(ry - 2)} {f(x + tw * .62)} {f(ry + 6)}Q{f(x)} {f(ry - 4)} {f(x - tw * .62)} {f(ry + 6)}Z', color))
        y = ry - th * .35; tw *= .78
    out.append(path(f'M{f(x)} {f(y - h * .18)}V{f(y)}', 'none', f' stroke="{color}" stroke-width="3"'))
    return ''.join(out)

# ---------- 픽셀 그림: 셀 단위로 래스터해서 가로로 이어진 칸을 한 사각형으로 묶는다 ----------
def raster(inside, bbox, cell, color, extra=''):
    x1, y1, x2, y2 = bbox; out = []
    y = y1 - (y1 % cell)
    while y < y2:
        x = x1 - (x1 % cell); run = None
        while x <= x2:
            hit = x < x2 and inside(x + cell / 2, y + cell / 2)
            if hit and run is None: run = x
            if not hit and run is not None:
                out.append(f'<rect x="{f(run)}" y="{f(y)}" width="{f(x - run)}" height="{cell}"/>'); run = None
            x += cell
        y += cell
    return f'<g fill="{color}" shape-rendering="crispEdges"{extra}>{"".join(out)}</g>'

def pix_circle(cx, cy, r, cell, color, extra=''):
    return raster(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r, (cx - r, cy - r, cx + r, cy + r), cell, color, extra)

def pix_blobs(blobs, cell, color, extra=''):
    """여러 원을 합친 덩어리 (픽셀 구름·나뭇잎)"""
    xs = [b[0] - b[2] for b in blobs] + [b[0] + b[2] for b in blobs]; ys = [b[1] - b[2] for b in blobs] + [b[1] + b[2] for b in blobs]
    return raster(lambda x, y: any((x - bx) ** 2 + (y - by) ** 2 <= br * br for bx, by, br in blobs), (min(xs), min(ys), max(xs), max(ys)), cell, color, extra)

def pix_poly(pts, cell, color, extra=''):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    def inside(x, y):
        c = False; j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]; xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
            j = i
        return c
    return raster(inside, (min(xs), min(ys), max(xs), max(ys)), cell, color, extra)

def pix_bands(stops, cell=12):
    """픽셀 하늘: 색 띠를 계단처럼"""
    out = []
    for (y1, c), (y2, _) in zip(stops, stops[1:]):
        out.append(rect(c, 0, y1, W, y2 - y1 + 1, ' shape-rendering="crispEdges"'))
    return ''.join(out)

def pix_cloud(cx, cy, w, h, cell, light, shade, rnd):
    blobs = [(cx - w / 2 + w * t, cy - math.sin(t * math.pi) * h * .45, h * (.28 + .25 * math.sin(t * math.pi))) for t in [i / 6 for i in range(7)]]
    blobs += [(cx - w * .4 + w * .8 * t, cy + h * .1, h * .3) for t in [i / 4 for i in range(5)]]
    under = [(x, y + h * .14, r) for x, y, r in blobs]
    return pix_blobs(under, cell, shade) + pix_blobs(blobs, cell, light)

def shade_center(defs, color, op=.5, cy=.55, r=.45):
    return rect(defs.rad('shade', [(0, color, op), (.6, color, op * .5), (1, color, 0)], .5, cy, r))
