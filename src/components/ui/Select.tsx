type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  className?: string;
  disabled?: boolean;
};
export function Select({
  value,
  onValueChange,
  options,
  className = "",
  disabled,
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="rounded-xl px-4 py-2 pr-9 font-semibold text-[#1e1e1e] border border-transparent bg-white text-sm appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M6 9L1 4H11L6 9Z" fill="#1e1e1e" />
        </svg>
      </div>
    </div>
  );
}
