#!/bin/bash

# Detectron AI Dashboard Setup Script
echo "🚀 Setting up Detectron AI Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

# Create .env file if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "📝 Creating environment configuration..."
    cp server/env.example server/.env
    echo "✅ Environment file created at server/.env"
    echo "⚠️  Please update server/.env with your Roboflow API key"
else
    echo "✅ Environment file already exists"
fi

# Create startup scripts
echo "📝 Creating startup scripts..."

# Frontend dev script
cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "🎨 Starting frontend development server..."
npm run dev
EOF

# Backend dev script
cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "🔧 Starting backend development server..."
cd server
npm run dev
EOF

# Full development script
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Detectron AI Dashboard in development mode..."

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend server..."
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Both servers started!"
echo "🌐 Frontend: http://localhost:8080"
echo "🔧 Backend: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for processes
wait $FRONTEND_PID $BACKEND_PID
EOF

# Make scripts executable
chmod +x start-frontend.sh start-backend.sh start-dev.sh

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update server/.env with your Roboflow API key"
echo "2. Start the development servers:"
echo "   - Full stack: ./start-dev.sh"
echo "   - Frontend only: ./start-frontend.sh"
echo "   - Backend only: ./start-backend.sh"
echo ""
echo "🌐 Access your application at:"
echo "   - Frontend: http://localhost:8080"
echo "   - Backend API: http://localhost:3001"
echo ""
echo "📚 For more information, see README.md"
