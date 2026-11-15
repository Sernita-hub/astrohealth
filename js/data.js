/* =========================================================================
   AstroHealth · Reference data
   Health indicators, mission environments, spaceflight hazards,
   body regions, symptoms and daily routine.
   Ranges are approximate and for educational purposes (not a medical device).
   Sources for each figure: README, "Sources for the figures".
   SI notice: code and reference data generated with Claude (Anthropic),
   a Super Intelligence (SI) tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
window.AH = window.AH || {};

/* -------------------------------------------------------------------------
   Mission environments
   gravity: fraction of Earth's gravity
   radBaseline: typical daily dose (mSv/day)
   delaySec: one-way communication delay with Earth (s)
   exerciseTarget: recommended daily exercise minutes
   boneRate: estimated monthly bone loss without countermeasures (%/month)
   Measured references: ISS ~0.44–0.5 mSv/day (NASA), Moon surface 1.37 mSv/day
   (Chang'E 4, Zhang et al. 2020), Mars cruise 1.8 mSv/day and Mars surface
   0.64 mSv/day (Curiosity RAD, NASA/JPL; Hassler et al. 2014), ISS exercise
   ~2 h/day and bone loss 1–1.5%/month (NASA). Exercise targets and bone rates
   for the Moon and Mars are AstroHealth assumptions: there is no measured data yet.
   ------------------------------------------------------------------------- */
AH.ENVIRONMENTS = {
  iss: {
    id: 'iss',
    name: 'Space station in low Earth orbit',
    short: 'Low Earth orbit (ISS)',
    gravity: 0,
    gravityLabel: 'Microgravity (~0 g)',
    radBaseline: 0.5,
    delaySec: 0,
    delayLabel: 'Real time',
    exerciseTarget: 120,
    boneRate: 1.5,
    note: 'Earth is 400 km away: near-instant communication, and a return home is possible within hours.'
  },
  lunar: {
    id: 'lunar',
    name: 'Lunar surface base',
    short: 'Lunar base',
    gravity: 0.166,
    gravityLabel: 'Lunar gravity (0.17 g)',
    radBaseline: 1.37,
    delaySec: 1.3,
    delayLabel: '1.3 s',
    exerciseTarget: 90,
    boneRate: 1.25,
    note: 'No atmosphere or magnetic field: surface radiation is high and lunar dust is abrasive.'
  },
  rover: {
    id: 'rover',
    name: 'Pressurized rover (lunar exploration)',
    short: 'Lunar rover',
    gravity: 0.166,
    gravityLabel: 'Lunar gravity (0.17 g)',
    radBaseline: 1.37,
    delaySec: 1.3,
    delayLabel: '1.3 s',
    exerciseTarget: 60,
    boneRate: 1.25,
    note: 'Very tight quarters for days at a time: confinement, sleep and air quality are key.'
  },
  transit: {
    id: 'transit',
    name: 'Spacecraft in transit to Mars',
    short: 'Mars transit',
    gravity: 0,
    gravityLabel: 'Microgravity (~0 g)',
    radBaseline: 1.8,
    delaySec: 600,
    delayLabel: '~10 min',
    exerciseTarget: 120,
    boneRate: 1.5,
    note: 'Months of travel with no quick way home: the crew must be self-reliant.'
  },
  mars: {
    id: 'mars',
    name: 'Mars surface base',
    short: 'Mars base',
    gravity: 0.38,
    gravityLabel: 'Martian gravity (0.38 g)',
    radBaseline: 0.64,
    delaySec: 750,
    delayLabel: 'Up to ~20 min (average ~12.5 min)',
    exerciseTarget: 90,
    boneRate: 0.93,
    note: "Mars' thin atmosphere offers little protection, and messages to Earth take up to about 20 minutes one way."
  }
};

/* NASA career dose limit (2022 standard) */
AH.CAREER_DOSE_LIMIT = 600; // mSv

/* -------------------------------------------------------------------------
   Helper: evaluate a value against ranges
   Inside [okMin, okMax] = ok; inside [watchMin, watchMax] = watch; else critical.
   Returns { level: 'ok'|'watch'|'crit', dir: 'low'|'high'|null }
   ------------------------------------------------------------------------- */
