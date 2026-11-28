# Running Tutor Helper locally

The archive includes the existing backend and frontend `.env` files. They may contain working credentials: share this archive only with trusted recipients and avoid committing those files to Git.

## Prerequisites

- Node.js 22 or newer and npm.
- Python 3 and pip for the backend's Python-based document export.
- Network access to the services configured in `back-end/.env`, including the database and Groq.

## Backend

```sh
cd back-end
npm ci
python3 -m pip install -r scripts/requirements.txt
npm run dev
```

The development command loads `back-end/.env`. Make sure the configured Turso database and Groq API key remain accessible to the recipient. Existing environment values may need adjustment for their machine.

## Frontend

Open a second terminal:

```sh
cd front-end
npm ci
npm run dev
```

Open the local address printed by Vite. Check `VITE_BACKEND_URL` in `front-end/.env` if the frontend should call a local backend rather than the hosted API.

`node_modules` folders are intentionally omitted: `npm ci` recreates them from the included lockfiles. Existing data and externally hosted services are not included in this archive.
