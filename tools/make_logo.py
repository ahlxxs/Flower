"""실행: pip install fonttools && python3 tools/make_logo.py <PlayfairDisplay.ttf>
ARCANA 엠블럼: 타로 카드 틀 + 초승달 + 행성 고리 + 네 갈래 별 + 세로 축.
출력: public/brand/mark.svg (투명), public/brand/logo.svg (글자 포함, 투명), public/favicon.svg (어두운 바탕)."""
import math, pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path('/home/user/Flower/public')
FONT = sys.argv[1]

def star(cx, cy, r, w, rv=None):
    """네 갈래 별 (곡선으로 오목하게). r: 가로 반경, rv: 세로 반경, w: 허리 굵기"""
    rv = rv or r
    k = w
    return (f'M{cx} {cy-rv} Q{cx+k} {cy-k} {cx+r} {cy} Q{cx+k} {cy+k} {cx} {cy+rv} '
            f'Q{cx-k} {cy+k} {cx-r} {cy} Q{cx-k} {cy-k} {cx} {cy-rv}Z')

DEFS = '''<defs>
  <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9e1ff"/>
    <stop offset=".8" stop-color="#a9b6ff"/><stop offset="1" stop-color="#f3c9e8"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#e8c27a"/>
  </linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#c9d3ff" stop-opacity="0"/></radialGradient>
  <mask id="cut"><rect x="0" y="0" width="512" height="512" fill="#fff"/><circle cx="292" cy="214" r="84" fill="#000"/></mask>
</defs>'''

def mark(line='#f3ead2'):
    cx, cy = 256, 262
    tilt = -16
    # 행성 고리: 뒤쪽 반은 달 뒤에, 앞쪽 반은 달 앞에 그린다
    ring = lambda sweep: f'M{cx-206} {cy} A206 42 0 0 {sweep} {cx+206} {cy}'
    dots = ''.join(f'<circle cx="{256}" cy="{y}" r="{r}" fill="{line}"/>' for y, r in [(34, 3), (442, 3.2), (458, 2.2)])
    sparks = ''.join(f'<path d="{star(x, y, s, s*.18)}" fill="{c}"/>' for x, y, s, c in [
        (150, 128, 15, line), (380, 150, 10, '#c9d3ff'), (396, 372, 13, line), (128, 352, 8, '#c9d3ff'), (330, 92, 6, line)])
    return f'''<g fill="none" stroke="{line}" stroke-linecap="round">
  <!-- 타로 카드 틀 (아치형 이중선) -->
  <path d="M150 432 V150 A106 106 0 0 1 362 150 V432 Z" stroke-width="3" opacity=".75"/>
  <path d="M164 418 V152 A92 92 0 0 1 348 152 V418 Z" stroke-width="1.4" opacity=".45"/>
  <path d="M256 418 l9 14 l-9 14 l-9 -14 Z" fill="url(#gold)" stroke="none"/>
  <!-- 세로 축과 점선 -->
  <path d="M256 20 V112" stroke-width="2"/>
  <path d="M256 360 V420" stroke-width="2" stroke-dasharray="2 9"/>
  <path d="M220 340 V392 M292 340 V378" stroke-width="1.2" stroke-dasharray="1.5 7" opacity=".7"/>
  <!-- 고리 뒤쪽 -->
  <g transform="rotate({tilt} {cx} {cy})"><path d="{ring(1)}" stroke-width="2.4" opacity=".55"/></g>
</g>
<circle cx="{cx}" cy="{cy}" r="120" fill="url(#glow)"/>
<!-- 초승달 -->
<circle cx="{cx}" cy="{cy}" r="96" fill="url(#moon)" mask="url(#cut)"/>
<g fill="none" stroke="{line}" stroke-linecap="round">
  <!-- 고리 앞쪽 -->
  <g transform="rotate({tilt} {cx} {cy})"><path d="{ring(0)}" stroke-width="3.2"/>
    <circle cx="{cx+206}" cy="{cy}" r="4" fill="{line}" stroke="none"/><circle cx="{cx-150}" cy="{cy+29}" r="2.6" fill="{line}" stroke="none"/></g>
</g>
<!-- 가운데 별 -->
<path d="{star(276, 236, 46, 6, 74)}" fill="url(#gold)"/>
<circle cx="276" cy="236" r="5" fill="#fff"/>
{sparks}{dots}'''

def text_path(word, font_path, size, cx, baseline, tracking):
    f = TTFont(font_path)
    if 'fvar' in f: f = instantiateVariableFont(f, {'wght': 500})
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    scale = size / f['head'].unitsPerEm
    adv = [hmtx[cmap[ord(ch)]][0] * scale for ch in word]
    total = sum(adv) + tracking * (len(word) - 1)
    x, out = cx - total / 2, []
    for ch, a in zip(word, adv):
        pen = SVGPathPen(gs)
        gs[cmap[ord(ch)]].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        out.append(pen.getCommands())
        x += a + tracking
    return ' '.join(out), total

def svg(w, h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{extra}{DEFS}{body}</svg>\n'

(ROOT / 'brand').mkdir(exist_ok=True)
(ROOT / 'brand/mark.svg').write_text(svg(512, 512, mark()))

# 글자 버전: 엠블럼 아래에 ARCANA, 양옆에 가는 선과 별
word, tw = text_path('ARCANA', FONT, 104, 256, 600, 30)
pad = max(0, (tw + 60 - 512) / 2)
logo = f'''<g>{mark()}</g>
<path d="{word}" fill="url(#gold)"/>
<g stroke="#f3ead2" stroke-width="1.6" stroke-linecap="round" opacity=".8"><path d="M96 652 H222 M290 652 H416"/></g>
<path d="{star(256, 652, 13, 2.4)}" fill="url(#gold)"/>'''
(ROOT / 'brand/logo.svg').write_text(svg(512, 690, logo).replace('viewBox="0 0 512 690" width="512"', f'viewBox="{-pad:.0f} 0 {512+2*pad:.0f} 690" width="{512+2*pad:.0f}"'))

# 파비콘: 어두운 둥근 사각형 바탕 + 엠블럼 (작은 크기에서 보이도록 틀은 굵게)
fav = f'''<rect width="512" height="512" rx="112" fill="url(#bg)"/>
<clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#r)"><g transform="translate(256 256) scale(1.75) translate(-256 -258)">
  <g transform="rotate(-16 256 262)"><path d="M50 262 A206 42 0 0 1 462 262" fill="none" stroke="#f3ead2" stroke-width="7" opacity=".5"/></g>
  <circle cx="256" cy="262" r="96" fill="url(#moon)" mask="url(#cut)"/>
  <g transform="rotate(-16 256 262)"><path d="M50 262 A206 42 0 0 0 462 262" fill="none" stroke="#f3ead2" stroke-width="8" stroke-linecap="round"/></g>
  <path d="{star(276, 236, 46, 7, 74)}" fill="url(#gold)"/>
</g></g>'''
bg = '<defs><radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#1d2440"/><stop offset=".6" stop-color="#0d1322"/><stop offset="1" stop-color="#070a12"/></radialGradient></defs>'
(ROOT / 'favicon.svg').write_text(svg(512, 512, fav, bg))
print('ok')
# 작은 크기용(헤더): 파비콘에서 바탕만 뺀 것
small = fav.replace('<rect width="512" height="512" rx="112" fill="url(#bg)"/>', '').replace(' clip-path="url(#r)"', '')
(ROOT / 'brand/mark-small.svg').write_text(svg(512, 512, small))
