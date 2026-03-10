# ProfileForge API Key Documentation

Welcome to the **ProfileForge API**. By generating an API Key from your dashboard, you can securely access your unified coding data, projects, and certificates to build stunning public portfolios, personal websites, or custom integrations.

## Authentication

All API Key access is **Read-Only**. Your keys cannot be used to modify, delete, or add any data to your ProfileForge account. 

To authenticate your requests, you must include the `x-api-key` header in your HTTP request.

```http
GET /api/v1/keys/data HTTP/1.1
Host: api.profileforge.com
x-api-key: <YOUR_API_KEY>
```

### Example (Fetch API)
```javascript
fetch("https://api.profileforge.com/api/v1/keys/data", {
    method: "GET",
    headers: {
        "x-api-key": "your_generated_api_key_here"
    }
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Rate Limits & Quotas

To ensure platform stability, API keys are subject to the following limits:
- **Global IP Rate Limit**: 100 requests per minute per IP address.
- **Hourly API Key Limit**: 1000 requests per hour per connected user account. 

If you exceed these limits, the API will return a `429 Too Many Requests` error containing the time until your quota resets.

---

## Endpoints

### 1. The Unified Portfolio Endpoint (Recommended)
This is the single, most powerful endpoint. It aggregates your Projects, Certificates, connected integration profiles (GitHub, etc.), unified competitive programming stats (LeetCode & Codeforces), and your earned Badges (Credly) into one perfectly formatted JSON payload.

**Method**: `GET`
**Path**: `/api/v1/keys/data`
**Headers**:
- `x-api-key`: string (required)

**Response (200 OK)**:
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "E-Commerce App",
      "description": "A fullstack application...",
      "live_link": "https://example.com",
      "github_link": "https://github.com/example/app",
      "tech_stack": ["React", "Node.js", "PostgreSQL"],
      "images": ["https://s3.amazonaws.com/..."],
      "created_at": "2023-10-01T12:00:00Z"
    }
  ],
  "certificates": [
    {
      "id": "uuid",
      "title": "AWS Certified Developer",
      "issuer": "Amazon Web Services",
      "issue_date": "2023-05-10T00:00:00Z",
      "image_url": "https://s3.amazonaws.com/..."
    }
  ],
  "externalProfiles": [
    {
      "platform": "github",
      "username": "example",
      "profile_url": "https://github.com/example",
      "platform_data": { /* Detailed public Github metrics */ }
    }
  ],
  "codingStats": {
    "totalSolved": 450,
    "easy": 150,
    "medium": 200,
    "hard": 100,
    "topics": [
      { "tag": "Dynamic Programming", "count": 45 },
      { "tag": "Graphs", "count": 30 }
    ]
  },
  "badges": {
    "1": {
      "name": "AWS Certified Cloud Practitioner",
      "image": "https://images.credly.com/...",
      "description": "Validates overall understanding of the AWS Cloud...",
      "skills": ["AWS", "Cloud Computing"],
      "issuerName": "Amazon Web Services",
      "issuerImageUrl": "https://images.credly.com/..."
    }
  }
}
```

---

### 2. Fetch Projects by User ID
If you want to lazily load specifically only the projects logic, you can ping this route. (Note: You will need your backend UUID for this, which can be extracted from the `/keys/data` request or dashboard).

**Method**: `GET`
**Path**: `/api/v1/projects/:userId`
**Headers**:
- `x-api-key`: string (required)

**Params**:
- `userId`: uuid (required)

**Response (200 OK)**:
```json
[
  {
    "id": "uuid",
    "name": "E-Commerce App",
    "description": "A fullstack application...",
    "tech_stack": ["React", "Node.js"],
    "images": ["https://s3.amazonaws.com/..."]
  }
]
```

---

## Error Handling

Your application should be prepared to handle the following standard HTTP errors returned by the API:
- `202 successful` :Profile added but the data is not available yet'
- `401 Unauthorized`: Missing `x-api-key` header, or the provided API key has been revoked/is invalid.
- `403 Forbidden`: Attempted to use a non-`GET` method (like POST or DELETE). API Keys are read-only.
- `429 Too Many Requests`: The hourly or minute-based rate limit has been exceeded.
- `500 Internal Server Error`: An unexpected backend failure occurred. Wait and try again later.
