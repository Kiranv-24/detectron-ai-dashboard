import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFReportService from '../services/pdfReportService.js';
import { violationStorage } from '../services/violationStorageService.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const pdfService = new PDFReportService();

// Return list of generated PDF reports
router.get('/reports', async (req, res) => {
  try {
    const reports = pdfService.getAllReports();
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

// Return recent violation records (for UI Recent Violations list)
router.get('/data', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const recent = violationStorage.getRecentViolations(limit);
    res.json(recent);
  } catch (error) {
    console.error('Error fetching violations data:', error);
    res.status(500).json({ error: 'Error fetching violations data' });
  }
});

// Return statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = violationStorage.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Error fetching statistics' });
  }
});

// Download a report by filename
router.get('/download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(path.resolve(), 'server', 'reports', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Error sending file:', err);
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Error downloading report' });
  }
});

// Delete a report by filename
router.delete('/delete/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const success = pdfService.deleteReport(fileName);
    if (!success) return res.status(500).json({ error: 'Failed to delete report' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

export default router;
