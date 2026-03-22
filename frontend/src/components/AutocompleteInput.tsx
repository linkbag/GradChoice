import { useState, useRef, useEffect } from 'react'

interface AutocompleteInputProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function AutocompleteInput({
  options,
  value,
  onChange,
  placeholder,
  className = '',
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = inputValue
    ? options.filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()))
    : options

  function select(opt: string) {
    setInputValue(opt)
    onChange(opt)
    setOpen(false)
  }

  function handleInputChange(v: string) {
    setInputValue(v)
    setOpen(true)
    if (!v) {
      onChange('')
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => { setInputValue(''); onChange(''); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filtered.slice(0, 50).map((opt) => (
            <li
              key={opt}
              onClick={() => select(opt)}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 transition-colors"
            >
              {opt}
            </li>
          ))}
          {filtered.length > 50 && (
            <li className="px-4 py-2 text-xs text-gray-400 text-center">
              输入更多字符以缩小范围…
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
