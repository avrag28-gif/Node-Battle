import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const USERNAME = String(process.env.TIKTOK_USERNAME || 'dr_acker').replace(/^@/, '').trim();
const ENABLED = String(process.env.TIKTOK_LIVE_ENABLED ?? 'true').toLowerCase() !== 'false';

const GIFT_ACTIONS = new Map([
  ['panda', 'PLAYER_JOIN'],
  ['rose', 'PLAYER_ATTACK'],
  ['donut', 'PLAYER_HEAL'],
  ['topi kumis', 'PLAYER_EVOLVE_MANUAL'],
  ['petir', 'PLAYER_DAMAGE_BUFF'],
  ['dragon', 'PLAYER_REVIVE'],
  ['special', 'PLAYER_SPECIAL']
]);

let connection = null;
let reconnectTimer = null;
let connected = false;
let onEvent = null;

function nameOfGift(data) {
  return String(
    data?.giftDetails?.giftName ||
    data?.giftName ||
    data?.extendedGiftInfo?.name ||
    ''
  ).trim();
}

function actionForGift(name) {
  const normalized = name.toLowerCase();
  if (GIFT_ACTIONS.has(normalized)) return GIFT_ACTIONS.get(normalized);
  if (normalized.includes('rose')) return 'PLAYER_ATTACK';
  if (normalized.includes('panda')) return 'PLAYER_JOIN';
  return null;
}

function emit(type, data) {
  if (!onEvent) return;
  onEvent({
    type,
    platformUserId: String(data?.user?.userId || data?.user?.uniqueId || data?.uniqueId || ''),
    username: String(data?.user?.uniqueId || data?.uniqueId || 'TikTokViewer'),
    avatarUrl: String(data?.user?.avatarLarger || data?.user?.avatarThumb || data?.profilePictureUrl || ''),
    payload: data
  });
}

async function connectNow() {
  if (!ENABLED || !USERNAME || connected) return;
  try {
    connection = new TikTokLiveConnection(USERNAME, { enableExtendedGiftInfo: true });
    connection.on('connected', state => {
      connected = true;
      console.log(`[TikTok] LIVE connected: @${USERNAME} room=${state.roomId}`);
    });
    connection.on('disconnected', () => {
      connected = false;
      console.log(`[TikTok] LIVE disconnected: @${USERNAME}`);
      scheduleReconnect();
    });
    connection.on('error', (info, exception) => {
      console.error('[TikTok] connector error:', info || exception || 'unknown error');
    });
    connection.on(WebcastEvent.GIFT, data => {
      const giftName = nameOfGift(data);
      const giftType = data?.giftDetails?.giftType;
      const repeatEnd = data?.repeatEnd;
      const repeatCount = Math.max(1, Number(data?.repeatCount) || 1);

      // Streakable gifts emit intermediate events; process only the final event.
      if (giftType === 1 && repeatEnd === false) return;

      const action = actionForGift(giftName);
      const userId = String(data?.user?.userId || data?.user?.uniqueId || data?.uniqueId || '');
      const username = String(data?.user?.uniqueId || data?.uniqueId || 'TikTokViewer');
      console.log(`[TikTok] GIFT @${username}: ${giftName || `giftId=${data?.giftId}`} x${repeatCount}${action ? ` -> ${action}` : ''}`);
      if (!action || !userId) return;

      const event = {
        type: action,
        platformUserId: userId,
        username,
        avatarUrl: String(data?.user?.avatarLarger || data?.user?.avatarThumb || data?.profilePictureUrl || ''),
        quantity: action === 'PLAYER_ATTACK' ? Math.min(repeatCount, 8) : 1,
        payload: { giftId: data?.giftId, giftName, repeatCount }
      };
      onEvent?.(event);
    });
    connection.on(WebcastEvent.CHAT, data => {
      const userId = String(data?.user?.userId || data?.user?.uniqueId || '');
      if (!userId) return;
      onEvent?.({ type: 'PLAYER_COMMENT', platformUserId: userId, username: String(data?.user?.uniqueId || 'TikTokViewer'), avatarUrl: String(data?.user?.avatarLarger || ''), payload: { comment: data?.comment || '' } });
    });
    connection.on(WebcastEvent.LIKE, data => {
      const userId = String(data?.user?.userId || data?.user?.uniqueId || '');
      if (!userId) return;
      onEvent?.({ type: 'PLAYER_LIKE', platformUserId: userId, username: String(data?.user?.uniqueId || 'TikTokViewer'), avatarUrl: String(data?.user?.avatarLarger || '') });
    });

    await connection.connect();
  } catch (error) {
    connected = false;
    console.error(`[TikTok] Could not connect to @${USERNAME}:`, error?.message || error);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!ENABLED || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNow();
  }, 15000);
}

export function startTikTokBridge(handler) {
  onEvent = handler;
  console.log(`[TikTok] bridge enabled for @${USERNAME}. Waiting for LIVE...`);
  connectNow();
  return () => {
    onEvent = null;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    connected = false;
    connection?.disconnect?.().catch?.(() => {});
    connection = null;
  };
}

export function getTikTokBridgeStatus() {
  return { enabled: ENABLED, username: USERNAME, connected };
}
