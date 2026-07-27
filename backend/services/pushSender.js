const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// ===== VAPID SETUP =====
// Generate these ONCE with: npx web-push generate-vapid-keys
// Then put them in your .env file (never commit them to git):
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
webpush.setVapidDetails(
  'mailto:you@example.com', // any contact email/URL, required by the push spec
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Sends a push notification to every device the given user has
 * subscribed from (phone, laptop, etc - all get notified).
 * Automatically cleans up subscriptions that are no longer valid
 * (e.g. user uninstalled the PWA, browser data cleared).
 */
async function sendPushToUser(userId, { title, body, senderId, url }) {
  const subscriptions = await PushSubscription.find({ user: userId });
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({ title, body, senderId, url });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (error) {
        // 410 Gone / 404 = the subscription is dead, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
          console.log('🧹 Removed dead push subscription for user:', userId);
        } else {
          console.error('❌ Push send error:', error.message);
        }
      }
    })
  );
}

module.exports = { sendPushToUser };