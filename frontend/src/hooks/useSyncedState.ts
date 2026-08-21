import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Local editable state derived from an external source (a store value, a prop).
 * When the source changes identity the draft is re-seeded during render — React's
 * documented "adjusting state when a prop changes" pattern, which avoids the
 * cascading re-render an effect would cause.
 */
export function useSyncedState<S, T>(source: S, map: (source: S) => T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState<T>(() => map(source))
  const [tracked, setTracked] = useState(source)

  if (source !== tracked) {
    setTracked(source)
    setDraft(map(source))
  }

  return [draft, setDraft]
}
