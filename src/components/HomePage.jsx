import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiVideo, FiCalendar, FiUsers, FiShield, FiChevronLeft, FiChevronRight, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { FaUserTie } from 'react-icons/fa';
import '../styles/HomePage.css';


const HomePage = () => {
 const [currentImageIndex, setCurrentImageIndex] = useState(0);
 const heroImages = [
  {
   src: 'unsplash',
   tagline: 'Meet smarter. Connect faster.',
   description: 'Built for seamless collaboration with Zoom-level performance and complete data ownership.',
  },
  {
   src: 'https://images.unsplash.com/photo-1596551820464-9665e771c52d?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
   tagline: 'Your meetings. Your control.',
   description: 'Experience enterprise-grade video, chat, and scheduling — fully private and customizable.',
  },
  {
   src: 'https://images.unsplash.com/photo-1522204523234-8729aa6ed03d?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
   tagline: 'From small talks to global meets.',
   description: 'Scales effortlessly from P2P calls to SFU-powered conferences with crystal clarity.',
  },
  {
   src: 'https://images.unsplash.com/photo-1620288672545-fb40f7d54401?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
   tagline: 'One platform. Infinite collaboration.',
   description: 'Video, chat, whiteboard, and calendar — all unified in a single modern interface.',
  },
  {
   src: 'https://images.unsplash.com/photo-1549692520-acc6669e2fde?q=80&w=2890&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
   tagline: 'Open source. Open communication.',
   description: 'Cumeet empowers teams to host, modify, and innovate without boundaries.',
  },
 ];

 useEffect(() => {
  const main = document.querySelector('.home-page');
  if (main) {
   main.classList.add('loaded');
  }

  const interval = setInterval(() => {
   setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
  }, 8000); // Change image every 8 seconds

  return () => clearInterval(interval);
 }, [heroImages.length]);

 const handlePrevImage = () => {
  setCurrentImageIndex((prevIndex) => (prevIndex - 1 + heroImages.length) % heroImages.length);
 };

 const handleNextImage = () => {
  setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
 };

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
      <Link to="/">Connect </Link>
      <Link to="/">Contact</Link>
      <Link to="/login" className="btn btn-secondary btn-small">Sign In</Link>
      <Link to="/signup" className="btn btn-primary btn-small">Get Started</Link>
     </nav>
    </div>
   </header>

   {/* Hero Section */}
   <section className="hero-section">
    <div className="hero-image-scroller">
     {heroImages.map((image, index) => (
      <div
       key={index}
       className={`hero-image-slide ${index === currentImageIndex ? 'active' : ''}`}
       style={{ backgroundImage: `url(${image.src})` }}
      ></div>
     ))}
     <button className="scroll-arrow left" onClick={handlePrevImage}><FiArrowLeft /></button>
     <button className="scroll-arrow right" onClick={handleNextImage}><FiArrowRight /></button>
    </div>

    <div className="container hero-content-wrapper">
     <div className="hero-content">
      <h1 className="hero-title">
       Connect Seamlessly with <span className="text-primary animated-cumeet">CUMEET</span>
      </h1>
      <p className="hero-dynamic-tagline">
       {heroImages[currentImageIndex].tagline}
      </p>
      <p className="hero-description">
       {heroImages[currentImageIndex].description}
      </p>
      <div className="hero-actions">
       <Link to="/signup" className="btn btn-primary btn-large">
        <FiVideo /> Start Free Meeting
       </Link>
       <Link to="/login" className="btn btn-secondary btn-large">
        Learn More
       </Link>
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
  </main>
 );
};

export default HomePage;