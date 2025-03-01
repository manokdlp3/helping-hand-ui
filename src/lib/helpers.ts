/**
 * Formats a numeric value as currency
 * @param value Numeric value or string representing a number
 * @returns Formatted currency string
 */
export const formatCurrency = (value: string | number) => {
  return `$${parseFloat(value.toString()).toFixed(2)} USD`;
}; 