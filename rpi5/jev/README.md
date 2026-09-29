# JEV en Raspberry Pi 5

Asistente local basado en `qwen2.5:1.5b` vía Ollama, con contexto de IsaHaven (EpsMatrix).

## Instalación
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama create jev -f Modelfile
cp -r . /home/pi/jev && cd /home/pi/jev
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # completa con la llave PUBLICABLE
sudo cp jev.service /etc/systemd/system/ && sudo systemctl enable --now jev
```

## Uso
```bash
curl -X POST http://127.0.0.1:8787/jev -H "Authorization: Bearer <JWT del usuario>" \
  -H "Content-Type: application/json" -d '{"mensaje":"hola"}'
```

## Seguridad
- Ollama (11434) y la API (8787) escuchan solo en `127.0.0.1`. No abras puertos ni uses port-forwarding.
- EpsMatrix consulta con el JWT del propio usuario: RLS limita los datos a su cuenta.
- Solo se aceptan moods de la lista cerrada; el resto se descarta.
- Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` ni `sb_secret_` en la Pi.
