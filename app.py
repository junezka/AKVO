import json
import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, redirect
from flask_cors import CORS
from mysql.connector import Error

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "akvo-db"),
    "autocommit": True,
}

BASE_DIR = Path(__file__).resolve().parent


def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


def init_db():
    try:
        conn = mysql.connector.connect(
            host=DB_CONFIG["host"],
            port=DB_CONFIG["port"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            autocommit=True,
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        cursor.close()
        conn.close()

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnosticos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_nombre VARCHAR(255) NOT NULL,
                empresa_contacto VARCHAR(255) NOT NULL,
                etapa_negocio VARCHAR(120) DEFAULT 'No especificada',
                financiera DECIMAL(5,2) DEFAULT 0,
                contable DECIMAL(5,2) DEFAULT 0,
                procesos DECIMAL(5,2) DEFAULT 0,
                digital DECIMAL(5,2) DEFAULT 0,
                estrategia DECIMAL(5,2) DEFAULT 0,
                total_score DECIMAL(5,2) DEFAULT 0,
                respuestas_financiera JSON DEFAULT NULL,
                respuestas_contable JSON DEFAULT NULL,
                respuestas_procesos JSON DEFAULT NULL,
                respuestas_digital JSON DEFAULT NULL,
                respuestas_estrategia JSON DEFAULT NULL,
                estado VARCHAR(30) DEFAULT 'en_proceso',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'diagnosticos' AND COLUMN_NAME = %s
                """,
                (DB_CONFIG["database"], column),
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(f"ALTER TABLE diagnosticos ADD COLUMN {column} JSON DEFAULT NULL")
        cursor.execute("DROP TABLE IF EXISTS modulos")
        conn.commit()
        cursor.close()
        conn.close()
    except Error as exc:
        print(f"Error initializing DB: {exc}")


@app.get("/api/health")
def health():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({"ok": True, "message": "Conexión a MySQL correcta"})
    except Error as exc:
        return jsonify({"ok": False, "message": "No se pudo conectar a MySQL", "error": str(exc)}), 500


@app.post("/api/diagnosticos")
def create_diagnostico():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("empresa_nombre") or "Sin nombre").strip()
    etapa = data.get("etapa_negocio") or "No especificada"

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO diagnosticos (empresa_nombre, etapa_negocio, estado) VALUES (%s, %s, 'en_proceso')",
            (nombre, etapa),
        )
        diagnostico_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "id": diagnostico_id, "message": "Diagnóstico creado"})
    except Error as exc:
        return jsonify({"success": False, "message": "Error al crear el diagnóstico", "error": str(exc)}), 500


@app.post("/api/modulos")
def save_module():
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
        cursor = conn.cursor()
        cursor.execute(
            f"""
            UPDATE diagnosticos
            SET {score_column} = %s,
                {response_column} = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (float(score), json.dumps(respuestas, ensure_ascii=False), diagnostico_id),
        )
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Diagnóstico no encontrado."}), 404
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": f"Módulo {modulo} guardado"})
    except Error as exc:
        return jsonify({"success": False, "message": "Error al guardar el módulo", "error": str(exc)}), 500


@app.post("/api/diagnosticos/<int:diagnostico_id>/finalizar")
def finalize_diagnostico(diagnostico_id):
    data = request.get_json(silent=True) or {}
    scores = {
        "financiera": data.get("financiera", 0),
        "contable": data.get("contable", 0),
        "procesos": data.get("procesos", 0),
        "digital": data.get("digital", 0),
        "estrategia": data.get("estrategia", 0),
        "total_score": data.get("total_score", 0),
    }

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE diagnosticos
            SET financiera = %s,
                contable = %s,
                procesos = %s,
                digital = %s,
                estrategia = %s,
                total_score = %s,
                estado = 'completado',
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                float(scores["financiera"]),
                float(scores["contable"]),
                float(scores["procesos"]),
                float(scores["digital"]),
                float(scores["estrategia"]),
                float(scores["total_score"]),
                diagnostico_id,
            ),
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": "Diagnóstico final guardado"})
    except Error as exc:
        return jsonify({"success": False, "message": "Error al guardar diagnóstico final", "error": str(exc)}), 500


@app.get("/api/diagnosticos")
def list_diagnosticos():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM diagnosticos ORDER BY created_at DESC"
        )
        diagnosticos = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "data": diagnosticos})
    except Error as exc:
        return jsonify({"success": False, "message": "Error listando diagnósticos", "error": str(exc)}), 500


@app.get("/api/diagnosticos/<int:diagnostico_id>")
def get_diagnostico(diagnostico_id):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM diagnosticos WHERE id = %s", (diagnostico_id,))
        diagnostico = cursor.fetchone()

        cursor.close()
        conn.close()
        if not diagnostico:
            return jsonify({"success": False, "message": "Diagnóstico no encontrado"}), 404
        return jsonify({"success": True, "data": diagnostico})
    except Error as exc:
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


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=False)
