const btnIniciar = document.getElementById("btnIniciar");
const btnDetener = document.getElementById("btnDetener");
const btnLimpiar = document.getElementById("btnLimpiar");

const btnCopiar = document.getElementById("btnCopiar");
const btnDescargar = document.getElementById("btnDescargar");

const btnCopiarPreguntas = document.getElementById(
    "btnCopiarPreguntas"
);

const btnDescargarPreguntas = document.getElementById(
    "btnDescargarPreguntas"
);

const estado = document.getElementById("estado");
const mensaje = document.getElementById("mensaje");
const actividad = document.getElementById("actividad");

const textoTranscripcion = document.getElementById(
    "textoTranscripcion"
);

const listaPreguntas = document.getElementById(
    "listaPreguntas"
);

const contadorFragmentos = document.getElementById(
    "contadorFragmentos"
);

const fragmentosPendientes = document.getElementById(
    "fragmentosPendientes"
);

const contadorPreguntas = document.getElementById(
    "contadorPreguntas"
);

const resumenProcesados = document.getElementById(
    "resumenProcesados"
);

const resumenPendientes = document.getElementById(
    "resumenPendientes"
);

const resumenPreguntas = document.getElementById(
    "resumenPreguntas"
);

const informacionCaptura = document.getElementById(
    "informacionCaptura"
);

const duracionFragmento = document.getElementById(
    "duracionFragmento"
);

const fuenteAudio = document.getElementById(
    "fuenteAudio"
);

const temaClase = document.getElementById(
    "temaClase"
);


const SUPERPOSICION_MS = 2000;
const LONGITUD_BUFFER_DETECCION = 600;


let streamCaptura = null;
let capturaActiva = false;
let intervaloGrabacion = null;

let grabadoresActivos = new Set();

let colaFragmentos = [];
let procesandoCola = false;

let colaDeteccion = [];
let procesandoDeteccion = false;

let colaRespuestas = [];
let procesandoRespuestas = false;

let totalProcesados = 0;
let totalPendientes = 0;
let numeroFragmento = 0;

let primeraTranscripcion = true;
let primeraPregunta = true;

let transcripcionCompleta = "";
let preguntasDetectadas = [];

let bufferDeteccion = "";


btnIniciar.addEventListener("click", iniciarCaptura);
btnDetener.addEventListener("click", detenerCaptura);
btnLimpiar.addEventListener("click", limpiarTodo);

btnCopiar.addEventListener("click", copiarTranscripcion);
btnDescargar.addEventListener("click", descargarTranscripcion);

btnCopiarPreguntas.addEventListener(
    "click",
    copiarPreguntas
);

btnDescargarPreguntas.addEventListener(
    "click",
    descargarPreguntas
);


async function iniciarCaptura() {
    try {
        limpiarMensajeError();

        if (fuenteAudio.value === "microfono") {
            streamCaptura =
                await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1
                    },
                    video: false
                });
        } else {
            streamCaptura =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
        }

        const pistasAudio =
            streamCaptura.getAudioTracks();

        if (pistasAudio.length === 0) {
            detenerPistas();

            throw new Error(
                "La fuente seleccionada no contiene audio."
            );
        }

        capturaActiva = true;

        btnIniciar.disabled = true;
        btnDetener.disabled = false;

        fuenteAudio.disabled = true;
        duracionFragmento.disabled = true;

        cambiarEstado(
            "Escuchando",
            "estado-escuchando"
        );

        const pistaAudio = pistasAudio[0];

        informacionCaptura.textContent =
            `Audio capturado: ${
                pistaAudio.label || "fuente seleccionada"
            }`;

        mostrarMensaje(
            "Captura iniciada correctamente.",
            "mensaje-correcto"
        );

        streamCaptura.getTracks().forEach((pista) => {
            pista.addEventListener("ended", () => {
                if (capturaActiva) {
                    detenerCaptura();
                }
            });
        });

        iniciarGrabacionContinua();

    } catch (error) {
        console.error(error);

        mostrarMensaje(
            error.message ||
            "No fue posible iniciar la captura.",
            "mensaje-error"
        );

        cambiarEstado("Error", "estado-error");
    }
}


function iniciarGrabacionContinua() {
    const intervaloMs = Number(
        duracionFragmento.value
    );

    crearGrabadorTemporal(
        intervaloMs + SUPERPOSICION_MS
    );

    intervaloGrabacion = window.setInterval(() => {
        if (capturaActiva) {
            crearGrabadorTemporal(
                intervaloMs + SUPERPOSICION_MS
            );
        }
    }, intervaloMs);

    actividad.textContent =
        "Grabando audio continuamente...";
}


