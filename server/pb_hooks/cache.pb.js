/// <reference path="../pb_data/types.d.ts" />

// Cache headers for the web app, so phones pick up a new version right after an update.
// - /_expo/static/* files have a content hash in their name: cache them for a year.
// - Everything else of the web app (index.html, icons, manifest): always check with the server
//   first (a cheap "304 Not Modified" when nothing changed).
// The API (/api/) and the admin panel (/_/) are left alone.
routerUse((e) => {
  const path = e.request.url.path;
  if (path.startsWith("/_expo/static/")) {
    e.response.header().set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (!path.startsWith("/api/") && !path.startsWith("/_/")) {
    e.response.header().set("Cache-Control", "no-cache");
  }
  return e.next();
});
