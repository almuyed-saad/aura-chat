# Aura — Real-Time Chat Application

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat&logo=vercel)](https://aura-chat-topaz.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-46d2ff?style=flat&logo=render)](https://aura-backend-lu3g.onrender.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Aura is a full-stack, real-time chat application built on the MERN stack with Socket.io. It supports live messaging, read receipts, typing indicators, media sharing, and push notifications, with a responsive UI designed for both desktop and mobile.

| Environment | URL |
|---|---|
| **Frontend (Vercel)** | [aura-chat-topaz.vercel.app](https://aura-chat-topaz.vercel.app/) |
| **Backend API (Render)** | [aura-backend-lu3g.onrender.com](https://aura-backend-lu3g.onrender.com/) |

> **Note:** The backend is hosted on Render's free tier and may take 30–60 seconds to respond after periods of inactivity (cold start).

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [PWA Support](#pwa-support)
- [Deployment](#deployment)
- [Known Issues & Fixes](#known-issues--fixes)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Features

**Core Messaging**
- Real-time message delivery via Socket.io
- Read receipts (Sent → Delivered → Seen)
- Typing indicators
- Online/offline presence status

**Message Actions**
- Emoji reactions on messages
- Reply-to-message with quoting
- Soft delete with placeholder text
- Copy message to clipboard

**Media Sharing**
- Image upload and sharing via Cloudinary
- Full-screen image preview modal

**Notifications & PWA**
- OS-level push notifications (desktop and Android)
- Installable Progressive Web App
- Offline support via service worker

**UI & Theming**
- Five built-in themes (Purple, Love, Romantic, Dark, Light)
- Dark mode with proper contrast
- Glassmorphism and smooth transitions
- Fully responsive, mobile-first layout

**Profile & Account**
- Emoji-based avatar selection
- Editable display name
- Profile management modal

**Unread Message Tracking**
- Unread count badges
- Read/unread state persisted to the database

---

## Tech Stack

**Frontend**

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling and responsive design |
| Framer Motion | Animations and transitions |
| React Router | Client-side routing |
| Socket.io Client | Real-time communication |
| Axios | HTTP client |

**Backend**

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express | API framework |
| MongoDB Atlas | Database |
| Mongoose | ODM for MongoDB |
| Socket.io | WebSocket server |
| JWT | Authentication |
| bcryptjs | Password hashing |

**Infrastructure**

| Service | Purpose |
|---|---|
| Cloudinary | Image storage and delivery |
| Vercel | Frontend hosting |
| Render | Backend hosting |
| MongoDB Atlas | Database hosting |

---

## Project Structure

```
aura-chat/
├── backend/
│   ├── models/
│   │   ├── Conversation.js
│   │   ├── Group.js
│   │   ├── Message.js
│   │   ├── Notification.js
│   │   ├── Report.js
│   │   ├── PushSubscription.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── conversations.js
│   │   ├── groups.js
│   │   ├── messages.js
│   │   ├── notifications.js
│   │   ├── push.js
│   │   ├── safety.js
│   │   └── users.js
│   ├── services/
│   │   └── pushSender.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── components/
│   │   │   ├── Avatar.jsx
│   │   │   ├── ImageModal.jsx
│   │   │   ├── ImageUpload.jsx
│   │   │   ├── MessageMenu.jsx
│   │   │   ├── MessageReactions.jsx
│   │   │   ├── MessageStatus.jsx
│   │   │   ├── NotificationBanner.jsx
│   │   │   ├── ProfileModal.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── context/
│   │   │   ├── SocketContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── data/
│   │   │   └── avatarOptions.js
│   │   ├── hooks/
│   │   │   └── useNotifications.js
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── sw.js
│   │   ├── App.jsx
│   │   ├── config.js
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   │   ├── icons/
│   │   └── favicon.ico
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── vercel.json
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- A MongoDB Atlas account (or a local MongoDB instance)

### 1. Clone the Repository

```bash
git clone https://github.com/almuyed-saad/aura-chat.git
cd aura-chat
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chat-app
JWT_SECRET=your_super_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:you@example.com
ALLOWED_ORIGINS=https://aura-chat-topaz.vercel.app,http://localhost:5173
```

Start the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:5000
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

Start the frontend dev server:

```bash
npm run dev
```

### 4. Open the App

- **Try it live (no setup required):** [aura-chat-topaz.vercel.app](https://aura-chat-topaz.vercel.app/)
- **Running locally:** navigate to `http://localhost:5173` in your browser.

---

## Environment Variables

**Backend (`backend/.env`)**

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `5000`) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key used to sign JWT tokens |
| `VAPID_PUBLIC_KEY` | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | VAPID private key for push notifications |
| `VAPID_SUBJECT` | Contact URI used for push notification identification |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins allowed by API and Socket.io |

**Frontend (`frontend/.env`)**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |
| `VITE_SOCKET_URL` | Optional Socket.io URL; defaults to `VITE_API_URL` |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for push notifications |
| `VITE_CLOUDINARY_CLOUD_NAME` | Public Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Restricted unsigned Cloudinary upload preset used for direct browser uploads; enable image, video, audio, and raw/document resource types |

---

## Rich media

Aura supports images up to 10 MB, videos up to 25 MB, audio and voice notes up to 10 MB, and common documents up to 10 MB. Voice notes are recorded in the browser for a maximum of two minutes. Rich attachments are validated on both the client and server and are stored with their public URL, resource type, MIME type, filename, size, duration, and dimensions where available.

The unsigned Cloudinary upload preset must explicitly allow the image, video, and raw resource types required by the deployment. The public cloud name, preset name, and VAPID public key are client-visible configuration; no Cloudinary API secret is included in the frontend.

## Testing

**Manual two-user test:**

1. Open a standard browser window and log in as User A.
2. Open an incognito/private window and log in as User B.
3. Send messages between the two accounts and confirm instant delivery.
4. Add reactions and confirm they sync across both sessions.
5. Share an image and confirm upload and display work correctly.

---

## PWA Support

Aura is fully installable as a Progressive Web App:

- **Desktop:** Click the install icon in the browser's address bar.
- **Android:** Use "Add to Home Screen" from the browser menu.
- **iOS:** Use "Add to Home Screen" in Safari (Safari only).

---

## Deployment

**Backend (Render)**

1. Push the repository to GitHub.
2. Connect the repository to Render.
3. Configure the required environment variables.
4. Deploy the service.

**Frontend (Vercel)**

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set `VITE_API_URL` to the deployed Render backend URL.
4. Deploy the project.

---

## Known Issues & Fixes

| Issue | Resolution |
|---|---|
| Token expiration causing failed requests | Auto-logout implemented via an Axios response interceptor |
| Image upload returning 403 | Switched to client-side unsigned uploads to Cloudinary |
| Reactions not persisting after refresh | Normalized reactions from a `Map` to a plain object before storage |
| Inconsistent message alignment | Normalized sender IDs for consistent client-side comparison |

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments

- [Socket.io](https://socket.io/) — real-time communication
- [Cloudinary](https://cloudinary.com/) — image hosting and delivery
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Framer Motion](https://www.framer.com/motion/) — animation library
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) — PWA tooling

---

## Contact

**Developer:** Almuyed Saad
**GitHub:** [@almuyed-saad](https://github.com/almuyed-saad)
**Repository:** [github.com/almuyed-saad/aura-chat](https://github.com/almuyed-saad/aura-chat)

---

If you find this project useful, consider giving it a star on GitHub.
