import type { DbTimelinePoint } from './types'

export const appendMeterTimelinePoint = (
  timeline: readonly DbTimelinePoint[],
  second: number,
  estimatedDb: number,
  maxPoints = 3_600
): readonly DbTimelinePoint[] => {
  if (!Number.isFinite(second) || !Number.isFinite(estimatedDb)) return timeline
  const safeSecond = Math.max(Math.round(second * 1_000) / 1_000, 0)
  if ((timeline.at(-1)?.second ?? -1) >= safeSecond) return timeline
  const pointLimit = Number.isFinite(maxPoints) ? Math.max(Math.floor(maxPoints), 1) : 1
  const nextTimeline = [
    ...timeline,
    {
      second: safeSecond,
      estimatedDb: Math.round(Math.min(Math.max(estimatedDb, 0), 120)),
    },
  ]
  if (nextTimeline.length <= pointLimit) return nextTimeline

  const detailedTailCount = Math.max(Math.floor(pointLimit / 2), 1)
  const olderPoints = nextTimeline.slice(0, -detailedTailCount)
  const detailedTail = nextTimeline.slice(-detailedTailCount)
  const compactedOlderPoints = olderPoints.filter((_, index) => index % 2 === 0)
  return [...compactedOlderPoints, ...detailedTail].slice(-pointLimit)
}
