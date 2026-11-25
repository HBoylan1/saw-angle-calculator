# Saw Angles

A phone calculator for miter saw settings: crown molding, baseboard, compound (tilted board) cuts and frames, at any corner angle.

**Use it:** open the app's web address in Safari on your iPhone, tap **Share → Add to Home Screen**. It gets its own icon, runs full screen, and works offline.

## What it does

| Mode | For | You enter |
|---|---|---|
| Crown | Crown molding at inside or outside corners, and on sloped (cathedral, gable, stair) ceilings | Corner angle or ceiling slope (degrees or rise per 12″), crown angle (from the wall or the ceiling), flat or nested cutting |
| Baseboard | Square-edged trim standing against the wall | Corner angle, standing or flat on the saw |
| Compound | Splayed boxes, hoppers, planters, trim tilted off plumb | Number of sides or corner angle, tilt from plumb or level, lean in/out |
| Frame | Casing, picture frames, anything flat in one plane, including boards of different widths | Corner angle across the opening (up to 359°), left and right board widths |

For each piece it shows the miter and bevel, which way to swing and tilt, which edge goes against the fence, which side of the blade to keep, and a top-view picture of the cut. Under the gear icon you set whether your blade tilts left, right or both ways, and your saw's maximum miter and bevel; when a cut is past those limits, the app switches to a setup that works: first another normal fence setup (nested instead of flat, standing instead of flat), then a clamped setup with the board held against an angled block (45° by default) or square to the fence.

## Display settings

Under the gear icon:

- **Easy Reading Mode** switches every bit of text, including the diagrams, to Atkinson Hyperlegible, a font from the Braille Institute where every letter and number looks distinct. The font is included in the app (`fonts/`, SIL Open Font License), so it works offline.
- **High-visibility layout** gives each number its own full-width row in very large type, with the direction beside it. It also switches to pure black-and-white high contrast (light or dark, following the phone) and enlarges buttons and inputs. Each card leads with the setup and which piece to keep; the steps, a smaller saw picture and the safety note fold away under "Steps & picture", and extra notes collect under "More notes".

## How the math works

Every mode uses one 3D model (`js/geometry.js`):

1. The trim is described in a frame tied to the wall (along the wall, out from the wall, up).
2. The joint is the plane that bisects the corner.
3. That plane is rotated into the saw's frame for however the board sits on the saw (flat, nested, on edge).
4. The miter and bevel are read straight off the plane's normal vector. Left/right directions and which piece to keep come from the same calculation, not from a lookup chart.

`tests/test.html` checks the engine against published crown and hopper tables and the standard crown cutting charts. Open it through any local web server to run it.

## Versions

See [CHANGELOG.md](CHANGELOG.md). Each release is tagged in git (`v1.0.0`, ...).

To ship a new version: update `js/version.js`, the `CACHE` name in `sw.js`, and `CHANGELOG.md`, then commit and tag.
