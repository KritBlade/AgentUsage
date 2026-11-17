"""Draws AgentUsage's icon: four usage meters, one per agent, on a dark rounded tile.

Writes images/agent-usage-icon.svg (the editable source) and images/agent-usage-icon.png (256 px, the Marketplace
icon) from the same geometry, so the two never differ.
Usage: python3 tools/build-icon.py   (needs Pillow: pip install pillow)
"""
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SVG_PATH = ROOT / 'images' / 'agent-usage-icon.svg'
PNG_PATH = ROOT / 'images' / 'agent-usage-icon.png'

SIZE = 256
SUPERSAMPLE = 8
TILE = {'inset': 4, 'radius': 46, 'top': '#2C3039', 'bottom': '#1A1D23', 'border': '#3A3F4A', 'border_width': 2}
EMPTY_SEGMENT = '#3A3F4B'
# One meter per agent, in status bar order: (colour, filled segments of five).
METERS = [
    ('#E07B53', 3),  # Claude Code
    ('#ECEEF2', 4),  # Codex
    ('#A48BFA', 2),  # Grok
    ('#4F8EF7', 3),  # Antigravity
]
SEGMENTS = 5
LEFT, RIGHT = 36, 220
SEGMENT_GAP = 8
SLANT = 9
ROW_HEIGHT = 24
ROW_GAP = 12
CORNER_SOFTENING = 3


def hex_to_rgb(colour):
    return tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))


def segment_polygons():
    """Yields (colour, four corner points) for every segment, as parallelograms leaning right."""
    segment_width = (RIGHT - LEFT - SLANT - (SEGMENTS - 1) * SEGMENT_GAP) / SEGMENTS
    total_height = len(METERS) * ROW_HEIGHT + (len(METERS) - 1) * ROW_GAP
    top = (SIZE - total_height) / 2
    for row, (colour, filled) in enumerate(METERS):
        y_top = top + row * (ROW_HEIGHT + ROW_GAP)
        y_bottom = y_top + ROW_HEIGHT
        for index in range(SEGMENTS):
            x = LEFT + index * (segment_width + SEGMENT_GAP)
            points = [(x + SLANT, y_top), (x + SLANT + segment_width, y_top), (x + segment_width, y_bottom), (x, y_bottom)]
            yield (colour if index < filled else EMPTY_SEGMENT), points


def build_svg():
    inset, size = TILE['inset'], SIZE - 2 * TILE['inset']
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">',
        '  <defs>',
        '    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">',
        f'      <stop offset="0" stop-color="{TILE["top"]}"/>',
        f'      <stop offset="1" stop-color="{TILE["bottom"]}"/>',
        '    </linearGradient>',
        '  </defs>',
        f'  <rect x="{inset}" y="{inset}" width="{size}" height="{size}" rx="{TILE["radius"]}" fill="url(#tile)" '
        f'stroke="{TILE["border"]}" stroke-width="{TILE["border_width"]}"/>',
    ]
    for colour, points in segment_polygons():
        path = ' '.join(f'{x:.2f},{y:.2f}' for x, y in points)
        lines.append(
            f'  <polygon points="{path}" fill="{colour}" stroke="{colour}" stroke-width="{CORNER_SOFTENING}" '
            'stroke-linejoin="round"/>'
        )
    lines.append('</svg>')
    return '\n'.join(lines) + '\n'


def build_png():
    scale = SUPERSAMPLE
    full = SIZE * scale
    inset = TILE['inset'] * scale
    box = (inset, inset, full - inset, full - inset)
    gradient = Image.new('RGBA', (full, full))
    top, bottom = hex_to_rgb(TILE['top']), hex_to_rgb(TILE['bottom'])
    gradient_draw = ImageDraw.Draw(gradient)
    for y in range(full):
        share = min(1, max(0, (y - inset) / (full - 2 * inset)))
        gradient_draw.line((0, y, full, y), fill=tuple(round(a + (b - a) * share) for a, b in zip(top, bottom)) + (255,))
    mask = Image.new('L', (full, full), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=TILE['radius'] * scale, fill=255)
    image = Image.new('RGBA', (full, full), (0, 0, 0, 0))
    image.paste(gradient, (0, 0), mask)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=TILE['radius'] * scale, outline=TILE['border'], width=TILE['border_width'] * scale)
    for colour, points in segment_polygons():
        scaled = [(x * scale, y * scale) for x, y in points]
        draw.polygon(scaled, fill=colour)
        draw.line(scaled + [scaled[0]], fill=colour, width=CORNER_SOFTENING * scale, joint='curve')
        for x, y in scaled:
            radius = CORNER_SOFTENING * scale / 2
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=colour)
    return image.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    SVG_PATH.write_text(build_svg(), encoding='utf-8')
    build_png().save(PNG_PATH, optimize=True)
    print(f'wrote {SVG_PATH.relative_to(ROOT)} and {PNG_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
