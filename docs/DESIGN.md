# Design system

## Colour
| Token | Value | Use |
|---|---|---|
| `--gm-accent` | `#0FB5C3` | Turquoise brand accent, primary actions |
| `--gm-accent-strong` | `#0A93A6` | Pressed / gradient end, links |
| `--gm-accent-soft` | `#E6F8FA` | Tinted backgrounds, chips |
| `--gm-ink` | `#0B1B2B` | Text |
| `--gm-ink-3` | `#74859A` | Secondary text |
| `--gm-bg` | `#FFFFFF` | App background (white) |
| Support | `#2FD18A` mint · `#FFB020` amber · `#FF5A5F` coral · `#8B7CF6` violet · `#5EC8FF` sky | Status & categories |

## Liquid Glass
`.glass` = translucent gradient + `backdrop-filter: blur(22px) saturate(180%)` + specular rim (masked gradient border) + soft shadow.
Variants: `.strong`, `.tinted` (turquoise), `.flat` (same look **without** live blur — used for list cards so scrolling stays at 60 fps).
Live blur is reserved for floating layers: tab bar, headers, hero card, composer, lock screen.

## Motion
All animations are transform/opacity only (GPU-composited) and respect *Reduce Motion*.
- Welcome: parallax clouds, floating plane, letter-by-letter title, take-off sequence + circular reveal.
- Navigation: custom depth transition (`page-transition.ts`), sliding glass tab indicator, icon bounce.
- Content: skeleton shimmer while tabs load, scroll-reveal (`gmReveal`), springy press (`gmPressable`), count-up numbers (`gmCountUp`).
- Details: rolling countdown digits, plane gliding on the route arc, 3D boarding-pass flip, drawn checkmarks, chat bubble pop-in, typing dots.

Typography is the system font (SF Pro on iOS) — no web fonts to download.
