(() => {
    const header = document.querySelector("[data-site-header]");
    if (!header) {
        throw new Error("The shared site navigation needs a [data-site-header] element.");
    }

    const scriptUrl = document.currentScript.src;
    const frontendRoot = new URL(".", scriptUrl);
    const homeUrl = new URL("index.html", frontendRoot);
    const sitesUrl = new URL("sacred-sites.html", frontendRoot);
    const authUrl = new URL("LOGIN_PAGE.html", frontendRoot);
    const homeLink = (section) => `${homeUrl.href}#${section}`;

    header.innerHTML = `
        <div class="site-topbar">
            <a class="site-brand" href="${homeLink("home")}">
                <span class="site-brand-mark" aria-hidden="true">ॐ</span>
                <span>India Temple Portal</span>
            </a>
            <nav class="site-nav" aria-label="Main navigation">
                <ul>
                    <li><a href="${homeLink("home")}">Home</a></li>
                    <li><a href="${sitesUrl.href}">Temples</a></li>
                    <li><a href="${homeLink("destinations")}">Destinations</a></li>
                    <li><a href="${homeLink("about")}">About</a></li>
                    <li><a href="${homeLink("contact")}">Contact</a></li>
                    <li id="portal-login-nav"><a class="site-nav-button" href="${authUrl.href}#login-panel">Log in</a></li>
                    <li class="site-account" id="portal-account-nav" hidden>
                        <a class="site-account-link" id="portal-account-link" href="${new URL("profile.html", frontendRoot).href}">
                            <img class="site-account-avatar" id="portal-user-avatar" alt="" hidden>
                            <span class="site-account-fallback" id="portal-user-fallback" aria-hidden="true" hidden></span>
                            <span class="visually-hidden" id="portal-username"></span>
                        </a>
                    </li>
                </ul>
            </nav>
        </div>`;

    const sessionTokenKey = "indianTemplePortalSessionToken";
    const sessionUserKey = "indianTemplePortalCurrentUser";
    const loginNav = document.getElementById("portal-login-nav");
    const accountNav = document.getElementById("portal-account-nav");

    async function loadCurrentUser() {
        const token = sessionStorage.getItem(sessionTokenKey);
        if (!token) return;

        try {
            const response = await fetch(new URL("api/auth/me", frontendRoot), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                sessionStorage.removeItem(sessionTokenKey);
                sessionStorage.removeItem(sessionUserKey);
                return;
            }

            const { user } = await response.json();
            loginNav.hidden = true;
            accountNav.hidden = false;
            const accountName = user.displayName || user.username;
            document.getElementById("portal-username").textContent = accountName;
            const accountLink = document.getElementById("portal-account-link");
            accountLink.setAttribute("aria-label", `Open profile for ${accountName}`);
            accountLink.title = "My Profile";
            const avatar = document.getElementById("portal-user-avatar");
            const fallback = document.getElementById("portal-user-fallback");
            if (user.avatar) {
                avatar.src = user.avatar;
                avatar.hidden = false;
                fallback.hidden = true;
                avatar.addEventListener("error", () => {
                    avatar.hidden = true;
                    fallback.hidden = false;
                }, { once: true });
            } else {
                avatar.hidden = true;
                fallback.textContent = Array.from(accountName.trim())[0]?.toLocaleUpperCase() || "U";
                fallback.hidden = false;
            }
        } catch (error) {
            console.error("Could not verify login session:", error);
        }
    }

    loadCurrentUser();
})();
