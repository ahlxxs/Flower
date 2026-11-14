"""맵 배경 그리기 (1600×900, 홈·대기실·게임 공통 배경). 출력: maps_out.json {name: {back, front}}"""
import json, math, random
random.seed(7)
f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')

def cloud_bank(cx, cy, w, h, fill, line, n=9, seed=0, lw=2.2):
    """둥근 구름 무더기: 겹친 원 + 금빛 테두리, 안쪽엔 소용돌이"""
    rnd = random.Random(seed); out = []
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = cx - w / 2 + t * w + rnd.uniform(-w * .04, w * .04)
        y = cy - math.sin(t * math.pi) * h * .55 + rnd.uniform(-h * .08, h * .08)
        r = h * (.32 + .22 * math.sin(t * math.pi)) * rnd.uniform(.85, 1.15)
        pts.append((x, y, r))
    for i in range(n + 1):  # 아래쪽은 둥근 원을 한 줄 더 깔아 모서리가 보이지 않게
        out.append(f'<circle cx="{f(cx - w / 2 + i * w / n)}" cy="{f(cy + h * .35)}" r="{f(h * .42)}" fill="{fill}"/>')
    for x, y, r in pts:
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}" stroke="{line}" stroke-width="{lw}"/>')
    for x, y, r in pts[1:-1:2]:  # 소용돌이 무늬
        s = r * .45
        out.append(f'<path d="M{f(x - s)} {f(y + s * .2)}a{f(s)} {f(s)} 0 1 1 {f(s * 1.2)} {f(s * .6)}a{f(s * .6)} {f(s * .6)} 0 1 1-{f(s * .5)}-{f(s * .7)}" fill="none" stroke="{line}" stroke-width="{lw * .8}" opacity=".85"/>')
    return f'<g>{"".join(out)}</g>'

def flower(x, y, r, c):
    petals = ''.join(f'<circle cx="{f(x + r * .6 * math.cos(a))}" cy="{f(y + r * .6 * math.sin(a))}" r="{f(r * .45)}" fill="{c}"/>' for a in [i * 2 * math.pi / 5 - math.pi / 2 for i in range(5)])
    return petals + f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * .25)}" fill="#c43a2a"/>'

# ---------- 붉은 상운 ----------
gold = '#f0c46a'
red_back = [
  '<rect width="1600" height="900" fill="url(#rcSky)"/>',
  '<circle cx="720" cy="300" r="520" fill="url(#rcGlow)"/>',
  # 하늘의 금빛 실선 장식
  f'<g fill="none" stroke="{gold}" stroke-width="2.2" stroke-linecap="round" opacity=".9"><path d="M160 150c90-60 190-40 260 10s160 40 240-30"/><path d="M200 175c80-30 150-10 210 30"/><path d="M660 130c20-30 60-30 70 0s-30 40-50 20"/>'
  '<path d="M1040 90c60 20 120 0 170-40"/></g>',
  flower(560, 120, 26, '#fbe3c6'),
  cloud_bank(1300, 260, 640, 260, '#c8283a', gold, 9, 1),
  cloud_bank(1460, 170, 360, 180, '#5a1424', gold, 6, 2),
  cloud_bank(260, 420, 620, 260, '#fbe3c6', gold, 8, 3),
  cloud_bank(1250, 520, 560, 260, '#fbe3c6', gold, 8, 4),
  ''.join(f'<circle cx="{random.randint(80, 1520)}" cy="{random.randint(60, 820)}" r="{random.choice([1.4, 2, 2.6])}" fill="{gold}" opacity="{random.choice([.5, .8, 1])}"/>' for _ in range(70)),
]
red_front = [
  cloud_bank(240, 760, 760, 300, '#d4313d', gold, 9, 5),
  cloud_bank(80, 840, 420, 220, '#4e1020', gold, 6, 6),
  cloud_bank(1320, 790, 820, 300, '#c42a36', gold, 10, 7),
  cloud_bank(800, 900, 900, 200, '#7a1626', gold, 10, 8),
  flower(70, 700, 22, '#fbe3c6'), flower(120, 740, 16, '#fbe3c6'), flower(40, 760, 14, '#fbe3c6'),
]

# ---------- 달과 기러기 ----------
cream, line = '#ece5bf', '#c9a85a'
def goose(x, y, s, c='#1d4a4a'):
    # 오른쪽으로 나는 기러기: 긴 목·몸통 + 위로 젖힌 날개 두 장
    return (f'<g transform="translate({x} {y}) scale({s})" fill="{c}"><path d="M0 12C10 9 20 8 30 9L44 5 47 7 32 13C24 16 10 16 0 12Z"/>'
            f'<path d="M14 11C14 0 20-10 30-16 27-6 25 2 24 11Z"/><path d="M18 11C12 2 6-4-4-8 2 0 8 6 12 12Z" opacity=".8"/></g>')