function rangeStatus(v, okMin, okMax, watchMin, watchMax) {
  if (v >= okMin && v <= okMax) return { level: 'ok', dir: null };
  const dir = v < okMin ? 'low' : 'high';
  if (v >= watchMin && v <= watchMax) return { level: 'watch', dir };
  return { level: 'crit', dir };
}

/* -------------------------------------------------------------------------
   Health indicators
   agg: how a day is aggregated ('avg' = average, 'last' = last value = day total)
   staleHours: after how many hours a value is no longer considered current
   region: related body region
   hazards: related RIDGE hazards
   ------------------------------------------------------------------------- */
AH.INDICATORS = {
  hr: {
    id: 'hr', name: 'Heart rate', short: 'HR', unit: 'bpm', icon: 'heart',
    min: 20, max: 250, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 1,
    region: 'heart', hazards: ['G', 'R'], group: 'vitals',
    rangeText: '50–100 bpm at rest',
    status: (v) => rangeStatus(v, 50, 100, 40, 120),
    how: 'Measure at rest, after 5 minutes without activity, with the pulse oximeter or the wristband. No device? Count your beats at the wrist for 30 s and multiply by 2, or use the "Tap to measure" tool.',
    why: "Microgravity reduces the heart's workload. Over time it can lose mass, and back in a gravity field astronauts may feel dizzy when standing up (orthostatic intolerance).",
    actions: {
      watch_high: ['Repeat the measurement after 5 minutes of rest.', 'Hydrate and avoid caffeine.', 'Check for fever, stress or lack of sleep.'],
      watch_low: ['Repeat the measurement at rest.', 'If you feel dizzy or weak, tell the Crew Medical Officer (CMO).'],
      crit: ['Stop all physical activity and repeat the measurement.', 'Alert the Crew Medical Officer (CMO).', 'Send a report to the flight surgeon on Earth.']
    }
  },
  sys: {
    id: 'sys', name: 'Systolic pressure', short: 'SBP', unit: 'mmHg', icon: 'gauge',
    min: 50, max: 260, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 0.5,
    region: 'heart', hazards: ['G', 'R', 'I'], group: 'vitals', pairOf: 'bp',
    rangeText: '90–119 mmHg',
    status: (v) => rangeStatus(v, 90, 119, 80, 159), // AHA: normal < 120/80
    how: "Use the automatic cuff on your arm, at heart level, after 5 minutes of rest. Anchor your feet so you don't float, and don't talk during the reading. Systolic is the higher number.",
    why: 'The headward fluid shift changes blood pressure, and stress and radiation may raise long-term cardiovascular risk.',
    actions: {
      watch_high: ['Repeat in 10 minutes, relaxed, with your arm at heart level.', 'Cut back on salt and caffeine and keep an eye on it over the next few days.'],
      watch_low: ['If you feel dizzy when changing posture, sit or anchor yourself and drink fluids.', 'Repeat the measurement in 10 minutes.'],
      crit_high: ['Repeat the measurement. If it persists, rest and alert the CMO.', 'Severe headache, chest pain or vision changes mean a medical emergency.', 'Send a report to the flight surgeon.'],
      crit_low: ['Lie down or anchor yourself and drink fluids with electrolytes.', 'Alert the CMO and send a report to the flight surgeon.']
    }
  },
  dia: {
    id: 'dia', name: 'Diastolic pressure', short: 'DBP', unit: 'mmHg', icon: 'gauge',
    min: 30, max: 160, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 0.5,
    region: 'heart', hazards: ['G', 'R', 'I'], group: 'vitals', pairOf: 'bp',
    rangeText: '60–79 mmHg',
    status: (v) => rangeStatus(v, 60, 79, 50, 99), // AHA: normal < 80
    how: 'Taken in the same reading as systolic pressure: it is the lower number.',
    why: 'The headward fluid shift changes blood pressure, and stress and radiation may raise long-term cardiovascular risk.',
    actions: {
      watch_high: ['Repeat in 10 minutes, relaxed.', 'Cut back on salt and caffeine and keep an eye on it over the next few days.'],
      watch_low: ['Drink fluids and avoid sudden changes in posture.'],
      crit_high: ['Repeat the measurement. If it persists, rest and alert the CMO.', 'Send a report to the flight surgeon.'],
      crit_low: ['Lie down or anchor yourself and drink fluids with electrolytes.', 'Alert the CMO.']
    }
  },
  glucose: {
    id: 'glucose', name: 'Blood glucose', short: 'Glucose', unit: 'mg/dL', icon: 'drop',
    min: 20, max: 600, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 0.7,
    region: 'gut', hazards: ['G', 'E'], group: 'vitals',
    rangeText: '70–99 mg/dL (fasting)',
    status: (v) => rangeStatus(v, 70, 99, 54, 180), // CDC: fasting normal ≤ 99, prediabetes 100–125
    how: 'With the glucometer: clean your finger, prick the side of the fingertip and place the drop on the strip. Ideally fasting, right after waking up.',
    why: 'Muscle inactivity, stress and diet changes during flight can reduce insulin sensitivity.',
    actions: {
      watch_high: ['Review your last meal and repeat the fasting measurement tomorrow.', 'Keep your exercise session: it helps regulate glucose.'],
      watch_low: ['Take 15 g of fast-acting carbohydrates and recheck in 15 minutes.'],
      crit_high: ['Repeat the measurement. If it persists, alert the CMO.', 'Drink water and watch for intense thirst or confusion.', 'Send a report to the flight surgeon.'],
      crit_low: ['Take 15–20 g of fast-acting carbohydrates now and recheck in 15 minutes.', "Tell a crewmate: don't stay alone.", 'Notify the CMO.']
    }
  },
  temp: {
    id: 'temp', name: 'Body temperature', short: 'Temp.', unit: '°C', icon: 'thermo',
    min: 30, max: 43, step: 0.1, decimals: 1, agg: 'avg', staleHours: 36, weight: 1,
    region: 'blood', hazards: ['E', 'G'], group: 'vitals',
    rangeText: '36.1–37.5 °C',
    status: (v) => rangeStatus(v, 36.1, 37.5, 35.5, 38.4),
    how: 'Digital thermometer under the tongue or on the forehead. On long missions core temperature tends to rise by about 1 °C, so watch for changes from your own baseline.',
    why: 'Without natural convection the body sheds heat less efficiently. With an altered immune system, a fever may signal an infection.',
    actions: {
      watch_high: ['Hydrate, rest and recheck in 1 hour.', 'Look for signs of infection (sore throat, cough, malaise).'],
      watch_low: ['Put on warmer clothing and check the cabin temperature.'],
      crit_high: ['Fever: rest, hydrate and alert the CMO.', 'Consider isolating from the rest of the crew until you are evaluated.', 'Send a report to the flight surgeon.'],
      crit_low: ['Possible hypothermia: warm up and alert the CMO.', 'Check the habitat thermal control system.']
    }
  },
  spo2: {
    id: 'spo2', name: 'Oxygen saturation', short: 'SpO₂', unit: '%', icon: 'wind',
    min: 50, max: 100, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 1,
    region: 'lungs', hazards: ['E'], group: 'vitals',
    rangeText: '95–100%',
    status: (v) => rangeStatus(v, 95, 100, 92, 100),
    how: 'Place the oximeter on a clean, warm finger, stay still and wait for the reading to stabilize (about 30 s).',
    why: 'It depends on the cabin atmosphere and on your lungs. A low value may point to a life-support failure or a respiratory illness.',
    actions: {
      watch: ['Breathe slowly and deeply and repeat with a warm finger.', 'Check cabin O₂ and CO₂ levels.'],
      crit: ['Use an oxygen mask if one is available.', 'Alert the crew: this may be a life-support problem.', 'Contact the flight surgeon immediately.']
    }
  },
  sleep: {
    id: 'sleep', name: 'Sleep', short: 'Sleep', unit: 'h', icon: 'moon',
    min: 0, max: 24, step: 0.25, decimals: 1, agg: 'last', staleHours: 36, weight: 1,
    region: 'brain', hazards: ['I', 'E'], group: 'wellbeing',
    rangeText: '7–9 h',
    status: (v) => rangeStatus(v, 7, 9.5, 5.5, 10.5),
    how: 'Total hours slept in your last rest period. If you wear an actigraph (sleep watch), use its value. Otherwise, estimate from when you fell asleep to when you woke up.',
    why: 'Artificial light, 16 sunrises a day in orbit, noise and stress all cut sleep short: ISS crews average about 6 hours.',
    actions: {
      watch_low: ['Schedule your next rest period with an 8-hour sleep opportunity.', 'Avoid screens for 1 hour before bed, and use an eye mask and earplugs.', 'Switch the cabin lighting to pre-sleep mode.'],
      watch_high: ['Sleeping much more than usual can signal fatigue or illness, so watch for other symptoms.'],
      crit_low: ['Risk of operational errors: tell the commander so critical tasks can be adjusted.', 'Talk to the CMO about sleep support.'],
      crit_high: ['Excessive sleepiness: check for fever or other symptoms and alert the CMO.']
    }
  },
  mood: {
    id: 'mood', name: 'Mood', short: 'Mood', unit: '/5', icon: 'smile',
    min: 1, max: 5, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 1,
    region: 'brain', hazards: ['I', 'D'], group: 'wellbeing',
    rangeText: '4–5 (good or excellent)',
    status: (v) => (v >= 4 ? { level: 'ok', dir: null } : v >= 3 ? { level: 'watch', dir: 'low' } : { level: 'crit', dir: 'low' }),
    how: 'How do you feel today overall? 1 = very bad, 5 = excellent. Be honest: the goal is to catch changes early.',
    why: 'Long periods of isolation and confinement can bring irritability, low mood, trouble concentrating and team conflict.',
    actions: {
      watch: ['Take a guided breathing break (Routine tab).', 'Schedule a call with family or friends.', 'Share how you feel with a crewmate you trust.'],
      crit: ["Don't face it alone: talk to the CMO or the psychological support team on Earth.", 'Send a confidential report to the flight surgeon.']
    }
  },
  stress: {
    id: 'stress', name: 'Stress level', short: 'Stress', unit: '/5', icon: 'zap',
    min: 1, max: 5, step: 1, decimals: 0, agg: 'avg', staleHours: 36, weight: 0.7,
    region: 'brain', hazards: ['I', 'D'], group: 'wellbeing',
    rangeText: '1–2 (low)',
    status: (v) => (v <= 2 ? { level: 'ok', dir: null } : v <= 4 ? { level: 'watch', dir: 'high' } : { level: 'crit', dir: 'high' }),
    how: 'Perceived stress today. 1 = very calm, 5 = extreme.',
    why: 'Heavy workloads, little privacy and distance from home raise stress, which affects sleep, immunity and decision-making.',
    actions: {
      watch: ['Check with the commander whether tasks can be redistributed.', 'Set aside personal time: music, the window, reading.', 'Take a 1-minute guided breathing break.'],
      crit: ['Stop and take a breathing break.', 'Talk to the CMO or the psychological support team.']
    }
  },
  radiation: {
    id: 'radiation', name: 'Daily radiation dose', short: 'Radiation', unit: 'mSv', icon: 'radiation',
    min: 0, max: 1000, step: 0.01, decimals: 2, agg: 'last', staleHours: 36, weight: 0.8,
    region: 'skin', hazards: ['R'], group: 'environment',
    rangeText: (env) => `≤ ${AH.fmtNum(Math.max(2, env.radBaseline * 1.5), 1)} mSv/day in this environment`,
    status: (v, ctx) => {
      const okMax = Math.max(2, ctx.env.radBaseline * 1.5);
      if (v <= okMax) return { level: 'ok', dir: null };
      if (v <= 10) return { level: 'watch', dir: 'high' };
      return { level: 'crit', dir: 'high' };
    },
    how: "Read the day's accumulated dose (mSv) on your personal dosimeter. During a solar storm alert, check it every hour.",
    why: "Outside Earth's atmosphere and magnetic field the daily dose can be hundreds of times higher than on Earth (~0.01 mSv/day). A solar particle event can multiply it within hours.",
    actions: {
      watch: ['Check the space weather forecast.', 'Postpone spacewalks.', 'Spend more time in the most shielded areas of the habitat.'],
      crit: ['Likely solar particle event: go to the storm shelter.', 'Notify the crew and Mission Control.', 'Log your dose every hour until the event ends.']
    }
  },
  exercise: {
    id: 'exercise', name: 'Exercise', short: 'Exercise', unit: 'min', icon: 'dumbbell',
    min: 0, max: 600, step: 5, decimals: 0, agg: 'last', staleHours: 36, weight: 0.8,
    region: 'muscles', hazards: ['G'], group: 'environment',
    rangeText: (env) => `≥ ${env.exerciseTarget} min/day in this environment`,
    status: (v, ctx) => {
      const t = ctx.env.exerciseTarget;
      if (v >= t) return { level: 'ok', dir: null };
      if (v >= t * 0.5) return { level: 'watch', dir: 'low' };
      return { level: 'crit', dir: 'low' };
    },
    how: "Today's exercise minutes: harnessed treadmill, cycle ergometer and resistance device. Log the day's total.",
    why: 'Daily exercise is the main countermeasure against bone and muscle loss and cardiovascular deconditioning.',
    actions: {
      watch: ['Finish your pending session, combining resistance and cardio.', "Bone and muscle are lost quickly without load, so don't skip two days in a row."],
      crit: ['Almost no exercise today: reschedule the session with the commander.', 'Prioritize resistance exercises for the legs and spine.']
    }
  },
  water: {
    id: 'water', name: 'Hydration', short: 'Water', unit: 'L', icon: 'glass',
    min: 0, max: 10, step: 0.1, decimals: 1, agg: 'last', staleHours: 36, weight: 0.6,
    region: 'kidneys', hazards: ['G', 'E'], group: 'environment',
    rangeText: '≥ 2.0 L/day',
    status: (v) => (v >= 2 ? { level: 'ok', dir: null } : v >= 1.5 ? { level: 'watch', dir: 'low' } : { level: 'crit', dir: 'low' }),
    how: "Liters of fluid you drank today (water and rehydrated drinks). Log the day's total.",
    why: 'Dehydration raises the risk of kidney stones, which is already higher in space because bones release more calcium.',
    actions: {
      watch: ['Drink a glass of water now and set reminders.'],
      crit: ['Drink at least 0.5 L within the next hour.', 'Dehydration raises the risk of kidney stones, so report any flank pain.']
    }
  },
  mass: {
    id: 'mass', name: 'Body mass', short: 'Mass', unit: 'kg', icon: 'scale',
    min: 30, max: 200, step: 0.1, decimals: 1, agg: 'avg', staleHours: 240, weight: 0.5,
    region: 'gut', hazards: ['G', 'D'], group: 'environment',
    rangeText: (env, profile) => (profile && profile.baselineMass ? `±2% of your baseline (${AH.fmtNum(profile.baselineMass, 1)} kg)` : 'Set your baseline mass in Settings'),
    status: (v, ctx) => {
      const base = ctx.profile && ctx.profile.baselineMass;
      if (!base) return { level: 'ok', dir: null };
      const pct = ((v - base) / base) * 100;
      const dir = pct < 0 ? 'low' : 'high';
      if (Math.abs(pct) <= 2) return { level: 'ok', dir: null };
      if (Math.abs(pct) <= 5) return { level: 'watch', dir };
      return { level: 'crit', dir };
    },
    how: 'There are no scales in microgravity: a device measures mass using linear acceleration. Measure once a week, at the same time, before eating.',
    why: 'Weight loss is common on long missions because of reduced appetite and changes in taste. NASA counts inadequate food and nutrition among the risks of spaceflight.',
    actions: {
      watch_low: ['Eat more: add an extra snack each day.', 'Try more flavorful foods (taste is dulled in space).'],
      crit_low: ['Significant loss: review your nutrition plan with the flight surgeon.'],
      watch_high: ['Review your food intake and activity level.'],
      crit_high: ['Consult the nutrition team on Earth.']
    }
  }
};

