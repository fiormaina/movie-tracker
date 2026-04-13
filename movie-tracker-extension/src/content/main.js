import { log, warn } from './logger.js';
import { getPlatformForLocation } from './platform-manager.js';
import { startVideoTracker } from './video-tracker.js';
import { buildPayload } from './payload-builder.js';

function shouldEmit(progress, reason) {
  if (reason === 'ended') return true;
  if (reason === 'pause') return true;

  // Reduce spam: emit roughly every 15 seconds of playback.
  const t = Math.floor(progress.currentTime);
  return reason === 'timeupdate' && t > 0 && t % 15 === 0;
}

async function run() {
  const platform = getPlatformForLocation(window.location);
  if (typeof platform.init === 'function') {
    await platform.init();
  }

  startVideoTracker({
    onProgress: async ({ reason, progress }) => {
      if (!shouldEmit(progress, reason)) return;

      try {
        const meta = await platform.getMeta();
        if (!meta || !meta.title || !meta.url) return;

        const payload = buildPayload({
          platformId: platform.id,
          meta,
          progress,
        });

        log('payload', payload);
      } catch (e) {
        warn('failed to build payload', e);
      }
    },
  });
}

run().catch((e) => warn('init error', e));
