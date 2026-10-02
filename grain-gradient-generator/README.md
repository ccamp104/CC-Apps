# Grain Gradient Generator

A full-screen, grainy, lo-fi gradient made of blending colour blobs.

- Move the cursor (or drag on touch) to steer the gradient. After 3 seconds idle it drifts on its own.
- Click or tap anywhere (or press Space) for new random colours.
- Click a colour circle to copy its hex code. Use the padlock to keep a colour when re-rolling.
- Use the + circle above the swatches to add a colour (up to 7), and the × on a swatch to remove it (down to 2).
- The gear below the swatches opens the settings. Each setting has a slider and a number box; typed values outside the range snap to the nearest limit.

Open `gradient-index.html`. With GitHub Pages it's served at `/grain-gradient-generator/gradient-index.html`.

The swatches update automatically. Defaults live in `CONFIG` and the slider ranges in `SETTINGS`, both at the top of `script.js`.