def ribbon(d, w, c, o=1):
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" opacity="{o}"/>'
waves = ''.join(f'<path d="M{870 + i * 10} {f(470 + i * 34)}c60-40 120 20 180-10s110-40 170 0 110 30 160-10" fill="none" stroke="{line}" stroke-width="2" opacity="{.9 - i * .12}"/>' for i in range(5))
moon_back = [
  '<rect width="1600" height="900" fill="url(#mgSky)"/>',
  ''.join(f'<circle cx="{random.randint(0, 1600)}" cy="{random.randint(0, 620)}" r="{random.choice([1, 1.4, 2])}" fill="#eaf4e6" opacity="{random.choice([.4, .7, 1])}"/>' for _ in range(110)),
  '<circle cx="1080" cy="400" r="330" fill="url(#mgHalo)"/>',
  f'<circle cx="1080" cy="400" r="250" fill="#d6d9a8" opacity=".88"/>',
  f'<g clip-path="url(#mgMoon)">{waves}<path d="M840 560c80-50 160 30 240-10s140-40 220 10V700H840Z" fill="{cream}"/>'
  f'<path d="M900 600c60-30 120 10 180-10s110-30 170 0" fill="none" stroke="{line}" stroke-width="2.4"/></g>',
  f'<g fill="none" stroke="{line}" stroke-width="2"><path d="M760 40A440 440 0 0 1 760 860" opacity=".8"/><path d="M1400 40A440 440 0 0 0 1400 860" opacity=".8"/></g>',
  ''.join(f'<path d="M{x - 10} {y}a10 10 0 0 0 20 0Z" fill="{line}"/>' for x, y in [(760, 40), (690, 450), (760, 860), (1400, 40), (1470, 450)]),
  goose(850, 420, 1.1, '#2a5a58') + goose(960, 360, 1.4) + goose(1080, 390, 1.2) + goose(1210, 310, 1.5) + goose(1360, 230, 1.0, '#2a5a58'),
  # 왼쪽 흐르는 구름 띠
  ribbon('M-40 160C160 100 260 240 220 380S120 600 360 700', 60, cream, .7),
  ribbon('M-40 160C160 100 260 240 220 380S120 600 360 700', 3, line),
  ribbon('M-60 330C100 300 160 420 120 520S100 760 300 820', 46, '#d9d0a0', .7),
  ''.join(f'<path d="M{x} {y}c-18-4-30 10-22 22 6 10 22 8 26-2 4-12-8-20-16-14" fill="none" stroke="{line}" stroke-width="2.2"/>' for x, y in [(220, 300), (150, 560), (300, 690)]),
  ''.join(f'<g fill="{cream}" stroke="{line}" stroke-width="2"><circle cx="{x}" cy="{y}" r="26"/><circle cx="{x + 30}" cy="{y - 10}" r="30"/><circle cx="{x + 62}" cy="{y}" r="24"/></g>' for x, y in [(90, 250), (120, 480)]),
]
moon_front = [
  f'<path d="M0 900V760c120-60 240 10 360-30s200-70 320-20 220 50 340 0 260-60 400-10 180 40 180 40V900Z" fill="#163c3a"/>',
  f'<path d="M0 760c120-60 240 10 360-30s200-70 320-20 220 50 340 0 260-60 400-10 180 40 180 40" fill="none" stroke="{line}" stroke-width="2.4"/>',
  ''.join(f'<g fill="#e4dcb0" stroke="{line}" stroke-width="2.2"><circle cx="{x}" cy="{y}" r="34"/><circle cx="{x + 40}" cy="{y - 14}" r="40"/><circle cx="{x + 84}" cy="{y}" r="32"/><path d="M{x + 30} {y - 8}c-10-10 6-22 14-12" fill="none"/></g>' for x, y in [(1400, 760), (1290, 800)]),
  f'<path d="M0 900V830c80-30 160 10 260-10s140-50 240-10V900Z" fill="#0d2826"/>',
]
defs = '''<linearGradient id="rcSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f27a64"/><stop offset=".55" stop-color="#d63b3e"/><stop offset="1" stop-color="#7a1424"/></linearGradient>
      <radialGradient id="rcGlow"><stop offset="0" stop-color="#ffd8b8" stop-opacity=".55"/><stop offset="1" stop-color="#ffd8b8" stop-opacity="0"/></radialGradient>
      <linearGradient id="mgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6e6c"/><stop offset=".6" stop-color="#1f4f4e"/><stop offset="1" stop-color="#0e2a2a"/></linearGradient>
      <radialGradient id="mgHalo"><stop offset=".7" stop-color="#e6e9b8" stop-opacity=".25"/><stop offset="1" stop-color="#e6e9b8" stop-opacity="0"/></radialGradient>
      <clipPath id="mgMoon"><circle cx="1080" cy="400" r="250"/></clipPath>'''
json.dump({'defs': defs, 'redcloud': {'back': ''.join(red_back), 'front': ''.join(red_front)}, 'moon': {'back': ''.join(moon_back), 'front': ''.join(moon_front)}},
          open('maps_out.json', 'w'), ensure_ascii=False)
print('ok')
