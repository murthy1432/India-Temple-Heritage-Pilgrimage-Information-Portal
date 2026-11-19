const status = document.getElementById("page-status");
const detail = document.getElementById("temple-detail");

function appendListItems(list, items) {
    for (const [index, item] of items.entries()) {
        const listItem = document.createElement("li");
        const number = document.createElement("span");
        number.className = "line-number";
        number.textContent = String(index + 1).padStart(2, "0");
        const text = document.createElement("span");
        text.textContent = item;
        listItem.append(number, text);
        list.append(listItem);
    }
}

async function loadTemple() {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
        status.textContent = "Choose a sacred site from the home page to view its details.";
        return;
    }

    try {
        const response = await fetch(`/api/temples/${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Could not load temple details.");
        }

        const temple = data.temple;
        document.title = `${temple.temple_name} | India Temple Portal`;
        const image = document.getElementById("temple-image");
        image.alt = temple.temple_name;
        if (temple.image_url) {
            image.src = temple.image_url;
        } else {
            image.hidden = true;
        }
        image.addEventListener("error", () => {
            image.hidden = true;
        }, { once: true });
        document.getElementById("temple-location").textContent =
            `${temple.location.city}, ${temple.location.state}`;
        document.getElementById("temple-name").textContent = temple.temple_name;
        document.getElementById("save-site-control").replaceWith(
            window.portalSavedSites.createCardActions(
                temple.slug,
                temple.temple_name,
                window.location.href,
                "top"
            )
        );
        document.getElementById("hero-subtitle").textContent =
            `${temple.site_type || "Place of worship"} · ${temple.religion || "Faith not specified"}. Visitor information for ${temple.temple_name}.`;
        const religiousFocus = [temple.religion || "Not specified"];
        if (temple.deity && temple.deity !== temple.religion) religiousFocus.push(temple.deity);
        appendListItems(document.getElementById("temple-deity"), religiousFocus);
        appendListItems(document.getElementById("temple-timings"), [temple.darshan_timings]);
        appendListItems(document.getElementById("temple-history"), [temple.historical_background]);
        document.getElementById("booking-information").textContent = temple.booking_information;
        appendListItems(
            document.getElementById("temple-festivals"),
            temple.festivals.length ? temple.festivals : ["Festival information is not listed in the source."]
        );
        appendListItems(document.getElementById("temple-guidelines"), temple.visitor_guidelines);

        const officialLinks = document.getElementById("official-links");
        for (const officialLink of temple.official_links) {
            const link = document.createElement("a");
            link.className = "official-link";
            link.href = officialLink.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = officialLink.label;
            officialLinks.append(link);
        }

        const mapLink = document.getElementById("map-link");
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${temple.temple_name}, ${temple.location.city}, ${temple.location.state}`)}`;
        status.hidden = true;
        detail.hidden = false;
    } catch (error) {
        status.className = "error";
        status.textContent = error.message;
    }
}

loadTemple();
