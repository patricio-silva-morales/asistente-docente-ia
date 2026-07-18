# TeachCopilot IA

TeachCopilot IA es una aplicación web de ejecución local diseñada para apoyar a docentes que realizan clases por videoconferencia. La aplicación captura audio desde el micrófono o desde una pestaña del navegador, transcribe el contenido, identifica preguntas formuladas durante la clase y genera respuestas breves mediante modelos de inteligencia artificial ejecutados localmente.

El proyecto utiliza `faster-whisper` para la transcripción y `Ollama` para la detección de preguntas y la generación de respuestas. Todo el procesamiento se realiza en el equipo del usuario, por lo que no requiere servicios de pago ni claves de API externas.

---

## Descripción

Durante una clase remota, un docente puede recibir preguntas mediante audio en plataformas como Google Meet, Zoom, Microsoft Teams o BigBlueButton. Responder inmediatamente puede resultar difícil mientras se explica un contenido, se comparte pantalla o se revisa código.

TeachCopilot IA busca apoyar este proceso mediante el siguiente flujo:

```text
Audio de la clase
        ↓
Captura desde el navegador
        ↓
Transcripción local con Whisper
        ↓
Detección de preguntas
        ↓
Generación de respuesta con Ollama
        ↓
Respuesta breve para el docente
```

La aplicación muestra en pantalla:

- La transcripción completa.
- Las preguntas detectadas.
- Una respuesta sugerida para cada pregunta.
- El estado de los fragmentos de audio.
- Herramientas para copiar, descargar o eliminar preguntas.

---

## Características principales

- Captura de audio desde micrófono.
- Captura de audio desde una pestaña o pantalla compartida.
- Transcripción local en español.
- Procesamiento de audio por fragmentos.
- Superposición entre fragmentos para reducir cortes.
- Cola de procesamiento para evitar pérdida de audio.
- Eliminación de texto repetido entre bloques.
- Detección de preguntas mediante reglas locales.
- Clasificación con Ollama para intervenciones ambiguas.
- Generación automática de respuestas breves.
- Respuestas adaptadas a estudiantes principiantes.
- Campo configurable con el tema de la clase.
- Eliminación de preguntas con confirmación.
- Edición manual de preguntas detectadas.
- Copia de transcripción y preguntas.
- Descarga de resultados en archivos `.txt`.
- Procesamiento local sin depender de APIs pagadas.

---

## Tecnologías utilizadas

### Frontend

- HTML5
- CSS3
- JavaScript
- Fetch API
- MediaRecorder API
- `getUserMedia()`
- `getDisplayMedia()`

### Backend

- Python 3.14
- Flask
- faster-whisper
- CTranslate2
- Silero VAD
- Ollama
- Qwen 2.5

### Modelos utilizados

- Whisper `small` para transcripción.
- `qwen2.5:1.5b` como modelo base de respuestas.
- Modelo personalizado de Ollama: `asistente-docente-rapido`.

---

## Arquitectura

```text
┌─────────────────────────────────────────────┐
│ Navegador                                   │
│                                             │
│ HTML + CSS + JavaScript                     │
│ MediaRecorder                               │
│ Captura de micrófono o pestaña              │
└──────────────────────┬──────────────────────┘
                       │
                       │ HTTP / Fetch
                       ▼
┌─────────────────────────────────────────────┐
│ Flask                                       │
│                                             │
│ /api/transcribir                            │
│ /api/detectar-pregunta                      │
│ /api/responder                              │
└──────────────┬───────────────────────┬──────┘
               │                       │
               ▼                       ▼
┌────────────────────────┐   ┌────────────────────────┐
│ faster-whisper         │   │ Ollama                 │
│                        │   │                        │
│ Transcripción local    │   │ Clasificación          │
│ Detección de silencios │   │ Generación de respuesta│
└────────────────────────┘   └────────────────────────┘
```

---

## Estructura del proyecto

```text
TeachCopilot-IA/
├── app.py
├── requirements.txt
├── Modelfile
├── .gitignore
├── README.md
├── audios_temporales/
├── templates/
│   └── index.html
└── static/
    ├── app.js
    └── styles.css
```

La carpeta `audios_temporales` se utiliza solamente durante el procesamiento. Los fragmentos se eliminan después de ser transcritos.

---

## Capturas

<img width="1900" height="827" alt="image" src="https://github.com/user-attachments/assets/cf3b719d-293a-45b9-bb66-5f9d66585953" />

