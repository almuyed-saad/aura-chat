const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// ===== VAPID SETUP =====
const pushEnabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ Push notifications disabled: VAPID keys are not configured');
}

/**
 * Sends a push notification to every device the given user has
 * subscribed from (phone, laptop, etc - all get notified).
 * Automatically cleans up subscriptions that are no longer valid
 * (e.g. user uninstalled the PWA, browser data cleared, or the
 * subscription was created under an old/mismatched VAPID key).
 */
async function sendPushToUser(userId, { title, body, senderId, url }) {
  if (!pushEnabled) return;

  const subscriptions = await PushSubscription.find({ user: userId });
  if (subscriptions.length === 0) {
    console.log('ℹ️ No push subscriptions found for user:', userId);
    return;
  }

  const payload = JSON.stringify({ title, body, senderId, url });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        console.log('✅ Push sent successfully to:', sub.endpoint.slice(0, 50) + '...');
      } catch (error) {
        console.error('❌ Push send FAILED - full details:');
        console.error('  statusCode:', error.statusCode);
        console.error('  message:', error.message);
        console.error('  body:', error.body);
        console.error('  endpoint:', sub.endpoint);

        // Clean up subscriptions that can never succeed again:
        // - 410/404 = subscription expired or was removed by the browser
        // - 403 with this specific message = created under an old/wrong VAPID key
        const isDeadSubscription =
          error.statusCode === 410 ||
          error.statusCode === 404 ||
          (error.statusCode === 403 && error.body?.includes('do not correspond'));

        if (isDeadSubscription) {
          await PushSubscription.deleteOne({ _id: sub._id });
          console.log('🧹 Removed invalid push subscription for user:', userId, '- reason:', error.statusCode);
        }
      }
    })
  );
}

module.exports = { sendPushToUser };