/* Display order (blood pressure is shown as one combined card) */
AH.CARD_ORDER = ['hr', 'bp', 'spo2', 'temp', 'glucose', 'sleep', 'mood', 'stress', 'radiation', 'exercise', 'water', 'mass'];
AH.TREND_ORDER = AH.CARD_ORDER;

/* -------------------------------------------------------------------------
   Symptoms (click input)
   ------------------------------------------------------------------------- */
AH.SYMPTOMS = {
  headache: { id: 'headache', name: 'Headache', level: 'watch', regions: ['brain', 'eyes'],
    advice: 'It may be caused by the headward fluid shift or high cabin CO₂. Check CO₂ levels and hydrate.' },
  vision: { id: 'vision', name: 'Blurred vision', level: 'watch', regions: ['eyes'],
    advice: 'It may be a sign of spaceflight-associated neuro-ocular syndrome (SANS). Do the near-vision test and tell the flight surgeon.' },
  nausea: { id: 'nausea', name: 'Nausea or dizziness', level: 'watch', regions: ['gut'],
    advice: 'Common in the first days (space motion sickness). Keep your head still, fix your gaze and sip fluids.' },
  congestion: { id: 'congestion', name: 'Nasal congestion', level: 'watch', regions: ['lungs'],
    advice: 'Common because fluids shift toward the head. It affects taste and appetite.' },
  breath: { id: 'breath', name: 'Shortness of breath', level: 'crit', regions: ['lungs', 'heart'],
    advice: 'Measure your SpO₂, check the cabin atmosphere and alert the crew.' },
  chest: { id: 'chest', name: 'Chest pain', level: 'crit', regions: ['heart'],
    advice: 'Stop all activity and start the medical emergency protocol with the CMO.' },
  back: { id: 'back', name: 'Back pain', level: 'watch', regions: ['bones'],
    advice: 'Without gravity the spine lengthens, and astronauts can grow up to 3% taller. Stretching in a fetal position often helps.' },
  fatigue: { id: 'fatigue', name: 'Unusual fatigue', level: 'watch', regions: ['blood', 'brain'],
    advice: 'Check your sleep, temperature and hydration. "Space anemia" can also cause tiredness.' },
  insomnia: { id: 'insomnia', name: 'Trouble sleeping', level: 'watch', regions: ['brain'],
    advice: 'Adjust the lighting, avoid screens before bed and keep a fixed schedule.' },
  anxiety: { id: 'anxiety', name: 'Persistent anxiety or sadness', level: 'watch', regions: ['brain'],
    advice: 'Talk to someone you trust and to the psychological support team.' },
  flank: { id: 'flank', name: 'Flank pain or pain when urinating', level: 'crit', regions: ['kidneys'],
    advice: 'Possible kidney stone (the risk is higher in space). Drink fluids and alert the CMO.' },
  skin: { id: 'skin', name: 'Skin irritation or wound', level: 'watch', regions: ['skin'],
    advice: 'Clean and cover it and watch for signs of infection: the immune system changes in flight.' }
};

