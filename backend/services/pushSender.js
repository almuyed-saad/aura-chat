const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// ===== VAPID SETUP =====
webpush.setVapidDetails(
  'mailto:you@example.com',
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
        // ✅ FULL error logging - previously only logged error.message,
        // which just showed the vague "Received unexpected response code"
        // over and over with no way to know the actual reason. This prints
        // everything the push service actually told us back.
        console.error('❌ Push send FAILED - full details:');
        console.error('  statusCode:', error.statusCode);
        console.error('  message:', error.message);
        console.error('  body:', error.body);
        console.error('  headers:', JSON.stringify(error.headers));
        console.error('  endpoint:', sub.endpoint);

        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
          console.log('🧹 Removed dead push subscription for user:', userId);
        }
      }
    })
  );
}

module.exports = { sendPushToUser };