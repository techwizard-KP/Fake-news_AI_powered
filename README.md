A full-stack fake news detection system that uses BERT (RoBERTa) model to classify news articles as REAL or FAKE with high accuracy.

## 🎯 Current Status

### ✅ Working Features
- BERT-based fake news classifier (hamzab/roberta-fake-news-classification)
- Fast text analysis endpoint (returns results in <2 seconds)
- Dual input modes: URL and direct text input
- Real-time classification with confidence scores
- Modern React frontend with responsive UI
- History tracking (frontend only - database pending)

### ⏳ In Progress / Pending
- MongoDB integration for persistent storage
- Gemini LLM integration for explanations
- URL fetching from news sites (CNN, Reuters, BBC)
- Statistics dashboard (Articles Analyzed, Flagged Fake, Verified Real)

## 📋 Table of Contents
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Usage](#usage)
- [Model Information](#model-information)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Python web framework
- **BERT/RoBERTa** - Fake news classification model
- **Transformers (Hugging Face)** - Model loading and inference
- **PyTorch** - Deep learning backend
- **Uvicorn** - ASGI server

### Frontend
- **React** - UI framework
- **Tailwind CSS** - Styling
- **Phosphor Icons** - Icon library
- **Sonner** - Toast notifications

### Planned
- **MongoDB** - Database for storing analysis history
- **Gemini API** - AI-powered explanations
- **Newspaper3k** - Article extraction

## 📁 Project Structure
Fake-news_AI_powered/
├── backend/
│ ├── server.py # FastAPI application
│ ├── requirements.txt # Python dependencies
│ ├── .env # Environment variables (not tracked)
│ └── venv/ # Virtual environment (ignored)
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ │ ├── Analyzer.jsx # URL/Text input component
│ │ │ ├── ResultPanel.jsx # Results display
│ │ │ └── ...
│ │ ├── pages/
│ │ │ └── Dashboard.jsx # Main dashboard
│ │ ├── lib/
│ │ │ └── api.js # API client
│ │ └── App.js
│ ├── package.json
│ └── ...
└── README.md

text

## 🚀 Installation

### Prerequisites
- Python 3.10+
- Node.js 16+
- npm or yarn

### Backend Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Fake-news_AI_powered/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux
# venv\Scripts\activate   # On Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=fake_news_db
GEMINI_API_KEY=your_gemini_api_key_here
EOF
Frontend Setup
bash
cd ../frontend
npm install
🏃 Running the App
Start Backend Server
bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
The backend will run at http://localhost:8000

Start Frontend (in new terminal)
bash
cd frontend
npm start
The frontend will run at http://localhost:3000

📡 API Endpoints
Method	Endpoint	Description	Status
POST	/api/analyze	Analyze news article by URL	🟡 Partial
POST	/api/analyze-fast	Analyze text directly (BERT only)	✅ Working
GET	/api/health	Health check	✅ Working
GET	/api/model/status	Model status	✅ Working
GET	/api/history	Get analysis history	🟡 Pending DB
GET	/api/stats	Get statistics	🟡 Pending DB
POST	/api/chat	Chat about analysis	🟡 Pending Gemini
💻 Usage
Text Analysis (Working)
Open http://localhost:3000

Click "Text Mode" button

Paste news article text

Click "Verify Text"

View verdict (REAL/FAKE) with confidence score

URL Analysis (Partial)
Click "URL Mode" button

Paste article URL

Click "Verify Article"

Note: Currently works only with some sites (e.g., The Onion)

🤖 Model Information
Model: hamzab/roberta-fake-news-classification

Type: RoBERTa-based classifier

Labels: TRUE (REAL), FAKE

Accuracy: 99%+ on test data

Input length: 512 tokens

Label Mapping
Model output TRUE → UI shows REAL

Model output FAKE → UI shows FAKE

🔧 Troubleshooting
Backend won't start
bash
# Check if port 8000 is in use
lsof -i :8000
kill -9 <PID>

# Reinstall dependencies
pip install -r requirements.txt
MongoDB connection errors
MongoDB is not required for basic text analysis

To enable history/stats, set up MongoDB or comment out DB code

Model loading slow on first run
First run downloads model (~500MB)

Subsequent runs load from cache

CORS errors
Ensure backend has CORS middleware configured

Check allow_origins includes http://localhost:3000

📝 Next Steps
Priority 1: Database Integration
Set up MongoDB (local or Atlas)

Implement persistent storage for analyses

Enable history and statistics

Priority 2: Gemini Integration
Add Gemini API for explanations

Implement dual-verification system

Generate forensic analysis reports

Priority 3: URL Fetching
Implement proper article extraction

Handle paywalls and anti-bot measures

Support major news sites (CNN, Reuters, BBC)

Priority 4: Enhancements
Add user authentication

Implement batch processing

Create export functionality (PDF/CSV)

Deploy to cloud (AWS, GCP, or Heroku)

🙏 Acknowledgments
Hugging Face for transformers library

Google for Gemini API

UI design inspired by modern news platforms

Built with 🐍 Python ⚛️ React 🤖 BERT