function crearGrabadorTemporal(duracionMs) {
    if (!capturaActiva || !streamCaptura) {
        return;
    }

    const pistaAudio =
        streamCaptura.getAudioTracks()[0];

    if (
        !pistaAudio ||
        pistaAudio.readyState !== "live"
    ) {
        detenerCaptura();
        return;
    }

    const streamSoloAudio = new MediaStream([
        pistaAudio
    ]);

    const tipoMime = obtenerTipoMime();

    const opciones = {
        audioBitsPerSecond: 192000
    };

    if (tipoMime) {
        opciones.mimeType = tipoMime;
    }

    let grabador;

    try {
        grabador = new MediaRecorder(
            streamSoloAudio,
            opciones
        );
    } catch (error) {
        console.error(error);

        mostrarMensaje(
            "El navegador no pudo grabar el audio.",
            "mensaje-error"
        );

        return;
    }

    const partesAudio = [];

    grabadoresActivos.add(grabador);

    grabador.addEventListener(
        "dataavailable",
        (evento) => {
            if (
                evento.data &&
                evento.data.size > 0
            ) {
                partesAudio.push(evento.data);
            }
        }
    );

    grabador.addEventListener("stop", () => {
        grabadoresActivos.delete(grabador);

        if (partesAudio.length === 0) {
            return;
        }

        const tipo =
            grabador.mimeType ||
            tipoMime ||
            "audio/webm";

        const audioBlob = new Blob(
            partesAudio,
            { type: tipo }
        );

        if (audioBlob.size < 1000) {
            return;
        }

        agregarFragmentoACola(audioBlob);
    });

    grabador.start();

    window.setTimeout(() => {
        if (grabador.state === "recording") {
            grabador.stop();
        }
    }, duracionMs);
}


function agregarFragmentoACola(audioBlob) {
    numeroFragmento++;

    colaFragmentos.push({
        numero: numeroFragmento,
        audioBlob
    });

    totalPendientes++;
    actualizarContadores();

    procesarColaFragmentos();
}


async function procesarColaFragmentos() {
    if (procesandoCola) {
        return;
    }

    procesandoCola = true;

    while (colaFragmentos.length > 0) {
        const fragmento = colaFragmentos.shift();

        cambiarEstado(
            "Procesando",
            "estado-procesando"
        );

        actividad.textContent =
            `Transcribiendo fragmento ${fragmento.numero}...`;

        try {
            await enviarAudio(
                fragmento.audioBlob,
                fragmento.numero
            );

            totalProcesados++;

        } catch (error) {
            console.error(error);

            mostrarMensaje(
                `Error en el fragmento ${fragmento.numero}: ` +
                error.message,
                "mensaje-error"
            );

        } finally {
            totalPendientes--;
            actualizarContadores();
        }
    }

    procesandoCola = false;

    if (capturaActiva) {
        cambiarEstado(
            "Escuchando",
            "estado-escuchando"
        );

        actividad.textContent =
            "Captura activa.";
    } else {
        cambiarEstado(
            "Detenido",
            "estado-detenido"
        );

        actividad.textContent =
            "Todos los fragmentos fueron procesados.";
    }
}


async function enviarAudio(audioBlob, numero) {
    const extension = audioBlob.type.includes("ogg")
        ? "ogg"
        : "webm";

    const formulario = new FormData();

    formulario.append(
        "audio",
        audioBlob,
        `fragmento-${numero}.${extension}`
    );

    formulario.append(
        "contexto",
        transcripcionCompleta.slice(-1000)
    );

    const respuesta = await fetch(
        "/api/transcribir",
        {
            method: "POST",
            body: formulario
        }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(
            datos.detalle ||
            datos.error ||
            "No fue posible transcribir el audio."
        );
    }

    if (datos.texto) {
        agregarTranscripcion(datos.texto);
    }
}


