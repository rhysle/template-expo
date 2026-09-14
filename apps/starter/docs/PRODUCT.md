# Product Specification

> Use this document when turning the template into a real app. Keep it short, describe the
> product's observable behavior, and remove sections that do not apply. Do not put credentials,
> API keys, or other secrets here.

| Field          | Value        |
| -------------- | ------------ |
| Product name   | _TBD_        |
| Status         | Draft        |
| Owner          | _TBD_        |
| Last updated   | _YYYY-MM-DD_ |
| Target release | _TBD_        |

## Product Summary

### One-sentence description

_What does the app do, for whom, and why is it useful?_

### Problem

_Describe the user problem and the situation in which it occurs. Focus on the problem rather than
the proposed implementation._

### Desired outcome

_What should become easier, faster, safer, or more enjoyable for the user?_

### Success signals

- _How will we know the app is useful?_
- _Which qualitative or quantitative signals matter?_

## Users

### Primary user

- **Who:** _TBD_
- **Situation:** _When and where do they use the app?_
- **Goal:** _What are they trying to accomplish?_
- **Current pain:** _What is difficult today?_

### Secondary users

_List only meaningful secondary audiences, or write “None for v1.”_

## Scope

### V1 goals

- _The smallest valuable outcome the first release must deliver._

### Non-goals

- _Behavior explicitly excluded from v1._

### Possible later work

- _Ideas worth remembering that must not expand the current scope._

## Core Experience

### Primary user flow

1. _Entry point or trigger._
2. _Main user action._
3. _Feedback or result._
4. _How the user saves, shares, repeats, or exits._

### First-run experience

_Describe onboarding, permission requests, initial configuration, and the first useful result. Ask
for permissions only when their purpose is clear to the user._

### Navigation

| Destination     | Purpose        | How users reach it |
| --------------- | -------------- | ------------------ |
| _Example: Home_ | _Primary task_ | _Default tab_      |

## Product Requirements

Write requirements as observable outcomes. Add identifiers only when they help discussion and
testing; a small app does not need a large requirements catalog.

| ID     | Requirement     | Priority | Acceptance notes              |
| ------ | --------------- | -------- | ----------------------------- |
| PR-001 | _The user can…_ | Must     | _A concrete, testable result_ |

Priority values:

- **Must:** Required for the target release.
- **Should:** Important, but the release remains useful without it.
- **Could:** Optional if time permits.

## States and Edge Cases

Define only the states relevant to this product.

- **Loading:** _What does the user see while work is in progress?_
- **Empty:** _What does a new user see before data exists?_
- **Error:** _What can fail, and how can the user recover?_
- **Offline:** _Which behavior remains available without a connection?_
- **Permission denied:** _What still works, and how can the user retry?_
- **Unsupported device or capability:** _How is the limitation explained?_
- **Interrupted flow:** _What happens after backgrounding, termination, or cancellation?_

## Monetization

- **Business model:** _Free, paid, subscription, ads, or a combination._
- **Free experience:** _What remains useful without payment?_
- **Premium value:** _Which outcomes require the configured RevenueCat entitlement?_
- **Paywall timing:** _Where and why is the paywall presented?_
- **Restore and cancellation:** _How can users restore access and understand subscription state?_
- **Ads:** _Formats, placements, frequency, and the ad-free behavior when ads are disabled._

Write “Not used” for integrations the product does not need, then remove their sample UI and code
paths during implementation.

## Data, Privacy, and Permissions

| Data or permission    | Purpose                      | Storage or recipient  | Retention/deletion |
| --------------------- | ---------------------------- | --------------------- | ------------------ |
| _Example: Microphone_ | _Measure sound while active_ | _Processed on device_ | _Not retained_     |

- _What personal or sensitive data is collected?_
- _Which data stays on the device, and which data leaves it?_
- _Which third-party services receive data?_
- _How can users withdraw consent, delete data, or disable optional processing?_
- _Does the app need a product-specific Android backup policy?_

## Analytics

Track decisions that improve the product, not every interaction.

| Event               | Trigger                         | Useful properties       | Product question answered        |
| ------------------- | ------------------------------- | ----------------------- | -------------------------------- |
| _feature_completed_ | _User receives the core result_ | _Non-sensitive context_ | _Do users reach the main value?_ |

- **Primary funnel:** _TBD_
- **Retention signal:** _TBD_
- **Events intentionally excluded:** _Sensitive or unnecessary behavior that must not be tracked._

## Localization and Accessibility

- **Launch languages:** _TBD_
- **RTL behavior:** _Expected behavior for supported RTL languages._
- **Dynamic text:** _How layouts behave with longer translations and larger text sizes._
- **Screen reader behavior:** _Labels, reading order, and announcements that matter._
- **Motion and haptics:** _Reduced-motion behavior and whether feedback has a non-haptic equivalent._
- **Color and contrast:** _Information must not depend on color alone._

## Platform and Device Support

- **Platforms:** _iOS, Android, or both._
- **Form factors:** _Phone, tablet, or both._
- **Orientation:** _Portrait, landscape, or both._
- **Required hardware:** _Camera, microphone, sensors, Bluetooth, etc._
- **Platform differences:** _Intentional differences in behavior or UI._
- **Deep links, sharing, or external integrations:** _TBD_

## Product Configuration

Complete or explicitly disable every applicable integration before release:

- [ ] App name, identifiers, scheme, EAS project, and visual assets
- [ ] Routes, tabs, onboarding, settings, and product copy
- [ ] Supported locales and translated strings
- [ ] Firebase project and product analytics events
- [ ] RevenueCat products, entitlement, paywall, and restore behavior
- [ ] AdMob identifiers, placements, and consent flow, or ads fully disabled
- [ ] Sentry project and diagnostics policy
- [ ] Support contact, legal URLs, privacy policy, and store identifiers
- [ ] OTA update policy
- [ ] App Store and Google Play metadata, screenshots, and reviewer information

## Release Acceptance

The release is ready when:

- [ ] Every **Must** requirement has been verified on its target platform
- [ ] Onboarding reaches the first useful result without unnecessary steps
- [ ] Empty, error, offline, denied-permission, and interrupted states behave as specified
- [ ] Premium access, purchase restoration, ads, and consent have been tested when applicable
- [ ] Analytics and diagnostics exclude sensitive data
- [ ] Accessibility and supported languages have been reviewed
- [ ] All template sample content and placeholder configuration have been replaced or removed
- [ ] Store listing claims match the implemented product

## Open Questions

| Question | Owner | Needed by    | Resolution |
| -------- | ----- | ------------ | ---------- |
| _TBD_    | _TBD_ | _YYYY-MM-DD_ | _Pending_  |

## Change Log

Record only meaningful product-scope decisions; detailed implementation history belongs in Git.

| Date         | Change          | Reason |
| ------------ | --------------- | ------ |
| _YYYY-MM-DD_ | _Initial draft_ | _TBD_  |
