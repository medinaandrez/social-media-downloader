import type { DownloadFormat, Language } from './types';

type ExtractorRequiredPreset = 'full' | 'video-only';

const extractorRequiredLabels = {
  es: {
    'video-high': 'Video pendiente',
    'video-medium': 'Video pendiente',
    'video-low': 'Video pendiente',
    'audio-high': 'Audio pendiente',
    'audio-medium': 'Audio pendiente',
    'audio-low': 'Audio pendiente',
  },
  en: {
    'video-high': 'Pending video',
    'video-medium': 'Pending video',
    'video-low': 'Pending video',
    'audio-high': 'Pending audio',
    'audio-medium': 'Pending audio',
    'audio-low': 'Pending audio',
  },
} satisfies Record<Language, Record<string, string>>;

const extractorRequiredDefinitions = {
  full: [
    ['video-high', 'video', 'high', 'mp4', 'video/mp4'],
    ['video-medium', 'video', 'medium', 'mp4', 'video/mp4'],
    ['video-low', 'video', 'low', 'mp4', 'video/mp4'],
    ['audio-high', 'audio', 'high', 'm4a', 'audio/mp4'],
    ['audio-medium', 'audio', 'medium', 'm4a', 'audio/mp4'],
    ['audio-low', 'audio', 'low', 'm4a', 'audio/mp4'],
  ],
  'video-only': [
    ['video-high', 'video', 'high', 'mp4', 'video/mp4'],
  ],
} as const satisfies Record<ExtractorRequiredPreset, readonly (readonly [string, DownloadFormat['kind'], DownloadFormat['quality'], string, string])[]>;

export function createExtractorRequiredFormats(
  language: Language,
  preset: ExtractorRequiredPreset = 'full',
): DownloadFormat[] {
  return extractorRequiredDefinitions[preset].map(([id, kind, quality, extension, mimeType]) => ({
    id,
    kind,
    quality,
    label: extractorRequiredLabels[language][id],
    extension,
    mimeType,
    status: 'extractor_required' as const,
  }));
}
