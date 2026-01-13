# DevOps Project: Automated CI/CD Pipeline for a Containerized Chat Application on AWS

---

## 1. Project Overview

This project demonstrates the implementation of an end-to-end **CI/CD (Continuous Integration and Continuous Deployment)** pipeline for a real-time web application using modern DevOps tools and cloud infrastructure.

The application is a **3-tier real-time chat application** consisting of a frontend (React), backend (Node.js), and a cloud-managed database (AWS DynamoDB). The entire deployment process is automated using **Docker, Docker Compose, Jenkins, and GitHub Webhooks**.

Whenever a developer pushes code to the GitHub repository, Jenkins automatically detects the change, builds Docker images, deploys updated containers, and makes the latest version of the application live on an AWS EC2 instance — eliminating manual deployment steps.

---

## 2. Architecture Diagram

```
+-----------------+      +----------------------+      +-----------------------------+
|   Developer     |----->|     GitHub Repo      |----->|        Jenkins Server       |
| (pushes code)   |      | (Source Code Mgmt)   |      |  (on AWS EC2)               |
+-----------------+      +----------------------+      |                             |
                                                       | 1. Clones Repo              |
                                                       | 2. Builds Docker Image      |
                                                       | 3. Runs Docker Compose      |
                                                       +--------------+--------------+
                                                                      |
                                                                      | Deploys
                                                                      v
                                                       +-----------------------------+
                                                       |      Application Server     |
                                                       |      (Same AWS EC2)         |
                                                       |                             |
                                                       | +-------------------------+ |
                                                       | | Docker Container: Frontend| 
                                                       | +-------------------------+ |
                                                       |              |              |
                                                       |              v              |
                                                       | +-------------------------+ |
                                                       | | Docker Container: Backend | 
                                                       | +-------------------------+ |
                                                       +-----------------------------+
```
---

## 3. AWS Components Used

- **Amazon EC2**
  - Hosts Jenkins
  - Hosts Docker Engine
  - Runs application containers

- **Elastic IP**
  - Ensures a fixed public IP for Jenkins and the application

- **Security Groups**
  - Port 22 → SSH access
  - Port 8080 → Jenkins UI
  - Port 3000 → Frontend
  - Port 5000 → Backend API

- **AWS DynamoDB**
  - Fully managed NoSQL database
  - Stores chat messages and active connections

- **API Gateway (WebSocket API)**
  - Enables real-time messaging

---

## 4. Technology Stack

### Frontend
- React (TypeScript)
- Nginx (for production build serving)
- WebSocket client

### Backend
- Node.js
- AWS SDK
- WebSocket handling logic

### DevOps & CI/CD
- Docker
- Docker Compose
- Jenkins
- GitHub Webhooks

---

## 5. CI/CD Pipeline Stages

1. **Code Commit**
   - Developer pushes code to GitHub

2. **Webhook Trigger**
   - GitHub webhook notifies Jenkins

3. **Build Stage**
   - Jenkins clones the repository
   - Builds Docker images for frontend and backend

4. **Deployment Stage**
   - Docker Compose stops old containers
   - Deploys new containers automatically

5. **Verification**
   - Application becomes live without manual intervention

---

## 6. Key Features

- Fully automated deployment (zero manual steps)
- Dockerized frontend and backend
- Real-time WebSocket chat functionality
- Cloud-managed database (DynamoDB)
- Jenkins-based CI/CD pipeline
- Scalable and modular architecture
- Industry-standard DevOps workflow

---

## 7. Testing & Validation

- Successful Docker image builds
- Container health verified using Docker commands
- Frontend and backend accessibility verified via browser
- Webhook-triggered automatic rebuilds validated
- Live updates confirmed after GitHub commits

---

## 8. Advantages of the System

- Faster deployments
- Reduced human error
- Easy rollback and rebuild
- Cloud-native design
- Industry-ready DevOps implementation

---

## 9. Conclusion

This project successfully demonstrates how DevOps practices can be applied to automate the deployment of a cloud-based web application. By integrating GitHub, Jenkins, Docker, and AWS services, the system ensures continuous delivery, scalability, and reliability — closely reflecting real-world industry DevOps workflows.

Any change pushed to the repository is automatically tested, built, and deployed, making the development-to-production cycle efficient and seamless.


## 10. Work flow Diagram

![Work flow Diagram](images/project_workflow.png)