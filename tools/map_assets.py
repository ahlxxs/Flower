"""맵에 넣는 사진 손질: tools/map_assets/src/의 원본을 맵에 맞게 다듬어 tools/map_assets/에 저장한다.
실행: python3 tools/map_assets.py  (그다음 python3 tools/make_maps.py)"""
import pathlib
from PIL import Image

D = pathlib.Path(__file__).resolve().parent / 'map_assets'
SRC = D / 'src'

def lum(c): return .299 * c[0] + .587 * c[1] + .114 * c[2]

def grid_sample(im, n):
    """픽셀 아트를 원래 칸 수(n×n)로 되돌린다: 칸 가운데 색을 읽는다"""
    s = im.width / n; out = Image.new('RGB', (n, round(im.height / s)))
    px = im.load()
    for j in range(out.height):
        for i in range(out.width):
            out.putpixel((i, j), px[min(im.width - 1, int((i + .5) * s)), min(im.height - 1, int((j + .5) * s))])
    return out

def lerp(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
def gradient_map(l, stops):
    for (t1, c1), (t2, c2) in zip(stops, stops[1:]):
        if l <= t2: return lerp(c1, c2, (l - t1) / (t2 - t1) if t2 > t1 else 0)
    return stops[-1][1]


# 2. 환상열석 구름: 체크무늬 바탕(어두운 청색)을 지우고 노을빛으로 다시 칠한다. 구름 셋을 잘라 쓴다
clouds = Image.open(SRC / 'clouds.jpg').convert('RGB')
HENGE = [(0, (120, 50, 80)), (.45, (196, 92, 104)), (.75, (240, 160, 150)), (1, (255, 226, 206))]
for name, box in {'cloud_a': (225, 270, 655, 410), 'cloud_b': (220, 100, 672, 222), 'cloud_c': (325, 448, 585, 545)}.items():
    c = grid_sample(clouds.crop(box), (box[2] - box[0]) // 2).convert('RGBA')
    out = []
    for r, g, b, _ in c.get_flattened_data():
        l = lum((r, g, b)); blueish = b - r
        a = max(0, min(255, (l - 120) * 4)) if blueish < 70 or l > 150 else 0   # 밝은 구름만 남긴다
        out.append((*gradient_map(min(1, max(0, (l - 120) / 135)), HENGE), int(a)))
    c.putdata(out); c.crop(c.getbbox()).save(D / f'henge_{name}.png')
    SKY = [(0, (150, 130, 190)), (.45, (206, 176, 214)), (.75, (246, 214, 214)), (1, (255, 246, 238))]  # 구름 위 시계탑용 파스텔
    c.putdata([(*gradient_map(min(1, max(0, (lum((r, g, b)) - 120) / 135)), SKY), al) for (r, g, b, al), (r0, g0, b0, _) in zip(out, grid_sample(clouds.crop(box), (box[2] - box[0]) // 2).convert('RGBA').get_flattened_data())] if False else
              [(*gradient_map(min(1, max(0, (lum(px0[:3]) - 120) / 135)), SKY), o[3]) for o, px0 in zip(out, grid_sample(clouds.crop(box), (box[2] - box[0]) // 2).convert('RGB').get_flattened_data())])
    c.crop(c.getbbox()).save(D / f'sky_{name}.png')

# 3. 행성 고리 → 블랙홀: 어두운 우주 그대로 (맵에서 screen 섞기로 바탕에 녹인다)
Image.open(SRC / 'blackhole.jpg').convert('RGB').save(D / 'blackhole.jpg', quality=86)

# 4. 부유 폐허 → 하늘 섬: 그대로 (맵에서 분홍 노을빛을 덧입힌다)
Image.open(SRC / 'island.jpg').convert('RGB').save(D / 'island.jpg', quality=84)
print('ok')
