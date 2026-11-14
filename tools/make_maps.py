"""맵(배경) 26종을 그려 public/maps/<이름>-back.svg(마법진 뒤)와 -front.svg(마법진 앞)로 저장한다.
실행: python3 tools/make_maps.py   (맵 이름은 같은 이름의 배너와 짝. 그 맵에서 10번 이기면 배너가 열린다)"""
import math, random, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from maplib import *

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'maps'
MAPS = {}
def mapdef(name):
    def deco(fn): MAPS[name] = fn; return fn
    return deco

# ---------------------------------------------------------------- 기존 3종
@mapdef('forest')  # 깊은 숲 (처음 만든 배경)
def m_forest(B, F, rnd):
    sky = B.lin('sky', [(0, '#4f7a64'), (.5, '#1f3a2e'), (1, '#08110d')]); sun = B.rad('sun', [(0, '#fff2c4', .7), (1, '#fff2c4', 0)], .3, 0, .6)
    ember = B.rad('ember', [(0, '#ff9a5a', .55), (1, '#ff9a5a', 0)]); b6 = B.blur('b6', 6); b2 = B.blur('b2', 2)
    back = (rect(sky) + rect(sun) + g(rect('#2c4a3c', 300, 0, 40) + rect('#2c4a3c', 560, 0, 26) + rect('#2c4a3c', 1180, 0, 50) + rect('#2c4a3c', 1380, 0, 30), f' filter="{b6}" opacity=".8"')
            + g(path('M820 900 C 860 600, 900 300, 940 0 H1040 C 1010 300, 1040 620, 1120 900 Z', '#15281f') + rect('#15281f', 160, 0, 60), f' filter="{b2}"')
            + circle(980, 760, 120, ember))
    front = g(P('M1600 0 H1300 C 1340 200, 1260 420, 1330 560 C 1380 660, 1500 700, 1600 720 Z') + P('M0 0 H120 C 90 300, 140 560, 60 900 H0 Z')
              + P('M1180 560 C 1240 600, 1300 640, 1420 650 C 1340 680, 1260 690, 1200 720 Z') + P('M0 900 V820 Q500 760 900 800 T1600 790 V900 Z'), ' fill="#060c09"') \
        + g(P('M1300 0 Q1200 160 1240 320') + P('M1380 0 Q1450 180 1400 340') + P('M120 0 Q220 140 180 260'), ' fill="none" stroke="#060c09" stroke-width="4"')
    return back, front

def cloud_bank(cx, cy, w, h, fill, line, n=9, seed=0, lw=2.2):
    """둥근 구름 무더기 (동양화풍): 겹친 원 + 금빛 테두리 + 소용돌이"""
    rnd = random.Random(seed); out = []
    pts = []
    for i in range(n):
        t = i / (n - 1)
        pts.append((cx - w / 2 + t * w + rnd.uniform(-w * .04, w * .04), cy - math.sin(t * math.pi) * h * .55 + rnd.uniform(-h * .08, h * .08), h * (.32 + .22 * math.sin(t * math.pi)) * rnd.uniform(.85, 1.15)))
    for i in range(n + 1): out.append(circle(cx - w / 2 + i * w / n, cy + h * .35, h * .42, fill))
    for x, y, r in pts: out.append(circle(x, y, r, fill, f' stroke="{line}" stroke-width="{lw}"'))
    for x, y, r in pts[1:-1:2]:
        s = r * .45
        out.append(path(f'M{f(x - s)} {f(y + s * .2)}a{f(s)} {f(s)} 0 1 1 {f(s * 1.2)} {f(s * .6)}a{f(s * .6)} {f(s * .6)} 0 1 1-{f(s * .5)}-{f(s * .7)}', 'none', f' stroke="{line}" stroke-width="{lw * .8}" opacity=".85"'))
    return g(''.join(out))

def flower5(x, y, r, c, mid='#c43a2a'):
    return ''.join(circle(x + r * .6 * math.cos(a), y + r * .6 * math.sin(a), r * .45, c) for a in [i * 2 * math.pi / 5 - math.pi / 2 for i in range(5)]) + circle(x, y, r * .25, mid)

@mapdef('redcloud')  # 붉은 상운
def m_redcloud(B, F, rnd):
    gold = '#f0c46a'
    back = (rect(B.lin('sky', [(0, '#f27a64'), (.55, '#d63b3e'), (1, '#7a1424')])) + circle(720, 300, 520, B.rad('glow', [(0, '#ffd8b8', .55), (1, '#ffd8b8', 0)]))
            + g(path('M160 150c90-60 190-40 260 10s160 40 240-30') + path('M200 175c80-30 150-10 210 30') + path('M660 130c20-30 60-30 70 0s-30 40-50 20') + path('M1040 90c60 20 120 0 170-40'), f' fill="none" stroke="{gold}" stroke-width="2.2" stroke-linecap="round" opacity=".9"')
            + flower5(560, 120, 26, '#fbe3c6') + cloud_bank(1300, 260, 640, 260, '#c8283a', gold, 9, 1) + cloud_bank(1460, 170, 360, 180, '#5a1424', gold, 6, 2)
            + cloud_bank(260, 420, 620, 260, '#fbe3c6', gold, 8, 3) + cloud_bank(1250, 520, 560, 260, '#fbe3c6', gold, 8, 4)
            + ''.join(circle(rnd.randint(80, 1520), rnd.randint(60, 820), rnd.choice([1.4, 2, 2.6]), gold, f' opacity="{rnd.choice([.5, .8, 1])}"') for _ in range(70)))
    front = (shade_center(F, '#3a0812', .62) + cloud_bank(240, 760, 760, 300, '#d4313d', gold, 9, 5) + cloud_bank(80, 840, 420, 220, '#4e1020', gold, 6, 6)
             + cloud_bank(1320, 790, 820, 300, '#c42a36', gold, 10, 7) + cloud_bank(800, 900, 900, 200, '#7a1626', gold, 10, 8)
             + flower5(70, 700, 22, '#fbe3c6') + flower5(120, 740, 16, '#fbe3c6') + flower5(40, 760, 14, '#fbe3c6'))
    return back, front

def goose(x, y, s, c='#1d4a4a'):
    return g(P('M0 12C10 9 20 8 30 9L44 5 47 7 32 13C24 16 10 16 0 12Z') + P('M14 11C14 0 20-10 30-16 27-6 25 2 24 11Z') + P('M18 11C12 2 6-4-4-8 2 0 8 6 12 12Z', ' opacity=".8"'),
             f' transform="translate({x} {y}) scale({s})" fill="{c}"')

@mapdef('moongeese')  # 달과 기러기
def m_moongeese(B, F, rnd):
    cream, line = '#ece5bf', '#c9a85a'
    B.items.append('<clipPath id="moongeesemoon"><circle cx="1080" cy="400" r="250"/></clipPath>')
    waves = ''.join(path(f'M{870 + i * 10} {f(470 + i * 34)}c60-40 120 20 180-10s110-40 170 0 110 30 160-10', 'none', f' stroke="{line}" stroke-width="2" opacity="{.9 - i * .12}"') for i in range(5))
    rib = lambda d, w, c, o=1: path(d, 'none', f' stroke="{c}" stroke-width="{w}" stroke-linecap="round" opacity="{o}"')
    back = (rect(B.lin('sky', [(0, '#2f6e6c'), (.6, '#1f4f4e'), (1, '#0e2a2a')])) + stars(rnd, 110, '#eaf4e6', 0, 620)
            + circle(1080, 400, 330, B.rad('halo', [(.7, '#e6e9b8', .25), (1, '#e6e9b8', 0)])) + circle(1080, 400, 250, '#d6d9a8', ' opacity=".88"')
            + g(waves + path('M840 560c80-50 160 30 240-10s140-40 220 10V700H840Z', cream) + path('M900 600c60-30 120 10 180-10s110-30 170 0', 'none', f' stroke="{line}" stroke-width="2.4"'), ' clip-path="url(#moongeesemoon)"')
            + g(path('M760 40A440 440 0 0 1 760 860', extra=' opacity=".8"') + path('M1400 40A440 440 0 0 0 1400 860', extra=' opacity=".8"'), f' fill="none" stroke="{line}" stroke-width="2"')
            + ''.join(path(f'M{x - 10} {y}a10 10 0 0 0 20 0Z', line) for x, y in [(760, 40), (690, 450), (760, 860), (1400, 40), (1470, 450)])
            + goose(850, 420, 1.1, '#2a5a58') + goose(960, 360, 1.4) + goose(1080, 390, 1.2) + goose(1210, 310, 1.5) + goose(1360, 230, 1.0, '#2a5a58')
            + rib('M-40 160C160 100 260 240 220 380S120 600 360 700', 60, cream, .7) + rib('M-40 160C160 100 260 240 220 380S120 600 360 700', 3, line)
            + rib('M-60 330C100 300 160 420 120 520S100 760 300 820', 46, '#d9d0a0', .7)
            + ''.join(path(f'M{x} {y}c-18-4-30 10-22 22 6 10 22 8 26-2 4-12-8-20-16-14', 'none', f' stroke="{line}" stroke-width="2.2"') for x, y in [(220, 300), (150, 560), (300, 690)])
            + ''.join(g(circle(x, y, 26, cream) + circle(x + 30, y - 10, 30, cream) + circle(x + 62, y, 24, cream), f' stroke="{line}" stroke-width="2"') for x, y in [(90, 250), (120, 480)]))
    front = (shade_center(F, '#06201f', .5) + path('M0 900V760c120-60 240 10 360-30s200-70 320-20 220 50 340 0 260-60 400-10 180 40 180 40V900Z', '#163c3a')
             + path('M0 760c120-60 240 10 360-30s200-70 320-20 220 50 340 0 260-60 400-10 180 40 180 40', 'none', f' stroke="{line}" stroke-width="2.4"')
             + ''.join(g(circle(x, y, 34, '#e4dcb0') + circle(x + 40, y - 14, 40, '#e4dcb0') + circle(x + 84, y, 32, '#e4dcb0'), f' stroke="{line}" stroke-width="2.2"') for x, y in [(1400, 760), (1290, 800)])
             + path('M0 900V830c80-30 160 10 260-10s140-50 240-10V900Z', '#0d2826'))
    return back, front

