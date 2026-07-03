export function formatCurrency(value: number | string | undefined, currency = "USD") {
  if (value === undefined || value === null) return "—";
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(numericValue)) return String(value);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(numericValue);
  } catch {
    return `${currency} ${numericValue.toFixed(2)}`;
  }
}

export function fieldLabel(path: string): string {
  return path
    .split(".")
    .map((part) => part.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(" › ");
}
