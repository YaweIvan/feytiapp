An AI-powered document assistant that summarizes PDF and Word documents instantly.

Live Demo
[https://feytiapp.vercel.app/]

How It Works
1. User uploads a PDF or Word (.docx) document
2. Backend extracts the text using pdf-parse and mammoth
3. Text is sent to Groq AI (LLaMA3 model) for analysis
4. AI returns title, author, summary and key points
5. Results are displayed on a clean interface

Tech Stack
 Frontend: Next.js + Tailwind CSS (deployed on Vercel)
Backend: Node.js + Express (deployed on Render)
AI: Groq API (LLaMA3-8b model)

Run Locally

 Backend
cd backend
npm install

 Add your GROQ_API_KEY to .env file
node index.js

Frontend
cd frontend
npm install
npm run dev

Folder Structure
summarymynote/
├── backend/
│   ├── routes/
│   │   └── upload.js
│   ├── utils/
│   │   ├── extractText.js
│   │   └── groq.js
│   ├── .env
│   └── index.js
└── frontend/
    └── app/
        └── page.js
