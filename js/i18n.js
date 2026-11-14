/* =========================================================================
   AstroHealth · Languages (English / Spanish)
   js/data.js holds the English content. This file keeps a copy of it,
   adds the Spanish content pack and swaps the texts in place with
   AH.setLang('en' | 'es'). The choice is remembered per browser.
   SI notice: code and Spanish translation generated with Claude (Anthropic),
   a Super Intelligence (SI) tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;
  const STORE_KEY = 'astrohealth.lang';

  /* Text fields per collection (everything else is language-neutral) */
  const FIELDS = {
    ENVIRONMENTS: ['name', 'short', 'gravityLabel', 'delayLabel', 'note'],
    INDICATORS: ['name', 'short', 'unit', 'rangeText', 'how', 'why', 'actions'],
    SYMPTOMS: ['name', 'advice'],
    HAZARDS: ['name', 'text', 'effects', 'counter'],
    REGIONS: ['name', 'func', 'space']
  };
  const LIST_FIELDS = { ROUTINE: ['name', 'detail'], WEEKLY: ['name', 'detail'], BADGES: ['name', 'desc'] };

  const LEVELS = {
    en: { ok: 'Normal', watch: 'Watch', crit: 'Critical', none: 'No data', info: 'Notice' },
    es: { ok: 'Normal', watch: 'Vigilar', crit: 'Crítico', none: 'Sin datos', info: 'Aviso' }
  };

  /* Snapshot of the English texts defined in data.js */
  function snapshot() {
    const pack = {};
    for (const [col, fields] of Object.entries(FIELDS)) {
      pack[col] = {};
      for (const [id, item] of Object.entries(V[col])) {
        pack[col][id] = {};
        fields.forEach((f) => { if (f in item) pack[col][id][f] = item[f]; });
      }
    }
    for (const [col, fields] of Object.entries(LIST_FIELDS)) {
      pack[col] = {};
      V[col].forEach((item) => {
        pack[col][item.id] = {};
        fields.forEach((f) => { pack[col][item.id][f] = item[f]; });
      });
    }
    pack.RANKS = V.RANKS.slice();
    pack.RESOURCES = V.RESOURCES.map((r) => ({ org: r.org }));
    return pack;
  }

  const fmt1 = (n) => V.fmtNum(n, 1);

  /* ------------------------------------------------------------------------
     Spanish content pack
     ------------------------------------------------------------------------ */
  const ES = {
    ENVIRONMENTS: {
      iss: { name: 'Estación espacial en órbita baja', short: 'Órbita baja (ISS)', gravityLabel: 'Microgravedad (~0 g)', delayLabel: 'Tiempo real',
        note: 'La Tierra está a 400 km: comunicación casi inmediata y regreso posible en horas.' },
      lunar: { name: 'Base en la superficie lunar', short: 'Base lunar', gravityLabel: 'Gravedad lunar (0,17 g)', delayLabel: '1,3 s',
        note: 'Sin atmósfera ni campo magnético: la radiación en superficie es alta y el polvo lunar es abrasivo.' },
      rover: { name: 'Rover presurizado (exploración lunar)', short: 'Rover lunar', gravityLabel: 'Gravedad lunar (0,17 g)', delayLabel: '1,3 s',
        note: 'Espacio muy reducido durante días: el confinamiento, el sueño y la calidad del aire son clave.' },
      transit: { name: 'Nave en tránsito a Marte', short: 'Tránsito a Marte', gravityLabel: 'Microgravedad (~0 g)', delayLabel: '~10 min',
        note: 'Meses de viaje sin posibilidad de regreso rápido: la tripulación debe ser autónoma.' },
      mars: { name: 'Base en la superficie de Marte', short: 'Base en Marte', gravityLabel: 'Gravedad marciana (0,38 g)', delayLabel: '4–24 min (hoy ~12 min)',
        note: 'La delgada atmósfera marciana protege poco; los mensajes a la Tierra tardan hasta 24 minutos.' }
    },

    INDICATORS: {
      hr: {
        name: 'Frecuencia cardíaca', short: 'FC', unit: 'lpm', rangeText: '50–100 lpm en reposo',
        how: 'Mídela en reposo, tras 5 minutos sin actividad, con el oxímetro de pulso o el brazalete. Sin equipo: cuenta tus latidos en la muñeca durante 30 s y multiplica por 2, o usa la herramienta «Medir con toques».',
        why: 'La microgravedad reduce el trabajo del corazón; con el tiempo puede perder masa y, al volver a un campo gravitacional, aparecen mareos al ponerse de pie (intolerancia ortostática).',
        actions: {
          watch_high: ['Repite la medición tras 5 minutos de reposo.', 'Hidrátate y evita la cafeína.', 'Revisa si tienes fiebre, estrés o falta de sueño.'],
          watch_low: ['Repite la medición en reposo.', 'Si sientes mareo o debilidad, avisa al oficial médico de la tripulación (CMO).'],
          crit: ['Detén toda actividad física y repite la medición.', 'Avisa al oficial médico de la tripulación (CMO).', 'Envía un reporte al cirujano de vuelo en Tierra.']
        }
      },
      sys: {
        name: 'Presión sistólica', short: 'PAS', unit: 'mmHg', rangeText: '90–129 mmHg',
        how: 'Con el tensiómetro automático en el brazo, a la altura del corazón y tras 5 minutos de reposo. Ancla los pies para no flotar y no hables durante la medición. La sistólica es el número mayor.',
        why: 'El desplazamiento de fluidos hacia la cabeza modifica la presión arterial; el estrés y la radiación podrían aumentar el riesgo cardiovascular a largo plazo.',
        actions: {
          watch_high: ['Repite en 10 minutos, relajado y con el brazo a la altura del corazón.', 'Reduce la sal y la cafeína y vigila los próximos días.'],
          watch_low: ['Si al cambiar de postura sientes mareo, siéntate o ánclate y bebe líquidos.', 'Repite la medición en 10 minutos.'],
          crit_high: ['Repite la medición; si persiste, reposo y aviso al CMO.', 'Dolor de cabeza intenso, dolor de pecho o cambios en la visión = emergencia médica.', 'Envía un reporte al cirujano de vuelo.'],
          crit_low: ['Recuéstate o ánclate y bebe líquidos con electrolitos.', 'Avisa al CMO y envía un reporte al cirujano de vuelo.']
        }
      },
      dia: {
        name: 'Presión diastólica', short: 'PAD', unit: 'mmHg', rangeText: '60–84 mmHg',
        how: 'Se obtiene en la misma medición que la sistólica: es el número menor.',
        why: 'El desplazamiento de fluidos hacia la cabeza modifica la presión arterial; el estrés y la radiación podrían aumentar el riesgo cardiovascular a largo plazo.',
        actions: {
          watch_high: ['Repite en 10 minutos, relajado.', 'Reduce la sal y la cafeína y vigila los próximos días.'],
          watch_low: ['Bebe líquidos y evita cambios bruscos de postura.'],
          crit_high: ['Repite la medición; si persiste, reposo y aviso al CMO.', 'Envía un reporte al cirujano de vuelo.'],
          crit_low: ['Recuéstate o ánclate y bebe líquidos con electrolitos.', 'Avisa al CMO.']
        }
      },
      glucose: {
        name: 'Glucosa en sangre', short: 'Glucosa', unit: 'mg/dL', rangeText: '70–110 mg/dL (en ayunas)',
        how: 'Con el glucómetro: limpia el dedo, punciona el costado de la yema y coloca la gota en la tira. Idealmente en ayunas, al despertar.',
        why: 'La inactividad muscular, el estrés y los cambios en la dieta durante el vuelo pueden reducir la sensibilidad a la insulina.',
        actions: {
          watch_high: ['Revisa tu última comida y repite la medición en ayunas mañana.', 'Mantén tu sesión de ejercicio: ayuda a regular la glucosa.'],
          watch_low: ['Toma 15 g de carbohidratos de acción rápida y repite en 15 minutos.'],
          crit_high: ['Repite la medición; si persiste, avisa al CMO.', 'Bebe agua y busca síntomas como sed intensa o confusión.', 'Envía un reporte al cirujano de vuelo.'],
          crit_low: ['Toma 15–20 g de carbohidratos rápidos ya y repite en 15 minutos.', 'Avisa a un compañero: no te quedes solo.', 'Notifica al CMO.']
        }
      },
      temp: {
        name: 'Temperatura corporal', short: 'Temp.', unit: '°C', rangeText: '36,1–37,5 °C',
        how: 'Termómetro digital bajo la lengua o en la frente. En misiones largas la temperatura central tiende a subir cerca de 1 °C: fíjate en los cambios respecto a tu propia línea base.',
        why: 'Sin convección natural el cuerpo disipa peor el calor. Con un sistema inmunitario alterado, la fiebre puede indicar una infección.',
        actions: {
          watch_high: ['Hidrátate, descansa y vuelve a medir en 1 hora.', 'Revisa síntomas de infección (garganta, tos, malestar).'],
          watch_low: ['Abrígate y verifica la temperatura de la cabina.'],
          crit_high: ['Fiebre: reposo, hidratación y aviso al CMO.', 'Considera aislarte del resto de la tripulación hasta ser evaluado.', 'Envía un reporte al cirujano de vuelo.'],
          crit_low: ['Posible hipotermia: abrígate y avisa al CMO.', 'Revisa el control térmico del hábitat.']
        }
      },
      spo2: {
        name: 'Saturación de oxígeno', short: 'SpO₂', unit: '%', rangeText: '95–100 %',
        how: 'Coloca el oxímetro en un dedo limpio y tibio, quédate quieto y espera a que la lectura se estabilice (unos 30 s).',
        why: 'Depende de la atmósfera de la cabina y de tus pulmones. Un valor bajo puede indicar un fallo del soporte vital o una enfermedad respiratoria.',
        actions: {
          watch: ['Respira lento y profundo y repite con el dedo tibio.', 'Revisa los niveles de O₂ y CO₂ de la cabina.'],
          crit: ['Usa mascarilla de oxígeno si está disponible.', 'Alerta a la tripulación: puede ser un problema del soporte vital.', 'Contacta al cirujano de vuelo de inmediato.']
        }
      },
      sleep: {
        name: 'Horas de sueño', short: 'Sueño', unit: 'h', rangeText: '7–9 h',
        how: 'Horas totales dormidas en tu último periodo de descanso. Si usas un actígrafo (reloj de sueño), usa su valor; si no, estima desde que te dormiste hasta que despertaste.',
        why: 'La luz artificial, los 16 amaneceres diarios en órbita, el ruido y el estrés reducen el sueño: en la ISS se duerme en promedio unas 6 horas.',
        actions: {
          watch_low: ['Programa tu próximo descanso con 8 h de oportunidad de sueño.', 'Evita pantallas 1 hora antes; usa antifaz y tapones.', 'Activa la iluminación de cabina en modo «pre-sueño».'],
          watch_high: ['Dormir mucho más de lo habitual puede indicar fatiga o enfermedad: vigila otros síntomas.'],
          crit_low: ['Riesgo de errores operativos: avisa al comandante para ajustar tareas críticas.', 'Habla con el CMO sobre apoyo para dormir.'],
          crit_high: ['Somnolencia excesiva: revisa fiebre y otros síntomas y avisa al CMO.']
        }
      },
      mood: {
        name: 'Estado de ánimo', short: 'Ánimo', unit: '/5', rangeText: '4–5 (bien o excelente)',
        how: '¿Cómo te sientes hoy en general? 1 = muy mal, 5 = excelente. Sé honesto: el objetivo es detectar cambios a tiempo.',
        why: 'El aislamiento y el confinamiento prolongados pueden causar irritabilidad, tristeza, problemas de concentración y conflictos en el equipo.',
        actions: {
          watch: ['Haz una pausa de respiración guiada (pestaña Rutina).', 'Programa una llamada con familia o amigos.', 'Comparte cómo te sientes con un compañero de confianza.'],
          crit: ['No lo enfrentes solo: habla con el CMO o con el equipo de apoyo psicológico en Tierra.', 'Envía un reporte confidencial al cirujano de vuelo.']
        }
      },
      stress: {
        name: 'Nivel de estrés', short: 'Estrés', unit: '/5', rangeText: '1–2 (bajo)',
        how: 'Estrés percibido hoy. 1 = muy tranquilo, 5 = extremo.',
        why: 'Cargas de trabajo altas, poca privacidad y la distancia de casa elevan el estrés, que afecta al sueño, la inmunidad y la toma de decisiones.',
        actions: {
          watch: ['Revisa con el comandante si puedes redistribuir tareas.', 'Reserva tiempo personal: música, mirar por la ventana, leer.', 'Haz una pausa de respiración guiada de 1 minuto.'],
          crit: ['Detente y haz una pausa de respiración.', 'Habla con el CMO o con el equipo de apoyo psicológico.']
        }
      },
      radiation: {
        name: 'Dosis de radiación diaria', short: 'Radiación', unit: 'mSv',
        rangeText: (env) => `≤ ${fmt1(Math.max(2, env.radBaseline * 1.5))} mSv/día en este entorno`,
        how: 'Lee en tu dosímetro personal la dosis acumulada del día (mSv). Durante una alerta de tormenta solar, revísala cada hora.',
        why: 'Fuera de la atmósfera y del campo magnético terrestre la dosis diaria puede ser cientos de veces mayor que en la Tierra (~0,01 mSv/día). Un evento de partículas solares puede multiplicarla en horas.',
        actions: {
          watch: ['Revisa el pronóstico de clima espacial.', 'Pospón las actividades extravehiculares.', 'Pasa más tiempo en las zonas más blindadas del hábitat.'],
          crit: ['Probable evento de partículas solares: dirígete al refugio blindado.', 'Notifica a la tripulación y al control de misión.', 'Registra la dosis cada hora hasta que termine el evento.']
        }
      },
      exercise: {
        name: 'Ejercicio', short: 'Ejercicio', unit: 'min',
        rangeText: (env) => `≥ ${env.exerciseTarget} min/día en este entorno`,
        how: 'Minutos de ejercicio de hoy: cinta con arnés, cicloergómetro y aparato de resistencia. Registra el total del día.',
        why: 'El ejercicio diario es la principal contramedida contra la pérdida de hueso y músculo y contra el desacondicionamiento cardiovascular.',
        actions: {
          watch: ['Completa tu sesión pendiente combinando resistencia y cardio.', 'Hueso y músculo se pierden rápido sin carga: no te saltes dos días seguidos.'],
          crit: ['Hoy casi no hubo ejercicio: reprograma la sesión con el comandante.', 'Prioriza ejercicios de resistencia para piernas y columna.']
        }
      },
      water: {
        name: 'Hidratación', short: 'Agua', unit: 'L', rangeText: '≥ 2,0 L/día',
        how: 'Litros de líquido bebidos hoy (agua y bebidas rehidratadas). Registra el total del día.',
        why: 'En microgravedad la sensación de sed disminuye. Deshidratarse aumenta el riesgo de cálculos renales, ya elevado por el calcio que liberan los huesos.',
        actions: {
          watch: ['Bebe un vaso de agua ahora y programa recordatorios.'],
          crit: ['Bebe al menos 0,5 L en la próxima hora.', 'La deshidratación aumenta el riesgo de cálculos renales: avisa si tienes dolor en el costado.']
        }
      },
      mass: {
        name: 'Masa corporal', short: 'Masa', unit: 'kg',
        rangeText: (env, profile) => (profile && profile.baselineMass ? `±2 % de tu línea base (${fmt1(profile.baselineMass)} kg)` : 'Define tu masa base en Ajustes'),
        how: 'En microgravedad no hay báscula: se usa un dispositivo que mide la masa por aceleración lineal. Mídela una vez por semana, a la misma hora y antes de comer.',
        why: 'Perder peso es frecuente en misiones largas por menor apetito y cambios en el gusto. Una pérdida mayor al 5 % afecta músculo, hueso e inmunidad.',
        actions: {
          watch_low: ['Aumenta la ingesta: añade un refrigerio extra al día.', 'Prueba alimentos con más sabor (los sabores se perciben menos en el espacio).'],
          crit_low: ['Pérdida importante: revisa tu plan de nutrición con el cirujano de vuelo.'],
          watch_high: ['Revisa tu ingesta y tu nivel de actividad.'],
          crit_high: ['Consulta con el equipo de nutrición en Tierra.']
        }
      }
    },

    SYMPTOMS: {
      headache: { name: 'Dolor de cabeza', advice: 'Puede deberse al desplazamiento de fluidos o a CO₂ elevado en la cabina. Revisa el CO₂ e hidrátate.' },
      vision: { name: 'Visión borrosa', advice: 'Puede ser un signo del síndrome neuro-ocular (SANS). Haz la prueba de visión de cerca e infórmalo al cirujano de vuelo.' },
      nausea: { name: 'Náuseas o mareo', advice: 'Es común en los primeros días (mareo espacial). Mantén la cabeza quieta, fija la vista y bebe a sorbos.' },
      congestion: { name: 'Congestión nasal', advice: 'Frecuente por el desplazamiento de fluidos hacia la cabeza. Afecta al gusto y al apetito.' },
      breath: { name: 'Falta de aire', advice: 'Mide tu SpO₂, revisa la atmósfera de la cabina y alerta a la tripulación.' },
      chest: { name: 'Dolor en el pecho', advice: 'Detén toda actividad y activa el protocolo de emergencia médica con el CMO.' },
      back: { name: 'Dolor de espalda', advice: 'La columna se alarga hasta 5 cm sin gravedad. Los estiramientos en posición fetal suelen aliviarlo.' },
      fatigue: { name: 'Fatiga inusual', advice: 'Revisa sueño, temperatura e hidratación. La «anemia espacial» también puede causar cansancio.' },
      insomnia: { name: 'Dificultad para dormir', advice: 'Ajusta la iluminación, evita pantallas antes de dormir y mantén un horario fijo.' },
      anxiety: { name: 'Ansiedad o tristeza persistente', advice: 'Habla con alguien de confianza y con el equipo de apoyo psicológico.' },
      flank: { name: 'Dolor en el costado o al orinar', advice: 'Posible cálculo renal (riesgo mayor en el espacio). Bebe líquidos y avisa al CMO.' },
      skin: { name: 'Irritación o herida en la piel', advice: 'Las heridas pueden sanar más lento en vuelo. Limpia, cubre y vigila signos de infección.' }
    },

    HAZARDS: {
      R: { name: 'Radiación espacial',
        text: 'Fuera de la protección de la atmósfera y del campo magnético terrestre, los astronautas reciben partículas de alta energía: rayos cósmicos galácticos y eventos de partículas solares.',
        effects: 'Mayor riesgo de cáncer a largo plazo, daño al sistema nervioso central, cataratas y enfermedad cardiovascular. Una tormenta solar intensa puede causar síntomas agudos.',
        counter: 'Dosímetro personal, refugio blindado durante eventos solares y planificación de actividades según el clima espacial.' },
      I: { name: 'Aislamiento y confinamiento',
        text: 'Meses en un espacio reducido, con poca privacidad, rutinas estrictas y lejos de la familia.',
        effects: 'Alteraciones del sueño y del ánimo, estrés, menor rendimiento cognitivo y tensiones en el equipo.',
        counter: 'Horarios de sueño regulares, iluminación adecuada, contacto con seres queridos, ejercicio y check-ins de ánimo.' },
      D: { name: 'Distancia de la Tierra',
        text: 'Lejos de la Tierra no hay evacuación rápida. Desde Marte un mensaje tarda entre 4 y 24 minutos en llegar.',
        effects: 'La tripulación debe detectar, diagnosticar y tratar problemas con autonomía y con suministros médicos limitados.',
        counter: 'Herramientas de autoevaluación como AstroHealth, protocolos claros, entrenamiento médico y criterios para escalar al cirujano de vuelo.' },
      G: { name: 'Campos gravitacionales',
        text: 'En microgravedad los fluidos se desplazan hacia la cabeza y el cuerpo deja de soportar peso. Cambiar de un campo gravitacional a otro también es un desafío.',
        effects: 'Pérdida de ~1–1,5 % de densidad ósea al mes, atrofia muscular, desacondicionamiento cardiovascular, síndrome neuro-ocular (SANS) y problemas de equilibrio al aterrizar.',
        counter: 'Unas 2 horas diarias de ejercicio de resistencia y cardio, nutrición con calcio y vitamina D, e hidratación.' },
      E: { name: 'Entornos hostiles y cerrados',
        text: 'La nave es un sistema cerrado: calidad del aire, CO₂, ruido, temperatura, luz artificial y microbios que cambian su comportamiento.',
        effects: 'El sistema inmunitario se altera y pueden reactivarse virus latentes. El CO₂ elevado causa dolor de cabeza y fatiga.',
        counter: 'Monitorear el aire y los síntomas, higiene estricta y buena alimentación y sueño para apoyar la inmunidad.' }
    },

    REGIONS: {
      brain: { name: 'Cerebro y salud conductual', func: 'Controla el pensamiento, la memoria, el estado de ánimo, el sueño y la coordinación.',
        space: 'El aislamiento, la alteración de los ciclos de luz y la radiación pueden afectar el sueño, el ánimo y el rendimiento cognitivo.' },
      eyes: { name: 'Ojos y visión', func: 'Permiten leer instrumentos, pilotar y trabajar con precisión.',
        space: 'El desplazamiento de fluidos hacia la cabeza puede aplanar el globo ocular e inflamar el nervio óptico: el síndrome neuro-ocular asociado a vuelos espaciales (SANS). Suele notarse como visión de cerca borrosa. La radiación aumenta el riesgo de cataratas.' },
      lungs: { name: 'Pulmones y respiración', func: 'Intercambian oxígeno y dióxido de carbono con la sangre.',
        space: 'En un hábitat cerrado el CO₂ puede acumularse y causar dolor de cabeza y fatiga. El polvo lunar y marciano es muy fino e irritante para los pulmones.' },
      heart: { name: 'Corazón y circulación', func: 'Bombea la sangre que lleva oxígeno y nutrientes a todo el cuerpo.',
        space: 'Sin gravedad el corazón trabaja menos y se vuelve más esférico; puede perder masa. Al regresar a la gravedad aparece intolerancia ortostática (mareo al ponerse de pie).' },
      blood: { name: 'Sangre e inmunidad', func: 'La sangre transporta oxígeno y las células inmunitarias defienden contra infecciones.',
        space: 'El sistema inmunitario se altera en vuelo y pueden reactivarse virus latentes. El cuerpo destruye más glóbulos rojos de lo normal («anemia espacial») y la temperatura central tiende a subir.' },
      gut: { name: 'Digestión y nutrición', func: 'Obtiene la energía y los nutrientes de los alimentos.',
        space: 'El gusto cambia por la congestión y muchos astronautas comen menos y pierden peso. El mareo espacial causa náuseas los primeros días.' },
      kidneys: { name: 'Riñones e hidratación', func: 'Filtran la sangre y regulan los líquidos y minerales del cuerpo.',
        space: 'El calcio que liberan los huesos y la menor ingesta de líquidos aumentan el riesgo de cálculos renales.' },
      bones: { name: 'Huesos y columna', func: 'Sostienen el cuerpo, protegen órganos y almacenan calcio.',
        space: 'Sin carga, los huesos de cadera, columna y piernas pierden ~1–1,5 % de densidad mineral al mes. La columna se alarga hasta 5 cm, lo que causa dolor de espalda.' },
      muscles: { name: 'Músculos', func: 'Permiten el movimiento y mantienen la postura.',
        space: 'Sin necesidad de sostener el cuerpo, los músculos posturales de piernas y espalda pierden masa y fuerza rápidamente.' },
      skin: { name: 'Piel y exposición a radiación', func: 'Es la barrera del cuerpo contra el entorno.',
        space: 'La radiación espacial atraviesa la nave y el cuerpo; la médula ósea y otros tejidos son sensibles. Las heridas pueden sanar más lento en vuelo.' }
    },

    ROUTINE: {
      vitals: { name: 'Signos vitales matutinos', detail: 'FC, presión, temperatura y SpO₂' },
      glucose: { name: 'Glucosa en ayunas', detail: 'Antes del desayuno' },
      sleep: { name: 'Registro de sueño', detail: 'Horas del último descanso' },
      breath: { name: 'Pausa de respiración', detail: '1 minuto guiado' },
      exercise: { name: 'Sesión de ejercicio', detail: 'Resistencia + cardio' },
      water: { name: 'Total de hidratación', detail: 'Meta: 2 L' },
      mood: { name: 'Check-in de ánimo y estrés', detail: '30 segundos' },
      radiation: { name: 'Lectura del dosímetro', detail: 'Dosis del día' }
    },
    WEEKLY: {
      mass: { name: 'Masa corporal (semanal)', detail: 'Mismo horario, antes de comer' }
    },
    BADGES: {
      first: { name: 'Primer contacto', desc: 'Guarda tu primer registro' },
      streak3: { name: 'Constancia', desc: 'Racha de 3 días activos' },
      streak7: { name: 'Rutina orbital', desc: 'Racha de 7 días activos' },
      perfect: { name: 'Día perfecto', desc: 'Completa todas las tareas de un día' },
      sleep3: { name: 'Buen descanso', desc: '3 días seguidos con ≥ 7 h de sueño' },
      water5: { name: 'Bien hidratado', desc: '5 días con ≥ 2 L de agua' },
      athlete: { name: 'Atleta espacial', desc: '7 días cumpliendo la meta de ejercicio' },
      breath3: { name: 'Calma en el vacío', desc: '3 pausas de respiración' },
      explorer: { name: 'Anatomista', desc: 'Explora todas las regiones del cuerpo' },
      report: { name: 'Tierra, ¿me copian?', desc: 'Envía tu primer reporte a Tierra' },
      scientist: { name: 'Científico de sí mismo', desc: 'Registra 100 valores' }
    },
    RANKS: ['Cadete', 'Candidato a astronauta', 'Especialista de misión', 'Ingeniero de vuelo', 'Oficial médico', 'Comandante', 'Leyenda orbital'],
    RESOURCES: [
      { org: 'NASA HRP' }, { org: 'NASA HRP' }, { org: 'NASA HRP' },
      { org: 'Agencia Espacial Canadiense (CSA)' }, { org: 'Agencia Espacial Canadiense (CSA)' }
    ]
  };

  const EN = snapshot();

  function apply(pack) {
    for (const col of Object.keys(FIELDS)) {
      for (const [id, texts] of Object.entries(pack[col] || {})) if (V[col][id]) Object.assign(V[col][id], texts);
    }
    for (const col of Object.keys(LIST_FIELDS)) {
      V[col].forEach((item) => { if (pack[col] && pack[col][item.id]) Object.assign(item, pack[col][item.id]); });
    }
    if (pack.RANKS) V.RANKS = pack.RANKS.slice();
    (pack.RESOURCES || []).forEach((r, i) => { if (V.RESOURCES[i]) Object.assign(V.RESOURCES[i], r); });
  }

  /* Switch the language of all content; the UI re-renders afterwards */
  V.setLang = (lang) => {
    V.lang = lang === 'es' ? 'es' : 'en';
    apply(V.lang === 'es' ? ES : EN);
    V.LEVEL_TEXT = LEVELS[V.lang];
    try { localStorage.setItem(STORE_KEY, V.lang); } catch (e) { /* storage unavailable */ }
    document.documentElement.lang = V.lang;
  };

  let stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
  V.setLang(stored === 'es' ? 'es' : 'en'); // English by default
})();
