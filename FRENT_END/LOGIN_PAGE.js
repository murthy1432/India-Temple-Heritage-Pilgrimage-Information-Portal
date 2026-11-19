const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const loginPanel = document.getElementById("login-panel");
const signupPanel = document.getElementById("signup-panel");
const pageTitle = document.getElementById("page-title");
const pageIntro = document.getElementById("page-intro");
const message = document.getElementById("form-message");

function showMode(mode) {
    const isLogin = mode === "login";
    loginTab.setAttribute("aria-selected", String(isLogin));
    signupTab.setAttribute("aria-selected", String(!isLogin));
    loginPanel.hidden = !isLogin;
    signupPanel.hidden = isLogin;
    pageTitle.textContent = isLogin ? "Welcome back" : "Create your account";
    pageIntro.textContent = isLogin
        ? "Log in with your username and password."
        : "Choose a username and password to get started.";
    message.textContent = "";
}

function showError(error) {
    message.textContent = error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";
}

async function requestApi(path, body) {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "The request could not be completed.");
    }
    return data;
}

loginTab.addEventListener("click", () => showMode("login"));
signupTab.addEventListener("click", () => showMode("signup"));
window.addEventListener("hashchange", () => {
    if (window.location.hash === "#signup-panel") {
        showMode("signup");
    } else if (window.location.hash === "#login-panel") {
        showMode("login");
    }
});
showMode(window.location.hash === "#signup-panel" ? "signup" : "login");

document.getElementById("signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";

    const form = event.currentTarget;
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;

    if (password !== confirmPassword) {
        message.textContent = "The passwords do not match.";
        return;
    }

    try {
        const result = await requestApi("/api/auth/signup", { username, password });
        form.reset();
        document.getElementById("login-username").value = username;
        showMode("login");
        message.textContent = result.message;
    } catch (error) {
        showError(error);
    }
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";

    const form = event.currentTarget;
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;

    try {
        const result = await requestApi("/api/auth/login", { username, password });
        sessionStorage.setItem("indianTemplePortalSessionToken", result.token);
        sessionStorage.setItem("indianTemplePortalCurrentUser", result.user.username);
        form.reset();
        const nextPage = new URLSearchParams(window.location.search).get("next");
        window.location.href = nextPage === "profile.html" ? "profile.html" : "index.html";
    } catch (error) {
        showError(error);
    }
});
