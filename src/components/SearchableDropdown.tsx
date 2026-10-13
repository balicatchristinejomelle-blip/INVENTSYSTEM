import React from "react"
import SearchableSelect, { type SearchableOption } from "./SearchableSelect"

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size">
function textContent(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textContent).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textContent(node.props.children)
  return ""
}

/** Preserves existing option values, disabled options, and change handlers. */
export default function SearchableDropdown({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  style,
  className,
  id,
  name,
  ...rest
}: Props) {
  const options: SearchableOption[] = []
  let placeholder = "Search options..."
  let clearable = false
  function collect(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (node) => {
      if (
        !React.isValidElement<{
          value?: string | number
          children?: React.ReactNode
          disabled?: boolean
        }>(node)
      )
        return
      if (node.type === "option") {
        const label = textContent(node.props.children)
        const optionValue = String(node.props.value ?? label)
        if (optionValue === "") {
          placeholder = label
          clearable = true
          return
        }
        options.push({
          value: optionValue,
          label,
          disabled: node.props.disabled,
        })
      } else collect(node.props.children)
    })
  }
  collect(children)
  const selectedValue = String(value ?? defaultValue ?? "")
  const ariaLabel = rest["aria-label"] || name || placeholder
  return (
    <div
      className={`searchable-dropdown ${className?.replace(/\bapp-select\b/g, "").trim() || ""}`}
      style={style}
    >
      <SearchableSelect
        id={id}
        name={name}
        value={selectedValue}
        options={options}
        disabled={disabled}
        required={required}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        clearable={clearable}
        onChange={(nextValue) => {
          const target = {
            value: nextValue,
            name: name || "",
            id: id || "",
          } as HTMLSelectElement
          onChange?.({
            target,
            currentTarget: target,
          } as React.ChangeEvent<HTMLSelectElement>)
        }}
      />
    </div>
  )
}
