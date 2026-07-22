# Global responsive backgrounds

This directory contains the local responsive global backgrounds for the Inazuma Roguelike app shell.

The assets are uploaded manually after the code commit and must use these exact names:

- `inazuma-background-mobile-light.jpeg` — mobile background used below 1024 px.
- `inazuma-background-desktop-light.jpeg` — desktop background used from 1024 px and above.

Do not rename, convert, version, or replace these files with different extensions without updating every CSS, JavaScript, and test reference that points to them.

Until the JPEG files are present, the app intentionally uses the built-in light blue fallback gradient so pages remain readable and functional without broken visual placeholders.