function agregarTranscripcion(nuevoTexto) {
    const textoSinRepeticion =
        eliminarSuperposicion(
            transcripcionCompleta,
            nuevoTexto
        );

    if (!textoSinRepeticion) {
        return;
    }

    if (primeraTranscripcion) {
        textoTranscripcion.innerHTML = "";
        primeraTranscripcion = false;
    }

    const horaActual = obtenerHoraActual();

    const parrafo = document.createElement("p");
    parrafo.className = "fragmento";

    const hora = document.createElement("span");
    hora.className = "hora";
    hora.textContent = horaActual;

    const contenido = document.createElement("span");
    contenido.textContent = textoSinRepeticion;

    parrafo.appendChild(hora);
    parrafo.appendChild(contenido);

    textoTranscripcion.appendChild(parrafo);

    transcripcionCompleta = unirTexto(
        transcripcionCompleta,
        textoSinRepeticion
    );

    agregarIntervencionACola(
        textoSinRepeticion,
        horaActual
    );

    parrafo.scrollIntoView({
        behavior: "smooth",
        block: "end"
    });
}


function agregarIntervencionACola(texto, hora) {
    const textoLimpio = normalizarEspacios(texto);

    if (!textoLimpio) {
        return;
    }

    /*
     * Unimos siempre el texto pendiente del bloque anterior.
     */
    const textoCombinado = normalizarEspacios(
        `${bufferDeteccion} ${textoLimpio}`
    );

    /*
     * Consideramos que una intervención terminó si:
     * - termina en punto, interrogación o exclamación;
     * - o tiene suficiente longitud y no parece cortada.
     */
    const intervencionCompleta =
        terminaComoOracion(textoCombinado);

    if (!intervencionCompleta) {
        /*
         * Todavía no se analiza.
         * Se conserva hasta recibir el bloque siguiente.
         */
        bufferDeteccion = textoCombinado.slice(-900);

        actividad.textContent =
            "Esperando continuación de la intervención...";

        return;
    }

    /*
     * Ya tenemos una intervención suficientemente completa.
     */
    bufferDeteccion = "";

    const ultimo =
        colaDeteccion[
            colaDeteccion.length - 1
        ];

    if (
        ultimo &&
        normalizarTextoComparacion(ultimo.texto) ===
        normalizarTextoComparacion(textoCombinado)
    ) {
        return;
    }

    if (colaDeteccion.length >= 3) {
        colaDeteccion.shift();
    }

    colaDeteccion.push({
        texto: textoCombinado,
        hora
    });

    procesarColaDeteccion();
}

function terminaComoOracion(texto) {
    const textoLimpio = texto.trim();

    if (!textoLimpio) {
        return false;
    }

    /*
     * Si termina con puntuación fuerte,
     * asumimos que la intervención concluyó.
     */
    if (/[.!?]$/.test(textoLimpio)) {
        return true;
    }

    /*
     * Detecta finales que suelen indicar que el audio
     * quedó cortado entre bloques.
     */
    if (pareceTextoCortado(textoLimpio)) {
        return false;
    }

    /*
     * Si no hay puntuación, esperamos un poco más,
     * salvo que el texto ya sea suficientemente largo.
     */
    const cantidadPalabras =
        textoLimpio.split(/\s+/).length;

    return cantidadPalabras >= 35;
}


function pareceTextoCortado(texto) {
    const normalizado =
        normalizarTextoComparacion(texto);

    const palabras = normalizado.split(/\s+/);

    if (palabras.length === 0) {
        return false;
    }

    const ultimaPalabra =
        palabras[palabras.length - 1];

    /*
     * Conectores o estructuras que normalmente
     * necesitan una continuación.
     */
    const finalesIncompletos = [
        "y",
        "o",
        "pero",
        "porque",
        "aunque",
        "que",
        "como",
        "cuando",
        "donde",
        "si",
        "para",
        "por",
        "de",
        "del",
        "en",
        "con",
        "sin",
        "entre",
        "usar",
        "ser",
        "hacer",
        "evitar",
        "producir"
    ];

    if (finalesIncompletos.includes(ultimaPalabra)) {
        return true;
    }

    /*
     * Detecta una última palabra claramente truncada
     * por el bloque, por ejemplo "simúlte-".
     */
    if (/[-–—]$/.test(texto.trim())) {
        return true;
    }

    /*
     * Una pregunta que termina con una preposición
     * o verbo incompleto probablemente continúa.
     */
    const terminacionesIncompletas = [
        /\bconviene usar$/i,
        /\bseria mejor usar$/i,
        /\bcomo se puede$/i,
        /\bde que manera$/i,
        /\ben que casos$/i,
        /\bcual es la diferencia entre$/i,
        /\bque pasa si$/i
    ];

    return terminacionesIncompletas.some(
        (patron) => patron.test(texto.trim())
    );
}