# ---------------------------------------------------------------- 기존 배너의 맵 10종
@mapdef('dusk')  # 노을 궁궐: 노을빛 하늘, 진주 달, 궁궐 지붕, 흩날리는 깃털
def m_dusk(B, F, rnd):
    roof = '#3a1a26'
    back = (rect(B.lin('sky', [(0, '#2a0d18'), (.45, '#6b3446'), (.8, '#c98a8a'), (1, '#e9c2b4')])) + stars(rnd, 50, '#f3d9d2', 0, 380)
            + circle(1120, 300, 210, B.rad('pearlglow', [(0, '#ffe2e6', .6), (1, '#ffe2e6', 0)])) + circle(1120, 300, 110, B.rad('pearl', [(0, '#fff'), (.5, '#f3b9c8'), (1, '#9c4a62')], .35, .35, .7))
            + path('M980 330c50 40 230 40 280 0', 'none', ' stroke="#e9d3c6" stroke-width="3" opacity=".8"')
            + g(''.join(cloud(x, y, w, 70, '#e9c2c0', rnd) for x, y, w in [(300, 470, 420), (1350, 520, 380), (820, 560, 300)]), ' opacity=".45"')
            + g(pagoda(260, 690, 300, 260, '#5a2a3a', 3, '#f3b9a0') + pagoda(1340, 700, 360, 300, '#5a2a3a', 3, '#f3b9a0') + pagoda(760, 720, 200, 150, '#6a3446', 2), ' opacity=".85"')
            + silhouette_city(-20, 1620, 760, '#4a2030', rnd, 30, 90, 60, 140, .15)
            + ''.join(leaf(rnd.uniform(100, 1500), rnd.uniform(120, 700), rnd.uniform(14, 24), 4, rnd.uniform(0, 6.28), '#f6e3dc', ' opacity=".75"') for _ in range(26)))
    front = (shade_center(F, '#1e0710', .5)
             + path('M-20 0H520Q420 40 360 90Q300 60 240 110Q160 70 80 120Q30 80-20 110Z', roof) + path('M1620 0H1080Q1180 40 1240 90Q1300 60 1360 110Q1440 70 1520 120Q1570 80 1620 110Z', roof)
             + rect(roof, -20, 830, 1640, 90) + ''.join(rect(roof, x, 780, 8, 52) for x in range(0, 1600, 36)) + rect(roof, -20, 772, 1640, 10) + rect(roof, -20, 806, 1640, 5)
             + path('M60 30c40 30 40 70 0 90', 'none', ' stroke="#e9d3c6" stroke-width="2"') + path('M1540 30c-40 30-40 70 0 90', 'none', ' stroke="#e9d3c6" stroke-width="2"'))
    return back, front

@mapdef('gold')  # 금빛 운해: 금빛 사막 하늘, 먼 탑, 청록 소용돌이 띠, 해 구슬
def m_gold(B, F, rnd):
    teal = '#5fd6cc'
    back = (rect(B.lin('sky', [(0, '#5a3a12'), (.35, '#b8873c'), (.7, '#f2d58e'), (1, '#e8c27a')])) + circle(1180, 260, 420, B.rad('glow', [(0, '#fff3cf', .7), (1, '#fff3cf', 0)]))
            + circle(1180, 260, 70, '#fff1c4') + circle(1180, 260, 90, 'none', ' stroke="#f0b45c" stroke-width="3" opacity=".7"')
            + g(pagoda(320, 640, 150, 260, '#a8783a', 4) + pagoda(500, 650, 110, 180, '#a8783a', 3) + pagoda(1320, 660, 140, 220, '#a8783a', 4), ' opacity=".55"')
            + ''.join(path(wavy(-20, y, 1620, 18, 8, rnd), 'none', f' stroke="#fff3cf" stroke-width="2" opacity=".35"') for y in (420, 470, 540))
            + path(wavy(-20, 640, 1620, 30, 9, rnd) + 'V920H-20Z', '#c99a4a') + path(wavy(-20, 700, 1620, 26, 9, rnd) + 'V920H-20Z', '#a87a34')
            + g(path('M-40 300C200 200 380 360 620 260S960 160 1100 300', 'none', f' stroke="{teal}" stroke-width="16" stroke-linecap="round" opacity=".55"')
                + path('M-40 300C200 200 380 360 620 260S960 160 1100 300', 'none', ' stroke="#e6fffb" stroke-width="2" opacity=".8"')))
    front = (shade_center(F, '#2a1a06', .5)
             + path('M-20 920V760C140 700 260 780 420 740S700 700 820 780 1100 720 1260 760 1480 700 1620 740V920Z', '#3a2a10')
             + g(path('M-40 860C120 760 260 860 400 800', 'none', f' stroke="{teal}" stroke-width="28" stroke-linecap="round"') + path('M1640 820C1460 720 1320 840 1160 780', 'none', f' stroke="{teal}" stroke-width="28" stroke-linecap="round"')
                + path('M-40 860C120 760 260 860 400 800', 'none', ' stroke="#f4dc9a" stroke-width="3"') + path('M1640 820C1460 720 1320 840 1160 780', 'none', ' stroke="#f4dc9a" stroke-width="3"'))
             + path('M40 80C10 140 60 200 120 180', 'none', f' stroke="{teal}" stroke-width="10" stroke-linecap="round"') + path('M1560 80C1590 140 1540 200 1480 180', 'none', f' stroke="{teal}" stroke-width="10" stroke-linecap="round"')
             + sparkle(110, 60, 18, '#fff3cf') + sparkle(1490, 60, 18, '#fff3cf') + circle(1450, 740, 18, '#f0b45c'))
    return back, front

def sakura(x, y, r, fill, rot=0, mid='#b9b2ee'):
    petals = ''.join(P('M0 0C-4.5-4-4.5-10-1.6-12.4L0-10.6 1.6-12.4C4.5-10 4.5-4 0 0Z', f' transform="rotate({a})"') for a in (0, 72, 144, 216, 288))
    return g(petals + circle(0, 0, 1.8, mid), f' transform="translate({f(x)} {f(y)}) rotate({rot}) scale({f(r / 12)})" fill="{fill}"')

@mapdef('sakura')  # 벚꽃 물방울: 남보랏빛 밤, 큰 물방울, 벚꽃 송이와 꽃잎
def m_sakura(B, F, rnd):
    back = (rect(B.lin('sky', [(0, '#151330'), (.6, '#2a2752'), (1, '#3b3770')])) + stars(rnd, 70, '#e9e6ff', 0, 700)
            + ''.join(circle(x, y, r, '#cfcaff', f' opacity="{o}"') + circle(x - r * .3, y - r * .3, r * .25, '#fff', f' opacity="{o * .8}"') for x, y, r, o in [(260, 260, 90, .18), (1340, 340, 130, .16), (720, 160, 50, .2), (1100, 640, 70, .18), (420, 640, 40, .22)])
            + ''.join(sakura(rnd.uniform(0, 1600), rnd.uniform(0, 850), rnd.uniform(6, 12), rnd.choice(['#ffffff', '#dcdcff', '#cfcaff']), rnd.uniform(0, 360)) for _ in range(40)))
    cl = lambda x, y, s: sakura(x, y, 60 * s, '#ffffff', 10) + sakura(x + 70 * s, y + 40 * s, 44 * s, '#d9d6ff', -20) + sakura(x - 30 * s, y + 60 * s, 30 * s, '#e9e6ff', 30)
    front = (shade_center(F, '#0c0a20', .45)
             + cl(80, 120, 1.4) + cl(1500, 760, 1.5) + cl(1480, 110, .9) + cl(110, 760, 1.0)
             + ''.join(circle(x, y, r, '#dcdcff', ' opacity=".85"') for x, y, r in [(220, 70, 16), (250, 110, 8), (1380, 820, 20), (1340, 860, 9), (60, 640, 12), (1560, 260, 10)]))
    return back, front

def rose(x, y, r):
    return g(circle(0, 0, 5, '#f1d2ff') + path('M0 0c1.2-1.2 2.6 0 2 1.5-1 2-3.8 1.5-4.2-.8-.5-3 2.8-4.7 5.2-3.2', 'none', ' stroke="#a46ad8" stroke-width="1"'), f' transform="translate({f(x)} {f(y)}) scale({f(r / 5)})"')
def crescent(x, y, r, c='#c9a7ff'):
    return path('M4 -9A10 10 0 1 0 4 9 7.5 7.5 0 1 1 4 -9Z', c, f' transform="translate({f(x)} {f(y)}) scale({f(r / 10)})"')

def rose_vine(x, top, l, rnd, scale=1):
    out = [hang(x, top, l, '#8f7ae0', 3 * scale, rnd)]
    for i in range(int(l / 40)):
        y = top + 20 + i * 40 * rnd.uniform(.85, 1.1); xx = x + rnd.uniform(-12, 12)
        out.append(leaf(xx, y, 22 * scale, 7 * scale, rnd.choice([.4, 2.7]), '#b9a2ee'))
        if rnd.random() < .45: out.append(rose(xx, y, 14 * scale))
    return ''.join(out)

@mapdef('rosechain')  # 장미 사슬: 남색 밤 격자, 위에서 늘어진 장미 덩굴, 사슬에 매달린 달과 별
def m_rosechain(B, F, rnd):
    grid = ''.join(path(f'M{x} 0V900', 'none', ' stroke="#8f7ae0" stroke-width="1" opacity=".12"') for x in range(0, 1600, 60)) + ''.join(path(f'M0 {y}H1600', 'none', ' stroke="#8f7ae0" stroke-width="1" opacity=".12"') for y in range(0, 900, 60))
    back = (rect(B.lin('sky', [(0, '#1d1940'), (1, '#0c0a20')])) + grid + stars(rnd, 60, '#d6c2ff')
            + circle(800, 420, 380, B.rad('glow', [(0, '#a46ad8', .28), (1, '#a46ad8', 0)]))
            + ''.join(leaf(rnd.uniform(0, 1600), rnd.uniform(100, 880), 10, 3, rnd.uniform(0, 6.28), '#b9a2ee', ' opacity=".5"') for _ in range(30)))
    chains = ''.join(path(f'M{x} 0V{l}', 'none', ' stroke="#d6c2ff" stroke-width="1.6" stroke-dasharray="2 6"') + (crescent(x, l + 16, 18) if i % 2 else sparkle(x, l + 12, 12, '#fff')) for i, (x, l) in enumerate([(300, 260), (420, 180), (1180, 300), (1300, 200), (1420, 340)]))
    front = (shade_center(F, '#0a0820', .4) + path('M-20 10Q400 70 800 20T1620 30', 'none', ' stroke="#d6c2ff" stroke-width="2" stroke-dasharray="2 8"')
             + g(''.join(rose_vine(x, -10, l, rnd, 1.3) for x, l in [(60, 600), (150, 380), (240, 480), (1360, 420), (1460, 620), (1540, 360)]), ' style="filter:drop-shadow(0 0 6px #c58cff)"')
             + chains)
    return back, front

