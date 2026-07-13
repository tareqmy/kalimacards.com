// KalimaCards AWS & Auth Configuration
export const CONFIG = {
  // AWS Configuration
  AWS_REGION: 'ap-south-1', // Mumbai region as selected by user
  COGNITO_IDENTITY_POOL_ID: 'ap-south-1:2a3def15-ba12-4d93-a232-b27f7288c599', // E.g., 'ap-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  DYNAMODB_TABLE_NAME: 'kalimacards-progress', // DynamoDB table name
  
  // Google Auth Configuration
  GOOGLE_CLIENT_ID: '706068859137-nnqej5fjcqccce6116ijsoiiji7veobt.apps.googleusercontent.com', // E.g., 'xxxxxx-xxxxxxxx.apps.googleusercontent.com'
  
  // Local storage key for auth tokens/session
  AUTH_STORAGE_KEY: 'kalima_auth_session'
};
