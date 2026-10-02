# Grain Gradient Generator

A full-screen, grainy, lo-fi gradient made of blending colour blobs.

- Move the cursor (or drag on touch) to steer the gradient. After 3 seconds idle it drifts on its own.
- Click or tap anywhere (or press Space) for new random colours.
- Click a colour circle to copy its hex code. Use the padlock to keep a colour when re-rolling.

Open `gradient-index.html`. With GitHub Pages it's served at `/grain-gradient-generator/gradient-index.html`.

## Adding and removing blobs

From the browser console, or from any future UI:

```js
grainGradient.addBlob();            // add a random colour (up to 7)
grainGradient.addBlob('#00ff88');   // add a specific colour
grainGradient.removeBlob();         // remove the last blob
grainGradient.removeBlob(1);        // remove the blob at index 1
```

The swatches update automatically. Grain size, grain strength, colour levels and motion speeds are in `CONFIG` at the top of `script.js`.