@mapdef('violet')  # 천상의 제비꽃: 보랏빛 밤하늘, 별자리, 선으로 그린 큰 꽃, 인장
def m_violet(B, F, rnd):
    pts = [(rnd.uniform(200, 1400), rnd.uniform(60, 400)) for _ in range(9)]
    constel = ''.join(path(f'M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}', 'none', ' stroke="#e2dbff" stroke-width="1" opacity=".45"') for a, b in zip(pts, pts[1:])) + ''.join(sparkle(x, y, 6, '#fff') for x, y in pts)
    flower = lambda x, y, s: g(path('M0 60c-4-30 4-50 20-60') + path('M20 0c-24-24-56-8-48 16 8 20 36 12 48-16z') + path('M20 0c8-32 40-32 44-8 0 20-28 24-44 8z') + path('M20 0c32 0 40 28 20 40-16 8-28-12-20-40z') + circle(20, 0, 4, 'none'),
                                f' transform="translate({x} {y}) scale({s})" fill="none" stroke="#ffffff" stroke-width="2" opacity=".75"')
    back = (rect(B.lin('sky', [(0, '#1f1a3a'), (.6, '#4b3c8a'), (1, '#a995f5')])) + stars(rnd, 120, '#ffffff', 0, 760) + constel
            + rect(B.lin('horizon', [(0, '#e2dbff', 0), (1, '#e2dbff', .45)]), 0, 600, 1600, 300)
            + circle(800, 900, 520, B.rad('glow', [(0, '#f2c6ee', .4), (1, '#f2c6ee', 0)])))
    front = (shade_center(F, '#140f2e', .45) + flower(40, 620, 3.2) + flower(1360, 120, 2.4)
             + g(circle(0, 0, 70, '#2b2350') + circle(0, 0, 70, 'none', ' stroke="#f2c6ee" stroke-width="3"') + path('M0-50V50M-50 0H50', 'none', ' stroke="#f2c6ee" stroke-width="2.4"') + circle(0, 0, 40, 'none', ' stroke="#f2c6ee" stroke-width="1.6" stroke-dasharray="3 5"'), ' transform="translate(1460 760)"')
             + sparkle(1300, 640, 22, '#f2c6ee') + sparkle(200, 120, 18, '#fff') + sparkle(1560, 420, 12, '#fff'))
    return back, front

@mapdef('cover')  # 아르카나 표지: 잿빛 판, 큰 글자, 붉은 면, 경고 줄무늬, 테두리 장식
def m_cover(B, F, rnd):
    back = (rect('#2a2a30') + rect('#ececef', 0, 0, 900, 900) + rect('#c4283c', 900, 0, 700, 900)
            + f'<text x="-20" y="860" font-family="Impact, \'Arial Narrow\', sans-serif" font-size="760" font-weight="700" fill="none" stroke="#c4283c" stroke-width="3" opacity=".5" letter-spacing="-20">AR</text>'
            + f'<text x="900" y="860" font-family="Impact, \'Arial Narrow\', sans-serif" font-size="760" font-weight="700" fill="#b0202f" opacity=".6" letter-spacing="-20">CA</text>'
            + ''.join(path(f'M{x} 900L{x + 200} 0', 'none', ' stroke="#ffffff" stroke-width="1" opacity=".08"') for x in range(900, 1700, 40)))
    hud = '#3a3a42'
    front = (shade_center(F, '#101014', .45)
             + rect('none', 40, 40, 1520, 820, f' stroke="{hud}" stroke-width="3"') + rect(hud, 40, 40, 300, 8) + rect(hud, 1260, 852, 300, 8)
             + ''.join(path(f'M{1380 + i * 22} 70l-14 26', 'none', ' stroke="#fff" stroke-width="7"') for i in range(6))
             + ''.join(rect('#1d1d22', 70 + i * 9, 790, 4 if i % 3 else 6, 40) for i in range(22))
             + f'<text x="70" y="110" font-family="Impact, sans-serif" font-size="56" fill="{hud}">#000</text><text x="70" y="140" font-family="sans-serif" font-size="16" fill="{hud}" letter-spacing="4">ARCANA OPERATOR ENTRY</text>'
             + rect('#c4283c', 40, 400, 12, 120) + rect('#ececef', 1548, 300, 12, 120))
    return back, front

@mapdef('planet')  # 행성 고리: 짙은 우주, 보랏빛 성운, 빛 고리를 두른 블랙홀(사진) — 빛 번짐이 숨 쉬듯, 별이 반짝
def m_planet(B, F, rnd):
    neb = lambda x, y, w, h, c, o: path(f'M{x} {y}c{w * .3}-{h} {w * .7}-{h * .2} {w} 0s-{w * .2} {h} -{w * .5} {h * .6}-{w * .6}-{h * .1}-{w * .5}-{h * .6}z', c, f' opacity="{o}"')
    back = (rect(B.lin('sky', [(0, '#0c0b1a'), (.6, '#14123a'), (1, '#1c1a48')])) + twinkles(rnd, 160, '#c8d0ff', 0, 900)
            + g(neb(100, 300, 500, 200, '#6a4ad8', .22) + neb(200, 700, 600, 220, '#4b5fd6', .2) + neb(1100, 120, 400, 160, '#e08ad8', .16), f' filter="{B.blur("nb", 34)}"')
            + circle(1150, 420, 300, B.rad('glow', [(0, '#ff8af0', .5), (.5, '#8a4ae0', .2), (1, '#8a4ae0', 0)]), anim('opacity', '.65;1;.65', 9))
            + '<mask id="planet-fade"><rect width="1600" height="900" fill="url(#planet-edge)"/></mask>'
            + g(img_tag('blackhole.jpg', 600, 60, 1100, 762), ' mask="url(#planet-fade)" style="mix-blend-mode:screen"'))
    B.rad('edge', [(0, '#fff'), (.35, '#fff'), (.66, '#000')], .72, .5, .5)  # 사진 가장자리를 부드럽게 지운다
    front = (shade_center(F, '#06051a', .5)
             + ''.join(neb(x, y, w, h, '#8a6ad8', .5) for x, y, w, h in [(1380, 840, 300, 70), (-40, 860, 340, 70), (-20, 80, 220, 60)])
             + falling(rnd, 5, '#fff7c8', 'star', 0, 1600, 16))
    return back, front

def m_planet(B, F, rnd):
    neb = lambda x, y, w, h, c, o: path(f'M{x} {y}c{w * .3}-{h} {w * .7}-{h * .2} {w} 0s-{w * .2} {h} -{w * .5} {h * .6}-{w * .6}-{h * .1}-{w * .5}-{h * .6}z', c, f' opacity="{o}"')
    back = (rect(B.lin('sky', [(0, '#14153a'), (1, '#2a2b5a')])) + stars(rnd, 180, '#e6e6ff', 0, 900)
            + g(neb(900, 300, 500, 200, '#b48cf0', .25) + neb(1100, 600, 600, 240, '#7f6ad8', .22) + neb(700, 700, 400, 160, '#e08ad8', .18), f' filter="{B.blur("nb", 30)}"')
            + circle(1240, 380, 330, B.rad('pglow', [(0, '#b48cf0', .4), (1, '#b48cf0', 0)]))
            + path('M940 470A300 70 -20 0 1 1540 290', 'none', ' stroke="#7fd8ff" stroke-width="22" opacity=".6"')
            + circle(1240, 380, 200, B.rad('planet', [(0, '#ffe0f4'), (.35, '#b48cf0'), (.75, '#4b5fd6'), (1, '#2a2b6a')], .35, .3, .75))
            + path('M940 470A300 70 -20 0 0 1540 290', 'none', ' stroke="#9fe8ff" stroke-width="24" stroke-linecap="round"')
            + sparkle(1080, 200, 26, '#fff7b0') + sparkle(1300, 300, 8, '#fff'))
    front = (shade_center(F, '#0a0b24', .5)
             + ''.join(neb(x, y, w, h, '#b48cf0', .85) for x, y, w, h in [(1400, 820, 260, 70), (1460, 760, 180, 50), (40, 120, 200, 60), (-20, 840, 300, 80), (1500, 120, 140, 40)])
             + path('M80 820l40-60 10 40 50-30-30 50z', '#fff7b0') + sparkle(160, 660, 10, '#fff') + sparkle(1520, 560, 14, '#fff'))
    return back, front

def crow(x, y, s):
    return path('M0 0C3-3 6-3 8-1L12-6 11 0C14 0 16 1 18 3 14 2 10 3 8 5 6 3 3 2 0 0Z', '#d8264a', f' transform="translate({x} {y}) scale({s})"')

@mapdef('crow')  # 붉은 까마귀: 검붉은 대리석, 붉은 나뭇가지와 까마귀, 사선과 초승달, 마름모 무늬
def m_crow(B, F, rnd):
    marble = ''.join(path(wavy(-20, y, 1620, 40, 7, rnd), 'none', f' stroke="#7a1626" stroke-width="{rnd.uniform(1, 3)}" opacity="{rnd.uniform(.2, .5)}"') for y in range(80, 900, 70))
    back = (rect(B.lin('sky', [(0, '#0d0d10'), (.5, '#24090f'), (1, '#4a0f1c')], 1, 1)) + g(marble, f' filter="{B.blur("mb", 3)}"')
            + circle(1100, 300, 360, B.rad('glow', [(0, '#8e1c2c', .45), (1, '#8e1c2c', 0)]))
            + path('M380 860L1260 60', 'none', ' stroke="#f2f2f2" stroke-width="2"') + circle(820, 460, 26, 'none', ' stroke="#f2f2f2" stroke-width="2"') + crescent(820, 460, 14, '#f2f2f2'))
    tree = ''.join(branches(1640, 520, math.pi + .3, 240, 22, 6, '#d8264a', rnd, .55)) + ''.join(branches(1640, 160, math.pi + .1, 200, 16, 5, '#d8264a', rnd, .5))
    front = (shade_center(F, '#0a0306', .5) + tree
             + ''.join(crow(x, y, s) for x, y, s in [(1180, 120, 4), (1290, 70, 3), (1080, 200, 2.6), (1400, 210, 3.4), (980, 90, 2)])
             + ''.join(path(f'M{x} {y - 26}l26 26-26 26-26-26z', '#c9ccd4' if (i * 7) % 3 else '#7a7f8c', ' opacity=".8"') for i, (x, y) in enumerate((60 + c * 52, 640 + r * 52 + (c % 2) * 26) for c in range(5) for r in range(4)))
             + ''.join(path(f'M{120 + i * 26} 90l-16 30', 'none', ' stroke="#d8264a" stroke-width="7"') for i in range(6)) + sparkle(110, 200, 12, '#fff') + sparkle(150, 230, 7, '#fff'))
    return back, front

