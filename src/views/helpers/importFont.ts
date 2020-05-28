// DEPENDENCIES
import { SafeString } from 'handlebars';

// GLOBAL VARIABLES
const spaces = /\s+/gui;

export function importFont(name: string): SafeString {
  const font = name.replace(spaces, '+');
  return new SafeString(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font}&subset=latin&display=block" />`);
}
