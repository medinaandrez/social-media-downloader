import { extractWithYtDlp } from './extractors/ytdlp';
import { isSupportedPublicUrl } from '../src/shared/platforms';
import type { DownloadFormat, Language, PlatformId, ResolveRequest, ResolveResponse } from '../src/shared/types';

const messages = {
  es: {
    invalidMethod: 'Metodo no permitido.',
    invalidUrl: 'El link no es valido.',
    extractionFailed: 'No se pudo obtener el video publico. Verifica que el link exista, sea publico y no tenga restricciones.',
    instagramAccessRequired: 'Instagram no entrego este contenido sin sesion. Prueba otro post/reel publico accesible sin iniciar sesion.',
    noDownloadUrl: 'Extractor pendiente para esta plataforma. La app ya tiene el contrato listo para recibir URLs descargables.',
    platformMismatch: 'La plataforma elegida no coincide con el link.',
    publicProfile: 'Perfil publico',
    unsupportedPlatform: 'Esta plataforma todavia no esta soportada.',
  },
  en: {
    invalidMethod: 'Method not allowed.',
    invalidUrl: 'The link is not valid.',
    extractionFailed: 'Could not read the public video. Check that the link exists, is public, and has no restrictions.',
    instagramAccessRequired: 'Instagram did not provide this content without a session. Try another public post/reel that is accessible without signing in.',
    noDownloadUrl: 'Extractor pending for this platform. The app contract is ready to receive downloadable URLs.',
    platformMismatch: 'The selected platform does not match the link.',
    publicProfile: 'Public profile',
    unsupportedPlatform: 'This platform is not supported yet.',
  },
} satisfies Record<Language, Record<string, string>>;

export async function resolveMediaRequest(body: Partial<ResolveRequest>): Promise<{ status: number; payload: ResolveResponse }> {
  const language = body.language === 'en' ? 'en' : 'es';
  const selectedPlatform = parsePlatform(body.platform);

  if (!body.url || typeof body.url !== 'string') {
    return { status: 400, payload: { ok: false, error: messages[language].invalidUrl } };
  }

  const validation = isSupportedPublicUrl(body.url, selectedPlatform);
  if (!validation.ok) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: validation.error === 'Selected platform does not match the link'
          ? messages[language].platformMismatch
          : validation.error === 'Unsupported platform'
            ? messages[language].unsupportedPlatform
            : messages[language].invalidUrl,
      },
    };
  }

  if (validation.platform === 'instagram' || validation.platform === 'tiktok' || validation.platform === 'twitter') {
    try {
      const media = await extractWithYtDlp({
        url: validation.normalizedUrl,
        language,
        platform: validation.platform,
      });
      return { status: 200, payload: { ok: true, media } };
    } catch (error) {
      console.error(`${validation.platform} extraction failed`, error);
      return {
        status: 422,
        payload: {
          ok: false,
          error: validation.platform === 'instagram' && isAnonymousInstagramAccessError(error)
            ? messages[language].instagramAccessRequired
            : messages[language].extractionFailed,
        },
      };
    }
  }

  return {
    status: 200,
    payload: {
      ok: true,
      media: {
        id: `${validation.platform}-${Date.now()}`,
        sourceUrl: validation.normalizedUrl,
        platform: validation.platform,
        title: titleFor(validation.platform, language),
        author: messages[language].publicProfile,
        durationLabel: '00:00',
        notice: messages[language].noDownloadUrl,
        formats: createPendingFormats(),
        resolvedAt: new Date().toISOString(),
      },
    },
  };
}

export function methodNotAllowed(language: Language = 'en'): ResolveResponse {
  return { ok: false, error: messages[language].invalidMethod };
}

function parsePlatform(platform: unknown) {
  if (platform === 'twitter' || platform === 'instagram' || platform === 'facebook' || platform === 'tiktok') {
    return platform;
  }
  return undefined;
}

function isAnonymousInstagramAccessError(error: unknown) {
  const details = error instanceof Error ? `${error.message} ${'stderr' in error ? String(error.stderr) : ''}` : String(error);
  const normalized = details.toLowerCase();

  return normalized.includes('empty media response')
    || normalized.includes('without being logged-in')
    || normalized.includes('login required');
}

function createPendingFormats(): DownloadFormat[] {
  return [
    ['video-high', 'video', 'high', 'MP4 HD', 'mp4', 'video/mp4'],
    ['video-medium', 'video', 'medium', 'MP4', 'mp4', 'video/mp4'],
    ['video-low', 'video', 'low', 'MP4 ligero', 'mp4', 'video/mp4'],
    ['audio-high', 'audio', 'high', 'Audio HQ', 'm4a', 'audio/mp4'],
    ['audio-medium', 'audio', 'medium', 'Audio', 'm4a', 'audio/mp4'],
    ['audio-low', 'audio', 'low', 'Audio ligero', 'm4a', 'audio/mp4'],
  ].map(([id, kind, quality, label, extension, mimeType]) => ({
    id,
    kind: kind as DownloadFormat['kind'],
    quality: quality as DownloadFormat['quality'],
    label,
    extension,
    mimeType,
    status: 'extractor_required',
  }));
}

function titleFor(platform: PlatformId, language: Language) {
  const titles = {
    es: {
      twitter: 'Video publico de Twitter',
      instagram: 'Post o reel publico de Instagram',
      facebook: 'Video o reel publico de Facebook',
      tiktok: 'Video publico de TikTok',
    },
    en: {
      twitter: 'Twitter public video',
      instagram: 'Instagram public post or reel',
      facebook: 'Facebook public video or reel',
      tiktok: 'TikTok public video',
    },
  } satisfies Record<Language, Record<PlatformId, string>>;

  return titles[language][platform];
}
