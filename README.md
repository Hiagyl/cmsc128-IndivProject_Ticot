# To Do List Web App

This is a Task Management Web Application built with **Node.js + Express** for the backend, **MongoDB Atlas** for the database, and a frontend hosted on **Vercel**. The backend is hosted on **Render**.

---

## **Backend Technology**

- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Hosting:** Render
- **Authentication:** JWT (JSON Web Tokens)
- **Logging:** Morgan + Winston
- **CORS enabled** for frontend requests

---

## **Frontend Technology**

- **Frontend:** Plain HTML/JS
- **Hosting:** Vercel
- **API Base URL:** 
```javascript
const API_BASE = "https://cmsc128-indivproject-ticot-1.onrender.com/api";
```

--- 

## Access the App

The app is **already deployed**, so no local setup is required to use it.

- **Frontend URL (Vercel):** `cmsc128-indiv-project-ticot.vercel.app`

Simply open the frontend URL in your browser and start managing tasks.

---

## How the App Works

1. **User Registration/Login:** Create an account or log in to manage your tasks.  
2. **Task Management:** Add, edit, delete, and view tasks.  
3. **JWT Authentication:** All task-related actions require a valid token, handled automatically by the frontend.

---

## **Sample API Endpoints**

- Get all tasks: https://cmsc128-indivproject-ticot-1.onrender.com/api/tasks  
- Get, update, or delete a specific task by ID: https://cmsc128-indivproject-ticot-1.onrender.com/api/tasks/${id}  
- User login: https://cmsc128-indivproject-ticot-1.onrender.com/api/login



