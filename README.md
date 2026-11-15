# AstroHealth

**NASA Space Apps Challenge 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions***

**▶ Live app: [astrohealth-wtfb.onrender.com](https://astrohealth-wtfb.onrender.com/)** · Mirror: [sernita-hub.github.io/astrohealth](https://sernita-hub.github.io/astrohealth/) · Source code: [github.com/Sernita-hub/astrohealth](https://github.com/Sernita-hub/astrohealth)

No account or sign-up needed: open the link and the demo mission loads.

AstroHealth is a visual health self-assessment tool for astronauts on long-duration missions. Crew members log their health indicators, instantly see what each value means in the space environment, and know what to do next: act on their own, alert the Crew Medical Officer, or send a report to the flight surgeon on Earth.

It is built to work offline, as it would aboard a spacecraft: no installation and no account needed. It is a **Progressive Web App (PWA)**: it can be installed like any other app on a phone, tablet or computer, and after the first visit it opens even with no connection, because a service worker keeps a copy of the app on the device. When there is a connection, every report to Earth is stored in a cloud database (**Supabase**) that plays the role of Mission Control. Without one, reports wait in an outbox and leave automatically when the link comes back (store-and-forward). The interface is available in **English and Spanish**: use the **EN / ES** switch in the top bar (English is the default, and each browser remembers its choice).

---

## How to run it

1. Open the **[live app](https://astrohealth-wtfb.onrender.com/)**, or download this repository and open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
   - **To install it as an app:** choose **Install** on the bar that appears at the top (Chrome, Edge and other Chromium browsers on Android, Windows, macOS and Linux), or go to **Mission settings → App**. On iPhone or iPad: in Safari, tap **Share → Add to Home Screen**. No app store is needed.
   - **To try it offline:** open the live app once with a connection, then turn on airplane mode and reload (or open the installed app). The app opens from its saved copy.
2. On first launch it opens with a **demo mission**: 30 days of simulated data from a transit to Mars. From the welcome card you can choose **Set up my own mission** to start from scratch.

Optionally, with a local server:

```bash
python -m http.server 5173
```

then open `http://localhost:5173`.

Logs are stored only in the browser (`localStorage`). Reports you transmit to Earth are also stored in Supabase under an anonymous ID for that browser: no sign-up is needed. From **Settings** you can export your data as JSON (copy), import it from a `.json` file, reload the demo or delete everything, including the reports stored in the cloud.

---

## How it addresses the challenge

| What the challenge asks for | How AstroHealth delivers it |
|---|---|
| A visual tool for astronauts to assess their own health | **Dashboard** with an AstroHealth score (0–100) and 12 color-coded indicator cards with 7-day sparklines |
| Collect health indicators through different inputs (keyboard, clicks, camera…) | Keyboard (numeric values), clicks (mood and stress pickers, symptom checklist) and **tap-to-measure pulse**: the astronaut taps the screen on every heartbeat and AstroHealth calculates the heart rate |
| Guidance on treatments and health improvements | Every out-of-range value shows **specific actions**, depending on whether it is high or low and whether it needs watching or is critical |
| When does a result need attention from the crew or flight surgeons? | Three levels, **Normal / Watch / Critical**, with clear escalation criteria and a **Report to Earth** button that stores the report in a real database, listed in the **Mission Control** view |
| A human figure with clickable body parts | **3D holographic body map** that you can rotate. It has 10 regions (brain, eyes, lungs, heart, blood and immunity, digestion, kidneys, bones, muscles, skin and radiation), and each organ glows in the color of its health status. Choosing a region zooms the camera in on it and shows what it does, how space affects it, the current data and what to do |
| Different environments (spacecraft, station, rover, base) | 5 environments with their own gravity, typical radiation, exercise goal and real **communication delay** (from real time on the ISS to up to ~20 min from Mars) |
| Prompt measurements as part of the mission routine | **Daily routine** with scheduled times and **reminders** when a task is overdue |
| Gamification | XP, levels and ranks, streaks, "perfect days" and 11 badges, plus an **XP growth chart** that shows the total XP day by day with a line at each level. Several astronauts can share a device: each **crew member** keeps their own logs, XP and level. A new crew member starts at level 1, and switching back continues where they left off (tap the astronaut's name at the top) |
| Dynamic charts | **Trends** over 7, 14 or 30 days with normal / watch / critical color bands, statistics and trend direction |
| Don't assume astronauts know how to assess their health | Every field has **How to measure** and **Why it matters in space**; the **Guide** explains the 5 hazards of human spaceflight |

### Indicators

Heart rate, blood pressure, oxygen saturation, body temperature, blood glucose, sleep, mood, stress, daily radiation dose, exercise, hydration, body mass, and 12 symptoms (headache, blurred vision as a possible sign of SANS, nausea, shortness of breath, chest pain, flank pain as a possible kidney stone, and more).

It also calculates two derived indicators:

- **Cumulative mission radiation** against NASA's career dose limit (600 mSv).
- **Estimated bone loss**, using a simplified model (~1–1.5% per month in microgravity, reduced by exercise).

It detects **multi-day trends** as well: accumulated sleep debt, persistently low mood and exercise below the weekly goal.

### Report to Earth

AstroHealth generates a text report for the flight surgeon (indicators, symptoms, alerts, exposure and notes) that can be copied or transmitted. **Transmitting** stores it in the Supabase database, and the animation shows the real one-way and round-trip delay for the current environment, followed by a simulated reply from the flight surgeon. It illustrates why, far from Earth, crews need to be able to assess themselves and act on their own.

The **Mission Control** view lists the reports received on Earth (date, astronaut, environment, mission day, score and status, with the full text), the reports still waiting in the outbox, and the state of the link.

### Cloud architecture and privacy

- **No registration.** Each browser signs in anonymously through Supabase Auth, so anyone (judges included) can try the full flow without creating an account.
- **Row Level Security.** Database rules let each anonymous device read, add and delete only its own reports. Without a session, the table cannot be read at all. See [`supabase/schema.sql`](supabase/schema.sql).
- **Store-and-forward.** Reports are queued on board and sent when the connection returns. This is how deep-space communication works too.
- **Limits.** Field lengths and values are checked by the database, and each device can store up to 200 reports.
- **The key in `js/cloud.js` is public by design.** It is Supabase's *publishable* key: it only allows what the database rules above permit.
- **Demo data only.** AstroHealth is a prototype, not a medical system. Use fictional or demo data.

To use your own Supabase project: run `supabase/schema.sql` in its SQL editor, turn on **Authentication → Sign In / Providers → Allow anonymous sign-ins**, and put the project URL and publishable key in `js/cloud.js`. With an empty URL or key, the app runs fully offline and the link is simulated.

---

## Resources used

**Challenge resources**
- NASA HRP, [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/): structure of the Guide and the hazard tags on every indicator (radiation, isolation and confinement, distance from Earth, gravity fields, hostile and closed environments).
- NASA HRP, [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/): the health risks covered by the body map (immune system, cardiovascular, SANS, bone, nutrition, sleep, radiation).
- NASA HRP, [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/): background.
- Canadian Space Agency, [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) and [Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp): background.

### Sources for the figures

Every number in `js/data.js` was checked against the source below. Where there is no measured data yet, the table says so.

| Figure in AstroHealth | Source |
|---|---|
| Career radiation limit: 600 mSv | NASA, [NASA-STD-3001 technical brief: Radiation Protection](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) |
| Mars transit: 1.8 mSv/day | NASA JPL, [Data From NASA Rover's Voyage to Mars Aids Planning](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) (Curiosity RAD) |
| Mars surface: 0.64 mSv/day | Hassler et al., [*Science* 343 (2014)](https://doi.org/10.1126/science.1244797) (Curiosity RAD). NASA, [Radiation Measurements on Mars](https://science.nasa.gov/resource/radiation-measurements-on-mars/) |
| Lunar base and rover: 1.37 mSv/day | Zhang et al., [*Science Advances* 6 (2020)](https://doi.org/10.1126/sciadv.aaz1334) (Chang'E 4 lander, lunar surface). Both lunar environments use this surface value. |
| Space station: 0.5 mSv/day | NASA, [Space Faring: The Radiation Challenge](https://www.nasa.gov/wp-content/uploads/2017/04/radiationchallenge.pdf) (about 80 mSv per 6-month stay, more at solar minimum) |
| Bone loss: 1–1.5% per month; kidney stones; fluid shift and vision; immune changes | NASA, [The Human Body in Space](https://www.nasa.gov/humans-in-space/the-human-body-in-space/) |
| Communication delay from Mars: up to ~20 min one way, average ~12.5 min | NASA HRP, [Hazard: Distance From Earth](https://www.nasa.gov/hrp/hazard-distance-from-earth/) (up to 20 min; Mars is 140 million miles away on average, which light covers in about 12.5 min) |
| About 2 hours of exercise per day on the ISS | NASA, [Counteracting Bone and Muscle Loss in Microgravity](https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/) |
| Height can increase up to 3% (back pain) | NASA, [Risk of Spaceflight-Induced Bone Changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/) |
| SANS: optic nerve swelling and flattening of the eye | NASA, [Risk of Spaceflight Associated Neuro-ocular Syndrome](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/) |
| The heart becomes rounder in microgravity | NASA, [Cardiovascular Health in Microgravity](https://www.nasa.gov/missions/station/cardiovascular-health-in-microgravity/) |
| ISS crews sleep about 6 hours on average | NASA HRP, [Evidence Report: Risk of Performance Decrements and Adverse Health Outcomes from Sleep Loss](https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf) |
| 16 sunrises a day on the ISS | NASA, [Spot the Station FAQ](https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/) |
| High cabin CO₂ causes headaches | NASA, [NASA-STD-3001 technical brief: Carbon Dioxide](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) |
| "Space anemia": 54% more red blood cells destroyed | Canadian Space Agency, [MARROW: Keeping blood healthy in space](https://www.asc-csa.gc.ca/eng/sciences/marrow.asp) |
| Core body temperature rises about 1 °C on long missions | Stahn et al., [*Scientific Reports* 7 (2017)](https://doi.org/10.1038/s41598-017-15560-w) |
| Blood pressure: normal below 120/80 mmHg | American Heart Association, [Understanding Blood Pressure Readings](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings) |
| Fasting glucose: normal 99 mg/dL or below | CDC, [Diabetes Testing](https://www.cdc.gov/diabetes/diabetes-testing/index.html) |

**AstroHealth assumptions (no measured data yet):** bone loss and exercise goals for the Moon and Mars (scaled from the ISS values), the dose that triggers a radiation alert, the ±2% / ±5% body-mass thresholds, and the general clinical ranges for heart rate, temperature, oxygen saturation and sleep. They are educational choices, not medical criteria.

---

## Technology

- Plain HTML, CSS and JavaScript with **no libraries or build step**: it works offline.
- **Installable app (PWA)**: a web app manifest (name, icon, colors and shortcuts to Log, Body and Mission Control) and an in-app **Install** bar that uses the browser's own install dialog.
- **Offline copy** with a service worker (`sw.js`). It works network first: when there is a connection, the newest version is used and saved; with no connection, or a link slower than 4 seconds, the saved copy is used. Reports to Supabase are never cached: they wait in the app's outbox instead.
- Custom `<canvas>` charts and SVG icons.
- A **3D hologram of the human body** drawn by a small software 3D engine on `<canvas>`, with no WebGL library. The figure is anatomical and built procedurally: face, ears, chest, shoulder blades, glutes, muscle shapes, hands with fingers and feet. It uses rim lighting, a translucent volume, an orbit camera that flies to each organ, a heartbeat and blood flow. It respects the "reduce motion" setting.
- Local persistence with `localStorage`.
- **Supabase** (Postgres, anonymous Auth and Row Level Security) for the reports to Earth, used through its REST API with plain `fetch`, with no SDK.
- Hosted as a static site on **Render** and **GitHub Pages**. Both deploy automatically from the `main` branch.
- Responsive layout for desktop, tablet and phone. Keyboard accessible.

```
index.html          App structure
sw.js               Service worker: offline copy of the app
manifest.webmanifest  Web app manifest (name, colors, icon)
icons/icon.svg      App icon (the logo, drawn as SVG code)
css/styles.css      Styles (dark mission-control theme)
js/data.js          Indicators, ranges, environments, hazards, body regions, routine and badges (English content)
js/logic.js         Assessment, alerts, trends, gamification, demo data and report
js/i18n.js          Spanish content pack and the EN/ES language switch
js/charts.js        Line charts and sparklines
js/icons.js         SVG icons and logo
js/holo.js          3D hologram body: procedural figure, organs, camera and zoom
js/cloud.js         Link to Mission Control: Supabase connection, anonymous session and report storage
js/app.js           User interface and views
supabase/schema.sql Database table, security rules and limits
```

To adjust a range or a recommendation, or to add an indicator, edit `js/data.js` (and its Spanish text in `js/i18n.js`). Interface strings are written in `js/app.js` as `tx('English', 'Español')` pairs.

---

## Limitations and next steps

- Ranges and models are **approximate**. AstroHealth is not a medical device.
- The flight surgeon's reply is still simulated. A real flight-surgeon console that reads the reports would need staff accounts and stricter access rules.
- Anonymous sign-ins are rate-limited by Supabase but have no CAPTCHA. A public deployment should add one.
- Pulse measurement with the **camera** (fingertip photoplethysmography).
- Integration with real sensors (oximeter, blood pressure cuff, actigraph) over Bluetooth.
- A Crew Medical Officer view showing the status of the whole crew.
- Light theme and more languages.

---

## Use of Super Intelligence (SI)

*Super Intelligence (SI) is the term NASA Space Apps 2026 uses for what is commonly called AI.*

AstroHealth was built with one SI tool: **Claude (Anthropic)**, an AI assistant used through Claude Code.

**What the team did**

- Chose the challenge and the approach: a self-assessment app that works offline, in plain HTML, CSS and JavaScript.
- Named the product **AstroHealth**, kept the logo and set the language requirements: English for the judges, with a Spanish option.
- Directed the work by asking for each change.

**What was generated with SI**

| Part of the project | What the SI tool did |
|---|---|
| Code | Wrote the HTML, CSS and JavaScript in this repository, including the canvas charts, the SVG icons, the logo, the 3D hologram body and its rendering engine, the Supabase connection and the database schema (`supabase/schema.sql`). |
| Cloud setup | Created the Supabase project and the Render and GitHub Pages deployments at the team's request. |
| Data | Wrote the reference ranges and recommendations in `js/data.js` as educational approximations, checked each figure against the sources listed in "Sources for the figures", and generated the 30-day **simulated** demo mission. No real astronaut data is used. |
| Text | Wrote the interface text, the health guidance, the Spanish translation and this README. |
| Design | Proposed the feature set and the screen layout, following the requirements listed in the challenge description. |

**Not generated with SI:** the project contains no SI-generated images, video or audio, and it uses no NASA logos, flags or other NASA branding.

**How SI content is marked:** every source file (`index.html`, `sw.js`, `icons/icon.svg`, `css/styles.css` and `js/*.js`) starts with an SI notice, the web app manifest mentions it in its description, and `index.html` also declares it in a `generator` meta tag.

## Team

- Laura Sofia Orozco Acevedo
- Hannah Isabella Nieto Pérez
- Samuel Serna Monsalve
- Isabella Torres Calderon
- Jose Daniel Barbosa Orozco

---

*AstroHealth is an educational prototype. It does not replace evaluation by a flight surgeon or a health professional.*
