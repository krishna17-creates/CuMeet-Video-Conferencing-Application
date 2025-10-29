# Cumeet - Video Meeting Application

A comprehensive video meeting application built with React.js frontend and Node.js backend, featuring user authentication, meeting scheduling, and real-time video conferencing capabilities.

## Features

### Frontend Features
- **User Authentication**: Secure signup and login with JWT tokens
- **Dashboard**: Clean, intuitive dashboard for managing meetings
- **Meeting Management**: Create instant meetings or schedule for later
- **Video Conferencing**: Basic meeting room with video/audio controls
- **Profile Management**: Update user information and password
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Backend Features
- **RESTful API**: Complete API for user and meeting management
- **MongoDB Integration**: Persistent data storage with Mongoose ODM
- **Authentication Middleware**: JWT-based authentication system
- **Meeting Management**: CRUD operations for meetings with participant tracking
- **Data Validation**: Comprehensive input validation and error handling

## Tech Stack

### Frontend
- React 18 with JavaScript
- React Router for navigation
- Axios for HTTP requests
- React Icons for UI icons
- Date-fns for date formatting
- Custom CSS with modern design principles

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT for authentication
- Bcrypt.js for password hashing
- CORS for cross-origin requests

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (choose one option below)
- npm or yarn package manager

### MongoDB Setup Options

**Option 1: Local MongoDB (Recommended for development)**
1. Install MongoDB Community Edition: https://docs.mongodb.com/manual/installation/
2. Start MongoDB service:
   - Windows: `net start MongoDB` or run MongoDB Compass
   - macOS: `brew services start mongodb/brew/mongodb-community`
   - Linux: `sudo systemctl start mongod`

**Option 2: MongoDB Atlas (Cloud)**
1. Create free account at https://www.mongodb.com/atlas
2. Create a cluster and get connection string
3. Update `MONGODB_URI` in server/.env with your Atlas connection string

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cumeet.git
   cd cumeet
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Set up environment variables**
   Create a `.env` file in the server directory with:
   ```env
   # Choose your MongoDB option:
   # For local MongoDB:
   MONGODB_URI=mongodb://localhost:27017/cumeet
   
   # For MongoDB Atlas (replace with your connection string):
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cumeet
   
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # IMPORTANT: Do not commit this .env file to your repository.
   # Make sure your .gitignore file includes 'server/.env'
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

5. **Start MongoDB (if using local installation)**
   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services start mongodb/brew/mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```
   The API server will run on http://localhost:5000

2. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   The frontend will run on http://localhost:5173

## Project Structure

```
cumeet/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── HomePage.jsx         # Landing page
│   │   ├── LoginPage.jsx        # User login
│   │   ├── SignUpPage.jsx       # User registration
│   │   ├── Dashboard.jsx        # Main dashboard
│   │   ├── MeetingRoom.jsx      # Video meeting interface
│   │   ├── ScheduleMeeting.jsx  # Meeting scheduling
│   │   ├── Profile.jsx          # User profile management
│   │   └── Navbar.jsx           # Navigation component
│   ├── context/                 # React context providers
│   │   └── AuthContext.jsx      # Authentication context
│   ├── styles/                  # CSS styles
│   │   └── components.css       # Component-specific styles
│   ├── App.jsx                  # Main App component
│   └── main.jsx                 # Entry point
├── server/                       # Backend source code
│   ├── models/                  # MongoDB models
│   │   ├── User.js              # User model
│   │   └── Meeting.js           # Meeting model
│   ├── routes/                  # API routes
│   │   ├── auth.js              # Authentication routes
│   │   └── meetings.js          # Meeting routes
│   ├── middleware/              # Custom middleware
│   │   └── auth.js              # JWT authentication middleware
│   ├── server.js                # Express server setup
│   └── .env                     # Environment variables
└── package.json                 # Frontend dependencies
```

## API Endpoints

### Authentication Routes
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

### Meeting Routes
- `POST /api/meetings` - Create new meeting
- `GET /api/meetings` - Get user's meetings
- `GET /api/meetings/:meetingId` - Get specific meeting
- `POST /api/meetings/:meetingId/join` - Join a meeting
- `POST /api/meetings/:meetingId/leave` - Leave a meeting
- `PUT /api/meetings/:meetingId` - Update meeting
- `DELETE /api/meetings/:meetingId` - Cancel/delete meeting

## Key Features Explained

### Authentication System
- Secure user registration and login
- JWT token-based authentication
- Password hashing with bcrypt
- Protected routes and API endpoints

### Meeting Management
- Create instant meetings or schedule for later
- Join meetings with meeting ID
- Host controls and participant management
- Meeting history and status tracking

### Video Interface
- Basic video conferencing interface
- Camera and microphone controls
- Screen sharing capability
- Participant video grid

### Responsive Design
- Mobile-first design approach
- Flexible grid layouts
- Touch-friendly controls
- Cross-browser compatibility

## Future Enhancements

<!-- - **Scalable WebRTC Architecture**: Implement a hybrid Peer-to-Peer (P2P) and Selective Forwarding Unit (SFU) model to support larger meetings efficiently. -->
- **In-Meeting Chat**: Add real-time text chat for participants during a meeting.
- **Invitation-Based Access**: Allow users to join meetings if their email was included during scheduling.
- Meeting recording capabilities
- Calendar integration
- Advanced meeting settings
- Breakout rooms
- Virtual backgrounds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.