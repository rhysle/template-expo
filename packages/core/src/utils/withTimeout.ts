/**
 * Races a promise against a timer. Rejects with `Error(message)` if the
 * underlying promise does not settle within `ms` milliseconds.
 *
 * The underlying promise is NOT cancelled - JavaScript has no native promise
 * cancellation - but its eventual settlement is ignored. The timeout error
 * takes over and the caller's `catch` runs as soon as the timer fires.
 *
 * Use whenever you await a network call that has no intrinsic deadline
 * (e.g. `expo-updates`'s `checkForUpdateAsync` / `fetchUpdateAsync`) and a
 * hung request would block a stateful guard like a "isChecking" ref.
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}
