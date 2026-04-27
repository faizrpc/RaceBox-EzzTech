# Testing: RaceBox EzzTech Dashboard

## Overview
The `dashboard/` directory contains a static web-based Performance Analytics Dashboard (HTML/CSS/JS). No build step or backend required.

## Local Setup
```bash
cd dashboard
python3 -m http.server 8080
```
Then open `http://localhost:8080` in Chrome.

## Quick Smoke Test
1. Click "Load Demo Data" — should populate 12 runs with stats, charts, and all 4 tabs
2. Verify Overview stats show numeric values (not `--`)
3. Scroll down to confirm both charts render (speed curve + bar chart)

## Key Test Flows

### CSV Import
- Create a test CSV with headers like `date,0-60,0-100,201m,402m,top speed,reaction time`
- The parser supports both Indonesian and English column names
- Upload via the drop zone or file input
- Total Runs count should increase by the number of valid rows

### Compare Runs
- Go to "Compare Runs" tab, select 2+ checkboxes, click "Compare Selected"
- Selecting <2 runs should show an alert: "Please select at least 2 runs to compare."
- Charts: Speed vs Time Overlay (line chart) + Acceleration Comparison (bar chart)
- Comparison Summary table appears below with Diff column

### Trends
- Metric dropdown switches chart (title updates to match)
- Tag filter dropdown filters to only runs with that tag
- Chart shows red data line + blue dashed 3-run moving average

### History
- Column headers are sortable (click toggles asc/desc, shows arrow indicator)
- Search box filters by date, tags, and source text
- Tag button (emoji icon) opens modal — enter comma-separated tags
- Tags can be removed by clicking × on the tag pill
- Delete button shows confirm dialog, removes the run
- Best values in each column are highlighted in green

### LocalStorage Persistence
- After loading data, reload the page (F5)
- Dashboard should auto-load with all data, tags, and run count preserved
- Data is stored in `localStorage` under keys `racebox_runs` and `racebox_runs_traces`

## Tips
- To start fresh, clear localStorage: open DevTools console and run `localStorage.clear(); location.reload();`
- The tag button icons are small — if clicking doesn't work via computer tool, use Playwright CDP (`http://localhost:29229`) to click `.tag-btn` elements programmatically
- Demo data generates 12 runs with tags cycling through: Stock/Sunny, Modified/Sunny, Stock/Rain, Modified/Premium fuel, Stock, Modified/Rain
- CSV-imported runs won't have GPS trace data, so "Latest Run" chart may show "No trace data available" if the most recent run is from CSV

## Devin Secrets Needed
None — the dashboard is a fully static app with no external dependencies or authentication.