async function procesarColaDeteccion() {
    if (procesandoDeteccion) {
        return;
    }

    procesandoDeteccion = true;

    try {
        while (colaDeteccion.length > 0) {
            const elemento = colaDeteccion.shift();

            await analizarIntervencion(
                elemento.texto,
                elemento.hora
            );
        }
    } catch (error) {
        console.error(
            "Error procesando la cola de detección:",
            error
        );

        mostrarMensaje(
            `Error al detectar preguntas: ${error.message}`,
            "mensaje-error"
        );
    } finally {
        procesandoDeteccion = false;
    }
}

async function analizarIntervencion(texto, hora) {
    const resultadoReglas =
        evaluarPreguntaConReglas(texto);

    /*
     * Pregunta evidente:
     * se registra inmediatamente sin esperar a Ollama.
     */
    if (
        resultadoReglas.esPregunta &&
        resultadoReglas.puntaje >= 5
    ) {
        registrarPregunta(
            resultadoReglas.texto,
            hora,
            resultadoReglas.puntaje >= 8
                ? "Alta"
                : "Media"
        );

        return;
    }

    /*
     * Las frases que parecen claramente afirmativas
     * no se envían a Ollama.
     */
    if (!pareceIntervencionAmbigua(texto)) {
        return;
    }

    try {
        const respuesta = await fetch(
            "/api/detectar-pregunta",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    texto: texto.slice(-700),
                    tema:
                        temaClase.value.trim() ||
                        "Programación y tecnología"
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.detalle ||
                datos.error ||
                "No fue posible clasificar la intervención."
            );
        }

        if (
            datos.es_pregunta &&
            datos.pregunta &&
            datos.confianza >= 65
        ) {
            registrarPregunta(
                formatearPregunta(datos.pregunta),
                hora,
                convertirConfianza(datos.confianza)
            );
        }

    } catch (error) {
        console.error(
            "Error clasificando pregunta:",
            error
        );
    }
}

function pareceIntervencionAmbigua(texto) {
    const normalizado =
        normalizarTextoComparacion(texto);

    const expresionesAmbiguas = [
        "no entiendo",
        "no entendi",
        "no me queda claro",
        "tengo una duda",
        "tengo una pregunta",
        "queria saber",
        "queria preguntar",
        "me puede explicar",
        "puede explicar",
        "podria explicar",
        "me gustaria saber",
        "no se cuando",
        "no se como",
        "no se por que"
    ];

    return expresionesAmbiguas.some(
        (expresion) =>
            normalizado.includes(expresion)
    );
}


function evaluarPreguntaConReglas(textoOriginal) {
    const candidatos =
        separarEnOraciones(textoOriginal);

    let mejorResultado = {
        esPregunta: false,
        texto: "",
        puntaje: 0
    };

    for (const candidato of candidatos) {
        const texto =
            limpiarTextoPregunta(candidato);

        if (texto.length < 5) {
            continue;
        }

        const normalizado =
            normalizarTextoComparacion(texto);

        let puntaje = 0;

        /*
         * Si Whisper agregó signos de interrogación,
         * consideramos que hay una señal fuerte.
         */
        if (
            texto.includes("?") ||
            texto.includes("¿")
        ) {
            puntaje += 6;
        }

        /*
         * Inicios frecuentes de una pregunta.
         */
        const iniciosInterrogativos = [
            "que ",
            "como ",
            "cuando ",
            "donde ",
            "cual ",
            "cuales ",
            "quien ",
            "quienes ",
            "cuanto ",
            "cuantos ",
            "por que ",
            "para que ",
            "puedo ",
            "podemos ",
            "debo ",
            "debemos ",
            "se puede ",
            "es posible "
        ];

        if (
            iniciosInterrogativos.some(
                (inicio) =>
                    normalizado.startsWith(inicio)
            )
        ) {
            puntaje += 4;
        }

        /*
         * Expresiones frecuentes de alumnos.
         */
        const expresiones = [
            "tengo una duda",
            "tengo una pregunta",
            "queria preguntar",
            "queria saber",
            "me puede explicar",
            "puede explicar",
            "podria explicar",
            "puede repetir",
            "podria repetir",
            "como puedo",
            "como hago",
            "como se hace",
            "como funciona",
            "que significa",
            "cual es la diferencia",
            "que diferencia hay",
            "por que no",
            "para que sirve",
            "que pasa si",
            "se puede utilizar",
            "se puede usar",
            "cual seria",
            "en que caso"
        ];

        if (
            expresiones.some(
                (expresion) =>
                    normalizado.includes(expresion)
            )
        ) {
            puntaje += 4;
        }

        /*
         * Referencia directa al profesor.
         */
        if (
            normalizado.includes("profesor") ||
            normalizado.includes("profesora")
        ) {
            puntaje += 1;
        }

        if (puntaje > mejorResultado.puntaje) {
            mejorResultado = {
                esPregunta: puntaje >= 4,
                texto: formatearPregunta(texto),
                puntaje
            };
        }
    }

    return mejorResultado;
}


