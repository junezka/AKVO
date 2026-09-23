// 1. Lectura de datos de localStorage
const pFinanciera = parseFloat(localStorage.getItem('scoreFinanciera')) || 0;
const pContable = parseFloat(localStorage.getItem('scoreContable')) || 0;
const pProcesos = parseFloat(localStorage.getItem('scoreProcesos')) || 0;
const pDigital = parseFloat(localStorage.getItem('scoreDigital')) || 0;
const pEstrategia = parseFloat(localStorage.getItem('scoreEstrategia')) || 0;

// Calcular el promedio total
const promedioTotal = Math.round((pFinanciera + pContable + pProcesos + pDigital + pEstrategia) / 5);

// Crear el objeto dinámico
const userResults = {
    totalScore: promedioTotal,
    areas: {
        financiera: pFinanciera,
        estrategia: pEstrategia,
        contable: pContable,
        digital: pDigital,
        procesos: pProcesos
    }
};

// 2. Función para la solicitud por correo (vincular al botón)
function enviarCorreo() {
    const correo = "akvo.3116@gmail.com";
    const asunto = "Solicitud de Asesoría Personalizada - AKVO";
    const mensaje = "Buen día equipo de AKVO, deseo una asesoría personalizada:\n\nNombre empresa:\nNúmero de contacto:";
    const urlmailto = `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    window.location.href = urlmailto;
}

// 3. Actualizar la tarjeta de puntuación
function updateScoreCard(data) {
    const finalScoreEl = document.getElementById('finalScore');
    if (finalScoreEl) finalScoreEl.innerText = data.totalScore;

    const scoreProgressEl = document.getElementById('scoreProgress');
    if (scoreProgressEl) scoreProgressEl.style.width = `${data.totalScore}%`;
    
    const levelBadge = document.getElementById('levelText');
    const feedback = document.getElementById('feedbackText');

    if (levelBadge && feedback) {
        if (data.totalScore < 60) {
            levelBadge.innerText = "Nivel: Básico";
            feedback.innerText = "Hay fundamentos mínimos, pero faltan estructuras sólidas. Es necesario intervenir con urgencia para avanzar.";
        } else if (data.totalScore < 80) {
            levelBadge.innerText = "Nivel: En Desarrollo";
            feedback.innerText = "Existen avances importantes. Potencial alto.";
        } else {
            levelBadge.innerText = "Nivel: Avanzado";
            feedback.innerText = "Estructuras muy sólidas. Listo para escalar.";
        }
    }
}

// 4. Renderizar gráfico Radar
function renderChart(data) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Financiera', 'Estrategia', 'Contable', 'Digital', 'Procesos'],
            datasets: [{
                label: 'Puntuación por área',
                data: [
                    data.areas.financiera, 
                    data.areas.estrategia, 
                    data.areas.contable, 
                    data.areas.digital, 
                    data.areas.procesos
                ],
                backgroundColor: 'rgba(43, 122, 95, 0.2)',
                borderColor: '#2b7a5f',
                pointBackgroundColor: '#2b7a5f',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// 5. Guardar puntuaciones en Backend Supabase / Flask
async function saveDiagnosisToDb() {
    // Lee la clave de diagnóstico estandarizada
    const diagnosticoId = Number(localStorage.getItem('diagnostico_id') || localStorage.getItem('akvoDiagnosticoId'));
    if (!diagnosticoId) {
        console.warn('No hay diagnóstico activo para finalizar.');
        return;
    }

    const modulos = [
        { modulo: 'financiera', score: pFinanciera },
        { modulo: 'contable', score: pContable },
        { modulo: 'procesos', score: pProcesos },
        { modulo: 'digital', score: pDigital },
        { modulo: 'estrategia', score: pEstrategia }
    ];

    try {
        // Guarda la puntuación de cada área enviando a /api/modulos
        for (const item of modulos) {
            await fetch('/api/modulos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    diagnostico_id: diagnosticoId,
                    modulo: item.modulo,
                    score: item.score,
                    respuestas: JSON.parse(localStorage.getItem(`respuestas_${item.modulo}`) || '{}')
                })
            });
        }
        console.log('Diagnóstico guardado correctamente en Supabase.');
    } catch (error) {
        console.warn('Error al guardar en el servidor:', error.message);
    }
}

// 6. Configuración de detalles por área
const areasData = [
    {
        id: 'financiera',
        name: 'Financiera y Económica',
        score: pFinanciera,
        steps: [
            "Analizar la rentabilidad por línea de producto o servicio",
            "Construir un presupuesto anual con metas",
            "Implementar proyecciones financieras trimestrales"
        ]
    },
    {
        id: 'contable',
        name: 'Contable y Tributaria',
        score: pContable,
        steps: [
            "Implementar facturación electrónica",
            "Ponerse al día con obligaciones tributarias pendientes",
            "Establecer un calendario de obligaciones fiscales"
        ]
    },
    {
        id: 'procesos',
        name: 'Procesos y Calidad',
        score: pProcesos,
        steps: [
            "Crear un manual operativo básico",
            "Implementar listas de verificación (checklists)",
            "Establecer indicadores mínimos de calidad"
        ]
    },
    {
        id: 'digital',
        name: 'Transformación Digital',
        score: pDigital,
        steps: [
            "Implementar analítica web y métricas de redes sociales",
            "Evaluar un sistema ERP o de gestión integrada",
            "Capacitar al equipo en habilidades digitales"
        ]
    },
    {
        id: 'estrategia',
        name: 'Estrategia y Sostenibilidad',
        score: pEstrategia,
        steps: [
            "Construir un plan estratégico a 3 años con OKRs",
            "Explorar alianzas estratégicas",
            "Incorporar criterios de sostenibilidad en la estrategia"
        ]
    }
];

// Mapeo de iconos para cada área
const areaIcons = {
    financiera: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    contable: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d8c6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    procesos: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e2a4a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
    digital: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d8c6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    estrategia: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e2a4a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
};

function renderAreasDetails() {
    const container = document.getElementById('areasContainer');
    if (!container) return;
    
    container.innerHTML = '';

    areasData.forEach(area => {
        let nivelText, badgeClass, barColorClass;

        if (area.score < 50) {
            nivelText = "Básico";
            badgeClass = "badge-basico";
            barColorClass = "bar-basico";
        } else if (area.score < 75) {
            nivelText = "En desarrollo";
            badgeClass = "badge-desarrollo";
            barColorClass = "bar-desarrollo";
        } else {
            nivelText = "Consolidado";
            badgeClass = "badge-consolidado";
            barColorClass = "bar-consolidado";
        }

        const stepsHTML = area.steps.map((step, index) => `
            <li>
                <span class="step-num">${index + 1}</span>
                ${step}
            </li>
        `).join('');

        const cardHTML = `
            <details class="area-accordion-card">
                <summary class="area-accordion-header">
                    <div class="area-icon-wrapper">
                        ${areaIcons[area.id] || ''}
                    </div>
                    <div class="area-main-info">
                        <div class="area-title-row">
                            <span class="area-title-text">${area.name}</span>
                            <span class="area-status-badge ${badgeClass}">${nivelText}</span>
                        </div>
                        <div class="area-progress-track">
                            <div class="area-progress-fill ${barColorClass}" style="width: ${area.score}%;"></div>
                        </div>
                    </div>
                    <div class="area-score-val">
                        <strong>${area.score}</strong>/100
                    </div>
                    <div class="area-chevron">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                </summary>
                <div class="area-accordion-content">
                    <div class="area-steps-title">PASOS RECOMENDADOS PARA ESTA ÁREA:</div>
                    <ul class="area-steps">
                        ${stepsHTML}
                    </ul>
                </div>
            </details>
        `;
        
        container.innerHTML += cardHTML;
    });
}

// 7. Evento al cargar la página
window.addEventListener('DOMContentLoaded', async () => {
    updateScoreCard(userResults);
    renderChart(userResults);
    renderAreasDetails();
    await saveDiagnosisToDb();
});