# Grain Gradient Generator

A full-screen, grainy, lo-fi gradient made of blending colour blobs.

- Move the cursor (or drag on touch) to steer the gradient. After 3 seconds idle it drifts on its own.
- Click or tap anywhere (or press Space) for new random colours.
- Click a colour circle to copy its hex code. Use the padlock to keep a colour when re-rolling.
- Use the + circle above the swatches to add a colour (up to 7), and the × on a swatch to remove it (down to 2).
- The gear below the swatches opens the settings panel. Each setting has a fader and a number readout; typed values outside the range snap to the nearest limit.
- Drag the panel by its header (or focus the header and use the arrow keys). The page stays live behind it, and the panel takes its colours from the current gradient.
- Resize the panel from its bottom-right corner (or focus the corner and use the arrow keys). The whole panel scales up or down together.
- Turn on the Idle switch in the panel (or press I anywhere) to stop the blobs following the cursor. The gradient also goes idle while the cursor is over the panel.
- Wander (in the Motion bank) sets how fast the idle drift moves.
- The Shape bank controls the blobs: Blend (how much colours mix), Softness (defined to hazy edges) and Wobble (round to rippling outlines).

Open `gradient-index.html`. With GitHub Pages it's served at `/grain-gradient-generator/gradient-index.html`.

## Adding and removing blobs

From the browser console, or from any future UI:

```js
grainGradient.addBlob();            // add a random colour (up to 7)
grainGradient.addBlob('#00ff88');   // add a specific colour
grainGradient.removeBlob();         // remove the last blob
grainGradient.removeBlob(1);        // remove the blob at index 1
```

The swatches update automatically. Defaults live in `CONFIG` and the fader ranges in `SETTINGS`, both at the top of `script.js`. Adding an entry to `SETTINGS` adds a fader; a new `bank` name adds a new bank.
