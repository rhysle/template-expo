# Design interaction specifications

Visual references in this directory show an initial UI state. Each substantial design-led feature should also have a focused Markdown interaction specification in this directory, named after the feature (for example, `add-subscription.md` or `calendar.md`). These files are product-specific; this document is the reusable format guide.

## When to create one

Create or update a specification before implementing behavior that is not explicit in the visual design. This includes picker and search behavior, navigation, filters, state changes, validation, custom sheets, and empty, loading, error, or active states. Platform-native controls do not need bespoke visual mocks, but their opening, selected-value display, cancellation, validation, and persistence behavior must still be documented.

## Suggested format

```md
# Feature name

## References

- `feature.png` — the agreed initial screen

## Interaction inventory

| Trigger | Result | Surface | States and rules | Status |
| --- | --- | --- | --- | --- |
| User taps the control | Describe the outcome | Screen, bottom sheet, native control, etc. | Selection, dismissal, validation, persistence, and edge cases | Agreed / Decision needed |

## Acceptance notes

- List intentional platform-native differences from the visual reference.
- List behavior that must be exercised during design comparison and QA.
```

Keep each entry concise and concrete. Do not implement rows marked `Decision needed` until the product behavior is agreed.
