import test from "node:test";
import assert from "node:assert/strict";

import sharp from "sharp";

import {
  inspectSchoolLogoValue,
  resolveSchoolLogoForExport,
} from "../src/export/schoolLogoResolver.js";
import { parseImageDataUrl } from "../src/utils/imageDataUrl.js";

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("inspectSchoolLogoValue returns ok for canonical PNG", async () => {
  const inspected = await inspectSchoolLogoValue(SAMPLE_PNG_DATA_URL);
  assert.equal(inspected.status, "ok");
  assert.equal(inspected.reason, null);
  assert.ok(inspected.normalizedDataUrl);
});

test("inspectSchoolLogoValue recovers JPEG/quoted values to PNG", async () => {
  const jpegBuffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 200, g: 90, b: 20 },
    },
  })
    .jpeg()
    .toBuffer();
  const quotedJpeg = `"data:IMAGE/JPEG;name=logo.jpg;base64,${jpegBuffer.toString("base64")}"`;

  const inspected = await inspectSchoolLogoValue(quotedJpeg);
  assert.equal(inspected.status, "recovered");
  assert.equal(inspected.reason, "normalized_to_png");
  const parsed = parseImageDataUrl(inspected.normalizedDataUrl);
  assert.equal(parsed?.mimeType, "image/png");
});

test("inspectSchoolLogoValue recovers raw base64 payloads without data URL prefix", async () => {
  const rawBase64Payload = SAMPLE_PNG_DATA_URL.replace(/^data:image\/png;base64,/u, "");
  const inspected = await inspectSchoolLogoValue(rawBase64Payload);

  assert.equal(inspected.status, "recovered");
  assert.equal(inspected.reason, "recovered_raw_base64_payload");
  const parsed = parseImageDataUrl(inspected.normalizedDataUrl);
  assert.equal(parsed?.mimeType, "image/png");
});

test("inspectSchoolLogoValue repairs URL-safe base64 data URLs wrapped in JSON", async () => {
  let jpegBase64 = "";
  for (let i = 0; i < 12; i += 1) {
    const jpegBuffer = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: {
          r: (30 + i * 17) % 255,
          g: (90 + i * 11) % 255,
          b: (170 + i * 7) % 255,
        },
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer();
    jpegBase64 = jpegBuffer.toString("base64");
    if (/[+/]/u.test(jpegBase64)) {
      break;
    }
  }

  const urlSafePayload = jpegBase64.replace(/\+/gu, "-").replace(/\//gu, "_");
  const wrappedValue = JSON.stringify({
    logo: `data:image/jpeg;base64,${urlSafePayload}`,
  });

  const inspected = await inspectSchoolLogoValue(wrappedValue);
  assert.equal(inspected.status, "recovered");
  assert.equal(inspected.reason, "repaired_data_url_payload");
  const parsed = parseImageDataUrl(inspected.normalizedDataUrl);
  assert.equal(parsed?.mimeType, "image/png");
});

test("resolveSchoolLogoForExport uses visible fallback for invalid logos", async () => {
  const { exam, logoResolution } = await resolveSchoolLogoForExport({
    public_id: "exm_1",
    school_logo_url: "not-a-data-url",
  });

  assert.equal(logoResolution.status, "invalid");
  assert.equal(logoResolution.fallback_used, true);
  const parsedFallback = parseImageDataUrl(exam.school_logo_url);
  assert.equal(parsedFallback?.mimeType, "image/png");
  assert.ok((parsedFallback?.base64Data?.length ?? 0) > 0);
});
