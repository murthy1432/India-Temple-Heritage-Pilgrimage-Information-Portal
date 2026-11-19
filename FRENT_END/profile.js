const tokenKey = "indianTemplePortalSessionToken";
const pageStatus = document.getElementById("page-status");
const profileContent = document.getElementById("profile-content");
const profileForm = document.getElementById("profile-form");
const profileStatus = document.getElementById("profile-status");
const passwordForm = document.getElementById("password-form");
const passwordStatus = document.getElementById("password-status");
const galleryPhotoInput = document.getElementById("gallery-photo-input");
const cameraPhotoInput = document.getElementById("camera-photo-input");
const photoPreview = document.getElementById("profile-photo");
const removePhotoButton = document.getElementById("remove-photo");
const savedList = document.getElementById("saved-list");
const logoutButton = document.getElementById("profile-logout");
const logoutStatus = document.getElementById("logout-status");
const settingsTab = document.getElementById("settings-tab");
const savedTab = document.getElementById("saved-tab");
const settingsPanel = document.getElementById("settings-panel");
const savedPanel = document.getElementById("saved-panel");
const settingsOptions = document.getElementById("settings-options");
const profileEditPanel = document.getElementById("profile-edit-panel");
const passwordSettingsPanel = document.getElementById("password-settings-panel");
const summaryPhoto = document.getElementById("summary-photo");
const summaryInitial = document.getElementById("summary-initial");
let currentAvatar = "";
let removeCurrentAvatar = false;
let previewUrl = "";

function authHeaders(json = false) {
    const token = sessionStorage.getItem(tokenKey);
    if (!token) {
        throw new Error("Please log in to view and save your profile.");
    }
    return {
        Authorization: `Bearer ${token}`,
        ...(json ? { "Content-Type": "application/json" } : {})
    };
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { ...authHeaders(Boolean(options.body)), ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) {
        if (response.status === 401) {
            sessionStorage.removeItem(tokenKey);
            const loginUrl = new URL("LOGIN_PAGE.html", window.location.href);
            loginUrl.searchParams.set("next", "profile.html");
            loginUrl.hash = "login-panel";
            window.location.href = loginUrl.href;
        }
        throw new Error(data.error || "The request could not be completed.");
    }
    return data;
}

async function imageDataUrl(file) {
    if (!file) return "";
    if (!file.type.startsWith("image/")) {
        throw new Error("Choose an image file for your profile photo.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Choose an image smaller than 5 MB.");
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("That image could not be opened."));
            image.src = objectUrl;
        });
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context || !size) throw new Error("That image could not be processed.");
        context.drawImage(
            image,
            (image.naturalWidth - size) / 2,
            (image.naturalHeight - size) / 2,
            size,
            size,
            0,
            0,
            256,
            256
        );
        return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function showPhoto(avatar) {
    currentAvatar = avatar || "";
    photoPreview.src = currentAvatar;
    photoPreview.hidden = !currentAvatar;
    removePhotoButton.hidden = !currentAvatar;
    if (!currentAvatar) photoPreview.removeAttribute("src");
    summaryPhoto.src = currentAvatar;
    summaryPhoto.hidden = !currentAvatar;
    summaryInitial.hidden = Boolean(currentAvatar);
    if (!currentAvatar) summaryPhoto.removeAttribute("src");
}

function updateProfileSummary(profile) {
    const name = profile.displayName || profile.username;
    document.getElementById("profile-page-title").textContent = name;
    document.getElementById("summary-phone").textContent = profile.phone || "Add your phone number";
    document.getElementById("summary-email").textContent = profile.email || "Add your email address";
    summaryInitial.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase() || "U";
}

function selectProfileTab(selectedTab) {
    const showSettings = selectedTab === settingsTab;
    settingsTab.setAttribute("aria-selected", String(showSettings));
    settingsTab.tabIndex = showSettings ? 0 : -1;
    savedTab.setAttribute("aria-selected", String(!showSettings));
    savedTab.tabIndex = showSettings ? -1 : 0;
    settingsPanel.hidden = !showSettings;
    savedPanel.hidden = showSettings;
    if (showSettings) showSettingsOptions();
}

function showSettingsOptions() {
    settingsOptions.hidden = false;
    profileEditPanel.hidden = true;
    passwordSettingsPanel.hidden = true;
}

function showSettingsSection(section) {
    settingsOptions.hidden = true;
    profileEditPanel.hidden = section !== profileEditPanel;
    passwordSettingsPanel.hidden = section !== passwordSettingsPanel;
}

