import React from 'react';

interface CategoryTabsProps<T extends string> {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
  label?: string;
  displayLabel?: (value: T) => React.ReactNode;
  groupLabel?: string;
}

export default function CategoryTabs<T extends string>({ items, value, onChange, counts, label = 'Category', displayLabel, groupLabel }: CategoryTabsProps<T>) {
  return (
    <div className={groupLabel ? 'filter-chip-group' : 'category-tab-group'}>
    {groupLabel && <div className="field-label">{groupLabel}</div>}
    <div className="category-tabs" role="tablist" aria-label={label}>
      {items.map(item => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={value === item}
          className={value === item ? 'category-tab category-tab-active' : 'category-tab'}
          onClick={() => onChange(item)}
        >
          {displayLabel ? displayLabel(item) : item}
          {counts && <span>{counts[item] ?? 0}</span>}
        </button>
      ))}
    </div>
    </div>
  );
}
