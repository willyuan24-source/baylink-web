"""Codemod (WEB-SECONDARY): the legacy tool stylesheets -> shared tokens.

    python scripts/codemods/retoken-tools.py src/components/tools/unit-price.css src/components/tools/dining-calculator.css src/components/tools/loan-calculator.css

Rewrites each file in place and prints every change. Every hex literal is mapped by the role of its declaration (text,
background, border, outline, shadow, fill/stroke) to a token from src/tokens.css (text by its contrast on white: ink /
ink-2 / ink-3; links and buttons -> brand), and rem font sizes under 13px are lifted to --text-caption. Idempotent: a file
that already uses tokens is left as it is, so after a rebase run it again instead of resolving colour conflicts by hand.
The lane's later hand edits to these three files (control heights, the loan chart's HTML axis) are not part of it."""
import re, sys

def lum(h):
    h = h.lstrip('#')
    if len(h) in (3, 4): h = ''.join(c * 2 for c in h[:3])
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda v: v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b), (r, g, b)

HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
def text_color(h, selector):
    L, _ = lum(h)
    if re.search(r'(?:^|[\s>,.])(?:a|button)\b|link|button|rank|number', selector) and L < .2: return 'var(--color-brand)'
    ratio = 1.05 / (L + .05)
    return 'var(--color-ink)' if ratio >= 9 else 'var(--color-ink-2)' if ratio >= 6 else 'var(--color-ink-3)'
def bg_color(h):
    L, (r, g, b) = lum(h)
    if L > .93: return 'var(--color-surface)'
    if L < .25: return 'var(--color-brand)' if L > .05 else 'var(--color-brand-deep)'
    if r > b + .04 and r >= g - .01: return 'var(--color-warning-tint)'
    if g >= r and g >= b: return 'var(--color-brand-tint)'
    return 'var(--color-surface-2)'
def border_color(h):
    L, _ = lum(h)
    return 'var(--color-line)' if L > .78 else 'var(--color-line-strong)' if L > .35 else 'var(--color-brand)'

def convert(prop, value, selector):
    p = prop.strip().lower()
    if p.startswith('--unit-price-ink'): return 'var(--color-ink)'
    if p.startswith('--unit-price-muted'): return 'var(--color-ink-2)'
    if p == 'font-size':
        m = re.fullmatch(r'\s*(\d*\.?\d+)rem\s*', value)
        if m and float(m.group(1)) < .8125: return 'var(--text-caption)'
        return value
    if not HEX.search(value) and not re.search(r'\bwhite\b', value): return value
    if p == 'color': return HEX.sub(lambda m: text_color(m.group(0), selector), value).replace('white', 'var(--color-surface)')
    if p in ('background', 'background-color'):
        if 'gradient' in value: return 'var(--color-surface-2)'
        return HEX.sub(lambda m: bg_color(m.group(0)), value).replace('white', 'var(--color-surface)')
    if p.startswith('border') or p == 'outline' and False: return HEX.sub(lambda m: border_color(m.group(0)), value)
    if p == 'outline': return HEX.sub('var(--color-brand)', value)
    if p == 'accent-color': return 'var(--color-brand)'
    if p == 'box-shadow':
        if 'inset' in value: return 'inset 0 0 0 1px var(--color-brand)'
        if re.match(r'\s*0 0 0 ', value): return '0 0 0 3px var(--color-brand-tint)'
        return 'none'
    if p in ('fill', 'stroke'): return 'var(--color-brand)'
    return value

def run(path):
    text = open(path, encoding='utf8').read()
    out, log = [], []
    def rule(m):
        selector, body = m.group(1), m.group(2)
        def decl(d):
            prop, value = d.group(1), d.group(2)
            new = convert(prop, value, selector)
            if new != value: log.append(f'{selector.strip()[:50]} {prop.strip()}: {value.strip()} -> {new.strip()}')
            return f'{prop}:{new}'
        return selector + '{' + re.sub(r'([\w-]+)\s*:\s*([^;{}]+)', decl, body) + '}'
    text2 = re.sub(r'([^{}@]+)\{([^{}]*)\}', rule, text)
    open(path, 'w', encoding='utf8').write(text2)
    print(path, len(log), 'changes')
    for line in log: print('  ', line)

for path in sys.argv[1:]: run(path)