function registrarPregunta(
    texto,
    hora,
    confianza
) {
    if (!texto) {
        return;
    }

    const claveNueva =
        normalizarTextoComparacion(texto);

    const yaExiste =
        preguntasDetectadas.some(
            (pregunta) => {
                return preguntasSonSimilares(
                    normalizarTextoComparacion(
                        pregunta.texto
                    ),
                    claveNueva
                );
            }
        );

    if (yaExiste) {
        return;
    }

    const pregunta = {
        id: generarIdPregunta(),
        numero: preguntasDetectadas.length + 1,
        texto,
        hora,
        confianza,
        respuesta: "",
        estadoRespuesta: "pendiente",
        eliminada: false
    };

    preguntasDetectadas.push(pregunta);

    const elementos = mostrarPregunta(pregunta);

    actualizarContadores();

    colaRespuestas.push({
        pregunta,
        elementos
    });

    procesarColaRespuestas();
}


async function procesarColaRespuestas() {
    if (procesandoRespuestas) {
        return;
    }

    procesandoRespuestas = true;

    while (colaRespuestas.length > 0) {
        const elemento = colaRespuestas.shift();

        if (elemento.pregunta.eliminada) {
            continue;
        }

        await generarRespuesta(
            elemento.pregunta,
            elemento.elementos
        );
    }

    procesandoRespuestas = false;
}


function mostrarPregunta(pregunta) {
    if (primeraPregunta) {
        listaPreguntas.innerHTML = "";
        primeraPregunta = false;
    }

    const tarjeta = document.createElement("article");

    tarjeta.className = "pregunta";
    tarjeta.dataset.preguntaId = pregunta.id;

    const cabecera = document.createElement("div");
    cabecera.className = "pregunta-cabecera";

    const informacion = document.createElement("div");
    informacion.className = "pregunta-informacion";

    const numero = document.createElement("span");
    numero.className = "pregunta-numero";
    numero.textContent =
        `Pregunta ${pregunta.numero}`;

    const hora = document.createElement("span");
    hora.className = "pregunta-hora";
    hora.textContent = pregunta.hora;

    informacion.appendChild(numero);
    informacion.appendChild(hora);

    const botonEliminar =
        document.createElement("button");

    botonEliminar.type = "button";
    botonEliminar.className =
        "boton-eliminar-pregunta";
    botonEliminar.textContent = "Eliminar";

    botonEliminar.addEventListener(
        "click",
        () => {
            solicitarEliminacionPregunta(
                pregunta.id
            );
        }
    );

    cabecera.appendChild(informacion);
    cabecera.appendChild(botonEliminar);

    const texto = document.createElement("p");
    texto.className = "pregunta-texto";
    texto.textContent = pregunta.texto;

    const confianza = document.createElement("span");
    confianza.className = "pregunta-confianza";
    confianza.textContent =
        `Confianza: ${pregunta.confianza}`;

    const contenedorRespuesta =
        document.createElement("div");

    contenedorRespuesta.className =
        "respuesta-contenedor";

    const etiquetaRespuesta =
        document.createElement("span");

    etiquetaRespuesta.className =
        "respuesta-etiqueta";
    etiquetaRespuesta.textContent =
        "Respuesta sugerida";

    const textoRespuesta =
        document.createElement("p");

    textoRespuesta.className =
        "respuesta-texto respuesta-cargando";
    textoRespuesta.textContent =
        "Esperando generación de respuesta...";

    const botonRegenerar =
        document.createElement("button");

    botonRegenerar.type = "button";
    botonRegenerar.className =
        "boton-regenerar";
    botonRegenerar.textContent =
        "Generar nuevamente";
    botonRegenerar.hidden = true;

    botonRegenerar.addEventListener(
        "click",
        () => {
            generarRespuesta(
                pregunta,
                {
                    textoRespuesta,
                    botonRegenerar
                }
            );
        }
    );

    contenedorRespuesta.appendChild(
        etiquetaRespuesta
    );
    contenedorRespuesta.appendChild(
        textoRespuesta
    );
    contenedorRespuesta.appendChild(
        botonRegenerar
    );

    tarjeta.appendChild(cabecera);
    tarjeta.appendChild(texto);
    tarjeta.appendChild(confianza);
    tarjeta.appendChild(contenedorRespuesta);

    listaPreguntas.appendChild(tarjeta);

    return {
        tarjeta,
        textoRespuesta,
        botonRegenerar
    };
}