/* -------------------------------------------------------------------------
   The 5 hazards of human spaceflight (NASA Human Research Program) — RIDGE
   ------------------------------------------------------------------------- */
AH.HAZARDS = {
  R: {
    id: 'R', name: 'Space radiation', icon: 'radiation',
    text: "Outside the protection of Earth's atmosphere and magnetic field, astronauts are exposed to high-energy particles: galactic cosmic rays and solar particle events.",
    effects: 'Higher long-term cancer risk, damage to the central nervous system, cataracts and cardiovascular disease. An intense solar storm can cause acute symptoms.',
    counter: 'A personal dosimeter, a shielded storm shelter during solar events, and planning activities around space weather.',
    indicators: ['radiation']
  },
  I: {
    id: 'I', name: 'Isolation and confinement', icon: 'smile',
    text: 'Months in a small space, with little privacy, strict routines and far from family.',
    effects: 'Disrupted sleep and mood, stress, lower cognitive performance and tension within the team.',
    counter: 'Regular sleep schedules, proper lighting, contact with loved ones, exercise and mood check-ins.',
    indicators: ['mood', 'stress', 'sleep']
  },
  D: {
    id: 'D', name: 'Distance from Earth', icon: 'signal',
    text: 'Far from Earth there is no quick evacuation. From Mars, a message can take up to about 20 minutes to arrive, one way.',
    effects: 'The crew must detect, diagnose and treat problems on their own, with limited medical supplies.',
    counter: 'Self-assessment tools like AstroHealth, clear protocols, medical training and criteria for escalating to the flight surgeon.',
    indicators: ['mood', 'mass']
  },
  G: {
    id: 'G', name: 'Gravity fields', icon: 'orbit',
    text: 'In microgravity fluids shift toward the head and the body stops bearing weight. Moving from one gravity field to another is also a challenge.',
    effects: 'Loss of about 1–1.5% of bone density per month, muscle atrophy, cardiovascular deconditioning, spaceflight-associated neuro-ocular syndrome (SANS) and balance problems after landing.',
    counter: 'About 2 hours of daily resistance and cardio exercise, nutrition with calcium and vitamin D, and hydration.',
    indicators: ['exercise', 'hr', 'sys', 'mass']
  },
  E: {
    id: 'E', name: 'Hostile and closed environments', icon: 'shield',
    text: 'The spacecraft is a closed system: air quality, CO₂, noise, temperature, artificial light and microbes that change their behavior.',
    effects: 'The immune system changes and latent viruses can reactivate. High CO₂ causes headaches and fatigue.',
    counter: 'Monitoring the air and symptoms, strict hygiene, and good food and sleep to support immunity.',
    indicators: ['spo2', 'temp', 'glucose']
  }
};

