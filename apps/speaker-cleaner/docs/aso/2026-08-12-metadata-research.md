# ASO Metadata Research — 2026-08-12

## Outcome

The launch package targets the clearest high-intent category phrase in each market, then uses secondary metadata to position the app as a complete audio toolkit rather than another single-purpose water-eject utility.

Primary intent:

- Water eject / remove water from speaker
- Speaker cleaner / clean speaker
- Clear wave / liquid remover

Secondary intent:

- Tone or frequency generator
- Stereo / left-right speaker test
- dB / decibel / sound meter
- Dust, debris, moisture, audio test, and speaker check

## Evidence

The Apple app record `6799632468` returned no public US listing and the Google Play package returned HTTP 404 on 2026-08-12, so this is a launch strategy rather than an optimization of existing rankings. Public Apple search results showed a mature category:

| Search theme | Representative competitor | US rating count observed | Signal |
| --- | --- | ---: | --- |
| water eject | [Clear Wave](https://apps.apple.com/us/app/clear-wave/id1557211189) | 36,001 | Broad “clear wave” concept has strong recognition |
| water eject / speaker cleaner | [Water Eject ‒ Speaker Cleaner](https://apps.apple.com/us/app/water-eject-speaker-cleaner/id6499516431) | 30,128 | Exact high-intent phrase is highly competitive |
| tone generator / water eject | [Sonic \| Water Eject](https://apps.apple.com/us/app/sonic-water-eject/id986999895) | 20,573 | Tone generation is a credible adjacent intent |
| water eject | [Water Eject°](https://apps.apple.com/us/app/water-eject/id6453523330) | 8,150 | Short exact-match title can rank without describing the full product |
| decibel meter | [Decibel X](https://apps.apple.com/us/app/decibel-x-db-sound-level-meter/id448155923) | 160,592 | dB meter is valuable but far more competitive as a primary category |

Google Play public search placed [Speaker Cleaner - Remove Water](https://play.google.com/store/apps/details?id=com.mobiletrendyapps.speaker.cleaner.remove.water) prominently; its public listing showed a 4.5 rating, 206K reviews, and 10M+ downloads. This confirms that Android titles and descriptions need strong exact-match relevance while avoiding unreadable keyword stuffing.

Apple public searches were repeated with native seed phrases in all supported markets. Results directly supported local phrases such as `limpiar altavoz / quitar agua`, `nettoyer haut-parleur / eau`, `Lautsprecher reinigen / Wasser`, `limpar alto-falante / água`, `pulizia altoparlante / acqua`, `スピーカー水抜き`, `스피커 물빼기`, `очистка динамика от воды`, `làm sạch loa / đẩy nước`, `扬声器排水清洁`, and `喇叭排水清潔`. Bengali and Hindi searches had insufficient localized results, so their metadata uses clear native-language intent plus the familiar English technical terms `dB`, `Hz`, and `stereo`.

## Metadata decisions

- Keep the exact English title `Water Eject – Speaker Cleaner` because it expresses the strongest launch intent within 30 characters.
- Use local search language in every non-English title instead of translating word by word.
- Use `Clear Wave, Liquid Remover` in the English iOS subtitle and a natural market equivalent elsewhere, keeping the subtitle focused on the primary cleaning outcome rather than secondary tools.
- Move tone, frequency, stereo, sound, and dB concepts into the hidden iOS keyword field. Remove left/right channel terms and wave equivalents, then add clean and phone intent where those concepts are not already covered by the title or subtitle. Omit spaces after commas and avoid competitor references.
- Give Android a benefit-led short description and a naturally keyword-rich full description because Google indexes description text.
- Use Utilities as the primary Apple category; the app is a practical device/audio tool, while Music is a secondary competitive context.
- Lead conversion copy with guided cleaning, then prove breadth through tone, stereo, and dB tools.
- Retain accurate limitations: the app cannot guarantee removal, and its dB meter is not calibrated professional or medical equipment.

## Keyword refinement — 2026-08-12

Public Apple searches confirmed the supplied phrases are relevant category language:

| Language | Supplied phrases | Metadata treatment |
| --- | --- | --- |
| Arabic | `تنظيف السماعات`, `تنضيف السماعات` | The title already supplies correct `تنظيف` plus singular `السماعة`; keywords add plural `سماعات`, common variant `تنضيف`, and phone/clean intent without repeating the complete title phrase. |
| Spanish | `sacar agua de las bocinas`, `sacar agua`, `limpiador de bocina`, `limpiar altavoz gratis`, `expulsar agua` | Keywords add `sacar`, `expulsar`, and LatAm `bocina`; the title supplies `agua`, `limpiar`, and `altavoz`. `gratis` is excluded because Apple does not need free-price language in the keyword field. |
| Russian | `чистка динамика`, `очистка динамика`, `вода в динамике`, `убрать воду из динамика` | Keywords add `чистка`, `убрать`, and inflected `воду`; the title already supplies `очистка`, `динамика`, and `воды`. |

`Clear Wave` is used as the requested generic category descriptor, not as a reference to a specific competing product. Every localized keyword field preserves secondary feature discovery while prioritizing the cleaning and phone terms requested in this refinement.

## Validation rules

The package follows the current limits documented by [Apple App Store Connect](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information) and [Google Play](https://support.google.com/googleplay/android-developer/answer/13393723):

| Platform | Field | Limit |
| --- | --- | ---: |
| iOS | Name | 30 |
| iOS | Subtitle | 30 |
| iOS | Keywords | 100 |
| iOS | Promotional text | 170 |
| iOS | Description | 4,000 |
| Android | Title | 30 |
| Android | Short description | 80 |
| Android | Full description | 4,000 |

Fastlane locale-directory and upload behavior was verified against the installed Fastlane 2.234.0 documentation and [Fastlane supply documentation](https://docs.fastlane.tools/actions/supply/). No store upload is performed by this change.

## Measurement plan

After launch, measure by locale weekly for the first eight weeks:

1. Search impressions and product-page/store-listing visitors.
2. Conversion rate by territory and acquisition source.
3. Rankings for the localized primary and secondary terms.
4. Paid conversion and retention by locale to detect low-intent traffic.
5. Rotate weak secondary terms quarterly; keep high-converting title terms stable unless data supports a change.
