import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiVideo, FiCalendar, FiUsers, FiShield, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import { FaUserTie } from 'react-icons/fa';
import '../styles/HomePage.css';


const HomePage = () => {
 useEffect(() => {
  const main = document.querySelector('.home-page');
  if (main) {
   main.classList.add('loaded');
  }
 }, []);

 // Calendar data - representing different types/numbers of meetings
 const getCalendarDayClass = (day) => {
  let className = "calendar-day";
  if (day === 22) className += " today";

  // Example meeting representations
  if (day === 15) className += " event meeting-medium"; // 1-2 meetings
  if (day === 24) className += " event meeting-high"; // 3+ meetings
  if (day === 28) className += " event meeting-low";  // 1 meeting

  return className;
 };

 return (
  <main className="home-page">
   {/* Logo Section */}
   <header className="main-header">
    <div className="container header-container">
     <Link to="/" className="logo-link">
      <div className="cumeet-logo">
       <span className="logo-c">C</span>
       <span className="logo-u">U</span>
       <span className="logo-meet">MEET</span>
      </div>
     </Link>
     <nav className="main-nav">
      <Link to="/contact">Contact Us</Link>
      <Link to="/login" className="btn btn-secondary btn-small">Sign In</Link>
      <Link to="/signup" className="btn btn-primary btn-small">Get Started</Link>
     </nav>
    </div>
   </header>

   {/* Hero Section with CSS Vector Illustration */}
   <section className="hero-section">
    <div className="container hero-content-wrapper">
     <div className="hero-content">
      <h1 className="hero-title">
       Connect Seamlessly with <span className="text-primary animated-cumeet">CUMEET</span>
      </h1>
      <p className="hero-description">
       Experience enterprise-grade video conferencing with crystal clear quality, 
       powerful collaboration tools, and complete data ownership. Built for teams that value privacy and performance.
      </p>
      <div className="hero-actions">
       <Link to="/signup" className="btn btn-primary btn-large">
        <FiVideo /> Start Free Meeting
       </Link>
       <Link to="/contact" className="btn btn-secondary btn-large">
        Contact Us
       </Link>
      </div>
     </div>
     
     {/* CSS Vector Illustration - Video Conference */}
     <div className="hero-illustration">
      <div className="illustration-wrapper">
       {/* Main meeting screen */}
       <div className="meeting-screen">
        <div className="screen-header">
         <div className="screen-dot"></div>
         <div className="screen-dot"></div>
         <div className="screen-dot"></div>
        </div>
        <div className="participants-grid">
         <div className="participant participant-1">
          <div className="avatar"></div>
          <div className="audio-wave wave-1"></div>
          <div className="audio-wave wave-2"></div>
          <div className="audio-wave wave-3"></div>
         </div>
         <div className="participant participant-2">
          <div className="avatar"></div>
          <div className="audio-wave wave-1"></div>
          <div className="audio-wave wave-2"></div>
          <div className="audio-wave wave-3"></div>
         </div>
         <div className="participant participant-3">
          <div className="avatar"></div>
          <div className="audio-wave wave-1"></div>
          <div className="audio-wave wave-2"></div>
          <div className="audio-wave wave-3"></div>
         </div>
         <div className="participant participant-4">
          <div className="avatar"></div>
          <div className="audio-wave wave-1"></div>
          <div className="audio-wave wave-2"></div>
          <div className="audio-wave wave-3"></div>
         </div>
        </div>
       </div>
       
       {/* Floating elements */}
       <div className="floating-icon icon-1">
        <FiVideo />
       </div>
       <div className="floating-icon icon-2">
        <FiUsers />
       </div>
       <div className="floating-icon icon-3">
        <FiCalendar />
       </div>
       <div className="floating-notification">
        <div className="notif-dot"></div>
        <span>Meeting starts in 5 min</span>
       </div>
      </div>
     </div>
    </div>
   </section>

   {/* Features Section */}
   <section className="features-section">
    <div className="container">
     <h2 className="section-title">Why CUMEET? Smarter Meetings, Faster Connections.</h2>
     <p className="section-subtitle">Discover the powerful features designed for seamless collaboration and complete data ownership.</p>
     <div className="features-grid">
      <div className="feature-card">
       <div className="feature-icon"><FiVideo /></div>
       <h3>High-Quality Video</h3>
       <p>Crystal clear HD video calls with advanced noise cancellation and screen sharing.</p>
      </div>
      <div className="feature-card">
       <div className="feature-icon"><FiCalendar /></div>
       <h3>Easy Scheduling</h3>
       <p>Schedule meetings with calendar integration and automated reminder notifications.</p>
      </div>
      <div className="feature-card">
       <div className="feature-icon"><FiUsers /></div>
       <h3>Team Collaboration</h3>
       <p>Support for multiple participants, breakout rooms, and collaborative whiteboards.</p>
      </div>
      <div className="feature-card">
       <div className="feature-icon"><FiShield /></div>
       <h3>Secure & Private</h3>
       <p>End-to-end encryption ensures your conversations remain private and secure.</p>
      </div>
     </div>
    </div>
   </section>

   {/* Schedule at a Glance Section */}
   <section className="schedule-glance-section">
    <div className="container schedule-glance-container">
     <div className="schedule-text-content">
      <h2>Your Meetings. Your Control.</h2>
      <p>
       Visualize your week and manage your appointments with our intuitive calendar view.
       Experience enterprise-grade video, chat, and scheduling — fully private and customizable.
      </p>
      <Link to="/login" className="btn btn-primary">
       View Your Schedule
      </Link>
     </div>
     <div className="calendar-container">
      <div className="calendar-header">
       <h3>October 2025</h3>
      </div>
      <div className="calendar-grid">
       {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="calendar-day-name">{day}</div>)}
       {[...Array(3)].map((_, i) => <div key={`prev-${i}`} className="calendar-day other-month">{29 + i}</div>)}
       {[...Array(31)].map((_, i) => {
        const day = i + 1;
        return <div key={i} className={getCalendarDayClass(day)}>{day}</div>;
       })}
       {[...Array(1)].map((_, i) => <div key={`next-${i}`} className="calendar-day other-month">{1 + i}</div>)}
      </div>
     </div>
    </div>
   </section>

   {/* Testimonials Section */}
   <section className="testimonials-section">
    <div className="container">
     <h2 className="section-title">What Our Users Say <br/>From Small Talks to Global Meets.</h2>
     <div className="testimonials-grid">
      <div className="testimonial-card">
       <p className="testimonial-content">"Cumeet has revolutionized how our team collaborates remotely. The video quality is superb, and the scheduling feature is a lifesaver!"</p>
       <div className="testimonial-author">
        <img src="https://i.pravatar.cc/50?u=a042581f4e29026704d" alt="User Avatar" className="author-avatar" />
        <div className="author-info">
         <h4>Sarah L.</h4>
         <p>Project Manager</p>
        </div>
       </div>
      </div>
      <div className="testimonial-card">
       <p className="testimonial-content">"The most intuitive and reliable video conferencing tool I've used. Setting up meetings is a breeze. Highly recommended!"</p>
       <div className="testimonial-author">
        <img src="https://i.pravatar.cc/50?u=a042581f4e29026704e" alt="User Avatar" className="author-avatar" />
        <div className="author-info">
         <h4>Mike R.</h4>
         <p>Freelance Developer</p>
        </div>
       </div>
      </div>
      <div className="testimonial-card">
       <p className="testimonial-content">"Secure, fast, and easy to use. Cumeet checks all the boxes for our enterprise needs. The customer support is also top-notch."</p>
       <div className="testimonial-author">
        <div className="author-avatar" style={{ backgroundColor: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <FaUserTie size="1.5em" color="white"/>
        </div>
        <div className="author-info">
         <h4>John D.</h4>
         <p>CTO, TechCorp</p>
        </div>
       </div>
      </div>
     </div>
    </div>
   </section>

   {/* CTA Section - Modernized */}
   <section className="cta-section modern-cta-section">
    <div className="container cta-grid">
     <div className="cta-left">
      <h2 className="cta-title">Ready to Transform Your Collaboration?</h2>
      <p className="cta-subtitle">
       One platform. Infinite collaboration. Video, chat, whiteboard, and calendar — all unified in a single modern interface.
      </p>
      <Link to="/signup" className="btn btn-primary btn-large cta-btn">
       <FiVideo /> Start Free Today
      </Link>
     </div>
     <div className="cta-right">
      <div className="cta-info-card">
       <h3>Open Source. Open Communication.</h3>
       <p>Cumeet empowers teams to host, modify, and innovate without boundaries. Full transparency and control.</p>
      </div>
      <div className="cta-info-card">
       <h3>Enterprise-Grade Privacy</h3>
       <p>Your data stays yours. Secure, private, and customizable solutions for businesses of all sizes.</p>
      </div>
     </div>
    </div>
   </section>

   {/* Footer */}
   <footer className="home-footer">
    <div className="container footer-content">
     <div className="footer-section">
      <div className="cumeet-logo">
       <span className="logo-c">C</span>
       <span className="logo-u">U</span>
       <span className="logo-meet">MEET</span>
      </div>
      <p>Connect seamlessly with CUMEET - Your trusted video conferencing platform.</p>
     </div>
     
     <div className="footer-section">
      <h4>Contact</h4>
      <p><FiMail /> support@cumeet.com</p>
      <p><FiPhone /> +1 (234) 567-890</p>
      <p><FiMapPin /> San Francisco, CA 94105</p>
     </div>
     
     <div className="footer-section">
      <h4>Quick Links</h4>
      <Link to="/contact">Contact Us</Link>
      <Link to="/login">Sign In</Link>
      <Link to="/signup">Get Started</Link>
     </div>
    </div>
    <div className="footer-bottom">
     <p>&copy; {new Date().getFullYear()} CUMEET. All rights reserved.</p>
    </div>
   </footer>
  </main>
 );
};

export default HomePage;