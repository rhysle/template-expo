# Monetization localizations

These JSON files are the only source for localized App Store Connect and Google Play product
metadata. They are intentionally independent from the app UI resources in `src/i18n/locales/`.

Use one file per language. The filename is an internal source-locale label; `appleLocale` and
`googleLocale` are the exact locale codes sent to each store. Every file must contain all four
Apple product entries, one Google subscription listing, and one Google lifetime listing, even when
a product is currently disabled in `src/configs/monetization.ts`.

The monetization checks enforce these limits using Unicode code-point counts:

- Apple product display name: 2-35 characters.
- Apple product description: 1-55 characters.
- Google title: 1-55 characters.
- Google description: 1-200 characters.
- Google subscription benefits: 1-4 entries, each 1-40 characters.

The template wording is deliberately generic. Product forks must review every localization and
replace it when “all premium features” does not accurately describe the entitlement. Store
metadata changes are reviewable content; run `npm run monetization:plan` before applying them.
