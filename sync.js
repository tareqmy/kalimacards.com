import { CONFIG } from './config.js';
import { getAwsCredentials, getIdentityId, isAuthenticated } from './auth.js';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  marshall,
  unmarshall
} from './lib/aws-sdk.js';

let dynamoClient = null;
let syncTimeout = null;
let isSyncing = false;
let lastPushedPayloadJson = null; // Track last successfully written payload to avoid redundant writes

// Initialize DynamoDB Client with credentials
function getDynamoClient() {
  const credentials = getAwsCredentials();
  if (!credentials) return null;
  
  // Re-use client if credentials haven't changed, but AWS SDK clients can be re-instantiated
  // or initialized with credential providers. Since we get temporary credentials directly, 
  // we can create a fresh client with the updated credentials.
  return new DynamoDBClient({
    region: CONFIG.AWS_REGION,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    }
  });
}

// Helpers to get local stats and stars
function getLocalStats() {
  try {
    const local = localStorage.getItem('kalima_stats');
    return local ? JSON.parse(local) : { known: [], learning: [], seen: [] };
  } catch (e) {
    return { known: [], learning: [], seen: [] };
  }
}

function getLocalStars() {
  try {
    const local = localStorage.getItem('starredWords');
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
}

// Union arrays of strings, deduplicating them
function unionArrays(arr1, arr2) {
  const set = new Set([...(arr1 || []), ...(arr2 || [])]);
  return Array.from(set);
}

// Merge cloud and local data
export function mergeProgress(localStats, localStars, cloudData) {
  const cloudStats = cloudData.stats || { known: [], learning: [], seen: [] };
  const cloudStars = cloudData.starredWords || [];

  // 1. Union stats
  let mergedKnown = unionArrays(localStats.known, cloudStats.known);
  let mergedLearning = unionArrays(localStats.learning, cloudStats.learning);
  let mergedSeen = unionArrays(localStats.seen, cloudStats.seen);

  // 2. Resolve overlaps: a word can't be in both 'known' and 'learning'. If it is in 'known', remove from 'learning'.
  const knownSet = new Set(mergedKnown);
  mergedLearning = mergedLearning.filter(word => !knownSet.has(word));

  // 3. Ensure everything in known/learning is also in seen
  const seenSet = new Set(mergedSeen);
  mergedKnown.forEach(w => seenSet.add(w));
  mergedLearning.forEach(w => seenSet.add(w));
  mergedSeen = Array.from(seenSet);

  // 4. Union stars
  const mergedStars = unionArrays(localStars, cloudStars);

  return {
    stats: {
      known: mergedKnown,
      learning: mergedLearning,
      seen: mergedSeen
    },
    starredWords: mergedStars
  };
}

// Pull progress from DynamoDB
export async function pullCloudProgress() {
  const client = getDynamoClient();
  const identityId = getIdentityId();
  if (!client || !identityId) throw new Error('Not authenticated with AWS.');

  const response = await client.send(new GetItemCommand({
    TableName: CONFIG.DYNAMODB_TABLE_NAME,
    Key: marshall({ userId: identityId })
  }));

  if (response.Item) {
    const unmarshalled = unmarshall(response.Item);
    return unmarshalled;
  }
  return null;
}

// Push progress to DynamoDB
export async function pushCloudProgress(stats, starredWords) {
  const currentPayloadJson = JSON.stringify({ stats, starredWords });
  if (currentPayloadJson === lastPushedPayloadJson) {
    // Redundancy check: skip network write if payload has not changed since last push
    markNeedsSync(false);
    return;
  }

  const client = getDynamoClient();
  const identityId = getIdentityId();
  if (!client || !identityId) {
    // If offline or not logged in, queue the sync
    if (isAuthenticated()) {
      markNeedsSync(true);
    }
    return;
  }

  const payload = {
    userId: identityId,
    stats: stats,
    starredWords: starredWords,
    lastSyncedAt: new Date().toISOString(),
    schemaVersion: 1
  };

  await client.send(new PutItemCommand({
    TableName: CONFIG.DYNAMODB_TABLE_NAME,
    Item: marshall(payload, { removeUndefinedValues: true })
  }));

  lastPushedPayloadJson = currentPayloadJson;
  markNeedsSync(false);
}

// Delete user's row in DynamoDB (used during account deletion)
export async function deleteCloudProgress(credentials, identityId) {
  const client = new DynamoDBClient({
    region: CONFIG.AWS_REGION,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    }
  });

  await client.send(new DeleteItemCommand({
    TableName: CONFIG.DYNAMODB_TABLE_NAME,
    Key: marshall({ userId: identityId })
  }));
}

