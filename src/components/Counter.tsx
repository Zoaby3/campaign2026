import { useState } from 'react'

export type CounterProps = {
  initial?: number
  onChange?: (value: number) => void
}

export default function Counter({ initial = 0, onChange }: CounterProps) {
  const [count, setCount] = useState(initial)

  const increment = () => {
    setCount((c) => {
      const next = c + 1
      onChange?.(next)
      return next
    })
  }

  return (
    <div className="card">
      <button onClick={increment}>count is {count}</button>
      <p>
        Edit <code>src/components/Counter.tsx</code> and save to test HMR
      </p>
    </div>
  )
}
