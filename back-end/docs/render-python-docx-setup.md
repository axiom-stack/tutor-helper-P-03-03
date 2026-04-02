# Render Setup: Python DOCX Exam Export

Use this only for the exam Word export Python path.

## Service settings

- Root Directory: `back-end`
- Build Command:

```bash
npm install && python3 -m venv .venv && ./.venv/bin/pip install -r scripts/requirements.txt
```

- Start Command: `npm start`

## Environment variables

- `PYTHON_BIN=./.venv/bin/python`
- `EXAM_DOCX_PYTHON_ONLY=1`

## Why these matter

- `python-shell` runs the Python generator from the Node backend.
- `python-docx` is installed into a local virtual environment during the Render build.
- `EXAM_DOCX_PYTHON_ONLY=1` forces the exam DOCX export to use Python instead of falling back to JavaScript.

## Notes

- Keep this service as a Node web service on Render.
- If you change the Python file location, update `PYTHON_BIN` only if the virtualenv path changes.
- If the Python dependency is missing, the export should fail loudly rather than silently falling back when `EXAM_DOCX_PYTHON_ONLY=1` is set.
