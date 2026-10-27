
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LandingPage.css";

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    alert: (
      <>
        <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    camera: (
      <>
        <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <circle cx="11" cy="13" r="3" />
        <path d="m16 5 2 2 4-4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-8 8-16Z" />
        <path d="M4 21c3-6 7-9 12-12" />
      </>
    ),
  };

  return <svg {...common}>{icons[name] || icons.arrow}</svg>;
}

const steps = [
  {
    number: "01",
    title: "Spot a risk",
    description:
      "Notice standing water, mosquito breeding sites, or a possible dengue hotspot in your neighbourhood.",
    icon: "pin",
  },
  {
    number: "02",
    title: "Submit a report",
    description:
      "Share a photo, location, and a short description so the relevant team can understand the issue.",
    icon: "camera",
  },
  {
    number: "03",
    title: "Track the response",
    description:
      "Your report helps local teams identify risks and take action to make the community safer.",
    icon: "check",
  },
];

const features = [
  {
    icon: "pin",
    title: "Location-based reporting",
    description:
      "Pinpoint potential breeding sites so reports can be linked to the right area.",
  },
  {
    icon: "clock",
    title: "Clear report tracking",
    description:
      "Follow the status of submitted reports as they move through the response process.",
  },
  {
    icon: "users",
    title: "Community action",
    description:
      "Help residents and local teams work together to reduce mosquito breeding risks.",
  },
];