async function generarRespuesta(
    pregunta,
    elementos
) {
    if (pregunta.eliminada) {
        return;
    }

    const {
        textoRespuesta,
        botonRegenerar
    } = elementos;

    pregunta.estadoRespuesta = "procesando";

    textoRespuesta.className =
        "respuesta-texto respuesta-cargando";
    textoRespuesta.textContent =
        "Generando respuesta local...";

    botonRegenerar.hidden = true;

    try {
        const respuesta = await fetch(
            "/api/responder",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    pregunta: pregunta.texto,
                    tema:
                        temaClase.value.trim() ||
                        "Programación y tecnología",
                    contexto:
                        transcripcionCompleta.slice(-800)
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.detalle ||
                datos.error ||
                "No fue posible generar la respuesta."
            );
        }

        if (pregunta.eliminada) {
            return;
        }

        pregunta.respuesta = datos.respuesta;
        pregunta.estadoRespuesta = "completada";

        textoRespuesta.className =
            "respuesta-texto";
        textoRespuesta.textContent =
            datos.respuesta;

    } catch (error) {
        console.error(error);

        if (pregunta.eliminada) {
            return;
        }

        pregunta.estadoRespuesta = "error";

        textoRespuesta.className =
            "respuesta-texto respuesta-error";
        textoRespuesta.textContent =
            "No fue posible generar la respuesta.";

    } finally {
        if (!pregunta.eliminada) {
            botonRegenerar.hidden = false;
        }
    }
}


function solicitarEliminacionPregunta(
    preguntaId
) {
    const pregunta = preguntasDetectadas.find(
        (elemento) =>
            elemento.id === preguntaId
    );

    if (!pregunta) {
        return;
    }

    const confirmacion = window.confirm(
        "¿Deseas eliminar esta pregunta y su respuesta?\n\n" +
        pregunta.texto
    );

    if (confirmacion) {
        eliminarPregunta(preguntaId);
    }
}


function eliminarPregunta(preguntaId) {
    const indice = preguntasDetectadas.findIndex(
        (pregunta) =>
            pregunta.id === preguntaId
    );

    if (indice === -1) {
        return;
    }

    preguntasDetectadas[indice].eliminada = true;
    preguntasDetectadas.splice(indice, 1);

    const tarjeta = listaPreguntas.querySelector(
        `[data-pregunta-id="${preguntaId}"]`
    );

    if (tarjeta) {
        tarjeta.remove();
    }

    colaRespuestas = colaRespuestas.filter(
        (elemento) =>
            elemento.pregunta.id !== preguntaId
    );

    renumerarPreguntas();
    actualizarContadores();

    if (preguntasDetectadas.length === 0) {
        mostrarEstadoSinPreguntas();
    }

    mostrarMensaje(
        "La pregunta fue eliminada.",
        "mensaje-correcto"
    );
}


function renumerarPreguntas() {
    preguntasDetectadas.forEach(
        (pregunta, indice) => {
            pregunta.numero = indice + 1;

            const tarjeta =
                listaPreguntas.querySelector(
                    `[data-pregunta-id="${pregunta.id}"]`
                );

            const numero = tarjeta?.querySelector(
                ".pregunta-numero"
            );

            if (numero) {
                numero.textContent =
                    `Pregunta ${pregunta.numero}`;
            }
        }
    );
}


function mostrarEstadoSinPreguntas() {
    primeraPregunta = true;

    listaPreguntas.innerHTML = `
        <div class="contenido-vacio">
            <span class="icono-vacio">?</span>
            <p>Las preguntas aparecerán aquí.</p>
        </div>
    `;
}


function separarEnOraciones(texto) {
    return texto
        .split(/(?<=[.!?])\s+|\n+/)
        .map((parte) => parte.trim())
        .filter((parte) => parte.length >= 5);
}


