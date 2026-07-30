# Mascot states

## References

- `assets/animations/mascot/eject.json` — current whale idle animation.
- User reference screenshot — Eject idle layout with the whale as the hero.

## Interaction inventory

| Trigger                                  | Result                                                         | Surface             | States and rules                                                                                                                                                                                                          | Status          |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Theme or semantic mascot color changes   | Recolor the whale with a smooth palette transition             | Every `MascotHero`  | Body, tail, and fin use the accent; the eye and belly use derived contrast and tint shades. Crossfade the complete old/new palettes over 260 ms. An explicit `accentColor` overrides the theme.                           | Agreed          |
| Reduced Motion is enabled                | Stop decorative mascot playback                                | Every `MascotHero`  | Display a stable animation frame; functional status text and controls remain unchanged.                                                                                                                                   | Agreed          |
| Eject cycle starts                       | Add a small looping whale-spout effect                         | Eject hero          | Overlay a transparent, canvas-aligned Lottie without replacing or moving the whale. Start with the Eject cycle and remove it after stop, completion, or error. Hide the decorative effect when Reduced Motion is enabled. | Agreed          |
| Tone frequency or playback state changes | Change the whale treatment to match the tone state             | Tone Generator hero | Color already follows the existing frequency-band color. The exact expression set and frequency-to-expression mapping require approved animation assets.                                                                  | Decision needed |
| Meter band changes                       | Change whale color and expression for the measured sound level | dB Meter hero       | Color follows `veryQuiet`, `normal`, `loud`, and `danger`. The exact calm/happy/concerned/alarmed expression mapping and transition behavior require approved animation assets.                                           | Decision needed |

## Animation asset contract

- Export one local JSON Lottie per genuinely different motion or expression; do not load mascot animations from remote URLs.
- Keep the recolorable layer names `Body`, `Tail`, `Fin`, `Eye`, `Eye white`, and `Belly 1` through `Belly 5` in every variant.
- Name theme-colored water layers `Spout left`, `Spout center`, and `Spout right`.
- Keep the same composition size and visible alignment so swapping `animationSource` does not move the hero.
- Canvas-aligned effect files may contain only transparent accessory layers and are rendered above the base mascot.
- Prefer short seamless loops. Any one-shot transition must declare its start/end frames or Lottie markers before implementation.
- Avoid embedded raster images for recolorable parts because runtime color filters target vector layers.

## Acceptance notes

- Changing `theme.colors.primary.main` recolors the default mascot without screen changes.
- Tone Generator and dB Meter pass their existing semantic status colors through `accentColor`.
- Palette changes crossfade without flashing the original gray source, and the Eject spout stays aligned with the whale at compact and regular sizes.
- Verify themed source rendering, crossfades, and effect playback on both iOS and Android.