export default function LandingPage() {
  const { user, logout } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const dashboardPath = role === "councillor" ? "/councillor" : role === "inspector" ? "/inspector" : role === "master admin" ? "/admin" : "/dashboard";

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="Dengue Alert home">
          <span className="landing-brand-icon">
            <Icon name="shield" size={23} />
          </span>
          <span className="landing-brand-text">
            <strong>Dengue Alert</strong>
            <small>Community reporting</small>
          </span>
        </Link>

        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
        </nav>

        <div className="landing-header-actions">
          {user ? (
            <>
              <Link to={dashboardPath} className="landing-login-link">Dashboard</Link>
              <button type="button" className="landing-login-link landing-logout-button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="landing-login-link">Log in</Link>
              <Link to="/register" className="landing-login-link">Register</Link>
            </>
          )}
          <Link to={user && role === "citizen" ? "/report" : user ? dashboardPath : "/login"} className="landing-button landing-button-small">
            {user && role === "citizen" ? "Report an issue" : user ? "Open dashboard" : "Get started"} <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            COMMUNITY HEALTH AND SAFETY
          </div>

          <h1>
            Small actions.
            <br />
            <span>Safer communities.</span>
          </h1>

          <p className="landing-hero-description">
            Help identify mosquito breeding sites and potential dengue risks
            in your neighbourhood. Report a concern and help local teams
            respond.
          </p>

          <div className="landing-hero-actions">
            <Link to={user && role === "citizen" ? "/report" : user ? dashboardPath : "/login"} className="landing-button">
              {user && role === "citizen" ? "Report a dengue risk" : user ? "Open dashboard" : "Log in to report a risk"} <Icon name="arrow" size={18} />
            </Link>
            <a href="#how-it-works" className="landing-secondary-link">
              See how it works
            </a>
          </div>

          <div className="landing-hero-note">
            <Icon name="shield" size={17} />
            <span>Working together for healthier neighbourhoods</span>
          </div>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-visual-orbit landing-visual-orbit-outer" />
          <div className="landing-visual-orbit landing-visual-orbit-inner" />
          <div className="landing-visual-card landing-visual-card-main">
            <div className="landing-visual-card-top">
              <span className="landing-visual-live-dot" />
              <span>COMMUNITY ALERT</span>
            </div>
            <div className="landing-visual-map">
              <div className="landing-map-road landing-map-road-one" />
              <div className="landing-map-road landing-map-road-two" />
              <div className="landing-map-road landing-map-road-three" />
              <div className="landing-map-block landing-map-block-one" />
              <div className="landing-map-block landing-map-block-two" />
              <div className="landing-map-block landing-map-block-three" />
              <div className="landing-map-block landing-map-block-four" />
              <div className="landing-map-pin landing-map-pin-one">
                <Icon name="pin" size={18} />
              </div>
              <div className="landing-map-pin landing-map-pin-two">
                <Icon name="alert" size={17} />
              </div>
              <div className="landing-map-pin landing-map-pin-three">
                <Icon name="pin" size={16} />
              </div>
            </div>
            <div className="landing-visual-card-bottom">
              <div>
                <strong>Local risk reporting</strong>
                <span>Help your community take action</span>
              </div>
              <span className="landing-visual-status">
                <Icon name="check" size={15} />
              </span>
            </div>
          </div>

          <div className="landing-floating-card landing-floating-card-top">
            <span className="landing-floating-icon">
              <Icon name="camera" size={19} />
            </span>
            <span>
              <strong>Report a concern</strong>
              <small>Photo and location</small>
            </span>
          </div>

          <div className="landing-floating-card landing-floating-card-bottom">
            <span className="landing-floating-icon landing-floating-icon-green">
              <Icon name="users" size={19} />
            </span>
            <span>
              <strong>Community-powered</strong>
              <small>Every report can help</small>
            </span>
          </div>
        </div>
      </section>

      <section className="landing-report-strip" aria-label="Reporting benefits">
        <div className="landing-report-card">
          <span className="landing-report-card-icon">
            <Icon name="camera" size={22} />
          </span>
          <div>
            <strong>Share what you see</strong>
            <p>Submit a photo and details of a possible breeding site.</p>
          </div>
        </div>

        <div className="landing-report-card">
          <span className="landing-report-card-icon">
            <Icon name="pin" size={22} />
          </span>
          <div>
            <strong>Identify the location</strong>
            <p>Help responders understand where attention may be needed.</p>
          </div>
        </div>

        <div className="landing-report-card">
          <span className="landing-report-card-icon">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <strong>Support prevention</strong>
            <p>Contribute to local efforts to reduce dengue risk.</p>
          </div>
        </div>
      </section>

      <section
        className="landing-how-section"
        id="how-it-works"
        aria-labelledby="landing-how-heading"
      >
        <div className="landing-section-intro">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            SIMPLE STEPS, SHARED IMPACT
          </div>
          <h2 className="landing-section-heading" id="landing-how-heading">
            How it works
          </h2>
          <p>
            Turning a local observation into useful information should not be
            complicated. Here is how to get started.
          </p>
        </div>

        <div className="landing-steps-grid">
          {steps.map((step) => (
            <article className="landing-step-card" key={step.number}>
              <div className="landing-step-card-top">
                <span className="landing-step-number">{step.number}</span>
                <span className="landing-step-icon">
                  <Icon name={step.icon} size={22} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>

        <div className="landing-steps-cta">
          <span>Noticed a possible risk in your area?</span>
          <Link to="/report" className="landing-text-link">
            Start a report <Icon name="arrow" size={17} />
          </Link>
        </div>
      </section>

      <section
        className="landing-features-section"
        id="features"
        aria-labelledby="landing-features-heading"
      >
        <div className="landing-section-intro">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            BUILT FOR COMMUNITY RESPONSE
          </div>
          <h2
            className="landing-section-heading"
            id="landing-features-heading"
          >
            Better information.
            <br />
            More focused action.
          </h2>
          <p>
            Clear reports can help communities and response teams understand
            where potential dengue risks are being observed.
          </p>
        </div>

        <div className="landing-features-grid">
          {features.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <span className="landing-feature-icon">
                <Icon name={feature.icon} size={23} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-cta-icon">
          <Icon name="leaf" size={28} />
        </div>
        <div className="landing-final-cta-copy">
          <h2>A safer neighbourhood starts with awareness.</h2>
          <p>
            Report a possible mosquito breeding site and support local
            prevention efforts.
          </p>
        </div>
        <Link to="/report" className="landing-button landing-final-cta-button">
          Make a report <Icon name="arrow" size={18} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link to="/" className="landing-footer-brand">
          <Icon name="shield" size={19} />
          <strong>Dengue Alert</strong>
        </Link>
        <p>Community awareness. Local action. Dengue prevention.</p>
      </footer>
    </main>
  );
}