/* -------------------------------------------------------------------------
   Body regions (interactive map)
   x, y: position of the point on the figure (viewBox 300 x 600)
   ------------------------------------------------------------------------- */
AH.REGIONS = {
  brain: {
    id: 'brain', name: 'Brain and behavioral health', x: 150, y: 40,
    indicators: ['mood', 'stress', 'sleep'], hazards: ['I', 'R', 'D'],
    func: 'Controls thinking, memory, mood, sleep and coordination.',
    space: 'Isolation, disrupted light cycles and radiation can affect sleep, mood and cognitive performance.'
  },
  eyes: {
    id: 'eyes', name: 'Eyes and vision', x: 150, y: 66,
    indicators: [], hazards: ['G', 'R'],
    func: 'Needed to read instruments, pilot and work with precision.',
    space: 'The headward fluid shift can flatten the eyeball and swell the optic nerve: spaceflight-associated neuro-ocular syndrome (SANS). It often shows up as blurry near vision. Radiation raises the risk of cataracts.'
  },
  lungs: {
    id: 'lungs', name: 'Lungs and breathing', x: 126, y: 168,
    indicators: ['spo2'], hazards: ['E'],
    func: 'Exchange oxygen and carbon dioxide with the blood.',
    space: 'In a closed habitat CO₂ can build up and cause headaches and fatigue. Lunar and Martian dust is very fine and irritates the lungs.'
  },
  heart: {
    id: 'heart', name: 'Heart and circulation', x: 164, y: 184,
    indicators: ['hr', 'sys', 'dia'], hazards: ['G', 'R'],
    func: 'Pumps the blood that carries oxygen and nutrients to the whole body.',
    space: 'Without gravity the heart works less, becomes more spherical and can lose mass. Back in gravity, orthostatic intolerance appears (dizziness when standing up).'
  },
  blood: {
    id: 'blood', name: 'Blood and immunity', x: 222, y: 246,
    indicators: ['temp'], hazards: ['E', 'R'],
    func: 'Blood carries oxygen, and immune cells defend the body against infection.',
    space: 'The immune system changes in flight and latent viruses can reactivate. The body destroys more red blood cells than normal ("space anemia") and core temperature tends to rise.'
  },
  gut: {
    id: 'gut', name: 'Digestion and nutrition', x: 150, y: 252,
    indicators: ['glucose', 'mass'], hazards: ['G', 'D'],
    func: 'Gets energy and nutrients from food.',
    space: 'Taste changes with congestion, and many astronauts eat less and lose weight. Space motion sickness causes nausea in the first days.'
  },
  kidneys: {
    id: 'kidneys', name: 'Kidneys and hydration', x: 180, y: 226,
    indicators: ['water'], hazards: ['G', 'E'],
    func: "Filter the blood and regulate the body's fluids and minerals.",
    space: 'Calcium released from bones and lower fluid intake raise the risk of kidney stones.'
  },
  bones: {
    id: 'bones', name: 'Bones and spine', x: 122, y: 322,
    indicators: ['exercise'], derived: ['boneLoss'], hazards: ['G'],
    func: 'Support the body, protect organs and store calcium.',
    space: 'Without load, the bones of the hips, spine and legs lose about 1–1.5% of their mineral density per month. The spine lengthens and astronauts can grow up to 3% taller, which can cause back pain.'
  },
  muscles: {
    id: 'muscles', name: 'Muscles', x: 178, y: 404,
    indicators: ['exercise'], hazards: ['G'],
    func: 'Enable movement and maintain posture.',
    space: 'With no need to hold the body up, the postural muscles of the legs and back quickly lose mass and strength.'
  },
  skin: {
    id: 'skin', name: 'Skin and radiation exposure', x: 90, y: 152,
    indicators: ['radiation'], derived: ['cumDose'], hazards: ['R'],
    func: "The body's barrier against the environment.",
    space: 'Space radiation passes through the spacecraft and the body, and bone marrow and other tissues are sensitive to it.'
  }
};

