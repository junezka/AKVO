// 1. Simulación de datos recibidos del cuestionario
// Leer los puntajes guardados (si no existen, pone 0 por defecto)
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

// 2. Función para actualizar la tarjeta de puntuación
function updateScoreCard(data) {
    document.getElementById('finalScore').innerText = data.totalScore;
    document.getElementById('scoreProgress').style.width = `${data.totalScore}%`;
    
    const levelBadge = document.getElementById('levelText');
    const feedback = document.getElementById('feedbackText');

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

// 3. Función para renderizar el gráfico Radar
function renderChart(data) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
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
                backgroundColor: 'rgba(43, 122, 95, 0.2)', // Verde claro transparente
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
                    ticks: { display: false } // Oculta los números del gráfico
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

async function saveDiagnosisToDb() {
    const diagnosticoId = Number(localStorage.getItem('akvoDiagnosticoId'));
    if (!diagnosticoId) {
        console.warn('No hay diagnóstico activo para finalizar.');
        return;
    }

    const payload = {
        financiera: pFinanciera,
        contable: pContable,
        procesos: pProcesos,
        digital: pDigital,
        estrategia: pEstrategia,
        total_score: promedioTotal
    };

    try {
        const response = await fetch(`/api/diagnosticos/${diagnosticoId}/finalizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.warn('No se pudo guardar el diagnóstico final en MySQL.');
            return;
        }

        const result = await response.json();
        console.log('Diagnóstico final guardado:', result);
    } catch (error) {
        console.warn('Servidor Python no disponible. Se mantiene el diagnóstico en localStorage.', error.message);
    }
}

// Ejecutar las funciones al cargar la página
window.onload = async () => {
    updateScoreCard(userResults);
    renderChart(userResults);
    await saveDiagnosisToDb();
};
// Base de datos de recomendaciones por área (basado en tu diseño)
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

// Función para renderizar la lista de áreas
function renderAreasDetails() {
    const container = document.getElementById('areasContainer');
    container.innerHTML = ''; // Limpiar contenedor

    areasData.forEach(area => {
        // Determinar nivel, descripción y color
        let nivelText, badgeClass, descText;

        if (area.score < 60) {
            nivelText = "Básico";
            badgeClass = "badge-basico";
            descText = "Hay fundamentos mínimos, pero faltan estructuras sólidas. Es necesario intervenir con urgencia para avanzar.";
        } else if (area.score < 80) {
            nivelText = "En desarrollo";
            badgeClass = "badge-desarrollo";
            descText = "Existen avances importantes, pero la consolidación es parcial. Con un acompañamiento adecuado el potencial es alto.";
        } else {
            nivelText = "Avanzado";
            badgeClass = "badge-avanzado";
            descText = "Estructuras muy sólidas. El enfoque principal debe ser la optimización y la escalabilidad del modelo de negocio.";
        }

        // Generar los pasos HTML (1, 2, 3)
        const stepsHTML = area.steps.map((step, index) => `
            <li>
                <span class="step-num">${index + 1}</span>
                ${step}
            </li>
        `).join('');

        // Crear la tarjeta HTML e inyectarla
        const cardHTML = `
            <div class="area-card">
                <div class="area-header">
                    <h3 class="area-title">${area.name}</h3>
                    <div class="area-stats">
                        <span class="area-badge ${badgeClass}">${nivelText}</span>
                        <div class="area-score-text">${area.score} <span>/100</span></div>
                    </div>
                </div>
                <p class="area-desc">${descText}</p>
                <div class="area-steps-title">PASOS RECOMENDADOS PARA ESTA ÁREA:</div>
                <ul class="area-steps">
                    ${stepsHTML}
                </ul>
            </div>
        `;
        
        container.innerHTML += cardHTML;
    });
}

// Asegúrate de llamar a esta función dentro del window.onload junto con las demás
window.onload = () => {
    updateScoreCard(userResults);
    renderChart(userResults);
    renderAreasDetails(); // <-- Añadir aquí
};