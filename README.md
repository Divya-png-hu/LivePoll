````markdown
# LivePoll

A real-time polling application where users can create polls, share them with others, collect votes, and watch results update live without refreshing the page.

## 🚀 Live Demo

**Frontend:**  
https://livepoll-frontend-9ntc.onrender.com

**Backend:**  
https://livepoll-backend-oa56.onrender.com

**Backend Health Check:**  
https://livepoll-backend-oa56.onrender.com/health

---

## 📌 Project Overview

LivePoll is a full-stack real-time polling application developed using React, Go (Gin), MongoDB, and Redis.

The application allows authenticated users to:

- Create polls with multiple options
- Share polls using a public link
- Allow participants to vote
- View live voting results
- Close polls
- Prevent voting after a poll is closed
- Prevent the same browser from voting multiple times on the same poll

The main focus of the project is real-time result updates using Redis and Server-Sent Events (SSE).

---

## ✨ Features

### 🔐 Authentication

- User signup and login
- Password hashing using bcrypt
- JWT-based authentication
- Protected poll creation and management routes

### 📊 Poll Management

- Create polls with multiple options
- View polls created by the logged-in user
- Open and share polls using a public URL
- Close active polls
- Closed polls cannot receive new votes

### 🗳️ Voting

- Public poll participation
- Option validation
- Vote submission
- Browser-based voter identification using an HTTP-only cookie
- Duplicate vote prevention

### ⚡ Real-Time Results

- Vote counts are stored and updated in Redis
- Redis Pub/Sub is used for real-time vote events
- Server-Sent Events (SSE) pushes vote updates to connected clients
- Results update automatically without page refresh

### 📱 Responsive Usage

The public poll link can be opened from different devices, allowing poll creators and participants to use the application simultaneously.

---

## 🛠️ Technology Stack

### Frontend

- React
- Vite
- React Router
- JavaScript
- CSS

### Backend

- Go
- Gin Web Framework
- JWT
- bcrypt

### Database

- MongoDB Atlas

### Real-Time Communication

- Redis
- Redis Pub/Sub
- Server-Sent Events (SSE)

### Deployment

- Render
- GitHub

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    │      (Vite)         │
                    └──────────┬──────────┘
                               │
                               │ HTTP / JSON
                               ▼
                    ┌─────────────────────┐
                    │     Go + Gin API    │
                    │      Backend        │
                    └──────┬───────┬──────┘
                           │       │
                ┌──────────┘       └──────────┐
                ▼                             ▼
       ┌─────────────────┐           ┌─────────────────┐
       │  MongoDB Atlas  │           │      Redis      │
       │                 │           │                 │
       │ Users           │           │ Vote counts     │
       │ Polls           │           │ Pub/Sub events  │
       │ Votes           │           │                 │
       └─────────────────┘           └────────┬────────┘
                                              │
                                              │ SSE
                                              ▼
                                    ┌─────────────────┐
                                    │ Connected Users │
                                    │ Live Results    │
                                    └─────────────────┘
```
````

---

## 🔄 Application Flow

### 1. User Authentication

```text
Signup
  ↓
Password hashed using bcrypt
  ↓
User stored in MongoDB
  ↓
Login
  ↓
JWT generated
  ↓
JWT used for protected requests
```

### 2. Poll Creation

```text
Authenticated User
       ↓
Create Poll
       ↓
Go/Gin validates request
       ↓
Poll stored in MongoDB
       ↓
Redis result counters initialized
       ↓
Poll created successfully
```

### 3. Voting

```text
Participant opens poll
       ↓
Selects an option
       ↓
Vote sent to Go backend
       ↓
Backend validates poll + option
       ↓
Duplicate vote checked
       ↓
Vote stored in MongoDB
       ↓
Redis counter incremented
       ↓
Redis Pub/Sub event published
       ↓
SSE sends update to connected clients
       ↓