@mapdef('curtain')  # 진홍 무대: 자줏빛 마름모 벽, 위 커튼 주름과 술, 옆 커튼, 금빛 틀과 날개
def m_curtain(B, F, rnd):
    dia = ''.join(path(f'M{x} {y}l40 40-40 40-40-40z', 'none', ' stroke="#4a1a32" stroke-width="2"') for x in range(0, 1680, 80) for y in range(-40, 940, 80))
    back = (rect(B.rad('wall', [(0, '#4a1a30'), (1, '#1e0a14')], .5, .45, .8)) + dia + circle(800, 470, 420, B.rad('spot', [(0, '#ffd8b8', .18), (1, '#ffd8b8', 0)]))
            + rect('none', 240, 170, 1120, 560, ' stroke="#c9a04e" stroke-width="6" rx="6"') + rect('none', 256, 186, 1088, 528, ' stroke="#e9c27a" stroke-width="2" rx="4"')
            + ''.join(sparkle(x, y, 10, '#e9c27a', .8) for x, y in [(180, 300), (1420, 280), (1460, 640), (150, 680)]))
    wing = lambda x, y, s: g(P('M0 0c-30-6-60-2-84-20 22 2 40 0 54-8-16-2-30-6-40-14 30 2 54 10 70 42z') + P('M0 0c30-6 60-2 84-20-22 2-40 0-54-8 16-2 30-6 40-14-30 2-54 10-70 42z') + path('M0-14l8 14-8 14-8-14z', '#e9c27a'),
                             f' transform="translate({x} {y}) scale({s})" fill="#f6e3cf"')
    swag = 'M-20 0H1620V40' + ''.join(f'Q{1620 - i * 180 - 90} 150 {1620 - (i + 1) * 180} 40' for i in range(9)) + 'Z'
    front = (path(swag, '#8e1f3d') + path(swag.replace('150', '120'), '#a8284a', ' opacity=".6"')
             + ''.join(circle(1620 - i * 180, 44, 7, '#e9c27a') + path(f'M{1620 - i * 180} 50v40', 'none', ' stroke="#e9c27a" stroke-width="4"') + path(f'M{1610 - i * 180} 90h20l-6 22h-8z', '#e9c27a') for i in range(10))
             + path('M-20 0H170C130 300 190 600 120 920H-20Z', '#6e1630') + path('M1620 0H1430C1470 300 1410 600 1480 920H1620Z', '#6e1630')
             + ''.join(path(f'M{x} 0C{x + 10} 300 {x - 20} 600 {x + 5} 920', 'none', ' stroke="#4a0e22" stroke-width="3"') for x in (40, 90, 1500, 1550))
             + wing(800, 170, 1.4) + wing(800, 730, 1.1) + shade_center(F, '#12040a', .35))
    return back, front

@mapdef('butterfly')  # 나비 격자: 연분홍 모눈종이, 붉은 물결 띠, 체크무늬, 나비·벚꽃·화살표
def m_butterfly(B, F, rnd):
    grid = ''.join(path(f'M{x} 0V900', 'none', ' stroke="#e8899a" stroke-width="1.6" opacity=".55"') for x in range(0, 1600, 56)) + ''.join(path(f'M0 {y}H1600', 'none', ' stroke="#e8899a" stroke-width="1.6" opacity=".55"') for y in range(0, 900, 56))
    bfly = lambda x, y, s, c: path('M0 0C-3-8-12-10-12-3-12 1-7 2-3 1-8 3-9 8-5 9-2 9 0 4 0 0 0 4 2 9 5 9 9 8 8 3 3 1 7 2 12 1 12-3 12-10 3-8 0 0Z', c, f' transform="translate({x} {y}) scale({s})"')
    back = (rect('#fbe6da') + grid + rect(B.lin('diag', [(0, '#ffffff', .0), (.5, '#ffffff', .35), (1, '#ffffff', 0)], 1, 1), 0, 0, 1600, 900)
            + path('M-20 120C300 40 600 220 900 140S1400 40 1620 120V-20H-20Z', '#c2244a', ' opacity=".85"') + path('M-20 820C300 740 600 900 900 800S1400 720 1620 780V920H-20Z', '#c2244a', ' opacity=".85"')
            + ''.join(rect('#8e1030' if (c + r) % 2 else '#e8899a', 1600 - 48 * (c + 1), 48 * r, 48, 48, ' opacity=".55"') for c in range(5) for r in range(3)))
    front = (sakura(170, 760, 70, '#b8183f', 12) + sakura(1460, 120, 50, '#b8183f', -10) + bfly(1180, 300, 7, '#c2244a') + bfly(300, 220, 4, '#c2244a') + bfly(1400, 640, 3, '#8e1030')
             + ''.join(path(f'M{620 + i * 40} 700l26 22-26 22', 'none', ' stroke="#c2244a" stroke-width="9" stroke-linejoin="round"') for i in range(3))
             + rect('none', 760, 692, 300, 60, ' rx="30" stroke="#c2244a" stroke-width="6"')
             + g(rect('#c2244a', 0, 0, 90, 76, ' rx="16"') + path('M45 60 24 40a12 12 0 0 1 21-14 12 12 0 0 1 21 14z', '#fff'), ' transform="translate(1440 380)"')
             + path('M120 420c40-60 120-40 120 20s-80 60-90 10', 'none', ' stroke="#c2244a" stroke-width="5"') + path('M150 470l-12 22 26-6', 'none', ' stroke="#c2244a" stroke-width="5"')
             + shade_center(F, '#5a0a20', .3))
    return back, front

# ---------------------------------------------------------------- 새 배너·맵 10종
@mapdef('thicket')  # 분홍 덤불: 남색 밤숲, 늘어진 덩굴, 분홍빛으로 빛나는 풀
def m_thicket(B, F, rnd):
    back = (rect(B.lin('sky', [(0, '#1c2140'), (.5, '#2e3560'), (1, '#1a1838')])) + circle(820, 300, 360, B.rad('glow', [(0, '#7f8ac8', .5), (1, '#7f8ac8', 0)]))
            + ''.join(trunk(x, 900, 900, w, c) for x, w, c in [(560, 30, '#3a4270'), (760, 22, '#465082'), (1000, 28, '#3a4270'), (1180, 20, '#465082')])
            + ''.join(trunk(x, 920, 940, w, '#232848') for x, w in [(380, 50), (1320, 60)])
            + ''.join(hang(rnd.uniform(300, 1300), -10, rnd.uniform(200, 520), '#141832', 3, rnd) for _ in range(16))
            + ground(720, '#22284a', rnd, 20, 8))
    pink = '#ff6ab0'
    glow = circle(560, 760, 260, B.rad('pg', [(0, '#ff5aa8', .45), (1, '#ff5aa8', 0)])) + circle(1100, 780, 200, B.rad('pg2', [(0, '#ff5aa8', .35), (1, '#ff5aa8', 0)]))
    back += glow + ''.join(fern(x, 800, rnd.uniform(60, 120), -math.pi / 2 + rnd.uniform(-.6, .6), rnd.choice([pink, '#ff8cc6', '#d84a96']), rnd, 7) for x in [rnd.uniform(380, 1260) for _ in range(18)])
    front = (shade_center(F, '#0a0c1e', .4) + path('M-20 920V700C80 640 180 700 260 660S420 760 520 920Z', '#0d0f22') + path('M1620 920V640C1520 600 1420 700 1340 680S1200 820 1120 920Z', '#0d0f22')
             + ''.join(fern(x, 920, rnd.uniform(140, 220), -math.pi / 2 + s * rnd.uniform(.3, .9), '#0a0b1a', rnd, 9) for x, s in [(60, 1), (200, -1), (1420, -1), (1540, 1), (1300, 1)])
             + path('M-20 -20H400C340 80 200 120 80 260 30 320-20 300-20 300Z', '#0d0f22') + path('M1620 -20H1180C1260 80 1420 140 1520 260 1580 330 1620 300 1620 300Z', '#0d0f22')
             + ''.join(hang(x, 0, l, '#0a0b1a', 4, rnd) for x, l in [(120, 380), (200, 260), (1420, 300), (1500, 420)]))
    return back, front

@mapdef('firefly')  # 반딧불 숲: 청록 밤숲, 굵은 나무 사이로 새는 빛, 반딧불
def m_firefly(B, F, rnd):
    back = (rect(B.lin('sky', [(0, '#1b3a44'), (.55, '#2f6070'), (1, '#183038')])) + circle(800, 560, 420, B.rad('glow', [(0, '#cfeee8', .7), (.4, '#8fc8c8', .3), (1, '#8fc8c8', 0)]))
            + ''.join(trunk(x, 900, 900, w, '#3f6a72', lean=rnd.uniform(-20, 20)) for x, w in [(520, 18), (680, 12), (940, 16), (1100, 14)])
            + ''.join(canopy(x, y, 160, 80, '#2a4e58', rnd, 10) for x, y in [(500, 120), (1100, 100), (800, 60)])
            + ground(700, '#24484e', rnd, 14, 9) + bush(620, 720, 220, 70, '#3a6a5a', rnd) + bush(1020, 720, 260, 80, '#3a6a5a', rnd)
            + rect('#f4f0b0', 700, 690, 200, 10, ' rx="5" opacity=".5"'))
    front = (shade_center(F, '#071618', .35)
             + trunk(160, 940, 980, 70, '#0f2228', 30) + trunk(1460, 940, 980, 80, '#0f2228', -40) + trunk(300, 940, 600, 26, '#132a30', -10)
             + ''.join(branches(170, 300, -.6, 200, 20, 4, '#0f2228', rnd, .5)) + ''.join(branches(1440, 260, math.pi + .6, 220, 22, 4, '#0f2228', rnd, .5))
             + canopy(80, 40, 320, 140, '#0c1c22', rnd, 16) + canopy(1520, 40, 340, 150, '#0c1c22', rnd, 16)
             + ''.join(leaf(x, 920, rnd.uniform(90, 160), 22, -math.pi / 2 + rnd.uniform(-.8, .8), '#0b1a1e') for x in list(range(0, 500, 40)) + list(range(1100, 1640, 40)))
             + glowdots(rnd, 70, ['#f6e27a', '#9fd8ff', '#f6e27a'], (100, 200, 1500, 880), 2.6))
    return back, front

