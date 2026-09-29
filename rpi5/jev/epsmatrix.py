"""EpsMatrix: lee el último mood y el saldo IBC del usuario usando SU JWT (RLS)."""
import os
import requests

MOODS = {"feliz", "bien", "normal", "confundida", "frustrada",
         "cansada", "enfocada", "ansiosa", "triste", "motivada"}


def _headers(jwt: str) -> dict:
    key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
    if key.startswith("sb_secret_"):
        raise RuntimeError("Usa la llave publicable, nunca la secreta")
    return {"apikey": key, "Authorization": f"Bearer {jwt}"}


def fetch_context(jwt: str) -> dict:
    base = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
    h = _headers(jwt)
    mood_rows = requests.get(f"{base}/emotional_feedback", headers=h, timeout=10, params={
        "select": "mood", "order": "created_at.desc", "limit": "1"}).json()
    wallet = requests.get(f"{base}/ibc_wallets", headers=h, timeout=10, params={
        "select": "balance", "limit": "1"}).json()
    mood = mood_rows[0]["mood"] if isinstance(mood_rows, list) and mood_rows else None
    if mood not in MOODS:
        mood = None  # solo aceptamos moods enumerados
    balance = wallet[0]["balance"] if isinstance(wallet, list) and wallet else 0
    return {"mood": mood, "balance": int(balance) if isinstance(balance, (int, float)) else 0}
