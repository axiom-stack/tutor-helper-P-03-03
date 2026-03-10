import { createStatsService } from "../stats/stats.service.js";
import { validateStatsQuery } from "../stats/requestModel.js";
import { exportStats } from "../export/exportService.js";

export function createStatsController({
  statsService = createStatsService(),
  statsExporter = exportStats,
} = {}) {
  return {
    async getSummary(req, res) {
      try {
        const validation = validateStatsQuery(req.query, req.user);

        if (!validation.ok) {
          return res.status(validation.status || 400).json({
            error: {
              code: validation.code || "invalid_query",
              message: validation.message || "Invalid stats query",
            },
          });
        }

        const summary = await statsService.getSummary(validation.value, {
          userId: req.user.id,
          role: req.user.role,
          username: req.user.username,
        });

        return res.status(200).json(summary);
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected stats summary failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while loading stats",
          },
        });
      }
    },

    async exportReport(req, res) {
      try {
        const format = String(req.query.format || "").trim().toLowerCase();

        if (format !== "pdf") {
          return res.status(400).json({
            error: {
              code: "invalid_format",
              message: "format must be pdf",
            },
          });
        }

        const validation = validateStatsQuery(req.query, req.user);

        if (!validation.ok) {
          return res.status(validation.status || 400).json({
            error: {
              code: validation.code || "invalid_query",
              message: validation.message || "Invalid stats query",
            },
          });
        }

        const summary = await statsService.getSummary(validation.value, {
          userId: req.user.id,
          role: req.user.role,
          username: req.user.username,
        });

        const { buffer, mimeType, suggestedFilename } = await statsExporter(
          summary,
          format,
        );

        res.setHeader("Content-Type", mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${suggestedFilename}"`,
        );

        return res.send(buffer);
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected stats export failure");
        return res.status(500).json({
          error: {
            code: "export_failed",
            message: "Failed to export stats report",
          },
        });
      }
    },
  };
}

const statsController = createStatsController();

export const getStatsSummary = statsController.getSummary;
export const exportStatsReport = statsController.exportReport;