@mapdef('swamp')  # 보랏빛 늪: 보랏빛 노을, 뒤틀린 앙상한 나무, 기울어진 문, 물 위 나무길, 부들
def m_swamp(B, F, rnd):
    water = B.lin('water', [(0, '#c9a6e8'), (.4, '#7a5cb0'), (1, '#3a2a60')])
    back = (rect(B.lin('sky', [(0, '#3a2a5a'), (.5, '#8a6aa8'), (1, '#e0c0e0')])) + circle(800, 520, 300, B.rad('glow', [(0, '#ffe0f4', .7), (1, '#ffe0f4', 0)]))
            + silhouette_city(560, 1060, 560, '#6a5090', rnd, 40, 160, 30, 60, .5, '#ffe6a0')
            + pagoda(820, 560, 200, 220, '#5a4080', 3, '#ffd8a0') + rect('#f6eaff', 900, 300, 26, 260, ' opacity=".6"') + rect('#f6eaff', 930, 300, 10, 260, ' opacity=".4"')
            + rect(water, 0, 560, 1600, 340) + ''.join(rect('#f0dcff', rnd.uniform(200, 1400), rnd.uniform(580, 760), rnd.uniform(60, 220), 2, ' opacity=".5"') for _ in range(30))
            + ''.join(bare_tree(x, 600, h, w, '#4a3670', rnd, 5, rnd.uniform(-30, 30)) for x, h, w in [(260, 420, 34), (1300, 460, 40), (520, 300, 20), (1100, 320, 22)]))
    gate = g(rect('#2a1e40', -70, -260, 30, 300) + rect('#2a1e40', 40, -260, 30, 300) + path('M-110-260H110L90-300H-90Z', '#2a1e40') + rect('#2a1e40', -80, -220, 160, 18), ' transform="translate(380 720) rotate(-18)"')
    front = (shade_center(F, '#140c24', .35) + gate
             + ''.join(rect('#3a2a50', x, 780 + (x % 3) * 2, 34, 18, ' rx="3"') for x in range(-20, 1640, 38)) + rect('#2a1e3a', -20, 798, 1660, 6)
             + ''.join(path(f'M{x} 920Q{x + rnd.uniform(-10, 10)} 760 {x + rnd.uniform(-20, 20)} {rnd.uniform(620, 700)}', 'none', ' stroke="#1e1430" stroke-width="3"') + rect('#1e1430', x - 6 + rnd.uniform(-20, 20), rnd.uniform(620, 690), 12, 46, ' rx="6"') for x in [rnd.uniform(1300, 1600) for _ in range(8)] + [rnd.uniform(0, 200) for _ in range(5)])
             + trunk(80, 940, 960, 70, '#24183a', 40) + ''.join(branches(100, 200, -.5, 220, 22, 5, '#24183a', rnd, .5))
             + trunk(1540, 940, 960, 60, '#24183a', -40) + ''.join(branches(1500, 180, math.pi + .5, 220, 20, 5, '#24183a', rnd, .5))
             + glowdots(rnd, 24, ['#ffe6a0'], (300, 560, 1300, 760), 2))
    return back, front

@mapdef('waterfall')  # 분홍 폭포: 분홍 안개, 가운데 빛나는 폭포, 양옆 거대한 뿌리, 늘어진 덩굴
def m_waterfall(B, F, rnd):
    back = (rect(B.lin('sky', [(0, '#5a3a8a'), (.5, '#c86aa8'), (1, '#e48aa8')])) + circle(900, 500, 380, B.rad('glow', [(0, '#ffe0f0', .6), (1, '#ffe0f0', 0)]))
            + ''.join(trunk(x, 900, 900, w, '#a05a9a', lean=rnd.uniform(-10, 10), extra=' opacity=".45"') for x, w in [(600, 14), (720, 10), (1180, 12), (1260, 9)])
            + ''.join(path(f'M{x} 920C{x} 700 {x + rnd.uniform(-20, 20)} 500 {x + rnd.uniform(-10, 10)} {rnd.uniform(380, 520)}', 'none', ' stroke="#8a4a90" stroke-width="2" opacity=".6"') + circle(x, rnd.uniform(380, 520), 6, '#8a4a90', ' opacity=".6"') for x in [rnd.uniform(380, 1400) for _ in range(30)])
            + rect(B.lin('fall', [(0, '#fff6fb'), (1, '#ffd0e8')], 1, 0), 860, 0, 90, 760) + rect('#ffffff', 880, 0, 20, 760, ' opacity=".8"') + rect('#ffe0f0', 930, 0, 8, 760, ' opacity=".8"')
            + circle(905, 760, 140, B.rad('mist', [(0, '#fff', .8), (1, '#fff', 0)])) + rect(B.lin('pool', [(0, '#ff8ab8'), (1, '#a0407a')]), 0, 760, 1600, 140))
    def root(x, s):
        body = trunk(150, 0, 940, 110, '#3a2a5a', 30, 2.2)
        legs = ''.join(path(f'M{150 + dx * .3} -{h}C{150 + dx * .6} -{h * .5} {150 + dx} -{h * .2} {150 + dx * 1.2} 0', 'none', f' stroke="#3a2a5a" stroke-width="{w}" stroke-linecap="round"') for dx, h, w in [(-180, 260, 34), (200, 300, 30), (320, 180, 22), (-60, 160, 26)])
        lines = ''.join(path(f'M{150 + o} -900C{150 + o * 1.4} -600 {150 + o} -300 {150 + o * 1.6} 0', 'none', ' stroke="#2a1e48" stroke-width="5" opacity=".7"') for o in (-40, 10, 60))
        return g(body + legs + lines, f' transform="translate({x} 920) scale({s} 1)"')
    front = (shade_center(F, '#2a0e30', .35) + root(-60, 1) + root(1660, -1)
             + vine(160, 60, 1440, 40, 160, '#2a1e48', 6) + ''.join(leaf(x, 120 + math.sin(x / 90) * 40, 26, 7, 1.4, '#3a2a5a') for x in range(300, 1300, 70))
             + ''.join(g(path(f'M{x} 920V{y}', 'none', ' stroke="#2a1e48" stroke-width="3"') + circle(x, y, 9, '#2a1e48')) for x, y in [(540, 800), (580, 780), (1240, 790), (1280, 810), (700, 820)]))
    return back, front

@mapdef('ruins')  # 부유 폐허: 구름 속에 뜬 하늘 섬(사진)을 분홍 노을빛으로 — 섬이 천천히 떠오르내리고, 구름이 흘러간다
def m_ruins(B, F, rnd):
    back = (rect('#e8b8c8') + animg(img_tag('island.jpg', -20, -10, 1640, 1057), anim_t('translate', '0 0;0 -14;0 0', 14))
            + rect(B.lin('tint', [(0, '#ff6a9a', .85), (.5, '#f6a8c0', .7), (1, '#b8a0f0', .75)]), 0, 0, 1600, 900, ' style="mix-blend-mode:color"')
            + rect(B.lin('tint2', [(0, '#e87aa0', .4), (.55, '#f6c8d8', .1), (1, '#9a88d0', .35)]), 0, 0, 1600, 900, ' style="mix-blend-mode:multiply"')
            + rect(B.lin('haze', [(0, '#ffe0ea', .25), (1, '#ffe0ea', 0)]), 0, 0, 1600, 500)
            + circle(1320, 140, 260, B.rad('sun', [(0, '#fff4f0', .7), (1, '#fff4f0', 0)])))
    blur = F.blur('wisp', 18)
    def wisp(x0, y, w, o):
        return g(''.join(circle(x0 + i * w * .22, y + rnd.uniform(-20, 20), rnd.uniform(w * .12, w * .2), '#fff6fa') for i in range(5)), f' opacity="{o}" filter="{blur}"')
    front = (shade_center(F, '#3a1430', .35)
             + drift_g(wisp(-100, 820, 700, .75), 120, 40) + drift_g(wisp(900, 860, 800, .8), -140, 46) + drift_g(wisp(-200, 120, 500, .45), 160, 50)
             + falling(rnd, 10, '#ffd0e0', 'petal', 0, 1600, 18))
    return back, front

def m_ruins(B, F, rnd):
    def plat(x, y, w, h, c):
        out = [path(f'M{x} {y}H{x + w}L{x + w * .85} {y + h}H{x + w * .15}Z', c)]
        for i in range(int(w / 26)):
            xx = x + w * .15 + rnd.uniform(0, w * .7); out.append(rect(c, xx, y + h, rnd.uniform(3, 8), rnd.uniform(20, 120)))
        out.append(silhouette_city(x + 10, x + w - 10, y + 2, c, rnd, 20, 120, 20, 50, .2, '#ff9ac0'))
        return ''.join(out)
    back = (rect(B.lin('sky', [(0, '#e87aa0'), (.45, '#f6b8c8'), (1, '#c8d8f0')])) + circle(1300, 200, 220, '#fff0f4', ' opacity=".7"') + circle(1300, 200, 300, B.rad('sun', [(0, '#fff', .5), (1, '#fff', 0)]))
            + g(plat(0, 260, 520, 60, '#a85a88') + plat(1100, 320, 520, 70, '#a85a88'), ' opacity=".7"')
            + plat(260, 440, 420, 60, '#4a3a6a') + plat(980, 470, 460, 60, '#4a3a6a')
            + ''.join(cloud(x, y, w, 90, '#d8e4f6', rnd, 9, ' opacity=".9"') for x, y, w in [(300, 700, 600), (1200, 740, 700), (800, 820, 900)]))
    front = (shade_center(F, '#2a1430', .35) + plat(-60, 140, 360, 80, '#241a3a') + plat(1320, 100, 360, 90, '#241a3a')
             + path('M-20 920V760C60 740 140 700 220 720L320 780 420 760 520 820 560 920Z', '#2a2448') + path('M1620 920V720C1540 700 1460 740 1380 740L1300 800 1200 820 1120 920Z', '#2a2448')
             + ''.join(rect('#ff6a9a', rnd.uniform(0, 1600), rnd.uniform(100, 880), rnd.uniform(3, 8), rnd.uniform(3, 8), ' opacity=".8"') for _ in range(40)))
    return back, front

