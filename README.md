# Detectron AI Dashboard

A modern, real-time AI object detection dashboard powered by Roboflow 3.0 with WebSocket support for live detection.

## Features

- 🎥 **Live Camera Detection** - Real-time object detection using your webcam
- 📸 **Image Upload Detection** - Upload images for instant analysis
- 🔄 **WebSocket Integration** - Low-latency real-time communication
- 🤖 **Roboflow API Integration** - Powered by state-of-the-art AI models
- 📊 **Real-time Statistics** - Live FPS, processing time, and detection metrics
- 🎨 **Modern UI** - Beautiful, responsive interface with dark/light themes
- ⚡ **Performance Optimized** - Efficient image processing and frame capture

## Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **Socket.io Client** for WebSocket communication
- **Lucide React** for icons

### Backend

- **Node.js** with Express
- **Socket.io** for WebSocket server
- **Sharp** for image processing
- **Multer** for file uploads
- **Helmet** for security
- **Rate Limiting** for API protection

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- A Roboflow API key (optional - mock data available)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd detectron-ai-dashboard

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment

Copy the example environment file and configure your Roboflow API key:

```bash
# Copy environment file
cp server/env.example server/.env

# Edit the .env file
nano server/.env
```

Update the following variables in `server/.env`:

```env
# Roboflow API Configuration
ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY_HERE
ROBOFLOW_MODEL_URL=internship-9cig4/1
ROBOFLOW_CHECKPOINT=idpr-rh5oc/2

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080
```

### 3. Start the Application

Open two terminal windows:

**Terminal 1 - Backend Server:**

```bash
cd server
npm run dev
```

**Terminal 2 - Frontend Development:**

```bash
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## API Configuration

### Getting Your Roboflow API Key

1. Go to [Roboflow](https://roboflow.com)
2. Create an account or sign in
3. Navigate to your workspace
4. Go to Settings > API Keys
5. Copy your API key
6. Paste it in the `ROBOFLOW_API_KEY` field in your `.env` file

### Model Configuration

The application is configured to use:

- **Model URL**: `internship-snt8r/1`
- **Checkpoint**: None (RF-DETR Nano model)

You can modify these in the `.env` file or update the `ModelInfo.tsx` component.

## Usage

### Live Detection

1. Click "Start Camera" to access your webcam
2. Allow camera permissions when prompted
3. Click "Start Detection" to begin real-time object detection
4. View live statistics and detection results

### Image Upload Detection

1. Click "Upload Image" or drag and drop an image
2. Click "Detect Objects" to analyze the image
3. View bounding boxes and detection results

## Development

### Project Structure

```
detectron-ai-dashboard/
├── src/                    # Frontend React app
│   ├── components/         # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── services/          # API services
│   └── lib/               # Utility functions
├── server/                # Backend Node.js server
│   ├── services/          # Business logic services
│   ├── server.js          # Main server file
│   └── package.json       # Backend dependencies
└── public/                # Static assets
```

### Available Scripts

**Frontend:**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

**Backend:**

```bash
npm run dev          # Start with nodemon (development)
npm start            # Start production server
npm test             # Run tests
```

### Environment Variables

| Variable              | Description           | Default                 |
| --------------------- | --------------------- | ----------------------- |
| `ROBOFLOW_API_KEY`    | Your Roboflow API key | Required                |
| `ROBOFLOW_MODEL_URL`  | Roboflow model URL    | `internship-9cig4/1`    |
| `ROBOFLOW_CHECKPOINT` | Model checkpoint      | `idpr-rh5oc/2`          |
| `PORT`                | Server port           | `3001`                  |
| `NODE_ENV`            | Environment           | `development`           |
| `CORS_ORIGIN`         | Allowed CORS origins  | `http://localhost:8080` |

## Features in Detail

### Real-time WebSocket Communication

- Low-latency frame processing
- Automatic reconnection handling
- Connection status indicators
- Performance metrics

### Image Processing

- Automatic image resizing for optimal detection
- Multiple format support (JPEG, PNG, WebP)
- Batch processing capabilities
- Thumbnail generation

### Security Features

- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- Input validation

### Performance Optimizations

- Frame rate throttling
- Image compression
- Efficient WebSocket message handling
- Memory management

## Troubleshooting

### Common Issues

**Camera not working:**

- Ensure you're using HTTPS or localhost
- Check browser permissions
- Verify camera is not in use by another application

**WebSocket connection failed:**

- Ensure backend server is running on port 3001
- Check CORS configuration
- Verify firewall settings

**API key issues:**

- Verify your Roboflow API key is correct
- Check if the model URL and checkpoint are valid
- Ensure you have sufficient API credits

**Performance issues:**

- Reduce FPS in detection settings
- Lower image resolution
- Check server resources

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Check the troubleshooting section
- Review the console logs for errors
- Ensure all dependencies are installed correctly
- Verify environment configuration
