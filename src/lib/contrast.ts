export type ThemeColors = {
  bg: string;
  text: string;
  accent: string;
  highlight: string;
};

export const MIN_TEXT_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Highlight terhadap bg sengaja tidak dicek: gold di atas putih memang < 3:1, bentuknya dijaga border.
const CHECKED_PAIRS = [
  ['text', 'bg'],
  ['accent', 'bg'],
  ['text', 'highlight'],
] as const;

export function findContrastFailures(theme: ThemeColors): string[] {
  return CHECKED_PAIRS.filter(([foreground, background]) => contrastRatio(theme[foreground], theme[background]) < MIN_TEXT_CONTRAST)
    .map(([foreground, background]) => `${foreground}/${background}`);
}