# ---------- 픽셀 맵 ----------
@mapdef('shrine')  # 잠든 수호상 (픽셀): 청록 안개 기둥, 계단 위 수호상, 빛의 고리, 비스듬한 빛
def m_shrine(B, F, rnd):
    c = 10
    back = (pix_bands([(0, '#dff4f0'), (180, '#bfe6e2'), (380, '#9ed0cc'), (600, '#7ab8b4'), (900, '#5a9a98')])
            + ''.join(rect(col, x, 0, w, 900, ' opacity=".5" shape-rendering="crispEdges"') for x, w, col in [(240, 120, '#cfeeea'), (520, 80, '#e8faf6'), (1060, 90, '#e8faf6'), (1300, 130, '#cfeeea')])
            + rays(1600, -100, [2.3, 2.45, 2.6], 1400, 60, '#ffffff', .25)
            + circle(800, 330, 150, 'none', ' stroke="#ffffff" stroke-width="5" opacity=".9"') + rect('#ffffff', 796, 120, 8, 60) + rect('#ffffff', 782, 140, 36, 6)
            + pix_poly([(620, 640), (980, 640), (1040, 700), (560, 700)], c, '#6a8a88') + pix_poly([(560, 700), (1040, 700), (1100, 760), (500, 760)], c, '#5a7a78')
            + pix_poly([(700, 640), (720, 420), (760, 330), (800, 300), (840, 330), (880, 420), (900, 640)], c, '#4a5e5c')
            + pix_circle(800, 320, 46, c, '#55706e') + rect('#bff6ff', 784, 316, 8, 8) + rect('#bff6ff', 808, 316, 8, 8) + pix_circle(800, 470, 16, c, '#bff6ff')
            + ''.join(path(f'M{x} 0C{x - 40} 200 {x + 40} 300 {x} {y}', 'none', ' stroke="#3a4e4c" stroke-width="5"') for x, y in [(700, 420), (900, 420)])
            + pix_blobs([(700, 440, 30), (900, 460, 26), (620, 690, 20), (990, 690, 24)], c, '#5a9a5a'))
    front = (shade_center(F, '#0a2224', .3)
             + pix_poly([(-20, -20), (260, -20), (220, 200), (160, 420), (120, 700), (60, 920), (-20, 920)], c, '#1a3a3c') + pix_poly([(1620, -20), (1340, -20), (1380, 220), (1440, 460), (1480, 720), (1540, 920), (1620, 920)], c, '#1a3a3c')
             + pix_blobs([(0, 820, 160), (220, 900, 120), (1600, 820, 170), (1380, 900, 120)], c, '#122a2c')
             + pix_poly([(780, 860), (820, 860), (830, 900), (770, 900)], c, '#20343a') + pix_circle(800, 850, 14, c, '#20343a') + rect('#9ff6ff', 820, 830, 8, 8)
             + ''.join(rect('#7ff0ff', x, y, 6, 6, ' shape-rendering="crispEdges"') for x, y in [(80, 600), (92, 600), (1500, 560), (1512, 560), (300, 760)])
             + ''.join(hang(x, -10, l, '#122a2c', 6, rnd) for x, l in [(200, 300), (300, 200), (1300, 260), (1420, 360)]))
    return back, front

@mapdef('sunset')  # 노을 성 (픽셀): 붉은 하늘과 큰 해, 성과 숲은 그림자로만 — 새가 날고 물빛이 일렁인다
def m_sunset(B, F, rnd):
    c = 10
    shimmer = ''.join(f'<rect x="{f(500 + rnd.uniform(-60, 60))}" y="{y}" width="{f(rnd.uniform(40, 120))}" height="6" fill="#ffd86a" shape-rendering="crispEdges" opacity=".5">{anim("opacity", ".15;.75;.15", rnd.uniform(3, 6))}</rect>' for y in range(700, 860, 24))
    back = (pix_bands([(0, '#7a1e3a'), (160, '#a83048'), (320, '#d85a50'), (480, '#f08a5a'), (640, '#c06070'), (900, '#c06070')])
            + ''.join(drift_g(rect('#f0a080', x, y, w, 10, ' opacity=".6" shape-rendering="crispEdges"'), d, 50) for x, y, w, d in [(100, 140, 260, 40), (900, 120, 300, -50), (400, 260, 200, 30), (1200, 300, 260, -40)])
            + circle(560, 470, 260, B.rad('sun', [(0, '#ffe08a', .55), (1, '#ffe08a', 0)])) + pix_circle(560, 470, 150, c, '#ffd86a')
            + ''.join(rect('#f08a5a', 420, y, 280, 8, ' shape-rendering="crispEdges"') for y in (500, 540, 580))
            + pix_poly([(200, 640), (420, 540), (600, 600), (820, 550), (1100, 620), (1400, 570), (1600, 640), (1600, 700), (200, 700)], c, '#7a3a5a')
            + rect('#d86a6a', 0, 680, 1600, 220, ' shape-rendering="crispEdges"') + shimmer)
    sil = '#2a1226'
    castle = pix_poly([(1080, 920), (1080, 520), (1120, 520), (1120, 440), (1160, 380), (1200, 440), (1200, 500), (1300, 500), (1300, 300), (1340, 220), (1380, 300), (1380, 460), (1460, 460), (1460, 380), (1500, 320), (1540, 380), (1540, 520), (1620, 520), (1620, 920)], c, sil)
    trees = ''.join(pix_poly([(x - w, base), (x, base - h), (x + w, base)], c, sil) for x, base, w, h in [(40, 760, 60, 340), (120, 780, 50, 260), (220, 800, 70, 300), (980, 860, 50, 200), (1040, 880, 40, 150)])
    front = (shade_center(F, '#2a0a18', .3) + castle + rect(sil, 1336, 170, 6, 50) + trees
             + pix_poly([(-20, 920), (-20, 740), (300, 760), (520, 860), (600, 920)], c, sil) + pix_blobs([(980, 900, 90), (1140, 880, 80)], c, sil)
             + birds(rnd, sil, 7))
    return back, front

def m_sunset(B, F, rnd):
    c = 10
    bird = lambda x, y: pix_poly([(x, y), (x + 20, y + 8), (x + 40, y), (x + 20, y + 14)], 6, '#2a1430')
    back = (pix_bands([(0, '#8a2440'), (160, '#b8384a'), (320, '#d85a50'), (480, '#e8805a'), (640, '#c06070'), (900, '#c06070')])
            + ''.join(rect('#f0a080', x, y, w, 10, ' opacity=".6" shape-rendering="crispEdges"') for x, y, w in [(100, 140, 260), (900, 120, 300), (400, 260, 200), (1200, 300, 260)])
            + pix_circle(560, 470, 150, c, '#ffd86a') + ''.join(rect('#e8805a', 420, y, 280, 8, ' shape-rendering="crispEdges"') for y in (500, 540, 580))
            + pix_poly([(200, 640), (420, 520), (600, 600), (820, 540), (1100, 620), (1400, 560), (1600, 640), (1600, 700), (200, 700)], c, '#8a4a70')
            + rect('#e07070', 0, 680, 1600, 220, ' shape-rendering="crispEdges"') + ''.join(rect('#ffd86a', 500 + rnd.uniform(-60, 60), y, rnd.uniform(40, 120), 6, ' opacity=".6" shape-rendering="crispEdges"') for y in range(700, 860, 24))
            + ''.join(bird(x, y) for x, y in [(380, 220), (460, 180), (720, 260), (300, 320), (820, 150), (980, 220)]))
    castle = pix_poly([(1080, 920), (1080, 520), (1120, 520), (1120, 440), (1160, 380), (1200, 440), (1200, 500), (1300, 500), (1300, 300), (1340, 220), (1380, 300), (1380, 460), (1460, 460), (1460, 380), (1500, 320), (1540, 380), (1540, 520), (1620, 520), (1620, 920)], c, '#3a1e3a')
    windows = ''.join(rect('#ffb060', x, y, 10, 14, ' shape-rendering="crispEdges"') for x, y in [(1140, 560), (1240, 540), (1330, 340), (1330, 400), (1490, 420), (1400, 560), (1500, 600), (1180, 640)])
    front = (shade_center(F, '#2a0a18', .35) + castle + windows + rect('#3a1e3a', 1336, 170, 6, 50)
             + pix_poly([(-20, 920), (-20, 520), (60, 520), (90, 360), (120, 520), (200, 560), (240, 420), (280, 600), (420, 700), (520, 920)], c, '#3a1e3a')
             + pix_blobs([(100, 780, 90), (260, 800, 80), (400, 860, 90), (980, 860, 80), (1140, 820, 70)], c, '#c03040') + pix_blobs([(80, 820, 60), (300, 840, 60), (1050, 880, 60)], c, '#e04a4a'))
    return back, front

@mapdef('skycity')  # 구름 위 시계탑: 저녁빛 하늘에 겹겹이 떠가는 픽셀 구름(사진) — 층마다 다른 속도로 흐르고 새가 난다
def m_skycity(B, F, rnd):
    c = 10
    cl = lambda n, x, y, w, extra='': img_tag(f'sky_cloud_{n}.png', x, y, w, w * {'a': 61 / 207, 'b': 57 / 221, 'c': 43 / 125}[n], PIX + extra, 'xMidYMid meet')
    back = (pix_bands([(0, '#3e4e7e'), (160, '#566a9a'), (320, '#8a86b4'), (470, '#d0a8bc'), (600, '#f0c4b8'), (900, '#f6d6c4')])
            + circle(1180, 470, 360, B.rad('sun', [(0, '#fff2dc', .85), (1, '#fff2dc', 0)]), anim('opacity', '.75;1;.75', 10)) + twinkles(rnd, 40, '#e8ecff', 0, 260)
            + drift_g(cl('b', -40, 90, 700, ' opacity=".55"'), 120, 90) + drift_g(cl('b', 900, 150, 640, ' opacity=".5"'), -100, 100)
            + drift_g(cl('a', 60, 250, 760, ' opacity=".85"'), 90, 70) + drift_g(cl('a', 860, 300, 820, ' opacity=".9"'), -80, 76)
            + drift_g(cl('c', 640, 470, 420), 60, 60))
    front = (shade_center(F, '#2a2440', .28)
             + drift_g(cl('c', -80, 600, 640), 70, 50) + drift_g(cl('c', 1060, 620, 640), -70, 56) + drift_g(cl('a', 300, 720, 1100), 50, 64)
             + drift_g(cl('a', -200, 800, 1000), 60, 58) + drift_g(cl('a', 900, 790, 1000), -60, 62) + birds(rnd, '#4a4470', 4))
    return back, front