function formatearPregunta(texto) {
    let resultado = texto
        .replace(/^[,.;:\s]+/, "")
        .replace(/[.!;,:\s]+$/, "")
        .trim();

    if (!resultado) {
        return "";
    }

    resultado =
        resultado.charAt(0).toUpperCase() +
        resultado.slice(1);

    if (!resultado.startsWith("¿")) {
        resultado = `¿${resultado}`;
    }

    if (!resultado.endsWith("?")) {
        resultado = `${resultado}?`;
    }

    return resultado;
}


function convertirConfianza(valor) {
    if (valor >= 85) {
        return "Alta";
    }

    if (valor >= 65) {
        return "Media";
    }

    return "Baja";
}


function preguntasSonSimilares(
    textoA,
    textoB
) {
    if (textoA === textoB) {
        return true;
    }

    if (
        textoA.length >= 15 &&
        textoB.length >= 15 &&
        (
            textoA.includes(textoB) ||
            textoB.includes(textoA)
        )
    ) {
        return true;
    }

    const palabrasA = new Set(textoA.split(/\s+/));
    const palabrasB = new Set(textoB.split(/\s+/));

    const coincidencias = [
        ...palabrasA
    ].filter(
        (palabra) =>
            palabra.length > 3 &&
            palabrasB.has(palabra)
    );

    const referencia = Math.min(
        palabrasA.size,
        palabrasB.size
    );

    return (
        referencia > 0 &&
        coincidencias.length / referencia >= 0.75
    );
}


function generarIdPregunta() {
    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return (
        `${Date.now()}-` +
        Math.random().toString(16).slice(2)
    );
}


function eliminarSuperposicion(
    textoAnterior,
    textoNuevo
) {
    const nuevoLimpio = textoNuevo.trim();

    if (!textoAnterior.trim()) {
        return nuevoLimpio;
    }

    const anteriores =
        textoAnterior.trim().split(/\s+/);

    const nuevas =
        nuevoLimpio.split(/\s+/);

    const maximo = Math.min(
        30,
        anteriores.length,
        nuevas.length
    );

    for (
        let cantidad = maximo;
        cantidad >= 2;
        cantidad--
    ) {
        const finalAnterior = anteriores
            .slice(-cantidad)
            .map(normalizarPalabra);

        const inicioNuevo = nuevas
            .slice(0, cantidad)
            .map(normalizarPalabra);

        const coincide = finalAnterior.every(
            (palabra, indice) =>
                palabra === inicioNuevo[indice]
        );

        if (coincide) {
            return nuevas
                .slice(cantidad)
                .join(" ")
                .trim();
        }
    }

    return nuevoLimpio;
}


function normalizarPalabra(palabra) {
    return palabra
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,;:¿?¡!()[\]{}"'']/g, "")
        .trim();
}


function normalizarTextoComparacion(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[¿?¡!.,;:()[\]{}"'']/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function limpiarTextoPregunta(texto) {
    return texto
        .replace(/\s+/g, " ")
        .replace(/^[.,;:\-\s]+/, "")
        .trim();
}


function normalizarEspacios(texto) {
    return texto
        .replace(/\s+/g, " ")
        .trim();
}


function unirTexto(anterior, nuevo) {
    if (!anterior.trim()) {
        return nuevo.trim();
    }

    return `${anterior.trim()} ${nuevo.trim()}`;
}


function obtenerTipoMime() {
    const tipos = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg"
    ];

    return tipos.find(
        (tipo) =>
            MediaRecorder.isTypeSupported(tipo)
    ) || "";
}


function detenerCaptura() {
    if (!capturaActiva) {
        return;
    }

    capturaActiva = false;

    if (intervaloGrabacion !== null) {
        clearInterval(intervaloGrabacion);
        intervaloGrabacion = null;
    }

    grabadoresActivos.forEach((grabador) => {
        if (grabador.state === "recording") {
            grabador.stop();
        }
    });

    detenerPistas();

    btnIniciar.disabled = false;
    btnDetener.disabled = true;

    fuenteAudio.disabled = false;
    duracionFragmento.disabled = false;

    informacionCaptura.textContent =
        "La captura está detenida.";

    if (bufferDeteccion.trim()) {
        colaDeteccion.push({
            texto: bufferDeteccion.trim(),
            hora: obtenerHoraActual()
        });

        bufferDeteccion = "";

        procesarColaDeteccion();
    }

    mostrarMensaje(
        "La captura se detuvo. Los fragmentos pendientes " +
        "seguirán procesándose.",
        "mensaje-informativo"
    );
}


function detenerPistas() {
    if (!streamCaptura) {
        return;
    }

    streamCaptura.getTracks().forEach(
        (pista) => pista.stop()
    );

    streamCaptura = null;
}


