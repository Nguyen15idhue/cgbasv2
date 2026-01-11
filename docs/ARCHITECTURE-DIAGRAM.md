# Architecture Overview

## 📊 Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Window                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  index.html (SPA Shell)                 │ │
│  │  ┌──────────┐  ┌────────────────────┐  ┌────────────┐ │ │
│  │  │          │  │                    │  │            │ │ │
│  │  │ Sidebar  │  │   Main Content     │  │  Topbar    │ │ │
│  │  │          │  │                    │  │            │ │ │
│  │  │ - Home   │  │ ┌────────────────┐ │  │ - User     │ │ │
│  │  │ - Queue  │  │ │   Partial      │ │  │ - Logout   │ │ │
│  │  │ - Stations│ │ │   Content      │ │  │            │ │ │
│  │  │ - Devices│  │ │   (Dynamic)    │ │  │            │ │ │
│  │  │ - Logs   │  │ └────────────────┘ │  │            │ │ │
│  │  │ - Settings│ │                    │  │            │ │ │
│  │  │          │  │                    │  │            │ │ │
│  │  └──────────┘  └────────────────────┘  └────────────┘ │ │
│  │                                                         │ │
│  │  Load Once ✓    Load Dynamic ⟳        Load Once ✓    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Navigation Flow

```
User Click Menu
       │
       ▼
  router.js intercepts
       │
       ├─── Prevent default link behavior
       │
       ├─── Update URL (pushState)
       │
       ├─── Update active menu
       │
       ├─── Load page CSS (dynamic)
       │
       ├─── Fetch partial HTML (AJAX)
       │        │
       │        └─── /partials/dashboard.html
       │        └─── /partials/stations.html
       │        └─── etc...
       │
       ├─── Inject into #mainContent
       │
       └─── Load & execute page JS
                 │
                 └─── Initialize page functions
                 └─── Fetch API data
                 └─── Render content
```

## 📦 File Loading Strategy

### Initial Load (First Visit)
```
1. index.html ──────────────────┐
2. master.css (global)          │
3. Bootstrap CSS (CDN)          ├─ Load Once
4. FontAwesome CSS (CDN)        │
5. master.js (global)           │
6. router.js (navigation)       ┘
```

### Page Navigation (SPA)
```
User clicks /stations
       │
       ▼
1. stations.css ────────────┐
2. /partials/stations.html  ├─ Load Dynamic
3. stations.js              ┘
       │
       ▼
   Render in #mainContent
```

## 🎨 CSS Architecture

```
master.css (Global)
├── Layout (sidebar, topbar, main-content)
├── Typography
├── Colors
├── Utilities
└── Common components

dashboard.css (Page-specific)
├── .stat-card
├── .stat-icon
└── .stat-content

stations.css (Page-specific)
├── .table-stations
├── .filter-bar
└── .station-card

... (other page-specific CSS)
```

## 🎯 Benefits

| Traditional Multi-Page | SPA (Our Implementation) |
|------------------------|--------------------------|
| ❌ Full page reload | ✅ Content only reload |
| ❌ Duplicate HTML | ✅ Reusable components |
| ❌ Slow navigation | ✅ Fast navigation |
| ❌ No smooth transitions | ✅ Smooth UX |
| ✅ Simple structure | ⚠️ Requires router |

## 📝 Summary

- **1 HTML Shell** (index.html) with fixed layout
- **6 Partials** (dashboard, queue, stations, devices, logs, settings)
- **Dynamic CSS/JS** loading per page
- **No page reload** on navigation
- **Clean separation** of concerns (HTML/CSS/JS)
- **Easy maintenance** and scalability
