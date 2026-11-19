const templeResults = document.getElementById("temple-results");
const searchStatus = document.getElementById("temple-search-status");
const homepageTempleLimit = 6;

function updateHomepage(temples) {
    const states = [...new Set(temples.map((temple) => temple.location.state))]
        .sort((first, second) => first.localeCompare(second));
    const stateSelect = document.getElementById("temple-search-state");
    stateSelect.replaceChildren(new Option("Choose State or Territory", ""));
    for (const state of states) {
        stateSelect.add(new Option(state, state));
    }

    document.getElementById("temple-count").textContent = temples.length.toLocaleString();
    document.getElementById("state-count").textContent = states.length.toLocaleString();

    const featuredTemple = temples[0];
    const heroImage = document.getElementById("hero-temple-image");
    const heroLink = document.getElementById("hero-temple-link");
    const heroBadge = document.getElementById("hero-temple-badge");
    if (!featuredTemple) {
        heroImage.hidden = true;
        heroBadge.hidden = true;
        heroLink.href = "#temples";
        heroLink.setAttribute("aria-label", "View places of worship");
        return;
    }

    heroImage.hidden = !featuredTemple.image_url;
    heroImage.alt = featuredTemple.temple_name;
    heroImage.addEventListener("error", () => {
        heroImage.hidden = true;
    }, { once: true });
    heroImage.src = featuredTemple.image_url;
    const detailUrl = `temple.html?slug=${encodeURIComponent(featuredTemple.slug)}`;
    heroLink.href = detailUrl;
    heroLink.setAttribute("aria-label", `View details for ${featuredTemple.temple_name}`);
    heroBadge.href = detailUrl;
    heroBadge.textContent = `📍 ${featuredTemple.temple_name} · ${featuredTemple.location.state}`;
    heroBadge.hidden = false;
}

async function loadTemples(query = "", state = "") {
    searchStatus.textContent = "Loading places of worship...";
    templeResults.replaceChildren();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (state) params.set("state", state);

    try {
        const response = await fetch(`/api/temples?${params}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Could not load temples.");
        }
        if (!query && !state) {
            updateHomepage(data.temples);
        }
        if (!data.temples.length) {
            searchStatus.textContent = "No places of worship match your search.";
            return;
        }

        for (const temple of data.temples.slice(0, homepageTempleLimit)) {
            const card = document.createElement("article");
            card.className = "temple-card";
            const detailUrl = `temple.html?slug=${encodeURIComponent(temple.slug)}`;
            const image = document.createElement("img");
            image.loading = "lazy";
            image.decoding = "async";
            image.src = temple.image_url;
            image.alt = temple.temple_name;
            image.addEventListener("error", () => {
                image.hidden = true;
            }, { once: true });
            const imageLink = document.createElement("a");
            imageLink.className = "photo-link";
            imageLink.href = detailUrl;
            imageLink.setAttribute("aria-label", `View details for ${temple.temple_name}`);
            imageLink.append(image);
            const info = document.createElement("div");
            info.className = "info";
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = `${temple.location.city} · ${temple.location.state}`;
            const title = document.createElement("h3");
            const titleLink = document.createElement("a");
            titleLink.href = detailUrl;
            titleLink.textContent = temple.temple_name;
            title.append(titleLink);
            const faith = document.createElement("p");
            faith.className = "deity";
            faith.textContent = `${temple.site_type || "Place of worship"} · ${temple.religion || temple.deity}`;
            const historyHeading = document.createElement("h4");
            historyHeading.textContent = "Historical Background";
            const history = document.createElement("p");
            history.textContent = temple.historical_background;
            const timings = document.createElement("p");
            timings.className = "timings";
            timings.textContent = `Visiting / prayer times: ${temple.darshan_timings}`;
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.textContent = "Festivals and visitor guidelines";
            details.append(summary);

            for (const [headingText, items] of [
                ["Festivals", temple.festivals],
                ["Visitor Guidelines", temple.visitor_guidelines]
            ]) {
                const heading = document.createElement("h4");
                heading.textContent = headingText;
                const list = document.createElement("ul");
                for (const item of items) {
                    const listItem = document.createElement("li");
                    listItem.textContent = item;
                    list.append(listItem);
                }
                details.append(heading, list);
            }

            info.append(tag, title, faith, historyHeading, history, timings, details);
            card.append(
                imageLink,
                info,
                window.portalSavedSites.createCardActions(
                    temple.slug,
                    temple.temple_name,
                    new URL(detailUrl, window.location.href).href
                )
            );
            templeResults.append(card);
        }
        const total = data.temples.length;
        const shown = Math.min(total, homepageTempleLimit);
        searchStatus.textContent = total > homepageTempleLimit
            ? `Showing ${shown} of ${total} places of worship. View all to see more.`
            : `${total} place${total === 1 ? "" : "s"} of worship found.`;
    } catch (error) {
        searchStatus.textContent = error.message;
    }
}

document.getElementById("temple-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    loadTemples(
        document.getElementById("temple-search-query").value.trim(),
        document.getElementById("temple-search-state").value
    );
});

loadTemples();
