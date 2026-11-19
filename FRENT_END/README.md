# Shared site navigation

Each page keeps its structure in HTML, its page-specific styles in a matching
CSS file, and its page-specific behavior in a matching JavaScript file. For
example, `temple.html` loads `temple.css` and `temple.js`. Shared navigation and
saved-place actions remain in `portal-nav.css`, `portal-nav.js`, and
`portal-saved-sites.js`.

Every page in this folder should use the shared navigation and account controls.
Add these elements to a new page's `<head>` and `<body>`:

```html
<link rel="stylesheet" href="portal-nav.css">
<script src="portal-nav.js" defer></script>
```

```html
<header class="site-header" data-site-header></header>
```

The shared component keeps the navigation and logged-in account state consistent
across pages. The **Log in / Sign up** link opens `LOGIN_PAGE.html`, where both
account actions are available.

The shared **Temples** navigation link and the home page's **View all** link
open `sacred-sites.html`, which provides searchable and filterable results for
all places of worship.

After login, the shared navigation shows the user's profile photo (or an
initial if no photo is set); selecting it opens `profile.html`. The profile
page includes a **Log out** action. When signed out, navigation shows **Log in**.
Customers can save their name, phone number, email address, and profile photo
there. A profile photo can be taken with the camera or selected from the
gallery. Account settings also let customers change their password after
confirming their current password. Saved places are private to the account and
can be added from site cards or details. Temple cards and detail pages also
provide a three-dot menu to save a place to the wish list or share its link by
copying it, WhatsApp, or the device's available sharing options.
