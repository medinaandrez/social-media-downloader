import { extractWithYtDlp } from './extractors/ytdlp';
import { readDedicatedYouTubeServiceConfig, resolveWithDedicatedYouTubeService } from './youtube-service';
import { isSupportedPublicUrl } from '../src/shared/platforms';
import type { Language, PlatformId, ResolveRequest, ResolveResponse } from '../src/shared/types';

const messages = {
  es: {
    invalidMethod: 'Metodo no permitido.',
    invalidUrl: 'El link no es valido.',
    accessRequired: 'La plataforma no entrego este contenido sin iniciar sesion. Prueba otro video publico accesible sin login.',
    extractionFailed: 'No se pudo obtener el video publico. Verifica que el link exista, sea publico y no tenga restricciones.',
    instagramAccessRequired: 'Instagram no entrego este contenido sin sesion. Si la cuenta acaba de pasar de privada a publica, espera un poco y vuelve a intentarlo.',
    youtubeInvalidId: 'El link de YouTube parece incompleto o truncado. Vuelve a copiar el enlace completo desde Compartir en YouTube.',
    youtubeBotCheck: 'YouTube bloqueo esta descarga desde servidores y pidio verificacion anti-bot. Este link puede funcionar en navegador, pero no siempre desde la version web. Prueba otro video publico o intenta mas tarde.',
    youtubeServiceUnavailable: 'YouTube esta en modo beta y el servicio tardo demasiado en responder. Espera unos segundos y vuelve a intentar, o prueba otro link publico.',
    youtubeTryLater: 'YouTube no entrego este video en este momento. Puede ser una limitacion temporal de la sesion anonima o del propio video. Intenta de nuevo mas tarde.',
    platformMismatch: 'La plataforma elegida no coincide con el link.',
    timeout: 'La plataforma tardo demasiado en responder. Intenta de nuevo o prueba un video mas corto.',
    unavailable: 'No se pudo acceder a ese video. Puede estar privado, eliminado, bloqueado por region o requerir iniciar sesion.',
    unsupportedPlatform: 'Esta plataforma todavia no esta soportada.',
  },
  en: {
    invalidMethod: 'Method not allowed.',
    invalidUrl: 'The link is not valid.',
    accessRequired: 'The platform did not provide this content without signing in. Try another public video available without login.',
    extractionFailed: 'Could not read the public video. Check that the link exists, is public, and has no restrictions.',
    instagramAccessRequired: 'Instagram did not provide this content without a session. If the account was only recently switched from private to public, wait a bit and try again.',
    youtubeInvalidId: 'The YouTube link looks incomplete or truncated. Copy the full link again from YouTube Share.',
    youtubeBotCheck: 'YouTube blocked this server-side download and asked for anti-bot verification. This link may work in a browser, but not always from the web app. Try another public video or try again later.',
    youtubeServiceUnavailable: 'YouTube is in beta mode and the service took too long to respond. Wait a few seconds and try again, or try another public link.',
    youtubeTryLater: 'YouTube did not provide this video right now. This may be a temporary anonymous-session limit or a restriction on the video itself. Try again later.',
    platformMismatch: 'The selected platform does not match the link.',
    timeout: 'The platform took too long to respond. Try again or use a shorter video.',
    unavailable: 'Could not access that video. It may be private, deleted, region-blocked, or require signing in.',
    unsupportedPlatform: 'This platform is not supported yet.',
  },
} satisfies Record<Language, Record<string, string>>;

type ResolveOptions = {
  allowDedicatedYouTubeService?: boolean;
};

export async function resolveMediaRequest(
  body: Partial<ResolveRequest>,
  options: ResolveOptions = {},
): Promise<{ status: number; payload: ResolveResponse }> {
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

  if (validation.platform === 'youtube' && options.allowDedicatedYouTubeService !== false) {
    const dedicatedService = readDedicatedYouTubeServiceConfig();
    if (dedicatedService) {
      try {
        return await resolveWithDedicatedYouTubeService({
          url: validation.normalizedUrl,
          platform: validation.platform,
          language,
        }, dedicatedService);
      } catch (error) {
        console.warn('Dedicated YouTube service unavailable', error);
        return {
          status: isTimeoutError(errorDetails(error)) ? 504 : 503,
          payload: { ok: false, error: messages[language].youtubeServiceUnavailable },
        };
      }
    }
  }

  try {
    const media = await resolveWithRetries({
      url: validation.normalizedUrl,
      language,
      platform: validation.platform,
    });
    return { status: 200, payload: { ok: true, media } };
  } catch (error) {
    console.error(`${validation.platform} extraction failed`, error);
    return {
      status: extractionStatusFor(error),
      payload: {
        ok: false,
        error: extractionMessageFor(error, validation.platform, language),
      },
    };
  }
}

