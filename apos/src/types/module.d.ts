// Declarações para clsx
declare module 'clsx' {
  export type ClassValue = string | number | boolean | undefined | null | { [key: string]: any } | ClassValue[];
  export default function clsx(...inputs: ClassValue[]): string;
}

// Declarações para tailwind-merge
declare module 'tailwind-merge' {
  export function twMerge(...inputs: string[]): string;
} 