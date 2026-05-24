export const productionApiBaseUrl = 'https://socialm-downloader.vercel.app';

export const historyLimit = 25;

export function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}
