# Rip City Athlete Development Platform

A web application prototype designed to help athletes and coaches manage workouts, goals, habits, progress, and communication in one place.

This project is currently being developed as a pilot for **Rip City**, with the long-term vision of supporting multiple training facilities through customizable branding and coaching workflows.

---

## Current Features

### Athlete View

- Athlete dashboard
- Today's workout
- Exercise completion tracking
- Daily habits
- Habit completion tracking
- Personal goals
- Progress page
- Player attributes card
- Leaderboard preview
- Coach note section
- Data saved locally using `localStorage`

### Coach View (Prototype)

- Coach dashboard
- Athlete roster
- Athlete status overview
- Assign workout mockup
- Coach notes mockup
- Leaderboard mockup

---

## Tech Stack

- HTML
- CSS
- JavaScript
- Local Storage (temporary)

Future:
- Supabase
- PostgreSQL
- Authentication
- Real-time database

---

## Running the Project

1. Clone the repository.
2. Open the project folder in VS Code.
3. Install the **Live Server** extension.
4. Right-click `index.html`.
5. Select **Open with Live Server**.

---

## Project Structure

- `index.html` — Application layout
- `styles.css` — UI styling
- `app.js` — Application logic, navigation, workouts, habits, goals, coach view, and local storage

---

## Current Limitations

This is currently a front-end prototype.

The application does **not** yet include:

- User authentication
- Coach accounts
- Athlete accounts
- Database
- Real workout assignments
- Real coach notes
- Live leaderboards
- Progress history
- Cloud storage

All data is currently stored locally in the browser.

---

## Planned Features

### Athlete

- User registration & login
- Athlete profile
- Workout history
- Goal tracking
- Progress charts
- Recovery tracking
- Player development attributes
- Notifications
- Personal records

### Coach

- Coach login
- Assign workouts
- Assign goals
- Daily coach notes
- Create athlete groups
- Team dashboard
- Attendance tracking
- Athlete progress reports
- Leaderboards
- Performance analytics

### Administration

- Multiple training facilities
- Facility branding (logo, colors, terminology)
- Coach permissions
- Athlete invitations
- Group management
- Custom metrics
- Facility-specific dashboards

---

## Long-Term Vision

Create a customizable athlete development platform that allows training facilities to manage athletes, communicate with them, assign workouts, track development, and monitor progress through a modern web application.

Each facility will be able to have its own:

- Branding
- Logo
- Colors
- Groups
- Metrics
- Leaderboards
- Coach staff
- Athlete roster

while sharing the same underlying platform.

---

## Current Status

🚧 Active Development

Current focus:

- Improve the Rip City pilot
- Gather feedback from coaches
- Build Version 1 for a small test group
- Connect the application to a real database
- Expand into a full athlete management platform