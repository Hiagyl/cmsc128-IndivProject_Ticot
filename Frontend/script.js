const API_BASE = "https://cmsc128-indivproject-ticot-1.onrender.com/api";

// ----- SIGNUP -----
const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value.trim();
        const message = document.getElementById("signupMessage");

        try {
            const res = await fetch(`${API_BASE}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                // Save user info & token
                localStorage.setItem("user", JSON.stringify(data.user));
                localStorage.setItem("token", data.token);

                message.classList.remove("text-red-500");
                message.classList.add("text-green-600");
                message.textContent = "✅ Account created! Redirecting...";

                // Redirect to task.html with userId
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1500);
            } else {
                message.classList.add("text-red-500");
                message.textContent = data.message || "⚠️ Error creating account.";
            }
        } catch {
            message.classList.add("text-red-500");
            message.textContent = "❌ Server connection error.";
        }
    });
}

// ----- LOGIN -----
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value.trim();
        const message = document.getElementById("loginMessage");

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                // Save user info & token
                localStorage.setItem("user", JSON.stringify(data.user));
                localStorage.setItem("token", data.token);

                message.classList.remove("text-red-500");
                message.classList.add("text-green-600");
                message.textContent = "✅ Login successful!";

                // console.log(data);

                // Redirect to task.html with userId
                setTimeout(() => {
                    window.location.href = `task.html?userId=${data.user.id}`;
                }, 1000);
            } else {
                message.classList.add("text-red-500");
                message.textContent = data.message || "⚠️ Invalid credentials.";
            }
        } catch {
            message.classList.add("text-red-500");
            message.textContent = "❌ Server connection error.";
        }
    });
}

// ----- PROFILE -----
const profilePage = document.getElementById("profileDetails");
if (profilePage) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "index.html";
    } else {
        // Show only name and email, no extra heading
        profilePage.innerHTML = `
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
        `;
    }

    document.addEventListener("click", (e) => {
        if (e.target.id === "logoutBtn") {
            localStorage.clear();
            window.location.href = "index.html";
        }
    });
}

// ----- REDIRECT TO TASK PAGE -----

const backToTasksBtn = document.getElementById("backToTasksBtn");
if (backToTasksBtn) {
    backToTasksBtn.addEventListener("click", () => {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) {
            alert("Please log in first!");
            window.location.href = "index.html"; // redirect to login if not logged in
        } else {
            window.location.href = `task.html?userId=${user._id || user.id}`;
        }
    });
}

// ----- UPDATE PROFILE -----
const updateForm = document.getElementById("updateForm");
if (updateForm) {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");
    const updateMessage = document.getElementById("updateMessage");

    // Pre-fill user details
    document.getElementById("updateName").value = user?.name || "";
    document.getElementById("updateEmail").value = user?.email || "";

    updateForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("updateName").value.trim();
        const email = document.getElementById("updateEmail").value.trim();
        const password = document.getElementById("updatePassword").value.trim();

        try {
            const res = await fetch(`${API_BASE}/update`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                updateMessage.classList.remove("text-red-500");
                updateMessage.classList.add("text-green-600");
                updateMessage.textContent = "✅ Profile updated successfully!";

                // Update localStorage with new user info
                localStorage.setItem("user", JSON.stringify(data.user));

                // Refresh displayed profile info
                document.getElementById("profileDetails").innerHTML = `
                    <p><strong>Name:</strong> ${data.user.name}</p>
                    <p><strong>Email:</strong> ${data.user.email}</p>
                `;
                document.getElementById("updatePassword").value = "";
            } else {
                updateMessage.classList.add("text-red-500");
                updateMessage.textContent = data.message || "⚠️ Update failed.";
            }
        } catch {
            updateMessage.classList.add("text-red-500");
            updateMessage.textContent = "❌ Server connection error.";
        }
    });
}
