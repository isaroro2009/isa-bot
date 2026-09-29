"""API local para JEV (Ollama). Escucha solo en 127.0.0.1."""
import os
import requests
from flask import Flask, jsonify, request
from epsmatrix import fetch_context

OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("JEV_MODEL", "jev")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024


@app.post("/jev")
def jev():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify(error="unauthorized"), 401
    body = request.get_json(silent=True) or {}
    msg = str(body.get("mensaje", ""))[:2000].strip()
    if not msg:
        return jsonify(error="mensaje vacío"), 400
    ctx = fetch_context(auth[7:])
    prompt = f"Ánimo: {ctx['mood'] or 'desconocido'}. Saldo IBC: {ctx['balance']}.\nUsuario: {msg}"
    r = requests.post(f"{OLLAMA}/api/generate", timeout=120,
                      json={"model": MODEL, "prompt": prompt, "stream": False})
    r.raise_for_status()
    return jsonify(respuesta=r.json().get("response", ""), contexto=ctx)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("JEV_PORT", "8787")))
