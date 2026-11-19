const pageSize = 24;
const resultsElement = document.getElementById("site-results");
const statusElement = document.getElementById("results-status");
const form = document.getElementById("site-search-form");
const queryInput = document.getElementById("site-query");
const faithFilter = document.getElementById("site-faith");
const stateFilter = document.getElementById("site-state");
const pagination = document.getElementById("pagination");
let allSites = [];
let filteredSites = [];
let currentPage = 1;

function fillFilter(select, label, values) {
    select.replaceChildren(new Option(label, ""));
    for (const value of values) {
        select.add(new Option(value, value));
    }
}

function createSiteCard(site) {
    const card = document.createElement("article");
    card.className = "site-card";
    const detailUrl = `temple.html?slug=${encodeURIComponent(site.slug)}`;
    const imageLink = document.createElement("a");
    imageLink.href = detailUrl;
    imageLink.setAttribute("aria-label", `View details for ${site.temple_name}`);

    const image = document.createElement("img");
    image.src = site.image_url;
    image.alt = site.temple_name;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
        image.hidden = true;
    }, { once: true });
    imageLink.append(image);

    const info = document.createElement("div");
    info.className = "site-info";
    const location = document.createElement("span");
    location.className = "site-location";
    location.textContent = `${site.location.city} · ${site.location.state}`;

    const title = document.createElement("h2");
    const titleLink = document.createElement("a");
    titleLink.href = detailUrl;
    titleLink.textContent = site.temple_name;
    title.append(titleLink);

    const faith = document.createElement("p");
    faith.className = "site-faith";
    faith.textContent = `${site.site_type || "Place of worship"} · ${site.religion || "Faith not specified"}`;
    info.append(location, title, faith);
    card.append(
        imageLink,
        info,
        window.portalSavedSites.createCardActions(
            site.slug,
            site.temple_name,
            new URL(detailUrl, window.location.href).href
        )
    );
    return card;
}

function applyFilters() {
    const query = queryInput.value.trim().toLocaleLowerCase();
    const faith = faithFilter.value;
    const state = stateFilter.value;
    filteredSites = allSites.filter((site) => {
        const searchableText = [
            site.temple_name,
            site.location.city,
            site.location.state,
            site.religion,
            site.site_type
        ].join(" ").toLocaleLowerCase();
        return (!query || searchableText.includes(query))
            && (!faith || site.religion === faith)
            && (!state || site.location.state === state);
    });
    currentPage = 1;
    renderResults();
}

function renderResults() {
    resultsElement.replaceChildren();
    if (!filteredSites.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No places of worship match those search filters.";
        resultsElement.append(empty);
        statusElement.textContent = "0 places of worship found.";
        pagination.hidden = true;
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const pageSites = filteredSites.slice(start, start + pageSize);
    for (const site of pageSites) {
        resultsElement.append(createSiteCard(site));
    }

    const pageCount = Math.ceil(filteredSites.length / pageSize);
    statusElement.textContent = `${filteredSites.length.toLocaleString()} places of worship found. Showing ${start + 1}–${Math.min(start + pageSize, filteredSites.length)}.`;
    pagination.hidden = pageCount <= 1;
    document.getElementById("page-status").textContent = `Page ${currentPage} of ${pageCount}`;
    document.getElementById("previous-page").disabled = currentPage <= 1;
    document.getElementById("next-page").disabled = currentPage >= pageCount;
}

async function loadSites() {
    statusElement.textContent = "Loading places of worship...";
    try {
        const response = await fetch("/api/temples");
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Could not load places of worship.");
        }
        if (!Array.isArray(data.temples)) {
            throw new Error("The places-of-worship response was invalid.");
        }

        allSites = data.temples;
        fillFilter(faithFilter, "All faiths", [...new Set(allSites.map((site) => site.religion).filter(Boolean))].sort());
        fillFilter(stateFilter, "All states and territories", [...new Set(allSites.map((site) => site.location.state).filter(Boolean))].sort());

        const params = new URLSearchParams(window.location.search);
        queryInput.value = params.get("q") || "";
        faithFilter.value = params.get("faith") || "";
        stateFilter.value = params.get("state") || "";
        applyFilters();
    } catch (error) {
        statusElement.textContent = error instanceof Error ? error.message : "Could not load places of worship.";
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (queryInput.value.trim()) params.set("q", queryInput.value.trim());
    if (faithFilter.value) params.set("faith", faithFilter.value);
    if (stateFilter.value) params.set("state", stateFilter.value);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    applyFilters();
});

document.getElementById("clear-filters").addEventListener("click", () => {
    form.reset();
    window.history.replaceState(null, "", window.location.pathname);
    applyFilters();
    queryInput.focus();
});

document.getElementById("previous-page").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage -= 1;
        renderResults();
        window.scrollTo({ top: document.querySelector(".results-bar").offsetTop - 100, behavior: "smooth" });
    }
});

document.getElementById("next-page").addEventListener("click", () => {
    if (currentPage < Math.ceil(filteredSites.length / pageSize)) {
        currentPage += 1;
        renderResults();
        window.scrollTo({ top: document.querySelector(".results-bar").offsetTop - 100, behavior: "smooth" });
    }
});

loadSites();
