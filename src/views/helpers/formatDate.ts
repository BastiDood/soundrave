// GLOBAL VARIABLES
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatDate(precision: 'year'|'month'|'day', dateMs: number): string {
  const date = new Date(dateMs);
  const year = date.getFullYear();
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  if (precision === 'day')
    return `${month} ${day}, ${year}`;
  else if (precision === 'month')
    return `${month} ${year}`;
  return `${year}`;
}
