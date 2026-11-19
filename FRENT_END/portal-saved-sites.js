(() => {
    const root = new URL(".", document.currentScript.src);
    const tokenKey = "indianTemplePortalSessionToken";
    let savedSlugs;
    let savedSlugsRequest;
    const openMenus = new Set();

    async function loadSavedSlugs() {
        if (savedSlugs) return savedSlugs;
        if (!savedSlugsRequest) {
            savedSlugsRequest = (async () => {
                const token = sessionStorage.getItem(tokenKey);
                if (!token) {
                    savedSlugs = new Set();
                    return savedSlugs;
                }

                const response = await fetch(new URL("api/account/saved-sites", root), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Could not load your saved places.");
                }
                savedSlugs = new Set(data.savedSlugs);
                return savedSlugs;
            })();
        }
        return savedSlugsRequest;
    }

    function loginUrl() {
        const currentPage = new URL(window.location.href);
        currentPage.hash = "";
        const nextPage = `${currentPage.pathname.split("/").pop()}${currentPage.search}`;
        const url = new URL("LOGIN_PAGE.html", root);
        url.searchParams.set("next", nextPage);
        url.hash = "login-panel";
        return url.href;
    }

    function createSaveControl(slug) {
        const container = document.createElement("div");
        container.className = "save-site-control";
        const button = document.createElement("button");
        button.className = "save-site-button";
        button.type = "button";
        button.textContent = "Save for later";
        button.setAttribute("aria-pressed", "false");
        const status = document.createElement("span");
        status.className = "save-site-status";
        status.setAttribute("role", "status");
        container.append(button, status);

        function updateButton(saved) {
            button.textContent = saved ? "Saved · Remove" : "Save for later";
            button.setAttribute("aria-pressed", String(saved));
        }

        loadSavedSlugs()
            .then((slugs) => updateButton(slugs.has(slug)))
            .catch((error) => {
                button.disabled = true;
                button.textContent = "Could not load saved status";
                status.textContent = error.message;
            });

        button.addEventListener("click", async () => {
            const token = sessionStorage.getItem(tokenKey);
            if (!token) {
                window.location.href = loginUrl();
                return;
            }

            button.disabled = true;
            status.textContent = "";
            try {
                const slugs = await loadSavedSlugs();
                const isSaved = slugs.has(slug);
                const response = await fetch(
                    new URL(`api/account/saved-sites/${encodeURIComponent(slug)}`, root),
                    {
                        method: isSaved ? "DELETE" : "POST",
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Could not update your saved places.");
                }
                if (data.saved) {
                    slugs.add(slug);
                } else {
                    slugs.delete(slug);
                }
                updateButton(data.saved);
                status.textContent = data.message;
            } catch (error) {
                status.textContent = error instanceof Error
                    ? error.message
                    : "Could not update your saved places.";
            } finally {
                button.disabled = false;
            }
        });

        return container;
    }

    function createCardActions(slug, title, shareUrl, placement = "bottom") {
        const container = document.createElement("div");
        container.className = `portal-card-actions portal-card-actions--${placement}`;

        const toggle = document.createElement("button");
        toggle.className = "portal-actions-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", `More actions for ${title}`);
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.7" fill="currentColor"></circle>
                <circle cx="12" cy="12" r="1.7" fill="currentColor"></circle>
                <circle cx="19" cy="12" r="1.7" fill="currentColor"></circle>
            </svg>`;

        const menu = document.createElement("div");
        menu.className = "portal-actions-menu";
        menu.hidden = true;
        menu.setAttribute("aria-label", `Actions for ${title}`);
        const wishlistButton = document.createElement("button");
        wishlistButton.className = "portal-menu-item";
        wishlistButton.type = "button";
        wishlistButton.textContent = "Save to wish list";
        const shareButton = document.createElement("button");
        shareButton.className = "portal-menu-item";
        shareButton.type = "button";
        shareButton.textContent = "Share";
        const status = document.createElement("p");
        status.className = "portal-actions-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        const shareOptions = document.createElement("div");
        shareOptions.className = "portal-share-options";
        shareOptions.hidden = true;
        const copyButton = document.createElement("button");
        copyButton.className = "portal-menu-item";
        copyButton.type = "button";
        copyButton.textContent = "Copy link";
        const whatsappLink = document.createElement("a");
        whatsappLink.className = "portal-menu-item";
        whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(title + " " + shareUrl)}`;
        whatsappLink.target = "_blank";
        whatsappLink.rel = "noopener noreferrer";
        whatsappLink.textContent = "WhatsApp";
        const nativeShareButton = document.createElement("button");
        nativeShareButton.className = "portal-menu-item";
        nativeShareButton.type = "button";
        nativeShareButton.textContent = "More sharing options";
        nativeShareButton.hidden = typeof navigator.share !== "function";
        shareOptions.append(copyButton, whatsappLink, nativeShareButton);
        menu.append(wishlistButton, shareButton, shareOptions, status);
        container.append(toggle, menu);

        function closeMenu() {
            menu.hidden = true;
            shareOptions.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
            openMenus.delete(container);
        }

        function updateWishlistButton(isSaved) {
            wishlistButton.textContent = isSaved ? "Remove from wish list" : "Save to wish list";
            wishlistButton.setAttribute("aria-pressed", String(isSaved));
        }

        toggle.addEventListener("click", async () => {
            if (!menu.hidden) {
                closeMenu();
                return;
            }
            for (const otherMenu of openMenus) {
                otherMenu.querySelector(".portal-actions-toggle").setAttribute("aria-expanded", "false");
                otherMenu.querySelector(".portal-actions-menu").hidden = true;
                otherMenu.querySelector(".portal-share-options").hidden = true;
            }
            openMenus.clear();
            menu.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
            openMenus.add(container);
            status.textContent = "";
            try {
                const slugs = await loadSavedSlugs();
                updateWishlistButton(slugs.has(slug));
            } catch (error) {
                status.textContent = error instanceof Error ? error.message : "Could not load your wish list.";
            }
        });

        wishlistButton.addEventListener("click", async () => {
            const token = sessionStorage.getItem(tokenKey);
            if (!token) {
                window.location.href = loginUrl();
                return;
            }

            wishlistButton.disabled = true;
            status.textContent = "";
            try {
                const slugs = await loadSavedSlugs();
                const isSaved = slugs.has(slug);
                const response = await fetch(
                    new URL(`api/account/saved-sites/${encodeURIComponent(slug)}`, root),
                    {
                        method: isSaved ? "DELETE" : "POST",
                        headers: { Authorization: "Bearer " + token }
                    }
                );
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Could not update your wish list.");
                }
                if (data.saved) slugs.add(slug);
                else slugs.delete(slug);
                updateWishlistButton(data.saved);
                status.textContent = data.message;
            } catch (error) {
                status.textContent = error instanceof Error ? error.message : "Could not update your wish list.";
            } finally {
                wishlistButton.disabled = false;
            }
        });

        shareButton.addEventListener("click", () => {
            shareOptions.hidden = !shareOptions.hidden;
        });

        copyButton.addEventListener("click", async () => {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(shareUrl);
                } else {
                    const input = document.createElement("textarea");
                    input.value = shareUrl;
                    input.setAttribute("readonly", "");
                    input.style.position = "fixed";
                    input.style.opacity = "0";
                    document.body.append(input);
                    input.select();
                    const copied = document.execCommand("copy");
                    input.remove();
                    if (!copied) throw new Error("Copy is not available in this browser.");
                }
                status.textContent = "Link copied.";
            } catch (error) {
                status.textContent = error instanceof Error ? error.message : "Could not copy the link.";
            }
        });

        nativeShareButton.addEventListener("click", async () => {
            try {
                await navigator.share({ title, text: `Visit ${title}`, url: shareUrl });
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return;
                status.textContent = error instanceof Error ? error.message : "Could not share this place.";
            }
        });

        return container;
    }

    document.addEventListener("click", (event) => {
        for (const container of openMenus) {
            if (!container.contains(event.target)) {
                const toggle = container.querySelector(".portal-actions-toggle");
                const menu = container.querySelector(".portal-actions-menu");
                const shareOptions = container.querySelector(".portal-share-options");
                toggle.setAttribute("aria-expanded", "false");
                menu.hidden = true;
                shareOptions.hidden = true;
                openMenus.delete(container);
            }
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        for (const container of openMenus) {
            container.querySelector(".portal-actions-menu").hidden = true;
            container.querySelector(".portal-share-options").hidden = true;
            container.querySelector(".portal-actions-toggle").setAttribute("aria-expanded", "false");
            container.querySelector(".portal-actions-toggle").focus();
            openMenus.delete(container);
        }
    });

    window.portalSavedSites = { createSaveControl, createCardActions };
})();
