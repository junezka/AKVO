import json
import os
import psycopg
import smtplib

from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from psycopg.rows import dict_row

load_dotenv()

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")

BASE_DIR = Path(__file__).resolve().parent


def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL no configurada")
    return psycopg.connect(DATABASE_URL, autocommit=True)


def init_db():
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS diagnosticos (
                    id BIGSERIAL PRIMARY KEY,
                    empresa_nombre TEXT NOT NULL,
                    empresa_contacto TEXT NOT NULL,
                    etapa_negocio TEXT DEFAULT 'No especificada',
                    financiera NUMERIC(5,2) DEFAULT 0,
                    contable NUMERIC(5,2) DEFAULT 0,
                    procesos NUMERIC(5,2) DEFAULT 0,
                    digital NUMERIC(5,2) DEFAULT 0,
                    estrategia NUMERIC(5,2) DEFAULT 0,
                    total_score NUMERIC(5,2) DEFAULT 0,
                    respuestas_financiera JSONB DEFAULT NULL,
                    respuestas_contable JSONB DEFAULT NULL,
                    respuestas_procesos JSONB DEFAULT NULL,
                    respuestas_digital JSONB DEFAULT NULL,
                    respuestas_estrategia JSONB DEFAULT NULL
                )
                """
            )
            for column in (
                "respuestas_financiera",
                "respuestas_contable",
                "respuestas_procesos",
                "respuestas_digital",
                "respuestas_estrategia",
            ):
                cursor.execute(
                    """
                    SELECT EXISTS(
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'diagnosticos' AND column_name = %s
                    )
                    """,
                    (column,),
                )
                if not cursor.fetchone()[0]:
                    cursor.execute(f"ALTER TABLE diagnosticos ADD COLUMN {column} JSONB DEFAULT NULL")
        conn.commit()
        conn.close()
    except Exception as exc:
        print(f"Error initializing DB: {exc}")


@app.get("/api/health")
def health():
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        conn.close()
        return jsonify({"ok": True, "message": "Conexión a Supabase PostgreSQL correcta"})
    except Exception as exc:
        return jsonify({"ok": False, "message": "No se pudo conectar a la base de datos", "error": str(exc)}), 500


@app.post("/api/diagnosticos")
def create_diagnostico():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("empresa_nombre") or "Sin nombre").strip()
    contacto = (data.get("empresa_contacto") or data.get("contacto") or "Sin contacto").strip()
    etapa = data.get("etapa_negocio") or "No especificada"

    if not contacto:
        contacto = "Sin contacto"

    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO diagnosticos (empresa_nombre, empresa_contacto, etapa_negocio)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (nombre, contacto, etapa),
            )
            diagnostico_id = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return jsonify({"success": True, "id": diagnostico_id, "message": "Diagnóstico creado"})
    except Exception as exc:
        return jsonify({"success": False, "message": "Error al crear el diagnóstico", "error": str(exc)}), 500


@app.post("/api/modulos")
def modulos():
    data = request.get_json(silent=True) or {}
    diagnostico_id = data.get("diagnostico_id")
    modulo = data.get("modulo")
    score = data.get("score", 0)
    respuestas = data.get("respuestas", {})

    if not diagnostico_id or not modulo:
        return jsonify({"success": False, "message": "Faltan diagnostico_id o modulo."}), 400

    response_column = {
        "financiera": "respuestas_financiera",
        "contable": "respuestas_contable",
        "procesos": "respuestas_procesos",
        "digital": "respuestas_digital",
        "estrategia": "respuestas_estrategia",
    }.get(modulo)
    score_column = {
        "financiera": "financiera",
        "contable": "contable",
        "procesos": "procesos",
        "digital": "digital",
        "estrategia": "estrategia",
    }.get(modulo)
    if not response_column:
        return jsonify({"success": False, "message": "Módulo no válido."}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            # CORREGIDO: Se quitó la referencia a updated_at que hacía fallar el UPDATE
            cursor.execute(
                f"""
                UPDATE diagnosticos
                SET {score_column} = %s,
                    {response_column} = %s
                WHERE id = %s
                """,
                (float(score), json.dumps(respuestas, ensure_ascii=False), diagnostico_id),
            )
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({"success": False, "message": "Diagnóstico no encontrado."}), 404
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Módulo {modulo} guardado"})
    except Exception as exc:
        return jsonify({"success": False, "message": "Error al guardar el módulo", "error": str(exc)}), 500


@app.get("/api/diagnosticos")
def list_diagnosticos():
    try:
        conn = get_connection()
        with conn.cursor(row_factory=dict_row) as cursor:
            # CORREGIDO: Se cambió ORDER BY created_at DESC por ORDER BY id DESC
            cursor.execute(
                "SELECT * FROM diagnosticos ORDER BY id DESC"
            )
            diagnosticos = cursor.fetchall()
        conn.close()
        return jsonify({"success": True, "data": diagnosticos})
    except Exception as exc:
        return jsonify({"success": False, "message": "Error listando diagnósticos", "error": str(exc)}), 500


@app.get("/api/diagnosticos/<int:diagnostico_id>")
def get_diagnostico(diagnostico_id):
    try:
        conn = get_connection()
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute("SELECT * FROM diagnosticos WHERE id = %s", (diagnostico_id,))
            diagnostico = cursor.fetchone()
        conn.close()
        if not diagnostico:
            return jsonify({"success": False, "message": "Diagnóstico no encontrado"}), 404
        return jsonify({"success": True, "data": diagnostico})
    except Exception as exc:
        return jsonify({"success": False, "message": "Error consultando diagnóstico", "error": str(exc)}), 500


@app.route("/")
def index():
    return send_file(str(BASE_DIR / "pages" / "index.html"))


@app.route("/pages/<path:filename>")
def serve_frontend(filename):
    file_path = BASE_DIR / "pages" / filename
    if file_path.exists():
        return send_file(str(file_path))
    return jsonify({"success": False, "message": "Archivo no encontrado"}), 404


@app.route("/<filename>")
def serve_frontend_legacy(filename):
    if filename.endswith(".html"):
        file_path = BASE_DIR / "pages" / filename
        if file_path.exists():
            return send_file(str(file_path))
    return jsonify({"success": False, "message": "Archivo no encontrado"}), 404


@app.route("/styles/<path:filename>")
def serve_styles(filename):
    file_path = BASE_DIR / "styles" / filename
    if file_path.exists():
        return send_file(str(file_path), mimetype="text/css")
    return jsonify({"success": False, "message": "Archivo CSS no encontrado"}), 404


@app.route("/images/<path:filename>")
def serve_images(filename):
    file_path = BASE_DIR / "images" / filename
    if file_path.exists():
        return send_file(str(file_path))
    return jsonify({"success": False, "message": "Archivo de imagen no encontrado"}), 404


@app.route("/admin")
def admin_page():
    return send_file(str(BASE_DIR / "admin.html"))


# Inicializar la base de datos al arrancar
init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=False)