async function resolveWithRetries(request: {
  language: Language;
  platform: PlatformId;
  url: string;
}) {
  let lastError: unknown;
  const attempts = request.platform === 'youtube' ? 2 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await extractWithYtDlp(request);
    } catch (error) {
      lastError = error;
      const details = errorDetails(error);
      const canRetry = request.platform === 'youtube' && shouldRetryYouTubeResolve(details);
      if (!canRetry || attempt >= attempts) {
        break;
      }
      await wait(1200 * attempt);
    }
  }

  throw lastError;
}

export function methodNotAllowed(language: Language = 'en'): ResolveResponse {
  return { ok: false, error: messages[language].invalidMethod };
}

function parsePlatform(platform: unknown) {
  if (platform === 'twitter' || platform === 'instagram' || platform === 'facebook' || platform === 'tiktok' || platform === 'youtube') {
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

function extractionMessageFor(error: unknown, platform: PlatformId, language: Language) {
  const details = errorDetails(error);

  if (platform === 'instagram' && isAnonymousInstagramAccessError(error)) {
    return messages[language].instagramAccessRequired;
  }

  if (platform === 'youtube' && isYouTubeBotCheckError(details)) {
    return messages[language].youtubeBotCheck;
  }
  if (platform === 'youtube' && isYouTubeTruncatedIdError(details)) {
    return messages[language].youtubeInvalidId;
  }
  if (platform === 'youtube' && isYouTubeTryLaterError(details)) {
    return messages[language].youtubeTryLater;
  }

  if (isAccessRequiredError(details)) {
    return messages[language].accessRequired;
  }
  if (isUnavailableError(details)) {
    return messages[language].unavailable;
  }
  if (isTimeoutError(details)) {
    return messages[language].timeout;
  }

  return messages[language].extractionFailed;
}

function extractionStatusFor(error: unknown) {
  const details = errorDetails(error);
  if (isTimeoutError(details)) {
    return 504;
  }
  if (isYouTubeTryLaterError(details)) {
    return 429;
  }
  if (isYouTubeTruncatedIdError(details)) {
    return 400;
  }
  return 422;
}

function errorDetails(error: unknown) {
  return error instanceof Error ? `${error.message} ${'stderr' in error ? String(error.stderr) : ''}` : String(error);
}

function isAccessRequiredError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('login')
    || normalized.includes('log in')
    || normalized.includes('sign in')
    || normalized.includes('cookies')
    || normalized.includes('not currently available')
    || normalized.includes('confirm your age');
}

function isUnavailableError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('private')
    || normalized.includes('removed')
    || normalized.includes('unavailable')
    || normalized.includes('not found')
    || normalized.includes('blocked')
    || normalized.includes('copyright')
    || normalized.includes('unsupported url');
}

function isTimeoutError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('timed out')
    || normalized.includes('timeout')
    || normalized.includes('aborted')
    || normalized.includes('socket');
}

function isYouTubeBotCheckError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('sign in to confirm you’re not a bot')
    || normalized.includes("sign in to confirm you're not a bot")
    || normalized.includes('use --cookies-from-browser or --cookies');
}

function isYouTubeTryLaterError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes("this content isn't available, try again later")
    || normalized.includes('too many requests')
    || normalized.includes('http error 429');
}

function isYouTubeTruncatedIdError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('incomplete youtube id')
    || normalized.includes('[youtube:truncated_id]');
}

function shouldRetryYouTubeResolve(details: string) {
  return isTimeoutError(details) || isYouTubeBotCheckError(details) || isYouTubeTryLaterError(details);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
