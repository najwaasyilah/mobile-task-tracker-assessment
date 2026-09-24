# Fullstack Assessment: Mobile Task Tracker

## Project Structure
- `/mobile`: React Native (Expo) app
- `/web`: Next.js Web application
- `/backend`: Node.js GraphQL Apollo Server

## Live Links
- **Vercel (Web App)**: https://task-tracker-sand-ten.vercel.app
- **AWS (Backend)**: [See AWS Deployment Plan below]

## Setup Instructions

### 1. Backend
```bash
cd backend
npm install
npm start
```
*Note: The backend will run on `http://localhost:4000`.*

### 2. Web App
```bash
cd web
npm install
npm run dev
```
*Note: The web app will run on `http://localhost:3000`.*

### 3. Mobile App
```bash
cd mobile
npm install
npx expo start -c
```
*Note: Use the Expo Go app to scan the generated QR code. Ensure your phone and PC are on the same Wi-Fi network. You may need to update the `uri` in `mobile/App.js` to match your machine's exact local IP address.*

---

## Architecture Decisions
- **Persistence**: Used `lowdb` (a simple file-based JSON database) as requested. This fulfills the requirement without the overhead of spinning up a full PostgreSQL/MongoDB container.
- **API Layer**: Implemented Apollo Server on the backend and Apollo Client on the frontend (both Web and Mobile). Apollo Client provides an excellent built-in local state cache (`InMemoryCache`).
- **Navigation**: Used `@react-navigation/native-stack` for standard Native navigation on the mobile app, intentionally avoiding experimental Expo Router setups to prevent nested navigation bugs.
- **Styling**: 
  - **Web**: Used Tailwind CSS for rapid styling, focusing on a global Glassmorphism aesthetic.
  - **Mobile**: Replicated the Web's Glassmorphism using `expo-linear-gradient` and `expo-blur`. The BlurView is placed at the absolute root of the screen to ensure a 100% seamless, border-free frosted glass experience matching native iOS design guidelines.
- **Bonus Feature (Mobile)**: Added a functional Notification bell that scans the local Apollo Cache for upcoming tasks, dynamically navigates to the correct date/tab, and temporarily highlights the upcoming task.

---

## AWS Deployment Plan

### Target Architecture
Because this app currently uses `lowdb` (which requires a persistent, writeable file system), deploying to AWS requires slight modifications based on the chosen compute platform.

**Option A: AWS App Runner (Dockerized)**
- Wrap the backend in a `Dockerfile` and push to Amazon ECR.
- Deploy via AWS App Runner.
- *Pros*: Easiest migration path.
- *Cons*: Container storage is ephemeral; `db.json` resets on scaling.

**Option B: AWS Lambda + API Gateway + DynamoDB (Recommended)**
- Replace `lowdb` with the `AWS SDK v3` DynamoDB client.
- Wrap Apollo Server with `@as-integrations/aws-lambda`.
- Deploy via the Serverless Framework (`serverless deploy`).

### Services Used
- **Compute**: AWS Lambda
- **API Routing**: Amazon API Gateway
- **Database**: Amazon DynamoDB
- **CI/CD**: GitHub Actions

### Estimated Monthly Cost
For a simple assessment app like this, it comfortably sits in the AWS Free Tier:
- **AWS Lambda**: 1 million free requests per month ($0.00).
- **API Gateway**: 1 million free API calls per month ($0.00).
- **DynamoDB**: 25 GB of storage and 25 WCU/RCU free for life ($0.00).
- **Total**: **$0.00 / month**.

---

## Time Taken
- **Backend (GraphQL/Node)**: ~1 hour
- **Web App (Next.js/Tailwind)**: ~1.5 hours 
- **Mobile App (React Native/Expo)**: ~2.5 hours
- **Total**: ~5 hours