// Full pull, merge, and push sync cycle
export async function syncProgress() {
  if (isSyncing) return;
  if (!isAuthenticated()) return;

  isSyncing = true;
  dispatchSyncStatus('syncing', 'Syncing your progress...');

  try {
    const localStats = getLocalStats();
    const localStars = getLocalStars();
    
    // Pull current cloud progress
    const cloudData = await pullCloudProgress();
    
    let statsToSave = localStats;
    let starsToSave = localStars;

    if (cloudData) {
      // Initialize redundancy tracker with current cloud state
      lastPushedPayloadJson = JSON.stringify({
        stats: cloudData.stats || { known: [], learning: [], seen: [] },
        starredWords: cloudData.starredWords || []
      });

      // Merge local and cloud progress
      const merged = mergeProgress(localStats, localStars, cloudData);
      statsToSave = merged.stats;
      starsToSave = merged.starredWords;

      // Update localStorage with merged progress
      localStorage.setItem('kalima_stats', JSON.stringify(statsToSave));
      localStorage.setItem('starredWords', JSON.stringify(starsToSave));
      
      // Notify main app to reload stats/UI
      window.dispatchEvent(new CustomEvent('sync-completed', {
        detail: { stats: statsToSave, starredWords: starsToSave }
      }));
    }

    // Push final merged data back to the cloud (will skip if identical to cloudData)
    await pushCloudProgress(statsToSave, starsToSave);
    
    dispatchSyncStatus('synced', 'All progress backed up');
  } catch (err) {
    console.error('Progress sync failed:', err);
    dispatchSyncStatus('error', 'Sync failed. Progress saved locally.');
    markNeedsSync(true);
  } finally {
    isSyncing = false;
  }
}

// Debounced push to cloud on local progress changes
export function queueCloudPush() {
  if (!isAuthenticated()) return;

  // Clear any existing sync timer
  if (syncTimeout) clearTimeout(syncTimeout);

  dispatchSyncStatus('syncing', 'Saving changes...');

  syncTimeout = setTimeout(async () => {
    try {
      const stats = getLocalStats();
      const starredWords = getLocalStars();
      await pushCloudProgress(stats, starredWords);
      dispatchSyncStatus('synced', 'All progress backed up');
    } catch (err) {
      console.error('Debounced push failed:', err);
      dispatchSyncStatus('error', 'Backup failed. Will retry later.');
      markNeedsSync(true);
    }
  }, 300000); // 300 seconds debounce
}

// Offline/Sync Queue Helpers
function markNeedsSync(needed) {
  if (needed) {
    localStorage.setItem('kalima_sync_pending', 'true');
  } else {
    localStorage.removeItem('kalima_sync_pending');
  }
}

export function isSyncPending() {
  return localStorage.getItem('kalima_sync_pending') === 'true';
}

// Check for pending sync (e.g. when back online)
export async function checkPendingSync() {
  if (isSyncPending() && isAuthenticated() && navigator.onLine) {
    console.log('Pending sync found, initiating sync...');
    await syncProgress();
  }
}

function dispatchSyncStatus(status, message) {
  const event = new CustomEvent('auth-sync-status', {
    detail: { status, message }
  });
  window.dispatchEvent(event);
}

// Register Online/Offline Event Listeners
window.addEventListener('online', checkPendingSync);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && isAuthenticated()) {
    // Flush changes immediately when user switches tabs or exits
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      const stats = getLocalStats();
      const starredWords = getLocalStars();
      pushCloudProgress(stats, starredWords).catch(e => console.error('Visibilitychange push failed:', e));
    }
  }
});
