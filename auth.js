import { CONFIG } from './config.js';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand
} from './lib/aws-sdk.js';

// Global Cognito Identity Client
let cognitoIdentityClient = null;

// Auth Session State
let currentSession = {
  idToken: null,
  identityId: null,
  credentials: null,
  user: null
};

// Initialize AWS Clients
function getCognitoClient() {
  if (!cognitoIdentityClient) {
    cognitoIdentityClient = new CognitoIdentityClient({ region: CONFIG.AWS_REGION });
  }
  return cognitoIdentityClient;
}

// Decode JWT token helper
export function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT token:', e);
    return null;
  }
}

// Check if token is expired (returns true if expired or close to expiring)
function isTokenExpired(exp) {
  if (!exp) return true;
  const buffer = 300; // 5 minutes buffer
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime + buffer >= exp;
}

// Get temporary AWS credentials using the Google ID token
async function fetchAwsCredentials(googleIdToken) {
  if (!CONFIG.COGNITO_IDENTITY_POOL_ID) {
    throw new Error('AWS Cognito Identity Pool ID is not configured.');
  }

  const client = getCognitoClient();
  const loginsKey = 'accounts.google.com';
  
  // Step 1: Get Identity ID
  const getIdResponse = await client.send(new GetIdCommand({
    IdentityPoolId: CONFIG.COGNITO_IDENTITY_POOL_ID,
    Logins: {
      [loginsKey]: googleIdToken
    }
  }));

  const identityId = getIdResponse.IdentityId;

  // Step 2: Get Credentials
  const getCredsResponse = await client.send(new GetCredentialsForIdentityCommand({
    IdentityId: identityId,
    Logins: {
      [loginsKey]: googleIdToken
    }
  }));

  return {
    identityId,
    credentials: {
      accessKeyId: getCredsResponse.Credentials.AccessKeyId,
      secretAccessKey: getCredsResponse.Credentials.SecretKey,
      sessionToken: getCredsResponse.Credentials.SessionToken,
      expiration: getCredsResponse.Credentials.Expiration
    }
  };
}

// Initialize Auth Module
export async function initAuth() {
  const savedSession = localStorage.getItem(CONFIG.AUTH_STORAGE_KEY);
  if (!savedSession) return null;

  try {
    const session = JSON.parse(savedSession);
    if (!session.idToken) return null;

    const payload = decodeJwt(session.idToken);
    if (!payload || isTokenExpired(payload.exp)) {
      // Session has expired, clear local storage
      localStorage.removeItem(CONFIG.AUTH_STORAGE_KEY);
      return null;
    }

    // Attempt to restore AWS credentials
    try {
      const awsData = await fetchAwsCredentials(session.idToken);
      currentSession = {
        idToken: session.idToken,
        identityId: awsData.identityId,
        credentials: awsData.credentials,
        user: {
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        }
      };
      
      dispatchEvent('auth-status-changed', { isAuthenticated: true, user: currentSession.user });
      return currentSession;
    } catch (awsError) {
      console.error('Failed to restore AWS credentials from saved token:', awsError);
      // Let's keep the user object but clear AWS creds. The sync layer will know to ask for re-login if AWS operations fail.
      return null;
    }
  } catch (err) {
    console.error('Error during auth initialization:', err);
    localStorage.removeItem(CONFIG.AUTH_STORAGE_KEY);
    return null;
  }
}

// Handle Google Login Callback
export async function handleGoogleLogin(googleIdToken) {
  try {
    const payload = decodeJwt(googleIdToken);
    if (!payload) throw new Error('Invalid JWT token received from Google.');

    dispatchEvent('auth-sync-status', { status: 'syncing', message: 'Authenticating with AWS...' });
    
    const awsData = await fetchAwsCredentials(googleIdToken);
    
    currentSession = {
      idToken: googleIdToken,
      identityId: awsData.identityId,
      credentials: awsData.credentials,
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    };

    // Save session metadata
    localStorage.setItem(CONFIG.AUTH_STORAGE_KEY, JSON.stringify({
      idToken: googleIdToken
    }));

    dispatchEvent('auth-status-changed', { isAuthenticated: true, user: currentSession.user });
    return currentSession;
  } catch (err) {
    console.error('Google login processing failed:', err);
    dispatchEvent('auth-sync-status', { status: 'error', message: err.message || 'Authentication failed.' });
    throw err;
  }
}

// Sign Out
export function signOut() {
  localStorage.removeItem(CONFIG.AUTH_STORAGE_KEY);
  
  currentSession = {
    idToken: null,
    identityId: null,
    credentials: null,
    user: null
  };

  // Revoke Google token if GIS is active
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (e) {
    console.warn('Failed to disable Google auto-select:', e);
  }

  dispatchEvent('auth-status-changed', { isAuthenticated: false, user: null });
}

// Delete Account & Local Data
export async function deleteAccount(deleteDynamoDbRowCallback) {
  if (!currentSession.idToken || !currentSession.credentials) {
    throw new Error('User is not authenticated.');
  }

  try {
    // Invoke the sync module to delete the row from DynamoDB
    if (deleteDynamoDbRowCallback) {
      await deleteDynamoDbRowCallback(currentSession.credentials, currentSession.identityId);
    }
    
    // Clear everything
    signOut();
    
    // Clear app local progress
    localStorage.removeItem('kalima_stats');
    localStorage.removeItem('starredWords');
    
    dispatchEvent('auth-account-deleted');
  } catch (err) {
    console.error('Account deletion failed:', err);
    throw err;
  }
}

// Get Credentials for other services
export function getAwsCredentials() {
  if (!currentSession.credentials) return null;
  
  // Check if credentials have expired
  const expiry = currentSession.credentials.expiration;
  if (expiry && new Date() >= new Date(expiry)) {
    console.warn('AWS credentials expired');
    return null;
  }
  
  return currentSession.credentials;
}

export function getIdentityId() {
  return currentSession.identityId;
}

export function getCurrentUser() {
  return currentSession.user;
}

export function isAuthenticated() {
  return !!(currentSession.idToken && currentSession.credentials);
}

// Custom Event Dispatcher
function dispatchEvent(name, detail) {
  const event = new CustomEvent(name, { detail });
  window.dispatchEvent(event);
}
