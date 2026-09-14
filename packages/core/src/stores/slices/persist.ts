export type NonFunctionKeys<T extends object> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? never : K
}[keyof T]

export type PersistedState<T extends object, ExcludedKeys extends keyof T = never> = Omit<
  Pick<T, NonFunctionKeys<T>>,
  ExcludedKeys
>