document.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextTab;
    if (event.key === "Home") {
        nextTab = settingsTab;
    } else if (event.key === "End") {
        nextTab = savedTab;
    } else if (event.key === "ArrowRight") {
        nextTab = document.activeElement === settingsTab ? savedTab : settingsTab;
    } else {
        nextTab = document.activeElement === savedTab ? settingsTab : savedTab;
    }
    selectProfileTab(nextTab);
    nextTab.focus();
});

function updateNavigationAvatar(avatar, accountName) {
    const navigationAvatar = document.getElementById("portal-user-avatar");
    const navigationFallback = document.getElementById("portal-user-fallback");
    if (!navigationAvatar || !navigationFallback) return;

    if (avatar) {
        navigationAvatar.src = avatar;
        navigationAvatar.hidden = false;
        navigationFallback.hidden = true;
        return;
    }

    navigationAvatar.removeAttribute("src");
    navigationAvatar.hidden = true;
    navigationFallback.textContent = Array.from(accountName.trim())[0]?.toLocaleUpperCase() || "U";
    navigationFallback.hidden = false;
}

function createSavedCard(site) {
    const card = document.createElement("article");
    card.className = "saved-card";
    const detailUrl = `temple.html?slug=${encodeURIComponent(site.slug)}`;
    const imageLink = document.createElement("a");
    imageLink.href = detailUrl;
    imageLink.setAttribute("aria-label", `View details for ${site.temple_name}`);
    const image = document.createElement("img");
    image.src = site.image_url;
    image.alt = site.temple_name;
    image.loading = "lazy";
    image.addEventListener("error", () => {
        image.hidden = true;
    }, { once: true });
    imageLink.append(image);

    const info = document.createElement("div");
    const heading = document.createElement("h3");
    const link = document.createElement("a");
    link.href = detailUrl;
    link.textContent = site.temple_name;
    heading.append(link);
    const location = document.createElement("p");
    location.textContent = `${site.location.city} · ${site.location.state}`;
    const faith = document.createElement("p");
    faith.textContent = `${site.site_type || "Place of worship"} · ${site.religion || "Faith not specified"}`;
    info.append(heading, location, faith);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-saved";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${site.temple_name} from saved places`);
    removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        try {
            await apiRequest(`/api/account/saved-sites/${encodeURIComponent(site.slug)}`, {
                method: "DELETE"
            });
            card.remove();
            if (!savedList.querySelector(".saved-card")) showEmptySavedList();
        } catch (error) {
            removeButton.disabled = false;
            profileStatus.className = "status error";
            profileStatus.textContent = error instanceof Error ? error.message : "Could not remove the saved place.";
        }
    });

    card.append(imageLink, info, removeButton);
    return card;
}

function showEmptySavedList() {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "You have not saved any places yet. Use “Save for later” on a site to add it here.";
    savedList.replaceChildren(empty);
}

async function loadProfile() {
    if (!sessionStorage.getItem(tokenKey)) {
        const loginUrl = new URL("LOGIN_PAGE.html", window.location.href);
        loginUrl.searchParams.set("next", "profile.html");
        loginUrl.hash = "login-panel";
        window.location.replace(loginUrl.href);
        return;
    }

    try {
        const [profileData, savedData] = await Promise.all([
            apiRequest("/api/account/profile"),
            apiRequest("/api/account/saved-sites")
        ]);
        const profile = profileData.profile;
        document.getElementById("account-username").textContent = `Username: ${profile.username}`;
        document.getElementById("display-name").value = profile.displayName || "";
        document.getElementById("phone-number").value = profile.phone || "";
        document.getElementById("email-address").value = profile.email || "";
        updateProfileSummary(profile);
        showPhoto(profile.avatar);
        savedList.replaceChildren();
        if (savedData.temples.length) {
            for (const site of savedData.temples) savedList.append(createSavedCard(site));
        } else {
            showEmptySavedList();
        }
        document.querySelector(".profile-summary").hidden = false;
        pageStatus.hidden = true;
        profileContent.hidden = false;
    } catch (error) {
        pageStatus.className = "status error";
        pageStatus.textContent = error instanceof Error ? error.message : "Could not load your profile.";
    }
}