/* -------------------------------------------------------------------------
   Daily routine (reminders)
   needs: indicators that must be logged that day to complete the task
   ------------------------------------------------------------------------- */
AH.ROUTINE = [
  { id: 'vitals', time: '07:00', name: 'Morning vital signs', detail: 'HR, blood pressure, temperature and SpO₂', needs: ['hr', 'sys', 'temp', 'spo2'] },
  { id: 'glucose', time: '07:15', name: 'Fasting glucose', detail: 'Before breakfast', needs: ['glucose'] },
  { id: 'sleep', time: '07:30', name: 'Sleep log', detail: 'Hours from your last rest period', needs: ['sleep'] },
  { id: 'breath', time: '13:00', name: 'Breathing break', detail: '1-minute guided session', special: 'breath' },
  { id: 'exercise', time: '18:00', name: 'Exercise session', detail: 'Resistance + cardio', needs: ['exercise'] },
  { id: 'water', time: '20:00', name: 'Hydration total', detail: 'Goal: 2 L', needs: ['water'] },
  { id: 'mood', time: '21:00', name: 'Mood and stress check-in', detail: '30 seconds', needs: ['mood', 'stress'] },
  { id: 'radiation', time: '21:30', name: 'Dosimeter reading', detail: "Today's dose", needs: ['radiation'] }
];
AH.WEEKLY = [
  { id: 'mass', name: 'Body mass (weekly)', detail: 'Same time of day, before eating', needs: ['mass'], days: 7 }
];