function limpiarTodo() {
    if (
        capturaActiva ||
        totalPendientes > 0 ||
        procesandoCola
    ) {
        mostrarMensaje(
            "Detén la captura y espera el procesamiento.",
            "mensaje-informativo"
        );

        return;
    }

    textoTranscripcion.innerHTML = `
        <div class="contenido-vacio">
            <p>La transcripción aparecerá aquí.</p>
        </div>
    `;

    mostrarEstadoSinPreguntas();

    totalProcesados = 0;
    totalPendientes = 0;
    numeroFragmento = 0;

    primeraTranscripcion = true;

    transcripcionCompleta = "";
    preguntasDetectadas = [];

    bufferDeteccion = "";

    colaFragmentos = [];
    colaDeteccion = [];
    colaRespuestas = [];

    actualizarContadores();

    mostrarMensaje(
        "La información fue eliminada.",
        "mensaje-informativo"
    );
}


async function copiarTranscripcion() {
    if (!transcripcionCompleta.trim()) {
        mostrarMensaje(
            "No existe una transcripción para copiar.",
            "mensaje-informativo"
        );
        return;
    }

    await navigator.clipboard.writeText(
        transcripcionCompleta
    );

    mostrarMensaje(
        "Transcripción copiada.",
        "mensaje-correcto"
    );
}


async function copiarPreguntas() {
    const texto = generarTextoPreguntas();

    if (!texto) {
        mostrarMensaje(
            "No existen preguntas para copiar.",
            "mensaje-informativo"
        );
        return;
    }

    await navigator.clipboard.writeText(texto);

    mostrarMensaje(
        "Preguntas copiadas.",
        "mensaje-correcto"
    );
}


function descargarTranscripcion() {
    if (!transcripcionCompleta.trim()) {
        mostrarMensaje(
            "No existe una transcripción para descargar.",
            "mensaje-informativo"
        );
        return;
    }

    descargarArchivoTexto(
        transcripcionCompleta,
        `transcripcion-${obtenerFechaArchivo()}.txt`
    );
}


function descargarPreguntas() {
    const texto = generarTextoPreguntas();

    if (!texto) {
        mostrarMensaje(
            "No existen preguntas para descargar.",
            "mensaje-informativo"
        );
        return;
    }

    descargarArchivoTexto(
        texto,
        `preguntas-${obtenerFechaArchivo()}.txt`
    );
}


function generarTextoPreguntas() {
    return preguntasDetectadas
        .map((pregunta) => {
            const respuesta = pregunta.respuesta
                ? `\nRespuesta: ${pregunta.respuesta}`
                : "\nRespuesta: pendiente";

            return (
                `${pregunta.numero}. ` +
                `[${pregunta.hora}] ` +
                pregunta.texto +
                respuesta
            );
        })
        .join("\n\n");
}


function descargarArchivoTexto(
    contenido,
    nombre
) {
    const archivo = new Blob(
        [contenido],
        {
            type: "text/plain;charset=utf-8"
        }
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombre;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
}


function obtenerHoraActual() {
    return new Intl.DateTimeFormat(
        "es-CL",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(new Date());
}


function obtenerFechaArchivo() {
    const fecha = new Date();

    const anio = fecha.getFullYear();

    const mes = String(
        fecha.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        fecha.getDate()
    ).padStart(2, "0");

    const hora = String(
        fecha.getHours()
    ).padStart(2, "0");

    const minuto = String(
        fecha.getMinutes()
    ).padStart(2, "0");

    return `${anio}-${mes}-${dia}-${hora}-${minuto}`;
}


function actualizarContadores() {
    contadorFragmentos.textContent =
        `${totalProcesados} procesados`;

    fragmentosPendientes.textContent =
        `${totalPendientes} pendientes`;

    contadorPreguntas.textContent =
        preguntasDetectadas.length === 1
            ? "1 pregunta"
            : `${preguntasDetectadas.length} preguntas`;

    resumenProcesados.textContent =
        totalProcesados;

    resumenPendientes.textContent =
        totalPendientes;

    resumenPreguntas.textContent =
        preguntasDetectadas.length;
}


function cambiarEstado(texto, clase) {
    estado.textContent = texto;
    estado.className = `estado ${clase}`;
}


function mostrarMensaje(texto, clase) {
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${clase}`;
}


function limpiarMensajeError() {
    mensaje.classList.remove("mensaje-error");
}