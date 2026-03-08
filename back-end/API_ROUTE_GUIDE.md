# Tutor Helper API Route Guide

## Overview
This API provides endpoints for managing educational content including classes, subjects, units, and lessons. All endpoints except authentication require JWT token authentication.

## Phase 2 Lesson-Plan Pipeline (MVP)

### Required Environment Variables

- `GROQ_API_KEY`: Groq API key used for lesson-plan generation
- `GROQ_MODEL` (optional): Groq model name (default: `llama-3.3-70b-versatile`)
- `GROQ_TIMEOUT_MS` (optional): request timeout in milliseconds (default: `30000`)
- `TURSO_DATABASE_URL`: Turso/libSQL database URL
- `TURSO_AUTH_TOKEN`: Turso auth token

### Run

1. Start backend:
   ```bash
   npm run dev
   ```
2. Generate a lesson plan:
   - `POST /api/generate-plan`
3. Read saved plans:
   - `GET /api/plans`
   - `GET /api/plans/:id`

### `POST /api/generate-plan` Request Body

```json
{
  "lesson_title": "Fractions Basics",
  "lesson_content": "Lesson content text here...",
  "subject": "Mathematics",
  "grade": "7",
  "unit": "Rational Numbers",
  "duration_minutes": 45,
  "plan_type": "traditional"
}
```

`plan_type` must be one of:
- `traditional`
- `active_learning`

### `POST /api/generate-plan` Response (201)

```json
{
  "id": 1,
  "plan_type": "traditional",
  "plan_json": {},
  "validation_status": "passed",
  "retry_occurred": false,
  "created_at": "2026-03-08 12:00:00",
  "updated_at": "2026-03-08 12:00:00"
}
```

## Authentication
All API endpoints except login/logout require authentication via JWT token in the Authorization header.

---

## Auth Endpoints (`/auth`)

### POST `/auth/login`
**Summary**: Authenticates a user and returns a JWT token

**Request Body**:
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response Body** (200):
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "username": "string",
    "userRole": "string",
    "createdAt": "string"
  }
}
```

**Response Codes**:
- `200`: Success
- `400`: Missing username/password
- `401`: Invalid credentials
- `500`: Internal server error

---

### POST `/auth/logout`
**Summary**: Logs out the current user (client-side token removal)

**Request Body**: None

**Response Body** (200):
```json
{
  "ok": true
}
```

**Response Codes**:
- `200`: Success

---

## Classes Endpoints (`/classes`)

### POST `/classes`
**Summary**: Creates a new class for a teacher

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "teacher_id": "number (required)"
}
```

