# Profile Forge Backend

Profile Forge is a web application that allows users to create and manage their professional profiles. It provides a platform for users to showcase their skills, experience, and education to potential employers.
With help of Profile Forge Backend user can get their profile in json format and can use it anywhere.

---

# Tech Stack

- Node.js
- Express.js
- PostgreSQL
- AWS cognito
- Nodemon
- Dotenv
- Cors
- Docker
- Docker-compose

# How to run

-  git clone <repo-url>
-  cd backend
-  npm install
-  npm run dev

# How to run with docker

-  git clone <repo-url>
-  cd backend
-  docker-compose up --build

---

# API Endpoints Reference

All endpoints are prefixed with `/api/v1`. Endpoints requiring authentication expect a valid session cookie or Authorization header.

### Authentication & Identification (`/`)
- `POST /signup`: Register a new user account.
  - **Body**: `{ "name": "string", "email": "string", "password": "string" }`
- `POST /confirmsignup`: Verify the email OTP to complete signup.
  - **Body**: `{ "email": "string", "code": "6-digit-string" }`
- `POST /login`: Authenticate user and issue tokens.
  - **Body**: `{ "email": "string", "password": "string" }`
- `POST /logout`: Invalidate the current session tokens.
- `POST /forgotpassword`: Request a password reset verification code.
  - **Body**: `{ "email": "string" }`
- `POST /confirmforgotpassword`: Complete the password reset via verification code.
  - **Body**: `{ "email": "string", "code": "6-digit-string", "password": "new-string" }`

### User Account Management (`/profile`)
- `GET /profile`: Fetch the currently authenticated user's details.
- `PUT /profile/name`: Update the user's display name.
  - **Body**: `{ "name": "string" }`
- `PUT /profile/image`: Update the user's avatar/profile image.
  - **Body**: `{ "image": "URL string" }`
- `DELETE /profile/delete`: Permanently delete the user's account and all associated data.

### External Platform Integrations (`/external-profile`)
Supports linking third-party platforms like GitHub, LeetCode, and Credly.
- `POST /external-profile/add`: Link a new third-party platform profile to the user account.
  - **Body**: `{ "platform": "github|leetcode|credly", "username": "string" }`
- `GET /external-profile/:platform`: Fetch the synced profile and repository/badge data for a specific platform.
  - **Params**: `platform` (e.g., `github`)
- `PUT /external-profile/update`: Trigger a manual re-sync for a connected external profile.
  - **Body**: `{ "platform": "github|leetcode|credly", "username": "string" }`

### Custom Certificates (`/certificates`)
- `POST /certificates/presign`: Request an AWS S3 pre-signed URL to directly upload a certificate file (bypassing the server).
  - **Body**: `{ "contentType": "image/png", "fileExtension": "png" }`
  - **Response**: `{ "uploadUrl": "S3 Put URL", "fileKey": "certificates/uuid/image.png" }`
- `POST /certificates`: Save a newly uploaded custom certificate's metadata and image URL to the database.
  - **Body**: `{ "title": "string", "issuer": "string?", "issue_date": "YYYY-MM-DD?", "credential_url": "URL string?", "fileKey": "string?", "details": "JSON object?" }`
- `GET /certificates`: Fetch a list of all custom certificates added by the user.
- `PUT /certificates/:id`: Update an existing custom certificate's details. All fields are optional.
  - **Params**: `id` (UUID)
  - **Body**: `{ "title": "string?", "issuer": "string?", "issue_date": "YYYY-MM-DD?", "credential_url": "URL string?", "fileKey": "string?", "details": "JSON object?" }`
- `DELETE /certificates/:id`: Delete a specific custom certificate representing its ID.
  - **Params**: `id` (UUID)