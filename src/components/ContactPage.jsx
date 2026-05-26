import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiPhone, FiMapPin, FiSend, FiCheckCircle } from 'react-icons/fi';
import '../styles/ContactPage.css';

const ContactPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'support',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        subject: '',
        category: 'support',
        message: ''
      });
      
      // Reset success message after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    }, 1500);
  };

  return (
    <div className="contact-page">
      {/* Header */}
      <header className="contact-header">
        <div className="container header-container">
          <Link to="/" className="logo-link">
            <div className="cumeet-logo">
              <span className="logo-c">C</span>
              <span className="logo-u">U</span>
              <span className="logo-meet">MEET</span>
            </div>
          </Link>
          {user ? (
            <div className="contact-header-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate('/profile')}>
                Back to profile
              </button>
            </div>
          ) : (
            <nav className="main-nav">
              <Link to="/">Home</Link>
              <Link to="/login" className="btn btn-secondary btn-small">Sign In</Link>
              <Link to="/signup" className="btn btn-primary btn-small">Get Started</Link>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="container">
          <h1 className="contact-hero-title">Get in Touch</h1>
          <p className="contact-hero-subtitle">
            We're here to help! Whether you need support, have questions, or want to discuss business opportunities.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="contact-content">
        <div className="container contact-grid">
          {/* Contact Form */}
          <div className="contact-form-container">
            <h2>Send us a Message</h2>
            <p className="form-description">Fill out the form below and we'll get back to you within 24 hours.</p>
            
            {submitted && (
              <div className="success-message">
                <FiCheckCircle />
                <p>Thank you! Your message has been sent successfully.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder="How can we help?"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="support">Technical Support</option>
                    <option value="business">Business Inquiry</option>
                    <option value="feedback">Feedback</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="6"
                  placeholder="Tell us more about your inquiry..."
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <FiSend />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="contact-info-container">
            <div className="contact-info-card">
              <div className="info-icon">
                <FiMail />
              </div>
              <h3>Email Us</h3>
              <p>Our team typically responds within 24 hours</p>
              <a href="mailto:support@cumeet.com">support@cumeet.com</a>
            </div>

            <div className="contact-info-card">
              <div className="info-icon">
                <FiPhone />
              </div>
              <h3>Call Us</h3>
              <p>Mon-Fri from 9am to 6pm EST</p>
              <a href="tel:+1234567890">+1 (234) 567-890</a>
            </div>

            <div className="contact-info-card">
              <div className="info-icon">
                <FiMapPin />
              </div>
              <h3>Visit Us</h3>
              <p>Come say hello at our office</p>
              <address>
                123 Business Street<br />
                Suite 100<br />
                San Francisco, CA 94105
              </address>
            </div>

            <div className="business-hours">
              <h3>Business Hours</h3>
              <div className="hours-list">
                <div className="hours-item">
                  <span>Monday - Friday</span>
                  <span>9:00 AM - 6:00 PM</span>
                </div>
                <div className="hours-item">
                  <span>Saturday</span>
                  <span>10:00 AM - 4:00 PM</span>
                </div>
                <div className="hours-item">
                  <span>Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="contact-footer">
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
            <Link to="/">Home</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/signup">Get Started</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} CUMEET. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ContactPage;