**Response Body** (201):
```json
{
  "class": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `201`: Created successfully
- `400`: Missing required fields or teacher_id
- `500`: Internal server error

---

### GET `/classes/mine`
**Summary**: Gets all classes owned by the authenticated teacher

**Request Body**: None

**Response Body** (200):
```json
{
  "classes": [
    {
      "id": number,
      "name": string,
      "description": string,
      "teacher_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `500`: Internal server error

---

### GET `/classes/:classId`
**Summary**: Gets a specific class by ID (admin can access any, teachers only their own)

**Request Body**: None

**Response Body** (200):
```json
{
  "class": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not owner and not admin)
- `404`: Class not found
- `500`: Internal server error

---

### GET `/classes`
**Summary**: Gets all classes in the system (admin only)

**Request Body**: None

**Response Body** (200):
```json
{
  "classes": [
    {
      "id": number,
      "name": string,
      "description": string,
      "teacher_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Forbidden (not admin)
- `500`: Internal server error

---

### PUT `/classes/:classId`
**Summary**: Updates a class (admin can update any, teachers only their own)

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)"
}
```

**Response Body** (200):
```json
{
  "class": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Updated successfully
- `400`: Missing required fields
- `403`: Unauthorized (not owner and not admin)
- `404`: Class not found
- `500`: Internal server error

---

### DELETE `/classes/:classId`
**Summary**: Deletes a class (admin can delete any, teachers only their own)

**Request Body**: None

**Response Body** (200):
```json
{
  "class": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Deleted successfully (returns deleted class data)
- `403`: Unauthorized (not owner and not admin)
- `404`: Class not found
- `500`: Internal server error

---

## Subjects Endpoints (`/subjects`)

### POST `/subjects`
**Summary**: Creates a new subject within a class

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "class_id": "number (required)",
  "teacher_id": "number (optional)"
}
```

**Response Body** (201):
```json
{
  "subject": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "class_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `201`: Created successfully
- `400`: Missing required fields or class_id
- `500`: Internal server error

---

### GET `/subjects/mine`
**Summary**: Gets all subjects owned by the authenticated teacher

**Request Body**: None

**Response Body** (200):
```json
{
  "subjects": [
    {
      "id": number,
      "name": string,
      "description": string,
      "teacher_id": number,
      "class_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `500`: Internal server error

---

### GET `/subjects/class/:classId`
**Summary**: Gets all subjects within a specific class (admin can access any class, teachers only their own classes)

**Request Body**: None

**Response Body** (200):
```json
{
  "subjects": [
    {
      "id": number,
      "name": string,
      "description": string,
      "teacher_id": number,
      "class_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not class owner and not admin)
- `404`: Class not found
- `500`: Internal server error

---

### GET `/subjects/:subjectId`
**Summary**: Gets a specific subject by ID (admin can access any, teachers only their own)

**Request Body**: None

**Response Body** (200):
```json
{
  "subject": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "class_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not owner and not admin)
- `404`: Subject not found
- `500`: Internal server error

---

### GET `/subjects`
**Summary**: Gets all subjects in the system (admin only)

**Request Body**: None

**Response Body** (200):
```json
{
  "subjects": [
    {
      "id": number,
      "name": string,
      "description": string,
      "teacher_id": number,
      "class_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Forbidden (not admin)
- `500`: Internal server error

---

### PUT `/subjects/:subjectId`
**Summary**: Updates a subject (admin can update any, teachers only their own)

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "class_id": "number (optional)"
}
```

**Response Body** (200):
```json
{
  "subject": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "class_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Updated successfully
- `400`: Missing required fields
- `403`: Unauthorized (not owner and not admin)
- `404`: Subject not found
- `500`: Internal server error

---

### DELETE `/subjects/:subjectId`
**Summary**: Deletes a subject (admin can delete any, teachers only their own) - returns deleted subject data

**Request Body**: None

**Response Body** (200):
```json
{
  "subject": {
    "id": number,
    "name": string,
    "description": string,
    "teacher_id": number,
    "class_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Deleted successfully
- `403`: Unauthorized (not owner and not admin)
- `404`: Subject not found
- `500`: Internal server error

---

## Units Endpoints (`/units`)

### POST `/units`
**Summary**: Creates a new unit within a subject

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "subject_id": "number (required)",
  "teacher_id": "number (required)"
}
```

**Response Body** (201):
```json
{
  "unit": {
    "id": number,
    "name": string,
    "description": string,
    "subject_id": number,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `201`: Created successfully
- `400`: Missing required fields or subject_id
- `403`: Unauthorized (subject not owned by teacher)
- `404`: Subject not found
- `500`: Internal server error

---

### GET `/units/mine`
**Summary**: Gets all units owned by the authenticated teacher

**Request Body**: None

**Response Body** (200):
```json
{
  "units": [
    {
      "id": number,
      "name": string,
      "description": string,
      "subject_id": number,
      "teacher_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `500`: Internal server error

---

### GET `/units/subject/:subjectId`
**Summary**: Gets all units within a specific subject (admin can access any subject, teachers only their own subjects)

**Request Body**: None

**Response Body** (200):
```json
{
  "units": [
    {
      "id": number,
      "name": string,
      "description": string,
      "subject_id": number,
      "teacher_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not subject owner and not admin)
- `404`: Subject not found
- `500`: Internal server error

---

### GET `/units/:unitId`
**Summary**: Gets a specific unit by ID (admin can access any, teachers only their own)

**Request Body**: None

**Response Body** (200):
```json
{
  "unit": {
    "id": number,
    "name": string,
    "description": string,
    "subject_id": number,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not owner and not admin)
- `404`: Unit not found
- `500`: Internal server error

---

### GET `/units`
**Summary**: Gets all units in the system (admin only)

**Request Body**: None

**Response Body** (200):
```json
{
  "units": [
    {
      "id": number,
      "name": string,
      "description": string,
      "subject_id": number,
      "teacher_id": number,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Forbidden (not admin)
- `500`: Internal server error

---

### PUT `/units/:unitId`
**Summary**: Updates a unit (admin can update any, teachers only their own)

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "subject_id": "number (optional)"
}
```

**Response Body** (200):
```json
{
  "unit": {
    "id": number,
    "name": string,
    "description": string,
    "subject_id": number,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Updated successfully
- `400`: Missing required fields
- `403`: Unauthorized (not owner and not admin, or trying to move to unowned subject)
- `404`: Unit or subject not found
- `500`: Internal server error

---

### DELETE `/units/:unitId`
**Summary**: Deletes a unit (admin can delete any, teachers only their own) - returns deleted unit data

**Request Body**: None

**Response Body** (200):
```json
{
  "unit": {
    "id": number,
    "name": string,
    "description": string,
    "subject_id": number,
    "teacher_id": number,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Deleted successfully
- `403`: Unauthorized (not owner and not admin)
- `404`: Unit not found
- `500`: Internal server error

---

## Lessons Endpoints (`/lessons`)

### POST `/lessons`
**Summary**: Creates a new lesson within a unit

**Request Body** (Form Data):
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "unit_id": "number (required)",
  "content_type": "string (required) - 'text', 'pdf', or 'word'",
  "id": "number (required) - teacher_id",
  "content": "string (required only for text content_type)"
}
```

**Additional**: File upload via `file` field (required for PDF/Word content_type)

**Response Body** (201 for text, 201 for files):
```json
// Text lessons
{
  "lesson": {
    "id": number,
    "name": string,
    "description": string,
    "unit_id": number,
    "teacher_id": number,
    "content": string,
    "created_at": string
  },
  "content_type": "text"
}

// File lessons
{
  "message": "Lesson created successfully",
  "fileProcessed": true,
  "content_type": "pdf|word",
  "fileType": "string",
  "fileName": "string"
}
```

**Response Codes**:
- `201`: Created successfully
- `400`: Missing required fields, invalid content_type, or file type mismatch
- `403`: Unauthorized (unit not owned by teacher)
- `404`: Unit not found
- `500`: Internal server error

**Quirks**:
- For `content_type: "text"`: Provide `content` field with lesson text
- For `content_type: "pdf"` or `content_type: "word"`: Upload file via `file` field, content extraction is placeholder (TODO)
- File validation checks MIME type and file extension
- PDF processing and Word processing are not yet implemented (placeholder responses)

---

### GET `/lessons/mine`
**Summary**: Gets all lessons owned by the authenticated teacher

**Request Body**: None

**Response Body** (200):
```json
{
  "lessons": [
    {
      "id": number,
      "name": string,
      "description": string,
      "unit_id": number,
      "teacher_id": number,
      "content": string,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `500`: Internal server error

---

### GET `/lessons/unit/:unitId`
**Summary**: Gets all lessons within a specific unit (admin can access any unit, teachers only their own units)

**Request Body**: None

**Response Body** (200):
```json
{
  "lessons": [
    {
      "id": number,
      "name": string,
      "description": string,
      "unit_id": number,
      "teacher_id": number,
      "content": string,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not unit owner and not admin)
- `404`: Unit not found
- `500`: Internal server error

---

### GET `/lessons/:lessonId`
**Summary**: Gets a specific lesson by ID (admin can access any, teachers only their own)

**Request Body**: None

**Response Body** (200):
```json
{
  "lesson": {
    "id": number,
    "name": string,
    "description": string,
    "unit_id": number,
    "teacher_id": number,
    "content": string,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Success
- `403`: Unauthorized (not owner and not admin)
- `404`: Lesson not found
- `500`: Internal server error

---

### GET `/lessons`
**Summary**: Gets all lessons in the system (admin only)

**Request Body**: None

**Response Body** (200):
```json
{
  "lessons": [
    {
      "id": number,
      "name": string,
      "description": string,
      "unit_id": number,
      "teacher_id": number,
      "content": string,
      "created_at": string
    }
  ]
}
```

**Response Codes**:
- `200`: Success
- `403`: Forbidden (not admin)
- `500`: Internal server error

---

### PUT `/lessons/:lessonId`
**Summary**: Updates a lesson (admin can update any, teachers only their own)

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "content": "string (required)",
  "unit_id": "number (optional)"
}
```

**Response Body** (200):
```json
{
  "lesson": {
    "id": number,
    "name": string,
    "description": string,
    "unit_id": number,
    "teacher_id": number,
    "content": string,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Updated successfully
- `400`: Missing required fields
- `403`: Unauthorized (not owner and not admin, or trying to move to unowned unit)
- `404`: Lesson or unit not found
- `500`: Internal server error

---

### DELETE `/lessons/:lessonId`
**Summary**: Deletes a lesson (admin can delete any, teachers only their own) - returns deleted lesson data

**Request Body**: None

**Response Body** (200):
```json
{
  "lesson": {
    "id": number,
    "name": string,
    "description": string,
    "unit_id": number,
    "teacher_id": number,
    "content": string,
    "created_at": string
  }
}
```

**Response Codes**:
- `200`: Deleted successfully
- `403`: Unauthorized (not owner and not admin)
- `404`: Lesson not found
- `500`: Internal server error

---

## General Response Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Authentication Notes
- All endpoints except `/auth/login` and `/auth/logout` require `Authorization: Bearer <token>` header
- Teachers can only access/modify their own resources
- Admins have full access to all resources
- Resource ownership is validated on create/update/delete operations
