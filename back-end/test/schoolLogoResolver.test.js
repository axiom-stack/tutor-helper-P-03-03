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