@mapdef('henge')  # 붉은 환상열석 (픽셀): 붉은 하늘에 흐르는 구름(사진), 선돌 고리, 천천히 도는 빛의 궤도와 붉은 별
def m_henge(B, F, rnd):
    c = 10
    stone = lambda x, base, w, h: pix_poly([(x, base), (x + w * .1, base - h), (x + w * .9, base - h - 6), (x + w, base)], c, '#2e2030')
    orbit = (f'<g fill="none" stroke="#ffe0c0" stroke-width="5" opacity=".9">{P("M560 220C700 120 980 140 1040 200S840 320 700 300 520 260 560 220Z")}{P("M600 160C760 260 1000 260 1040 200S860 100 720 120 560 120 600 160Z")}'
             f'{anim_t("rotate", "0 800 210;360 800 210", 90)}</g>')
    back = (pix_bands([(0, '#4a0818'), (120, '#7a1222'), (260, '#b02a2a'), (420, '#d8502e'), (520, '#e86a3a'), (900, '#e86a3a')])
            + drift_g(img_tag('henge_cloud_b.png', 0, 70, 900, 242, PIX), 80, 70) + drift_g(img_tag('henge_cloud_b.png', 900, 150, 700, 188, PIX + ' opacity=".8"'), -60, 80)
            + drift_g(img_tag('henge_cloud_a.png', -60, 280, 760, 248, PIX), 50, 60) + drift_g(img_tag('henge_cloud_a.png', 1000, 260, 700, 228, PIX), -50, 66)
            + orbit + rect('#ffd0a0', 798, 0, 4, 520, ' opacity=".7"')
            + circle(800, 210, 60, B.rad('star', [(0, '#ffe0a0'), (.4, '#ff6a3a', .8), (1, '#ff6a3a', 0)]), anim('r', '50;72;50', 5)) + pix_circle(800, 210, 12, 6, '#fff0c0')
            + twinkles(rnd, 14, '#ffffff', 60, 330, 500, 1100)
            + rect('#a83030', 0, 540, 1600, 360, ' shape-rendering="crispEdges"')
            + ''.join(stone(x, 600 + d, w, h) for x, d, w, h in [(560, 0, 50, 90), (630, -6, 40, 70), (700, -8, 30, 60), (860, -8, 30, 60), (920, -6, 40, 70), (990, 0, 50, 90)]) + rect('#2e2030', 620, 520, 70, 14) + rect('#2e2030', 900, 520, 70, 14))
    field = ''.join(rect(col, 0, y, 1600, 920 - y, ' shape-rendering="crispEdges"') for y, col in [(620, '#b8402a'), (700, '#9a3226'), (790, '#7a2420'), (860, '#5a1a1c')])
    field += ''.join(rect(rnd.choice(['#e8803a', '#f0a050', '#d85a2a', '#6a2a3a']), int(rnd.uniform(0, 1600) / c) * c, int(rnd.uniform(620, 900) / c) * c, c * rnd.choice([1, 2, 3]), c, ' shape-rendering="crispEdges"') for _ in range(420))
    front = (shade_center(F, '#2a0608', .35) + field + stone(120, 860, 150, 300) + stone(300, 900, 120, 240) + rect('#2e2030', 100, 540, 340, 30, ' shape-rendering="crispEdges"')
             + stone(1300, 880, 140, 280) + stone(1460, 900, 130, 320) + drift_g(img_tag('henge_cloud_c.png', 1180, 40, 420, 156, PIX + ' opacity=".9"'), -40, 50))
    return back, front

def m_henge(B, F, rnd):
    c = 10
    stone = lambda x, base, w, h: pix_poly([(x, base), (x + w * .1, base - h), (x + w * .9, base - h - 6), (x + w, base)], c, '#3a2a3a')
    back = (pix_bands([(0, '#5a0a1a'), (120, '#8a1424'), (260, '#c02a2a'), (420, '#e0502e'), (520, '#e86a3a'), (900, '#e86a3a')])
            + pix_cloud(220, 360, 520, 200, c, '#e8a0a0', '#8a4a6a', rnd) + pix_cloud(1380, 340, 560, 220, c, '#e8a0a0', '#8a4a6a', rnd)
            + g(path('M560 220C700 120 980 140 1040 200S840 320 700 300 520 260 560 220Z') + path('M600 160C760 260 1000 260 1040 200S860 100 720 120 560 120 600 160Z'), ' fill="none" stroke="#ffe0c0" stroke-width="5" opacity=".9"')
            + rect('#ffd0a0', 798, 0, 4, 520, ' opacity=".7"') + circle(800, 210, 40, B.rad('star', [(0, '#ffe0a0'), (.4, '#ff6a3a', .8), (1, '#ff6a3a', 0)])) + pix_circle(800, 210, 12, 6, '#fff0c0')
            + ''.join(rect('#fff', rnd.uniform(500, 1100), rnd.uniform(60, 330), 4, 4, ' opacity=".9"') for _ in range(14))
            + rect('#a83030', 0, 540, 1600, 360, ' shape-rendering="crispEdges"')
            + ''.join(stone(x, 600 + d, w, h) for x, d, w, h in [(560, 0, 50, 90), (630, -6, 40, 70), (700, -8, 30, 60), (860, -8, 30, 60), (920, -6, 40, 70), (990, 0, 50, 90)]) + rect('#3a2a3a', 620, 520, 70, 14) + rect('#3a2a3a', 900, 520, 70, 14))
    field = ''.join(rect(col, 0, y, 1600, 920 - y, ' shape-rendering="crispEdges"') for y, col in [(620, '#b8402a'), (700, '#9a3226'), (790, '#7a2420'), (860, '#5a1a1c')])
    field += ''.join(rect(rnd.choice(['#e8803a', '#f0a050', '#d85a2a', '#6a2a3a']), int(rnd.uniform(0, 1600) / c) * c, int(rnd.uniform(620, 900) / c) * c, c * rnd.choice([1, 2, 3]), c, ' shape-rendering="crispEdges"') for _ in range(420))
    front = (shade_center(F, '#2a0608', .35) + field + stone(120, 860, 150, 300) + stone(300, 900, 120, 240) + rect('#3a2a3a', 100, 540, 340, 30, ' shape-rendering="crispEdges"')
             + stone(1300, 880, 140, 280) + stone(1460, 900, 130, 320))
    return back, front

@mapdef('goldtree')  # 황금 나무 (픽셀): 푸른 잿빛 밤, 큰 황금 나무(사진), 이끼 바위, 횃불 든 두건 — 잎이 지고 불빛이 흔들린다
def m_goldtree(B, F, rnd):
    c = 10
    back = (pix_bands([(0, '#2e3a4c'), (300, '#3e4c5e'), (600, '#4c5c6e'), (900, '#4c5c6e')])
            + drift_g(pix_cloud(200, 560, 500, 200, c, '#5e6e80', '#4e5e70', rnd), 40, 70) + drift_g(pix_cloud(1300, 520, 600, 220, c, '#5e6e80', '#4e5e70', rnd), -40, 80)
            + circle(420, 190, 60, 'none', ' stroke="#a8d8ff" stroke-width="5" stroke-dasharray="300 80"') + twinkles(rnd, 50, '#dfe8f0', 0, 400)
            + circle(1010, 420, 380, B.rad('treeglow', [(0, '#f8c848', .35), (1, '#f8c848', 0)]), anim('opacity', '.7;1;.7', 7))
            + pix_poly([(-20, 720), (300, 700), (600, 720), (900, 700), (1200, 710), (1620, 700), (1620, 920), (-20, 920)], c, '#26343a'))
    front = (shade_center(F, '#121a22', .3)
             + circle(1010, 720, 300, F.rad('pool', [(0, '#f8b838', .3), (1, '#f8b838', 0)]))
             + img_tag('goldtree.png', 1010 - 57 * 6, 776 - 43 * 12, 57 * 12, 43 * 12, PIX, 'xMidYMax meet')  # 원래 비율(57×43칸) 그대로, 땅에 닿게
             + pix_blobs([(1480, 640, 150), (1580, 580, 120), (1620, 720, 120)], c, '#2a4440') + pix_blobs([(1500, 580, 40), (1560, 660, 30)], c, '#36584a')
             + pix_poly([(160, 720), (190, 600), (230, 580), (270, 600), (300, 720)], c, '#161a20') + rect('#ffd040', 214, 640, 8, 14) + rect('#4a3a2a', 320, 560, 6, 160)
             + circle(323, 552, 44, '#ffb030', ' opacity=".2"' ) .replace('/>', f'>{anim("r", "38;50;40;46;38", 2.2)}</circle>')
             + pix_circle(323, 552, 10, 6, '#ffb030')
             + pix_poly([(-20, 760), (400, 740), (800, 760), (1200, 750), (1620, 760), (1620, 920), (-20, 920)], c, '#1a2428')
             + falling(rnd, 16, '#f8b838', 'leaf', 700, 1340, 12) + fireflies(rnd, 26, ['#a0f070', '#ffd040', '#c080ff'], (100, 600, 1500, 880)))
    return back, front

