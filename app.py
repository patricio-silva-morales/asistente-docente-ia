import json
from pathlib import Path
from threading import Lock
from time import perf_counter
from uuid import uuid4

from flask import Flask, jsonify, render_template, request
from faster_whisper import WhisperModel
from ollama import chat


app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024


# ---------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------

CARPETA_AUDIOS = Path("audios_temporales")
CARPETA_AUDIOS.mkdir(exist_ok=True)

MODELO_WHISPER = "small"
MODELO_RESPUESTAS = "asistente-docente-rapido"

MAX_CONTEXTO_TRANSCRIPCION = 1000
MAX_CONTEXTO_RESPUESTA = 800
MAX_INTERVENCION_CLASIFICADOR = 1300


# ---------------------------------------------------------
# CARGA DE WHISPER
# ---------------------------------------------------------

print("Cargando modelo Whisper...")

modelo_whisper = WhisperModel(
    MODELO_WHISPER,
    device="cpu",
    compute_type="int8",
    cpu_threads=4
)

print("Modelo Whisper cargado correctamente.")


# Whisper se usa de una transcripción a la vez.
bloqueo_whisper = Lock()

# Ollama procesa clasificación y respuestas de una en una.
bloqueo_clasificacion = Lock()
bloqueo_respuestas = Lock()


# ---------------------------------------------------------
# PÁGINA PRINCIPAL
# ---------------------------------------------------------

@app.route("/")
def inicio():
    return render_template("index.html")


# ---------------------------------------------------------
# TRANSCRIPCIÓN
# ---------------------------------------------------------

@app.route("/api/transcribir", methods=["POST"])
def transcribir():
    archivo_audio = request.files.get("audio")

    if archivo_audio is None:
        return jsonify({
            "error": "No se recibió ningún archivo de audio."
        }), 400

    if archivo_audio.filename == "":
        return jsonify({
            "error": "El archivo recibido no tiene nombre."
        }), 400

    contexto = request.form.get("contexto", "").strip()
    contexto = contexto[-MAX_CONTEXTO_TRANSCRIPCION:]

    extension = obtener_extension(
        archivo_audio.filename
    )

    ruta_temporal = CARPETA_AUDIOS / (
        f"{uuid4().hex}{extension}"
    )

    tiempo_inicio = perf_counter()

    try:
        archivo_audio.save(ruta_temporal)

        if ruta_temporal.stat().st_size == 0:
            return jsonify({
                "error": "El fragmento de audio está vacío."
            }), 400

        parametros = {
            "language": "es",
            "task": "transcribe",
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 300
            },
            "beam_size": 3,
            "best_of": 3,
            "temperature": 0,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.5,
            "log_prob_threshold": -1.0,
            "compression_ratio_threshold": 2.4
        }

        prompt_base = (
            "Clase de programación en español de Chile. "
            "Transcribe literalmente y no traduzcas. "
            "Utiliza correctamente la puntuación y los signos "
            "de interrogación. "
            "Vocabulario frecuente: Python, JavaScript, HTML, CSS, "
            "SQL, Django, Flask, Angular, Node.js, Visual Studio Code, "
            "GitHub, for, while, if, else, range, input, print, "
            "variable, contador, acumulador, lista, función, ciclo, "
            "framework, API y base de datos. "
        )

        if contexto:
            prompt_base += (
                f"Continuación del texto anterior: {contexto}"
            )

        parametros["initial_prompt"] = prompt_base

        with bloqueo_whisper:
            segmentos, informacion = modelo_whisper.transcribe(
                str(ruta_temporal),
                **parametros
            )

            textos = [
                segmento.text.strip()
                for segmento in segmentos
                if segmento.text.strip()
            ]

        texto_completo = " ".join(textos).strip()

        duracion = round(
            perf_counter() - tiempo_inicio,
            2
        )

        print(
            f"Transcripción completada en {duracion} segundos."
        )

        return jsonify({
            "texto": texto_completo,
            "idioma": informacion.language,
            "probabilidad_idioma": round(
                informacion.language_probability,
                4
            ),
            "duracion": duracion
        })

    except Exception as error:
        print(f"Error durante la transcripción: {error}")

        return jsonify({
            "error": "No fue posible transcribir el fragmento.",
            "detalle": str(error)
        }), 500

    finally:
        if ruta_temporal.exists():
            ruta_temporal.unlink()


# ---------------------------------------------------------
# CLASIFICACIÓN DE PREGUNTAS
# ---------------------------------------------------------

