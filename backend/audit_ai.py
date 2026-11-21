import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from django.conf import settings
from django.urls import get_resolver

def h(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")

# ── 1. AI app structure ────────────────────────────────────────────
h("1. AI APP STRUCTURE")
try:
    cfg = apps.get_app_config('ai')
    print(f"  App: {cfg.name}")
    print(f"  Path: {cfg.path}")
    print(f"  Models: {[m.__name__ for m in cfg.get_models()] or 'none'}")
    for fname in ['models', 'views', 'urls', 'agent', 'tools', 'prompts', 'serializers']:
        p = os.path.join(cfg.path, f'{fname}.py')
        status = '✓' if os.path.exists(p) else '✗'
        print(f"  {status} {fname}.py")
except LookupError:
    print("  ✗ App 'ai' not installed")

# ── 2. URL endpoints for AI ────────────────────────────────────────
h("2. AI URL ENDPOINTS")
resolver = get_resolver()
def walk(patterns, prefix=''):
    for p in patterns:
        if hasattr(p, 'url_patterns'):
            walk(p.url_patterns, prefix + str(p.pattern))
        else:
            path = prefix + str(p.pattern)
            if 'ai' in path.lower():
                print(f"  {path}")
walk(resolver.url_patterns)

# ── 3. Data sources available for the AI ───────────────────────────
h("3. DATA SOURCES THE AI CAN ACCESS")
checks = [
    ('catalog', 'Product', 'Products'),
    ('catalog', 'Category', 'Categories'),
    ('catalog', 'Brand', 'Brands'),
    ('catalog', 'Review', 'Reviews'),
    ('shipping', 'Zone', 'Shipping zones'),
    ('shipping', 'Rate', 'Shipping rates'),
    ('checkout', 'Order', 'Orders'),
    ('campaigns', 'Coupon', 'Coupons'),
    ('settings', 'StoreStatus', 'Store info'),
]
for label, model_name, desc in checks:
    try:
        Model = apps.get_model(label, model_name)
        count = Model.objects.count()
        status = '✓' if count > 0 else '!'
        print(f"  {status} {desc:25} {label}.{model_name:15} rows={count}")
    except LookupError:
        print(f"  ✗ {desc:25} {label}.{model_name:15} (not installed)")
    except Exception as e:
        print(f"  ? {desc:25} {e}")

# ── 4. Config / env vars ───────────────────────────────────────────
h("4. AI CONFIG (settings)")
for key in [
    'OPENROUTER_API_KEY',
    'DJANGO_OPENROUTER_API_KEY',
    'AI_MODEL',
    'OPENROUTER_MODEL',
    'OPENAI_API_KEY',
]:
    val = getattr(settings, key, None)
    if val:
        display = f"{'*' * 8}...{str(val)[-6:]}" if 'KEY' in key else str(val)
        print(f"  ✓ {key:28} = {display}")
    else:
        print(f"  ✗ {key:28} = not set")

# ── 5. Installed AI-related packages ───────────────────────────────
h("5. AI PACKAGES")
for pkg in ['openai', 'openrouter', 'anthropic', 'tiktoken', 'langchain', 'pgvector', 'redis']:
    try:
        __import__(pkg)
        print(f"  ✓ {pkg}")
    except ImportError:
        print(f"  ✗ {pkg}")

# ── 6. What tools/functions exist in the AI app ────────────────────
h("6. EXISTING TOOLS / FUNCTIONS IN AI APP")
try:
    cfg = apps.get_app_config('ai')
    for fname in ['tools', 'agent', 'services', 'utils', 'functions']:
        p = os.path.join(cfg.path, f'{fname}.py')
        if os.path.exists(p):
            print(f"\n  --- {fname}.py ---")
            import importlib
            try:
                mod = importlib.import_module(f'{cfg.name}.{fname}')
                funcs = [n for n in dir(mod) if not n.startswith('_') and callable(getattr(mod, n))]
                for fn in funcs:
                    print(f"    • {fn}")
            except Exception as e:
                print(f"    (could not import: {e})")
except LookupError:
    pass

# ── 7. Test the chat endpoint shape ────────────────────────────────
h("7. CHAT ENDPOINT — EXPECTED RESPONSE SHAPE")
print("""
  POST /api/ai/chat/  OR  /api/v1/ai/chat/
  Request:
    { "message": "show me laptops", "session_id": null }

  Must return:
    {
      "session_id": "uuid",           ← chat continuity
      "message": "text answer",       ← AI reply
      "products": [{id, name, price, images, url, ...}],   ← 0-N cards
      "chips": ["follow-up question?"],                    ← 0-N suggestions
      "requires_auth": false          ← gates when auth needed
    }
""")

# ── 8. Missing vs present summary ──────────────────────────────────
h("8. SUMMARY — WHAT'S CONNECTED")
report = []
for label, model_name, desc in checks:
    try:
        Model = apps.get_model(label, model_name)
        if Model.objects.count() > 0:
            report.append(f"  CONNECTED   {desc}")
        else:
            report.append(f"  EMPTY       {desc} (0 rows)")
    except LookupError:
        report.append(f"  MISSING     {desc}")

for line in report:
    print(line)

print()
