# Tim Samoff | Portfolio

A modern, single-page portfolio system with a lightweight JSON-based admin panel. Built for creatives who want full control over their work without a database.

- **Live Portfolio:** [https://samoff.com/portfolio](https://samoff.com/portfolio)
- **Demo Site:** [https://samoff.com/portfolio/demo](https://samoff.com/portfolio/demo)
- **Admin Panel (Demo):** [https://samoff.com/portfolio/demo/admin.html](https://samoff.com/portfolio/demo/admin.html)

---

## Overview

This portfolio system is designed for static site hosting (GitHub Pages, Netlify, etc.) while still providing a dynamic admin experience. All project data is stored in a single JSON file, making it easy to version control, deploy, and maintain.

### Features

- JSON-based data storage — no database required
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
2. Start the local server (required for the admin panel)
3. Open `index.html` in your browser to view the site, or `admin.html` to manage projects.

---

## Project Structure

    portfolio/
    ├── index.html # Main portfolio page
    ├── _admin.html # Admin panel
    ├── app.js # Main site JavaScript
    ├── admin.js # Admin panel JavaScript
    ├── style.css # Global styles
    ├── projects.json # Project data (auto-generated)
    ├── share.html # Social sharing redirect
    ├── save-server.js # Local server for saving projects.json
    ├── media/ # Project images and videos
    └── demo/ # Demo site (localStorage version)

---

## Data Format

Projects are stored in `projects.json` with this structure:

    {
      "title": "Project Name",
      "category": "category_identifier",
      "cardHeading": "Card Label",
      "media": ["media/image1.webp", "media/image2.webp"],
      "description": "Project description with <strong>HTML</strong> formatting.",
      "imageAlign": "center",
      "published": true
    }


## Description Formatting

The description field supports HTML tags via the admin toolbar:

    <strong>text</strong> - Bold
    <em>text</em> - Italic
    <ul><li>item</li></ul> - Bulleted list
    <a href="url">text</a> - Link
    <award>text</award> - Award badge (🏆)
    <live>text</live> - Live badge with pulsing dot
    <live href="url">text</live> - Clickable live badge

## Demo Mode

The demo site (/demo/) mirrors the full system but uses localStorage instead of a server:

* No setup required - just open the page
* Fully functional admin panel
* Reset button to restore default data
* Perfect for testing before deployment

## Admin Security

To keep the admin panel private on GitHub Pages:

* Main Admin Panel is named _admin.html (files starting with _ are ignored by GitHub Pages)
* Access it locally at _admin.html
* The admin panel remains in your repository for version control

## License

GPL-3.0 License