/* -------------------------------------------------------------------------
   Gamification
   ------------------------------------------------------------------------- */
AH.RANKS = ['Cadet', 'Astronaut candidate', 'Mission specialist', 'Flight engineer', 'Medical officer', 'Commander', 'Orbital legend'];
/* XP needed to go from level L to L+1: grows with each level */
AH.xpForLevel = (level) => 400 + 300 * (level - 1);

AH.BADGES = [
  { id: 'first', name: 'First contact', desc: 'Save your first log', icon: 'signal' },
  { id: 'streak3', name: 'Consistency', desc: '3-day active streak', icon: 'flame' },
  { id: 'streak7', name: 'Orbital routine', desc: '7-day active streak', icon: 'orbit' },
  { id: 'perfect', name: 'Perfect day', desc: 'Complete every task in one day', icon: 'star' },
  { id: 'sleep3', name: 'Well rested', desc: '3 days in a row with ≥ 7 h of sleep', icon: 'moon' },
  { id: 'water5', name: 'Well hydrated', desc: '5 days with ≥ 2 L of water', icon: 'glass' },
  { id: 'athlete', name: 'Space athlete', desc: '7 days meeting the exercise goal', icon: 'dumbbell' },
  { id: 'breath3', name: 'Calm in the void', desc: '3 breathing breaks', icon: 'wind' },
  { id: 'explorer', name: 'Anatomist', desc: 'Explore every body region', icon: 'body' },
  { id: 'report', name: 'Earth, do you copy?', desc: 'Send your first report to Earth', icon: 'send' },
  { id: 'scientist', name: 'Self-scientist', desc: 'Log 100 values', icon: 'chart' }
];

/* Challenge resources and the main sources for the figures (full list in the README) */
AH.RESOURCES = [
  { name: '5 Hazards of Human Spaceflight', org: 'NASA HRP', url: 'https://www.nasa.gov/hrp/hazards/' },
  { name: 'Risks of Human Spaceflight', org: 'NASA HRP', url: 'https://www.nasa.gov/hrp/risks/' },
  { name: 'Ongoing HRP Research in Space', org: 'NASA HRP', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' },
  { name: 'The Human Body in Space', org: 'NASA', url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/' },
  { name: 'Radiation Protection (NASA-STD-3001 technical brief)', org: 'NASA', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf' },
  { name: "Data From NASA Rover's Voyage to Mars Aids Planning", org: 'NASA JPL', url: 'https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/' },
  { name: 'Monitoring Radiation for Astronaut Health', org: 'Canadian Space Agency (CSA)', url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp' },
  { name: 'Why Do We Conduct Science Experiments in Space?', org: 'Canadian Space Agency (CSA)', url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp' }
];
