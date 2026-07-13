# KalimaCards — Google Authentication & AWS Cloud Sync Setup Guide

This document describes how to configure the backendless authentication and statistics synchronization system for KalimaCards.

---

## 🏗️ Architecture Overview

The authentication and cloud synchronization flow runs entirely in the browser using the AWS JavaScript SDK v3 (bundled locally) and the Google Identity Services SDK:

1. **Google Identity Services (GIS) SDK**: Used client-side to render the "Sign In with Google" button and request authentication. Google returns a signed JSON Web Token (JWT) containing user metadata (email, name, photo).
2. **AWS Cognito Identity Pool**: Receives the Google JWT token and exchanges it for temporary AWS security credentials (access key, secret key, session token) under an IAM role.
3. **AWS DynamoDB**: The client-side code directly reads and writes progress stats to the database using these temporary credentials. **Fine-grained IAM row-level security** ensures that each user can only read/write their own row, matching their Cognito Identity ID.

---

## 📁 Repository File Structure

The following files implement authentication and synchronization in the codebase:

| File | Type | Description |
| :--- | :--- | :--- |
| **[config.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/config.js)** | Configuration | Holds user-specific AWS Region, Table name, Cognito Identity Pool ID, and Google Client ID. |
| **[lib/aws-sdk.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/aws-sdk.js)** | Library | Bundled and minified ES module containing Cognito Identity and DynamoDB Client commands. |
| **[auth.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/auth.js)** | Controller | Decodes Google JWTs, coordinates with Cognito Identity Pools, and exposes session management helpers. |
| **[sync.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/sync.js)** | Controller | Manages pulls, merges, pushes, offline queues, and background sync operations with DynamoDB. |
| **[index.html](file:///Users/tareqmy/development/javascriptprojects/kalimacards/index.html)** | Interface | Includes the Google GIS script, Header buttons/sync badges, Guest prompt banner, and Auth modal overlay. |
| **[style.css](file:///Users/tareqmy/development/javascriptprojects/kalimacards/assets/style.css)** | Styling | Styles the auth modal overlay, account detail widgets, sync spinners, and guest banners. |
| **[sw.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/sw.js)** | PWA | Caches new modules and configuration assets locally, enabling offline availability. |

---

## 🛠️ Configuration Steps

### 1. Google Cloud Console Setup (Google Login)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **API & Services** > **Credentials**.
4. Configure the **OAuth consent screen** (Internal or External, add app name, developer email, and the `.../auth/userinfo.email` and `.../auth/userinfo.profile` scopes).
5. Go back to **Credentials** > click **Create Credentials** > select **OAuth client ID**.
6. Set the **Application type** to `Web application`.
7. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8000` (for local development)
   - `https://kalimacards.com` (your production URL)
8. Click **Create** and copy your **Client ID** (looks like `xxxxxx-xxxxxx.apps.googleusercontent.com`).
9. Paste this client ID value into **[config.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/config.js)** under `GOOGLE_CLIENT_ID`.

---

### 2. AWS DynamoDB Table Setup

1. Open the [AWS Console](https://console.aws.amazon.com/) and navigate to the **DynamoDB** service.
2. Select your desired region (e.g. `ap-south-1` Mumbai) in the top-right.
3. Click **Create table**.
4. Set the configuration details:
   - **Table name**: `kalimacards-progress` (or matching `DYNAMODB_TABLE_NAME` in config.js)
   - **Partition key**: `userId` (Type: `String` / `S`)
   - **Sort key**: Leave empty.
5. Under **Table settings**, choose **Customized settings** and set capacity mode to **On-demand** (this ensures the AWS Free Tier handles all operations with $0/month costs).
6. Click **Create table**.

---

### 3. AWS Cognito Identity Pool Setup

1. Navigate to the **Cognito** service in the AWS Console.
2. Click on **Federated Identities** (or create an **Identity Pool**).
3. Click **Create new identity pool**.
4. Set configuration details:
   - **Identity pool name**: `kalimacards_identity_pool`
   - **Unauthenticated identities**: Ensure "Enable access to unauthenticated identities" is **unchecked**.
5. Toggle the **Authentication providers** drop-down:
   - Click on the **Google** tab.
   - Enter your **Google Client ID** in the field.
6. Click **Create Pool**.
7. AWS will ask to create or update IAM roles for your authenticated and unauthenticated users. Click **Allow** to create default roles (`Cognito_kalimacards_identity_poolAuth_Role`).
8. Copy the **Identity Pool ID** shown in the sample code snippet (e.g., `ap-south-1:xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) and paste it as `COGNITO_IDENTITY_POOL_ID` in **[config.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/lib/config.js)**.

---

### 4. IAM Row-Level Security Policy

To lock down the DynamoDB database so that signed-in users can **only** read, edit, or delete their own data, configure a fine-grained IAM policy:

1. Navigate to the **IAM Console** (Identity and Access Management) in AWS.
2. Click **Roles** and search for the authenticated Cognito role created in the previous step (e.g., `Cognito_kalimacards_identity_poolAuth_Role`).
3. Click on the role name, select the permission policy attached to it, and click **Edit Policy** (or click **Add permissions** > **Create inline policy**).
4. Switch to the **JSON** editor and paste the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-south-1:YOUR_AWS_ACCOUNT_ID:table/kalimacards-progress",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": [
            "${cognito-identity.amazonaws.com:sub}"
          ]
        }
      }
    }
  ]
}
```

> [!IMPORTANT]
> Replace `ap-south-1` with your actual region (if different), `YOUR_AWS_ACCOUNT_ID` with your 12-digit AWS Account ID, and `kalimacards-progress` with your DynamoDB table name.
> The `${cognito-identity.amazonaws.com:sub}` condition is the security boundary. It matches the partition key (`userId` in DynamoDB) against the unique Cognito Identity ID of the authenticated user.

---

## 🧪 Local Testing

You can run the application locally to test the authentication and sync:

1. Launch your local server (Python HTTP server):
   ```bash
   make run
   ```
2. Open your browser and navigate to `http://localhost:8000`.
3. If your `GOOGLE_CLIENT_ID` is set up, clicking the profile button in the top right will display a **Google Sign-In** modal.
4. Sign in with your Google Account. 
5. Review at least 10 words, or star a word, and notice the cloud sync badge in the top right spinning (`Syncing...` -> `Backup` synced).
6. Inspect the DynamoDB console in AWS: a new row with your Cognito Identity ID as `userId` will appear, containing your stats list and starred words!
7. Try opening `http://localhost:8000` in an Incognito window or another browser, sign in with the same Google Account, and witness your progress automatically restore on the new device!