<img width="1901" height="812" alt="image" src="https://github.com/user-attachments/assets/515e6d13-7c74-473f-91d6-c02394f35484" />


---

## Requisitos

Antes de ejecutar la aplicación, debes tener instalado:

- Windows 10 o Windows 11.
- Python 3.14 o una versión compatible.
- Ollama.
- Google Chrome o Microsoft Edge.
- Git, opcionalmente, para clonar el repositorio.
- Al menos 8 GB de memoria RAM.
- Espacio disponible para descargar los modelos locales.

El rendimiento dependerá del procesador, memoria y disponibilidad de GPU.

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/patricio-silva-morales/TeachCopilot-IA.git
cd TeachCopilot-IA
```

### 2. Crear un entorno virtual

```bash
python -m venv venv
```

### 3. Activar el entorno virtual

En CMD:

```bash
venv\Scripts\activate
```

En PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Cuando el entorno esté activo, la terminal mostrará algo parecido a:

```text
(venv) C:\Proyectos\asistente-docente-ia>
```

### 4. Instalar dependencias

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

El archivo `requirements.txt` debe contener:

```txt
Flask
faster-whisper
ollama
```

---

## Instalación y configuración de Ollama

### 1. Instalar Ollama

Descarga e instala Ollama desde su sitio oficial.

Después, abre una terminal nueva y comprueba la instalación:

```bash
ollama --version
```

### 2. Descargar el modelo base

```bash
ollama pull qwen2.5:1.5b
```

### 3. Crear el modelo personalizado

Desde la carpeta del proyecto:

```bash
ollama create asistente-docente-rapido -f Modelfile
```

### 4. Comprobar los modelos instalados

```bash
ollama list
```

Debería aparecer:

```text
asistente-docente-rapido:latest
qwen2.5:1.5b
```

### 5. Probar el modelo

```bash
ollama run asistente-docente-rapido
```

Ejemplo de pregunta:

```text
¿Cuál es la diferencia entre for y while en Python?
```

Para salir:

```text
/bye
```

---

## Configuración del modelo personalizado

El archivo `Modelfile` define el comportamiento del asistente.

Ejemplo:

```text
FROM qwen2.5:1.5b

PARAMETER temperature 0
PARAMETER num_predict 70
PARAMETER num_ctx 1024
PARAMETER repeat_penalty 1.1

