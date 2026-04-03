import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeOptionalImageDataUrl,
  parseImageDataUrl,
} from "../src/utils/imageDataUrl.js";

test("parseImageDataUrl extracts mime type and base64 payload", () => {
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

  const parsed = parseImageDataUrl(logo);

  assert.deepEqual(parsed, {
    mimeType: "image/png",
    base64Data:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  });
});

test("normalizeOptionalImageDataUrl accepts empty values and valid data URLs", () => {
  const logo =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUREhIVFRUVFRUVFRUVFRUVFRUVFRUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OFxAQGzclHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQIH/8QAFhABAQEAAAAAAAAAAAAAAAAAAQAC/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwD2AD//2Q==";
  const quotedWithParams = `"data:IMAGE/PNG;name=logo.png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="`;

  assert.equal(normalizeOptionalImageDataUrl(null), null);
  assert.equal(normalizeOptionalImageDataUrl(""), null);
  assert.equal(normalizeOptionalImageDataUrl("   "), null);
  assert.equal(normalizeOptionalImageDataUrl(logo), logo);
  assert.equal(
    normalizeOptionalImageDataUrl(quotedWithParams),
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  );
});

test("normalizeOptionalImageDataUrl rejects malformed strings", () => {
  assert.ok(Number.isNaN(normalizeOptionalImageDataUrl("not-a-data-url")));
  assert.ok(
    Number.isNaN(normalizeOptionalImageDataUrl("data:text/plain;base64,abc")),
  );
});