function handlePhotoSelection(event) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = event.currentTarget.files[0];
    const otherInput = event.currentTarget === galleryPhotoInput ? cameraPhotoInput : galleryPhotoInput;
    otherInput.value = "";
    previewUrl = file ? URL.createObjectURL(file) : "";
    if (previewUrl) {
        photoPreview.src = previewUrl;
        photoPreview.hidden = false;
        removeCurrentAvatar = false;
    } else {
        showPhoto(currentAvatar);
    }
}

galleryPhotoInput.addEventListener("change", handlePhotoSelection);
cameraPhotoInput.addEventListener("change", handlePhotoSelection);
document.getElementById("take-photo").addEventListener("click", () => cameraPhotoInput.click());
document.getElementById("choose-photo").addEventListener("click", () => galleryPhotoInput.click());
settingsTab.addEventListener("click", () => {
    selectProfileTab(settingsTab);
    showSettingsOptions();
});
savedTab.addEventListener("click", () => selectProfileTab(savedTab));
document.getElementById("open-profile-editor").addEventListener("click", () => {
    selectProfileTab(settingsTab);
    showSettingsSection(profileEditPanel);
    document.getElementById("display-name").focus();
});
document.getElementById("open-password-settings").addEventListener("click", () => {
    selectProfileTab(settingsTab);
    showSettingsSection(passwordSettingsPanel);
    document.getElementById("current-password").focus();
});
document.getElementById("profile-edit-back").addEventListener("click", showSettingsOptions);
document.getElementById("password-settings-back").addEventListener("click", () => {
    passwordForm.reset();
    passwordStatus.className = "status";
    passwordStatus.textContent = "";
    showSettingsOptions();
});
document.getElementById("edit-profile").addEventListener("click", () => {
    selectProfileTab(settingsTab);
    showSettingsSection(profileEditPanel);
    document.getElementById("display-name").focus();
});

removePhotoButton.addEventListener("click", () => {
    removeCurrentAvatar = true;
    galleryPhotoInput.value = "";
    cameraPhotoInput.value = "";
    photoPreview.hidden = true;
    removePhotoButton.hidden = true;
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
    }
});

profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileStatus.className = "status";
    profileStatus.textContent = "";
    const saveButton = document.getElementById("save-profile");
    saveButton.disabled = true;
    try {
        const selectedPhoto = galleryPhotoInput.files[0] || cameraPhotoInput.files[0];
        const avatar = removeCurrentAvatar
            ? ""
            : selectedPhoto
                ? await imageDataUrl(selectedPhoto)
                : currentAvatar;
        const data = await apiRequest("/api/account/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName: document.getElementById("display-name").value,
                phone: document.getElementById("phone-number").value,
                email: document.getElementById("email-address").value,
                avatar
            })
        });
        showPhoto(data.profile.avatar);
        updateProfileSummary(data.profile);
        updateNavigationAvatar(
            data.profile.avatar,
            data.profile.displayName || data.profile.username
        );
        removeCurrentAvatar = false;
        galleryPhotoInput.value = "";
        cameraPhotoInput.value = "";
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = "";
        }
        pageStatus.className = "status";
        pageStatus.textContent = data.message;
        pageStatus.hidden = false;
        showSettingsOptions();
        settingsTab.focus();
    } catch (error) {
        profileStatus.className = "status error";
        profileStatus.textContent = error instanceof Error ? error.message : "Could not save your details.";
    } finally {
        saveButton.disabled = false;
    }
});

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordStatus.className = "status";
    passwordStatus.textContent = "";
    const saveButton = document.getElementById("save-password");
    saveButton.disabled = true;
    try {
        const formData = new FormData(passwordForm);
        const data = await apiRequest("/api/account/password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: formData.get("currentPassword"),
                newPassword: formData.get("newPassword"),
                confirmPassword: formData.get("confirmPassword")
            })
        });
        passwordForm.reset();
        passwordStatus.textContent = data.message;
    } catch (error) {
        passwordStatus.className = "status error";
        passwordStatus.textContent = error instanceof Error ? error.message : "Could not update your password.";
    } finally {
        saveButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutStatus.textContent = "";
    try {
        const token = sessionStorage.getItem(tokenKey);
        if (token) {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                headers: authHeaders()
            });
            if (!response.ok && response.status !== 401) {
                throw new Error("Could not log out. Please try again.");
            }
        }
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem("indianTemplePortalCurrentUser");
        window.location.replace("index.html");
    } catch (error) {
        logoutStatus.textContent = error instanceof Error
            ? error.message
            : "Could not log out. Please try again.";
        logoutButton.disabled = false;
    }
});

loadProfile();
