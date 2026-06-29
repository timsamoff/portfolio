
# Tim Samoff | Portfolio

A modern, single-page portfolio system with a lightweight JSON-based admin panel. Built for creatives who want full control over their work without a database.

- Live Portfolio: https://samoff.com/portfolio
- Demo Site: https://samoff.com/portfolio/demo
- Admin Panel (Demo): https://samoff.com/portfolio/demo/admin.html

---

## Overview

This portfolio system is designed for static site hosting (GitHub Pages, Netlify, etc.) while still providing a dynamic admin experience. All project data is stored in a single JSON file, making it easy to version control, deploy, and maintain.

### Features

- JSON-based data storage — no database required
- Multi-category support — assign multiple categories to each project
- Category management with custom shortcuts for cleaner URLs
- Admin panel with auto-save for adding, editing, deleting, and reordering projects
- Dark/light theme with system preference detection
- Social sharing with Open Graph previews for each project
- Media carousels for multiple images and videos per project
- Category filtering to organize work
- Rich text editor with formatting toolbar
- Demo mode using localStorage (no server needed)

---

## Setup

1. Clone the repository
2. Start the local server (required for the admin panel):
   node save-server.js
3. Open index.html in your browser to view the site, or _admin.html to manage projects.

---

## Project Structure

    portfolio/
    ├── index.html          # Main portfolio page
    ├── _admin.html         # Admin panel (underscore hides from GitHub Pages)
    ├── app.js              # Main site JavaScript
    ├── admin.js            # Admin panel JavaScript
    ├── style.css           # Global styles
    ├── projects.json       # Project data (auto-generated)
    ├── categories.json     # Category definitions with display names & shortcuts
    ├── share.html          # Social sharing redirect
    ├── save-server.js      # Local server for saving projects.json
    ├── media/              # Project images and videos
    └── demo/               # Demo site (localStorage version)
        ├── index.html
        ├── admin.html
        ├── demo-app.js
        ├── demo-admin.js
        ├── demo-data.js
        └── demo-override.css

---

## Data Format

Projects are stored in `projects.json` with this structure:

    {
      "title": "Project Name",
      "categories": ["category_identifier", "another_category"],
      "cardHeading": "Card Label",
      "media": ["media/image1.webp", "media/image2.webp"],
      "description": "Project description with <strong>HTML</strong> formatting.",
      "imageAlign": "center",
      "selected": true,
      "published": true
    }

### Categories

Categories are defined in `categories.json`:

    {
      "game_design_&_development": {
        "display": "Game Design & Development",
        "shortcut": "game"
      },
      "brand_&_identity": {
        "display": "Brand & Identity",
        "shortcut": "brand"
      }
    }

- Categories are stored as an array, allowing projects to appear in multiple filters
- Shortcuts provide clean, user-friendly URLs (e.g., `?filter=game` instead of the full category key)
- Uncategorized is the default for projects with no categories assigned

---

## Description Formatting

The description field supports HTML tags via the admin toolbar:

    <strong>text</strong> - Bold
    <em>text</em> - Italic
    <ul><li>item</li></ul> - Bulleted list
    <a href="url">text</a> - Link
    <award>text</award> - Award badge
    <live>text</live> - Live badge with pulsing dot
    <live href="url">text</live> - Clickable live badge

---

## Category Management

The admin panel includes a full category manager:

- Add categories: Create new categories with custom display names
- Set shortcuts: Define URL-friendly shortcuts (e.g., game for game_design_&_development)
- Delete categories: Removes the category from all projects automatically
- Multiple categories per project: Checkboxes in the admin form allow selecting multiple categories

Categories are stored in `categories.json` and managed through the admin interface.

---

## Demo Mode

The demo site (/demo/) mirrors the full system but uses localStorage instead of a server:

- No setup required — just open the page
- Fully functional admin panel with multi-category support
- Reset button to restore default data
- Perfect for testing before deployment

---

## Admin Security

To keep the admin panel private on GitHub Pages:

- Main Admin Panel is named `_admin.html` (files starting with _ are ignored by GitHub Pages)
- Access it locally at _admin.html
- The admin panel remains in your repository for version control

---

## License

GPL-3.0 License