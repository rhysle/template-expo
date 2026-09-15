fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios init_metadata

```sh
[bundle exec] fastlane ios init_metadata
```

Pull live ASC listing into fastlane/ios/metadata + screenshots (one-shot bootstrap).

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload iOS metadata + screenshots. Pass `metadata_only:true` to preserve screenshots or `locales:"en-US,vi"` to limit.

----


## Android

### android init_metadata

```sh
[bundle exec] fastlane android init_metadata
```

Pull live Play listing into fastlane/android/metadata (one-shot bootstrap).

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload Android metadata + listing assets against the latest internal release. Pass `metadata_only:true` to preserve listing assets or `locales:"en-US,vi"` to limit.

### android changelog

```sh
[bundle exec] fastlane android changelog
```

Upload Android default changelogs only. Resolves the latest versionCode on the selected track.

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
