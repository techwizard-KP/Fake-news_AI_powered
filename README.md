# 🔍 Veritas.BERT - AI-Powered Fake News Detection System

A production-ready full-stack application that detects fake news using **BERT (RoBERTa)** and **Gemini AI**, with **RAG-powered semantic search**, real-time classification, chat interface, and persistent storage.

## ✨ Features

### Core Functionality
- **🔍 Dual AI Detection** - BERT classifier (99%+ accuracy in TEXT mode) + Gemini AI verification
- **🧠 RAG Semantic Search** - Search your analysis history using natural language
- **💬 Smart Chat Interface** - Ask questions about any analyzed article
- **📊 Real-time Statistics** - Track total analyses, fake vs real ratio
- **📜 History Tracking** - All analyses saved to MongoDB Atlas
- **📰 Live News Feed** - Trending news from NewsAPI
- **🎨 Modern UI** - Built with React + Tailwind CSS

### Input Methods
- **📝 Text Mode** - Paste article text directly (instant analysis)
- **🔗 URL Mode** - Analyze news articles from any URL
- **📱 Responsive Design** - Works on desktop, tablet, and mobile

### Export & Share
- **📸 Export as PNG** - Download results as image
- **📄 Export as PDF** - Generate professional reports

## 🏗️ Architecture
┌─────────────────────────────────────────────────────────────┐
│ React Frontend │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │
│ │Analyzer │ │ Result │ │ Chat │ │ RAG Search │ │
│ │URL/Text │ │ Panel │ │ Panel │ │ Semantic │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓ API Calls
┌─────────────────────────────────────────────────────────────┐
│ FastAPI Backend │
│ ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│ │ BERT/RoBERTa │ │ Gemini │ │ RAG │ │ MongoDB │ │
│ │ Fake News │ │ AI Fact- │ │ Semantic │ │ Cloud │ │
│ │ Classifier │ │ Checking │ │ Search │ │ Database │ │
│ └──────────────┘ └──────────┘ └──────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────┘

text

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | High-performance async API framework |
| **BERT/RoBERTa** | Fake news classification model |
| **Gemini AI** | AI-powered explanations & fact-checking |
| **RAG (ChromaDB)** | Semantic search over analysis history |
| **Sentence Transformers** | Text embeddings for RAG |
| **MongoDB Atlas** | Cloud database for history/stats |
| **Uvicorn** | ASGI server for FastAPI |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Tailwind CSS** | Utility-first styling |
| **Axios** | API client with timeout |
| **Phosphor Icons** | Beautiful icon library |
| **Sonner** | Toast notifications |

### DevOps
| Platform | Purpose |
|----------|---------|
| **GitHub** | Version control |
| **Render** | Backend hosting (free tier) |
| **Vercel** | Frontend hosting (free tier) |
| **MongoDB Atlas** | Cloud database (free tier) |




## 🚀 Quick Start

### Prerequisites
- Python 3.11+ (3.10 works too)
- Node.js 16+
- MongoDB Atlas account (free)
- Gemini API key (free)
- NewsAPI key (free - optional)

### 1. Clone the Repository

```bash
git clone https://github.com/techwizard-KP/Fake-news_AI_powered.git
cd Fake-news_AI_powered
2. Backend Setup
bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
Create .env file:

bash
MONGO_URL=your_mongodb_atlas_connection_string
DB_NAME=fake_news_db
GEMINI_API_KEY=your_gemini_api_key
NEWS_API_KEY=your_newsapi_key
Start backend:

bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
3. Frontend Setup
bash
cd frontend
npm install
npm start
Open http://localhost:3000

4. Index Existing History for RAG (Optional)
After backend is running, index your existing analyses:

bash
curl -X POST http://localhost:8000/api/rag/index-all
📡 API Endpoints
Method	Endpoint	Description	Status
POST	/api/analyze-fast	BERT-only text analysis	✅ Working
POST	/api/analyze	Full analysis (BERT + Gemini)	✅ Working
POST	/api/chat	Chat with Gemini about article	✅ Working
POST	/api/rag/search	Semantic search over history	✅ New!
POST	/api/rag/index-all	Index all analyses for RAG	✅ New!
GET	/api/history	Get analysis history	✅ Working
GET	/api/stats	Get statistics	✅ Working
GET	/api/trending	Live news feed	✅ Working
GET	/api/health	Health check	✅ Working
🧠 RAG (Retrieval-Augmented Generation)
What is RAG?
RAG allows you to search your analysis history using natural language. Instead of keyword matching, it understands meaning.

Example Queries:
"Show me fake news about technology"

"Find articles where BERT and Gemini disagreed"

"High confidence real news from last week"

"Controversial articles about politics"

How it Works:
Your query is converted to a vector embedding

ChromaDB finds semantically similar past analyses

Results are returned with similarity scores

🔧 Troubleshooting
Common Issues & Solutions
Issue	Solution
MongoDB connection error	Check .env MONGO_URL and whitelist IP in Atlas
Gemini quota exceeded	Wait 30 seconds or use BERT-only mode
RAG search slow	First run /api/rag/index-all to index existing data
chroma_db error	Delete backend/chroma_db/ folder and re-index
News feed empty	Check NEWS_API_KEY or use RSS fallback
Port Binding
Backend default: 8000

Frontend default: 3000

📊 Performance Metrics
Metric	Value
BERT inference time	~0.5 seconds
Gemini response time	~2-3 seconds
RAG search time	~0.3 seconds
Total analysis (BERT only)	<1 second
Total analysis (with Gemini)	~3-4 seconds
🚧 Future Improvements
Switch to google.genai (newer Gemini SDK)

Add user authentication

Implement batch processing

Deploy to production

Add more BERT model options

Improve URL article extraction

Add support for PDF/image uploads

🤝 Contributing
Fork the repository

Create feature branch (git checkout -b feature/amazing)

Commit changes (git commit -m 'Add amazing feature')

Push to branch (git push origin feature/amazing)

Open Pull Request

👨‍💻 Author
Pavan Komaranapura Prakash

Email: pavankp5005@gmail.com


🙏 Acknowledgments
Hugging Face for transformers library

Google for Gemini API

Chroma for vector database

NewsAPI for live news feed

MongoDB Atlas for cloud database

⭐ Show Your Support
If this project helped you, please give it a ⭐ on GitHub!

Built with 🐍 Python, ⚛️ React, 🤖 BERT, ✨ Gemini AI, and 🧠 RAG

