export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassDictionary
  | ClassArray;

type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassArray = ClassValue[];

function toClassName(value: ClassValue): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toClassName).filter(Boolean).join(' ');
  }

  return Object.entries(value)
    .filter(([, include]) => Boolean(include))
    .map(([key]) => key)
    .join(' ');
}

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassName).filter(Boolean).join(' ');
}