SYSTEM """
Eres un asistente para un profesor.

Responde exclusivamente en español.
Nunca respondas en portugués.
Nunca mezcles español y portugués.

Entrega respuestas breves, claras y concretas.
Utiliza como máximo 45 palabras.
Adapta la explicación a estudiantes principiantes.
No agregues saludos.
No repitas la pregunta.
No inventes información.

Conserva en inglés los términos técnicos de programación,
como for, while, input, print, range, string y framework.
"""
```

Después de modificar el archivo, reconstruye el modelo:

```bash
ollama create asistente-docente-rapido -f Modelfile
```

---

## Ejecución

Activa el entorno virtual:

```bash
venv\Scripts\activate
```

Ejecuta Flask:

```bash
python app.py
```

Espera hasta que aparezca:

```text
Modelo Whisper cargado correctamente.
Running on http://127.0.0.1:5000
```

Abre la aplicación en Chrome o Edge:

```text
http://127.0.0.1:5000
```

Después de realizar cambios en JavaScript o CSS, utiliza una recarga completa:

```text
Ctrl + F5
```

---

## Uso de la aplicación

### Capturar desde micrófono

1. Selecciona `Micrófono` como fuente de audio.
2. Escribe el tema de la clase.
3. Presiona `Iniciar captura`.
4. Autoriza el uso del micrófono.
5. Formula una pregunta.
6. Espera a que la aplicación transcriba y analice la intervención.

Ejemplo:

```text
Profesor, ¿cuál es la diferencia entre un ciclo for y un ciclo while?
```

### Capturar una videoconferencia

1. Abre la videoconferencia en una pestaña.
2. Abre el asistente en otra pestaña.
3. Selecciona `Pestaña o pantalla`.
4. Presiona `Iniciar captura`.
5. Selecciona la pestaña de la videoconferencia.
6. Activa la opción para compartir audio.
7. Mantén la pestaña compartida durante la clase.

Para obtener mejores resultados, conviene seleccionar una pestaña del navegador en lugar de la pantalla completa.

---

## Flujo de procesamiento

### Transcripción

El navegador graba fragmentos de audio y los envía a Flask mediante `multipart/form-data`.

Flask guarda cada fragmento temporalmente, lo transcribe y lo elimina después del procesamiento.

### Detección de preguntas

La aplicación utiliza dos mecanismos:

1. Reglas locales para detectar preguntas evidentes.
2. Ollama para analizar casos ambiguos o preguntas indirectas.

Ejemplo de pregunta explícita:

```text
¿Cómo puedo evitar un ciclo infinito?
```

Ejemplo de pregunta indirecta:

```text
No entendí cuándo debería usar while.
```

### Generación de respuestas

Cuando se registra una pregunta, Flask consulta el modelo local de Ollama y devuelve una respuesta breve.

Ejemplo:

```text
while conviene cuando no conoces de antemano la cantidad de repeticiones y deseas continuar mientras una condición sea verdadera.
```

---

## Configuración recomendada

Para un equipo con CPU y sin GPU dedicada:

```python
MODELO_WHISPER = "small"
MODELO_RESPUESTAS = "asistente-docente-rapido"
```

Parámetros sugeridos para Whisper:

```python
{
    "language": "es",
    "vad_filter": True,
    "beam_size": 3,
    "temperature": 0,
    "condition_on_previous_text": False
}
```

Parámetros sugeridos para Ollama:

```python
{
    "temperature": 0,
    "num_predict": 70,
    "num_ctx": 1024,
    "repeat_penalty": 1.1
}
```

Duración recomendada de fragmentos:

```text
12 a 15 segundos
```

Superposición recomendada:

```text
2 segundos
```

---

## Mejora del rendimiento

### Usar un modelo Whisper más rápido

Para equipos con recursos limitados:

```python
MODELO_WHISPER = "base"
```

Para pruebas rápidas:

```python
MODELO_WHISPER = "tiny"
```

### Usar respuestas más breves

Reduce `num_predict`:

```python
"num_predict": 50
```

### Reducir el contexto enviado

```python
MAX_CONTEXTO_RESPUESTA = 500
```

### Mantener Ollama cargado

La aplicación puede utilizar:

```python
keep_alive="2h"
```

Esto evita que el modelo se descargue de memoria entre preguntas.

### Revisar el uso de CPU o GPU

```bash
ollama ps
```

---

## Mejora de la calidad de transcripción

Para obtener mejores resultados:

- Captura directamente el audio de la pestaña.
- Usa audífonos al probar con micrófono.
- Evita ruido ambiental.
- Utiliza fragmentos de 12 a 15 segundos.
- Mantén una superposición entre bloques.
- Incluye vocabulario técnico en `initial_prompt`.
- Usa el modelo Whisper `small`.
- Evita voces superpuestas.
- Mantén un volumen de entrada estable.

---

## Limitaciones actuales

- No distingue automáticamente entre profesor y estudiante.
- Las preguntas retóricas pueden generar falsos positivos.
- Una pregunta puede dividirse entre dos fragmentos.
- La calidad depende de la fuente de audio.
- Whisper y Ollama pueden competir por CPU y memoria.
- La respuesta no aparece de forma instantánea en equipos modestos.
- La detección no reemplaza la revisión del docente.
- No existe persistencia en base de datos.
- No hay autenticación.
- La aplicación está orientada actualmente a ejecución local.
- La captura de audio de pantalla depende del navegador y del sistema operativo.

---

## Privacidad

La aplicación está diseñada para funcionar localmente.

- No utiliza una API externa de pago.
- Los modelos se ejecutan en el computador.
- Los archivos de audio se guardan temporalmente.
- Los fragmentos se eliminan después de ser procesados.
- No se guarda audio permanentemente por defecto.
- No se envían transcripciones a servicios externos.

Antes de utilizarla en clases reales, se recomienda informar a los participantes que el audio será procesado y revisar la normativa aplicable en la institución y el país.

---

## Seguridad

No publiques:

- Entornos virtuales.
- Audios temporales.
- Archivos `.env`.
- Modelos descargados.
- Información privada de estudiantes.
- Grabaciones de clases.

El archivo `.gitignore` debe incluir:

```gitignore
venv/
.venv/
__pycache__/
*.py[cod]
.env
.env.*
audios_temporales/
*.webm
*.wav
*.mp3
*.m4a
*.ogg
models/
modelos/
*.gguf
*.onnx
*.bin
*.log
.vscode/
.idea/
.DS_Store
Thumbs.db
```

---

## Posibles mejoras futuras

- Detección de fin de intervención mediante silencio.
- Transcripción por streaming con WebSocket.
- Identificación de hablantes.
- Separación entre voz del docente y estudiantes.
- Carga de material de clase.
- Respuestas basadas en documentos del curso.
- Historial persistente de preguntas.
- Base de datos local.
- Exportación a PDF.
- Resumen de dudas al finalizar la clase.
- Estadísticas por tema.
- Marcado de preguntas respondidas.
- Evaluación de calidad de respuestas.
- Configuración de longitud y nivel de respuesta.
- Integración directa con Zoom, Meet o Teams.
- Empaquetado como aplicación de escritorio.
- Interfaz administrativa.
- Modo multiusuario.

---

## Solución de problemas

### `No module named 'faster_whisper'`

Activa el entorno virtual:

```bash
venv\Scripts\activate
```

Instala las dependencias:

```bash
python -m pip install -r requirements.txt
```

### Ollama no genera respuestas

Comprueba que esté ejecutándose:

```bash
ollama list
```

Verifica que exista el modelo:

```text
asistente-docente-rapido
```

También puedes ejecutar:

```bash
ollama serve
```

### El navegador no captura audio

- Utiliza Chrome o Edge.
- Selecciona una pestaña.
- Activa la opción para compartir audio.
- Comprueba los permisos del micrófono.
- Abre la aplicación desde `localhost` o `127.0.0.1`.

### La primera ejecución tarda mucho

La primera vez, Whisper puede descargar el modelo. Ollama también debe cargar su modelo en memoria.

Las ejecuciones posteriores suelen ser más rápidas.

### La transcripción corta una pregunta

Aumenta la duración del fragmento y conserva la superposición. También puedes mejorar el buffer que une bloques incompletos.

### La aplicación responde en portugués

Reconstruye el modelo personalizado después de verificar las instrucciones del `Modelfile`:

```bash
ollama create asistente-docente-rapido -f Modelfile
```

### Error de JavaScript después de modificar archivos

Abre las herramientas del navegador y revisa la consola.

Después realiza una recarga completa:

```text
Ctrl + F5
```

---

## Desarrollo

Para trabajar en el proyecto:

```bash
git clone https://github.com/USUARIO/asistente-docente-ia.git
cd asistente-docente-ia
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
ollama pull qwen2.5:1.5b
ollama create asistente-docente-rapido -f Modelfile
python app.py
```

---

## Contribuciones

Las contribuciones son bienvenidas.

Antes de enviar cambios:

1. Crea una rama:

```bash
git checkout -b feature/nombre-funcionalidad
```

2. Realiza los cambios.
3. Verifica el funcionamiento local.
4. Crea un commit descriptivo:

```bash
git commit -m "feat: agregar nueva funcionalidad"
```

5. Sube la rama:

```bash
git push origin feature/nombre-funcionalidad
```

6. Abre un Pull Request.

---

## Convención sugerida para commits

```text
feat: nueva funcionalidad
fix: corrección de errores
docs: cambios en documentación
refactor: reorganización de código
style: cambios visuales o de formato
test: incorporación de pruebas
chore: tareas de mantenimiento
```

Ejemplo:

```bash
git commit -m "feat: detectar preguntas y generar respuestas locales"
```

---

## Estado del proyecto

El proyecto se encuentra en etapa de MVP.

Su objetivo actual es validar:

- La captura de audio desde una aplicación web.
- La transcripción local de una clase.
- La detección automática de preguntas.
- La generación de respuestas útiles para el docente.
- El rendimiento de modelos locales en equipos de uso cotidiano.

No se recomienda todavía como sistema definitivo para producción o para evaluaciones académicas de alta importancia.

---

## Licencia

```text
MIT License
```

---

## Autor

```text
Nombre: Patricio Silva Morales
Sitio web: https://www.giat.cl/
LinkedIn: https://www.linkedin.com/in/patricio-silva-morales-909b00240/
Correo: patricio.silva.morales@hotmail.com | psilv531@gmail.com
```

---

## Acerca del proyecto

TeachCopilot IA es una aplicación web de ejecución local que combina transcripción de audio, detección de preguntas y generación de respuestas breves. Está orientada a docentes que necesitan apoyo durante clases virtuales, sin depender de servicios externos de pago ni de claves de API.

El proyecto también sirve como base experimental para explorar el uso de asistentes educativos, el procesamiento local de audio y la ejecución de modelos de lenguaje en equipos personales.

El proyecto busca servir como base para experimentar con asistentes educativos, procesamiento local de audio y modelos de lenguaje ejecutados en equipos personales.