@app.route("/api/detectar-pregunta", methods=["POST"])
def detectar_pregunta():
    datos = request.get_json(silent=True) or {}

    texto = str(
        datos.get("texto", "")
    ).strip()

    tema = str(
        datos.get("tema", "")
    ).strip()

    if not texto:
        return jsonify({
            "es_pregunta": False,
            "pregunta": "",
            "confianza": 0
        })

    if not tema:
        tema = "Programación y tecnología"

    texto = texto[-700:]

    instrucciones = (
        "Analiza una intervención realizada durante una clase. "
        "Determina si contiene una pregunta real dirigida al profesor. "
        "También reconoce preguntas indirectas, por ejemplo: "
        "'No entendí cuándo debo usar while'. "
        "No clasifiques como pregunta una explicación, afirmación "
        "o ejemplo que solamente mencione palabras como cómo o por qué. "
        "Si contiene varias preguntas relacionadas, unifícalas en una "
        "pregunta clara. "
        "Corrige puntuación y errores evidentes de transcripción, "
        "pero no agregues información que no aparezca en el texto. "
        "Devuelve exclusivamente JSON válido."
    )

    contenido = (
        f"Tema de la clase: {tema}\n\n"
        f"Intervención:\n{texto}\n\n"
        "Devuelve exactamente esta estructura:\n"
        "{"
        '"es_pregunta": true o false, '
        '"pregunta": "pregunta limpia o cadena vacía", '
        '"confianza": número entero entre 0 y 100'
        "}"
    )

    try:
        with bloqueo_clasificacion:
            respuesta = chat(
                model=MODELO_RESPUESTAS,
                messages=[
                    {
                        "role": "system",
                        "content": instrucciones
                    },
                    {
                        "role": "user",
                        "content": contenido
                    }
                ],
                format="json",
                options={
                    "temperature": 0,
                    "num_predict": 45,
                    "num_ctx": 768
                },
                keep_alive="2h"
            )

        texto_json = obtener_texto_respuesta(
            respuesta
        )

        resultado = json.loads(texto_json)

        confianza = convertir_entero(
            resultado.get("confianza", 0)
        )

        confianza = max(0, min(100, confianza))

        return jsonify({
            "es_pregunta": bool(
                resultado.get("es_pregunta", False)
            ),
            "pregunta": str(
                resultado.get("pregunta", "")
            ).strip(),
            "confianza": confianza
        })

    except Exception as error:
        print(f"Error detectando pregunta: {error}")

        return jsonify({
            "error": "No fue posible analizar la intervención.",
            "detalle": str(error)
        }), 500


# ---------------------------------------------------------
# GENERACIÓN DE RESPUESTAS
# ---------------------------------------------------------

@app.route("/api/responder", methods=["POST"])
def responder_pregunta():
    datos = request.get_json(silent=True) or {}

    pregunta = str(
        datos.get("pregunta", "")
    ).strip()

    contexto = str(
        datos.get("contexto", "")
    ).strip()

    tema = str(
        datos.get("tema", "")
    ).strip()

    if not pregunta:
        return jsonify({
            "error": "No se recibió una pregunta."
        }), 400

    contexto = contexto[-MAX_CONTEXTO_RESPUESTA:]

    if not tema:
        tema = "Programación y tecnología"

    instrucciones = (
        "Eres un asistente para un profesor. "
        "Responde exclusivamente en español. "
        "Entrega una respuesta directa, clara y concreta. "
        "Utiliza un máximo de 45 palabras. "
        "Adapta la explicación a estudiantes principiantes. "
        "No saludes. "
        "No repitas la pregunta. "
        "No expliques tu razonamiento interno. "
        "No inventes información. "
        "Conserva los términos técnicos de programación."
    )

    contenido_usuario = (
        f"Tema: {tema}\n"
        f"Contexto reciente: {contexto}\n"
        f"Pregunta: {pregunta}\n"
        "Entrega solamente la respuesta breve."
    )

    tiempo_inicio = perf_counter()

    try:
        with bloqueo_respuestas:
            respuesta = chat(
                model=MODELO_RESPUESTAS,
                messages=[
                    {
                        "role": "system",
                        "content": instrucciones
                    },
                    {
                        "role": "user",
                        "content": contenido_usuario
                    }
                ],
                options={
                    "temperature": 0,
                    "num_predict": 70,
                    "num_ctx": 1024,
                    "repeat_penalty": 1.1
                },
                keep_alive="2h"
            )

        texto_respuesta = obtener_texto_respuesta(
            respuesta
        )

        if not texto_respuesta:
            return jsonify({
                "error": "El modelo no generó una respuesta."
            }), 500

        duracion = round(
            perf_counter() - tiempo_inicio,
            2
        )

        print(
            f"Respuesta generada en {duracion} segundos."
        )

        return jsonify({
            "respuesta": texto_respuesta,
            "modelo": MODELO_RESPUESTAS,
            "duracion": duracion
        })

    except Exception as error:
        print(f"Error al consultar Ollama: {error}")

        return jsonify({
            "error": (
                "No fue posible generar la respuesta. "
                "Comprueba que Ollama esté funcionando y que "
                f"el modelo {MODELO_RESPUESTAS} esté instalado."
            ),
            "detalle": str(error)
        }), 500


# ---------------------------------------------------------
# FUNCIONES AUXILIARES
# ---------------------------------------------------------

def obtener_texto_respuesta(respuesta) -> str:
    try:
        return respuesta.message.content.strip()
    except AttributeError:
        return respuesta["message"]["content"].strip()


def convertir_entero(valor) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return 0


def obtener_extension(nombre_archivo: str) -> str:
    extension = Path(
        nombre_archivo
    ).suffix.lower()

    extensiones_permitidas = {
        ".webm",
        ".wav",
        ".mp3",
        ".m4a",
        ".ogg"
    }

    if extension in extensiones_permitidas:
        return extension

    return ".webm"


# ---------------------------------------------------------
# ERRORES
# ---------------------------------------------------------

@app.errorhandler(413)
def archivo_demasiado_grande(_error):
    return jsonify({
        "error": "El fragmento supera el tamaño permitido."
    }), 413


# ---------------------------------------------------------
# EJECUCIÓN
# ---------------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False,
        threaded=True
    )