# Changelog

## v1.3.0 — 2026-11-25

- When your saw can't make a cut (past its miter or bevel limit, or the blade would need to tilt the way it can't), the card now shows a setup that works instead of a warning:
  - First choice: another normal fence setup, such as nested instead of flat or standing instead of flat.
  - Otherwise: a clamped setup, with the numbers, steps and top-view picture for the board on the saw. The picture marks the block and where the clamps go.
- Two clamped methods, chosen under the gear icon: **Angled block** (default 45°, angle adjustable), which takes the block angle off the miter, and **Square to fence**, which cuts at 90° minus the miter. If the chosen method can't work for a piece on your saw, the app uses the other one and says why.
- Clamped setups show a short safety note on clamping and on the added risk of cutting without the board against the fence.
- Frame cuts now go through the same 3D engine as the other modes.
- One line on each card explains why the setup changed.

## v1.2.0 — 2026-11-21

- Crown on sloped ceilings: a new "Sloped ceiling" option in Crown mode for joints on a gable or stair wall:
  - **Bottom:** level crown turning up the slope.
  - **Top:** sloped crown turning level.
  - **Peak:** two slopes meeting at the ridge.
  - **Custom:** any two slopes.
- Enter the slope in degrees or as roof pitch (rise per 12″), and pick which way it rises.
- Both flat and nested settings. Nested sloped joints are a pure bevel cut, so single-tilt saws get a warning, with the flat settings to use instead, when the bevel goes the wrong way.
- Wall drawing that shows the two runs and the joint as seen from the room.
- Tips for the corner where a level wall meets a sloped wall (turn the corner, then a short level return and a Bottom joint), and for walls under a ceiling that slopes away.

## v1.1.0 — 2026-11-21

- Frame mode handles boards of different widths, such as a wide head casing meeting narrower side casings. Enter the left and right widths in any unit (3 1/2, 3-1/2, 3.5 or 89); each board gets its own miter so the joint lines up from corner to corner.
- Frame mode now accepts any corner angle up to 359° and labels it as an inside corner (under 180°) or an outside corner (over 180°, pointing into the opening).
- Frame results now give left and right pieces separately: miter direction, outer edge to the fence, which side to keep, where the long point lands, and a to-scale drawing of the joint.
- Cuts steeper than your saw's miter limit suggest the complementary cut with the board held square to the fence.

## v1.0.0 — 2026-11-20

First release.

- Crown molding at any inside or outside corner, cut flat (compound) or nested (upside down against the fence).
- Crown angle entered from the wall (spring angle) or from the ceiling, with 52/38 and 45/45 presets.
- Baseboard and square-edged trim, standing against the fence or flat on the table.
- Compound cuts for tilted boards: boxes and hoppers by number of sides, or trim at any corner; tilt entered from plumb or level, leaning in or out.
- Frame/casing miters for any corner angle.
- Settings for both pieces of every corner: miter and bevel with direction, which edge goes to the fence, which side to keep, and a top-view diagram.
- Saw settings: blade tilts left only, right only, or both; max miter and bevel with warnings and suggested alternatives.
- Works offline and installs to the iPhone home screen.

## Planned

- Walls out of plumb; uneven corners where the two pieces have different tilts.
- Saved jobs.