def m_goldtree(B, F, rnd):
    c = 10
    back = (pix_bands([(0, '#3a4a5a'), (300, '#4a5a6a'), (600, '#566878'), (900, '#566878')])
            + pix_cloud(200, 560, 500, 200, c, '#6a7a8a', '#5a6a7a', rnd) + pix_cloud(1300, 520, 600, 220, c, '#6a7a8a', '#5a6a7a', rnd)
            + circle(420, 190, 60, 'none', ' stroke="#a8d8ff" stroke-width="5" stroke-dasharray="300 80"') + stars(rnd, 40, '#dfe8f0', 0, 400)
            + pix_poly([(-20, 720), (300, 700), (600, 720), (900, 700), (1200, 710), (1620, 700), (1620, 920), (-20, 920)], c, '#2a3a40'))
    canopy_ = pix_blobs([(1000, 300, 180), (820, 340, 150), (1180, 340, 150), (920, 200, 140), (1100, 210, 130), (1000, 420, 150), (760, 440, 90), (1240, 450, 90)], c, '#f0a828')
    shade = pix_blobs([(980, 420, 120), (840, 470, 80), (1160, 470, 80)], c, '#c87a1a')
    front = (shade_center(F, '#121a22', .3)
             + canopy_ + shade + pix_poly([(960, 720), (980, 520), (940, 460), (990, 480), (1010, 420), (1030, 480), (1080, 450), (1030, 520), (1050, 720)], c, '#5a3a2a')
             + ''.join(pix_circle(x, y, r, c, '#f8c848') for x, y, r in [(900, 180, 30), (1120, 160, 26), (780, 380, 24)])
             + pix_blobs([(1400, 620, 150), (1500, 560, 120), (1560, 700, 120)], c, '#2e4a42') + pix_blobs([(1430, 560, 40), (1480, 640, 30)], c, '#3a6050')
             + pix_poly([(160, 720), (190, 600), (230, 580), (270, 600), (300, 720)], c, '#1a1e24') + rect('#ffd040', 214, 640, 8, 14) + rect('#4a3a2a', 320, 560, 6, 160)
             + pix_circle(323, 552, 10, 6, '#ffb030') + circle(323, 552, 40, '#ffb030', ' opacity=".2"')
             + pix_poly([(-20, 760), (400, 740), (800, 760), (1200, 750), (1620, 760), (1620, 920), (-20, 920)], c, '#1e2a2e')
             + glowdots(rnd, 30, ['#a0f070', '#ffd040', '#c080ff'], (100, 600, 1500, 880), 2))
    return back, front

# ---------------------------------------------------------------- 맵이 없던 배너 3종
def smoke(rnd, x, y, length, ang, width, color, blur, n=5, curl=1.0):
    """연기 한 줄기: 부드럽게 굽이치는 중심선을 따라 비단결 같은 가는 결 여러 가닥 + 흐린 빛 번짐.
    위로 갈수록 넓게 퍼지고, 가닥마다 조금씩 꼬인다"""
    k1, k2, ph = rnd.uniform(1.2, 2.2) * curl, rnd.uniform(2.5, 4) * curl, rnd.uniform(0, 6.28)
    ca, sa = math.cos(ang), math.sin(ang)
    def pt(t, off):  # 중심선 + 옆으로 비킨 가닥
        wob = math.sin(t * math.pi * k1 + ph) * length * .16 + math.sin(t * math.pi * k2 + ph * 2) * length * .05
        lat = wob + off * (.2 + t * 1.6) * width
        return x + ca * length * t - sa * lat, y + sa * length * t + ca * lat
    def line(off, twist):
        ps = [pt(i / 36, off + math.sin(i / 36 * math.pi * 3 + twist) * .35) for i in range(37)]
        d = f'M{f(ps[0][0])} {f(ps[0][1])}' + ''.join(f'Q{f(a[0])} {f(a[1])} {f((a[0] + b[0]) / 2)} {f((a[1] + b[1]) / 2)}' for a, b in zip(ps[1:], ps[2:]))
        return d
    out = [path(line(0, 0), 'none', f' stroke="{color}" stroke-width="{f(width * 1.6)}" stroke-linecap="round" opacity=".16" filter="{blur}"')]
    for i in range(n * 2):
        off, tw = rnd.uniform(-1, 1), rnd.uniform(0, 6.28)
        out.append(path(line(off, tw), 'none', f' stroke="{color}" stroke-width="{f(rnd.uniform(.8, 2.2))}" stroke-linecap="round" opacity="{rnd.uniform(.25, .6):.2f}"'))
    return ''.join(out)

@mapdef('bluesmoke')  # 푸른 연기: 짙은 청록 어둠, 빛나는 청록 연기 소용돌이, 비스듬한 어두운 판
def m_bluesmoke(B, F, rnd):
    b8, b20 = B.blur('b8', 8), B.blur('b20', 20)
    back = (rect(B.lin('sky', [(0, '#0f2230'), (.5, '#142c3a'), (1, '#081218')], 1, 1)) + circle(1000, 380, 460, B.rad('core', [(0, '#7fe0ff', .45), (.4, '#3aa8c8', .2), (1, '#3aa8c8', 0)]))
            + g(''.join(circle(rnd.uniform(700, 1300), rnd.uniform(200, 600), rnd.uniform(60, 160), '#7fe0ff', f' opacity="{rnd.uniform(.05, .12):.2f}"') for _ in range(12)), f' filter="{b20}"')
            + smoke(rnd, 760, 620, 600, -.6, 60, '#a9ecff', b8, 7) + smoke(rnd, 1300, 700, 520, -2.4, 50, '#a9ecff', b8, 6) + smoke(rnd, 980, 420, 360, -1.4, 40, '#d4f7ff', b8, 5, 1.6)
            + circle(1000, 380, 70, B.rad('hot', [(0, '#eaffff', .9), (1, '#7fe0ff', 0)])))
    front = (shade_center(F, '#05101a', .45) + path('M1380 -20H1620V920H1500Z', '#0a141c') + path('M1380 -20L1500 920', 'none', ' stroke="#3aa8c8" stroke-width="2" opacity=".5"')
             + smoke(rnd, -40, 900, 420, -1.1, 50, '#7fe0ff', F.blur('b8', 8), 5) + smoke(rnd, 1640, 120, 300, 2.6, 40, '#7fe0ff', F.blur('b6', 6), 4))
    return back, front

@mapdef('starsmoke')  # 별밤 연기: 별이 가득한 검은 밤, 양옆에서 피어오르는 흰 연기
def m_starsmoke(B, F, rnd):
    b6 = B.blur('b6', 6)
    back = (rect(B.rad('sky', [(0, '#1b2440'), (.6, '#0a0d1a'), (1, '#04050a')], .5, 1.1, 1)) + stars(rnd, 380, '#cfe0ff', 0, 900, (.6, .9, 1.3, 1.8))
            + ''.join(sparkle(rnd.uniform(100, 1500), rnd.uniform(40, 700), rnd.uniform(5, 9), '#ffffff', .9) for _ in range(10))
            + rect(B.lin('band', [(0, '#8fa8e0', 0), (.5, '#8fa8e0', .12), (1, '#8fa8e0', 0)], 1, 1), 0, 0, 1600, 900))
    b8 = F.blur('b8', 8)
    front = (shade_center(F, '#04050a', .35)
             + smoke(rnd, 60, 940, 700, -1.45, 70, '#f2f2f2', b8, 7, .8) + smoke(rnd, 220, 960, 520, -1.7, 40, '#f2f2f2', b8, 5, .9)
             + smoke(rnd, 1540, 940, 720, -1.65, 70, '#f2f2f2', b8, 7, .8) + smoke(rnd, 1380, 960, 480, -1.4, 40, '#f2f2f2', b8, 5, .9))
    return back, front

@mapdef('sunforest')  # 숲의 햇살: 연둣빛 숲, 왼쪽 위에서 쏟아지는 햇살, 빛의 원, 앞쪽 잎사귀
def m_sunforest(B, F, rnd):
    back = (rect(B.lin('sky', [(0, '#e9f5b8'), (.35, '#9cc87a'), (.75, '#3f7a4a'), (1, '#1f3d26')], 1, 1)) + circle(300, 60, 520, B.rad('sun', [(0, '#fffbe0', .95), (.4, '#f6ffd0', .4), (1, '#f6ffd0', 0)]))
            + ''.join(trunk(x, 900, 900, w, c, lean=rnd.uniform(-20, 20)) for x, w, c in [(560, 16, '#5a8a5a'), (760, 12, '#6a9a62'), (1040, 18, '#4f7a52'), (1240, 14, '#5a8a5a')])
            + ''.join(canopy(x, y, 220, 90, c, rnd, 12) for x, y, c in [(900, 60, '#4f8a4a'), (1300, 120, '#3f7a42'), (600, 30, '#6a9a52')])
            + rays(180, -60, [.55, .7, .85, 1.0, 1.15], 1500, 110, '#fffbe0', .16)
            + g(circle(980, 470, 230, 'none', ' stroke="#f6ffd8" stroke-width="3"') + circle(980, 470, 270, 'none', ' stroke="#f6ffd8" stroke-width="2" stroke-dasharray="120 20 10 20"') + circle(980, 470, 200, '#fffbe0', ' opacity=".18"'), ' opacity=".7"')
            + ground(740, '#2f5a36', rnd, 18, 10) + bush(980, 760, 360, 80, '#4f8a4a', rnd) + rect('#fffbe0', 760, 742, 440, 6, ' opacity=".5" rx="3"')
            + ''.join(leaf(rnd.uniform(200, 1500), rnd.uniform(100, 720), rnd.uniform(8, 14), 3, rnd.uniform(0, 6.28), '#f6ffc8', ' opacity=".8"') for _ in range(36)))
    lf = lambda x, y, l, a: leaf(x, y, l, l * .3, a, '#1f4a2c') + path(f'M{f(x)} {f(y)}L{f(x + math.cos(a) * l * .9)} {f(y + math.sin(a) * l * .9)}', 'none', ' stroke="#2f6a3e" stroke-width="2"')
    front = (shade_center(F, '#0e2414', .3)
             + ''.join(lf(x, y, rnd.uniform(140, 230), a) for x, y, a in [(-20, 920, -1.0), (60, 940, -1.4), (160, 940, -1.1), (240, 930, -1.6), (-20, 700, -.4), (1620, 920, -2.1), (1540, 940, -1.8), (1440, 940, -2.0), (1360, 930, -1.5), (1620, 680, -2.8)])
             + ''.join(lf(x, y, rnd.uniform(120, 200), a) for x, y, a in [(1500, -20, 2.0), (1400, -20, 1.6), (1620, 60, 2.6), (100, -20, 1.1), (200, -20, 1.5)])
             + trunk(1540, 940, 960, 46, '#173322', -20) + ''.join(branches(1520, 220, math.pi + .5, 220, 18, 4, '#173322', rnd, .5))
             + ''.join(circle(rnd.uniform(0, 1600), rnd.uniform(0, 900), rnd.uniform(1.5, 3), '#fffbe0', ' opacity=".7"') for _ in range(30)))
    return back, front

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in MAPS.items():
        B, F = Defs(name + '-'), Defs(name + 'f-'); rnd = random.Random(sum(map(ord, name)))  # 맵마다 늘 같은 그림
        back, front = fn(B, F, rnd)
        for part, body, D in (('back', back, B), ('front', front, F)):
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">{D.svg()}{body}</svg>'
            (OUT / f'{name}-{part}.svg').write_text(svg)
    print(len(MAPS), 'maps →', OUT)

if __name__ == '__main__':
    build()
