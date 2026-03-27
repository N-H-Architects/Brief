import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';
import { google } from 'googleapis';
import { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  const app = express();
  const PORT = 3000;

  app.use(cors());
  
  // Logging middleware - Move to the VERY top
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get(['/api/health', '/api/health/'], (req, res) => {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let serviceAccountEmail = 'Chưa cấu hình';
    
    if (serviceAccountJson) {
      try {
        const creds = JSON.parse(serviceAccountJson);
        serviceAccountEmail = creds.client_email;
      } catch (e) {
        serviceAccountEmail = 'Lỗi định dạng JSON';
      }
    }

    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      config: {
        folderIdSet: !!process.env.VITE_GOOGLE_DRIVE_FOLDER_ID && process.env.VITE_GOOGLE_DRIVE_FOLDER_ID !== 'YOUR_GOOGLE_DRIVE_FOLDER_ID',
        serviceAccountSet: !!serviceAccountJson,
        serviceAccountEmail: serviceAccountEmail
      }
    });
  });

  // API Route for Google Drive Upload (No-Login)
  app.post(['/api/upload-to-drive', '/api/upload-to-drive/'], (req, res, next) => {
    console.log(`Entering /api/upload-to-drive route. Method: ${req.method}, URL: ${req.url}`);
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer Middleware Error:', err);
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      next();
    });
  }, async (req: any, res) => {
    console.log('Multer processing complete, starting Drive upload logic');
    try {
      const file = req.file;
      const fileName = req.body.fileName;
      
      if (!file) {
        console.error('Upload failed: No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`Processing file: ${file.originalname} (${file.size} bytes)`);
      console.log(`Target fileName: ${fileName}`);
      
      const folderId = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

      if (!folderId || folderId === 'YOUR_GOOGLE_DRIVE_FOLDER_ID') {
        console.error('Upload failed: VITE_GOOGLE_DRIVE_FOLDER_ID is not configured');
        return res.status(400).json({ 
          error: 'Chưa cấu hình Folder ID. Vui lòng lấy ID thư mục Google Drive và dán vào Secret VITE_GOOGLE_DRIVE_FOLDER_ID.' 
        });
      }

      if (!serviceAccountJson) {
        console.error('Upload failed: Missing GOOGLE_SERVICE_ACCOUNT_JSON');
        return res.status(500).json({ error: 'Google Service Account JSON chưa được cấu hình trong Secrets.' });
      }

      let credentials;
      try {
        credentials = JSON.parse(serviceAccountJson);
      } catch (e) {
        return res.status(500).json({ error: 'Định dạng JSON của Service Account không hợp lệ.' });
      }

      const auth = google.auth.fromJSON(credentials);
      (auth as any).scopes = ['https://www.googleapis.com/auth/drive.file'];

      const drive = google.drive({ version: 'v3', auth: auth as any });

      const fileMetadata = {
        name: fileName || `Survey_Data_${new Date().getTime()}.xlsx`,
        parents: [folderId],
      };

      const media = {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Readable.from(file.buffer),
      };

      console.log(`Attempting upload to folder: ${folderId}`);

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
        supportsAllDrives: true, // Hỗ trợ cả Shared Drives
      });

      console.log('Upload successful, File ID:', response.data.id);
      res.json({ success: true, fileId: response.data.id });
    } catch (error: any) {
      console.error('Server-side Drive Upload Error:', error);
      
      let userFriendlyError = error.message;
      if (error.message?.includes('storage quota')) {
        userFriendlyError = 'Service Account không có dung lượng. Vui lòng: 1. Tạo thư mục trên Drive cá nhân. 2. Chia sẻ thư mục đó cho email của Service Account với quyền Editor. 3. Đảm bảo đã dán đúng ID thư mục vào Secret VITE_GOOGLE_DRIVE_FOLDER_ID.';
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: error.response?.data || null
      });
    }
  });

  // API 404 handler
  app.all('/api/*', (req, res) => {
    console.log(`API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global Error Handler:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });
}

startServer();
