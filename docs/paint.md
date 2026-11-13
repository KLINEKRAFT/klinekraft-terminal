# Klinekraft Paint

The toolbox/canvas/palette arrangement and interaction model were researched against
[JS Paint](https://github.com/1j01/jspaint) and
[the React/Redux XP Paint recreation](https://github.com/ramosmikel/ms-paint).
This is a native Klinekraft implementation inspired by those projects, not an
embedded copy or a complete port of JS Paint. No upstream source or assets are bundled.

Paint uses the terminal's existing theme colors, typography, local organizer API,
and revision-checked SQLite storage. It works without an external painting service.

Tools include pencil, brush, eraser, connected-area fill, eyedropper, line,
rectangle, ellipse, text placement, and rectangular selection. Selections can be
moved, cropped, or deleted. Canvas operations include horizontal flip, clockwise
rotation, and clear. Undo/redo includes dimensions, with undo storage bounded to
approximately 48 MiB. PNG export retains the original canvas resolution.

The palette exposes foreground/background colors. Right-click paints with the
background color or assigns a palette swatch to the background. Erasing and
clearing use the background color. Shape options are outline, solid fill, or
foreground outline with background fill. Shift constrains lines and shapes.

Keyboard shortcuts work when focus is in Paint and outside a text/select field:
P pencil, B brush, E eraser, F fill, I eyedropper, L line, R rectangle, O ellipse,
T text, S select; Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo,
Ctrl/Cmd+S save, Delete selected pixels, Escape deselect.

PNG, JPEG, WebP, and BMP files up to 12 MiB can be imported as new drawings.
Imports fit proportionally within the existing 1600 × 1200 persistence limit.
Transparent imports are flattened onto the selected background. Rotation is
limited to canvases at most 1200 pixels wide so the result fits that limit.
Fill currently matches exact RGBA colors; it does not have a tolerance setting.
Text is rasterized when placed. Lasso selection, curves, layers, and editable text
objects are not implemented.

Edits autosave after one second and maintain a browser recovery draft. Drawing
continues during a save; newer edits retain the server revision and are saved in
a follow-up request. Save failures retain dirty state and the recovery draft.
New/Open/Import remain unavailable until saving succeeds. A failed save offers
Save a copy (new ID) or PNG export, including when another tab changed the saved
revision. A browser reload warns while changes remain unsaved.

Validation: `npm run build` and `node --test unit-tests/paintPixels.test.ts`.
Browser checks cover drawing, text, fill, crop/undo, zoom, and saved-image reopening.
