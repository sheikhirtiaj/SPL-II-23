# Dengue Alert & Ward-Based Management System

A GIS-enabled web application for community-based dengue hazard reporting, ward-level cleanup coordination, and complaint-cluster hotspot detection.

## 1. Project Overview

The Dengue Alert & Ward-Based Management System enables citizens to report suspected dengue breeding sites with photographs, descriptions, and GPS coordinates. The application identifies the relevant ward and supports coordination between Councillors, Inspectors, Master Admin, and Magistrates throughout the cleanup and verification process.

## 2. Key Features

- Citizen registration, login, and Google sign-in.
- Location-based dengue hazard reporting with image uploads.
- Automatic ward identification using PostGIS.
- Councillor review and Inspector assignment.
- Cleanup evidence submission through before-and-after photographs.
- Councillor verification, resolution, and reassignment.
- Complaint-cluster-based hotspot detection.
- Email-based Magistrate escalation.
- Proximity-based sound alerts for nearby hotspots.
- Bangla and English interface support.
- Role-based access control.

## 3. User Roles

| Role | Responsibility |
|---|---|
| Citizen | Submit and track dengue hazard reports. |
| Councillor | Review reports, assign Inspectors, and verify cleanup. |
| Inspector | Carry out cleanup and upload completion evidence. |
| Master Admin | Manage staff access and administrative operations. |
| Magistrate | Access escalated hotspot information through secure email links. |

## 4. Technology Stack

**Frontend:** React.js, React Router, Axios, Tailwind CSS, Leaflet, React-Leaflet.

**Backend:** Node.js, Express.js, JWT, Bcrypt, Multer, Nodemailer.

**Database:** PostgreSQL with PostGIS.

**External Services:** Cloudinary for image storage and Google Identity Services for Google sign-in.

## 5. Project Structure

```text
SPL-II-23/
├── code/
│   ├── backend/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── dhaka_wards.geojson
│   │   ├── seedwards.js
│   │   ├── server.js
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── .env.example
│   │
│   └── frontend/
│       ├── public/
│       ├── src/
│       ├── package.json
│       └── package-lock.json
│
├── doc/
│   ├── srs.pdf
│   ├── design.pdf
│   ├── final-presentation.pdf
│   └── final-report.pdf
│
├── .gitignore
└── README.md
```

## 6. Prerequisites

- Node.js and npm.
- PostgreSQL with the PostGIS extension.
- Cloudinary account and API credentials.
- SMTP credentials for email services.
- Google OAuth Web Client ID.
- Valid ward boundary data.

## 7. Environment Configuration

Create `code/backend/.env` using the provided `.env.example` template.

Configure the database, authentication, image storage, email services, application URL, and hotspot settings using the required environment variables.

Never commit actual credentials or API secrets to GitHub.

For frontend development, the API proxy defaults to `http://localhost:3500`. An alternative backend URL can be configured through `REACT_APP_BACKEND_URL`.

## 8. Database Setup

1. Create a PostgreSQL database.
2. Enable the PostGIS extension.
3. Provision the application tables required by the backend.
4. Configure the database credentials in the backend `.env` file.
5. Ensure the `wards` table is available.
6. Run the ward seeding script:

```bash
cd code/backend
node seedwards.js
```

**Note:** Database schema and migration files are not included in the current repository snapshot. The required application tables must be provisioned using the project's approved database setup before running the application.

## 9. Installation and Execution

### Backend

```bash
cd code/backend
npm ci
npm start
```

The backend runs on port `3500` by default.

### Frontend

Open a separate terminal:

```bash
cd code/frontend
npm ci
npm start
```

The frontend development server runs at:

`http://localhost:3000`

## 10. Production Build

Build the React frontend:

```bash
cd code/frontend
npm run build
```

Start the backend:

```bash
cd code/backend
npm start
```

The Express server serves the production frontend build.

## 11. Verification and Testing

The backend provides a database connectivity endpoint:

`http://localhost:3500/api/test-db`

The application can be manually verified through the following workflows:

- Citizen registration and report submission.
- GPS-based ward identification.
- Councillor report review and Inspector assignment.
- Inspector cleanup evidence upload.
- Councillor verification and reassignment.
- Hotspot detection and Magistrate escalation.
- Nearby hotspot notifications.

The team performed testing during development. Automated test source files and test reports are not included in the current repository snapshot.

## 12. Project Documentation

The `doc/` directory contains the Software Requirements Specification, System Design Report, Final Presentation, and Final Project Report.

## 13. Version Control

The project is maintained using Git and GitHub. The repository preserves the development history, contributions from team members, feature development, and merged pull requests.

**GitHub Repository:** https://github.com/sheikhirtiaj/SPL-II-23