Live result displayed
```

---

## 📁 Project Structure

```text
LivePoll/
│
├── backend/
│   ├── config/
│   │   └── redis.go
│   │
│   ├── handlers/
│   │   ├── auth.go
│   │   └── poll.go
│   │
│   ├── middleware/
│   │   └── auth.go
│   │
│   ├── models/
│   │   ├── user.go
│   │   ├── poll.go
│   │   └── vote.go
│   │
│   ├── .env
│   ├── go.mod
│   ├── go.sum
│   └── main.go
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── PollRoom.jsx
│   │   │
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── .env
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| POST   | `/api/auth/signup` | Register a new user   |
| POST   | `/api/auth/login`  | Login and receive JWT |

### Polls

| Method | Endpoint                 | Authentication |
| ------ | ------------------------ | -------------- |
| POST   | `/api/polls`             | Required       |
| GET    | `/api/polls/:id`         | Public         |
| GET    | `/api/polls/my`          | Required       |
| PUT    | `/api/polls/:id/close`   | Required       |
| POST   | `/api/polls/:id/vote`    | Public         |
| GET    | `/api/polls/:id/results` | Public         |
| GET    | `/api/polls/:id/live`    | Public         |

### Health Check

```text
GET /health
```

Example response:

```json
{
  "message": "LivePoll backend is running",
  "mongodb": "connected",
  "status": "ok"
}
```

---

## ⚡ How Real-Time Updates Work

Redis is used as the real-time component of the application.

For every poll, vote counts are maintained in a Redis hash:

```text
poll:{pollId}:results
```

When a participant votes:

1. The backend validates the vote.
2. The vote is stored in MongoDB.
3. Redis increments the selected option's count.
4. A vote event is published through Redis Pub/Sub.
5. Connected clients listen through an SSE connection.
6. The frontend receives the update.
7. The result count changes without refreshing the page.

This allows multiple users/devices to participate in the same poll while seeing live updates.

---

## 🔐 Environment Variables

The application uses environment variables for configuration.

### Backend

Create:

```text
backend/.env
```

Example:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
REDIS_URL=your_redis_connection_url
```

### Frontend

Create:

```text
frontend/.env
```

Example:

```env
VITE_API_URL=https://your-backend-url
VITE_FRONTEND_URL=https://your-frontend-url
```

> Never commit `.env` files or database credentials to GitHub.

---

## 💻 Running the Project Locally

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Go
- MongoDB Atlas account
- Redis instance

### 1. Clone the repository

```bash
git clone https://github.com/Divya-png-hu/LivePoll.git
cd LivePoll
```

### 2. Start the backend

```bash
cd backend
go mod download
go run .
```

The backend runs locally on:

```text
http://localhost:8081
```

### 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will provide the local frontend URL.

---

## 🧪 Testing the Application

The following end-to-end flow can be used to test the application:

```text
Signup
  ↓
Login
  ↓
Create Poll
  ↓
Open Poll
  ↓
Copy Share Link
  ↓
Open Link on Another Device
  ↓
Vote
  ↓
Observe Live Result Update
  ↓
Close Poll
  ↓
Verify Further Voting Is Blocked
```

---

## 🌐 Deployment

The application is deployed using Render.

### Frontend

```text
https://livepoll-frontend-9ntc.onrender.com
```

### Backend

```text
https://livepoll-backend-oa56.onrender.com
```

MongoDB is hosted using MongoDB Atlas and Redis is hosted using a managed Redis service.

---

## 🔒 Security Considerations

The application includes:

- Password hashing using bcrypt
- JWT authentication
- Protected creator routes
- HTTP-only voter cookies
- Environment variables for secrets
- Backend validation of poll options
- Poll ownership validation when closing polls

Production deployments should additionally use appropriately restricted database network access, strong secrets, HTTPS, and production-specific CORS configuration.

---

## 🚀 Future Improvements

Possible improvements include:

- Poll timer and automatic closing
- QR-code sharing
- CSV result export
- Creator analytics dashboard
- Vote activity timeline
- Improved duplicate-vote protection using database indexes
- More advanced poll customization
- Improved UI animations
- Additional authentication options

---

## 👩‍💻 Author

**Divya Durairaj**

GitHub:
[https://github.com/Divya-png-hu/LivePoll](https://github.com/Divya-png-hu/LivePoll)

---

## 📄 License

This project was developed as part of an internship developer task.

```



```
