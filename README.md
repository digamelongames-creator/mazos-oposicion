# Mazos Oposición

App de repaso espaciado estilo AnkiDroid con el banco de preguntas tipo test de Policía Nacional.

- App: https://digamelongames-creator.github.io/mazos-oposicion/ (en Chrome Android: menú ⋮ → Instalar aplicación)
- Progreso: se guarda en el dispositivo y se sincroniza con Firebase (carpeta `mazosOposicion`).
- Avisos: `.github/workflows/avisos.yml` se ejecuta cada hora y envía una notificación a las horas elegidas en Ajustes con las preguntas pendientes por tema.
  Secreto necesario en Settings → Secrets and variables → Actions: `VAPID_PRIVATE`.
